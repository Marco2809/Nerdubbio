/** Mapping generi app → ID TMDB (movie / tv). */
const MOVIE: Record<string, number> = {
  "Sci-Fi": 878,
  Drama: 18,
  Comedy: 35,
  Fantasy: 14,
  Thriller: 53,
  Action: 28,
  Animation: 16,
  Romance: 10749,
  Mystery: 9648,
  Crime: 80,
  Horror: 27,
  Musical: 10402,
};

const TV: Record<string, number> = {
  "Sci-Fi": 10765,
  Drama: 18,
  Comedy: 35,
  Fantasy: 10765,
  Thriller: 80,
  Action: 10759,
  Animation: 16,
  Romance: 10749,
  Mystery: 9648,
  Crime: 80,
  Horror: 9648,
  Musical: 10402,
};

export const TMDB_MOVIE_GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export const TMDB_TV_GENRE_NAMES: Record<number, string> = {
  10759: "Action",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi",
  10766: "Soap",
  10767: "Talk",
  10768: "War",
  37: "Western",
};

export function tmdbGenreIds(names: string[], type: "movie" | "tv"): number[] {
  const map = type === "movie" ? MOVIE : TV;
  const ids = new Set<number>();
  for (const n of names) {
    const id = map[n];
    if (id) ids.add(id);
  }
  return [...ids];
}

export function genreNamesFromIds(ids: number[], type: "movie" | "tv"): string[] {
  const map = type === "movie" ? TMDB_MOVIE_GENRE_NAMES : TMDB_TV_GENRE_NAMES;
  return [...new Set(ids.map(id => map[id]).filter(Boolean))];
}

/** Mood quiz → generi TMDB per discover. */
export function genresFromMoodTags(moods: string[]): string[] {
  const out = new Set<string>();
  for (const m of moods) {
    if (m === "funny" || m === "cozy") out.add("Comedy");
    if (m === "sad" || m === "romantic") out.add("Drama");
    if (m === "thriller") out.add("Thriller");
    if (m === "mind-bending" || m === "sci-fi") out.add("Sci-Fi");
    if (m === "fantasy" || m === "epic") out.add("Fantasy");
    if (m === "dark") out.add("Horror");
    if (m === "action" || m === "fast-paced") out.add("Action");
    if (m === "slow-burn") out.add("Drama");
  }
  return [...out];
}
