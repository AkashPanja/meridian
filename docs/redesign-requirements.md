# Meridian Dashboard Redesign Requirements

Source: `AI Trading Agent Platform Architecture & Design Package.md` (Rev2 §13 wins)
+ sample `Meridian_ ask the desk (chat-first agent UI).html`.
Status: locked 2026-10-11. PAPER default, LIVE gated.

## 1. Monorepo target

```text
/apps/web   /services/api   /services/orchestrator   /services/agents
/services/market_data   /services/trading (risk, paper, live, execution)
/services/mcp_fyers   /services/mcp_groww   /packages/schemas   /infra
```

Web stack: Next.js + TypeScript, Tailwind + shadcn/ui, TanStack Query for REST,
Zustand single WS store (`/ws` channels: ticks, agent_activity, positions,
orders, alerts, system, `{channel, ts, seq, payload}`, resync via REST on seq gap),
lightweight-charts for all charts, Zod schemas from backend OpenAPI.
Formatting: INR `en-IN` everywhere, timezone `Asia/Kolkata` (IST) everywhere.

## 2. Theme (locked: both with toggle, dark-first)

Dark default (trader table-stakes):

```css
--bg: #0D0D0D; --surface: #141414; --surface-hover: #1A1A1A; --border: #2A2A2A;
--gain: #00D4AA; --loss: #FF4757; --warn: #FFB800;
--text: #FFFFFF; --text-2: #AAAAAA; --text-3: #828282;
```

Light keeps the current paper feel with the same token names.
Numbers: JetBrains Mono tabular. Labels/headings: Inter.
Radius: 8px (sharp terminal feel, not 12-20px everywhere). Flat borders, no shadows.
One accent only. SVG icons, no emoji. No decorative dots. No borders on every
table row. No em dashes in copy.

## 3. Pages (all 8, locked)

Chat, Pre-market plan, Agents, Connections, MCP servers, Portfolio, Risk, Logs.
Desktop: left nav. Mobile: bottom bar with 4 + More menu.
A11y: 4.5:1 contrast, 44px targets, visible focus, real labels, reduced-motion,
status as text + icon, never color alone.

## 4. Global shell (always visible)

- Ticker tape: NIFTY, BANKNIFTY, FINNIFTY, SENSEX, India VIX, breadth. Stale feed
  shows age + blocks new orders (fail closed).
- Mode badge, AI toggle, auto-exec toggle (default OFF, one-click human confirm
  per plan until opt-in), day P&L, health dots with ms (FYERS / Groww / MCP / data),
  Emergency Stop (blocks new entries instantly, cancels pending entries, does not
  auto-close unless `flatten: true`).
- LIVE danger theme (locked: full theme, not just frame): red header + red ticker
  + red page frame. Arm flow: type `ENABLE LIVE`, TTL ~8h, auto-expire back to
  PAPER. Never silent-switch on restart/reconnect. Confirm on every live order.

## 5. Chat (guided agent surface, not infinite transcript)

- Honest stream states per message: queued, streaming, tool-running,
  awaiting-review, complete, cancelled, errored. Stable dimensions, no layout
  shift, single polite live region for state changes.
- Tool-call cards: human name, lifecycle (pending/running/success/error/cancelled),
  inputs + summarized output + expandable raw JSON, provenance `tool via FYERS/Groww`,
  latency + prompt version + provider/model. Collapse noisy details after done.
- Approval card (every consequential action): target, material params,
  diff/consequence, authority + risk reason, Approve / Edit / Reject / Defer,
  timeout, proposal digest, persisted run state, receipt after (what changed,
  where, refs, agent, rollback hook).
- Plan card: instrument/side, entry range, stop, targets, size, max loss ₹, R:R,
  confidence, Approve / Dismiss. Writes `agent_events` with trace_id.
- `@research` / `@analysis` / `@risk` routing, starter chips for empty state,
  history, stop button while streaming, start/stop/pause with clear
  "what happens if you stop" semantics.

## 6. Pre-market plan (default 08:30 IST, scheduled)

