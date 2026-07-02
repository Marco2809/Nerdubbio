import { createContext, useContext } from "react";

export type Locale = "it" | "en";

const dict: Record<string, Record<Locale, string>> = {
  home: { it: "Home", en: "Home" },
  search: { it: "Cerca", en: "Search" },
  doubt: { it: "Il Dubbio", en: "The Doubt" },
  watchlist: { it: "Watchlist", en: "Watchlist" },
  profile: { it: "Profilo", en: "Profile" },
  havedoubt: { it: "Ho un dubbio nerd: cosa guardo?", en: "I have a nerd doubt: what should I watch?" },
};

export const LocaleContext = createContext<Locale>("it");
export function useT() {
  const l = useContext(LocaleContext);
  return (k: keyof typeof dict) => dict[k]?.[l] ?? String(k);
}
