import type { CatalogItem } from "@/lib/mock-catalog";
import type { DoubtMode, QuizAnswers, UserProfile } from "./engine";
import { scoreCandidatesPartial } from "./engine";
import { CATALOG } from "@/lib/mock-catalog";
import {
  QUESTION_POOL,
  QUESTION_BY_ID,
  type Axis,
  type QuizQuestion,
} from "./questions";

const SESSION_LENGTH = 7;

const NERDACOLO_INTROS = [
  "Nerdacolo consulta il grimorio dello streaming…",
  "Nerdacolo sta calcolando il tiro salvezza del binge…",
  "Nerdacolo ha sniffato le tue risposte e non giudica (mente).",
  "Nerdacolo rolla un d20 sul catalogo…",
  "Nerdacolo legge la sfera come dadi loaded (scherzo, quasi).",
];

export function randomNerdacoloIntro(): string {
  return NERDACOLO_INTROS[Math.floor(Math.random() * NERDACOLO_INTROS.length)]!;
}

function questionModesOk(q: QuizQuestion, mode: DoubtMode): boolean {
  if (q.tvOnly && mode === "movie") return false;
  if (q.movieOnly && mode === "tv") return false;
  if (q.modes?.length && mode !== "surprise" && !q.modes.includes(mode)) return false;
  return true;
}

function axisVariance(items: CatalogItem[], axis: Axis): number {
  const vals = items.map(i => axisValue(i, axis));
  if (vals.length < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
}

function axisValue(item: CatalogItem, axis: Axis): number {
  switch (axis) {
    case "darkness":
      return item.moods.includes("dark") ? 1 : item.moods.includes("cozy") || item.moods.includes("funny") ? -1 : 0;
    case "pace":
      return item.moods.includes("fast-paced") ? 1 : item.moods.includes("slow-burn") ? -1 : 0;
    case "complexity":
      return item.moods.includes("mind-bending") ? 1 : item.moods.includes("cozy") ? -1 : 0;
    case "tone":
      return item.moods.includes("funny") || item.moods.includes("cozy") ? 1 : item.moods.includes("sad") || item.moods.includes("dark") ? -1 : 0;
    case "length": {
      const short = item.moods.includes("short") || (item.type === "movie" && (item.runtimeMin ?? 120) < 130);
      const binge = item.moods.includes("binge") || (item.seasons ?? 0) >= 3;
      return binge ? 1 : short ? -1 : 0;
    }
    case "fantasy":
      return item.moods.includes("fantasy") || item.moods.includes("sci-fi") ? 1 : -1;
    case "familiarity":
      return item.popularity / 50 - 1;
    case "language":
      return 0;
    default:
      return 0;
  }
}

function askedGroups(answers: QuizAnswers): Set<string> {
  const groups = new Set<string>();
  for (const qid of Object.keys(answers)) {
    const q = QUESTION_BY_ID[qid];
    if (q) groups.add(q.groupId ?? q.id);
  }
  return groups;
}

/** Sceglie la prossima domanda in base a mode, risposte e pool candidati. */
export function pickNextQuestion(
  mode: DoubtMode,
  answers: QuizAnswers,
  step: number,
  pool: CatalogItem[] = CATALOG,
  profile: UserProfile = {},
): QuizQuestion | null {
  if (step >= SESSION_LENGTH) return null;

  const asked = askedGroups(answers);
  const available = QUESTION_POOL.filter(
    q => questionModesOk(q, mode) && !asked.has(q.groupId ?? q.id),
  );
  if (!available.length) return null;

  // Prima domanda: opener leggero sul mood generale
  if (step === 0) {
    const openers = available.filter(q => q.groupId?.startsWith("opener"));
    const pool = openers.length ? openers : available;
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  const partial = scoreCandidatesPartial(answers, mode, profile, pool);
  const top = partial.slice(0, 8).map(x => x.item);

  const axisScores = new Map<Axis, number>();
  for (const q of available) {
    for (const axis of q.axes) {
      axisScores.set(axis, (axisScores.get(axis) ?? 0) + axisVariance(top, axis));
    }
  }

  let bestAxis: Axis | null = null;
  let bestVar = -1;
  for (const [axis, v] of axisScores) {
    if (v > bestVar) {
      bestVar = v;
      bestAxis = axis;
    }
  }

  const targeted = bestAxis
    ? available.filter(q => q.axes.includes(bestAxis!))
    : available;
  const questionPool = targeted.length ? targeted : available;
  return questionPool[Math.floor(Math.random() * questionPool.length)]!;
}

export function sessionLength(): number {
  return SESSION_LENGTH;
}
