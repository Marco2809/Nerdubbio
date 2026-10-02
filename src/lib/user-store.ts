import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/php/client';
import type { TvTimePendingItem } from '@/lib/tvtime-import';
import {
  libraryApi,
  LIBRARY_QUERY_KEY,
  type LibraryState,
  type LibraryEpisodePatch,
} from '@/lib/php/library-client';
import { NEXT_UNWATCHED_BATCH_KEY } from '@/lib/next-episode';

export type UserStatus = 'watching' | 'completed' | 'plan_to_watch' | 'paused' | 'dropped' | 'favorite';

export interface UserMediaEntry {
  id: string;
  status: UserStatus;
  /** Preferito: flag indipendente dallo stato (una serie vista può essere anche preferita). */
  favorite?: boolean;
  rating?: number;
  currentSeason?: number;
  currentEpisode?: number;
  watchedEpisodes?: string[];
  /** Data visione per episodio (ISO), chiave S1E3. */
  episodeDates?: Record<string, string>;
  /** Numero visioni per episodio, chiave S1E3. */
  episodeWatchCounts?: Record<string, number>;
  /** Visioni totali per film. */
  watchCount?: number;
  reactions?: Record<string, string>;
  notes?: string;
  addedAt: string;
  /** Ultimo aggiornamento (es. cambio stato in Da vedere). */
  updatedAt?: string;
  lastWatchedAt?: string;
  source?: 'manual' | 'tvtime' | 'trakt' | 'status_sync';
  title?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  type?: 'movie' | 'tv';
  year?: number;
}

export type MediaMeta = Pick<UserMediaEntry, 'title' | 'posterUrl' | 'backdropUrl' | 'type' | 'year'>;

const initial: LibraryState = {
  xp: 0,
  level: 1,
  streak: 0,
  media: {},
  dismissed: [],
  achievements: [],
  onboardingDone: false,
  language: 'it',
  favoriteGenres: [],
  upcomingFilters: { newSeries: true, seasonPremieres: true, includeMovies: true },
  localMigrated: false,
  importPending: [],
};

/** Fonde una risposta leggera (singolo titolo + stat) nella cache della libreria. */
export function mergeLibraryPatch(queryClient: QueryClient, patch: LibraryEpisodePatch): LibraryState {
  queryClient.setQueryData<LibraryState>(LIBRARY_QUERY_KEY, old => {
    const base = old ?? initial;
    const media = { ...base.media };
    if (patch.entry) media[patch.mediaKey] = patch.entry;
    else delete media[patch.mediaKey];
    return {
      ...base,
      media,
      xp: patch.xp,
      level: patch.level,
      streak: patch.streak,
      lastActiveDay: patch.lastActiveDay,
    };
  });
  return queryClient.getQueryData<LibraryState>(LIBRARY_QUERY_KEY) ?? initial;
}

