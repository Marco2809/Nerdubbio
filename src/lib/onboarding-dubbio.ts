import type { Locale } from "@/lib/i18n/types";

export type OnboardingDubbioChoice = { label: string; emoji: string; moods: string[] };
export type OnboardingDubbioQuestion = { id: string; q: string; sub: string; choices: OnboardingDubbioChoice[] };

const DUBBIO: Record<Locale, OnboardingDubbioQuestion[]> = {
  it: [
    {
      id: "tone",
      q: "Stasera vuoi ridere, piangere o sospettare di tutti?",
      sub: "Nessuna risposta sbagliata. Ci giudichiamo tutti a vicenda.",
      choices: [
        { label: "Ridere fino alle lacrime", emoji: "😂", moods: ["funny", "cozy"] },
        { label: "Piangere in modo elegante", emoji: "😭", moods: ["sad", "romantic"] },
        { label: "Sospettare di tutti", emoji: "🕵️", moods: ["thriller", "mind-bending"] },
        { label: "Sentirmi epico", emoji: "⚔️", moods: ["epic", "action"] },
      ],
    },
    {
      id: "brain",
      q: "Quanto cervello vuoi usare?",
      sub: "Nerdacolo ti giudica ma non ti abbandona.",
      choices: [
        { label: "Zero. Coperta e patatine.", emoji: "🛋️", moods: ["cozy", "funny"] },
        { label: "Il giusto per non annoiarmi", emoji: "🧠", moods: ["slow-burn"] },
        { label: "Voglio una crisi esistenziale", emoji: "🌀", moods: ["mind-bending", "dark"] },
      ],
    },
    {
      id: "length",
      q: "Impegno richiesto?",
      sub: "Serve saperlo prima, poi è tardi.",
      choices: [
        { label: "Chiuso in una serata", emoji: "⏱️", moods: ["short"] },
        { label: "Una mini-serie, 6-10 ore", emoji: "📺", moods: ["short", "binge"] },
        { label: "Vita nuova, 7 stagioni", emoji: "♾️", moods: ["binge", "epic"] },
      ],
    },
  ],
  en: [
    {
      id: "tone",
      q: "Tonight: laugh, cry, or suspect everyone?",
      sub: "No wrong answers. We judge each other affectionately.",
      choices: [
        { label: "Laugh until I cry", emoji: "😂", moods: ["funny", "cozy"] },
        { label: "Cry elegantly", emoji: "😭", moods: ["sad", "romantic"] },
        { label: "Suspect everyone", emoji: "🕵️", moods: ["thriller", "mind-bending"] },
        { label: "Feel epic", emoji: "⚔️", moods: ["epic", "action"] },
      ],
    },
    {
      id: "brain",
      q: "How much brain power?",
      sub: "Nerdacolo judges but won't abandon you.",
      choices: [
        { label: "Zero. Blanket and snacks.", emoji: "🛋️", moods: ["cozy", "funny"] },
        { label: "Just enough not to get bored", emoji: "🧠", moods: ["slow-burn"] },
        { label: "I want an existential crisis", emoji: "🌀", moods: ["mind-bending", "dark"] },
      ],
    },
    {
      id: "length",
      q: "Commitment level?",
      sub: "Good to know upfront. Later it's too late.",
      choices: [
        { label: "One evening, done", emoji: "⏱️", moods: ["short"] },
        { label: "Mini-series, 6-10 hours", emoji: "📺", moods: ["short", "binge"] },
        { label: "New life, 7 seasons", emoji: "♾️", moods: ["binge", "epic"] },
      ],
    },
  ],
  es: [
    {
      id: "tone",
      q: "¿Esta noche: reír, llorar o desconfiar de todos?",
      sub: "No hay respuestas incorrectas. Nos juzgamos con cariño.",
      choices: [
        { label: "Reír hasta llorar", emoji: "😂", moods: ["funny", "cozy"] },
        { label: "Llorar con elegancia", emoji: "😭", moods: ["sad", "romantic"] },
        { label: "Desconfiar de todos", emoji: "🕵️", moods: ["thriller", "mind-bending"] },
        { label: "Sentirme épico", emoji: "⚔️", moods: ["epic", "action"] },
      ],
    },
    {
      id: "brain",
      q: "¿Cuánto cerebro quieres usar?",
      sub: "Nerdacolo te juzga pero no te abandona.",
      choices: [
        { label: "Cero. Manta y patatas.", emoji: "🛋️", moods: ["cozy", "funny"] },
        { label: "Lo justo para no aburrirme", emoji: "🧠", moods: ["slow-burn"] },
        { label: "Quiero una crisis existencial", emoji: "🌀", moods: ["mind-bending", "dark"] },
      ],
    },
    {
      id: "length",
      q: "¿Nivel de compromiso?",
      sub: "Mejor saberlo antes. Después es tarde.",
      choices: [
        { label: "Una noche y listo", emoji: "⏱️", moods: ["short"] },
        { label: "Mini-serie, 6-10 horas", emoji: "📺", moods: ["short", "binge"] },
        { label: "Vida nueva, 7 temporadas", emoji: "♾️", moods: ["binge", "epic"] },
      ],
    },
  ],
  fr: [
    {
      id: "tone",
      q: "Ce soir : rire, pleurer ou se méfier de tout le monde ?",
      sub: "Pas de mauvaise réponse. On se juge avec tendresse.",
      choices: [
        { label: "Rire aux larmes", emoji: "😂", moods: ["funny", "cozy"] },
        { label: "Pleurer avec élégance", emoji: "😭", moods: ["sad", "romantic"] },
        { label: "Se méfier de tous", emoji: "🕵️", moods: ["thriller", "mind-bending"] },
        { label: "Me sentir épique", emoji: "⚔️", moods: ["epic", "action"] },
      ],
    },
    {
      id: "brain",
      q: "Combien de cerveau ?",
      sub: "Nerdacolo juge mais ne vous abandonne pas.",
      choices: [
        { label: "Zéro. Couverture et chips.", emoji: "🛋️", moods: ["cozy", "funny"] },
        { label: "Juste assez pour ne pas m'ennuyer", emoji: "🧠", moods: ["slow-burn"] },
        { label: "Je veux une crise existentielle", emoji: "🌀", moods: ["mind-bending", "dark"] },
      ],
    },
    {
      id: "length",
      q: "Niveau d'engagement ?",
      sub: "Mieux vaut le savoir avant. Après c'est trop tard.",
      choices: [
        { label: "Une soirée, terminé", emoji: "⏱️", moods: ["short"] },
        { label: "Mini-série, 6-10 h", emoji: "📺", moods: ["short", "binge"] },
        { label: "Nouvelle vie, 7 saisons", emoji: "♾️", moods: ["binge", "epic"] },
      ],
    },
  ],
  de: [
    {
      id: "tone",
      q: "Heute Abend: lachen, weinen oder allen misstrauen?",
      sub: "Keine falschen Antworten. Wir bewerten uns freundlich.",
      choices: [
        { label: "Lachen bis ich weine", emoji: "😂", moods: ["funny", "cozy"] },
        { label: "Elegant weinen", emoji: "😭", moods: ["sad", "romantic"] },
        { label: "Allen misstrauen", emoji: "🕵️", moods: ["thriller", "mind-bending"] },
        { label: "Episch fühlen", emoji: "⚔️", moods: ["epic", "action"] },
      ],
    },
    {
      id: "brain",
      q: "Wie viel Gehirn?",
      sub: "Nerdacolo urteilt, aber lässt dich nicht im Stich.",
      choices: [
        { label: "Null. Decke und Snacks.", emoji: "🛋️", moods: ["cozy", "funny"] },
        { label: "Gerade genug gegen Langeweile", emoji: "🧠", moods: ["slow-burn"] },
        { label: "Existenzkrise bitte", emoji: "🌀", moods: ["mind-bending", "dark"] },
      ],
    },
    {
      id: "length",
      q: "Wie viel Aufwand?",
      sub: "Besser vorher wissen. Danach ist es zu spät.",
      choices: [
        { label: "Ein Abend, fertig", emoji: "⏱️", moods: ["short"] },
        { label: "Mini-Serie, 6-10 Stunden", emoji: "📺", moods: ["short", "binge"] },
        { label: "Neues Leben, 7 Staffeln", emoji: "♾️", moods: ["binge", "epic"] },
      ],
    },
  ],
};

export function getOnboardingDubbio(locale: Locale): OnboardingDubbioQuestion[] {
  return DUBBIO[locale] ?? DUBBIO.it;
}
