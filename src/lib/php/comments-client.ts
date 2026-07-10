import type { Locale } from '@/lib/i18n';
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
  media_url: string | null;
  spoiler: boolean;
  rating: number | null;
  parent_id: string | null;
  reply_count: number;
  created_at: string;
  is_mine: boolean;
  author: MediaCommentAuthor;
  author_status: string | null;
  author_rating: number | null;
  author_language: Locale;
}

export interface CommentsListResult {
  comments: MediaComment[];
  total: number;
  has_more: boolean;
}

export interface CommentTarget {
  season?: number;
  episode?: number;
}

export interface CreateCommentOptions extends CommentTarget {
  parentId?: string;
  rating?: number;
  mediaUrl?: string;
}

export function mediaCommentsKey(
  type: 'tv' | 'movie',
  tmdbId: number,
  scope: CommentScope,
  target?: CommentTarget,
) {
  return ['media-comments', type, tmdbId, scope, target?.season ?? null, target?.episode ?? null] as const;
}

export function commentRepliesKey(parentId: string) {
  return ['comment-replies', parentId] as const;
}

export function commentCountsKey(type: 'tv' | 'movie', tmdbId: number) {
  return ['media-comment-counts', type, tmdbId] as const;
}

export const commentsApi = {
  list(
    type: 'tv' | 'movie',
    tmdbId: number,
    scope: CommentScope = 'all',
    offset = 0,
    target?: CommentTarget,
  ): Promise<CommentsListResult> {
    const q = new URLSearchParams({
      action: 'list',
      type,
      tmdb_id: String(tmdbId),
      scope,
      offset: String(offset),
    });
    if (target?.season != null) q.set('season', String(target.season));
    if (target?.episode != null) q.set('episode', String(target.episode));
    return api<CommentsListResult>(`/api/comments.php?${q}`);
  },

  counts(type: 'tv' | 'movie', tmdbId: number): Promise<{ counts: Record<string, number> }> {
    return api<{ counts: Record<string, number> }>(
      `/api/comments.php?action=counts&type=${type}&tmdb_id=${tmdbId}`,
    );
  },

  replies(parentId: string): Promise<{ replies: MediaComment[] }> {
    return api<{ replies: MediaComment[] }>(
      `/api/comments.php?action=replies&parent_id=${encodeURIComponent(parentId)}`,
    );
  },

  create(
    type: 'tv' | 'movie',
    tmdbId: number,
    body: string,
    spoiler = false,
    opts: CreateCommentOptions = {},
  ): Promise<{ comment: MediaComment }> {
    return api<{ comment: MediaComment }>('/api/comments.php?action=create', 'POST', {
      type,
      tmdb_id: tmdbId,
      body,
      spoiler,
      season: opts.season,
      episode: opts.episode,
      parent_id: opts.parentId,
      rating: opts.rating,
      media_url: opts.mediaUrl,
    });
  },

  delete(id: string): Promise<{ ok: boolean }> {
    return api<{ ok: boolean }>('/api/comments.php?action=delete', 'POST', { id });
  },
};
