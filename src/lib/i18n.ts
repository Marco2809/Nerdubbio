export {
  LOCALES,
  LOCALE_LABELS,
  normalizeLocale,
  quizLocale,
  localeToBcp47,
  type Locale,
} from "./i18n/types";
export { I18nContext, I18nProvider, useI18n, useStatusLabel, translate, catalogs } from "./i18n/context";
export type { TranslateVars } from "./i18n/context";
