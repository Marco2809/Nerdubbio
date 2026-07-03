import type { UserMediaEntry, UserStatus } from "@/lib/user-store";
import { maxWatchedFrontier } from "@/lib/next-episode";
import { tmdbResolveShowStatuses } from "@/lib/tmdb/tmdb.functions";

const PRESERVE_STATUSES = new Set<UserStatus>(["favorite", "paused", "dropped"]);

export function isTvEntry(entry: Pick<UserMediaEntry, "id" | "type">): boolean {
  return entry.type === "tv" || entry.id.startsWith("tv-");
}

export function tmdbIdFromEntry(id: string): number | null {
  const m = /^tv-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Applica stati inferiti (TMDB) a entries TV — muta in place. */
export async function applyResolvedTvStatuses(
  entries: UserMediaEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ completed: number; watching: number }> {
  const tv = entries.filter(isTvEntry);
  let completed = 0;
  let watching = 0;
  const CHUNK = 6;

  for (let i = 0; i < tv.length; i += CHUNK) {
    const batch = tv.slice(i, i + CHUNK);
    const { results } = await tmdbResolveShowStatuses({
      data: {
        items: batch.map(e => {
          const tmdbId = tmdbIdFromEntry(e.id)!;
          const frontier = maxWatchedFrontier(e);
          return {
            tmdbId,
            watched: e.watchedEpisodes ?? [],
            lastSeason: frontier?.season,
            lastEpisode: frontier?.episode,
            currentStatus: e.status,
          };
        }),
      },
    });

    for (const r of results) {
      const entry = entries.find(e => e.id === `tv-${r.tmdbId}`);
      if (!entry || !r.status) continue;
      if (PRESERVE_STATUSES.has(entry.status)) continue;
      entry.status = r.status as UserStatus;
      if (r.status === "completed") completed++;
      else if (r.status === "watching") watching++;
    }
    onProgress?.(Math.min(i + CHUNK, tv.length), tv.length);
  }

  return { completed, watching };
}

/** Corregge stati TV nella libreria corrente (solo patch status). */
export async function buildStatusPatches(
  media: Record<string, UserMediaEntry>,
): Promise<UserMediaEntry[]> {
  const drafts = Object.values(media)
    .filter(m => isTvEntry(m) && !PRESERVE_STATUSES.has(m.status))
    .map(m => ({ ...m }));

  await applyResolvedTvStatuses(drafts);

  return drafts
    .filter(d => {
      const prev = media[d.id];
      return prev && prev.status !== d.status;
    })
    .map(d => ({
      id: d.id,
      status: d.status,
      source: "status_sync" as const,
      addedAt: d.addedAt,
    }));
}
