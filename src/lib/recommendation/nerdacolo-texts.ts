import type { Locale } from "@/lib/i18n";

/**
 * Testi generati dal motore del Nerdacolo (battute della sfera, spiegazioni,
 * "perché no", etichette). Le domande hanno i loro file nerdacolo-question-texts.
 */
type NerdacoloTexts = {
  oracleLines: string[];
  opening: string;
  spoken: string;
  remaining: (n: number) => string;
  keyDiff: Record<"long" | "heavy" | "horror" | "light" | "complex" | "slow" | "mainstream" | "generic" | "lowRating" | "littleInfo" | "wrongMood", string>;
  recovered: Record<"violenceLevel" | "horrorLevel" | "emotionalImpact" | "complexity" | "romanceLevel", string>;
  matched: Record<"mystery" | "comedy" | "emotional" | "fast" | "cerebral" | "horror" | "comfort", string>;
  mood: Record<"comedy" | "dark" | "mystery" | "emotional" | "fast" | "slow" | "balanced", string>;
  commitment: {
    movie: (m: number) => string;
    movieLong: (m: number) => string;
    movieEpic: (m: number) => string;
    mini: (eps: number) => string;
    seasons: (s: number, eps: number) => string;
    long: (s: number) => string;
  };
  explain: {
    open: (title: string) => string;
    openBold: (title: string) => string;
    genreYear: (genres: string, year?: number) => string;
    runtime: (m: number) => string;
    seriesShape: (s: number, e?: number, m?: number) => string;
    rating: (r: string) => string;
    lovedSimilar: (a: string) => string;
    watchlist: string;
    answers: (labels: string) => string;
    bold: string;
    discarded: (n: number) => string;
  };
};

const IT: NerdacoloTexts = {
  oracleLines: [
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
  ],
  opening: "Nerdacolo apre la sfera. Ho raccolto i candidati dalla watchlist, TMDB e i tuoi gusti.",
  spoken: "La sfera ha parlato.",
  remaining: (n) => `Restano ${n} sospetti.`,
  keyDiff: {
    long: "impegno troppo lungo",
    heavy: "più pesante di quel che cercavi",
    horror: "troppo horror per stasera",
    light: "troppo leggero rispetto al mood",
    complex: "chiede più neuroni di quelli dichiarati",
    slow: "ritmo più lento",
    mainstream: "troppo mainstream per la richiesta",
    generic: "meno allineato alle tue risposte",
    lowRating: "voto TMDB basso",
    littleInfo: "poche informazioni sul titolo",
    wrongMood: "mood diverso da quello che cercavi",
  },
  recovered: {
    violenceLevel: "un po' di violenza",
    horrorLevel: "qualche brivido",
    emotionalImpact: "momenti intensi",
    complexity: "qualche incastro di trama",
    romanceLevel: "una vena romantica",
  },
  matched: {
    mystery: "mistero", comedy: "comedy", emotional: "emotivo", fast: "ritmo veloce",
    cerebral: "cerebrale", horror: "horror", comfort: "comfort",
  },
  mood: {
    comedy: "Leggero e divertente", dark: "Dark e intenso", mystery: "Mistero e suspense",
    emotional: "Emotivo e profondo", fast: "Ritmo serrato", slow: "Lento e contemplativo", balanced: "Equilibrato",
  },
  commitment: {
    movie: (m) => `~${m} min`,
    movieLong: (m) => `~${m} min (serata intera)`,
    movieEpic: (m) => `~${m} min (epico)`,
    mini: (eps) => `Miniserie · ~${eps} min/ep`,
    seasons: (s, eps) => `${s} stagioni · ~${eps} min/ep`,
    long: (s) => `${s}+ stagioni · impegno lungo`,
  },
  explain: {
    open: (t) => `Stasera: ${t}.`,
    openBold: (t) => `Scelta audace: ${t}.`,
    genreYear: (g, y) => (y ? `${g}, del ${y}.` : `${g}.`),
    runtime: (m) => `Dura ${m} minuti.`,
    seriesShape: (s, e, m) =>
      s <= 1
        ? `Una sola stagione${e ? ` da ${e} episodi` : ""}${m ? ` da ~${m} minuti` : ""}: si chiude in fretta.`
        : `${s} stagioni${e ? `, ${e} episodi` : ""}${m ? ` da ~${m} minuti` : ""}.`,
    rating: (r) => `Su TMDB ha ${r}/10.`,
    lovedSimilar: (a) => `Se hai amato ${a}, sei in zona.`,
    watchlist: "Ce l'avevi già in lista da vedere: è il momento.",
    answers: (l) => `In linea con quello che hai chiesto: ${l}.`,
    bold: "Nessun titolo domina davvero: le alternative sotto sono volutamente diverse.",
    discarded: (n) => `Ho scartato ${n} titoli che non c'entravano.`,
  },
};

