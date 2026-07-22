import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Passiamo il percorso di ritorno via history state (Link state={{ from }}).
declare module "@tanstack/react-router" {
  interface HistoryState {
    from?: string;
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // I dati (TMDB, libreria) non cambiano di secondo in secondo: teniamoli
        // "freschi" 1 min e in cache 30, così navigare avanti/indietro non
        // rispara le stesse fetch. Niente refetch al rientro nell'app (PWA
        // mobile): era la causa principale della lentezza percepita.
        staleTime: 60_000,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
