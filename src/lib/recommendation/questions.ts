import type { MoodTag } from "@/lib/mock-catalog";
import type { DoubtMode } from "./engine";

export type Axis =
  | "tone"
  | "pace"
  | "complexity"
  | "darkness"
  | "length"
  | "familiarity"
  | "fantasy"
  | "language";

export interface QuizChoice {
  label: string;
  weights: Partial<Record<Axis, number>>;
  moods?: MoodTag[];
}

export interface QuizQuestion {
  id: string;
  /** Evita domande duplicate dello stesso tema nella sessione */
  groupId?: string;
  question: string;
  masterLine?: string;
  modes?: DoubtMode[];
  tvOnly?: boolean;
  movieOnly?: boolean;
  axes: Axis[];
  choices: QuizChoice[];
}

function q(
  partial: Omit<QuizQuestion, "axes"> & { axes?: Axis[] },
): QuizQuestion {
  const axes =
    partial.axes ??
    (Object.keys(partial.choices[0]?.weights ?? {}) as Axis[]);
  return { ...partial, axes };
}

/** Pool ampliato — Nerdacolo ne pesca ~7 a sessione, variate per mode e candidati. */
export const QUESTION_POOL: QuizQuestion[] = [
  q({
    id: "op-a",
    groupId: "opener",
    question: "Stasera il cervello va in stand-by o in overclock?",
    masterLine: "Prima domanda: niente trucchi, solo onestà.",
    axes: ["complexity", "tone"],
    choices: [
      { label: "Stand-by totale", weights: { complexity: -2, tone: +1 }, moods: ["cozy", "funny"] },
      { label: "Overclock filosofico", weights: { complexity: +2, tone: -1 }, moods: ["mind-bending"] },
      { label: "Modalità equilibrata", weights: { complexity: +1 }, moods: ["slow-burn"] },
    ],
  }),
  q({
    id: "op-b",
    groupId: "opener",
    question: "Che vibe cerchi: coperta, coltello o plot twist?",
    masterLine: "Nerdacolo annusa il mood della serata.",
    axes: ["tone", "darkness"],
    choices: [
      { label: "Coperta e pace", weights: { tone: +2, darkness: -2 }, moods: ["cozy"] },
      { label: "Tensione controllata", weights: { darkness: +1 }, moods: ["thriller"] },
      { label: "Plot twist che ti fregano", weights: { complexity: +2 }, moods: ["mind-bending"] },
    ],
  }),
  q({
    id: "op-c",
    groupId: "opener",
    question: "Sei più da rewatch sicuro o salto nel vuoto?",
    masterLine: "Nessun giudizio se scegli The Office per la 900ª volta.",
    axes: ["familiarity", "complexity"],
    choices: [
      { label: "Rewatch / comfort zone", weights: { familiarity: +2, complexity: -1 }, moods: ["cozy", "iconic"] },
      { label: "Mezzo passo fuori zona", weights: { familiarity: 0 } },
      { label: "Salto nel vuoto", weights: { familiarity: -2, complexity: +1 }, moods: ["hidden-gem"] },
    ],
  }),
  q({
    id: "tone-a",
    groupId: "tone",
    question: "Preferisci ridere, piangere o sospettare di ogni personaggio?",
    axes: ["tone"],
    choices: [
      { label: "Ridere", weights: { tone: +2 }, moods: ["funny", "cozy"] },
      { label: "Piangere (in silenzio)", weights: { tone: -2 }, moods: ["sad", "romantic"] },
      { label: "Sospettare di tutti", weights: { darkness: +1, complexity: +1 }, moods: ["thriller", "mind-bending"] },
    ],
  }),
  q({
    id: "tone-b",
    groupId: "tone",
    question: "Il finale deve consolarti o rovinarti la settimana?",
    masterLine: "Attenzione: questa risposta pesa sul tiro finale.",
    axes: ["tone", "darkness"],
    choices: [
      { label: "Consolami", weights: { tone: +1, darkness: -1 }, moods: ["cozy"] },
      { label: "Colpo al cuore", weights: { tone: -1, darkness: +1 }, moods: ["sad"] },
      { label: "Distruggimi", weights: { tone: -2, darkness: +2 }, moods: ["dark", "mind-bending"] },
    ],
  }),
  q({
    id: "dark-a",
    groupId: "darkness",
    question: "Quanto sangue tolleri, da 1 a Game of Thrones?",
    axes: ["darkness"],
    choices: [
      { label: "Zero, sono un fiore", weights: { darkness: -2 }, moods: ["cozy", "funny"] },
      { label: "Un po', se serve", weights: { darkness: +1 } },
      { label: "Portate un mocio", weights: { darkness: +2 }, moods: ["dark", "action", "thriller"] },
    ],
  }),
  q({
    id: "dark-b",
    groupId: "darkness",
    question: "Atmosfera: luminosa da IKEA o bunker post-apocalittico?",
    axes: ["darkness"],
    choices: [
      { label: "IKEA e tisane", weights: { darkness: -2, tone: +1 }, moods: ["cozy"] },
      { label: "Grigio nordico", weights: { darkness: +1 }, moods: ["slow-burn"] },
      { label: "Bunker", weights: { darkness: +2 }, moods: ["dark"] },
    ],
  }),
  q({
    id: "len-tv-a",
    groupId: "length-tv",
    tvOnly: true,
    modes: ["tv", "surprise"],
    question: "Storia chiusa o 7 stagioni di impegno emotivo?",
    axes: ["length"],
    choices: [
      { label: "Mini-serie, max 8 episodi", weights: { length: -1 }, moods: ["short"] },
      { label: "Una stagione buona", weights: { length: 0 }, moods: ["binge"] },
      { label: "Vita nuova, 7+ stagioni", weights: { length: +2 }, moods: ["binge", "epic"] },
    ],
  }),
  q({
    id: "len-movie-a",
    groupId: "length-movie",
    movieOnly: true,
    modes: ["movie", "surprise"],
    question: "Film corto (<90 min) o epico da 3 ore col popcorn refill?",
    axes: ["length"],
    choices: [
      { label: "Flash, sto crollando", weights: { length: -2 }, moods: ["short"] },
      { label: "Standard 2 ore", weights: { length: 0 } },
      { label: "Epico, sono pronto", weights: { length: +2 }, moods: ["epic"] },
    ],
  }),
  q({
    id: "len-surp-a",
    groupId: "length-surprise",
    modes: ["surprise"],
    question: "Quanto tempo hai prima di addormentarti con la pizza in mano?",
    axes: ["length"],
    choices: [
      { label: "Un'ora e via", weights: { length: -2 }, moods: ["short"] },
      { label: "Serata intera", weights: { length: 0 }, moods: ["binge"] },
      { label: "Finché non sorge il sole", weights: { length: +2 }, moods: ["binge"] },
    ],
  }),
  q({
    id: "fant-a",
    groupId: "fantasy",
    question: "Realistico o draghi, multiversi e gente che parla con i morti?",
    axes: ["fantasy"],
    choices: [
      { label: "Piedi per terra", weights: { fantasy: -2 } },
      { label: "Un pizzico di weird", weights: { fantasy: +1 }, moods: ["sci-fi"] },
      { label: "Draghi ovunque", weights: { fantasy: +2 }, moods: ["fantasy", "sci-fi", "epic"] },
    ],
  }),
  q({
    id: "fant-b",
    groupId: "fantasy",
    question: "Sci-fi hard o magia e spade che fanno vroom?",
    masterLine: "Nerdacolo ha opinioni forti su entrambi.",
    axes: ["fantasy"],
    choices: [
      { label: "Sci-fi, niente incantesimi", weights: { fantasy: +1 }, moods: ["sci-fi"] },
      { label: "Fantasy classico", weights: { fantasy: +2 }, moods: ["fantasy", "epic"] },
      { label: "Niente fuffa, drama reale", weights: { fantasy: -2 } },
    ],
  }),
  q({
    id: "fam-a",
    groupId: "familiarity",
    question: "Quanto famoso deve essere il titolo?",
    axes: ["familiarity"],
    choices: [
      { label: "Mainstream conclamato", weights: { familiarity: +2 }, moods: ["iconic"] },
      { label: "Cult di nicchia", weights: { familiarity: -1 }, moods: ["hidden-gem"] },
      { label: "Lo conoscono in dodici", weights: { familiarity: -2 }, moods: ["hidden-gem"] },
    ],
  }),
  q({
    id: "pace-a",
    groupId: "pace",
    question: "Ritmo lento e ipnotico o 'ancora un episodio e dormo'?",
    axes: ["pace"],
    choices: [
      { label: "Lento, quasi ASMR", weights: { pace: -2 }, moods: ["slow-burn"] },
      { label: "Bilanciato", weights: { pace: 0 } },
      { label: "Ritmo assassino", weights: { pace: +2 }, moods: ["fast-paced", "action"] },
    ],
  }),
  q({
    id: "pace-b",
    groupId: "pace",
    question: "Ti serve adrenalina o paesaggi che respirano?",
    axes: ["pace", "tone"],
    choices: [
      { label: "Adrenalina", weights: { pace: +2 }, moods: ["action", "fast-paced"] },
      { label: "Respiro lento", weights: { pace: -2 }, moods: ["slow-burn"] },
      { label: "Altalena emotiva", weights: { pace: 0, tone: -1 }, moods: ["slow-burn", "sad"] },
    ],
  }),
  q({
    id: "lang-a",
    groupId: "language",
    question: "Sottotitoli da purista o doppiaggio e coperta?",
    axes: ["language"],
    choices: [
      { label: "Sub originali", weights: { language: +1 } },
      { label: "Doppiaggio e coperta", weights: { language: -1 }, moods: ["cozy"] },
      { label: "Non mi importa", weights: {} },
    ],
  }),
  q({
    id: "comp-a",
    groupId: "complexity",
    question: "Trama lineare o schema da lavagna piena di frecce?",
    axes: ["complexity"],
    choices: [
      { label: "Lineare, grazie", weights: { complexity: -2 }, moods: ["cozy"] },
      { label: "Due timeline reggono", weights: { complexity: +1 }, moods: ["slow-burn"] },
      { label: "Lavagna piena", weights: { complexity: +2 }, moods: ["mind-bending"] },
    ],
  }),
  q({
    id: "comp-b",
    groupId: "complexity",
    question: "Preferisci capire tutto al primo giro o teorizzare per settimane?",
    masterLine: "Dark ha fatto danni permanenti a molti utenti. Procedi.",
    axes: ["complexity"],
    choices: [
      { label: "Primo giro, chiaro", weights: { complexity: -1 } },
      { label: "Qualche mistero va bene", weights: { complexity: +1 } },
      { label: "Teorie su Reddit per mesi", weights: { complexity: +2 }, moods: ["mind-bending"] },
    ],
  }),
  q({
    id: "rom-a",
    groupId: "tone-rom",
    question: "Romanticismo: zero, subplot o cuoricino che batte?",
    axes: ["tone"],
    choices: [
      { label: "Zero romance", weights: { tone: 0 }, moods: ["action", "thriller"] },
      { label: "Subplot ok", weights: { tone: 0 }, moods: ["slow-burn"] },
      { label: "Cuoricino", weights: { tone: -1 }, moods: ["romantic", "sad"] },
    ],
  }),
];

export const QUESTION_BY_ID: Record<string, QuizQuestion> = Object.fromEntries(
  QUESTION_POOL.map(q => [q.id, q]),
);

/** @deprecated Usare QUESTION_POOL + pickNextQuestion */
export const QUIZ = QUESTION_POOL.slice(0, 10);
