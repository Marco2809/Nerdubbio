import type { Locale } from "@/lib/i18n";
import type { CatalogItem } from "@/lib/mock-catalog";

/** Modalità sessione Nerdacolo. */
export type NerdacoloMode = "movie" | "tv" | "surprise";

export type TraitLevel = "none" | "low" | "medium" | "high";
export type PaceLevel = "slow" | "medium" | "fast";
export type ComplexityLevel = "easy" | "medium" | "complex";
export type EmotionalLevel = "light" | "medium" | "heavy";
export type MainstreamLevel = "hidden_gem" | "balanced" | "mainstream";
export type CommitmentLevel = "short" | "medium" | "long";

export type NerdacoloTraits = {
  mood: string[];
  pace: PaceLevel;
  complexity: ComplexityLevel;
  emotionalImpact: EmotionalLevel;
  violenceLevel: TraitLevel;
  comedyLevel: TraitLevel;
  romanceLevel: TraitLevel;
  mysteryLevel: TraitLevel;
  horrorLevel: TraitLevel;
  bingeability: "low" | "medium" | "high";
  comfortLevel: "low" | "medium" | "high";
  mainstreamLevel: MainstreamLevel;
  visualSpectacle: TraitLevel;
  subtitleEffort: "low" | "medium" | "high";
  commitment: CommitmentLevel;
};

export type NerdacoloCandidate = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  genres: string[];
  keywords: string[];
  runtimeMinutes?: number;
  episodeRuntime?: number;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  releaseYear?: number;
  popularity: number;
  tmdbRating: number;
  originalLanguage: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  traits: NerdacoloTraits;
  score: number;
  reasons: string[];
  penalties: string[];
  /** Chiave libreria `tv-123` / `movie-456` */
  mediaKey: string;
};

export type NerdacoloUserContext = {
  userId?: string;
  seenIds: string[];
  dismissedIds: string[];
  watchlistIds: string[];
  favoriteGenres: string[];
  excludedGenres: string[];
  moodProfile: string[];
  /** Titoli votati ≥8 con chiave media */
  highlyRatedIds: string[];
  /** Nomi dei titoli votati ≥8 — usati per spiegazioni concrete ("hai amato Dark") */
  highlyRatedTitles?: string[];
  language: Locale;
  country: string;
};

/** Bias persistente dal feedback post-risultato — applicato alle sessioni future. */
export type NerdacoloFeedbackBias = {
  lighter: number;
  heavier: number;
  shorter: number;
  action: number;
  niche: number;
};

export type ScoringEffects = {
  boostTraits?: Partial<Record<keyof NerdacoloTraits | string, number>>;
  penalizeTraits?: Partial<Record<keyof NerdacoloTraits | string, number>>;
  boostMoods?: string[];
  penalizeMoods?: string[];
  hardFilters?: {
    maxRuntimeMinutes?: number;
    minRuntimeMinutes?: number;
    maxSeasons?: number;
    maxCommitment?: CommitmentLevel;
    mediaType?: "movie" | "tv";
    minMainstream?: MainstreamLevel;
    maxMainstream?: MainstreamLevel;
    maxViolence?: TraitLevel;
    maxHorror?: TraitLevel;
    maxComplexity?: ComplexityLevel;
    minComplexity?: ComplexityLevel;
    maxEmotional?: EmotionalLevel;
    minEmotional?: EmotionalLevel;
    maxPace?: PaceLevel;
    minPace?: PaceLevel;
    requireGenres?: string[];
    excludeGenres?: string[];
    maxSubtitleEffort?: "low" | "medium" | "high";
  };
  softFilters?: {
    preferComfort?: number;
    preferDiscovery?: number;
    preferBinge?: number;
    preferShort?: number;
  };
};

export type NerdacoloAnswer = {
  id: string;
  label: string;
  funnyReaction: string;
  effects: ScoringEffects;
};

export type NerdacoloQuestionCategory =
  | "mood"
  | "time"
  | "energy"
  | "genre"
  | "comfort"
  | "pace"
  | "complexity"
  | "emotionalImpact"
  | "violence"
  | "commitment"
  | "mainstream"
  | "language"
  | "socialContext"
  | "ending"
  | "binge"
  | "fantasy";

export type NerdacoloQuestion = {
  id: string;
  category: NerdacoloQuestionCategory;
  text: string;
  subtitle?: string;
  tone?: string;
  appliesTo: "movie" | "tv" | "both";
  options: NerdacoloAnswer[];
  priority: number;
  maxAskOnce: boolean;
  /** Trait da controllare per discriminazione — usato da calculateQuestionValue */
  discriminates: (keyof NerdacoloTraits | "mood")[];
};

export type NerdacoloSessionState = {
  sessionId: string;
  mode: NerdacoloMode;
  candidates: NerdacoloCandidate[];
  initialPoolSize: number;
  eliminatedCount: number;
  acceptedTraits: Record<string, string | number | boolean>;
  rejectedTraits: Record<string, string | number | boolean>;
  askedQuestionIds: string[];
  answers: { questionId: string; answerId: string; funnyReaction: string }[];
  questionCount: number;
  confidence: number;
  language: Locale;
  country: string;
  /** Ultima frase del Nerdacolo mostrata in UI */
  lastOracleLine?: string;
  /** Nomi dei titoli votati alto — per la spiegazione finale */
  ratedTitles?: string[];
};

export type NerdacoloStartParams = {
  userId?: string;
  mode: NerdacoloMode;
  userProfile: NerdacoloUserContext;
  catalogPool: CatalogItem[];
  language?: Locale;
  country?: string;
};

export type NerdacoloStartResult = {
  sessionId: string;
  candidatePool: NerdacoloCandidate[];
  firstQuestion: NerdacoloQuestion;
  sessionState: NerdacoloSessionState;
  oracleLine: string;
};

export type NerdacoloAnswerResult = {
  updatedSessionState: NerdacoloSessionState;
  nextQuestion: NerdacoloQuestion | null;
  finalRecommendation: NerdacoloFinalResult | null;
  oracleLine: string;
  shouldStop: boolean;
};

export type NerdacoloFinalResult = {
  mainRecommendation: NerdacoloCandidate;
  alternativeRecommendations: NerdacoloCandidate[];
  explanation: string;
  compatibilityScore: number;
  matchedTraits: string[];
  rejectedButRecoveredTraits: string[];
  whyNotOthers: string[];
  confidence: number;
  isBoldPick: boolean;
  commitmentLabel: string;
  moodLabel: string;
  similarTo: string[];
};

export const MAX_QUESTIONS = 10;
/** Sotto questa soglia di domande non si chiude per confidence/gap: il gap
    iniziale viene dal pool, non dalle risposte dell'utente. */
export const MIN_QUESTIONS = 4;
export const MIN_CANDIDATES = 5;
export const CONFIDENCE_STOP = 85;
export const SCORE_GAP_STOP = 15;
export const ELIMINATION_THRESHOLD = 12;
