import { useCallback } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";

export type AppNavState = {
  from?: string;
  __TSR_index?: number;
};

/** Path corrente da passare come `state.from` ai link figli. */
export function useReturnPath(): string {
  const { pathname, searchStr } = useLocation();
  return `${pathname}${searchStr}`;
}

export function useNavState(): AppNavState {
  return (useLocation().state ?? {}) as AppNavState;
}

/** Indietro affidabile su iPhone/PWA: se c'è cronologia interna torna indietro
 *  davvero (pop), altrimenti usa `from`, infine il fallback. */
export function useSmartBack(fallback = "/app") {
  const router = useRouter();
  const navState = useNavState();

  return useCallback(() => {
    // Se siamo arrivati qui navigando dentro l'app, facciamo un vero "back"
    // (pop dello storico). Ri-navigare verso `from` impilerebbe un doppione
    // della pagina precedente, causando rimbalzi al successivo indietro.
    const idx =
      navState.__TSR_index ??
      (router.history.location.state as AppNavState | undefined)?.__TSR_index;
    if (typeof idx === "number" && idx > 0) {
      router.history.back();
      return;
    }

    // Nessuna cronologia (deep-link / avvio PWA a freddo): vai alla pagina di
    // provenienza nota — con replace, così non resta un doppione dietro.
    const from = navState.from;
    if (from && from.startsWith("/") && !from.startsWith("//")) {
      router.navigate({ to: from as "/", replace: true });
      return;
    }

    router.navigate({ to: fallback as "/", replace: true });
  }, [router, navState.from, navState.__TSR_index, fallback]);
}