const EN: NerdacoloTexts = {
  oracleLines: [
    "The orb has seen too many bad thrillers. Removing them.",
    "Interesting. Your couch wants something less traumatic.",
    "I dropped the 12-season shows. We're not signing an emotional mortgage tonight.",
    "Your watchlist is long, but tonight we need precision.",
    "Looking for something that won't have you scrolling your phone after 8 minutes.",
    "The orb suggests mystery, but not the sleep-with-the-lights-on kind.",
    "Got it: you want to suffer, but with great cinematography.",
    "The doubt is narrowing…",
    "Removing the lazy picks…",
    "Only a few suspects left. The orb is about to speak.",
  ],
  opening: "Nerdacolo opens the orb. I gathered candidates from your watchlist, TMDB and your taste.",
  spoken: "The orb has spoken.",
  remaining: (n) => `${n} suspects left.`,
  keyDiff: {
    long: "too long a commitment",
    heavy: "heavier than what you wanted",
    horror: "too much horror for tonight",
    light: "too light for the mood",
    complex: "needs more brain cells than you declared",
    slow: "slower pace",
    mainstream: "too mainstream for the request",
    generic: "a weaker match for your answers",
    lowRating: "low TMDB rating",
    littleInfo: "little info about the title",
    wrongMood: "different mood from what you wanted",
  },
  recovered: {
    violenceLevel: "a bit of violence",
    horrorLevel: "a few chills",
    emotionalImpact: "some intense moments",
    complexity: "a few plot twists",
    romanceLevel: "a romantic streak",
  },
  matched: {
    mystery: "mystery", comedy: "comedy", emotional: "emotional", fast: "fast-paced",
    cerebral: "cerebral", horror: "horror", comfort: "comfort",
  },
  mood: {
    comedy: "Light and fun", dark: "Dark and intense", mystery: "Mystery and suspense",
    emotional: "Emotional and deep", fast: "Fast-paced", slow: "Slow and contemplative", balanced: "Balanced",
  },
  commitment: {
    movie: (m) => `~${m} min`,
    movieLong: (m) => `~${m} min (a full evening)`,
    movieEpic: (m) => `~${m} min (epic)`,
    mini: (eps) => `Miniseries · ~${eps} min/ep`,
    seasons: (s, eps) => `${s} seasons · ~${eps} min/ep`,
    long: (s) => `${s}+ seasons · long commitment`,
  },
  explain: {
    open: (t) => `Tonight: ${t}.`,
    openBold: (t) => `Bold pick: ${t}.`,
    genreYear: (g, y) => (y ? `${g}, from ${y}.` : `${g}.`),
    runtime: (m) => `It runs ${m} minutes.`,
    seriesShape: (s, e, m) =>
      s <= 1
        ? `A single season${e ? ` of ${e} episodes` : ""}${m ? `, ~${m} minutes each` : ""}: quick to finish.`
        : `${s} seasons${e ? `, ${e} episodes` : ""}${m ? `, ~${m} minutes each` : ""}.`,
    rating: (r) => `It scores ${r}/10 on TMDB.`,
    lovedSimilar: (a) => `If you loved ${a}, you're in the right place.`,
    watchlist: "It was already on your watchlist: now's the time.",
    answers: (l) => `Matches what you asked for: ${l}.`,
    bold: "No title really dominates: the alternatives below are deliberately different.",
    discarded: (n) => `I discarded ${n} titles that didn't fit.`,
  },
};

