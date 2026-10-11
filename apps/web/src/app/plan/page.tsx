"use client";

import { useState } from "react";

interface Setup {
  id: string;
  sym: string;
  side: string;
  trigger: string;
  stop: string;
  target: string;
  size: number;
  why: string;
  status: string;
}

// ponytail: mock plan until GET /api/plans/today lands; same shape binds real data later
const V1: Setup[] = [
  { id: "P1", sym: "NIFTY", side: "Long", trigger: "Above 24,880 after 09:30", stop: "24,800", target: "25,020", size: 150, why: "Gap-up holding above VWAP; put OI at 24,800.", status: "Planned" },
  { id: "P2", sym: "BANKNIFTY", side: "Short", trigger: "Below 53,100 with volume", stop: "53,260", target: "52,700", size: 30, why: "Resistance 53,250; weak private-bank breadth.", status: "Planned" },
  { id: "P3", sym: "RELIANCE", side: "Long", trigger: "Above 2,950", stop: "2,918", target: "3,010", size: 250, why: "Results due; only on volume confirmation.", status: "Planned" },
];

export default function Plan() {
  const [v, setV] = useState(2);
  const [ok, setOk] = useState(false);
  const [setups, setUps] = useState(V1);
  const [log, setLog] = useState<string[]>([
    "09:05 v2: GIFT Nifty +0.4% gap up. NIFTY trigger raised to 24,880.",
    "08:30 v1: created from overnight data, FII/DII flows, option-chain OI.",
  ]);

  const skip = (id: string) =>
    setUps(setups.map((s) => (s.id === id ? { ...s, status: s.status === "Skipped" ? "Planned" : "Skipped" } : s)));
  const approve = () => {
    setOk(true);
    setUps(setups.map((s) => (s.status === "Planned" ? { ...s, status: "Armed" } : s)));
  };
  const revise = () => {
    // ponytail: one canned revision; backend diffs real versions later
    setV(v + 1);
    setOk(false);
    setUps(setups.map((s) => (s.id === "P3" ? { ...s, size: 150, status: "Planned" } : s.status === "Armed" ? { ...s, status: "Planned" } : s)));
    setLog([`v${v + 1}: re-read live data. RELIANCE cut to 150 on open volatility. Needs fresh approval.`, ...log]);
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plan for today</h1>
          <p className="muted text-sm">Version {v} · drafted by Main Brain</p>
        </div>
        <span className="flex-1" />
        <button className="rounded-md border px-4" style={{ borderColor: "var(--border)" }} onClick={revise}>Ask agents to revise</button>
        <button className="rounded-md px-4 font-semibold text-black disabled:opacity-40" style={{ background: "var(--accent)" }} disabled={ok} onClick={approve}>
          {ok ? "Plan approved" : "Approve plan for the day"}
        </button>
      </div>

      <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <h2 className="font-semibold">Outlook</h2>
        <p className="muted mt-1 text-sm">GIFT Nifty +0.4%, US flat, India VIX 13.4. FIIs net buyers yesterday. Weekly NIFTY expiry tomorrow, faster late-day decay.</p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead><tr className="muted text-left text-xs"><th className="p-3">Setup</th><th className="p-3">Trigger</th><th className="p-3">Stop</th><th className="p-3">Target</th><th className="p-3">Size</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {setups.map((s) => (
              <tr key={s.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="p-3"><b>{s.sym} {s.side}</b><div className="muted max-w-60 text-xs">{s.why}</div></td>
                <td className="p-3">{s.trigger}</td>
                <td className="num loss p-3">{s.stop}</td>
                <td className="num gain p-3">{s.target}</td>
                <td className="num p-3">{s.size}</td>
                <td className="p-3">{s.status}</td>
                <td className="p-3"><button className="rounded-md border px-3 text-xs" style={{ borderColor: "var(--border)" }} onClick={() => skip(s.id)}>
                  {s.status === "Skipped" ? "Restore" : "Skip"}
                </button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <h2 className="font-semibold">Plan updates</h2>
        {log.map((l, i) => <div key={i} className="muted mt-2 text-sm">{l}</div>)}
      </div>
      <p className="muted mt-3 text-xs">Approving arms setups. Each still passes the risk engine at trigger time. Any revision needs fresh approval.</p>
    </div>
  );
}
