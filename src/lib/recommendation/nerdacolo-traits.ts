import type { CatalogItem } from "@/lib/mock-catalog";
import type {
  CommitmentLevel,
  ComplexityLevel,
  EmotionalLevel,
  MainstreamLevel,
  NerdacoloCandidate,
  NerdacoloTraits,
  NerdacoloUserContext,
  PaceLevel,
  TraitLevel,
} from "./nerdacolo-types";

/** Converte livelli enumerati in numeri per scoring/varianza. */
export function traitToNumber(
  key: keyof NerdacoloTraits,
  value: string | string[],
): number {
  if (key === "mood") {
    const moods = Array.isArray(value) ? value : [value];
    if (moods.some(m => ["dark", "sad", "thriller"].includes(m))) return -1;
    if (moods.some(m => ["funny", "cozy", "romantic"].includes(m))) return 1;
    return 0;
  }
  const map3: Record<string, number> = {
    none: -1,
    low: -0.5,
    medium: 0,
    high: 1,
    slow: -1,
    fast: 1,
    easy: -1,
    complex: 1,
    light: 1,
    heavy: -1,
    hidden_gem: -1,
    balanced: 0,
    mainstream: 1,
    short: -1,
    long: 1,
  };
  if (typeof value === "string") return map3[value] ?? 0;
  return 0;
}

function levelFromScore(score: number, labels: [string, string, string, string]): string {
  if (score <= -0.5) return labels[0];
  if (score <= 0.2) return labels[1];
  if (score <= 0.6) return labels[2];
  return labels[3];
}

/** Euristiche trait — sostituibili in futuro con AI/keywords TMDB. */
export function inferTraitsFromCatalog(item: CatalogItem): NerdacoloTraits {
  const g = item.genres.map(x => x.toLowerCase());
  const text = item.overview.toLowerCase();
  const moods = item.moods;

  const has = (...keys: string[]) => g.some(x => keys.some(k => x.includes(k)));
  const moodHit = (...keys: string[]) => moods.some(m => keys.includes(m));

  let violence = 0;
  if (has("horror", "crime", "war")) violence += 0.8;
  if (has("action")) violence += 0.4;
  if (moodHit("dark", "action", "thriller")) violence += 0.3;
  if (/blood|kill|murder|war|brutal|violent/.test(text)) violence += 0.4;

  let horror = has("horror") ? 1 : 0;
  if (/ghost|demon|possess|nightmare/.test(text)) horror += 0.5;

  let comedy = has("comedy", "commedia") ? 0.8 : 0;
  if (moodHit("funny", "cozy")) comedy += 0.5;
  if (/funny|laugh|hilar/.test(text)) comedy += 0.3;

  let romance = has("romance", "romantic") ? 0.8 : 0;
  if (moodHit("romantic")) romance += 0.5;

  let mystery = has("mystery", "mistero", "thriller") ? 0.6 : 0;
  if (moodHit("mind-bending", "thriller")) mystery += 0.5;
  if (/mystery|twist|conspir|secret|detective/.test(text)) mystery += 0.3;

  let pace: PaceLevel = "medium";
  if (moodHit("fast-paced", "action")) pace = "fast";
  else if (moodHit("slow-burn", "cozy")) pace = "slow";

  let complexity: ComplexityLevel = "medium";
  if (moodHit("mind-bending")) complexity = "complex";
  else if (moodHit("cozy", "funny") && !moodHit("mind-bending")) complexity = "easy";

  let emotional: EmotionalLevel = "medium";
  if (moodHit("sad", "dark", "romantic")) emotional = "heavy";
  else if (moodHit("funny", "cozy")) emotional = "light";

  const runtime = item.runtimeMin ?? (item.type === "movie" ? 110 : 45);
  const seasons = item.seasons ?? (item.type === "tv" ? 2 : 0);

  let bingeability: "low" | "medium" | "high" = "medium";
  if (item.type === "tv") {
    if (moodHit("binge") || seasons >= 3) bingeability = "high";
    else if (seasons <= 1 || runtime > 55) bingeability = "low";
  } else {
    bingeability = "low";
  }

  let commitment: CommitmentLevel = "medium";
  if (item.type === "movie") {
    if (runtime <= 100) commitment = "short";
    else if (runtime >= 150) commitment = "long";
  } else {
    if (seasons <= 1 || (seasons === 2 && runtime <= 45)) commitment = "short";
    else if (seasons >= 5) commitment = "long";
  }

  let mainstream: MainstreamLevel = "balanced";
  if (item.popularity >= 85 || moodHit("iconic")) mainstream = "mainstream";
  else if (item.popularity <= 45 || moodHit("hidden-gem")) mainstream = "hidden_gem";

  let comfort: "low" | "medium" | "high" = "medium";
  if (moodHit("cozy", "funny", "iconic")) comfort = "high";
  else if (moodHit("mind-bending", "dark") && complexity === "complex") comfort = "low";

  let spectacle: TraitLevel = "medium";
  if (has("action", "sci-fi", "fantasy", "avventura") || moodHit("epic", "sci-fi", "fantasy")) {
    spectacle = "high";
  } else if (has("comedy", "romance", "drama") && !has("action")) {
    spectacle = "low";
  }

  const subtitleEffort: "low" | "medium" | "high" =
    item.type === "movie" && item.rating >= 8 ? "low" : "medium";

  const moodTags = [...new Set([
    ...moods,
    ...(comedy > 0.5 ? ["funny"] : []),
    ...(mystery > 0.5 ? ["mystery"] : []),
    ...(emotional === "heavy" ? ["sad"] : []),
    ...(pace === "fast" ? ["action"] : []),
    ...(has("sci-fi") ? ["sci-fi"] : []),
    ...(has("fantasy") ? ["fantasy"] : []),
  ])];

  return {
    mood: moodTags,
    pace,
    complexity,
    emotionalImpact: emotional,
    violenceLevel: levelFromScore(violence, ["none", "low", "medium", "high"]) as TraitLevel,
    comedyLevel: levelFromScore(comedy, ["none", "low", "medium", "high"]) as TraitLevel,
    romanceLevel: levelFromScore(romance, ["none", "low", "medium", "high"]) as TraitLevel,
    mysteryLevel: levelFromScore(mystery, ["none", "low", "medium", "high"]) as TraitLevel,
    horrorLevel: levelFromScore(horror, ["none", "low", "medium", "high"]) as TraitLevel,
    bingeability,
    comfortLevel: comfort,
    mainstreamLevel: mainstream,
    visualSpectacle: spectacle,
    subtitleEffort,
    commitment,
  };
}