const ES: NerdacoloTexts = {
  oracleLines: [
    "La esfera ha visto demasiados thrillers malos. Los estoy descartando.",
    "Interesante. Tu sofá pide algo menos traumático.",
    "He descartado las series de 12 temporadas. Hoy no firmamos una hipoteca emocional.",
    "Tu lista es larga, pero hoy hace falta precisión.",
    "Busco algo que no te haga mirar el móvil a los 8 minutos.",
    "La esfera sugiere misterio, pero sin dormir con la luz encendida.",
    "Entendido: quieres sufrir, pero con buena fotografía.",
    "La duda se reduce…",
    "Estoy descartando las opciones fáciles…",
    "Quedan pocos sospechosos. La esfera está a punto de hablar.",
  ],
  opening: "El Nerdacolo abre la esfera. He reunido candidatos de tu lista, TMDB y tus gustos.",
  spoken: "La esfera ha hablado.",
  remaining: (n) => `Quedan ${n} sospechosos.`,
  keyDiff: {
    long: "compromiso demasiado largo",
    heavy: "más pesado de lo que buscabas",
    horror: "demasiado terror para esta noche",
    light: "demasiado ligero para el mood",
    complex: "pide más neuronas de las declaradas",
    slow: "ritmo más lento",
    mainstream: "demasiado mainstream para la petición",
    generic: "encaja menos con tus respuestas",
    lowRating: "nota baja en TMDB",
    littleInfo: "poca información sobre el título",
    wrongMood: "mood distinto al que buscabas",
  },
  recovered: {
    violenceLevel: "algo de violencia",
    horrorLevel: "algún escalofrío",
    emotionalImpact: "momentos intensos",
    complexity: "alguna trama enrevesada",
    romanceLevel: "un toque romántico",
  },
  matched: {
    mystery: "misterio", comedy: "comedia", emotional: "emotivo", fast: "ritmo rápido",
    cerebral: "cerebral", horror: "terror", comfort: "confort",
  },
  mood: {
    comedy: "Ligero y divertido", dark: "Oscuro e intenso", mystery: "Misterio y suspense",
    emotional: "Emotivo y profundo", fast: "Ritmo trepidante", slow: "Lento y contemplativo", balanced: "Equilibrado",
  },
  commitment: {
    movie: (m) => `~${m} min`,
    movieLong: (m) => `~${m} min (toda la noche)`,
    movieEpic: (m) => `~${m} min (épico)`,
    mini: (eps) => `Miniserie · ~${eps} min/ep`,
    seasons: (s, eps) => `${s} temporadas · ~${eps} min/ep`,
    long: (s) => `${s}+ temporadas · compromiso largo`,
  },
  explain: {
    open: (t) => `Esta noche: ${t}.`,
    openBold: (t) => `Elección audaz: ${t}.`,
    genreYear: (g, y) => (y ? `${g}, de ${y}.` : `${g}.`),
    runtime: (m) => `Dura ${m} minutos.`,
    seriesShape: (s, e, m) =>
      s <= 1
        ? `Una sola temporada${e ? ` de ${e} episodios` : ""}${m ? ` de ~${m} minutos` : ""}: se termina rápido.`
        : `${s} temporadas${e ? `, ${e} episodios` : ""}${m ? ` de ~${m} minutos` : ""}.`,
    rating: (r) => `En TMDB tiene ${r}/10.`,
    lovedSimilar: (a) => `Si te encantó ${a}, vas bien.`,
    watchlist: "Ya la tenías en tu lista: es el momento.",
    answers: (l) => `En línea con lo que pediste: ${l}.`,
    bold: "Ningún título domina de verdad: las alternativas de abajo son distintas a propósito.",
    discarded: (n) => `He descartado ${n} títulos que no encajaban.`,
  },
};

