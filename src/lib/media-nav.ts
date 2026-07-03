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

/** Indietro affidabile su iPhone/PWA: usa `from`, poi history TSR, poi fallback. */
export function useSmartBack(fallback = "/app") {
  const router = useRouter();
  const navState = useNavState();

  return useCallback(() => {
    const from = navState.from;
    if (from && from.startsWith("/") && !from.startsWith("//")) {
      router.navigate({ to: from as "/" });
      return;
    }

    const idx =
      navState.__TSR_index ??
      (router.history.location.state as AppNavState | undefined)?.__TSR_index;

    if (typeof idx === "number" && idx > 0) {
      router.history.back();
      return;
    }

    router.navigate({ to: fallback as "/" });
  }, [router, navState.from, navState.__TSR_index, fallback]);
}
