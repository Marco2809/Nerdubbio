/** Mock user store persistito in localStorage. Da rimpiazzare con API PHP. */
import { useEffect, useState } from "react";

export type UserStatus = "watching" | "completed" | "plan_to_watch" | "paused" | "dropped" | "favorite";

export interface UserMediaEntry {
  id: string;
  status: UserStatus;
  rating?: number;              // rating serie/film 1-10 (livello opera)
  currentSeason?: number;
  currentEpisode?: number;
  watchedEpisodes?: string[]; // "S1E3"
  reactions?: Record<string, string>; // "S1E3" -> emoji
  notes?: string;
  addedAt: string;
  lastWatchedAt?: string; // ISO date
  source?: "manual" | "tvtime" | "trakt";
  // Optional meta cached from TMDB so home/watchlist can render without extra fetch
  title?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  type?: "movie" | "tv";
  year?: number;
}

export type MediaMeta = Pick<UserMediaEntry, "title" | "posterUrl" | "backdropUrl" | "type" | "year">;

const KEY = "nerdubbio:v2";

interface State {
  xp: number;
  level: number;
  streak: number;
  lastActiveDay?: string; // YYYY-MM-DD
  media: Record<string, UserMediaEntry>;
  dismissed: string[];
  achievements: string[];
  onboardingDone: boolean;
  language: "it" | "en";
  favoriteGenres: string[];
  moodProfile?: string[];
  upcomingFilters: {
    newSeries: boolean;       // premiere di nuova serie o nuova stagione
    seasonPremieres: boolean; // episodio 1 di una stagione
    includeMovies: boolean;   // mostra la sezione "Al cinema in Italia"
  };
}

function today() { return new Date().toISOString().slice(0,10); }
function levelFromXp(xp: number) { return Math.max(1, Math.floor(xp / 400) + 1); }
function bumpStreak(prev: State): { streak: number; lastActiveDay: string } {
  const t = today();
  if (prev.lastActiveDay === t) return { streak: prev.streak, lastActiveDay: t };
  const y = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  return { streak: prev.lastActiveDay === y ? prev.streak + 1 : 1, lastActiveDay: t };
}

const initial: State = {
  xp: 0, level: 1, streak: 0,
  media: {},
  dismissed: [],
  achievements: [],
  onboardingDone: false,
  language: "it",
  favoriteGenres: [],
  upcomingFilters: { newSeries: true, seasonPremieres: true, includeMovies: true },
};