const FR: NerdacoloTexts = {
  oracleLines: [
    "La sphère a vu trop de mauvais thrillers. Je les élimine.",
    "Intéressant. Ton canapé réclame quelque chose de moins traumatisant.",
    "J'ai écarté les séries de 12 saisons. On ne signe pas un crédit émotionnel ce soir.",
    "Ta liste est longue, mais ce soir il faut de la précision.",
    "Je cherche quelque chose qui ne te fera pas sortir ton téléphone au bout de 8 minutes.",
    "La sphère suggère du mystère, mais sans dormir la lumière allumée.",
    "Compris : tu veux souffrir, mais avec une belle photographie.",
    "Le doute se resserre…",
    "J'élimine les choix paresseux…",
    "Il reste peu de suspects. La sphère va parler.",
  ],
  opening: "Le Nerdacolo ouvre la sphère. J'ai réuni des candidats depuis ta liste, TMDB et tes goûts.",
  spoken: "La sphère a parlé.",
  remaining: (n) => `Il reste ${n} suspects.`,
  keyDiff: {
    long: "engagement trop long",
    heavy: "plus lourd que ce que tu cherchais",
    horror: "trop d'horreur pour ce soir",
    light: "trop léger pour l'humeur",
    complex: "demande plus de neurones que prévu",
    slow: "rythme plus lent",
    mainstream: "trop grand public pour la demande",
    generic: "moins en phase avec tes réponses",
    lowRating: "note TMDB basse",
    littleInfo: "peu d'infos sur le titre",
    wrongMood: "ambiance différente de ce que tu cherchais",
  },
  recovered: {
    violenceLevel: "un peu de violence",
    horrorLevel: "quelques frissons",
    emotionalImpact: "des moments intenses",
    complexity: "quelques rebondissements",
    romanceLevel: "une touche romantique",
  },
  matched: {
    mystery: "mystère", comedy: "comédie", emotional: "émouvant", fast: "rythme rapide",
    cerebral: "cérébral", horror: "horreur", comfort: "réconfort",
  },
  mood: {
    comedy: "Léger et drôle", dark: "Sombre et intense", mystery: "Mystère et suspense",
    emotional: "Émouvant et profond", fast: "Rythme effréné", slow: "Lent et contemplatif", balanced: "Équilibré",
  },
  commitment: {
    movie: (m) => `~${m} min`,
    movieLong: (m) => `~${m} min (toute la soirée)`,
    movieEpic: (m) => `~${m} min (épique)`,
    mini: (eps) => `Mini-série · ~${eps} min/ép`,
    seasons: (s, eps) => `${s} saisons · ~${eps} min/ép`,
    long: (s) => `${s}+ saisons · engagement long`,
  },
  explain: {
    open: (t) => `Ce soir : ${t}.`,
    openBold: (t) => `Choix audacieux : ${t}.`,
    genreYear: (g, y) => (y ? `${g}, de ${y}.` : `${g}.`),
    runtime: (m) => `Il dure ${m} minutes.`,
    seriesShape: (s, e, m) =>
      s <= 1
        ? `Une seule saison${e ? ` de ${e} épisodes` : ""}${m ? ` d'environ ${m} minutes` : ""} : vite terminée.`
        : `${s} saisons${e ? `, ${e} épisodes` : ""}${m ? ` d'environ ${m} minutes` : ""}.`,
    rating: (r) => `Sur TMDB, il a ${r}/10.`,
    lovedSimilar: (a) => `Si tu as adoré ${a}, tu es au bon endroit.`,
    watchlist: "Il était déjà dans ta liste : c'est le moment.",
    answers: (l) => `En phase avec ce que tu as demandé : ${l}.`,
    bold: "Aucun titre ne domine vraiment : les alternatives ci-dessous sont volontairement différentes.",
    discarded: (n) => `J'ai écarté ${n} titres qui ne collaient pas.`,
  },
};

