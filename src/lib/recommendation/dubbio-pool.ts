import type { CatalogItem } from "@/lib/mock-catalog";
import type { LibraryState } from "@/lib/php/library-client";
import { tmdbDubbioCandidates } from "@/lib/tmdb/tmdb.functions";
import type { DoubtMode, QuizAnswers, UserProfile } from "./engine";
import { aggregateAnswers } from "./engine";
import { genresFromMoodTags } from "./genre-map";
import { serializePool } from "./tmdb-catalog";

export const DUBBIO_POOL_KEY = "nerdubbio:dubbio-pool:v1";
export const DUBBIO_SESSION_KEY = "nerdubbio:dubbio-session:v1";

export type DubbioSession = {
  mode: DoubtMode;
  answers: QuizAnswers;
};

export function saveDubbioSession(session: DubbioSession) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(DUBBIO_SESSION_KEY, JSON.stringify(session));
}

export function loadDubbioSession(): DubbioSession | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(DUBBIO_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DubbioSession;
  } catch {
    return null;
  }
}

export function clearDubbioSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(DUBBIO_SESSION_KEY);
}

export function buildDubbioProfile(state: LibraryState): UserProfile {
  const seenIds = Object.entries(state.media)
    .filter(([, m]) => m.status === "completed" || m.status === "dropped")
    .map(([k]) => k);

  const watchlistIds = Object.entries(state.media)
    .filter(([, m]) => m.favorite || m.status === "plan_to_watch" || m.status === "watching")
    .map(([k]) => k);

  const highlyRatedIds = Object.entries(state.media)
    .filter(([, m]) => (m.rating ?? 0) >= 8)
    .map(([k]) => k);

  return {
    seenIds,
    dismissedIds: state.dismissed,
    favoriteGenres: state.favoriteGenres,
    moodProfile: state.moodProfile ?? undefined,
    watchlistIds,
    highlyRatedIds,
  };
}

export function saveDubbioPool(items: CatalogItem[]) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(DUBBIO_POOL_KEY, JSON.stringify(serializePool(items)));
}

export function loadDubbioPool(): CatalogItem[] | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(DUBBIO_POOL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CatalogItem[];
  } catch {
    return null;
  }
}

export function clearDubbioPool() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(DUBBIO_POOL_KEY);
}

export async function fetchDubbioPool(
  mode: DoubtMode,
  profile: UserProfile,
  answers?: QuizAnswers,
  locale?: string,
): Promise<CatalogItem[]> {
  let moodGenres: string[] | undefined;
  if (answers) {
    const { moodBoosts } = aggregateAnswers(answers);
    const topMoods = Object.entries(moodBoosts)
      .sort((a, b) => b[1]! - a[1]!)
      .slice(0, 4)
      .map(([m]) => m);
    moodGenres = genresFromMoodTags(topMoods);
  }

  const { items } = await tmdbDubbioCandidates({
    data: {
      mode,
      favoriteGenres: profile.favoriteGenres,
      moodGenres,
      watchlistIds: profile.watchlistIds,
      highlyRatedIds: profile.highlyRatedIds,
      excludeIds: [...(profile.seenIds ?? []), ...(profile.dismissedIds ?? [])],
      locale,
    },
  });

  saveDubbioPool(items);
  return items;
}
