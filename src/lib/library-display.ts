import { findById } from "@/lib/mock-catalog";
import type { UserMediaEntry, UserStatus } from "@/lib/user-store";

export type LibraryDisplayItem = {
  entry: UserMediaEntry;
  id: string;
  type: "movie" | "tv";
  title: string;
  year?: number;
  posterUrl?: string | null;
};

export function inferMediaType(entry: UserMediaEntry): "movie" | "tv" {
  return entry.type ?? (entry.id.startsWith("movie-") ? "movie" : "tv");
}

export function entryToDisplayItem(entry: UserMediaEntry): LibraryDisplayItem | null {
  if (entry.status === "dropped") return null;
  if (entry.title) {
    return {
      entry,
      id: entry.id,
      type: inferMediaType(entry),
      title: entry.title,
      year: entry.year,
      posterUrl: entry.posterUrl ?? null,
    };
  }
  const mock = findById(entry.id);
  if (!mock) return null;
  return {
    entry,
    id: entry.id,
    type: mock.type,
    title: mock.title,
    year: mock.year,
    posterUrl: null,
  };
}

export function mediaRouteParams(item: Pick<LibraryDisplayItem, "id" | "type">) {
  const m = /^(movie|tv)-(\d+)$/.exec(item.id);
  if (m) return { type: m[1] as "movie" | "tv", id: m[2] };
  return { type: item.type, id: item.id };
}

const SERIES_TAB_STATUSES: Record<string, UserStatus[]> = {
  in_corso: ["watching", "paused"],
  da_vedere: ["plan_to_watch", "favorite"],
  viste: ["completed"],
};

const MOVIE_TAB_STATUSES: Record<string, UserStatus[]> = {
  da_vedere: ["plan_to_watch", "watching", "favorite", "paused"],
  visti: ["completed"],
};

export function filterBySeriesTab(
  media: Record<string, UserMediaEntry>,
  tab: keyof typeof SERIES_TAB_STATUSES,
): LibraryDisplayItem[] {
  const allowed = new Set(SERIES_TAB_STATUSES[tab] ?? []);
  return Object.values(media)
    .filter(m => inferMediaType(m) === "tv" && allowed.has(m.status))
    .map(entryToDisplayItem)
    .filter((x): x is LibraryDisplayItem => !!x)
    .sort((a, b) => sortLibraryItems(a, b, tab === "da_vedere" ? "added" : "recent"));
}

export function filterByMovieTab(
  media: Record<string, UserMediaEntry>,
  tab: keyof typeof MOVIE_TAB_STATUSES,
): LibraryDisplayItem[] {
  const allowed = new Set(MOVIE_TAB_STATUSES[tab] ?? []);
  return Object.values(media)
    .filter(m => inferMediaType(m) === "movie" && allowed.has(m.status))
    .map(entryToDisplayItem)
    .filter((x): x is LibraryDisplayItem => !!x)
    .sort((a, b) => sortLibraryItems(a, b, tab === "da_vedere" ? "added" : "recent"));
}

export function countSeriesTab(media: Record<string, UserMediaEntry>, tab: keyof typeof SERIES_TAB_STATUSES): number {
  const allowed = new Set(SERIES_TAB_STATUSES[tab] ?? []);
  return Object.values(media).filter(m => inferMediaType(m) === "tv" && allowed.has(m.status)).length;
}

export function countMovieTab(media: Record<string, UserMediaEntry>, tab: keyof typeof MOVIE_TAB_STATUSES): number {
  const allowed = new Set(MOVIE_TAB_STATUSES[tab] ?? []);
  return Object.values(media).filter(m => inferMediaType(m) === "movie" && allowed.has(m.status)).length;
}

function sortLibraryItems(a: LibraryDisplayItem, b: LibraryDisplayItem, mode: "recent" | "added"): number {
  if (mode === "added") {
    return (b.entry.addedAt ?? "").localeCompare(a.entry.addedAt ?? "");
  }
  const aT = a.entry.lastWatchedAt ?? a.entry.addedAt ?? "";
  const bT = b.entry.lastWatchedAt ?? b.entry.addedAt ?? "";
  return bT.localeCompare(aT);
}

export function countAllSeries(media: Record<string, UserMediaEntry>): number {
  return Object.values(media).filter(m => inferMediaType(m) === "tv" && m.status !== "dropped").length;
}

export function countAllMovies(media: Record<string, UserMediaEntry>): number {
  return Object.values(media).filter(m => inferMediaType(m) === "movie" && m.status !== "dropped").length;
}