export function useUserStore() {
  const queryClient = useQueryClient();
  const enabled = typeof window !== 'undefined' && !!getToken();

  const { data: state = initial, isLoading, isFetching } = useQuery({
    queryKey: LIBRARY_QUERY_KEY,
    queryFn: () => libraryApi.get(),
    enabled,
    staleTime: 15_000,
  });

  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());

  const apply = useCallback(
    async (fn: () => Promise<LibraryState>) => {
      const run = mutationQueue.current
        .catch(() => undefined)
        .then(fn)
        .then(next => {
          queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
          return next;
        });
      mutationQueue.current = run.catch(() => undefined);
      return run;
    },
    [queryClient],
  );

  // Come apply(), ma per le risposte LEGGERE (azioni su un singolo titolo):
  // fonde la singola entry nella cache invece di sostituire l'intera libreria
  // (che su account grandi pesa MB a ogni azione). Ritorna lo stato completo.
  const applyEpisodePatch = useCallback(
    async (fn: () => Promise<LibraryEpisodePatch>) => {
      const run = mutationQueue.current
        .catch(() => undefined)
        .then(fn)
        .then(patch => mergeLibraryPatch(queryClient, patch));
      mutationQueue.current = run.catch(() => undefined);
      return run;
    },
    [queryClient],
  );

  const update = useCallback(
    (patch: Partial<LibraryState> | ((s: LibraryState) => LibraryState)) => {
      // Invia SOLO i campi cambiati: prima partiva l'intero stato (libreria
      // compresa, MB) e il server risalvava anche xp/level/streak presi dalla
      // cache del client, che se vecchia riportava indietro gli XP.
      let payload: Partial<LibraryState>;
      if (typeof patch === 'function') {
        const next = patch(state);
        payload = {};
        for (const k of Object.keys(next) as (keyof LibraryState)[]) {
          if (k === 'media') continue;
          if (next[k] !== state[k]) (payload as Record<string, unknown>)[k] = next[k];
        }
      } else {
        const { media: _media, ...rest } = patch;
        payload = rest;
      }
      void apply(() => libraryApi.patchSettings(payload));
    },
    [apply, state],
  );

  const addToList = useCallback(
    (id: string, status: UserStatus, meta?: MediaMeta) =>
      applyEpisodePatch(() => libraryApi.addToList(id, status, meta)),
    [applyEpisodePatch],
  );

  const setStatus = useCallback(
    (id: string, status: UserStatus, meta?: MediaMeta) =>
      applyEpisodePatch(() => libraryApi.setStatus(id, status, meta)),
    [applyEpisodePatch],
  );

  const setFavorite = useCallback(
    (id: string, favorite: boolean, meta?: MediaMeta) =>
      applyEpisodePatch(() => libraryApi.setFavorite(id, favorite, meta)),
    [applyEpisodePatch],
  );

  const dismiss = useCallback(
    (id: string) => {
      void apply(() => libraryApi.dismiss(id));
    },
    [apply],
  );

  const removeFromList = useCallback(
    (id: string) => {
      void applyEpisodePatch(() => libraryApi.removeFromList(id));
    },
    [applyEpisodePatch],
  );

  const toggleEpisode = useCallback(
    (
      id: string,
      season: number,
      episode: number,
      episodesPerSeason: number,
      totalSeasons: number,
      meta?: MediaMeta,
      opts?: { unwatch?: boolean },
    ) =>
      applyEpisodePatch(() =>
        libraryApi.toggleEpisode(id, season, episode, episodesPerSeason, totalSeasons, meta, opts),
      ).then(next => {
        queryClient.invalidateQueries({ queryKey: NEXT_UNWATCHED_BATCH_KEY });
        return next;
      }),
    [applyEpisodePatch, queryClient],
  );

  const unwatchEpisode = useCallback(
    (
      id: string,
      season: number,
      episode: number,
      episodesPerSeason: number,
      totalSeasons: number,
      meta?: MediaMeta,
    ) =>
      applyEpisodePatch(() =>
        libraryApi.toggleEpisode(id, season, episode, episodesPerSeason, totalSeasons, meta, { unwatch: true }),
      ).then(next => {
        queryClient.invalidateQueries({ queryKey: NEXT_UNWATCHED_BATCH_KEY });
        return next;
      }),
    [applyEpisodePatch, queryClient],
  );

  const logMovieWatch = useCallback(
    (id: string, meta?: MediaMeta) => {
      void applyEpisodePatch(() => libraryApi.logMovieWatch(id, meta));
    },
    [applyEpisodePatch],
  );

  const markAllSeriesWatched = useCallback(
    (
      id: string,
      seasons: { seasonNumber: number; episodeCount: number; airDate?: string | null }[],
      opts: { onlyAired?: boolean; meta?: MediaMeta; complete?: boolean } = {},
    ) =>
      applyEpisodePatch(() => libraryApi.markAllSeriesWatched(id, seasons, opts)).then((next) => {
        queryClient.invalidateQueries({ queryKey: NEXT_UNWATCHED_BATCH_KEY });
        return next;
      }),
    [applyEpisodePatch, queryClient],
  );

  const clearWatchedEpisodes = useCallback(
    (id: string, restoreStatus?: UserStatus) => {
      void applyEpisodePatch(() => libraryApi.clearWatchedEpisodes(id, restoreStatus)).then(() => {
        queryClient.invalidateQueries({ queryKey: NEXT_UNWATCHED_BATCH_KEY });
      });
    },
    [applyEpisodePatch, queryClient],
  );

  const setRating = useCallback(
    (id: string, rating: number | undefined) => {
      void applyEpisodePatch(() => libraryApi.setRating(id, rating));
    },
    [applyEpisodePatch],
  );

  const setReaction = useCallback(
    (id: string, season: number, episode: number, emoji: string | null) => {
      void applyEpisodePatch(() => libraryApi.setReaction(id, season, episode, emoji));
    },
    [applyEpisodePatch],
  );

  const bulkImport = useCallback(
    (entries: UserMediaEntry[], importPending?: TvTimePendingItem[]) => {
      void apply(() => libraryApi.bulkImport(entries, importPending));
    },
    [apply],
  );

  return {
    state,
    loading: isLoading || isFetching,
    update,
    addToList,
    setStatus,
    setFavorite,
    removeFromList,
    dismiss,
    toggleEpisode,
    unwatchEpisode,
    logMovieWatch,
    setRating,
    setReaction,
    bulkImport,
    markAllSeriesWatched,
    clearWatchedEpisodes,
    refresh: () => queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY }),
    importLocal: (local: LibraryState) => apply(() => libraryApi.importLocal(local)),
    skipLocalMigration: () => apply(() => libraryApi.skipLocalMigration()),
  };
}

