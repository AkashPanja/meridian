import { create } from "zustand";

// ponytail: single tiny store instead of contexts/providers per concern
interface Desk {
  mode: "paper" | "live";
  killed: boolean;
  ai: boolean;
  auto: boolean;
  theme: "dark" | "light";
  tradesToday: number;
  dayLoss: number;
  arm: (phrase: string) => boolean;
  disarm: () => void;
  toggleKill: () => void;
  toggleAi: () => void;
  toggleAuto: () => void;
  toggleTheme: () => void;
  recordFill: (lossDelta: number) => void;
}

export const useDesk = create<Desk>((set) => ({
  mode: "paper",
  killed: false,
  ai: true,
  auto: false,
  theme: "dark",
  tradesToday: 0,
  dayLoss: 0,
  arm: (phrase) => {
    if (phrase.trim() !== "ENABLE LIVE") return false;
    set({ mode: "live" });
    return true;
  },
  disarm: () => set({ mode: "paper" }),
  toggleKill: () => set((s) => ({ killed: !s.killed })),
  toggleAi: () => set((s) => ({ ai: !s.ai })),
  toggleAuto: () => set((s) => ({ auto: !s.auto })),
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
  recordFill: (lossDelta) =>
    set((s) => ({ tradesToday: s.tradesToday + 1, dayLoss: s.dayLoss + Math.max(0, lossDelta) })),
}));
