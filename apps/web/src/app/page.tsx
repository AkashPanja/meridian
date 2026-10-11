"use client";

import { useState } from "react";
import { MAX_TRADES_PER_DAY, decide } from "../policy/autoApprove";
import { useDesk } from "../store";

const SUG = [
  "Find an intraday setup on NIFTY",
  "Is BANKNIFTY worth trading today?",
  "@research What moved RELIANCE this morning?",
  "How am I doing against my risk limits?",
];

interface Step {
  name: string;
  tools: string[];
  detail: string;
  state: "run" | "done";
}

interface Msg {
  role: "u" | "a";
  text: string;
  steps?: Step[];
}

interface Pending {
  id: string;
  sym: string;
  qty: number;
  price: number;
}

// ponytail: canned pipeline until agent SSE streams; step shape matches session/update events
const PIPE: Omit<Step, "state">[] = [
  { name: "Research", tools: ["get_quote via FYERS", "get_option_chain", "search_news"], detail: "NIFTY 24,850 above VWAP since 09:45. Put OI at 24,800. FII net buyers." },
  { name: "Analysis", tools: ["get_historical_data"], detail: "Trend up. Support 24,780, resistance 25,000. Against: VIX rising. Confidence 0.78." },
  { name: "Planning", tools: ["get_funds"], detail: "Long 150, stop 24,780, target 25,000, max loss ₹10,500." },
  { name: "Risk", tools: ["risk_engine.validate"], detail: "16 of 16 passed. Risk 0.82%, R:R 2.1, exposure 46%." },
];

const inr0 = (v: number) => "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  const fire = (p: Pending, via: "auto" | "ticket") => {
    const s = useDesk.getState();
    s.recordFill(0); // ponytail: mock fill at entry; backend reports real slippage later
    const n = useDesk.getState().tradesToday;
    setMsgs((m) => [...m, {
      role: "a",
      text: `Filled in ${s.mode} mode (${via} #${n}/${MAX_TRADES_PER_DAY}): bought ${p.qty} ${p.sym} at ${inr0(p.price)}. Day loss ${inr0(useDesk.getState().dayLoss)}.`,
    }]);
    setPending(null);
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || pending) return;
    setQ("");
    setMsgs((m) => [...m, { role: "u", text: t }]);
    const s = useDesk.getState();
    const plan: Pending = { id: `T-${1044 + s.tradesToday}`, sym: "NIFTY", qty: 150, price: 24850 };
    if (s.killed) {
      setMsgs((m) => [...m, { role: "a", text: "Emergency stop is active. I can still research and analyse, but no new trades until you release it." }]);
      return;
    }
    setMsgs((m) => [...m, { role: "a", text: `Checking ${plan.sym} across the desk.`, steps: PIPE.map((p) => ({ ...p, state: "run" as const })) }]);
    const idx = msgs.length + 1;
    PIPE.forEach((_, i) => {
      setTimeout(() => {
        setMsgs((m) => m.map((msg, j) => (j === idx && msg.steps ? {
          ...msg,
          steps: msg.steps.map((st, k) => (k <= i ? { ...st, state: "done" as const } : st)),
        } : msg)));
      }, 600 * (i + 1));
    });
    setTimeout(() => {
      const g = useDesk.getState();
      const v = decide({ killed: g.killed, auto: g.auto, tradesToday: g.tradesToday, dayLoss: g.dayLoss });
      if (v.fire) fire(plan, "auto");
      else if (g.auto) setMsgs((m) => [...m, { role: "a", text: `Held: ${v.reason}.` }]);
      else setPending(plan);
    }, 600 * PIPE.length + 200);
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4">
      <div className="flex-1 overflow-y-auto py-6" aria-live="polite">
        {msgs.length === 0 ? (
          <div className="pt-[9vh] text-center">
            <h1 className="text-3xl font-semibold tracking-tight">What should the desk look at?</h1>
            <p className="muted mt-2">Agents research, analyse and plan. Risk-passed plans auto-fire; caps and kill switch still stop everything.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUG.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border px-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) =>
            m.role === "u" ? (
              <div key={i} className="mb-4 flex justify-end">
                <div className="max-w-[80%] rounded-xl px-4 py-2" style={{ background: "var(--surface-hover)" }}>{m.text}</div>
              </div>
            ) : (
              <div key={i} className="mb-4">
                <div className="muted text-xs font-medium">Main Brain</div>
                <div className="mt-1 rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  {m.text}
                  {m.steps && (
                    <div className="mt-3">
                      {m.steps.map((st) => (
                        <div key={st.name} className="border-t py-2 first:border-t-0" style={{ borderColor: "var(--border)" }}>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className={st.state === "done" ? "gain" : "muted"} aria-label={st.state}>{st.state === "done" ? "✓" : "…"}</span>
                            {st.name}
                          </div>
                          {st.state === "done" && (
                            <>
                              <div className="muted mt-0.5 text-[13px]">{st.detail}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {st.tools.map((tl) => (
                                  <span key={tl} className="num rounded px-1.5 py-0.5 text-[11px]" style={{ background: "var(--surface-hover)", color: "var(--text-2)" }}>{tl}</span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )
        )}
        {pending && (
          <div className="mb-4 rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--accent)" }}>
            <b>Ticket {pending.id}</b>
            <span className="muted text-sm"> — auto-exec is off, needs your approval</span>
            <div className="num mt-1 text-sm">Long {pending.qty} {pending.sym} at {inr0(pending.price)}</div>
            <div className="mt-3 flex gap-2">
              <button className="rounded-md px-4 font-semibold text-black" style={{ background: "var(--accent)" }} onClick={() => fire(pending, "ticket")}>Approve</button>
              <button className="rounded-md border px-4" style={{ borderColor: "var(--border)" }} onClick={() => {
                setPending(null);
                setMsgs((m) => [...m, { role: "a", text: `Ticket ${pending.id} dismissed.` }]);
              }}>Dismiss</button>
            </div>
          </div>
        )}
      </div>
      <form
        className="mb-4 rounded-xl border p-2"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        onSubmit={(e) => { e.preventDefault(); send(q); }}
      >
        <label htmlFor="chat-q" className="sr-only">Message the desk</label>
        <textarea id="chat-q" rows={2} className="w-full resize-none bg-transparent p-2 outline-none"
          placeholder="Ask the Main Brain, or mention an agent with @research" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(q); } }} />
        <div className="flex items-center justify-end px-1 pb-1">
          <button className="rounded-full px-5 text-sm font-semibold text-black" style={{ background: "var(--accent)" }} aria-label="Send message">Send</button>
        </div>
      </form>
    </div>
  );
}
