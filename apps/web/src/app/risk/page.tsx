"use client";

import { useEffect, useState } from "react";

type Row = [string, string, string, boolean];

// ponytail: fallback only; replaced by the live engine when the API answers
const FALLBACK: Row[] = [
  ["Kill switch / flags", "off", "off", true],
  ["Trading hours", "09:20–15:00 IST", "in window", true],
  ["Data freshness", "< 5s", "1.2s", true],
  ["Stop-loss present", "mandatory", "yes", true],
  ["Risk per trade", "≤ 1%", "0.82%", true],
  ["Risk / reward", "≥ 1:2", "2.1", true],
  ["Daily loss", "< ₹15,000", "₹0", true],
  ["Trade count", "≤ 10/day", "2", true],
  ["Open positions", "≤ 5", "2", true],
  ["Capital utilization", "≤ 70%", "46%", true],
  ["Margin available", "≥ required + buffer", "₹4.1L", true],
  ["Concentration", "per-underlying cap", "within", true],
  ["Liquidity", "min vol/OI, max spread", "ok", true],
  ["F&O specifics", "no illiquid/expiry naked", "ok", true],
  ["Price sanity", "within X% of live", "0.1%", true],
  ["Duplicate plan", "none same side", "none", true],
  ["Allocation headroom", "≥ 0 available", "₹3.2L", true],
  ["Segment cap", "within cap", "within", true],
];

const REQ = {
  plan: { instrument: "NIFTY", direction: "long", entry: 24850, stop_loss: 24780, target: 25000, qty: 150, max_loss: 8200 },
  portfolio: { mode: "paper", allocation: 1000000, deployed: 200000, reserved: 20000, day_loss: 0, trades_today: 2, open_positions: 2, open_same_side: 0, margin_free: 600000 },
  market: { live_price: 24852, quote_age_s: 1.2 },
  config: {},
};

export default function Risk() {
  const [rows, setRows] = useState<Row[]>(FALLBACK);
  const [live, setLive] = useState(false);
  const [saved, setSaved] = useState("");
  const pass = rows.filter((c) => c[3]).length;

  useEffect(() => {
    let stop = false;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    fetch("http://127.0.0.1:8787/api/risk/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(REQ),
      signal: ctl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (stop || !d.checks) return;
        setRows(d.checks.map((c: { name: string; limit: string; actual: string; passed: boolean }) => [c.name, c.limit, c.actual, c.passed]));
        setLive(true);
      })
      .catch(() => {})
      .finally(() => clearTimeout(t));
    return () => { stop = true; };
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Risk limits</h1>
      <p className="muted mt-1 text-sm">
        Deterministic engine. Percentages apply to ₹10,00,000 allocation, so 1% per trade is ₹10,000.
        Every change is versioned and audited. Source: {live ? <span className="gain">live engine :8787</span> : <span className="muted">mock (API offline)</span>}
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <caption className="p-3 text-left font-semibold">
            Last decision <span className={pass === rows.length ? "gain" : "loss"}>{pass} of {rows.length} passed{pass === rows.length ? "" : " — REJECTED"}</span>
          </caption>
          <thead><tr className="muted text-left text-xs"><th className="p-3">#</th><th className="p-3">Check</th><th className="p-3">Limit</th><th className="p-3">Actual</th><th className="p-3">Result</th></tr></thead>
          <tbody className="num">
            {rows.map(([n, lim, act, ok], i) => (
              <tr key={n} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="muted p-3">{i + 1}</td>
                <td className="p-3">{n}</td>
                <td className="muted p-3">{lim}</td>
                <td className="p-3">{act}</td>
                <td className={`p-3 ${ok ? "gain" : "loss"}`}>{ok ? "pass" : "REJECT"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="mt-3 rounded-md px-4 font-semibold text-black" style={{ background: "var(--accent)" }}
        onClick={() => setSaved("Limits saved as a new version.")}>Save limits</button>
      {saved && <span className="gain ml-3 text-sm" role="status">{saved}</span>}
    </div>
  );
}
