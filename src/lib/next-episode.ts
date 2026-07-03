import type { UserMediaEntry } from "@/lib/user-store";

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
