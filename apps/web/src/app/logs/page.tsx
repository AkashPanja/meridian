"use client";

import { useState } from "react";

// ponytail: mock events until /api/logs + /ws land; same row shape binds real events later
const ROWS: [string, string, string][] = [
  ["11:21:04", "Risk", "Rejected T-1043: risk/reward 1:1.4"],
  ["11:02:45", "Analysis", "LLM timeout, retried OK"],
  ["10:47:12", "Execution", "Paper fill NIFTY 150 @ 24,850 (auto #2/10)"],
  ["10:31:00", "Monitoring", "RELIANCE 12 pts from stop, thesis intact"],
  ["09:05:00", "Planning", "Plan revised to v2, needs fresh approval"],
  ["08:30:00", "Orchestrator", "Plan v1 created from overnight data"],
];

export default function Logs() {
  const [f, setF] = useState("");

  const rows = ROWS.filter(([, s, e]) => (s + " " + e).toLowerCase().includes(f.toLowerCase()));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">System log</h1>
      <label className="muted mt-3 block text-xs" htmlFor="log-f">Filter events</label>
      <input id="log-f" placeholder="e.g. risk, fill, T-1043" className="mt-1 w-full max-w-sm rounded-md border p-2.5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        value={f} onChange={(e) => setF(e.target.value)} />
      <div className="mt-3 overflow-x-auto rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead><tr className="muted text-left text-xs"><th className="p-3">Time</th><th className="p-3">Source</th><th className="p-3">Event</th></tr></thead>
          <tbody>
            {rows.map(([t, s, e], i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="num muted p-3">{t}</td>
                <td className="p-3">{s}</td>
                <td className="p-3">{e}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="muted p-4 text-center text-sm">No events match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
