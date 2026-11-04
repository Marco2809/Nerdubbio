import type { CatalogItem } from "@/lib/mock-catalog";
import type { TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { genreNamesFromIds } from "./genre-map";
import { inferMoods } from "./tmdb-moods";

const fallbackPoster = "linear-gradient(135deg, #1a1033, #4c1d95)";

export function tmdbToCatalogItem(t: TmdbItem, opts?: { becauseOf?: string }): CatalogItem {
  const genreKeys = t.genreIds?.length ? genreNamesFromIds(t.genreIds, t.type) : t.genres;
  const moods = inferMoods(genreKeys, nerdacoloText(t), t.type, t.runtimeMin, t.seasons);

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
    genreIds: t.genreIds,
    genreKeys,
    keywords: t.keywords,
    overviewEn: t.overviewEn,
    voteCount: t.voteCount,
    episodes: t.episodes,
    becauseOf: opts?.becauseOf,
  };
}

/** Testo per dedurre i tratti: sempre inglese + keyword, così vale in ogni lingua. */
function nerdacoloText(t: TmdbItem): string {
  return `${t.overviewEn || t.overview} ${(t.keywords ?? []).join(" ")}`;
}

/** Serializza per sessionStorage (pool quiz). */
export function serializePool(items: CatalogItem[]): CatalogItem[] {
  return items.map(({ id, tmdb_id, type, title, year, rating, popularity, runtimeMin, seasons, genres, moods, overview, poster, posterUrl, backdropUrl, genreIds, genreKeys, keywords, overviewEn, voteCount, episodes, becauseOf }) => ({
    genreIds, genreKeys, keywords, overviewEn, voteCount, episodes, becauseOf,
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
