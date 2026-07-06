import { normalizeLocale, translate, type Locale } from "@/lib/i18n";

const LOCALE_KEY = "nb_locale";

export function getApiLocale(): Locale {
  if (typeof window === "undefined") return "it";
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored) return normalizeLocale(stored);
  return normalizeLocale(navigator.language.slice(0, 2));
}

export function setApiLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALE_KEY, normalizeLocale(locale));
}

type ApiErrorPayload = {
  error?: string;
  errorVars?: Record<string, string | number>;
};

export function formatApiError(code: string, vars?: Record<string, string | number>): string {
  const key = `apiErrors.${code}`;
  const translated = translate(getApiLocale(), key, vars);
  if (translated !== key) return translated;
  // Legacy: messaggio italiano testuale dal server pre-refactor
  if (/[àèéìòù]/i.test(code) || /\s/.test(code)) return code;
  return code.replace(/_/g, " ");
}

export function parseApiErrorBody(body: unknown): { code: string; vars?: Record<string, string | number> } {
  const b = body as ApiErrorPayload;
  const code = b?.error ?? "unknown";
  const vars = b?.errorVars && typeof b.errorVars === "object" ? b.errorVars : undefined;
  return { code, vars };
}
