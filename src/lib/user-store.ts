import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/php/client';
import type { TvTimePendingItem } from '@/lib/tvtime-import';
import {
  libraryApi,
  LIBRARY_QUERY_KEY,
  type LibraryState,
} from '@/lib/php/library-client';

export type UserStatus = 'watching' | 'completed' | 'plan_to_watch' | 'paused' | 'dropped' | 'favorite';

export interface UserMediaEntry {
  id: string;
  status: UserStatus;
  rating?: number;
  currentSeason?: number;
  currentEpisode?: number;
  watchedEpisodes?: string[];
  /** Date visione per episodio (import TV Time), chiave S1E3. */
  episodeDates?: Record<string, string>;
  reactions?: Record<string, string>;
  notes?: string;
  addedAt: string;
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

  const apply = useCallback(
    async (fn: () => Promise<LibraryState>) => {
      const next = await fn();
      queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
      return next;
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
    (id: string, status: UserStatus, meta?: MediaMeta) => {
      void apply(() => libraryApi.addToList(id, status, meta));
    },
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
    ) => {
      void apply(() =>
        libraryApi.toggleEpisode(id, season, episode, episodesPerSeason, totalSeasons),
      );
    },
    [apply],
  );

  const markAllSeriesWatched = useCallback(
    (
      id: string,
      seasons: { seasonNumber: number; episodeCount: number; airDate?: string | null }[],
      opts: { onlyAired?: boolean; meta?: MediaMeta } = {},
    ) => {
      void apply(() => libraryApi.markAllSeriesWatched(id, seasons, opts));
    },
    [apply],
  );

  const clearWatchedEpisodes = useCallback(
    (id: string, restoreStatus?: UserStatus) => {
      void apply(() => libraryApi.clearWatchedEpisodes(id, restoreStatus));
    },
    [apply],
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
    removeFromList,
    dismiss,
    toggleEpisode,
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

export function computeStats(state: LibraryState) {
  const list = Object.values(state.media);
  const active = list.filter(m => m.status !== 'dropped');
  const inferType = (m: UserMediaEntry): 'movie' | 'tv' =>
    m.type ?? (m.id.startsWith('movie-') ? 'movie' : 'tv');
  const watching = list.filter(m => m.status === 'watching').length;
  const completed = list.filter(m => m.status === 'completed').length;
  const planned = list.filter(m => m.status === 'plan_to_watch').length;
  const favorites = list.filter(m => m.status === 'favorite').length;
  const series = active.filter(m => inferType(m) === 'tv').length;
  const movies = active.filter(m => inferType(m) === 'movie').length;
  const episodes = list.reduce((n, m) => n + (m.watchedEpisodes?.length ?? 0), 0);
  const completedMovies = active.filter(m => inferType(m) === 'movie' && m.status === 'completed').length;
  const hours = Math.round((episodes * 45 + completedMovies * 110) / 60);
  return { watching, completed, planned, favorites, series, movies, episodes, hours, total: list.length };
}
