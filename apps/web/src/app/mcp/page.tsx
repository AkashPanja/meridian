"use client";

import { useState } from "react";

interface Tool { n: string; write: boolean; on: boolean }
interface Srv { name: string; tr: "http" | "stdio"; url: string; cmd: string; auth: string; st: string; tools: Tool[] }

// ponytail: mock servers until /api/mcp/servers lands; same shape binds real data later
const DEF: Srv[] = [
  { name: "fyers", tr: "http", url: "https://<fyers-mcp-host>/mcp", cmd: "", auth: "oauth", st: "Connected", tools: [{ n: "get_quote", write: false, on: true }, { n: "get_historical_data", write: false, on: true }, { n: "get_option_chain", write: false, on: true }] },
  { name: "groww", tr: "stdio", url: "", cmd: "npx -y <groww-mcp-package>", auth: "none", st: "Connected", tools: [{ n: "get_positions", write: false, on: true }, { n: "get_funds", write: false, on: true }, { n: "place_order", write: true, on: true }] },
];

export default function Mcp() {
  const [srvs, setSrvs] = useState(DEF);
  const [sel, setSel] = useState(0);
  const [json, setJson] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const x = srvs[sel];
  const set = (p: Partial<Srv>) => setSrvs(srvs.map((s, i) => (i === sel ? { ...s, ...p } : s)));

  const applyJson = () => {
    // ponytail: minimal validation — shape + secret-ref rule; backend re-validates
    try {
      const j = JSON.parse(json);
      const m = j.mcpServers || j;
      const names = Object.keys(m);
      if (!names.length) throw new Error("No servers found. Use {\"mcpServers\":{...}}.");
      const raw = /key|token|secret|password|authorization/i;
      const ref = /^(\$\{[A-Za-z0-9_]+\}|Bearer \$\{[A-Za-z0-9_]+\})$/;
      for (const [n, o] of Object.entries(m) as [string, Record<string, unknown>][]) {
        if (!o || typeof o !== "object" || (!o.command && !o.url)) throw new Error(`${n} needs a command (stdio) or a url (HTTP).`);
        for (const [k, v] of Object.entries({ ...((o.env as object) || {}), ...((o.headers as object) || {}) })) {
          if (raw.test(k) && !ref.test(String(v))) throw new Error(`Use a secret reference like \${NAME} for ${n}.${k}, not a raw value.`);
        }
      }
      setMsg(`Applied ${names.length} server${names.length > 1 ? "s" : ""}: ${names.join(", ")}.`);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid JSON.");
      setMsg("");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">MCP servers</h1>
      <p className="muted mt-1 text-sm">Secrets are <span className="num">{"${NAME}"}</span> references, never raw values. Placeholders below — replace with broker docs.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="flex gap-1 overflow-x-auto md:flex-col">
          {srvs.map((s, i) => (
            <button key={s.name} onClick={() => { setSel(i); setMsg(""); setErr(""); }}
              className="rounded-md px-3 py-2 text-left text-sm"
              style={i === sel ? { background: "var(--surface-hover)", fontWeight: 600 } : { color: "var(--text-2)" }}>
              {s.name}
              <div className={`text-xs ${s.st === "Connected" ? "gain" : "muted"}`}>{s.st} · {s.tr === "stdio" ? "stdio" : "HTTP"}</div>
            </button>
          ))}
        </div>
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <b className="text-lg">{x.name}</b>
            <span className={x.st === "Connected" ? "gain" : "muted"}>{x.st}</span>
            <span className="flex-1" />
            <button className="rounded-md border px-3 text-sm" style={{ borderColor: "var(--border)" }}
              onClick={() => { set({ st: "Connected" }); setMsg("Handshake ok, tools listed."); }}>Test connection</button>
          </div>
          <label className="muted mt-3 block text-xs" htmlFor="m-tr">Transport</label>
          <select id="m-tr" className="mt-1 w-full rounded-md border p-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
            value={x.tr} onChange={(e) => set({ tr: e.target.value as Srv["tr"] })}>
            <option value="stdio">stdio: local process</option>
            <option value="http">Streamable HTTP: URL</option>
          </select>
          {x.tr === "http" ? (
            <>
              <label className="muted mt-3 block text-xs" htmlFor="m-url">Server URL</label>
              <input id="m-url" className="num mt-1 w-full rounded-md border p-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
                value={x.url} onChange={(e) => set({ url: e.target.value })} />
              <label className="muted mt-3 block text-xs" htmlFor="m-auth">Authentication</label>
              <select id="m-auth" className="mt-1 w-full rounded-md border p-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
                value={x.auth} onChange={(e) => set({ auth: e.target.value })}>
                {["none", "bearer", "oauth"].map((a) => <option key={a} value={a}>{a === "oauth" ? "OAuth 2.1 with PKCE" : a}</option>)}
              </select>
            </>
          ) : (
            <>
              <label className="muted mt-3 block text-xs" htmlFor="m-cmd">Command</label>
              <input id="m-cmd" className="num mt-1 w-full rounded-md border p-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
                value={x.cmd} onChange={(e) => set({ cmd: e.target.value })} />
              <p className="muted mt-1 text-xs">stdio servers read credentials from their environment, so OAuth does not apply.</p>
            </>
          )}
          <div className="mt-4">
            <b className="text-sm">Tools from this server</b>
            <p className="muted text-xs">Only enabled tools reach agents. Write tools stay Execution-only behind risk approval.</p>
            {x.tools.map((t, j) => (
              <div key={t.n} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="num flex-1">{t.n}</span>
                <span className={t.write ? "loss text-xs" : "muted text-xs"}>{t.write ? "write · Execution only" : "read"}</span>
                <input type="checkbox" aria-label={`Enable ${t.n}`} className="h-5 w-5" checked={t.on}
                  onChange={(e) => set({ tools: x.tools.map((y, k) => (k === j ? { ...y, on: e.target.checked } : y)) })} />
              </div>
            ))}
          </div>
          <label className="muted mt-4 block text-xs" htmlFor="m-json">Apply JSON config</label>
          <textarea id="m-json" rows={4} placeholder='{"mcpServers":{"name":{"url":"https://..."}}}' className="num mt-1 w-full rounded-md border p-2.5 text-xs" style={{ background: "var(--bg)", borderColor: "var(--border)" }}
            value={json} onChange={(e) => setJson(e.target.value)} />
          {err && <p className="loss mt-1 text-xs" role="alert">{err}</p>}
          <div className="mt-2 flex items-center gap-3">
            <button className="rounded-md px-4 font-semibold text-black" style={{ background: "var(--accent)" }} onClick={applyJson}>Apply JSON</button>
            {msg && <span className="gain text-sm" role="status">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
