import { api } from '@/lib/php/client';

export type ItaKind = 'film' | 'serie' | 'anime';
export type ItaState = 'completa' | 'in_corso' | 'inedita' | 'ignoto';
export type ItaLang = 'dub' | 'sub';

/** Cosa deve ancora uscire (TMDB, ogni notte): la pagina formatta data e testo nella lingua dell'utente. */
export interface ItaArriving {
  date: string;
  season: number | null;
  where: string;
  kind: 'cinema' | 'streaming' | 'tv' | 'homevideo' | 'season' | 'series' | 'release';
  /** La data vale per l'Italia (data italiana di TMDB o uscita mondiale di una piattaforma). */
  italy: boolean;
  worldwide: boolean;
}

/** Una riga della mappa della libreria: tipo, stato in italiano, bollino, scelta dell'utente, in arrivo. */
export interface ItaMapItem {
  kind?: ItaKind;
  stato?: ItaState;
  short?: string;
  lang?: ItaLang;
  arriving?: ItaArriving;
}

export interface ItaSeason {
  n: number;
  episodes: number;
  aired: number;
  start: string | null;
  ita: 'si' | 'in_corso' | 'no' | '?';
  note: string;
}

/** Lo stato in italiano di un titolo (testi in italiano: il dato viene da Wikipedia italiana). */
export interface ItaInfo {
  kind: ItaKind;
  stato: ItaState;
  short: string;
  text: string;
  seasons: ItaSeason[];
  next: { date: string; text: string } | null;
  dubbing: 'doppiato' | 'sottotitolato' | 'misto' | null;
  where: string;
  source: string | null;
  read_at: string;
}

export const itaApi = {
  map(): Promise<{ items: Record<string, ItaMapItem> }> {
    return api('/api/ita.php?action=map');
  },
  /** Se il titolo non è mai stato letto ci vuole qualche secondo. */
  get(key: string): Promise<{ ita: ItaInfo | null; lang: ItaLang | null; arriving: ItaArriving | null }> {
    return api(`/api/ita.php?action=get&key=${encodeURIComponent(key)}`);
  },
  setLang(key: string, lang: ItaLang | null): Promise<{ ok: boolean; lang: ItaLang | null }> {
    return api('/api/ita.php?action=lang', 'POST', { key, lang });
  },
};

/** Il bollino della locandina: la scelta dell'utente vince sul dato automatico. */
export function itaBadge(item: ItaMapItem | undefined): { text: string; state: ItaState } | null {
  if (!item) return null;
  const { stato, short, lang } = item;
  if (!lang) return short && stato ? { text: short, state: stato } : null;
  if (stato === 'inedita') return { text: 'no ITA', state: 'inedita' };
  if (stato === 'in_corso') return { text: lang === 'sub' ? 'SUB …' : 'ITA …', state: 'in_corso' };
  return { text: lang === 'sub' ? 'SUB ITA' : 'ITA', state: 'completa' };
}
