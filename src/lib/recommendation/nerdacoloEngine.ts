/**
 * Nerdacolo Engine — motore di raccomandazione stile Akinator per film/serie.
 *
 * Architettura pensata per MVP euristico; i punti marcati con `AI:` possono
 * essere sostituiti in futuro con inferenza LLM su overview/keywords TMDB.
 */
import type { CatalogItem } from "@/lib/mock-catalog";
import { CATALOG } from "@/lib/mock-catalog";
import type { LibraryState } from "@/lib/php/library-client";
import { normalizeLocale } from "@/lib/i18n";
import {
  questionById,
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
import type { NerdacoloFeedbackBias } from "./nerdacolo-types";
import {
  CONFIDENCE_STOP,
  ELIMINATION_THRESHOLD,
  MAX_QUESTIONS,
  MIN_CANDIDATES,
  MIN_QUESTIONS,
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
): NerdacoloUserContext {
  const seenIds = Object.entries(state.media)
    .filter(([, m]) => m.status === "completed" || m.status === "dropped")
    .map(([k]) => k);

  const watchlistIds = Object.entries(state.media)
    .filter(([, m]) =>
      m.favorite || ["plan_to_watch", "watching"].includes(m.status),
    )
    .map(([k]) => k);

  const highlyRated = Object.entries(state.media).filter(([, m]) => (m.rating ?? 0) >= 8);
  const highlyRatedIds = highlyRated.map(([k]) => k);
  const highlyRatedTitles = highlyRated
    .map(([, m]) => m.title)
    .filter((t): t is string => !!t)
    .slice(0, 6);

  return {
    userId,
    seenIds,
    dismissedIds: state.dismissed,
    watchlistIds,
    favoriteGenres: state.favoriteGenres,
    excludedGenres: [],
    moodProfile: state.moodProfile ?? [],
    highlyRatedIds,
    highlyRatedTitles,
    language: normalizeLocale(state.language),
    country: "IT",
  };
}

// ============================================================
// Feedback bias persistente — il feedback post-risultato pesa
// sulle sessioni future (spec: "il feedback deve aggiornare pesi futuri").
// ============================================================

const FEEDBACK_BIAS_KEY = "nerdubbio:nerdacolo-feedback-bias:v1";
const EMPTY_BIAS: NerdacoloFeedbackBias = { lighter: 0, heavier: 0, shorter: 0, action: 0, niche: 0 };

export function loadFeedbackBias(): NerdacoloFeedbackBias {
  if (typeof localStorage === "undefined") return { ...EMPTY_BIAS };
  try {
    const raw = localStorage.getItem(FEEDBACK_BIAS_KEY);
    return raw ? { ...EMPTY_BIAS, ...(JSON.parse(raw) as Partial<NerdacoloFeedbackBias>) } : { ...EMPTY_BIAS };
  } catch {
    return { ...EMPTY_BIAS };
  }
}

/** Registra feedback dell'utente sul risultato. "perfect" fa decadere i bias. */
export function recordNerdacoloFeedback(
  kind: keyof NerdacoloFeedbackBias | "perfect",
) {
  if (typeof localStorage === "undefined") return;
  const bias = loadFeedbackBias();
  if (kind === "perfect") {
    for (const k of Object.keys(bias) as (keyof NerdacoloFeedbackBias)[]) {
      bias[k] = Math.max(0, bias[k] - 1);
    }
  } else {
    bias[kind] = Math.min(3, bias[kind] + 1);
  }
  localStorage.setItem(FEEDBACK_BIAS_KEY, JSON.stringify(bias));
}

/** Applica il bias accumulato allo score iniziale dei candidati (effetto soft, max ±9). */
function applyFeedbackBias(c: NerdacoloCandidate, bias: NerdacoloFeedbackBias): number {
  let delta = 0;
  if (bias.lighter) {
    delta += traitToNumber("comedyLevel", c.traits.comedyLevel) * bias.lighter * 2;
    delta -= traitToNumber("emotionalImpact", c.traits.emotionalImpact) === -1 ? bias.lighter * 3 : 0;
    if (c.traits.horrorLevel === "high") delta -= bias.lighter * 3;
  }
  if (bias.heavier) {
    if (c.traits.emotionalImpact === "heavy") delta += bias.heavier * 3;
    if (c.traits.comedyLevel === "high") delta -= bias.heavier * 2;
  }
  if (bias.shorter) {
    if (c.traits.commitment === "short") delta += bias.shorter * 3;
    if (c.traits.commitment === "long") delta -= bias.shorter * 3;
  }
  if (bias.action) {
    if (c.traits.pace === "fast") delta += bias.action * 2;
    if (c.traits.visualSpectacle === "high") delta += bias.action * 1;
  }
  if (bias.niche) {
    if (c.traits.mainstreamLevel === "hidden_gem") delta += bias.niche * 3;
    if (c.traits.mainstreamLevel === "mainstream") delta -= bias.niche * 2;
  }
  return Math.max(-9, Math.min(9, Math.round(delta)));
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

  // Nessun tetto superiore: il cap a 100 schiacciava main e alternative sullo
  // stesso valore ("Match 100%" ovunque). Il % mostrato è calcolato a parte.
  score = Math.max(0, Math.round(score));
  const eliminated = score < ELIMINATION_THRESHOLD;
  return { score, reasons, penalties, eliminated };
}

/** Quota di pool che sopravvive a ogni risposta (taglio relativo). */
const SURVIVOR_RATIO = 0.72;
const PRUNE_FLOOR = MIN_CANDIDATES + 3;

function applyAnswerToCandidates(
  candidates: NerdacoloCandidate[],
  answer: NerdacoloAnswer,
  mode: NerdacoloMode,
  prevEliminated: number,
  opts: { prune?: boolean } = {},
): { candidates: NerdacoloCandidate[]; eliminatedCount: number } {
  const prune = opts.prune ?? true;
  let eliminatedCount = prevEliminated;
  let updated = candidates
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

  // Taglio relativo: anche con risposte "morbide" ogni domanda elimina la coda
  // della classifica (~28%), così il restringimento si percepisce sempre.
  // Disattivato nelle simulazioni di calculateQuestionValue, che devono
  // misurare quanto elimina la risposta in sé, non il taglio forzato.
  if (prune) {
    const keepCount = Math.max(PRUNE_FLOOR, Math.ceil(updated.length * SURVIVOR_RATIO));
    if (updated.length > keepCount) {
      eliminatedCount += updated.length - keepCount;
      updated = updated.slice(0, keepCount);
    }
  }

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

/**
 * Potere discriminante di una domanda sui candidati rimasti.
 *
 * Simula ogni opzione sul pool e misura:
 * - quanto le opzioni dividono il campo (varianza dei sopravvissuti);
 * - se opzioni diverse producono vincitori diversi (la domanda può
 *   davvero cambiare il risultato finale, non solo lo score).
 * AI: in futuro sostituibile con information gain su embedding dei candidati.
 */
export function calculateQuestionValue(
  question: NerdacoloQuestion,
  session: NerdacoloSessionState,
): number {
  if (session.askedQuestionIds.includes(question.id)) return -999;

  const candidates = session.candidates;
  if (!candidates.length) return -999;

  // Campione (top 60) per tenere il costo costante anche con pool grandi.
  const sample = candidates.slice(0, 60);
  const survivorFractions: number[] = [];
  const leaders = new Set<string>();
  for (const opt of question.options) {
    const sim = applyAnswerToCandidates(sample, opt, session.mode, 0, { prune: false });
    survivorFractions.push(sim.candidates.length / Math.max(sample.length, 1));
    leaders.add(sim.candidates[0]?.mediaKey ?? "none");
  }
  const meanSurv = survivorFractions.reduce((a, b) => a + b, 0) / Math.max(survivorFractions.length, 1);
  const survSpread =
    survivorFractions.reduce((s, f) => s + (f - meanSurv) ** 2, 0) / Math.max(survivorFractions.length, 1);
  // Opzioni che eliminano quote diverse di pool = domanda che taglia davvero.
  // Vincitori diversi tra opzioni = domanda che può ribaltare la classifica.
  const leaderChange = (leaders.size - 1) / Math.max(question.options.length - 1, 1);
  const candidateSplitPower = Math.min(1, survSpread * 8 + leaderChange * 0.7);

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
    const q = questionById(session.language, id);
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

  const pool = questionsAvailable(sessionState);

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
  // Il termine sullo score è normalizzato a 100: gli score grezzi non hanno
  // più tetto e non devono gonfiare la confidence.
  return Math.min(99, Math.round(Math.min(top.score, 100) * 0.6 + gap * 1.2 + poolFactor * 15));
}

function questionsAvailable(session: NerdacoloSessionState): NerdacoloQuestion[] {
  return questionsForMode(session.mode, session.language).filter(q => {
    if (session.askedQuestionIds.includes(q.id)) return false;
    if (q.appliesTo === "movie" && session.mode === "tv") return false;
    if (q.appliesTo === "tv" && session.mode === "movie") return false;
    return true;
  });
}

function shouldStopSession(session: NerdacoloSessionState): boolean {
  const conf = computeConfidence(session.candidates);
  session.confidence = conf;
  const sorted = [...session.candidates].sort((a, b) => b.score - a.score);
  const gap = sorted.length >= 2 ? sorted[0]!.score - sorted[1]!.score : sorted[0]?.score ?? 0;
  if (session.questionCount >= MAX_QUESTIONS) return true;
  if (session.candidates.length <= MIN_CANDIDATES) return true;
  if (questionsAvailable(session).length === 0) return true;
  // Confidence/gap chiudono solo dopo un minimo di domande: il distacco
  // iniziale arriva dallo scoring del pool, non dalle risposte dell'utente.
  if (session.questionCount < MIN_QUESTIONS) return false;
  return conf >= CONFIDENCE_STOP || gap >= SCORE_GAP_STOP;
}

export function startNerdacoloSession(params: NerdacoloStartParams): NerdacoloStartResult {
  const lang = normalizeLocale(params.language ?? params.userProfile.language ?? "it");
  const catalog = params.catalogPool.length > 0 ? params.catalogPool : CATALOG;

  const filtered = filterPoolByMode(catalog, params.mode, params.userProfile);
  let candidates = buildInitialCandidates(filtered, params.userProfile);

  // Il feedback delle sessioni passate ("troppo pesante", "meno mainstream"…)
  // pesa sullo score iniziale — effetto soft, l'utente può sempre smentirlo rispondendo.
  const bias = loadFeedbackBias();
  if (Object.values(bias).some(v => v > 0)) {
    candidates = candidates
      .map(c => ({ ...c, score: Math.max(0, Math.min(100, c.score + applyFeedbackBias(c, bias))) }))
      .sort((a, b) => b.score - a.score);
  }

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
    ratedTitles: (params.userProfile.highlyRatedTitles ?? []).slice(0, 3),
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
  const question = questionById(sessionState.language, questionId);
  if (!question) throw new Error(`Domanda sconosciuta: ${questionId}`);

  const answer = question.options.find(o => o.id === answerId);
  if (!answer) throw new Error(`Risposta sconosciuta: ${answerId}`);

  const applied = applyAnswerToCandidates(
    sessionState.candidates,
    answer,
    sessionState.mode,
    sessionState.eliminatedCount,
  );
  let survivors = applied.candidates;
  // Se la risposta elimina tutti sotto soglia, tieni i migliori 5 già scored
  // (non ripristinare il pool pre-risposta, che annullava l'effetto e bloccava il quiz).
  if (!survivors.length) {
    survivors = [...sessionState.candidates]
      .map(c => {
        const r = applyEffectsToCandidate(c, answer.effects, sessionState.mode);
        return { ...c, score: r.score, reasons: r.reasons, penalties: r.penalties };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MIN_CANDIDATES);
  }

  const kept = survivors.length;
  const eliminatedCount = Math.min(applied.eliminatedCount, Math.max(0, sessionState.initialPoolSize - kept));

  const updated: NerdacoloSessionState = {
    ...sessionState,
    candidates: survivors,
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
    confidence: computeConfidence(survivors),
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
    const q = questionById(session.language, a.questionId);
    const opt = q?.options.find(o => o.id === a.answerId);
    if (opt) labels.push(opt.label.toLowerCase());
  }
  return labels.slice(-5);
}

/** Differenza chiave alt vs main — per un "perché no" concreto invece dei punti. */
function keyDifference(main: NerdacoloCandidate, alt: NerdacoloCandidate): string {
  if (alt.traits.commitment === "long" && main.traits.commitment !== "long") return "impegno troppo lungo";
  if (alt.traits.emotionalImpact === "heavy" && main.traits.emotionalImpact !== "heavy") return "più pesante di quel che cercavi";
  if (alt.traits.horrorLevel === "high" && main.traits.horrorLevel !== "high") return "troppo horror per stasera";
  if (alt.traits.comedyLevel === "high" && main.traits.comedyLevel !== "high") return "troppo leggero rispetto al mood";
  if (alt.traits.complexity === "complex" && main.traits.complexity !== "complex") return "chiede più neuroni di quelli dichiarati";
  if (alt.traits.pace === "slow" && main.traits.pace !== "slow") return "ritmo più lento";
  if (alt.traits.mainstreamLevel === "mainstream" && main.traits.mainstreamLevel !== "mainstream") return "troppo mainstream per la richiesta";
  return "meno allineato alle tue risposte";
}

/** Per le scelte audaci: 3 alternative massimamente diverse tra loro (greedy sui generi). */
function diverseAlternatives(sorted: NerdacoloCandidate[], main: NerdacoloCandidate): NerdacoloCandidate[] {
  const pool = sorted.slice(1, 15);
  const picked: NerdacoloCandidate[] = [];
  const genreSets = [new Set(main.genres)];
  for (const c of pool) {
    if (picked.length >= 3) break;
    const overlapMax = Math.max(
      ...genreSets.map(gs => c.genres.filter(g => gs.has(g)).length),
      0,
    );
    if (overlapMax <= 1) {
      picked.push(c);
      genreSets.push(new Set(c.genres));
    }
  }
  // Se la diversità non basta, completa con i migliori per score.
  for (const c of pool) {
    if (picked.length >= 3) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

/** Trait penalizzati dalle risposte ma comunque presenti (moderati) nel vincitore. */
function recoveredTraits(session: NerdacoloSessionState, main: NerdacoloCandidate): string[] {
  const penalized = new Set<string>();
  for (const a of session.answers) {
    const q = questionById(session.language, a.questionId);
    const opt = q?.options.find(o => o.id === a.answerId);
    for (const k of Object.keys(opt?.effects.penalizeTraits ?? {})) penalized.add(k);
  }
  const labels: Record<string, string> = {
    violenceLevel: "un po' di violenza",
    horrorLevel: "qualche brivido",
    emotionalImpact: "momenti intensi",
    complexity: "qualche incastro di trama",
    romanceLevel: "una vena romantica",
  };
  const out: string[] = [];
  for (const [k, label] of Object.entries(labels)) {
    if (!penalized.has(k)) continue;
    const v = main.traits[k as keyof NerdacoloTraits];
    if (v === "medium") out.push(label);
  }
  return out;
}

export function generateFinalRecommendation(
  sessionState: NerdacoloSessionState,
): NerdacoloFinalResult {
  const sorted = [...sessionState.candidates].sort((a, b) => b.score - a.score);
  const main = sorted[0]!;
  const confidence = computeConfidence(sorted);
  const isBoldPick = confidence < 70;
  // Scelta audace → alternative volutamente diverse tra loro, non 3 cloni del main.
  const rawAlternatives = isBoldPick ? diverseAlternatives(sorted, main) : sorted.slice(1, 4);

  // % di match per la UI: derivata da confidence (main) e dal rapporto tra gli
  // score grezzi (alternative) — mai un piatto "100% ovunque".
  const mainPercent = Math.max(55, Math.min(97, Math.round(58 + confidence * 0.4)));
  const mainForUi = { ...main, score: mainPercent };
  const alternatives = rawAlternatives.map(alt => ({
    ...alt,
    score: Math.max(40, Math.min(mainPercent - 3, Math.round(mainPercent * (main.score > 0 ? alt.score / main.score : 0.8)))),
  }));

  const answerLabels = traitLabelsFromAnswers(sessionState);
  const matchedTraits: string[] = [];
  if (main.traits.mysteryLevel === "high") matchedTraits.push("mistero");
  if (main.traits.comedyLevel === "high") matchedTraits.push("comedy");
  if (main.traits.emotionalImpact === "heavy") matchedTraits.push("emotivo");
  if (main.traits.pace === "fast") matchedTraits.push("ritmo veloce");
  if (main.traits.complexity === "complex") matchedTraits.push("cerebrale");
  if (main.traits.horrorLevel === "high") matchedTraits.push("horror");
  if (main.traits.comfortLevel === "high") matchedTraits.push("comfort");

  const whyNotOthers = alternatives.map(alt => {
    const reason = alt.penalties[0] ?? keyDifference(main, alt);
    return `${alt.title}: ${reason}`;
  });

  // Spiegazione concreta: risposte date + titoli che l'utente ha votato alto.
  const likedTitles = sessionState.answers.length > 0 ? answerLabels.join(", ") : "il mood della serata";
  const genreStr = main.genres.slice(0, 3).join(", ");
  const rated = sessionState.ratedTitles ?? [];
  const ratedHint =
    rated.length && main.reasons.includes("simile a titoli che hai amato")
      ? ` È nella stessa corrente di ${rated.slice(0, 2).join(" e ")}, che hai votato alto.`
      : "";
  const explanation = isBoldPick
    ? `Scelta audace: ti consiglio ${main.title} (${genreStr}). Con le risposte su ${likedTitles} nessun titolo domina davvero, ma questo è il miglior match tra i ${sessionState.initialPoolSize} candidati.${ratedHint} Le alternative sotto sono volutamente molto diverse.`
    : `Ti consiglio ${main.title} perché hai scelto ${likedTitles}. Ha ${matchedTraits.join(", ") || "un profilo coerente"} e voto TMDB ${main.tmdbRating.toFixed(1)}.${ratedHint} Ho scartato ${sessionState.eliminatedCount} titoli incompatibili con le tue risposte.`;

  return {
    mainRecommendation: mainForUi,
    alternativeRecommendations: alternatives,
    explanation,
    compatibilityScore: mainPercent,
    matchedTraits,
    rejectedButRecoveredTraits: recoveredTraits(sessionState, main),
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
