import { useEffect } from "react";
import { useI18n } from "./context";

/** Aggiorna document.title lato client quando cambia lingua o titolo. */
export function useDocumentTitle(title?: string) {
  const { t, locale } = useI18n();
  useEffect(() => {
    if (!title) return;
    document.title = `${title} — ${t("brand.name")}`;
  }, [title, locale, t]);
}
