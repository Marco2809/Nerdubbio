import { api } from '@/lib/php/client';

export type CommentScope = 'all' | 'friends';

export interface MediaCommentAuthor {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url?: string | null;
}

export interface MediaComment {
  id: string;
  body: string;
  spoiler: boolean;
  created_at: string;
  is_mine: boolean;
  author: MediaCommentAuthor;
  author_status: string | null;
  author_rating: number | null;
}

export interface CommentsListResult {
  comments: MediaComment[];
  total: number;
  has_more: boolean;
}

export function mediaCommentsKey(
  type: 'tv' | 'movie',
  tmdbId: number,
  scope: CommentScope,
) {
  return ['media-comments', type, tmdbId, scope] as const;
}

export const commentsApi = {
  list(
    type: 'tv' | 'movie',
    tmdbId: number,
    scope: CommentScope = 'all',
    offset = 0,
  ): Promise<CommentsListResult> {
    const q = new URLSearchParams({
      action: 'list',
      type,
      tmdb_id: String(tmdbId),
      scope,
      offset: String(offset),
    });
    return api<CommentsListResult>(`/api/comments.php?${q}`);
  },

  create(
    type: 'tv' | 'movie',
    tmdbId: number,
    body: string,
    spoiler = false,
  ): Promise<{ comment: MediaComment }> {
    return api<{ comment: MediaComment }>('/api/comments.php?action=create', 'POST', {
      type,
      tmdb_id: tmdbId,
      body,
      spoiler,
    });
  },

  delete(id: string): Promise<{ ok: boolean }> {
    return api<{ ok: boolean }>('/api/comments.php?action=delete', 'POST', { id });
  },
};
