import type { MoodTag } from "@/lib/mock-catalog";

export type Axis = "tone" | "pace" | "complexity" | "darkness" | "length" | "familiarity" | "fantasy" | "language";

export interface QuizChoice {
  label: string;
  weights: Partial<Record<Axis, number>>;   // -2..+2
  moods?: MoodTag[];                        // boost per catalogo
}

export interface QuizQuestion {
  id: string;
  question: string;
  choices: QuizChoice[];
}

export const QUIZ: QuizQuestion[] = [
  { id:"q1", question:"Stasera vuoi spegnere il cervello o farti venire una crisi esistenziale?",
    choices:[
      { label:"Spegnere tutto, per favore", weights:{ complexity:-2, tone:+1 }, moods:["cozy","funny"] },
      { label:"Crisi esistenziale, grazie", weights:{ complexity:+2, tone:-1, darkness:+1 }, moods:["mind-bending","sad"] },
      { label:"Via di mezzo, sono fragile", weights:{ complexity:+1 }, moods:["slow-burn"] },
    ] },
  { id:"q2", question:"Preferisci ridere, piangere o sospettare di ogni personaggio?",
    choices:[
      { label:"Ridere", weights:{ tone:+2 }, moods:["funny","cozy"] },
      { label:"Piangere", weights:{ tone:-2 }, moods:["sad","romantic"] },
      { label:"Sospettare di tutti", weights:{ darkness:+1, complexity:+1 }, moods:["thriller","mind-bending"] },
    ] },
  { id:"q3", question:"Quanto sangue tolleri, da 1 a Game of Thrones?",
    choices:[
      { label:"Zero, sono un fiore", weights:{ darkness:-2 }, moods:["cozy","funny"] },
      { label:"Un po', se serve alla trama", weights:{ darkness:+1 } },
      { label:"Portate un mocio", weights:{ darkness:+2 }, moods:["dark","action","thriller"] },
    ] },
  { id:"q4", question:"Storia chiusa o 7 stagioni di impegno emotivo?",
    choices:[
      { label:"Chiusa in una sera", weights:{ length:-2 }, moods:["short"] },
      { label:"Mini-serie, 6-10 ore", weights:{ length:0 }, moods:["short","binge"] },
      { label:"Vita nuova, 7 stagioni", weights:{ length:+2 }, moods:["binge"] },
    ] },
  { id:"q5", question:"Realistico o draghi, multiversi e gente che parla con i morti?",
    choices:[
      { label:"Realistico, piedi per terra", weights:{ fantasy:-2 } },
      { label:"Un pizzico di weird", weights:{ fantasy:+1 }, moods:["sci-fi"] },
      { label:"Draghi ovunque", weights:{ fantasy:+2 }, moods:["fantasy","sci-fi","epic"] },
    ] },
  { id:"q6", question:"Quanto famoso deve essere il titolo?",
    choices:[
      { label:"Mainstream conclamato", weights:{ familiarity:+2 }, moods:["iconic"] },
      { label:"Cult di nicchia", weights:{ familiarity:-1 }, moods:["hidden-gem"] },
      { label:"Roba che conoscono in dodici", weights:{ familiarity:-2 }, moods:["hidden-gem"] },
    ] },
  { id:"q7", question:"Simile a ciò che hai già visto o fuori dalla comfort zone?",
    choices:[
      { label:"Simile, non ho energie", weights:{ complexity:-1 } },
      { label:"Mezzo passo di lato", weights:{} },
      { label:"Sorprendimi davvero", weights:{ complexity:+1, familiarity:-1 } },
    ] },
  { id:"q8", question:"Sottotitoli o doppiaggio?",
    choices:[
      { label:"Sottotitoli, sono in vena", weights:{ language:+1 } },
      { label:"Doppiaggio e coperta", weights:{ language:-1 }, moods:["cozy"] },
      { label:"Non mi importa", weights:{} },
    ] },
  { id:"q9", question:"Ritmo lento e profondo o 'un altro episodio e dormo'?",
    choices:[
      { label:"Lento, quasi ipnotico", weights:{ pace:-2 }, moods:["slow-burn"] },
      { label:"Bilanciato", weights:{ pace:0 } },
      { label:"Ritmo assassino", weights:{ pace:+2 }, moods:["fast-paced","action"] },
    ] },
  { id:"q10", question:"Il finale deve consolarti o rovinarti la settimana?",
    choices:[
      { label:"Consolarmi, sono già provato", weights:{ tone:+1, darkness:-1 }, moods:["cozy"] },
      { label:"Colpo al cuore controllato", weights:{ tone:-1, darkness:+1 }, moods:["sad"] },
      { label:"Distruggimi", weights:{ tone:-2, darkness:+2 }, moods:["dark","sad","mind-bending"] },
    ] },
];
