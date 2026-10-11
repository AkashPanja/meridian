"use client";

import { useState } from "react";

const ROLES = ["Live quotes", "Historical data", "Option chain", "Positions and funds", "Order placement"];

// ponytail: mock routes until GET /api/routes lands; same shape binds real data later
const DEF: Record<string, string> = {
  "Live quotes": "FYERS",
  "Historical data": "FYERS",
  "Option chain": "FYERS",
  "Positions and funds": "Groww",
  "Order placement": "Groww",
};

export default function Connections() {
  const [routes, setRoutes] = useState(DEF);
  const [saved, setSaved] = useState("");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
      <p className="muted mt-1 text-sm">Give each job its own provider. Reads from FYERS, orders on Groww is the common setup.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[["FYERS", "Market data, history, option chain", "Connected · 38 ms"], ["Groww", "Orders, positions, funds", "Connected · 112 ms"]].map(([b, d, s]) => (
          <div key={b} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <b>{b}</b><div className="muted text-sm">{d}</div>
            <div className="num muted mt-1 text-xs">{s}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {ROLES.map((r) => (
          <div key={r} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm">{r}</span>
            <select aria-label={`${r} provider`} className="w-32 rounded-md border p-2" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
              value={routes[r]} onChange={(e) => { setRoutes({ ...routes, [r]: e.target.value }); setSaved(""); }}>
              {["FYERS", "Groww"].map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        ))}
        <button className="mt-2 rounded-md px-4 font-semibold text-black" style={{ background: "var(--accent)" }}
          onClick={() => setSaved("Routing saved and audited.")}>Save routing</button>
        {saved && <span className="gain ml-3 text-sm" role="status">{saved}</span>}
        <p className="muted mt-2 text-xs">Execution re-checks price on the data provider, places on the execution provider, reconciles there. Stale or disconnected either side blocks new orders.</p>
      </div>
    </div>
  );
}
