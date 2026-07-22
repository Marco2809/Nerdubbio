import { useSyncExternalStore } from "react";

/** Tipi di traguardo festeggiati col modal (non il "sei in pari" settimanale). */
export type CelebrationKind =
  | "ended" // serie conclusa: hai visto tutto
  | "nextSeasonDated" // finita l'ultima stagione, la prossima ha già una data
  | "caughtUpOpen"; // in pari, la serie potrebbe continuare ma niente date ancora

export type Celebration = {
  kind: CelebrationKind;
  title: string;
  /** Prossima uscita (solo nextSeasonDated), ISO yyyy-mm-dd. */
  airDate?: string | null;
  season?: number;
  episode?: number;
};

let current: Celebration | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function showCelebration(c: Celebration) {
  current = c;
  emit();
}

export function dismissCelebration() {
  if (!current) return;
  current = null;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCelebration(): Celebration | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
