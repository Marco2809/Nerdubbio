import { CATALOG, type CatalogItem, type MediaType, type MoodTag } from "@/lib/mock-catalog";
import { QUESTION_BY_ID, type Axis } from "./questions";

export type DoubtMode = "movie" | "tv" | "surprise";

export interface QuizAnswers {
  [qid: string]: number;
}

export interface UserProfile {
  seenIds?: string[];
  dismissedIds?: string[];
  favoriteGenres?: string[];
  moodProfile?: string[];
  watchlistIds?: string[];
  excludedGenres?: string[];
}

export interface RecommendationResult {
  primary: ScoredItem | null;
  alternatives: ScoredItem[];
  axes: Record<Axis, number>;
  moodBoosts: Partial<Record<MoodTag, number>>;
  explanation: string;
  emptyPool?: boolean;
}

export interface ScoredItem {
  item: CatalogItem;
  score: number;
  reasons: string[];
}

export function catalogMediaId(item: CatalogItem): string {
  return `${item.type}-${item.tmdb_id}`;
}

export function aggregateAnswers(answers: QuizAnswers) {
  const axes: Record<Axis, number> = {
    tone: 0,
    pace: 0,
    complexity: 0,
    darkness: 0,
    length: 0,
    familiarity: 0,
    fantasy: 0,
    language: 0,
  };
  const moodBoosts: Partial<Record<MoodTag, number>> = {};
  for (const [qid, idx] of Object.entries(answers)) {
    const q = QUESTION_BY_ID[qid];
    if (!q) continue;
    const ch = q.choices[idx];
    if (!ch) continue;
    for (const [k, v] of Object.entries(ch.weights)) axes[k as Axis] += v ?? 0;
    for (const m of ch.moods ?? []) moodBoosts[m] = (moodBoosts[m] ?? 0) + 1;
  }
  return { axes, moodBoosts };
}

function filterCandidates(
  mode: DoubtMode,
  profile: UserProfile,
  pool: CatalogItem[],
): CatalogItem[] {
  const seen = new Set(profile.seenIds ?? []);
  const dismissed = new Set(profile.dismissedIds ?? []);

  let candidates = pool.filter(
    c =>
      !seen.has(c.id) &&
      !seen.has(catalogMediaId(c)) &&
      !dismissed.has(c.id) &&
      !dismissed.has(catalogMediaId(c)),
  );
  if (mode === "movie") candidates = candidates.filter(c => c.type === "movie");
  if (mode === "tv") candidates = candidates.filter(c => c.type === "tv");
  if (profile.excludedGenres?.length) {
    candidates = candidates.filter(c => !c.genres.some(g => profile.excludedGenres!.includes(g)));
  }
  return candidates;
}

function scoreItem(
  item: CatalogItem,
  axes: Record<Axis, number>,
  moodBoosts: Partial<Record<MoodTag, number>>,
  profile: UserProfile,
): ScoredItem {
  let score = 50;
  const reasons: string[] = [];

  let moodHit = 0;
  for (const m of item.moods) if (moodBoosts[m]) moodHit += moodBoosts[m]!;
  score += Math.min(moodHit * 5, 30);
  if (moodHit >= 3) reasons.push("mood allineato");

  if (profile.moodProfile?.length) {
    const genreHit = item.genres.some(g =>
      profile.moodProfile!.some(m => g.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(g.toLowerCase().slice(0, 4))),
    );
    if (genreHit) {
      score += 8;
      reasons.push("coerente col profilo onboarding");
    }
  }

  if (profile.favoriteGenres?.length) {
    const favHit = item.genres.filter(g => profile.favoriteGenres!.includes(g)).length;
    if (favHit > 0) {
      score += favHit * 4;
      reasons.push("genere che ami");
    }
  }

  const mediaId = catalogMediaId(item);
  if (profile.watchlistIds?.includes(mediaId) || profile.watchlistIds?.includes(item.id)) {
    score += 18;
    reasons.push("già in watchlist");
  }

  const dark = item.moods.includes("dark") ? 1 : 0;
  score -= Math.abs(axes.darkness / 2 - dark) * 4;

  const fast = item.moods.includes("fast-paced") ? 1 : item.moods.includes("slow-burn") ? -1 : 0;
  score -= Math.abs(axes.pace / 2 - fast) * 3;

  const mindbend = item.moods.includes("mind-bending") ? 1 : 0;
  score -= Math.abs(axes.complexity / 2 - mindbend) * 3;

  const isShort = item.moods.includes("short") || (item.type === "movie" && (item.runtimeMin ?? 120) < 130);
  const isBinge = item.moods.includes("binge") || (item.seasons ?? 0) >= 3;
  if (axes.length <= -1 && isShort) {
    score += 6;
    reasons.push("breve, come chiesto");
  }
  if (axes.length >= 1 && isBinge) {
    score += 6;
    reasons.push("binge-friendly");
  }

  const fantasyItem = item.moods.includes("fantasy") || item.moods.includes("sci-fi") ? 1 : -1;
  score -= Math.abs(axes.fantasy / 2 - fantasyItem) * 2;

  const pop = Math.min(1, item.popularity / 80) * 2 - 1;
  score -= Math.abs(axes.familiarity / 2 - pop) * 3;

  score += (item.rating - 7) * 2;

  const tone = item.moods.includes("funny") || item.moods.includes("cozy")
    ? 1
    : item.moods.includes("sad") || item.moods.includes("dark")
      ? -1
      : 0;
  score -= Math.abs(axes.tone / 2 - tone) * 2;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (item.moods.includes("iconic")) reasons.push("titolo cult");
  if (item.rating >= 8.5) reasons.push(`voto ${item.rating}`);
  return { item, score, reasons };
}