export function isEpisodeWatched(entry: UserMediaEntry | undefined, season: number, episode: number) {
  return !!entry?.watchedEpisodes?.includes(`S${season}E${episode}`);
}

export function getEpisodeWatchCount(entry: UserMediaEntry | undefined, season: number, episode: number): number {
  const key = `S${season}E${episode}`;
  if (entry?.episodeWatchCounts?.[key]) return entry.episodeWatchCounts[key];
  return isEpisodeWatched(entry, season, episode) ? 1 : 0;
}

export function totalEpisodeWatches(entry: UserMediaEntry | undefined): number {
  if (!entry?.watchedEpisodes?.length) return 0;
  return entry.watchedEpisodes.reduce((n, k) => n + (entry.episodeWatchCounts?.[k] ?? 1), 0);
}

export function computeStats(state: LibraryState) {
  const list = Object.values(state.media);
  const inferType = (m: UserMediaEntry): 'movie' | 'tv' =>
    m.type ?? (m.id.startsWith('movie-') ? 'movie' : 'tv');
  const watching = list.filter(m => m.status === 'watching').length;
  const completed = list.filter(m => m.status === 'completed').length;
  // "Abbandonato" è comunque contenuto visto: rientra nel conteggio dei visti
  // e degli episodi, cambia solo che non ne guarderò altri.
  const watched = list.filter(m => m.status === 'completed' || m.status === 'dropped').length;
  const planned = list.filter(m => m.status === 'plan_to_watch').length;
  const favorites = list.filter(m => m.favorite).length;
  // Serie/film in libreria includono gli abbandonati (fanno parte della cronologia).
  const series = list.filter(m => inferType(m) === 'tv').length;
  const movies = list.filter(m => inferType(m) === 'movie').length;
  let movieWatches = 0;
  const episodes = list.reduce((n, m) => {
    if (inferType(m) === 'movie') {
      const wc = m.watchCount ?? (m.status === 'completed' || m.status === 'dropped' ? 1 : 0);
      movieWatches += wc;
      return n + wc;
    }
    return n + (m.watchedEpisodes?.reduce((s, k) => s + (m.episodeWatchCounts?.[k] ?? 1), 0) ?? 0);
  }, 0);
  const hours = Math.round((episodes * 45 + movieWatches * 110) / 60);
  return { watching, completed, watched, planned, favorites, series, movies, episodes, hours, total: list.length };
}
