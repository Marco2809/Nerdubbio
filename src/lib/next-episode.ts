import type { UserMediaEntry } from "@/lib/user-store";
import type { NextUnwatchedInfo } from "@/lib/tmdb/tmdb.functions";

/** Quante serie interroghiamo per la home (evita limiti batch TMDB). */
export const HOME_NEXT_EPISODES_LIMIT = 6;
/** Quante righe mostriamo davvero: le 3 più recenti per ultima visione.
    Ne interroghiamo di più perché le serie "in pari" spariscono (next = null). */
export const HOME_NEXT_EPISODES_DISPLAY = 3;

/** Ultimo episodio segnato visto (max S/E da lista o da currentSeason/Episode). */
export function maxWatchedFrontier(
  entry: Pick<UserMediaEntry, "watchedEpisodes" | "currentSeason" | "currentEpisode">,
): { season: number; episode: number } | null {
  let maxS = entry.currentSeason ?? 0;
  let maxE = entry.currentEpisode ?? 0;
  for (const key of entry.watchedEpisodes ?? []) {
    const m = /^S(\d+)E(\d+)$/.exec(key);
    if (!m) continue;
    const s = Number(m[1]);
    const e = Number(m[2]);
    if (s > maxS || (s === maxS && e > maxE)) {
      maxS = s;
      maxE = e;
    }
  }
  return maxS > 0 && maxE > 0 ? { season: maxS, episode: maxE } : null;
}

export function isEpisodeAfter(season: number, episode: number, lastS: number, lastE: number): boolean {
  return season > lastS || (season === lastS && episode > lastE);
}

/** Serie in corso più rilevante per la card home (ultima attività o progresso). */
export function pickFeaturedWatchingShow(
  media: Record<string, UserMediaEntry>,
): { card: UserMediaEntry; entry: UserMediaEntry } | null {
  const candidates = Object.values(media).filter(
    m => m.status === "watching" && (m.type === "tv" || m.id.startsWith("tv-")),
  );
  if (candidates.length === 0) return null;

  const scored = candidates
    .map(entry => {
      const frontier = maxWatchedFrontier(entry);
      const activity = entry.lastWatchedAt ? Date.parse(entry.lastWatchedAt) : 0;
      const progress = frontier ? frontier.season * 10_000 + frontier.episode : 0;
      return { entry, score: activity * 1_000_000 + progress };
    })
    .sort((a, b) => b.score - a.score);

  const entry = scored[0]!.entry;
  return { card: entry, entry };
}

/** Serie con progresso da mostrare in home, ordinate per ultima visione. */
export function listTvShowsForNextEpisode(media: Record<string, UserMediaEntry>): UserMediaEntry[] {
  return Object.values(media)
    .filter(m => {
      const isTv = m.type === "tv" || m.id.startsWith("tv-");
      if (!isTv || !/^tv-\d+$/.test(m.id)) return false;
      const hasProgress = (m.watchedEpisodes?.length ?? 0) > 0
        || (m.currentSeason ?? 0) > 0
        || (m.currentEpisode ?? 0) > 0;
      if (m.status === "watching" || m.status === "paused" || m.status === "plan_to_watch") return true;
      // Preferiti o in corso implicito se hai episodi segnati
      if ((m.status === "favorite" || m.status === "completed") && hasProgress) return true;
      return false;
    })
    .sort((a, b) => {
      const score = (e: UserMediaEntry) => {
        const t = e.lastWatchedAt ? Date.parse(e.lastWatchedAt) : 0;
        const f = maxWatchedFrontier(e);
        const p = f ? f.season * 10_000 + f.episode : 0;
        return t * 1_000_000 + p;
      };
      return score(b) - score(a);
    });
}

export function tmdbIdFromMediaKey(id: string): number | null {
  const m = /^tv-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Chiave React Query per il batch prossimi episodi — invalidata dopo toggle. */
export const NEXT_UNWATCHED_BATCH_KEY = ["tmdb", "next-unwatched-batch"] as const;

export function nextEpisodeQueryKey(entry: UserMediaEntry) {
  const f = maxWatchedFrontier(entry);
  const watched = entry.watchedEpisodes ?? [];
  return [
    ...NEXT_UNWATCHED_BATCH_KEY,
    entry.id,
    f?.season ?? 0,
    f?.episode ?? 0,
    watched.length,
    watched.slice(-5).join(","),
  ] as const;
}

export function buildNextUnwatchedPayload(entry: UserMediaEntry) {
  const tmdbId = tmdbIdFromMediaKey(entry.id);
  if (!tmdbId) return null;
  const frontier = maxWatchedFrontier(entry);
  return {
    tmdbId,
    watched: entry.watchedEpisodes ?? [],
    lastSeason: frontier?.season,
    lastEpisode: frontier?.episode,
  };
}

/** Fallback client se TMDB non risponde — episodio immediatamente dopo il frontier. */
export function localNextAfterFrontier(entry: UserMediaEntry): NextUnwatchedInfo | null {
  const frontier = maxWatchedFrontier(entry);
  if (!frontier) {
    return {
      kind: "episode",
      season: 1,
      episode: 1,
      name: "Primo episodio",
      airDate: null,
      overview: "",
      stillUrl: null,
      aired: true,
    };
  }
  return {
    kind: "episode",
    season: frontier.season,
    episode: frontier.episode + 1,
    name: "Prossimo episodio",
    airDate: null,
    overview: "",
    stillUrl: null,
    aired: true,
  };
}
