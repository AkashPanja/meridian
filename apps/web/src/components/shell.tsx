"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDesk } from "../store";

const NAV: [string, string][] = [
  ["/", "Chat"],
  ["/plan", "Plan"],
  ["/agents", "Agents"],
  ["/connections", "Connections"],
  ["/mcp", "MCP servers"],
  ["/portfolio", "Portfolio"],
  ["/risk", "Risk"],
  ["/logs", "Logs"],
];

// ponytail: static mock tape until /ws lands; same markup binds live data later
const TAPE = [
  ["NIFTY", "24,850.20", "+0.42%", true],
  ["BANKNIFTY", "53,210.55", "-0.18%", false],
  ["FINNIFTY", "23,640.10", "+0.11%", true],
  ["SENSEX", "81,420.30", "+0.35%", true],
  ["INDIA VIX", "13.40", "+2.10%", false],
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const d = useDesk();
  const path = usePathname();
  const [arming, setArming] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [err, setErr] = useState("");
  const live = d.mode === "live";

  useEffect(() => {
    document.documentElement.dataset.theme = d.theme;
  }, [d.theme]);

  const kill = () => {
    // ponytail: native confirm instead of a modal component
    if (confirm(d.killed ? "Release the emergency stop?" : "Stop all trading? New orders are blocked. Positions stay open.")) d.toggleKill();
  };

  return (
    <div className={live ? "live-shell min-h-full flex flex-col" : "min-h-full flex flex-col"}>
      <div className="overflow-hidden border-b" style={{ borderColor: "var(--border)" }} aria-label="Market ticker">
        <div className="ticker-track flex gap-8 whitespace-nowrap py-1.5 px-4 w-max">
          {[...TAPE, ...TAPE].map(([s, p, c, up], i) => (
            <span key={i} className="num text-xs">
              <span className="muted">{s} </span>
              {p} <span className={up ? "gain" : "loss"}>{c}</span>
            </span>
          ))}
        </div>
      </div>

      <header
        className={live ? "live-header flex items-center gap-3 px-4 py-2" : "flex items-center gap-3 px-4 py-2 border-b"}
        style={live ? undefined : { borderColor: "var(--border)" }}
      >
        {live ? (
          <button className="num rounded-md bg-red-600 px-3 font-bold text-white" onClick={d.disarm} aria-label="Disarm live trading">
            LIVE
          </button>
        ) : (
          <button className="num rounded-md border px-3" style={{ borderColor: "var(--border)" }} onClick={() => { setArming(true); setPhrase(""); setErr(""); }}>
            PAPER
          </button>
        )}
        <span className="muted num text-xs">AI {d.ai ? "on" : "off"}</span>
        <button className="muted text-xs underline" onClick={d.toggleAi}>toggle</button>
        <span className="muted num text-xs">auto-exec {d.auto ? "on" : "off"}</span>
        <button className="muted text-xs underline" onClick={d.toggleAuto}>toggle</button>
        <span className="muted text-xs hidden sm:inline">FYERS 38ms · Groww 112ms</span>
        <span className="num gain text-sm font-semibold">₹0</span>
        <span className="flex-1" />
        <button className="text-xs underline" onClick={d.toggleTheme}>{d.theme === "dark" ? "Light" : "Dark"}</button>
        <button
          className={d.killed ? "rounded-md border px-3 text-sm" : "rounded-md bg-red-600 px-3 text-sm font-semibold text-white"}
          style={d.killed ? { borderColor: "var(--border)" } : undefined}
          onClick={kill}
        >
          {d.killed ? "Stopped — release?" : "Stop all trading"}
        </button>
      </header>
      {d.killed && <div className="loss px-4 py-1 text-xs font-semibold">Emergency stop active. Research still works; no new trades.</div>}

      <div className="flex flex-1 min-h-0">
        <nav className="desk-nav hidden w-44 shrink-0 flex-col gap-1 border-r p-2 md:flex" style={{ borderColor: "var(--border)", background: "var(--bg)" }} aria-label="Primary">
          {NAV.map(([h, l]) => (
            <Link key={h} href={h} aria-current={path === h ? "page" : undefined}
              className="rounded-md px-3 text-sm"
              style={path === h ? { background: "var(--surface-hover)", fontWeight: 600 } : { color: "var(--text-2)" }}>
              {l}
            </Link>
          ))}
        </nav>
        <main id="main" className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
      </div>

      <nav className="desk-nav flex border-t p-1 md:hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} aria-label="Primary mobile">
        {NAV.slice(0, 4).map(([h, l]) => (
          <Link key={h} href={h} className="flex-1 rounded-md px-1 py-1 text-center text-xs" style={path === h ? { fontWeight: 700 } : { color: "var(--text-2)" }}>{l}</Link>
        ))}
        <Link href="/portfolio" className="flex-1 rounded-md px-1 py-1 text-center text-xs" style={{ color: "var(--text-2)" }}>More</Link>
      </nav>

      {arming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.6)" }} role="dialog" aria-modal="true" aria-label="Arm live trading">
          <div className="w-full max-w-sm rounded-lg border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold">Arm live trading</h2>
            <p className="muted text-sm">Real orders reach your broker. Expires back to PAPER after 8 hours.</p>
            <label className="muted mt-3 block text-xs" htmlFor="arm-phrase">Type ENABLE LIVE to confirm</label>
            <input id="arm-phrase" className="num mt-1 w-full rounded-md border p-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
              value={phrase} onChange={(e) => setPhrase(e.target.value)} />
            {err && <p className="loss text-xs" role="alert">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border px-4" style={{ borderColor: "var(--border)" }} onClick={() => setArming(false)}>Stay in paper</button>
              <button className="rounded-md bg-red-600 px-4 font-semibold text-white" onClick={() => {
                if (d.arm(phrase)) setArming(false);
                else setErr("Type ENABLE LIVE exactly.");
              }}>Arm live</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
