export {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_FLAGS,
  LOCALE_NAMES,
  normalizeLocale,
  quizLocale,
  localeToBcp47,
  type Locale,
} from "./i18n/types";
export { I18nContext, I18nProvider, useI18n, useStatusLabel, translate, catalogs } from "./i18n/context";
export type { TranslateVars } from "./i18n/context";
export { pageTitle } from "./i18n/page-title";
export { useDocumentTitle } from "./i18n/use-document-title";