export function catalogToCandidate(
  item: CatalogItem,
  profile: NerdacoloUserContext,
  highlyRatedGenres: Set<string>,
): NerdacoloCandidate {
  const traits = inferTraitsFromCatalog(item);
  const mediaKey = `${item.type}-${item.tmdb_id}`;
  const reasons: string[] = [];
  const penalties: string[] = [];
  let score = 50;

  const genreOverlap = item.genres.filter(g => profile.favoriteGenres.includes(g)).length;
  if (genreOverlap > 0) {
    score += genreOverlap * 6;
    reasons.push("generi che ami");
  }

  if (profile.watchlistIds.includes(mediaKey) || profile.watchlistIds.includes(item.id)) {
    score += 14;
    reasons.push("in watchlist");
  }

  const similarGenres = item.genres.filter(g => highlyRatedGenres.has(g)).length;
  if (similarGenres > 0) {
    score += similarGenres * 5;
    reasons.push("simile a titoli che hai amato");
  }

  if (item.rating >= 8) {
    score += (item.rating - 7) * 3;
    reasons.push(`TMDB ${item.rating.toFixed(1)}`);
  } else if (item.rating < 6.5) {
    score -= 12;
    penalties.push("voto TMDB basso");
  }

  if (item.popularity >= 70 && item.rating >= 7.5) {
    score += 4;
  } else if (item.popularity < 30) {
    score -= 3;
  }

  if (profile.moodProfile.length) {
    const moodMatch = traits.mood.some(m =>
      profile.moodProfile.some(p => m.includes(p) || p.includes(m.slice(0, 4))),
    );
    if (moodMatch) {
      score += 8;
      reasons.push("coerente col profilo");
    }
  }

  if (!item.overview || item.overview.length < 20) {
    score -= 8;
    penalties.push("poche info");
  }

  return {
    tmdbId: item.tmdb_id,
    mediaType: item.type,
    title: item.title,
    overview: item.overview,
    genres: item.genres,
    keywords: [],
    runtimeMinutes: item.type === "movie" ? item.runtimeMin : undefined,
    episodeRuntime: item.type === "tv" ? item.runtimeMin : undefined,
    numberOfSeasons: item.seasons,
    releaseYear: item.year,
    popularity: item.popularity,
    tmdbRating: item.rating,
    originalLanguage: "en",
    posterPath: item.posterUrl,
    backdropPath: item.backdropUrl,
    traits,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    penalties,
    mediaKey,
  };
}

export function buildHighlyRatedGenreSet(
  catalog: CatalogItem[],
  highlyRatedIds: string[],
): Set<string> {
  const genres = new Set<string>();
  for (const id of highlyRatedIds) {
    const item = catalog.find(c => c.id === id || `${c.type}-${c.tmdb_id}` === id);
    item?.genres.forEach(g => genres.add(g));
  }
  return genres;
}

export function commitmentLabel(c: NerdacoloCandidate): string {
  if (c.mediaType === "movie") {
    const m = c.runtimeMinutes ?? 110;
    if (m <= 95) return `~${m} min`;
    if (m <= 130) return `~${m} min (serata intera)`;
    return `~${m} min (epico)`;
  }
  const eps = c.episodeRuntime ?? 45;
  const s = c.numberOfSeasons ?? 1;
  if (s <= 1) return `Miniserie · ~${eps} min/ep`;
  if (s <= 3) return `${s} stagioni · ~${eps} min/ep`;
  return `${s}+ stagioni · impegno lungo`;
}

export function moodLabelFromTraits(traits: NerdacoloTraits): string {
  if (traits.comedyLevel === "high") return "Leggero e divertente";
  if (traits.horrorLevel === "high" || traits.violenceLevel === "high") return "Dark e intenso";
  if (traits.mysteryLevel === "high") return "Mistero e suspense";
  if (traits.emotionalImpact === "heavy") return "Emotivo e profondo";
  if (traits.pace === "fast") return "Ritmo serrato";
  if (traits.pace === "slow") return "Lento e contemplativo";
  return "Equilibrato";
}

export const LEVEL_ORDER: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  slow: 0,
  fast: 3,
  easy: 0,
  complex: 3,
  light: 0,
  heavy: 3,
  hidden_gem: 0,
  balanced: 1,
  mainstream: 2,
  short: 0,
  long: 3,
};

export function levelAtMost(actual: string, max: string): boolean {
  return (LEVEL_ORDER[actual] ?? 1) <= (LEVEL_ORDER[max] ?? 3);
}

export function levelAtLeast(actual: string, min: string): boolean {
  return (LEVEL_ORDER[actual] ?? 1) >= (LEVEL_ORDER[min] ?? 0);
}