export function scoreCandidatesPartial(
  answers: QuizAnswers,
  mode: DoubtMode,
  profile: UserProfile = {},
  pool: CatalogItem[] = CATALOG,
): ScoredItem[] {
  const { axes, moodBoosts } = aggregateAnswers(answers);
  const candidates = filterCandidates(mode, profile, pool);
  return candidates
    .map(c => scoreItem(c, axes, moodBoosts, profile))
    .sort((a, b) => b.score - a.score);
}

export function recommendationEngine(
  answers: QuizAnswers,
  mode: DoubtMode,
  profile: UserProfile = {},
  pool: CatalogItem[] = CATALOG,
): RecommendationResult {
  const { axes, moodBoosts } = aggregateAnswers(answers);
  let candidates = filterCandidates(mode, profile, pool);
  let emptyPool = false;

  if (!candidates.length) {
    emptyPool = true;
    candidates = pool.filter(c => {
      if (mode === "movie") return c.type === "movie";
      if (mode === "tv") return c.type === "tv";
      return true;
    });
    if (!candidates.length) {
      candidates = CATALOG.filter(c => {
        if (mode === "movie") return c.type === "movie";
        if (mode === "tv") return c.type === "tv";
        return true;
      });
    }
  }

  const scored = candidates
    .map(c => scoreItem(c, axes, moodBoosts, profile))
    .sort((a, b) => b.score - a.score);

  const primary = scored[0] ?? null;
  const alternatives = scored.slice(1, 3);

  const explanation = primary
    ? buildExplanation(primary, axes, moodBoosts)
    : "Nerdacolo non trova candidati nel catalogo. Riprova con un altro mode.";

  return { primary, alternatives, axes, moodBoosts, explanation, emptyPool };
}

function buildExplanation(
  pick: ScoredItem,
  axes: Record<Axis, number>,
  moods: Partial<Record<MoodTag, number>>,
) {
  const bits: string[] = [];
  if (axes.darkness >= 2) bits.push("atmosfera cupa");
  if (axes.complexity >= 2) bits.push("trama cerebrale");
  if (axes.tone >= 2) bits.push("tono leggero");
  if (axes.tone <= -2) bits.push("colpo emotivo");
  if (axes.pace >= 2) bits.push("ritmo veloce");
  if (axes.pace <= -2) bits.push("ritmo lento");
  if (axes.length <= -1) bits.push("qualcosa di breve");
  if (axes.length >= 1) bits.push("materiale da binge");
  const top = Object.entries(moods)
    .sort((a, b) => b[1]! - a[1]!)
    .slice(0, 2)
    .map(([m]) => m);
  const because = bits.length ? bits.join(", ") : "il mood che hai descritto";
  const sim = pick.item.similar?.slice(0, 3).map(id => id.replace(/-/g, " ")).join(", ");
  return `Nerdacolo punta su ${pick.item.title} perché hai chiesto ${because}${top.length ? ` e vibes ${top.join(" + ")}` : ""}. Match ${pick.score}%${sim ? ` · simile a ${sim}` : ""}.`;
}
