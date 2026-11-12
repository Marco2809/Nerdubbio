/**
 * Il calendario della stagione in onda, dalle date delle puntate su TMDB (Marco, 12/11):
 * il ritmo («ogni venerdì, una puntata»), la prossima e l'ultima puntata, e le date che
 * TMDB non ha ancora, stimate dal ritmo. Le date sono quelle del paese d'origine.
 * Stessa logica della scheda di Nexus Lite (lite_serie_onda).
 */

export interface AiringEpisode {
  episodeNumber: number;
  airDate: string | null;
  episodeType?: string;
}

export type AiringRhythm =
  | { kind: "weekly"; weekdays: number[]; perDrop: number; premiere: number | null }
  | { kind: "daily"; perDrop: number; premiere: number | null }
  | { kind: "allAtOnce" };

export interface AiringDrop {
  date: string;
  episodes: number[];
  estimated: boolean;
}

export interface AiringSchedule {
  rhythm: AiringRhythm | null;
  calendar: AiringDrop[];
  total: number;
  /** TMDB segna l'ultima puntata come finale (o la serie è chiusa): l'elenco è completo. */
  closed: boolean;
  /** Puntate in fondo senza data che non si possono stimare. */
  undated: number;
}

const DAY = 86400000;
const toTime = (iso: string) => Date.parse(iso + "T12:00:00Z");
const fromTime = (t: number) => new Date(t).toISOString().slice(0, 10);

export function airingSchedule(eps: AiringEpisode[], today: string, seriesEnded = false): AiringSchedule | null {
  const episodes = eps.filter(e => e.episodeNumber > 0);
  if (!episodes.length) return null;
  const byDate = new Map<string, number[]>();
  for (const e of episodes) if (e.airDate) byDate.set(e.airDate, [...(byDate.get(e.airDate) ?? []), e.episodeNumber]);
  if (!byDate.size) return null;
  const dates = [...byDate.keys()].sort();
  const counts = dates.map(d => byDate.get(d)!.length);

  let rhythm: AiringRhythm | null = null;
  let step = 0;
  let perDrop = 1;
  if (dates.length === 1 && episodes.length > 1 && counts[0] === episodes.length) {
    rhythm = { kind: "allAtOnce" };
  } else if (dates.length >= 3) {
    const gaps = dates.slice(1).map((d, i) => Math.round((toTime(d) - toTime(dates[i]!)) / DAY)).sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)]!;
    // quante puntate per volta: la cosa più comune, senza contare l'esordio
    const freq = new Map<number, number>();
    for (const c of counts.slice(1)) freq.set(c, (freq.get(c) ?? 0) + 1);
    perDrop = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const premiere = counts[0]! > perDrop ? counts[0]! : null;
    const weekdays = [...new Set(dates.slice(1).map(d => new Date(toTime(d)).getUTCDay()))].sort();
    if (median === 7 && weekdays.length === 1) { step = 7; rhythm = { kind: "weekly", weekdays, perDrop, premiere }; }
    else if (median === 1) { step = 1; rhythm = { kind: "daily", perDrop, premiere }; }
    else if (gaps[gaps.length - 1]! <= 7 && weekdays.length <= 3) rhythm = { kind: "weekly", weekdays, perDrop, premiere };
  }

  const calendar: AiringDrop[] = dates.map(d => ({ date: d, episodes: byDate.get(d)!, estimated: false }));
  // le puntate in fondo ancora senza data: dal ritmo, a gruppi come le altre
  const lastKnown = Math.max(...[...byDate.values()].flat());
  const missing = episodes.map(e => e.episodeNumber).filter(n => n > lastKnown);
  if (missing.length && step) {
    let t = toTime(dates[dates.length - 1]!);
    for (let i = 0; i < missing.length; i += perDrop) {
      t += step * DAY;
      calendar.push({ date: fromTime(t), episodes: missing.slice(i, i + perDrop), estimated: true });
    }
  }
  if (calendar[calendar.length - 1]!.date < today) return null;
  return {
    rhythm,
    calendar,
    total: episodes.length,
    closed: episodes[episodes.length - 1]!.episodeType === "finale" || seriesEnded,
    undated: missing.length && !step ? missing.length : 0,
  };
}
