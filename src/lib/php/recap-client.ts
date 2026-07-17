import type { Locale } from '@/lib/i18n';
import { api } from '@/lib/php/client';

export interface RecapSceneCharacter {
  name: string;
  note?: string;
}

export interface RecapScene {
  layout?: string;
  title?: string;
  subtitle?: string;
  motif?: string;
  emotion?: string;
  characters?: RecapSceneCharacter[];
  quote?: { text: string; speaker?: string };
  stats?: { label: string; value: string }[];
  items?: string[];
  /** Episodio in cui accade il beat (chip "Ep. N"). */
  ep?: number;
  dur: number;
  // Retrocompat con i vecchi recap in cache.
  label?: string;
  caption?: string;
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

export interface RecapCastInput {
  c: string; // nome personaggio
  a?: string; // attore
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
  cast?: RecapCastInput[];
}

export const recapApi = {
  generate(input: RecapInput): Promise<RecapResult> {
    return api<RecapResult>('/api/recap.php?action=get', 'POST', input);
  },
};
