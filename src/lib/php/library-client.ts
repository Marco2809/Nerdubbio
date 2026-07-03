import { api } from '@/lib/php/client';
import type { MediaMeta, UserMediaEntry, UserStatus } from '@/lib/user-store';
import type { TvTimePendingItem } from '@/lib/tvtime-import';

export interface LibraryState {
  xp: number;
  level: number;
  streak: number;
  lastActiveDay?: string;
  media: Record<string, UserMediaEntry>;
  dismissed: string[];
  achievements: string[];
  onboardingDone: boolean;
  language: 'it' | 'en';
  favoriteGenres: string[];
  moodProfile?: string[];
  upcomingFilters: {
    newSeries: boolean;
    seasonPremieres: boolean;
    includeMovies: boolean;
  };
  localMigrated: boolean;
  importPending: TvTimePendingItem[];
}

export const libraryApi = {
  get(): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=get');
  },

  patchSettings(patch: Partial<LibraryState>): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=patch_settings', 'PATCH', patch);
  },

  addToList(id: string, status: UserStatus, meta?: MediaMeta): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=add_to_list', 'POST', { id, status, meta });
  },

  removeFromList(id: string): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=remove_from_list', 'POST', { id });
  },

  dismiss(id: string): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=dismiss', 'POST', { id });
  },

  toggleEpisode(
    id: string,
    season: number,
    episode: number,
    episodesPerSeason: number,
    totalSeasons: number,
  ): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=toggle_episode', 'POST', {
      id,
      season,
      episode,
      episodesPerSeason,
      totalSeasons,
    });
  },

  markAllSeriesWatched(
    id: string,
    seasons: { seasonNumber: number; episodeCount: number; airDate?: string | null }[],
    opts: { onlyAired?: boolean; meta?: MediaMeta } = {},
  ): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=mark_all_watched', 'POST', {
      id,
      seasons,
      onlyAired: opts.onlyAired ?? false,
      meta: opts.meta,
    });
  },

  clearWatchedEpisodes(id: string, restoreStatus?: UserStatus): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=clear_watched', 'POST', {
      id,
      restoreStatus,
    });
  },

  setRating(id: string, rating: number | undefined): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=set_rating', 'POST', { id, rating });
  },

  setReaction(id: string, season: number, episode: number, emoji: string | null): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=set_reaction', 'POST', {
      id,
      season,
      episode,
      emoji,
    });
  },

  bulkImport(
    entries: UserMediaEntry[],
    importPending?: TvTimePendingItem[],
    opts?: { withXp?: boolean; replaceEpisodes?: boolean },
  ): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=bulk_import', 'POST', {
      entries,
      importPending,
      withXp: opts?.withXp,
      replaceEpisodes: opts?.replaceEpisodes,
    });
  },

  importLocal(localState: LibraryState): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=import_local', 'POST', localState);
  },

  skipLocalMigration(): Promise<LibraryState> {
    return api<LibraryState>('/api/library.php?action=skip_local_migration', 'POST', {});
  },

  getWatchStats(): Promise<WatchStats> {
    return api<WatchStats>('/api/library.php?action=watch_stats');
  },
};

export interface WatchStats {
  totalEpisodes: number;
  hoursEstimate: number;
  byMonth: { month: string; episodes: number }[];
  topShows: { title: string; mediaKey: string; episodes: number }[];
}

export const LIBRARY_QUERY_KEY = ['user-library'] as const;
