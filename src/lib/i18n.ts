import { createContext, useContext } from "react";

export type Locale = "it" | "en";

const dict: Record<string, Record<Locale, string>> = {
  home: { it: "Home", en: "Home" },
  search: { it: "Cerca", en: "Search" },
  quest: { it: "Main Quest", en: "Main Quest" },
  watchlist: { it: "Watchlist", en: "Watchlist" },
  profile: { it: "Profilo", en: "Profile" },
  havequest: { it: "Main Quest: cosa guardo stasera?", en: "Main quest: what should I watch tonight?" },
};

export const LocaleContext = createContext<Locale>("it");
export function useT() {
  const l = useContext(LocaleContext);
  return (k: keyof typeof dict) => dict[k]?.[l] ?? String(k);
}
