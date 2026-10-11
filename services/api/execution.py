"""Execution interface: the ONE writer. Paper fills only for now.

submit(plan, token, key, live_price): verifies the risk token, rejects
duplicates by idempotency key, fills MARKET at live price + slippage.
Live adapter plugs in beside paper_fill later; same submit() contract.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import risk_engine as re

SLIPPAGE_BPS = 5  # ponytail: fixed 5bps; spread-scaled model when fills look wrong


@dataclass
class Fill:
    order_id: str
    qty: int
    price: float
    fees: float = 0.0


@dataclass
class Report:
    accepted: bool
    reason: str
    fill: Fill | None = None


_orders: dict[str, Report] = {}  # ponytail: in-memory until Postgres; key = idempotency key
_positions: dict[str, Position] = {}  # key = order_id
_seq = 0


@dataclass
class Position:
    order_id: str
    instrument: str
    direction: str
    qty: int
    entry: float
    stop: float
    target: float
    status: str = "OPEN"  # OPEN | SL | TARGET


def _brokerage(buy_value: float) -> float:
    # ponytail: flat intraday estimate; full charge table when P&L looks off
    return round(buy_value * 0.0003 + 20, 2)


def submit(plan: re.Plan, token: str, key: str, live_price: float, mode: str = "paper") -> Report:
    global _seq
    if key in _orders:  # idempotent replay: same key returns the original receipt
        return _orders[key]
    if not re.verify_token(token, plan):
        return Report(False, "invalid, expired, or mismatched risk token")
    if mode != "paper":
        return Report(False, "live adapter not wired yet")
    slip = live_price * SLIPPAGE_BPS / 10000
    px = live_price + (slip if plan.direction == "long" else -slip)
    _seq += 1
    fill = Fill(f"ORD-{_seq:04d}", plan.qty, round(px, 2), _brokerage(plan.qty * px))
    rep = Report(True, "paper fill", fill)
    _orders[key] = rep
    _positions[fill.order_id] = Position(fill.order_id, plan.instrument, plan.direction, plan.qty, fill.price, plan.stop_loss or 0, plan.target)
    return rep


def exit_check(live: dict[str, float]) -> list[Fill]:
    """OCO bracket sweep: first touch wins, stop checked first (conservative)."""
    global _seq
    closed: list[Fill] = []
    for pos in _positions.values():
        if pos.status != "OPEN" or pos.instrument not in live:
            continue
        px = live[pos.instrument]
        hit = ""
        if pos.direction == "long":
            if px <= pos.stop: hit = "SL"
            elif px >= pos.target: hit = "TARGET"
        else:
            if px >= pos.stop: hit = "SL"
            elif px <= pos.target: hit = "TARGET"
        if hit:
            pos.status = hit
            _seq += 1
            closed.append(Fill(f"ORD-{_seq:04d}", pos.qty, px, _brokerage(pos.qty * px)))
    return closed


# ponytail: one runnable self-check, no framework. Run: python execution.py
if __name__ == "__main__":
    p = re.Plan("NIFTY", "long", 24850, 24780, 25000, 150, 8200)
    pf = re.Portfolio("paper", 1000000, 200000, 20000, 0, 2, 2, 0, 600000)
    d = re.decide(p, pf, re.Market(24852, 1.2), re.Config())
    assert d.approved
    r1 = submit(p, d.token, "k-1", 24852)
    assert r1.accepted and r1.fill is not None, r1.reason
    assert r1.fill.price > 24852, "long pays slippage upwards"
    r2 = submit(p, d.token, "k-1", 24860)
    assert r2 is r1, "same key must replay the original receipt"
    assert not submit(p, "bogus", "k-2", 24852).accepted, "bad token must reject"
    assert not submit(p, d.token, "k-3", 24852, "live").accepted, "live must refuse until adapter exists"
    assert exit_check({"NIFTY": 24900}) == [], "mid-range touches nothing"
    sl = exit_check({"NIFTY": 24770})
    assert len(sl) == 1 and _positions["ORD-0001"].status == "SL", "stop triggers first"
    assert exit_check({"NIFTY": 25010}) == [], "closed position never refires (OCO)"
    p2 = re.Plan("BANKNIFTY", "short", 53210, 53370, 52800, 30, 4000)
    d2 = re.decide(p2, pf, re.Market(53210, 1.0), re.Config())
    assert d2.approved
    submit(p2, d2.token, "k-4", 53210)
    tg = exit_check({"BANKNIFTY": 52790})
    assert len(tg) == 1, "short target triggers below target"
    print(f"ok execution: 9/9, fill {r1.fill.order_id} @ {r1.fill.price} fees {r1.fill.fees}")
