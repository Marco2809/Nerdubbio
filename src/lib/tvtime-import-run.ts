import {
  parseCSV,
  parseTvTimeExport,
  readTvTimeZip,
  deriveEpisodeProgress,
  matchQueryFromRow,
  isLikelyMediaTitle,
  type ParsedRow,
  type TvTimeImportSummary,
} from "@/lib/tvtime-import";
import { tmdbMatchTitles, type TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { libraryApi, LIBRARY_QUERY_KEY, type LibraryState } from "@/lib/php/library-client";
import { applyResolvedTvStatuses } from "@/lib/resolve-show-statuses";
import type { UserMediaEntry } from "@/lib/user-store";
import type { QueryClient } from "@tanstack/react-query";

export type TvTimeImportMode = "replace" | "merge";

export type TvTimeMatchRow = {
  row: ParsedRow;
  match: TmdbItem | null;
};

const IMPORT_CHUNK = 35;

export async function parseTvTimeFile(file: File): Promise<TvTimeImportSummary> {
  if (file.name.toLowerCase().endsWith(".zip")) {
    const files = await readTvTimeZip(file);
    return parseTvTimeExport(files);
  }

  const text = await file.text();
  const raw = parseCSV(text);
  if (raw.length === 0) throw new Error("CSV vuoto o non valido.");

  const first = raw[0] ?? {};
  const looksGdpr = "tv_show_id" in first || "tv_show_name" in first || "episode_id" in first;
  if (looksGdpr) {
    const res = parseTvTimeExport({ [file.name]: text });
    if (res.rows.length > 0) return res;
  }

  throw new Error("Formato non riconosciuto. Usa lo zip GDPR di TV Time.");
}

export async function matchTvTimeRows(rows: ParsedRow[]): Promise<TvTimeMatchRow[]> {
  const valid = rows.filter(r => isLikelyMediaTitle(r.title));
  const out: TvTimeMatchRow[] = [];
  for (let i = 0; i < valid.length; i += 60) {
    const chunk = valid.slice(i, i + 60);
    const { results } = await tmdbMatchTitles({
      data: { items: chunk.map(r => matchQueryFromRow(r)) },
    });
    results.forEach((r, idx) => {
      out.push({ row: chunk[idx], match: r.match });
    });
  }
  return out;
}

export function buildEntriesFromMatches(matches: TvTimeMatchRow[]): UserMediaEntry[] {
  return matches
    .filter(m => m.match)
    .map(m => {
      const progress = m.match!.type === "tv" ? deriveEpisodeProgress(m.row) : {};
      return {
        id: `${m.match!.type}-${m.match!.tmdb_id}`,
        status: m.row.status ?? "plan_to_watch",
        rating: m.row.rating,
        episodeDates: m.row.episodeDates,
        episodeWatchCounts: m.row.episodeWatchCounts,
        addedAt: new Date().toISOString(),
        source: "tvtime" as const,
        title: m.match!.title,
        posterUrl: m.match!.posterUrl,
        backdropUrl: m.match!.backdropUrl ?? null,
        type: m.match!.type,
        year: m.match!.year,
        ...progress,
      };
    });
}

export async function executeTvTimeImport(opts: {
  entries: UserMediaEntry[];
  mode: TvTimeImportMode;
  queryClient: QueryClient;
  initialState: LibraryState;
  onProgress?: (stage: string, pct: number) => void;
}): Promise<{ next: LibraryState; matched: number; unmatched: number }> {
  const { entries, mode, queryClient, initialState, onProgress } = opts;
  const mergeImport = mode === "merge";
  const replaceEpisodes = mode === "replace";

  onProgress?.("Verifica serie concluse…", 5);
  await applyResolvedTvStatuses(entries, (done, total) => {
    onProgress?.(
      `Serie concluse (${done}/${total})…`,
      5 + Math.round((done / Math.max(total, 1)) * 25),
    );
  });

  let next = initialState;
  const totalChunks = Math.ceil(entries.length / IMPORT_CHUNK);
  for (let i = 0; i < entries.length; i += IMPORT_CHUNK) {
    const chunk = entries.slice(i, i + IMPORT_CHUNK);
    const chunkNum = Math.floor(i / IMPORT_CHUNK) + 1;
    onProgress?.(
      mergeImport ? `Aggiornamento (${chunkNum}/${totalChunks})…` : `Import (${chunkNum}/${totalChunks})…`,
      Math.round((chunkNum / totalChunks) * 100),
    );
    next = await libraryApi.bulkImport(chunk, undefined, {
      withXp: false,
      replaceEpisodes,
      mergeImport,
    });
    queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
  }

  return { next, matched: entries.length, unmatched: 0 };
}
