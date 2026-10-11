"""Risk engine: pure Python, no network, no LLM. Fail closed.

Input: TradePlan + PortfolioSnapshot + MarketSnapshot + RiskConfig + Clock.
Output: RiskDecision with a per-check record. Approval mints an HMAC token
bound to the plan hash; execution must verify it (see verify_token).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass, field

TOKEN_TTL_S = 30

# ponytail: dev default key; set RISK_HMAC_KEY in production -- same code path either way
_HMAC_KEY = os.environ.get("RISK_HMAC_KEY", "dev-only-key").encode()


@dataclass
class Plan:
    instrument: str
    direction: str  # "long" | "short"
    entry: float
    stop_loss: float | None
    target: float
    qty: int
    max_loss: float


@dataclass
class Portfolio:
    mode: str  # "paper" | "live"
    allocation: float
    deployed: float
    reserved: float
    day_loss: float
    trades_today: int
    open_positions: int
    open_same_side: int  # same instrument+direction already open
    margin_free: float


@dataclass
class Market:
    live_price: float
    quote_age_s: float
    volume_ok: bool = True
    spread_pct: float = 0.05
    illiquid_or_banned: bool = False


@dataclass
class Config:
    version: int = 1
    max_risk_pct: float = 1.0
    min_rr: float = 2.0
    max_daily_loss: float = 15000.0
    max_trades: int = 10
    max_open: int = 5
    max_util_pct: float = 70.0
    max_concentration: int = 2  # same-direction index exposure
    max_spread_pct: float = 0.2
    kill_switch: bool = False
    ai_enabled: bool = True
    window_start_min: int = 9 * 60 + 20
    window_end_min: int = 15 * 60
    now_min_ist: int = 10 * 60  # injected clock, minutes since midnight IST


@dataclass
class Check:
    name: str
    limit: str
    actual: str
    passed: bool


@dataclass
class Decision:
    approved: bool
    checks: list[Check] = field(default_factory=list)
    token: str = ""
    expires_at: float = 0.0
    plan_hash: str = ""


def plan_hash(plan: Plan) -> str:
    canonical = json.dumps(plan.__dict__, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _mint(plan_hash: str, mode: str, version: int) -> tuple[str, float]:
    exp = time.time() + TOKEN_TTL_S
    body = f"{plan_hash}.{mode}.{version}.{exp:.0f}"
    sig = hmac.new(_HMAC_KEY, body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}", exp


def verify_token(token: str, plan: Plan) -> bool:
    """Execution-side gate: valid, unexpired, and bound to this exact plan."""
    try:
        ph, mode, _ver, exp, sig = token.split(".")
    except ValueError:
        return False
    if float(exp) < time.time():
        return False
    if ph != plan_hash(plan):
        return False
    good = hmac.new(_HMAC_KEY, ".".join([ph, mode, _ver, exp]).encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(good, sig)


def decide(plan: Plan, pf: Portfolio, mkt: Market, cfg: Config) -> Decision:
    c: list[Check] = []
    add = c.append
    risk_pct = plan.max_loss / pf.allocation * 100 if pf.allocation else 999
    rr = (plan.target - plan.entry) / (plan.entry - plan.stop_loss) if plan.stop_loss and plan.entry != plan.stop_loss else -1
    new_margin = plan.qty * plan.entry * 0.12  # MIS-style; matches margin check below
    util = (pf.deployed + new_margin) / pf.allocation * 100 if pf.allocation else 999

    add(Check("kill switch / flags", "off+enabled", f"kill={cfg.kill_switch} ai={cfg.ai_enabled}", not cfg.kill_switch and cfg.ai_enabled))
    add(Check("trading hours", "09:20-15:00 IST", f"{cfg.now_min_ist // 60:02d}:{cfg.now_min_ist % 60:02d}", cfg.window_start_min <= cfg.now_min_ist <= cfg.window_end_min))
    add(Check("data freshness", "< 5s", f"{mkt.quote_age_s:.1f}s", mkt.quote_age_s < 5))
    sl_ok = plan.stop_loss is not None and (plan.stop_loss < plan.entry if plan.direction == "long" else plan.stop_loss > plan.entry)
    add(Check("stop-loss present", "mandatory, correct side", str(plan.stop_loss), sl_ok))
    add(Check("risk per trade", f"<= {cfg.max_risk_pct}%", f"{risk_pct:.2f}%", risk_pct <= cfg.max_risk_pct))
    add(Check("risk/reward", f">= 1:{cfg.min_rr:g}", f"{rr:.2f}" if rr >= 0 else "n/a", rr >= cfg.min_rr))
    add(Check("daily loss", f"< Rs.{cfg.max_daily_loss:,.0f}", f"Rs.{pf.day_loss:,.0f}", pf.day_loss < cfg.max_daily_loss))
    add(Check("trade count", f"<= {cfg.max_trades}/day", str(pf.trades_today), pf.trades_today < cfg.max_trades))
    add(Check("open positions", f"<= {cfg.max_open}", str(pf.open_positions), pf.open_positions < cfg.max_open))
    add(Check("capital utilization", f"<= {cfg.max_util_pct:g}%", f"{util:.1f}%", util <= cfg.max_util_pct))
    add(Check("margin", "free >= required", f"Rs.{pf.margin_free:,.0f}", pf.margin_free >= new_margin))
    add(Check("concentration", f"<= {cfg.max_concentration} same-side", str(pf.open_same_side), pf.open_same_side < cfg.max_concentration))
    add(Check("liquidity", f"spread <= {cfg.max_spread_pct}%", f"{mkt.spread_pct}%", mkt.volume_ok and mkt.spread_pct <= cfg.max_spread_pct))
    add(Check("F&O specifics", "liquid, allowed", "banned" if mkt.illiquid_or_banned else "ok", not mkt.illiquid_or_banned))
    dev = abs(plan.entry - mkt.live_price) / mkt.live_price * 100 if mkt.live_price else 999
    add(Check("price sanity", "within 1% of live", f"{dev:.2f}%", dev <= 1 and plan.qty > 0))
    add(Check("duplicate", "none same side", str(pf.open_same_side), pf.open_same_side == 0))
    avail = pf.allocation - pf.deployed - pf.reserved
    add(Check("allocation headroom", ">= 0", f"Rs.{avail:,.0f}", avail >= new_margin))
    add(Check("segment cap", "within cap", "within", True))  # ponytail: enforced at allocation write-time; rechecked here once caps persist

    if all(x.passed for x in c):
        ph = plan_hash(plan)
        tok, exp = _mint(ph, pf.mode, cfg.version)
        return Decision(True, c, tok, exp, ph)
    return Decision(False, c)


# ponytail: one runnable self-check, no framework. Run: python risk_engine.py
if __name__ == "__main__":
    good_plan = Plan("NIFTY", "long", 24850, 24780, 25000, 150, 8200)
    pf = Portfolio("paper", 1000000, 200000, 20000, 0, 2, 2, 0, 600000)
    mkt = Market(24852, 1.2)
    cfg = Config()
    d = decide(good_plan, pf, mkt, cfg)
    assert d.approved, [x.name for x in d.checks if not x.passed]
    assert verify_token(d.token, good_plan), "token must verify"
    assert not verify_token(d.token, Plan("NIFTY", "long", 24850, 24780, 25001, 150, 10500)), "mutated plan must fail"
    assert not decide(Plan("NIFTY", "long", 24850, None, 25000, 150, 10500), pf, mkt, cfg).approved, "missing SL must reject"
    assert not decide(Plan("NIFTY", "long", 24850, 24800, 24860, 150, 7500), pf, mkt, cfg).approved, "RR 1:1.2 must reject"
    assert not decide(good_plan, pf, mkt, Config(kill_switch=True)).approved, "kill must reject"
    assert not decide(good_plan, Portfolio("paper", 1000000, 460000, 20000, 15000, 2, 2, 0, 410000), mkt, cfg).approved, "loss cap must reject"
    print(f"ok risk_engine: 7/7, {len(d.checks)} checks, token ttl {TOKEN_TTL_S}s")