function load(): State {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    return { ...initial, ...JSON.parse(raw) };
  } catch { return initial; }
}
function save(s: State) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function useUserStore() {
  const [state, setState] = useState<State>(initial);
  useEffect(() => { setState(load()); }, []);
  const update = (patch: Partial<State> | ((s:State)=>State)) => {
    setState(prev => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      save(next); return next;
    });
  };
  const addToList = (id: string, status: UserStatus, meta?: MediaMeta) => update(s => ({
    ...s,
    media: { ...s.media, [id]: { ...(s.media[id] ?? { id, addedAt:new Date().toISOString() }), ...(meta ?? {}), status } },
    xp: s.xp + 10,
    level: levelFromXp(s.xp + 10),
  }));
  const dismiss = (id: string) => update(s => ({ ...s, dismissed: [...new Set([...s.dismissed, id])] }));
  const removeFromList = (id: string) => update(s => {
    const { [id]: _, ...rest } = s.media;
    void _;
    return { ...s, media: rest };
  });

  /** Toggle un episodio come visto. Aggiorna XP, streak, current S/E e stato. */
  const toggleEpisode = (
    id: string,
    season: number,
    episode: number,
    episodesPerSeason: number,
    totalSeasons: number,
  ) => update(s => {
    const key = `S${season}E${episode}`;
    const prevEntry: UserMediaEntry = s.media[id] ?? { id, status: "watching", addedAt: new Date().toISOString(), watchedEpisodes: [] };
    const watched = new Set(prevEntry.watchedEpisodes ?? []);
    const wasWatched = watched.has(key);
    if (wasWatched) watched.delete(key); else watched.add(key);

    // Furthest watched
    let maxS = 0, maxE = 0;
    for (const k of watched) {
      const m = /^S(\d+)E(\d+)$/.exec(k); if (!m) continue;
      const sN = +m[1], eN = +m[2];
      if (sN > maxS || (sN === maxS && eN > maxE)) { maxS = sN; maxE = eN; }
    }
    const totalEpisodes = totalSeasons * episodesPerSeason;
    const completed = watched.size >= totalEpisodes;
    const nextEntry: UserMediaEntry = {
      ...prevEntry,
      watchedEpisodes: [...watched],
      currentSeason: maxS || undefined,
      currentEpisode: maxE || undefined,
      status: completed ? "completed" : watched.size > 0 ? "watching" : prevEntry.status,
      lastWatchedAt: wasWatched ? prevEntry.lastWatchedAt : new Date().toISOString(),
    };

    // XP: +15 per episodio, +50 bonus a stagione completa, +100 a serie completa
    let xpDelta = wasWatched ? -15 : 15;
    if (!wasWatched) {
      const seasonKeys = Array.from({ length: episodesPerSeason }, (_, i) => `S${season}E${i+1}`);
      if (seasonKeys.every(k => watched.has(k))) xpDelta += 50;
      if (completed) xpDelta += 100;
    }
    const nextXp = Math.max(0, s.xp + xpDelta);
    const streakUpdate = wasWatched
      ? { streak: s.streak, lastActiveDay: s.lastActiveDay }
      : bumpStreak(s);

    return {
      ...s,
      xp: nextXp,
      level: levelFromXp(nextXp),
      streak: streakUpdate.streak,
      lastActiveDay: streakUpdate.lastActiveDay,
      media: { ...s.media, [id]: nextEntry },
    };
  });

  /** Segna tutti gli episodi di una serie come visti (o solo fino ad oggi). Bonus XP unico. */
  const markAllSeriesWatched = (
    id: string,
    seasons: { seasonNumber: number; episodeCount: number; airDate?: string | null }[],
    opts: { onlyAired?: boolean; meta?: MediaMeta } = {},
  ) => update(s => {
    const prevEntry: UserMediaEntry = s.media[id] ?? { id, status: "completed", addedAt: new Date().toISOString(), watchedEpisodes: [] };
    const watched = new Set(prevEntry.watchedEpisodes ?? []);
    const today = new Date().toISOString().slice(0, 10);
    let added = 0;
    let maxS = 0, maxE = 0;
    for (const se of seasons) {
      if (opts.onlyAired && se.airDate && se.airDate > today) continue;
      for (let ep = 1; ep <= se.episodeCount; ep++) {
        const k = `S${se.seasonNumber}E${ep}`;
        if (!watched.has(k)) { watched.add(k); added++; }
        if (se.seasonNumber > maxS || (se.seasonNumber === maxS && ep > maxE)) {
          maxS = se.seasonNumber; maxE = ep;
        }
      }
    }
    const xpDelta = added * 15 + (added > 0 ? 100 : 0);
    const nextXp = Math.max(0, s.xp + xpDelta);
    const streakUpdate = added > 0 ? bumpStreak(s) : { streak: s.streak, lastActiveDay: s.lastActiveDay };
    return {
      ...s,
      xp: nextXp,
      level: levelFromXp(nextXp),
      streak: streakUpdate.streak,
      lastActiveDay: streakUpdate.lastActiveDay,
      media: {
        ...s.media,
        [id]: {
          ...prevEntry,
          ...(opts.meta ?? {}),
          watchedEpisodes: [...watched],
          currentSeason: maxS || prevEntry.currentSeason,
          currentEpisode: maxE || prevEntry.currentEpisode,
          status: "completed",
          lastWatchedAt: added > 0 ? new Date().toISOString() : prevEntry.lastWatchedAt,
        },
      },
    };
  });

  /** Reset progressi episodi (usato con "Annulla" della sync). */
  const clearWatchedEpisodes = (id: string, restoreStatus?: UserStatus) => update(s => {
    const prev = s.media[id];
    if (!prev) return s;
    return {
      ...s,
      media: {
        ...s.media,
        [id]: {
          ...prev,
          watchedEpisodes: [],
          currentSeason: undefined,
          currentEpisode: undefined,
          status: restoreStatus ?? prev.status,
        },
      },
    };
  });

  /** Imposta rating a livello serie/film (1-10). */
  const setRating = (id: string, rating: number | undefined) => update(s => {
    const prev = s.media[id] ?? { id, status: "plan_to_watch" as UserStatus, addedAt: new Date().toISOString() };
    return { ...s, media: { ...s.media, [id]: { ...prev, rating } } };
  });

  /** Toggle emoji reaction per un episodio. */
  const setReaction = (id: string, season: number, episode: number, emoji: string | null) => update(s => {
    const prev = s.media[id] ?? { id, status: "watching" as UserStatus, addedAt: new Date().toISOString() };
    const next = { ...(prev.reactions ?? {}) };
    const key = `S${season}E${episode}`;
    if (emoji) next[key] = emoji; else delete next[key];
    return { ...s, media: { ...s.media, [id]: { ...prev, reactions: next } } };
  });

  /** Import bulk (es. da TV Time). Non ri-aggiunge XP. */
  const bulkImport = (entries: UserMediaEntry[]) => update(s => {
    const merged = { ...s.media };
    let added = 0;
    for (const e of entries) {
      if (!merged[e.id]) { merged[e.id] = e; added++; }
      else merged[e.id] = { ...merged[e.id], ...e, addedAt: merged[e.id].addedAt };
    }
    return { ...s, media: merged, xp: s.xp + added * 5, level: levelFromXp(s.xp + added * 5) };
  });

  return { state, update, addToList, removeFromList, dismiss, toggleEpisode, setRating, setReaction, bulkImport, markAllSeriesWatched, clearWatchedEpisodes };
}

export function isEpisodeWatched(entry: UserMediaEntry | undefined, season: number, episode: number) {
  return !!entry?.watchedEpisodes?.includes(`S${season}E${episode}`);
}

export function computeStats(state: State) {
  const list = Object.values(state.media);
  const active = list.filter(m => m.status !== "dropped");
  const inferType = (m: UserMediaEntry): "movie" | "tv" =>
    m.type ?? (m.id.startsWith("movie-") ? "movie" : "tv");
  const watching = list.filter(m => m.status === "watching").length;
  const completed = list.filter(m => m.status === "completed").length;
  const planned = list.filter(m => m.status === "plan_to_watch").length;
  const favorites = list.filter(m => m.status === "favorite").length;
  const series = active.filter(m => inferType(m) === "tv").length;
  const movies = active.filter(m => inferType(m) === "movie").length;
  const episodes = list.reduce((n, m) => n + (m.watchedEpisodes?.length ?? 0), 0);
  const completedMovies = active.filter(m => inferType(m) === "movie" && m.status === "completed").length;
  // 45 min per episodio, 110 min per film → ore totali di visione.
  const hours = Math.round((episodes * 45 + completedMovies * 110) / 60);
  return { watching, completed, planned, favorites, series, movies, episodes, hours, total: list.length };
}

