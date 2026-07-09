import { api } from '@/lib/php/client';

export type RecoState = 'seen' | 'listed' | 'new';

export interface RecoFriend {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  state: RecoState;
  alreadySent: boolean;
}

export interface RecoReceived {
  id: string;
  from: { handle: string; display_name: string | null; avatar_url: string | null };
  media: { key: string; type: 'tv' | 'movie' | null; title: string; posterUrl: string | null; year: number | null };
  message: string | null;
  created_at: string;
}

export interface RecoSendInput {
  mediaKey: string;
  mediaType?: 'tv' | 'movie';
  title: string;
  posterUrl?: string | null;
  year?: number | null;
  friendIds: string[];
  message?: string;
}

export const RECO_RECEIVED_KEY = ['recommendations', 'received'] as const;

export const recommendApi = {
  friendsFor(mediaKey: string): Promise<{ friends: RecoFriend[] }> {
    return api<{ friends: RecoFriend[] }>(
      `/api/recommend.php?action=friends_for&media_key=${encodeURIComponent(mediaKey)}`,
    );
  },
  send(input: RecoSendInput): Promise<{ sent: number; skipped: number }> {
    return api<{ sent: number; skipped: number }>('/api/recommend.php?action=send', 'POST', input);
  },
  received(): Promise<{ received: RecoReceived[] }> {
    return api<{ received: RecoReceived[] }>('/api/recommend.php?action=received');
  },
  act(id: string, action: 'add' | 'dismiss'): Promise<{ received: RecoReceived[] }> {
    return api<{ received: RecoReceived[] }>('/api/recommend.php?action=act', 'POST', { id, action });
  },
};
