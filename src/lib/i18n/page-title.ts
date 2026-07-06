import { translate, type TranslateVars } from "./context";
import { normalizeLocale, type Locale } from "./types";

/** Titolo pagina per head() SSR (default IT). */
export function pageTitle(key: string, locale: Locale = "it", vars?: TranslateVars): string {
  const loc = normalizeLocale(locale);
  const title = translate(loc, `meta.${key}`, vars);
  const brand = translate(loc, "brand.name");
  return `${title} — ${brand}`;
}
