"use client";

import { useState } from "react";

const TOOLS = ["get_quote", "get_historical_data", "get_option_chain", "get_positions", "get_funds", "search_news", "place_order"];

interface Cfg {
  prompt: string;
  provider: string;
  model: string;
  temp: number;
  on: boolean;
  v: number;
  tools: string[];
}

// ponytail: mock configs until GET /api/agents/{id}/config lands; same shape binds real data later
const DEF: Record<string, Cfg> = {
  "Main Brain": { prompt: "Break the goal into tasks for Research, Analysis and Planning. Reconcile disagreements. Thin or conflicting evidence means NO TRADE. Never place orders.", provider: "Anthropic", model: "Claude Opus 5.5", temp: 0.3, on: true, v: 1, tools: ["get_positions", "get_funds"] },
  Research: { prompt: "Gather news, events, FII/DII flows, option-chain OI and sector moves. Tag fact, data, inference or speculation with source and time.", provider: "Anthropic", model: "Claude Sonnet 5.5", temp: 0.2, on: true, v: 1, tools: ["get_quote", "get_option_chain", "search_news"] },
  Analysis: { prompt: "Turn research and price data into trend, VWAP, levels, volume, IV, regime. List bull AND bear factors plus invalidation. Never output bare BUY or SELL.", provider: "Anthropic", model: "Claude Sonnet 5.5", temp: 0.2, on: true, v: 1, tools: ["get_historical_data", "get_option_chain"] },
  Planning: { prompt: "Convert analysis into instrument, entry range, stop, targets, size, max loss, horizon, cancel and exit conditions. Size within risk limits.", provider: "Anthropic", model: "Claude Sonnet 5.5", temp: 0.1, on: true, v: 1, tools: ["get_funds"] },
  Risk: { prompt: "Explain the risk engine decision in plain language. Cannot change limits or override rejection.", provider: "Anthropic", model: "Claude Haiku 5.5", temp: 0, on: true, v: 1, tools: ["get_positions", "get_funds"] },
  Execution: { prompt: "Submit only plans with a valid risk approval token. Re-check price, track fills, report rejections. Never invent a thesis.", provider: "Anthropic", model: "Claude Haiku 5.5", temp: 0, on: true, v: 1, tools: ["get_quote", "place_order"] },
  Monitoring: { prompt: "Watch open positions against stop, target and thesis. Alert on invalidation. Suggest exits; never execute.", provider: "Anthropic", model: "Claude Haiku 5.5", temp: 0.1, on: true, v: 1, tools: ["get_quote", "get_positions"] },
};

export default function Agents() {
  const [cfgs, setCfgs] = useState(DEF);
  const [sel, setSel] = useState("Main Brain");
  const [saved, setSaved] = useState("");
  const c = cfgs[sel];
  const set = (p: Partial<Cfg>) => setCfgs({ ...cfgs, [sel]: { ...c, ...p } });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Agent prompts</h1>
      <p className="muted mt-1 text-sm">Saving creates a new prompt version. Risk limits stay in code, no prompt can override them.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="flex gap-1 overflow-x-auto md:flex-col">
          {Object.keys(cfgs).map((k) => (
            <button key={k} onClick={() => { setSel(k); setSaved(""); }}
              className="rounded-md px-3 text-left text-sm"
              style={k === sel ? { background: "var(--surface-hover)", fontWeight: 600 } : { color: "var(--text-2)" }}>
              {k} <span className="num muted text-xs">v{cfgs[k].v}{cfgs[k].on ? "" : " off"}</span>
            </button>
          ))}
        </div>
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <b className="text-lg">{sel}</b>
            <span className="num muted text-xs">prompt v{c.v}</span>
            <span className="flex-1" />
            <label className="flex items-center gap-2 text-sm">Enabled
              <input type="checkbox" className="h-5 w-5" checked={c.on} onChange={(e) => set({ on: e.target.checked })} />
            </label>
          </div>
          <label className="muted mt-3 block text-xs" htmlFor="ag-prompt">System prompt</label>
          <textarea id="ag-prompt" rows={6} className="mt-1 w-full rounded-md border p-2.5 font-mono text-[13px]" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
            value={c.prompt} onChange={(e) => set({ prompt: e.target.value })} />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="muted block text-xs" htmlFor="ag-pv">Provider</label>
              <select id="ag-pv" className="mt-1 w-full rounded-md border p-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
                value={c.provider} onChange={(e) => set({ provider: e.target.value })}>
                {["Anthropic", "OpenAI", "Google", "xAI", "Local (Ollama)"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="muted block text-xs" htmlFor="ag-model">Model id</label>
              <input id="ag-model" className="num mt-1 w-full rounded-md border p-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
                value={c.model} onChange={(e) => set({ model: e.target.value })} />
            </div>
            <div>
              <label className="muted block text-xs" htmlFor="ag-temp">Temperature <span className="num">{c.temp}</span></label>
              <input id="ag-temp" type="range" min={0} max={1} step={0.1} className="mt-3 w-full" value={c.temp} onChange={(e) => set({ temp: +e.target.value })} />
            </div>
          </div>
          <div className="muted mt-3 text-xs">Allowed tools</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {TOOLS.map((t) => {
              const locked = t === "place_order" && sel !== "Execution";
              return (
                <label key={t} className="num flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", opacity: locked ? 0.45 : 1 }}>
                  <input type="checkbox" className="h-4 w-4" disabled={locked} checked={c.tools.includes(t)}
                    onChange={(e) => set({ tools: e.target.checked ? [...c.tools, t] : c.tools.filter((x) => x !== t) })} />
                  {t}
                </label>
              );
            })}
          </div>
          <p className="muted mt-1 text-xs">Only Execution holds place_order, behind a risk approval token.</p>
          <div className="mt-4 flex items-center gap-2">
            <button className="rounded-md px-4 font-semibold text-black" style={{ background: "var(--accent)" }}
              onClick={() => { set({ v: c.v + 1 }); setSaved(`${sel} saved as v${c.v + 1}.`); }}>Save prompt</button>
            <button className="rounded-md border px-4" style={{ borderColor: "var(--border)" }}
              onClick={() => { setCfgs({ ...cfgs, [sel]: { ...DEF[sel], v: c.v + 1 } }); setSaved(`${sel} reset to default as v${c.v + 1}.`); }}>Reset to default</button>
            {saved && <span className="gain text-sm" role="status">{saved}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
