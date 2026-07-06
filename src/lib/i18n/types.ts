export const LOCALES = ["it", "en", "es", "fr", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  it: "🇮🇹 Italiano",
  en: "🇬🇧 English",
  es: "🇪🇸 Español",
  fr: "🇫🇷 Français",
  de: "🇩🇪 Deutsch",
};

/** Solo bandiera + nome breve, per selettori compatti a icone. */
export const LOCALE_FLAGS: Record<Locale, string> = {
  it: "🇮🇹",
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
};

export const LOCALE_NAMES: Record<Locale, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export function normalizeLocale(value?: string | null): Locale {
  if (value && (LOCALES as readonly string[]).includes(value)) return value as Locale;
  return "it";
}

/** Lingua quiz Nerdacolo — tutte e 5 le locale supportate. */
export function quizLocale(locale: Locale): Locale {
  return normalizeLocale(locale);
}

export function localeToBcp47(locale: Locale): string {
  const map: Record<Locale, string> = {
    it: "it-IT",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
  };
  return map[locale];
}

export type MessageCatalog = typeof import("./catalog.it").default;