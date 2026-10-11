"""Meridian API: thin HTTP layer over the deterministic risk engine.

Nothing here calls an LLM or a broker. Agents propose via these endpoints;
only a valid risk token lets anything proceed to execution.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import risk_engine as re
from execution import exit_check, submit

app = FastAPI(title="Meridian API", version="0.1.0")

# ponytail: locked to the local web app, no wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ValidateIn(BaseModel):
    plan: dict
    portfolio: dict
    market: dict
    config: dict = {}


class ExecuteIn(BaseModel):
    plan: dict
    token: str
    idempotency_key: str
    live_price: float
    mode: str = "paper"


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "meridian-api", "risk_engine_checks": 18}


@app.get("/api/state")
def state() -> dict:
    # ponytail: static until Postgres lands; paper default can never flip by accident
    return {"mode": "PAPER", "ai_enabled": True, "auto_exec": False, "kill_switch": False}


@app.post("/api/risk/validate")
def validate(body: ValidateIn) -> dict:
    d = re.decide(
        re.Plan(**body.plan),
        re.Portfolio(**body.portfolio),
        re.Market(**body.market),
        re.Config(**body.config),
    )
    return {
        "approved": d.approved,
        "token": d.token,
        "expires_at": d.expires_at,
        "plan_hash": d.plan_hash,
        "checks": [c.__dict__ for c in d.checks],
    }


@app.post("/api/execute")
def execute(body: ExecuteIn) -> dict:
    r = submit(re.Plan(**body.plan), body.token, body.idempotency_key, body.live_price, body.mode)
    return {"accepted": r.accepted, "reason": r.reason, "fill": r.fill.__dict__ if r.fill else None}


class ExitCheckIn(BaseModel):
    prices: dict[str, float]


@app.post("/api/exit-check")
def exitcheck(body: ExitCheckIn) -> dict:
    fills = exit_check(body.prices)
    return {"closed": [f.__dict__ for f in fills]}
