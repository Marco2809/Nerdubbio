/**
 * Nerdacolo Engine — motore di raccomandazione stile Akinator per film/serie.
 *
 * Architettura pensata per MVP euristico; i punti marcati con `AI:` possono
 * essere sostituiti in futuro con inferenza LLM su overview/keywords TMDB.
 */
import type { CatalogItem } from "@/lib/mock-catalog";
import { CATALOG } from "@/lib/mock-catalog";
import type { LibraryState } from "@/lib/php/library-client";
import {
  NERDACOLO_QUESTION_BY_ID,
  questionsForMode,
} from "./nerdacolo-questions";
import {
  buildHighlyRatedGenreSet,
  catalogToCandidate,
  commitmentLabel,
  levelAtLeast,
  levelAtMost,
  moodLabelFromTraits,
  traitToNumber,
} from "./nerdacolo-traits";
import type {
  NerdacoloAnswer,
  NerdacoloAnswerResult,
  NerdacoloCandidate,
  NerdacoloFinalResult,
  NerdacoloMode,
  NerdacoloQuestion,
  NerdacoloSessionState,
  NerdacoloStartParams,
  NerdacoloStartResult,
  NerdacoloTraits,
  NerdacoloUserContext,
  ScoringEffects,
} from "./nerdacolo-types";
import {
  CONFIDENCE_STOP,
  ELIMINATION_THRESHOLD,
  MAX_QUESTIONS,
  MIN_CANDIDATES,
  SCORE_GAP_STOP,
} from "./nerdacolo-types";

const ORACLE_LINES = [
  "La sfera ha visto troppi thriller scarsi. Li sto eliminando.",
  "Interessante. Il tuo divano chiede qualcosa di meno traumatico.",
  "Ho scartato le serie da 12 stagioni. Non siamo qui per firmare un mutuo emotivo.",
  "La tua watchlist è lunga, ma oggi serve precisione.",
  "Sto cercando qualcosa che non ti faccia scrollare il telefono dopo 8 minuti.",
  "La sfera suggerisce mistero, ma senza farti dormire con la luce accesa.",
  "Ho capito: vuoi soffrire, ma con una bella fotografia.",
  "Il dubbio si restringe…",
  "Sto eliminando le scelte pigre…",
  "Restano pochi sospetti. La sfera sta per parlare.",
];

