import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/php/client';
import type { TvTimePendingItem } from '@/lib/tvtime-import';
import {
  libraryApi,
  LIBRARY_QUERY_KEY,
  type LibraryState,
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

export function useUserStore() {
  const queryClient = useQueryClient();
  const enabled = typeof window !== 'undefined' && !!getToken();

  const { data: state = initial, isLoading, isFetching } = useQuery({
    queryKey: LIBRARY_QUERY_KEY,
    queryFn: () => libraryApi.get(),
    enabled,
    staleTime: 15_000,
  });

  const mutationQueue = useRef(Promise.resolve());

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

  const update = useCallback(
    (patch: Partial<LibraryState> | ((s: LibraryState) => LibraryState)) => {
      const payload = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      void apply(() => libraryApi.patchSettings(payload));
    },
    [apply, state],
  );

  const addToList = useCallback(
    (id: string, status: UserStatus, meta?: MediaMeta) =>
      apply(() => libraryApi.addToList(id, status, meta)),
    [apply],
  );

  const setStatus = useCallback(
    (id: string, status: UserStatus, meta?: MediaMeta) =>
      apply(() => libraryApi.setStatus(id, status, meta)),
    [apply],
  );

  const setFavorite = useCallback(
    (id: string, favorite: boolean, meta?: MediaMeta) =>
      apply(() => libraryApi.setFavorite(id, favorite, meta)),
    [apply],
  );

  const dismiss = useCallback(
    (id: string) => {
      void apply(() => libraryApi.dismiss(id));
    },
    [apply],
  );

  const removeFromList = useCallback(
    (id: string) => {
      void apply(() => libraryApi.removeFromList(id));
    },
    [apply],
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
      apply(() =>
        libraryApi.toggleEpisode(id, season, episode, episodesPerSeason, totalSeasons, meta, opts),
      ).then(next => {
        queryClient.invalidateQueries({ queryKey: NEXT_UNWATCHED_BATCH_KEY });
        return next;
      }),
    [apply, queryClient],
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
      apply(() =>
        libraryApi.toggleEpisode(id, season, episode, episodesPerSeason, totalSeasons, meta, { unwatch: true }),
      ).then(next => {
        queryClient.invalidateQueries({ queryKey: NEXT_UNWATCHED_BATCH_KEY });
        return next;
      }),
    [apply, queryClient],
  );

  const logMovieWatch = useCallback(
    (id: string, meta?: MediaMeta) => {
      void apply(() => libraryApi.logMovieWatch(id, meta));
    },
    [apply],
  );

  const markAllSeriesWatched = useCallback(
    (
      id: string,
      seasons: { seasonNumber: number; episodeCount: number; airDate?: string | null }[],
      opts: { onlyAired?: boolean; meta?: MediaMeta } = {},
    ) => {
      void apply(() => libraryApi.markAllSeriesWatched(id, seasons, opts)).then(() => {
        queryClient.invalidateQueries({ queryKey: NEXT_UNWATCHED_BATCH_KEY });
      });
    },
    [apply, queryClient],
  );

  const clearWatchedEpisodes = useCallback(
    (id: string, restoreStatus?: UserStatus) => {
      void apply(() => libraryApi.clearWatchedEpisodes(id, restoreStatus)).then(() => {
        queryClient.invalidateQueries({ queryKey: NEXT_UNWATCHED_BATCH_KEY });
      });
    },
    [apply, queryClient],
  );

  const setRating = useCallback(
    (id: string, rating: number | undefined) => {
      void apply(() => libraryApi.setRating(id, rating));
    },
    [apply],
  );

  const setReaction = useCallback(
    (id: string, season: number, episode: number, emoji: string | null) => {
      void apply(() => libraryApi.setReaction(id, season, episode, emoji));
    },
    [apply],
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
  const active = list.filter(m => m.status !== 'dropped');
  const inferType = (m: UserMediaEntry): 'movie' | 'tv' =>
    m.type ?? (m.id.startsWith('movie-') ? 'movie' : 'tv');
  const watching = list.filter(m => m.status === 'watching').length;
  const completed = list.filter(m => m.status === 'completed').length;
  const planned = list.filter(m => m.status === 'plan_to_watch').length;
  const favorites = list.filter(m => m.favorite).length;
  const series = active.filter(m => inferType(m) === 'tv').length;
  const movies = active.filter(m => inferType(m) === 'movie').length;
  const episodes = list.reduce((n, m) => {
    if (inferType(m) === 'movie') {
      const wc = m.watchCount ?? (m.status === 'completed' ? 1 : 0);
      return n + wc;
    }
    return n + (m.watchedEpisodes?.reduce((s, k) => s + (m.episodeWatchCounts?.[k] ?? 1), 0) ?? 0);
  }, 0);
  const completedMovies = active.filter(m => inferType(m) === 'movie' && m.status === 'completed').length;
  const hours = Math.round((episodes * 45 + completedMovies * 110) / 60);
  return { watching, completed, planned, favorites, series, movies, episodes, hours, total: list.length };
}
