import type { LibraryState } from '@/lib/php/library-client';

const KEYS = ['nerdubbio:v2', 'nerdubbio-user-store'] as const;

const initial: LibraryState = {
  xp: 0,
  level: 1,
  streak: 0,
  media: {},
  dismissed: [],
  achievements: [],
  onboardingDone: false,
  language: 'it',
  favoriteGenres: [],
  upcomingFilters: { newSeries: true, seasonPremieres: true, includeMovies: true },
  localMigrated: false,
  importPending: [],
};

/** Legge eventuali dati legacy da localStorage (una tantum). */
export function loadLocalLegacy(): LibraryState | null {
  if (typeof window === 'undefined') return null;
  for (const key of KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<LibraryState>;
      return {
        ...initial,
        ...parsed,
        media: parsed.media ?? {},
        dismissed: parsed.dismissed ?? [],
        achievements: parsed.achievements ?? [],
        favoriteGenres: parsed.favoriteGenres ?? [],
        upcomingFilters: parsed.upcomingFilters ?? initial.upcomingFilters,
      };
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function clearLocalLegacy(): void {
  if (typeof window === 'undefined') return;
  for (const key of KEYS) localStorage.removeItem(key);
}

export function localLegacyHasData(state: LibraryState | null): boolean {
  if (!state) return false;
  return Object.keys(state.media).length > 0 || state.xp > 0 || state.onboardingDone;
}

export function localLegacyMediaCount(state: LibraryState | null): number {
  return state ? Object.keys(state.media).length : 0;
}