function randomId(): string {
  return `nc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickOracleLine(extra?: string): string {
  if (extra) return extra;
  return ORACLE_LINES[Math.floor(Math.random() * ORACLE_LINES.length)]!;
}

/** Costruisce contesto utente dalla libreria Nerdubbio. */
export function buildNerdacoloUserContext(
  state: LibraryState,
  userId?: string,
  language: "it" | "en" = "it",
): NerdacoloUserContext {
  const seenIds = Object.entries(state.media)
    .filter(([, m]) => m.status === "completed" || m.status === "dropped")
    .map(([k]) => k);

  const watchlistIds = Object.entries(state.media)
    .filter(([, m]) =>
      ["plan_to_watch", "watching", "favorite"].includes(m.status),
    )
    .map(([k]) => k);

  const highlyRatedIds = Object.entries(state.media)
    .filter(([, m]) => (m.rating ?? 0) >= 8)
    .map(([k]) => k);

  return {
    userId,
    seenIds,
    dismissedIds: state.dismissed,
    watchlistIds,
    favoriteGenres: state.favoriteGenres,
    excludedGenres: [],
    moodProfile: state.moodProfile ?? [],
    highlyRatedIds,
    language,
    country: "IT",
  };
}

function filterPoolByMode(
  items: CatalogItem[],
  mode: NerdacoloMode,
  profile: NerdacoloUserContext,
): CatalogItem[] {
  const seen = new Set([...profile.seenIds, ...profile.dismissedIds]);
  let pool = items.filter(c => {
    const key = `${c.type}-${c.tmdb_id}`;
    return !seen.has(c.id) && !seen.has(key);
  });
  if (mode === "movie") pool = pool.filter(c => c.type === "movie");
  if (mode === "tv") pool = pool.filter(c => c.type === "tv");
  if (profile.excludedGenres.length) {
    pool = pool.filter(c => !c.genres.some(g => profile.excludedGenres.includes(g)));
  }
  return pool;
}

function buildInitialCandidates(
  catalog: CatalogItem[],
  profile: NerdacoloUserContext,
): NerdacoloCandidate[] {
  const hrGenres = buildHighlyRatedGenreSet(catalog, profile.highlyRatedIds);
  return catalog
    .map(item => catalogToCandidate(item, profile, hrGenres))
    .sort((a, b) => b.score - a.score);
}

function passesHardFilters(
  c: NerdacoloCandidate,
  filters: ScoringEffects["hardFilters"],
  mode: NerdacoloMode,
): boolean {
  if (!filters) return true;
  if (filters.mediaType && c.mediaType !== filters.mediaType) return false;
  if (mode === "movie" && filters.maxRuntimeMinutes != null) {
    const rt = c.runtimeMinutes ?? 999;
    if (rt > filters.maxRuntimeMinutes) return false;
  }
  if (mode === "movie" && filters.minRuntimeMinutes != null) {
    const rt = c.runtimeMinutes ?? 0;
    if (rt < filters.minRuntimeMinutes) return false;
  }
  if (filters.maxSeasons != null && (c.numberOfSeasons ?? 99) > filters.maxSeasons) return false;
  if (filters.maxCommitment && !levelAtMost(c.traits.commitment, filters.maxCommitment)) return false;
  if (filters.maxViolence && !levelAtMost(c.traits.violenceLevel, filters.maxViolence)) return false;
  if (filters.maxHorror && !levelAtMost(c.traits.horrorLevel, filters.maxHorror)) return false;
  if (filters.maxComplexity && !levelAtMost(c.traits.complexity, filters.maxComplexity)) return false;
  if (filters.minComplexity && !levelAtLeast(c.traits.complexity, filters.minComplexity)) return false;
  if (filters.maxEmotional && !levelAtMost(c.traits.emotionalImpact, filters.maxEmotional)) return false;
  if (filters.minEmotional && !levelAtLeast(c.traits.emotionalImpact, filters.minEmotional)) return false;
  if (filters.maxPace && !levelAtMost(c.traits.pace, filters.maxPace)) return false;
  if (filters.minPace && !levelAtLeast(c.traits.pace, filters.minPace)) return false;
  if (filters.minMainstream === "balanced" && c.traits.mainstreamLevel === "hidden_gem") return false;
  if (filters.maxSubtitleEffort && !levelAtMost(c.traits.subtitleEffort, filters.maxSubtitleEffort)) return false;
  if (filters.requireGenres?.length) {
    const hit = filters.requireGenres.some(g =>
      c.genres.some(cg => cg.toLowerCase().includes(g.toLowerCase())),
    );
    if (!hit) return false;
  }
  if (filters.excludeGenres?.length) {
    const bad = filters.excludeGenres.some(g =>
      c.genres.some(cg => cg.toLowerCase().includes(g.toLowerCase())),
    );
    if (bad) return false;
  }
  return true;
}

function applyTraitDelta(
  c: NerdacoloCandidate,
  trait: keyof NerdacoloTraits,
  delta: number,
): number {
  const val = c.traits[trait];
  const num = traitToNumber(trait, typeof val === "string" ? val : (val as string[]));
  const alignment = delta > 0 ? num * delta : -num * Math.abs(delta);
  return alignment * 4;
}

function applyEffectsToCandidate(
  c: NerdacoloCandidate,
  effects: ScoringEffects,
  mode: NerdacoloMode,
): { score: number; reasons: string[]; penalties: string[]; eliminated: boolean } {
  if (!passesHardFilters(c, effects.hardFilters, mode)) {
    return { score: 0, reasons: [], penalties: ["incompatibile"], eliminated: true };
  }

  let score = c.score;
  const reasons = [...c.reasons];
  const penalties = [...c.penalties];

  if (effects.boostTraits) {
    for (const [k, v] of Object.entries(effects.boostTraits)) {
      if (k in c.traits) {
        const boost = applyTraitDelta(c, k as keyof NerdacoloTraits, v ?? 0);
        score += boost;
        if (boost > 3) reasons.push(`allineato: ${k}`);
      }
    }
  }
  if (effects.penalizeTraits) {
    for (const [k, v] of Object.entries(effects.penalizeTraits)) {
      if (k in c.traits) {
        score -= applyTraitDelta(c, k as keyof NerdacoloTraits, Math.abs(v ?? 0));
      }
    }
  }
  if (effects.boostMoods?.length) {
    const hits = effects.boostMoods.filter(m => c.traits.mood.includes(m)).length;
    score += hits * 5;
    if (hits >= 2) reasons.push("mood perfetto");
  }
  if (effects.penalizeMoods?.length) {
    const hits = effects.penalizeMoods.filter(m => c.traits.mood.includes(m)).length;
    score -= hits * 4;
    if (hits >= 2) penalties.push("mood sbagliato");
  }
  if (effects.softFilters?.preferComfort) {
    const comfortNum = traitToNumber("comfortLevel", c.traits.comfortLevel);
    score += comfortNum * (effects.softFilters.preferComfort ?? 0) * 2;
  }
  if (effects.softFilters?.preferDiscovery) {
    const ms = traitToNumber("mainstreamLevel", c.traits.mainstreamLevel);
    score -= ms * (effects.softFilters.preferDiscovery ?? 0) * 2;
  }
  if (effects.softFilters?.preferBinge && c.mediaType === "tv") {
    const b = traitToNumber("bingeability", c.traits.bingeability);
    score += b * (effects.softFilters.preferBinge ?? 0) * 2;
  }
  if (effects.softFilters?.preferShort) {
    if (c.traits.commitment === "short") score += 6;
    if (c.traits.commitment === "long") score -= 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const eliminated = score < ELIMINATION_THRESHOLD;
  return { score, reasons, penalties, eliminated };
}

function applyAnswerToCandidates(
  candidates: NerdacoloCandidate[],
  answer: NerdacoloAnswer,
  mode: NerdacoloMode,
  prevEliminated: number,
): { candidates: NerdacoloCandidate[]; eliminatedCount: number } {
  let eliminatedCount = prevEliminated;
  const updated = candidates
    .map(c => {
      const r = applyEffectsToCandidate(c, answer.effects, mode);
      if (r.eliminated) eliminatedCount++;
      return {
        ...c,
        score: r.score,
        reasons: [...new Set([...r.reasons])],
        penalties: [...new Set([...r.penalties])],
      };
    })
    .filter(c => c.score >= ELIMINATION_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  return { candidates: updated, eliminatedCount };
}

function traitVariance(
  candidates: NerdacoloCandidate[],
  trait: keyof NerdacoloTraits | "mood",
): number {
  if (candidates.length < 2) return 0;
  const vals = candidates.map(c => {
    if (trait === "mood") {
      const m = c.traits.mood[0] ?? "neutral";
      return traitToNumber("mood", m);
    }
    const v = c.traits[trait];
    return traitToNumber(trait, typeof v === "string" ? v : String(v));
  });
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
}

/** Potere discriminante di una domanda sui candidati rimasti. */
export function calculateQuestionValue(
  question: NerdacoloQuestion,
  session: NerdacoloSessionState,
): number {
  if (session.askedQuestionIds.includes(question.id)) return -999;

  const candidates = session.candidates;
  if (!candidates.length) return -999;

  let candidateSplitPower = 0;
  for (const opt of question.options) {
    const sim = applyAnswerToCandidates([...candidates], opt, session.mode, 0);
    const top = sim.candidates[0]?.title ?? "";
    candidateSplitPower += top ? 1 : 0;
  }
  candidateSplitPower = candidateSplitPower / Math.max(question.options.length, 1);

  let uncertaintyReduction = 0;
  for (const trait of question.discriminates) {
    uncertaintyReduction += traitVariance(candidates, trait);
  }
  uncertaintyReduction = Math.min(1, uncertaintyReduction / question.discriminates.length);

  let relevance = 0;
  for (const trait of question.discriminates) {
    if (traitVariance(candidates, trait) > 0.15) relevance += 1;
  }
  relevance = relevance / Math.max(question.discriminates.length, 1);

  const categoryKnown =
    session.acceptedTraits[question.category] != null;
  const userProfileUnknownFactor = categoryKnown ? 0 : 1;

  const repetitionPenalty = session.askedQuestionIds.filter(id => {
    const q = NERDACOLO_QUESTION_BY_ID[id];
    return q?.category === question.category;
  }).length * 0.3;

  return (
    candidateSplitPower * 0.4 +
    uncertaintyReduction * 0.3 +
    relevance * 0.2 +
    userProfileUnknownFactor * 0.1 -
    repetitionPenalty +
    question.priority * 0.02
  );
}

export function chooseNextQuestion(
  sessionState: NerdacoloSessionState,
): NerdacoloQuestion | null {
  if (sessionState.questionCount >= MAX_QUESTIONS) return null;
  if (sessionState.candidates.length <= MIN_CANDIDATES) return null;

  const pool = questionsForMode(sessionState.mode).filter(q => {
    if (sessionState.askedQuestionIds.includes(q.id)) return false;
    if (q.appliesTo === "movie" && sessionState.mode === "tv") return false;
    if (q.appliesTo === "tv" && sessionState.mode === "movie") return false;
    return true;
  });

  if (!pool.length) return null;

  let best: NerdacoloQuestion | null = null;
  let bestVal = -Infinity;
  for (const q of pool) {
    const v = calculateQuestionValue(q, sessionState);
    if (v > bestVal) {
      bestVal = v;
      best = q;
    }
  }
  return bestVal > 0 ? best : pool.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

function computeConfidence(candidates: NerdacoloCandidate[]): number {
  if (!candidates.length) return 0;
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0]!;
  const second = sorted[1];
  const gap = second ? top.score - second.score : top.score;
  const poolFactor = Math.min(1, 1 / Math.max(candidates.length / 8, 1));
  return Math.min(99, Math.round(top.score * 0.6 + gap * 1.2 + poolFactor * 15));
}

function shouldStopSession(session: NerdacoloSessionState): boolean {
  const conf = computeConfidence(session.candidates);
  session.confidence = conf;
  const sorted = [...session.candidates].sort((a, b) => b.score - a.score);
  const gap = sorted.length >= 2 ? sorted[0]!.score - sorted[1]!.score : sorted[0]?.score ?? 0;
  return (
    session.questionCount >= MAX_QUESTIONS ||
    conf >= CONFIDENCE_STOP ||
    gap >= SCORE_GAP_STOP ||
    session.candidates.length <= MIN_CANDIDATES
  );
}

export function startNerdacoloSession(params: NerdacoloStartParams): NerdacoloStartResult {
  const lang = params.language ?? params.userProfile.language ?? "it";
  const catalog = params.catalogPool.length > 0 ? params.catalogPool : CATALOG;

  const filtered = filterPoolByMode(catalog, params.mode, params.userProfile);
  let candidates = buildInitialCandidates(filtered, params.userProfile);

  if (candidates.length < 20) {
    const fallback = filterPoolByMode(CATALOG, params.mode, params.userProfile);
    const fb = buildInitialCandidates(fallback, params.userProfile);
    const keys = new Set(candidates.map(c => c.mediaKey));
    for (const c of fb) {
      if (!keys.has(c.mediaKey)) {
        candidates.push(c);
        keys.add(c.mediaKey);
      }
    }
    candidates.sort((a, b) => b.score - a.score);
  }

  const sessionState: NerdacoloSessionState = {
    sessionId: randomId(),
    mode: params.mode,
    candidates: candidates.slice(0, 150),
    initialPoolSize: candidates.length,
    eliminatedCount: 0,
    acceptedTraits: {},
    rejectedTraits: {},
    askedQuestionIds: [],
    answers: [],
    questionCount: 0,
    confidence: 0,
    language: lang,
    country: params.country ?? params.userProfile.country ?? "IT",
  };

  const firstQuestion = chooseNextQuestion(sessionState);
  if (!firstQuestion) {
    throw new Error("Nerdacolo: nessuna domanda disponibile");
  }

  return {
    sessionId: sessionState.sessionId,
    candidatePool: sessionState.candidates,
    firstQuestion,
    sessionState,
    oracleLine: pickOracleLine(
      "Nerdacolo apre la sfera. Ho raccolto i candidati dalla watchlist, TMDB e i tuoi gusti.",
    ),
  };
}

export function answerQuestion(
  sessionState: NerdacoloSessionState,
  questionId: string,
  answerId: string,
): NerdacoloAnswerResult {
  const question = NERDACOLO_QUESTION_BY_ID[questionId];
  if (!question) throw new Error(`Domanda sconosciuta: ${questionId}`);

  const answer = question.options.find(o => o.id === answerId);
  if (!answer) throw new Error(`Risposta sconosciuta: ${answerId}`);

  const { candidates, eliminatedCount } = applyAnswerToCandidates(
    sessionState.candidates,
    answer,
    sessionState.mode,
    sessionState.eliminatedCount,
  );

  const updated: NerdacoloSessionState = {
    ...sessionState,
    candidates: candidates.length ? candidates : sessionState.candidates.slice(0, MIN_CANDIDATES),
    eliminatedCount,
    askedQuestionIds: [...sessionState.askedQuestionIds, questionId],
    answers: [
      ...sessionState.answers,
      { questionId, answerId, funnyReaction: answer.funnyReaction },
    ],
    questionCount: sessionState.questionCount + 1,
    acceptedTraits: {
      ...sessionState.acceptedTraits,
      [question.category]: answerId,
    },
    lastOracleLine: answer.funnyReaction,
    confidence: computeConfidence(candidates.length ? candidates : sessionState.candidates),
  };

  if (shouldStopSession(updated)) {
    return {
      updatedSessionState: updated,
      nextQuestion: null,
      finalRecommendation: generateFinalRecommendation(updated),
      oracleLine: pickOracleLine("La sfera ha parlato."),
      shouldStop: true,
    };
  }

  const nextQuestion = chooseNextQuestion(updated);
  if (!nextQuestion) {
    return {
      updatedSessionState: updated,
      nextQuestion: null,
      finalRecommendation: generateFinalRecommendation(updated),
      oracleLine: pickOracleLine(),
      shouldStop: true,
    };
  }

  const remaining = updated.candidates.length;
  const oracleLine = pickOracleLine(
    `Restano ${remaining} sospetti. ${answer.funnyReaction}`,
  );

  return {
    updatedSessionState: { ...updated, lastOracleLine: oracleLine },
    nextQuestion,
    finalRecommendation: null,
    oracleLine,
    shouldStop: false,
  };
}

function traitLabelsFromAnswers(session: NerdacoloSessionState): string[] {
  const labels: string[] = [];
  for (const a of session.answers) {
    const q = NERDACOLO_QUESTION_BY_ID[a.questionId];
    const opt = q?.options.find(o => o.id === a.answerId);
    if (opt) labels.push(opt.label.toLowerCase());
  }
  return labels.slice(-5);
}

export function generateFinalRecommendation(
  sessionState: NerdacoloSessionState,
): NerdacoloFinalResult {
  const sorted = [...sessionState.candidates].sort((a, b) => b.score - a.score);
  const main = sorted[0]!;
  const alternatives = sorted.slice(1, 4);
  const confidence = computeConfidence(sorted);
  const isBoldPick = confidence < 70;

  const answerLabels = traitLabelsFromAnswers(sessionState);
  const matchedTraits: string[] = [];
  if (main.traits.mysteryLevel === "high") matchedTraits.push("mistero");
  if (main.traits.comedyLevel === "high") matchedTraits.push("comedy");
  if (main.traits.emotionalImpact === "heavy") matchedTraits.push("emotivo");
  if (main.traits.pace === "fast") matchedTraits.push("ritmo veloce");
  if (main.traits.complexity === "complex") matchedTraits.push("cerebrale");
  if (main.traits.horrorLevel === "high") matchedTraits.push("horror");
  if (main.traits.comfortLevel === "high") matchedTraits.push("comfort");

  const whyNotOthers = sorted.slice(1, 4).map(alt => {
    const diff = main.score - alt.score;
    const reason = alt.penalties[0] ?? `meno allineato (${diff} pt)`;
    return `${alt.title}: ${reason}`;
  });

  const likedTitles = sessionState.answers.length > 0 ? answerLabels.join(", ") : "il mood della serata";
  const genreStr = main.genres.slice(0, 3).join(", ");
  const explanation = isBoldPick
    ? `Scelta audace: ti consiglio ${main.title} (${genreStr}). Con le risposte su ${likedTitles}, è il miglior match tra i ${sessionState.initialPoolSize} candidati iniziali, anche se la sfera non è al 100% sicura.`
    : `Ti consiglio ${main.title} perché hai scelto ${likedTitles}. Ha ${matchedTraits.join(", ") || "un profilo coerente"} e voto TMDB ${main.tmdbRating.toFixed(1)}. Ho scartato ${sessionState.eliminatedCount} titoli incompatibili.`;

  return {
    mainRecommendation: main,
    alternativeRecommendations: alternatives,
    explanation,
    compatibilityScore: main.score,
    matchedTraits,
    rejectedButRecoveredTraits: [],
    whyNotOthers,
    confidence,
    isBoldPick,
    commitmentLabel: commitmentLabel(main),
    moodLabel: moodLabelFromTraits(main.traits),
    similarTo: main.genres.slice(0, 2),
  };
}

export function startMockNerdacoloSession(mode: NerdacoloMode = "surprise"): NerdacoloStartResult {
  return startNerdacoloSession({
    mode,
    userProfile: {
      seenIds: [],
      dismissedIds: [],
      watchlistIds: [],
      favoriteGenres: ["Drama", "Sci-Fi"],
      excludedGenres: [],
      moodProfile: ["thriller"],
      highlyRatedIds: [],
      language: "it",
      country: "IT",
    },
    catalogPool: CATALOG,
  });
}

export const NERDACOLO_SESSION_KEY = "nerdubbio:nerdacolo-session:v2";
export const NERDACOLO_RESULT_KEY = "nerdubbio:nerdacolo-result:v2";

export function saveNerdacoloSession(state: NerdacoloSessionState) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(NERDACOLO_SESSION_KEY, JSON.stringify(state));
}

export function loadNerdacoloSession(): NerdacoloSessionState | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(NERDACOLO_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NerdacoloSessionState;
  } catch {
    return null;
  }
}

export function saveNerdacoloResult(result: NerdacoloFinalResult) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(NERDACOLO_RESULT_KEY, JSON.stringify(result));
}

export function loadNerdacoloResult(): NerdacoloFinalResult | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(NERDACOLO_RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NerdacoloFinalResult;
  } catch {
    return null;
  }
}

export function clearNerdacoloSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(NERDACOLO_SESSION_KEY);
  sessionStorage.removeItem(NERDACOLO_RESULT_KEY);
}
