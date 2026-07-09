import type { Locale } from '@/lib/i18n';
import { api } from '@/lib/php/client';

export interface RecapScene {
  motif: string;
  label: string;
  caption: string;
  dur: number;
}

export interface RecapResult {
  scenes: RecapScene[];
  model: string;
  cached: boolean;
}

export interface RecapEpisodeInput {
  n: number;
  t: string;
  o: string;
}

export interface RecapInput {
  type: 'movie' | 'tv';
  tmdbId: number;
  season?: string;
  lang: Locale;
  title: string;
  year?: number | null;
  genres?: string[];
  plot: string;
  episodes?: RecapEpisodeInput[];
}

export const recapApi = {
  generate(input: RecapInput): Promise<RecapResult> {
    return api<RecapResult>('/api/recap.php?action=get', 'POST', input);
  },
};
