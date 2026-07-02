import { CATALOG, type CatalogItem, type MediaType, type MoodTag } from "@/lib/mock-catalog";
import { QUIZ, type Axis } from "./questions";

export type DoubtMode = "movie" | "tv" | "surprise";

export interface QuizAnswers {
  // key = question id, value = choice index
  [qid: string]: number;
}

export interface UserProfile {
  seenIds?: string[];
  dismissedIds?: string[];
  favoriteGenres?: string[];
  excludedGenres?: string[];
}

export interface RecommendationResult {
  primary: ScoredItem;
  alternatives: ScoredItem[];
  axes: Record<Axis, number>;
  moodBoosts: Partial<Record<MoodTag, number>>;
  explanation: string;
}

export interface ScoredItem {
  item: CatalogItem;
  score: number;         // 0-100 "compatibilità nerd"
  reasons: string[];
}

function aggregate(answers: QuizAnswers) {
  const axes: Record<Axis, number> = {
    tone:0, pace:0, complexity:0, darkness:0, length:0, familiarity:0, fantasy:0, language:0,
  };
  const moodBoosts: Partial<Record<MoodTag, number>> = {};
  for (const q of QUIZ) {
    const idx = answers[q.id];
    if (idx == null) continue;
    const ch = q.choices[idx];
    if (!ch) continue;
    for (const [k, v] of Object.entries(ch.weights)) axes[k as Axis] += v ?? 0;
    for (const m of ch.moods ?? []) moodBoosts[m] = (moodBoosts[m] ?? 0) + 1;
  }
  return { axes, moodBoosts };
}

function scoreItem(item: CatalogItem, axes: Record<Axis,number>, moodBoosts: Partial<Record<MoodTag,number>>): ScoredItem {
  let score = 50;
  const reasons: string[] = [];

  // mood match
  let moodHit = 0;
  for (const m of item.moods) if (moodBoosts[m]) moodHit += moodBoosts[m]!;
  score += Math.min(moodHit * 5, 30);
  if (moodHit >= 3) reasons.push("mood perfettamente allineato");

  // darkness
  const dark = item.moods.includes("dark") ? 1 : 0;
  score -= Math.abs(axes.darkness/2 - dark) * 4;

  // pace
  const fast = item.moods.includes("fast-paced") ? 1 : item.moods.includes("slow-burn") ? -1 : 0;
  score -= Math.abs(axes.pace/2 - fast) * 3;

  // complexity
  const mindbend = item.moods.includes("mind-bending") ? 1 : 0;
  score -= Math.abs(axes.complexity/2 - mindbend) * 3;

  // length preference (length +2 = binge, -2 = short)
  const isShort = item.moods.includes("short") || (item.type === "movie" && (item.runtimeMin ?? 120) < 130);
  const isBinge = item.moods.includes("binge") || (item.seasons ?? 0) >= 3;
  if (axes.length <= -1 && isShort) { score += 6; reasons.push("breve, come chiesto"); }
  if (axes.length >= 1 && isBinge) { score += 6; reasons.push("binge-friendly"); }

  // fantasy
  const fantasyItem = item.moods.includes("fantasy") || item.moods.includes("sci-fi") ? 1 : -1;
  score -= Math.abs(axes.fantasy/2 - fantasyItem) * 2;

  // familiarity (popularity)
  const pop = item.popularity/100 * 2 - 1;  // -1..+1
  score -= Math.abs(axes.familiarity/2 - pop) * 3;

  // rating & popularity nudge
  score += (item.rating - 7) * 2;

  // tone (funny +, sad/dark -)
  const tone = item.moods.includes("funny") || item.moods.includes("cozy") ? 1 :
               item.moods.includes("sad") || item.moods.includes("dark") ? -1 : 0;
  score -= Math.abs(axes.tone/2 - tone) * 2;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (item.moods.includes("iconic")) reasons.push("un titolo cult");
  if (item.rating >= 8.5) reasons.push(`voto TMDB ${item.rating}`);
  return { item, score, reasons };
}

export function recommendationEngine(
  answers: QuizAnswers,
  mode: DoubtMode,
  profile: UserProfile = {},
): RecommendationResult {
  const { axes, moodBoosts } = aggregate(answers);
  const seen = new Set(profile.seenIds ?? []);
  const dismissed = new Set(profile.dismissedIds ?? []);

  let candidates: CatalogItem[] = CATALOG.filter(c => !seen.has(c.id) && !dismissed.has(c.id));
  if (mode === "movie") candidates = candidates.filter(c => c.type === "movie");
  if (mode === "tv") candidates = candidates.filter(c => c.type === "tv");
  if (profile.excludedGenres?.length) {
    candidates = candidates.filter(c => !c.genres.some(g => profile.excludedGenres!.includes(g)));
  }

  const scored = candidates
    .map(c => scoreItem(c, axes, moodBoosts))
    .sort((a,b) => b.score - a.score);

  const primary = scored[0];
  const alternatives = scored.slice(1, 3);

  const explanation = buildExplanation(primary, axes, moodBoosts);
  return { primary, alternatives, axes, moodBoosts, explanation };
}

function buildExplanation(pick: ScoredItem, axes: Record<Axis,number>, moods: Partial<Record<MoodTag,number>>) {
  const bits: string[] = [];
  if (axes.darkness >= 2) bits.push("atmosfera cupa");
  if (axes.complexity >= 2) bits.push("trama cerebrale");
  if (axes.tone >= 2) bits.push("tono leggero");
  if (axes.tone <= -2) bits.push("colpo emotivo");
  if (axes.pace >= 2) bits.push("ritmo veloce");
  if (axes.pace <= -2) bits.push("ritmo lento e ipnotico");
  if (axes.length <= -1) bits.push("qualcosa di breve");
  if (axes.length >= 1) bits.push("materiale per binge");
  const top = Object.entries(moods).sort((a,b)=>b[1]!-a[1]!).slice(0,2).map(([m])=>m);
  const because = bits.length ? bits.join(", ") : "il mood che hai descritto";
  const sim = pick.item.similar?.slice(0,3).map(id => id.replace(/-/g," ")).join(", ");
  return `Ti consiglio ${pick.item.title} perché hai chiesto ${because}${top.length?` e vibes ${top.join(" + ")}`:""}. È compatibile al ${pick.score}% con i tuoi gusti${sim?` e ha somiglianze con ${sim}`:""}.`;
}
