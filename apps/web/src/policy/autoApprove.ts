// Auto-approve policy: every risk-passed plan fires unless the loop caps stop it.
// Locked: everywhere (no mode gate), all-passed qualify, daily-loss + count caps, notify-only.
export const MAX_TRADES_PER_DAY = 10;
export const MAX_DAILY_LOSS = 15000; // ₹

export interface LoopState {
  killed: boolean;
  auto: boolean;
  tradesToday: number;
  dayLoss: number;
}

export interface Verdict {
  fire: boolean;
  reason: string;
}

export function decide(s: LoopState): Verdict {
  if (!s.auto) return { fire: false, reason: "auto-exec off — needs ticket approval" };
  if (s.killed) return { fire: false, reason: "emergency stop active" };
  if (s.tradesToday >= MAX_TRADES_PER_DAY) return { fire: false, reason: `max ${MAX_TRADES_PER_DAY} trades/day reached` };
  if (s.dayLoss >= MAX_DAILY_LOSS) return { fire: false, reason: `daily max loss ₹${MAX_DAILY_LOSS.toLocaleString("en-IN")} hit` };
  return { fire: true, reason: "risk passed, caps clear" };
}

// ponytail: one runnable self-check, no framework. Run: node src/policy/autoApprove.ts
const isMain = typeof process !== "undefined" && !!process.argv?.[1]?.endsWith("autoApprove.ts");
if (isMain) {
  const t = (name: string, cond: boolean) => {
    if (!cond) { console.error("FAIL " + name); process.exitCode = 1; }
    else console.log("ok " + name);
  };
  const base: LoopState = { killed: false, auto: true, tradesToday: 0, dayLoss: 0 };
  t("fires when clear", decide(base).fire);
  t("ask when auto off", !decide({ ...base, auto: false }).fire);
  t("blocked when killed", !decide({ ...base, killed: true }).fire);
  t("blocked at trade cap", !decide({ ...base, tradesToday: 10 }).fire);
  t("fires at 9 trades", decide({ ...base, tradesToday: 9 }).fire);
  t("blocked at loss cap", !decide({ ...base, dayLoss: 15000 }).fire);
  t("fires below loss cap", decide({ ...base, dayLoss: 14999 }).fire);
}