Outlook (GIFT Nifty, global cues, FII/DII flows, events, VIX, expiry note),
setups table (instrument, side, trigger, stop, target, size, rationale, status:
Planned/Armed/Triggered/Skipped/Invalidated/Expired), countdown to 09:15 open.
Approve arms setups. Every revision = new version + timestamp + change summary +
diff vs approved + visible timeline; revision needs fresh approval. Trigger-time:
risk engine + manual confirm (unless auto-exec on). Skip/restore per setup.
Monitoring proposes revisions, never silent-edits.
Storage: `daily_plans`, `plan_setups`, `plan_updates`.

## 7. Portfolio

Broker balance vs AI desk allocation kept separate; paper and live allocations
separate. Engine uses allocation as capital base. Split: deployed / reserved for
pending / available with bar. Segment caps (% of allocation: index options,
stock futures, equity intraday) editable with allocation. Rules: live allocation
<= broker balance, >= deployed + reserved; live increase needs explicit confirm +
audit; trade exceeding available blocked (new risk checks 17 allocation headroom,
18 segment cap). Positions table: qty, entry/last, deployed, share, P&L ₹ + %,
allocation bars. Equity curve + day/realized/unrealized P&L.
Storage: `capital_allocations`, `segment_caps`, `provider_routes` (audited).

## 8. Agents config

Per agent: system prompt, provider (Anthropic/OpenAI/Google/xAI/Ollama),
free-text model id with suggestions, temperature, enabled flag, tool allowlist.
Save = new prompt version. Reset = default as new version. Every decision records
prompt version + provider + model. Constraints: Risk only explains (limits live in
code), `place_order` Execution-only behind risk token, disabling Risk blocks
execution, prompts never contain secrets, news/web stays untrusted quoted data.
Main Brain runs the opportunity state machine
(CREATED > RESEARCHING > ANALYZING > PLANNING > RISK_REVIEW > APPROVED >
AWAITING_ENTRY > ORDER_SUBMITTED > OPEN > EXITING > CLOSED, plus REJECTED /
CANCELLED / EXPIRED / FAILED); conflicts or low confidence = NO_TRADE recorded.
Storage: `agent_configs`, `agent_config_versions`.

## 9. MCP servers + Connections

- Routing table per role (defaults: quotes/history/option-chain > FYERS;
  positions/funds/order placement > Groww). Execution re-checks price on data
  provider, places on execution provider, reconciles fills there, max deviation
  enforced. Either side stale/disconnected/circuit-broken = new orders blocked.
- MCP: form + JSON `mcpServers` + our `auth` extension, paste/apply/validate/export.
  Transports stdio (command/args/env) or Streamable HTTP (URL/headers). Auth none /
  bearer-API-key / OAuth 2.1 PKCE (HTTP only; stdio uses env). OAuth: scopes,
  dynamic registration or manual client ID, optional secret ref + auth/token URL
  overrides, read-only redirect `http://127.0.0.1:8787/oauth/callback/<server>`.
- Secrets are `${NAME}` refs only; raw values rejected on save. Tokens encrypted
  backend-only, never to browser/agents. Authorize/refresh/revoke with alerts on
  expiry failure (tools blocked). Test = initialize handshake + `tools/list` +
  per-tool enable switch. stdio supervised (start/health/restart backoff).
- Agents see read tools only. Write tools Execution-only behind approval token.
- Storage: `mcp_servers`, `mcp_tools`, `oauth_tokens` (encrypted), audit on change.

## 10. Risk & Controls

Deterministic engine (no network/LLM, fail closed): kill flags, hours + NSE
holidays, freshness, mandatory SL, per-trade risk, R:R >= 1:2, daily loss,
count <= 10/day, open <= 5, utilization <= 70%, margin + buffer, concentration,
liquidity, F&O/expiry/ban/IV rules, price sanity, duplicates, allocation
headroom, segment cap. Single failure = REJECTED with all failing checks.
Approval = HMAC token `{plan_hash, mode, risk_config_version, expiry <= 30s}`;
execution rejects mismatched/expired tokens. PUT risk config = new version +
history. Open item: real FYERS/Groww MCP endpoints, scopes, and SEBI/algo rules
(static IP, algo tagging) verified from broker docs before live.

## 11. Non-goals for this pass

Replay/backtest, prompt A/B, journal, per-agent cost/latency, Telegram/WhatsApp
approvals, Greeks/payoff view, strategy library, audit export. Kept as backlog.