const DE: NerdacoloTexts = {
  oracleLines: [
    "Die Kugel hat zu viele schlechte Thriller gesehen. Ich sortiere sie aus.",
    "Interessant. Dein Sofa will etwas weniger Traumatisches.",
    "Serien mit 12 Staffeln habe ich gestrichen. Heute unterschreiben wir keinen emotionalen Kredit.",
    "Deine Watchlist ist lang, aber heute brauchen wir Präzision.",
    "Ich suche etwas, bei dem du nach 8 Minuten nicht zum Handy greifst.",
    "Die Kugel schlägt Mystery vor, aber ohne Licht-an-Schlafen.",
    "Verstanden: Du willst leiden, aber mit schöner Kameraarbeit.",
    "Der Zweifel wird kleiner…",
    "Ich streiche die bequemen Optionen…",
    "Nur noch wenige Verdächtige. Die Kugel spricht gleich.",
  ],
  opening: "Das Nerdacolo öffnet die Kugel. Ich habe Kandidaten aus Watchlist, TMDB und deinem Geschmack gesammelt.",
  spoken: "Die Kugel hat gesprochen.",
  remaining: (n) => `Noch ${n} Verdächtige.`,
  keyDiff: {
    long: "zu langer Aufwand",
    heavy: "schwerer als gewünscht",
    horror: "zu viel Horror für heute",
    light: "zu leicht für die Stimmung",
    complex: "braucht mehr Hirnzellen als angegeben",
    slow: "langsameres Tempo",
    mainstream: "zu Mainstream für die Anfrage",
    generic: "passt weniger zu deinen Antworten",
    lowRating: "niedrige TMDB-Bewertung",
    littleInfo: "wenig Infos zum Titel",
    wrongMood: "andere Stimmung als gewünscht",
  },
  recovered: {
    violenceLevel: "etwas Gewalt",
    horrorLevel: "ein paar Schauer",
    emotionalImpact: "intensive Momente",
    complexity: "ein paar Wendungen",
    romanceLevel: "eine romantische Note",
  },
  matched: {
    mystery: "Mystery", comedy: "Comedy", emotional: "emotional", fast: "schnelles Tempo",
    cerebral: "anspruchsvoll", horror: "Horror", comfort: "Wohlfühl",
  },
  mood: {
    comedy: "Leicht und lustig", dark: "Düster und intensiv", mystery: "Mystery und Spannung",
    emotional: "Emotional und tiefgründig", fast: "Rasantes Tempo", slow: "Langsam und nachdenklich", balanced: "Ausgewogen",
  },
  commitment: {
    movie: (m) => `~${m} Min.`,
    movieLong: (m) => `~${m} Min. (ganzer Abend)`,
    movieEpic: (m) => `~${m} Min. (episch)`,
    mini: (eps) => `Miniserie · ~${eps} Min./Folge`,
    seasons: (s, eps) => `${s} Staffeln · ~${eps} Min./Folge`,
    long: (s) => `${s}+ Staffeln · langer Aufwand`,
  },
  explain: {
    open: (t) => `Heute Abend: ${t}.`,
    openBold: (t) => `Mutige Wahl: ${t}.`,
    genreYear: (g, y) => (y ? `${g}, aus ${y}.` : `${g}.`),
    runtime: (m) => `Dauert ${m} Minuten.`,
    seriesShape: (s, e, m) =>
      s <= 1
        ? `Eine einzige Staffel${e ? ` mit ${e} Folgen` : ""}${m ? ` à ~${m} Minuten` : ""}: schnell durch.`
        : `${s} Staffeln${e ? `, ${e} Folgen` : ""}${m ? ` à ~${m} Minuten` : ""}.`,
    rating: (r) => `Auf TMDB hat er ${r}/10.`,
    lovedSimilar: (a) => `Wenn du ${a} geliebt hast, bist du hier richtig.`,
    watchlist: "Stand schon auf deiner Watchlist: jetzt ist der Moment.",
    answers: (l) => `Passt zu dem, was du wolltest: ${l}.`,
    bold: "Kein Titel dominiert wirklich: Die Alternativen unten sind bewusst unterschiedlich.",
    discarded: (n) => `Ich habe ${n} unpassende Titel aussortiert.`,
  },
};

const ALL: Record<Locale, NerdacoloTexts> = { it: IT, en: EN, es: ES, fr: FR, de: DE };

export function ncTexts(lang: Locale | undefined): NerdacoloTexts {
  return ALL[lang ?? "it"] ?? IT;
}

/** Ragioni/penalità interne (chiavi italiane del motore) → testo localizzato. */
export function localizedPenalty(raw: string, lang: Locale): string | null {
  const k = ncTexts(lang).keyDiff;
  if (raw === "voto TMDB basso") return k.lowRating;
  if (raw === "poche info") return k.littleInfo;
  if (raw === "mood sbagliato") return k.wrongMood;
  return null;
}
