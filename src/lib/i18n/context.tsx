import { createContext, useContext, useMemo, type ReactNode } from "react";
import catalogDe from "./catalog.de";
import catalogEn from "./catalog.en";
import catalogEs from "./catalog.es";
import catalogFr from "./catalog.fr";
import catalogIt from "./catalog.it";
import type { Locale } from "./types";
import { normalizeLocale } from "./types";

const catalogs = {
  it: catalogIt,
  en: catalogEn,
  es: catalogEs,
  fr: catalogFr,
  de: catalogDe,
} as const;

export type TranslateVars = Record<string, string | number>;

function lookup(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  vars?: TranslateVars,
): string {
  const raw = lookup(catalogs[locale], key) ?? lookup(catalogs.it, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ""));
}

type I18nContextValue = {
  locale: Locale;
  t: (key: string, vars?: TranslateVars) => string;
};

export const I18nContext = createContext<I18nContextValue>({
  locale: "it",
  t: (key, vars) => translate("it", key, vars),
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      locale: normalizeLocale(locale),
      t: (key: string, vars?: TranslateVars) => translate(normalizeLocale(locale), key, vars),
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Etichetta stato libreria localizzata. */
export function useStatusLabel(status: string | undefined): string {
  const { t } = useI18n();
  if (!status) return t("status.notInLibrary");
  const key = `status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export { catalogs };
