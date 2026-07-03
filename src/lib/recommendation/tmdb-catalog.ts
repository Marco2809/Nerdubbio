import type { CatalogItem } from "@/lib/mock-catalog";
import type { TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { inferMoods } from "./tmdb-moods";

const fallbackPoster = "linear-gradient(135deg, #1a1033, #4c1d95)";

export function tmdbToCatalogItem(t: TmdbItem, opts?: { fromWatchlist?: boolean }): CatalogItem {
  const moods = inferMoods(t.genres, t.overview, t.type, t.runtimeMin, t.seasons);
  if (opts?.fromWatchlist) moods.push("hidden-gem");

  const popNorm = Math.min(100, Math.round(Math.log10(Math.max(t.popularity, 1) + 1) * 25));
  if (t.rating >= 8 && t.popularity > 100) moods.push("iconic");

  return {
    id: `${t.type}-${t.tmdb_id}`,
    tmdb_id: t.tmdb_id,
    type: t.type,
    title: t.title,
    year: t.year,
    rating: t.rating,
    popularity: popNorm,
    runtimeMin: t.runtimeMin,
    seasons: t.seasons,
    genres: t.genres.length ? t.genres : ["Drama"],
    moods: [...new Set(moods)],
    overview: t.overview,
    poster: t.posterUrl ? `url("${t.posterUrl}") center/cover` : fallbackPoster,
    posterUrl: t.posterUrl,
    backdropUrl: t.backdropUrl,
  };
}

/** Serializza per sessionStorage (pool quiz). */
export function serializePool(items: CatalogItem[]): CatalogItem[] {
  return items.map(({ id, tmdb_id, type, title, year, rating, popularity, runtimeMin, seasons, genres, moods, overview, poster, posterUrl, backdropUrl }) => ({
    id,
    tmdb_id,
    type,
    title,
    year,
    rating,
    popularity,
    runtimeMin,
    seasons,
    genres,
    moods,
    overview: overview.slice(0, 280),
    poster,
    posterUrl,
    backdropUrl,
  }));
}
