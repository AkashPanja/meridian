"use client";

import { createChart, LineSeries } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { useDesk } from "../../store";

const inr = (v: number) => "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });

// ponytail: mock rows until GET /api/portfolio lands; same shape binds real data later
const POS = [
  { s: "NIFTY 25000 CE", seg: "Index options", q: 150, e: 120, l: 137 },
  { s: "RELIANCE FUT", seg: "Stock futures", q: 250, e: 2931, l: 2940 },
];
const EQUITY = [0, 1200, -800, 2400, 5100, 4300, 6800, 5900, 8100, 9400].map((v, i) => ({
  time: `2026-10-${String(i + 1).padStart(2, "0")}`,
  value: 1000000 + v,
}));
const RESERVED = 20000;

export default function Portfolio() {
  const mode = useDesk((s) => s.mode);
  const alloc = mode === "live" ? 500000 : 1000000;
  const chartRef = useRef<HTMLDivElement>(null);
  const [caps, setCaps] = useState<Record<string, number>>({ "Index options": 40, "Stock futures": 30, "Equity intraday": 30 });

  useEffect(() => {
    if (!chartRef.current) return;
    const css = getComputedStyle(document.documentElement);
    const chart = createChart(chartRef.current, {
      height: 220,
      layout: { background: { color: "transparent" }, textColor: css.getPropertyValue("--text-2").trim() || "#aaa" },
      grid: { vertLines: { visible: false }, horzLines: { color: css.getPropertyValue("--border").trim() || "#2a2a2a" } },
    });
    const line = chart.addSeries(LineSeries, { color: css.getPropertyValue("--gain").trim() || "#00d4aa", lineWidth: 2 });
    line.setData(EQUITY);
    const ro = new ResizeObserver(() => chart.applyOptions({ width: chartRef.current!.clientWidth }));
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  const deployed = POS.reduce((a, p) => a + p.q * p.e * (p.s.includes("FUT") ? 0.12 : 1), 0);
  const avail = Math.max(0, alloc - deployed - RESERVED);
  const pnl = POS.reduce((a, p) => a + (p.l - p.e) * p.q, 0);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Portfolio <span className="muted text-base font-normal">{mode} account</span></h1>

      <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="muted text-xs">Capital allocated to the AI desk</div>
        <div className="num text-4xl">{inr(alloc)}</div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }} role="img" aria-label={`Deployed ${inr(deployed)}, reserved ${inr(RESERVED)}, available ${inr(avail)}`}>
          <div style={{ width: `${(deployed / alloc) * 100}%`, background: "var(--text)" }} />
          <div style={{ width: `${(RESERVED / alloc) * 100}%`, background: "var(--text-3)" }} />
        </div>
        <div className="num muted mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span>Deployed {inr(deployed)}</span>
          <span>Reserved {inr(RESERVED)}</span>
          <span>Available {inr(avail)}</span>
          <span className={pnl >= 0 ? "gain" : "loss"}>Open P&amp;L {pnl >= 0 ? "+" : ""}{inr(pnl)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <h2 className="font-semibold">Equity curve</h2>
        <div ref={chartRef} className="mt-2 w-full" />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <caption className="p-3 text-left font-semibold">Limits by segment <span className="muted font-normal">— % of allocation</span></caption>
          <thead><tr className="muted text-left text-xs"><th className="p-3">Segment</th><th className="p-3">Cap</th><th className="p-3">Cap amount</th><th className="p-3">In use</th></tr></thead>
          <tbody className="num">
            {Object.entries(caps).map(([k, v]) => {
              const used = POS.filter((p) => p.seg === k).reduce((a, p) => a + p.q * p.e, 0);
              return (
                <tr key={k} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="p-3">{k}</td>
                  <td className="p-3"><input type="number" aria-label={`${k} cap percent`} className="w-16 rounded border bg-transparent p-1" style={{ borderColor: "var(--border)" }}
                    value={v} onChange={(e) => setCaps({ ...caps, [k]: +e.target.value })} /> %</td>
                  <td className="p-3">{inr((alloc * v) / 100)}</td>
                  <td className="p-3">{inr(used)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <caption className="p-3 text-left font-semibold">Open positions</caption>
          <thead><tr className="muted text-left text-xs"><th className="p-3">Instrument</th><th className="p-3">Qty</th><th className="p-3">Entry</th><th className="p-3">Last</th><th className="p-3">P&amp;L</th></tr></thead>
          <tbody className="num">
            {POS.map((p) => {
              const x = (p.l - p.e) * p.q;
              return (
                <tr key={p.s} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="p-3">{p.s}</td><td className="p-3">{p.q}</td>
                  <td className="p-3">{p.e.toLocaleString("en-IN")}</td><td className="p-3">{p.l.toLocaleString("en-IN")}</td>
                  <td className={`p-3 ${x >= 0 ? "gain" : "loss"}`}>{x >= 0 ? "+" : ""}{inr(x)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
