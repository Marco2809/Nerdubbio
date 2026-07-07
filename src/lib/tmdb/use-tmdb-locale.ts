import { useUserStore } from "@/lib/user-store";
import { localeToBcp47, normalizeLocale } from "@/lib/i18n";

/**
 * Locale TMDB (bcp47, es. "it-IT") derivato dalla lingua dell'utente.
 * Va passato alle server function TMDB e incluso nella queryKey così la
 * cache si rigenera quando l'utente cambia lingua.
 */
export function useTmdbLocale(): string {
  const { state } = useUserStore();
  return localeToBcp47(normalizeLocale(state.language));
}
