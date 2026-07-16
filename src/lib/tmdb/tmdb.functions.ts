import { AsyncLocalStorage } from "node:async_hooks";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { tmdbGenreIds, genreNamesFromIds } from "@/lib/recommendation/genre-map";
import { tmdbToCatalogItem } from "@/lib/recommendation/tmdb-catalog";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

export interface SeasonSummary {
  seasonNumber: number;
  episodeCount: number;
  airDate: string | null;
}
export interface TmdbItem {
  id: string;              // "movie-123" | "tv-456"
  tmdb_id: number;
  type: "movie" | "tv";
  title: string;
  year: number;
  rating: number;
  voteCount?: number;
  popularity: number;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  runtimeMin?: number;
  seasons?: number;
  seasonsInfo?: SeasonSummary[];
  /** TMDB status: Ended, Returning Series, In Production, … */
  seriesStatus?: string;
}

// Locale per-richiesta: le server function girano sul server, quindi la lingua
// dell'utente viene passata dal client e propagata a tutte le chiamate TMDB
// (anche quelle annidate: enrichDiscoverRow, similar, season…) via AsyncLocalStorage,
// senza dover aggiungere un parametro a ogni funzione interna.
const localeStore = new AsyncLocalStorage<string>();

const ALLOWED_LOCALES = new Set(["it-IT", "en-US", "es-ES", "fr-FR", "de-DE"]);

function normalizeTmdbLocale(locale?: string): string {
  if (!locale) return "it-IT";
  if (ALLOWED_LOCALES.has(locale)) return locale;
  // Accetta anche codici a 2 lettere ("en" → "en-US").
  const short = locale.slice(0, 2).toLowerCase();
  for (const l of ALLOWED_LOCALES) if (l.startsWith(short)) return l;
  return "it-IT";
}

function currentTmdbLanguage(): string {
  return localeStore.getStore() ?? "it-IT";
}

/** Esegue l'handler con il locale TMDB richiesto attivo per tutta la catena async. */
function runWithLocale<T>(locale: string | undefined, fn: () => Promise<T>): Promise<T> {
  return localeStore.run(normalizeTmdbLocale(locale), fn);
}

async function tmdb<T = any>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!bearer && !apiKey) {
    throw new Error("TMDB credentials missing (TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY)");
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("language", currentTmdbLanguage());
  if (apiKey && !bearer) url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const res = await fetchWithRateLimitRetry(url, headers);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/**
 * TMDB risponde 429 quando una schermata fa molte richieste insieme (es. la
 * home che calcola i prossimi episodi di N serie). Senza retry l'errore
 * risaliva come "nessun episodio", svuotando le sezioni: qui aspettiamo e
 * riproviamo, rispettando Retry-After.
 */
async function fetchWithRateLimitRetry(url: URL, headers: Record<string, string>): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status !== 429) return res;
    const retryAfter = Number(res.headers.get("retry-after") ?? "1");
    const waitMs = Math.min(Number.isFinite(retryAfter) ? retryAfter : 1, 5) * 1000 + 150;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return fetch(url, { headers });
}

/** Fetch TMDB con lingua custom (es. fallback EN). */
async function tmdbFetch(path: string, language: string): Promise<Response> {
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!bearer && !apiKey) throw new Error("TMDB credentials missing");

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("language", language);
  if (apiKey && !bearer) url.searchParams.set("api_key", apiKey);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return fetch(url, { headers });
}

const posterUrl = (p?: string | null, size = "w342") => (p ? `${IMG_BASE}/${size}${p}` : null);
const backdropUrl = (p?: string | null, size = "w780") => (p ? `${IMG_BASE}/${size}${p}` : null);

function mapMulti(r: any): TmdbItem | null {
  const type: "movie" | "tv" | null = r.media_type === "movie" ? "movie" : r.media_type === "tv" ? "tv" : null;
  if (!type) return null;
  const title = type === "movie" ? r.title : r.name;
  const dateStr = type === "movie" ? r.release_date : r.first_air_date;
  return {
    id: `${type}-${r.id}`,
    tmdb_id: r.id,
    type,
    title: title ?? "Senza titolo",
    year: dateStr ? Number(String(dateStr).slice(0, 4)) : 0,
    rating: Number(r.vote_average ?? 0),
    voteCount: Number(r.vote_count ?? 0),
    popularity: Number(r.popularity ?? 0),
    overview: r.overview ?? "",
    posterUrl: posterUrl(r.poster_path),
    backdropUrl: backdropUrl(r.backdrop_path),
    // I risultati "multi" hanno genre_ids numerici: mappali sul vocabolario app.
    genres: genreNamesFromIds(Array.isArray(r.genre_ids) ? r.genre_ids : [], type),
  };
}

function mapDetail(r: any, type: "movie" | "tv"): TmdbItem {
  const title = type === "movie" ? r.title : r.name;
  const dateStr = type === "movie" ? r.release_date : r.first_air_date;
  return {
    id: `${type}-${r.id}`,
    tmdb_id: r.id,
    type,
    title: title ?? "Senza titolo",
    year: dateStr ? Number(String(dateStr).slice(0, 4)) : 0,
    rating: Number(r.vote_average ?? 0),
    voteCount: Number(r.vote_count ?? 0),
    popularity: Number(r.popularity ?? 0),
    overview: r.overview ?? "",
    posterUrl: posterUrl(r.poster_path, "w500"),
    backdropUrl: backdropUrl(r.backdrop_path, "w1280"),
    genres: (r.genres ?? []).map((g: any) => g.name).filter(Boolean),
    runtimeMin: type === "movie" ? r.runtime ?? undefined : r.episode_run_time?.[0] ?? undefined,
    seasons: type === "tv" ? r.number_of_seasons ?? undefined : undefined,
    seasonsInfo: type === "tv" && Array.isArray(r.seasons)
      ? r.seasons
          .filter((s: any) => s && s.season_number > 0 && (s.episode_count ?? 0) > 0)
          .map((s: any) => ({
            seasonNumber: s.season_number,
            episodeCount: s.episode_count ?? 0,
            airDate: s.air_date ?? null,
          }))
      : undefined,
    seriesStatus: type === "tv" ? (r.status ?? undefined) : undefined,
  };
}

export const tmdbSearch = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ query: z.string().min(1).max(200), locale: z.string().optional() }).parse(data))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const res = await tmdb<any>(`/search/multi`, { query: data.query, include_adult: "false", page: 1 });
    const items = (res.results ?? [])
      .map(mapMulti)
      .filter((x: TmdbItem | null): x is TmdbItem => x !== null)
      .slice(0, 30);
    return { items };
  }));

function cleanMatchTitle(title: string): { title: string; year?: number } {
  const paren = title.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (paren) return { title: paren[1].trim(), year: Number(paren[2]) };
  return { title: title.trim() };
}

function rankMatches(mapped: TmdbItem[], q: { title: string; year?: number }): TmdbItem[] {
  const want = q.title.toLowerCase();
  return [...mapped].sort((a, b) => {
    const ay = q.year && a.year === q.year ? 1 : 0;
    const by = q.year && b.year === q.year ? 1 : 0;
    if (ay !== by) return by - ay;
    const at = a.title.toLowerCase() === want ? 1 : 0;
    const bt = b.title.toLowerCase() === want ? 1 : 0;
    if (at !== bt) return bt - at;
    const aInc = a.title.toLowerCase().includes(want) ? 1 : 0;
    const bInc = b.title.toLowerCase().includes(want) ? 1 : 0;
    if (aInc !== bInc) return bInc - aInc;
    // Omonimi (es. Scrubs 2001 vs revival): la popularity premia il trending
    // del momento e sceglie la serie NUOVA; il vote_count storico identifica
    // quella che l'utente ha realmente visto. Senza anno, vince lo storico.
    const av = a.voteCount ?? 0;
    const bv = b.voteCount ?? 0;
    if (av !== bv) return bv - av;
    return b.popularity - a.popularity;
  });
}

/** Match esatto via id TVDB (export GDPR TV Time) — niente ambiguità di titolo. */
async function matchByTvdbId(tvdbId: number): Promise<TmdbItem | null> {
  try {
    const found = await tmdb<any>(`/find/${tvdbId}`, { external_source: "tvdb_id" });
    const tv = (found.tv_results ?? [])[0];
    if (!tv) return null;
    return await enrichDiscoverRow(tv, "tv");
  } catch {
    return null;
  }
}

/** Match per titolo (best guess) con priorità all'id TVDB quando disponibile. */
export const tmdbMatchTitles = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    items: z.array(z.object({
      title: z.string().min(1),
      year: z.number().int().optional(),
      type: z.enum(["movie", "tv"]).optional(),
      tvdbId: z.number().int().positive().optional(),
    })).max(80),
    locale: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const results = await Promise.all(data.items.map(async (raw) => {
      // Id TVDB presente → match esatto, la ricerca per titolo è solo fallback.
      if (raw.tvdbId && raw.type !== "movie") {
        const exact = await matchByTvdbId(raw.tvdbId);
        if (exact) return { query: raw, match: exact, suggestions: [exact] };
      }
      const cleaned = cleanMatchTitle(raw.title);
      const q = {
        title: cleaned.title,
        year: raw.year ?? cleaned.year,
        type: raw.type,
      };
      try {
        const endpoint = q.type ? `/search/${q.type}` : `/search/multi`;
        const params: Record<string, string | number> = { query: q.title, include_adult: "false", page: 1 };
        if (q.year && q.type === "movie") params.year = q.year;
        if (q.year && q.type === "tv") params.first_air_date_year = q.year;
        const res = await tmdb<any>(endpoint, params);
        const raws = (res.results ?? []).slice(0, 8);
        const mapped = raws.map((r: any) => mapMulti(q.type ? { ...r, media_type: q.type } : r)).filter((x: TmdbItem | null): x is TmdbItem => !!x);
        const ranked = rankMatches(mapped, q);
        return { query: raw, match: ranked[0] ?? null, suggestions: ranked.slice(0, 6) };
      } catch {
        return { query: raw, match: null, suggestions: [] as TmdbItem[] };
      }
    }));
    return { results };
  }));



export const tmdbTrending = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ window: z.enum(["day", "week"]).default("week"), locale: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const res = await tmdb<any>(`/trending/all/${data.window}`);
    const items = (res.results ?? [])
      .map(mapMulti)
      .filter((x: TmdbItem | null): x is TmdbItem => x !== null)
      .slice(0, 20);
    return { items };
  }));

export const tmdbDetail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ type: z.enum(["movie", "tv"]), tmdbId: z.number().int().positive(), locale: z.string().optional() }).parse(data))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const res = await tmdb<any>(`/${data.type}/${data.tmdbId}`);
    // Fallback EN per la trama se manca nella lingua scelta.
    if (!res.overview?.trim() && currentTmdbLanguage().slice(0, 2) !== "en") {
      try {
        const r = await tmdbFetch(`/${data.type}/${data.tmdbId}`, "en-US");
        if (r.ok) { const en = await r.json(); if (en.overview?.trim()) res.overview = en.overview; }
      } catch { /* ignore */ }
    }
    return { item: mapDetail(res, data.type) };
  }));

// ============================================================
// Ricerca avanzata / esplora catalogo (sezione Cerca)
// ============================================================

/** Un tipo per pagina di /discover, con i filtri applicati. */
async function discoverTypePage(
  type: "movie" | "tv",
  opts: {
    genreIds: number[];
    minRating: number;
    minVotes: number;
    yearFrom?: number;
    yearTo?: number;
    sort: "popularity" | "rating" | "recent";
    page: number;
  },
): Promise<TmdbItem[]> {
  const sortBy = opts.sort === "rating"
    ? "vote_average.desc"
    : opts.sort === "recent"
      ? (type === "movie" ? "primary_release_date.desc" : "first_air_date.desc")
      : "popularity.desc";

  // Ordinando per voto serve una soglia di voti alta, altrimenti TMDB pesca
  // titoli oscuri con pochissimi voti a 10/10.
  const minVotes = opts.sort === "rating" ? Math.max(opts.minVotes, 300) : opts.minVotes;
  const params: Record<string, string | number> = {
    sort_by: sortBy,
    include_adult: "false",
    "vote_count.gte": minVotes,
    page: opts.page,
  };
  if (opts.minRating > 0) params["vote_average.gte"] = opts.minRating;
  if (opts.genreIds.length) params.with_genres = opts.genreIds.slice(0, 5).join("|");
  if (type === "movie") {
    params.region = "IT";
    if (opts.yearFrom) params["primary_release_date.gte"] = `${opts.yearFrom}-01-01`;
    if (opts.yearTo) params["primary_release_date.lte"] = `${opts.yearTo}-12-31`;
    // Ordinando per data serve un tetto per non pescare uscite future senza voti.
    if (opts.sort === "recent") params["primary_release_date.lte"] = new Date().toISOString().slice(0, 10);
  } else {
    params.watch_region = "IT";
    if (opts.yearFrom) params["first_air_date.gte"] = `${opts.yearFrom}-01-01`;
    if (opts.yearTo) params["first_air_date.lte"] = `${opts.yearTo}-12-31`;
    if (opts.sort === "recent") params["first_air_date.lte"] = new Date().toISOString().slice(0, 10);
  }

  const res = await tmdb<any>(type === "movie" ? "/discover/movie" : "/discover/tv", params);
  return (res.results ?? [])
    .map((r: any) => mapMulti({ ...r, media_type: type }))
    .filter((x: TmdbItem | null): x is TmdbItem => x !== null);
}

/** Esplora l'intero catalogo TMDB con filtri avanzati (senza query testuale). */
export const tmdbDiscover = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    type: z.enum(["all", "movie", "tv"]).default("all"),
    genres: z.array(z.string()).default([]),
    minRating: z.number().min(0).max(10).default(0),
    minVotes: z.number().int().min(0).default(50),
    yearFrom: z.number().int().optional(),
    yearTo: z.number().int().optional(),
    sort: z.enum(["popularity", "rating", "recent"]).default("popularity"),
    page: z.number().int().min(1).max(20).default(1),
    locale: z.string().optional(),
  }).parse(data ?? {}))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const types: ("movie" | "tv")[] = data.type === "all" ? ["movie", "tv"] : [data.type];
    const perType = await Promise.all(types.map(t => discoverTypePage(t, {
      genreIds: tmdbGenreIds(data.genres, t),
      minRating: data.minRating,
      minVotes: data.minVotes,
      yearFrom: data.yearFrom,
      yearTo: data.yearTo,
      sort: data.sort,
      page: data.page,
    }).catch(() => [] as TmdbItem[])));

    // Merge dei due tipi mantenendo l'ordine richiesto (interleave per non
    // mettere tutti i film prima di tutte le serie in modalità "all").
    let items: TmdbItem[];
    if (perType.length === 2) {
      const [a, b] = perType;
      const merged: TmdbItem[] = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i]) merged.push(a[i]!);
        if (b[i]) merged.push(b[i]!);
      }
      items = merged;
    } else {
      items = perType[0] ?? [];
    }
    return { items, page: data.page };
  }));

export interface EpisodeInfo {
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  runtime: number | null;
  voteAverage: number;
  voteCount: number;
  stillUrl: string | null;
}
/** Nome episodio "segnaposto" TMDB (nessuna traduzione reale) in varie lingue. */
function isGenericEpisodeName(name: string | undefined | null): boolean {
  if (!name || !name.trim()) return true;
  return /^(episodio|episode|folge|épisode|episodi|cap[íi]tulo)\s*\d+$/i.test(name.trim());
}

export const tmdbSeason = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    tmdbId: z.number().int().positive(),
    seasonNumber: z.number().int().min(0),
    locale: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const res = await tmdb<any>(`/tv/${data.tmdbId}/season/${data.seasonNumber}`);
    const localized: any[] = res.episodes ?? [];

    // Fallback EN: se TMDB non ha la traduzione degli episodi nella lingua scelta
    // (nomi segnaposto "Episodio N" e trame vuote), riempi i buchi con l'inglese.
    const lang = currentTmdbLanguage();
    const needsFallback = lang.slice(0, 2) !== "en" && localized.some(
      e => isGenericEpisodeName(e.name) || !e.overview?.trim(),
    );
    let enMap = new Map<number, any>();
    let enSeason: any = null;
    if (needsFallback) {
      try {
        const r = await tmdbFetch(`/tv/${data.tmdbId}/season/${data.seasonNumber}`, "en-US");
        if (r.ok) {
          enSeason = await r.json();
          for (const e of (enSeason.episodes ?? [])) enMap.set(e.episode_number, e);
        }
      } catch { /* fallback non disponibile — teniamo i dati localizzati */ }
    }

    const episodes: EpisodeInfo[] = localized.map((e: any) => {
      const en = enMap.get(e.episode_number);
      const name = !isGenericEpisodeName(e.name)
        ? e.name
        : (en?.name && !isGenericEpisodeName(en.name) ? en.name : (e.name ?? `Episodio ${e.episode_number}`));
      const overview = e.overview?.trim() ? e.overview : (en?.overview ?? "");
      return {
        episodeNumber: e.episode_number,
        name,
        overview,
        airDate: e.air_date ?? null,
        runtime: e.runtime ?? null,
        voteAverage: Number(e.vote_average ?? 0),
        voteCount: Number(e.vote_count ?? 0),
        stillUrl: e.still_path ? `${IMG_BASE}/w300${e.still_path}` : null,
      };
    });
    return {
      seasonNumber: res.season_number,
      name: res.name ?? `Stagione ${res.season_number}`,
      overview: res.overview?.trim() ? res.overview : (enSeason?.overview ?? ""),
      posterUrl: res.poster_path ? `${IMG_BASE}/w342${res.poster_path}` : null,
      episodes,
    };
  }));

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profileUrl: string | null;
  order: number;
}
export const tmdbCredits = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ type: z.enum(["movie", "tv"]), tmdbId: z.number().int().positive(), locale: z.string().optional() }).parse(data))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    // Per le serie /credits torna solo il cast dell'ultima stagione:
    // aggregate_credits aggrega tutte le stagioni (i personaggi stanno in roles[]).
    const endpoint = data.type === "tv"
      ? `/tv/${data.tmdbId}/aggregate_credits`
      : `/movie/${data.tmdbId}/credits`;
    const res = await tmdb<any>(endpoint);
    const cast: CastMember[] = (res.cast ?? [])
      .slice(0, 40)
      .map((c: any) => ({
        id: c.id,
        name: c.name ?? "",
        character: c.character
          ?? (c.roles ?? []).map((r: any) => r.character).filter(Boolean).slice(0, 2).join(" / "),
        profileUrl: c.profile_path ? `${IMG_BASE}/w185${c.profile_path}` : null,
        order: c.order ?? 999,
      }));
    return { cast };
  }));

export interface TrailerInfo {
  key: string;   // id YouTube
  name: string;
  type: string;  // Trailer | Teaser
}

/** Trailer YouTube del titolo. Prova nella lingua scelta, poi fallback EN. */
export const tmdbVideos = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ type: z.enum(["movie", "tv"]), tmdbId: z.number().int().positive(), locale: z.string().optional() }).parse(data))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const collect = (results: any[]): any[] =>
      (results ?? []).filter(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));

    let vids: any[] = [];
    try { vids = collect((await tmdb<any>(`/${data.type}/${data.tmdbId}/videos`)).results); }
    catch { /* ignore */ }

    // Se nella lingua scelta non ci sono trailer, prova in inglese.
    if (!vids.length && currentTmdbLanguage().slice(0, 2) !== "en") {
      try {
        const r = await tmdbFetch(`/${data.type}/${data.tmdbId}/videos`, "en-US");
        if (r.ok) vids = collect((await r.json()).results);
      } catch { /* ignore */ }
    }

    // Ordine: Trailer prima dei Teaser, ufficiali prima.
    vids.sort((a, b) => {
      const ta = a.type === "Trailer" ? 0 : 1;
      const tb = b.type === "Trailer" ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return (b.official ? 1 : 0) - (a.official ? 1 : 0);
    });

    const trailers: TrailerInfo[] = vids.slice(0, 3).map(v => ({
      key: v.key,
      name: v.name ?? "",
      type: v.type,
    }));
    return { trailers };
  }));

export interface PersonCredit {
  id: number;
  type: "movie" | "tv";
  title: string;
  character: string;
  year: number;
  posterUrl: string | null;
  popularity: number;
}
export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  knownFor: string;
  profileUrl: string | null;
  credits: PersonCredit[];
}
export const tmdbPerson = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ personId: z.number().int().positive(), locale: z.string().optional() }).parse(data))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const [p, credits] = await Promise.all([
      tmdb<any>(`/person/${data.personId}`),
      tmdb<any>(`/person/${data.personId}/combined_credits`),
    ]);
    // Fallback biography EN se manca nella lingua scelta
    let biography: string = p.biography ?? "";
    if (!biography) {
      try {
        const r = await tmdbFetch(`/person/${data.personId}`, "en-US");
        if (r.ok) { const j = await r.json(); biography = j.biography ?? ""; }
      } catch { /* ignore */ }
    }
    const list: PersonCredit[] = (credits.cast ?? [])
      .filter((c: any) => c.media_type === "movie" || c.media_type === "tv")
      .map((c: any) => {
        const type: "movie" | "tv" = c.media_type;
        const title = type === "movie" ? c.title : c.name;
        const dateStr = type === "movie" ? c.release_date : c.first_air_date;
        return {
          id: c.id,
          type,
          title: title ?? "Senza titolo",
          character: c.character ?? "",
          year: dateStr ? Number(String(dateStr).slice(0, 4)) : 0,
          posterUrl: c.poster_path ? `${IMG_BASE}/w185${c.poster_path}` : null,
          popularity: Number(c.popularity ?? 0),
        };
      });
    // Dedup su id+type, poi ordina per anno desc (0 in fondo) e popolarità
    const seen = new Set<string>();
    const dedup = list.filter(c => {
      const k = `${c.type}-${c.id}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    dedup.sort((a, b) => {
      if (!a.year && b.year) return 1;
      if (a.year && !b.year) return -1;
      if (a.year !== b.year) return b.year - a.year;
      return b.popularity - a.popularity;
    });
    const detail: PersonDetail = {
      id: p.id,
      name: p.name ?? "",
      biography,
      birthday: p.birthday ?? null,
      deathday: p.deathday ?? null,
      placeOfBirth: p.place_of_birth ?? null,
      knownFor: p.known_for_department ?? "",
      profileUrl: p.profile_path ? `${IMG_BASE}/w342${p.profile_path}` : null,
      credits: dedup.slice(0, 60),
    };
    return { person: detail };
  }));

export interface ProviderInfo {
  id: number;
  name: string;
  logoUrl: string | null;
}
export interface WatchProviders {
  link: string | null;
  flatrate: ProviderInfo[];
  rent: ProviderInfo[];
  buy: ProviderInfo[];
  free: ProviderInfo[];
  ads: ProviderInfo[];
}
function mapProvider(p: any): ProviderInfo {
  return { id: p.provider_id, name: p.provider_name, logoUrl: p.logo_path ? `${IMG_BASE}/w92${p.logo_path}` : null };
}
async function fetchProviders(type: "movie" | "tv", tmdbId: number, region = "IT"): Promise<WatchProviders> {
  const res = await tmdb<any>(`/${type}/${tmdbId}/watch/providers`);
  const r = res.results?.[region] ?? {};
  return {
    link: r.link ?? null,
    flatrate: (r.flatrate ?? []).map(mapProvider),
    rent: (r.rent ?? []).map(mapProvider),
    buy: (r.buy ?? []).map(mapProvider),
    free: (r.free ?? []).map(mapProvider),
    ads: (r.ads ?? []).map(mapProvider),
  };
}

export const tmdbWatchProviders = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ type: z.enum(["movie", "tv"]), tmdbId: z.number().int().positive(), region: z.string().length(2).default("IT") }).parse(data))
  .handler(async ({ data }) => ({ providers: await fetchProviders(data.type, data.tmdbId, data.region) }));

/** Disponibilità a colpo d'occhio per le copertine. */
export type AvailabilityStatus = "streaming" | "theaters" | "upcoming" | "rent" | "none";
export interface AvailabilityInfo {
  status: AvailabilityStatus;
  providers: ProviderInfo[];
  releaseDate?: string | null;
}

/** Tipi TMDB release_dates: 2/3 = cinema, 4 = digitale, 5 = fisico. */
function firstDateOfTypes(rel: any[], types: number[]): string | null {
  const dates = rel
    .filter((d: any) => types.includes(Number(d.type)))
    .map((d: any) => String(d.release_date ?? ""))
    .filter(Boolean)
    .sort();
  return dates[0] ?? null;
}

/**
 * Disponibilità per una lista di titoli, in batch.
 * Una sola chiamata TMDB per titolo grazie ad append_to_response.
 */
export const tmdbAvailability = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    items: z.array(z.object({
      type: z.enum(["movie", "tv"]),
      tmdbId: z.number().int().positive(),
    })).max(40),
    region: z.string().length(2).default("IT"),
  }).parse(data))
  .handler(async ({ data }) => {
    const region = data.region.toUpperCase();
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const availability: Record<string, AvailabilityInfo> = {};

    await Promise.all(data.items.map(async (it) => {
      const key = `${it.type}-${it.tmdbId}`;
      try {
        const append = it.type === "movie" ? "watch/providers,release_dates" : "watch/providers";
        const res = await tmdb<any>(`/${it.type}/${it.tmdbId}`, { append_to_response: append });
        const r = res["watch/providers"]?.results?.[region] ?? {};

        // In abbonamento / gratis / con pubblicità: è la risposta migliore.
        const streaming = [...(r.flatrate ?? []), ...(r.free ?? []), ...(r.ads ?? [])].map(mapProvider);
        if (streaming.length) {
          availability[key] = { status: "streaming", providers: streaming.slice(0, 3) };
          return;
        }

        if (it.type === "movie") {
          const results = res.release_dates?.results ?? [];
          const local = results.find((x: any) => x.iso_3166_1 === region)
            ?? results.find((x: any) => x.iso_3166_1 === "US");
          const rel = local?.release_dates ?? [];
          const theatrical = firstDateOfTypes(rel, [2, 3]);
          const digital = firstDateOfTypes(rel, [4, 5]);

          if (theatrical && theatrical > nowIso) {
            availability[key] = { status: "upcoming", providers: [], releaseDate: theatrical.slice(0, 10) };
            return;
          }
          // Uscito al cinema, non ancora in digitale: verosimilmente ancora in sala.
          if (theatrical && (!digital || digital > nowIso)) {
            const days = (Date.now() - Date.parse(theatrical)) / 86_400_000;
            if (days <= 120) {
              availability[key] = { status: "theaters", providers: [], releaseDate: theatrical.slice(0, 10) };
              return;
            }
          }
          // Nessuna data per la regione ma uscita globale futura.
          if (!theatrical && res.release_date && String(res.release_date) > today) {
            availability[key] = { status: "upcoming", providers: [], releaseDate: String(res.release_date) };
            return;
          }
        }

        const rentBuy = [...(r.rent ?? []), ...(r.buy ?? [])].map(mapProvider);
        availability[key] = rentBuy.length
          ? { status: "rent", providers: rentBuy.slice(0, 3) }
          : { status: "none", providers: [] };
      } catch {
        availability[key] = { status: "none", providers: [] };
      }
    }));

    return { availability };
  });

export interface UpcomingMovie extends TmdbItem {
  releaseDate: string;
  providers: ProviderInfo[];
}
export const tmdbUpcomingMovies = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ region: z.string().length(2).default("IT"), locale: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const res = await tmdb<any>(`/discover/movie`, {
      region: data.region,
      sort_by: "popularity.desc",
      "primary_release_date.gte": fmt(now),
      "primary_release_date.lte": fmt(in90),
      with_release_type: "3|2",
      include_adult: "false",
      page: 1,
    });
    const raws = (res.results ?? []).slice(0, 30);
    const items: UpcomingMovie[] = await Promise.all(raws.map(async (r: any) => {
      const base = mapMulti({ ...r, media_type: "movie" })!;
      let providers: ProviderInfo[] = [];
      try {
        const wp = await fetchProviders("movie", r.id, data.region);
        providers = wp.flatrate.length ? wp.flatrate : wp.rent.length ? wp.rent : wp.buy;
      } catch { /* ignore */ }
      return { ...base, releaseDate: r.release_date ?? "", providers };
    }));
    // Ordine cronologico ascendente (prima le uscite più vicine).
    items.sort((a, b) => {
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return a.releaseDate.localeCompare(b.releaseDate);
    });
    return { items: items.slice(0, 20) };
  }));

export interface NextEpisodeInfo {
  tmdb_id: number;
  title: string;
  posterUrl: string | null;
  status: string;
  nextEpisode: {
    /** "episode" = singolo episodio in onda; "premiere" = prima puntata di una nuova stagione annunciata. */
    kind: "episode" | "premiere";
    season: number;
    /** Presente solo se kind === "episode". */
    episode?: number;
    name: string;
    airDate: string;
    overview: string;
  } | null;
  providers: ProviderInfo[];
}

/** Restituisce true se la serie è chiusa e non avrà più episodi. */
function isDeadSeries(status: string): boolean {
  const s = (status || "").toLowerCase();
  return s === "ended" || s === "canceled" || s === "cancelled";
}

/** Trova il prossimo evento reale per una serie: episodio in arrivo o premiere di stagione. */
async function nextEventForTv(tmdbId: number, region: string, today: string): Promise<NextEpisodeInfo | null> {
  let det: any;
  try {
    det = await tmdb<any>(`/tv/${tmdbId}`, { append_to_response: "next_episode_to_air" });
  } catch {
    return null;
  }
  const status: string = det.status ?? "";
  const title: string = det.name ?? "Serie";
  const poster = posterUrl(det.poster_path);

  // 1) Prossimo episodio con air_date reale nel futuro (o oggi).
  const nxt = det.next_episode_to_air;
  let event: NextEpisodeInfo["nextEpisode"] = null;
  if (nxt?.air_date && nxt.air_date >= today) {
    event = {
      kind: "episode",
      season: nxt.season_number,
      episode: nxt.episode_number,
      name: nxt.name ?? "",
      airDate: nxt.air_date,
      overview: nxt.overview ?? "",
    };
  } else {
    // 2) Fallback: cerca la prossima stagione annunciata con air_date valido nel futuro.
    //    Escludi "Season 0" (speciali) e stagioni con air_date nel passato.
    const seasons: any[] = Array.isArray(det.seasons) ? det.seasons : [];
    const future = seasons
      .filter(s => s && s.season_number > 0 && typeof s.air_date === "string" && s.air_date >= today)
      .sort((a, b) => (a.air_date as string).localeCompare(b.air_date as string));
    const premiere = future[0];
    if (premiere) {
      event = {
        kind: "premiere",
        season: premiere.season_number,
        name: premiere.name ?? `Stagione ${premiere.season_number}`,
        airDate: premiere.air_date,
        overview: premiere.overview ?? "",
      };
    }
  }

  // Nessun evento reale → serie senza uscite programmate: la scartiamo a monte.
  if (!event) return null;

  // Se la serie risulta "chiusa" ma abbiamo trovato comunque un evento futuro
  // (raro: TMDB a volte non aggiorna lo status), fidiamoci dell'evento.
  // Se invece non c'è evento e lo status è chiuso, siamo già usciti sopra.

  let providers: ProviderInfo[] = [];
  try {
    const wp = await fetchProviders("tv", tmdbId, region);
    providers = wp.flatrate.length ? wp.flatrate : wp.free.length ? wp.free : wp.ads;
  } catch { /* ignore */ }

  return { tmdb_id: tmdbId, title, posterUrl: poster, status, nextEpisode: event, providers };
}

export const tmdbNextEpisodes = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    tvIds: z.array(z.number().int().positive()).max(30),
    region: z.string().length(2).default("IT"),
    locale: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const today = new Date().toISOString().slice(0, 10);
    const results = await Promise.all(data.tvIds.map(id => nextEventForTv(id, data.region, today)));
    // Filtra: escludi serie chiuse senza eventi + qualsiasi risultato nullo.
    const items = results.filter((x): x is NextEpisodeInfo => {
      if (!x) return false;
      if (isDeadSeries(x.status) && !x.nextEpisode) return false;
      return !!x.nextEpisode;
    });
    // Ordine cronologico crescente sulla data reale dell'evento.
    items.sort((a, b) => a.nextEpisode!.airDate.localeCompare(b.nextEpisode!.airDate));
    return { items };
  }));


/** Serie con episodi in onda nei prossimi N giorni (nuove stagioni, premiere, ecc.). */
export const tmdbUpcomingTv = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    region: z.string().length(2).default("IT"),
    days: z.number().int().min(1).max(120).default(45),
    locale: z.string().optional(),
  }).parse(data ?? {}))
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const now = new Date();
    const later = new Date(now.getTime() + data.days * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    // first_air_date (non air_date): vogliamo serie NUOVE che debuttano nella
    // finestra, non serie qualsiasi con episodi in onda. 2 pagine per avere
    // abbastanza candidati dopo i filtri.
    const pages = await Promise.all([1, 2].map(page => tmdb<any>(`/discover/tv`, {
      sort_by: "popularity.desc",
      "first_air_date.gte": fmt(now),
      "first_air_date.lte": fmt(later),
      watch_region: data.region,
      include_adult: "false",
      page,
    }).catch(() => ({ results: [] }))));
    const raws = pages.flatMap(res => res.results ?? []).slice(0, 40);
    const today = fmt(now);
    // Riusa la stessa logica "episodio o premiere" delle serie seguite → coerenza garantita.
    const details = await Promise.all(raws.map((r: any) => nextEventForTv(r.id, data.region, today)));
    const items = details
      .filter((x): x is NextEpisodeInfo => !!x && !!x.nextEpisode)
      .filter(i => {
        if (isDeadSeries(i.status) && !i.nextEpisode) return false;
        const d = i.nextEpisode!.airDate;
        return d >= today && d <= fmt(later);
      });
    items.sort((a, b) => a.nextEpisode!.airDate.localeCompare(b.nextEpisode!.airDate));
    return { items: items.slice(0, 20) };
  }));

// ============================================================
// Prossimo episodio "personale" per una serie seguita
// ============================================================

export interface NextUnwatchedInfo {
  kind: "episode" | "upcoming" | "premiere";
  season: number;
  episode: number;
  name: string;
  airDate: string | null;
  overview: string;
  stillUrl: string | null;
  aired: boolean;
}

function isAfterEpisode(season: number, episode: number, lastS: number, lastE: number): boolean {
  return season > lastS || (season === lastS && episode > lastE);
}

function computeWatchFrontier(
  watched: string[],
  lastSeason?: number,
  lastEpisode?: number,
): { watched: Set<string>; lastS: number; lastE: number; hasFrontier: boolean } {
  const watchedSet = new Set(watched);
  let lastS = lastSeason ?? 0;
  let lastE = lastEpisode ?? 0;
  for (const key of watched) {
    const m = key.match(/^S(\d+)E(\d+)$/);
    if (!m) continue;
    const s = Number(m[1]);
    const e = Number(m[2]);
    if (s > lastS || (s === lastS && e > lastE)) {
      lastS = s;
      lastE = e;
    }
  }
  return { watched: watchedSet, lastS, lastE, hasFrontier: lastS > 0 && lastE > 0 };
}

async function scanSeasonsForNext(
  tmdbId: number,
  seasons: any[],
  today: string,
  opts: {
    watchedSet: Set<string>;
    lastS: number;
    lastE: number;
    hasFrontier: boolean;
    mode: "after_frontier" | "any_unwatched";
  },
): Promise<NextUnwatchedInfo | null> {
  const { watchedSet, lastS, lastE, hasFrontier, mode } = opts;

  for (const s of seasons) {
    if (mode === "after_frontier" && hasFrontier && s.season_number < lastS) continue;
    if (
      mode === "after_frontier"
      && s.air_date
      && s.air_date > today
      && (!hasFrontier || s.season_number > lastS)
    ) {
      return {
        kind: "premiere",
        season: s.season_number,
        episode: 1,
        name: s.name ?? `Stagione ${s.season_number}`,
        airDate: s.air_date,
        overview: s.overview ?? "",
        stillUrl: posterUrl(s.poster_path),
        aired: false,
      };
    }
    // Se la stagione non si carica NON saltarla in silenzio: proseguire darebbe
    // un episodio di una stagione successiva (sbagliato). Meglio far risalire
    // l'errore e lasciare al chiamante la stima locale.
    const sd: any = await tmdb<any>(`/tv/${tmdbId}/season/${s.season_number}`);
    const eps: any[] = Array.isArray(sd.episodes) ? sd.episodes : [];
    for (const e of eps) {
      const key = `S${e.season_number}E${e.episode_number}`;
      if (mode === "after_frontier") {
        if (hasFrontier) {
          if (!isAfterEpisode(e.season_number, e.episode_number, lastS, lastE)) continue;
        } else if (watchedSet.has(key)) {
          continue;
        }
      } else if (watchedSet.has(key)) {
        continue;
      }
      const aired = !!e.air_date && e.air_date <= today;
      return {
        kind: aired ? "episode" : "upcoming",
        season: e.season_number,
        episode: e.episode_number,
        name: e.name ?? "",
        airDate: e.air_date ?? null,
        overview: e.overview ?? "",
        stillUrl: e.still_path ? `${IMG_BASE}/w300${e.still_path}` : null,
        aired,
      };
    }
  }
  return null;
}

async function findNextUnwatchedEpisode(
  tmdbId: number,
  watched: string[],
  lastSeason?: number,
  lastEpisode?: number,
): Promise<NextUnwatchedInfo | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { watched: watchedSet, lastS, lastE, hasFrontier } = computeWatchFrontier(watched, lastSeason, lastEpisode);

  // NON silenziare gli errori: null qui significa "sei in pari" e farebbe
  // sparire la serie dalla home. Se TMDB non risponde, l'errore deve risalire
  // così il client mostra la stima locale.
  const det: any = await tmdb<any>(`/tv/${tmdbId}`);
  const seasons: any[] = (det.seasons ?? [])
    .filter((s: any) => s && s.season_number > 0 && (s.episode_count ?? 0) > 0)
    .sort((a: any, b: any) => a.season_number - b.season_number);

  // Solo episodi dopo il frontier: se non c'è nulla, l'utente è in pari (o il
  // numbering dell'import supera i dati TMDB) — meglio null che ripescare
  // "buchi" storici pre-frontier (es. S2E33 su una serie completata).
  return scanSeasonsForNext(tmdbId, seasons, today, {
    watchedSet,
    lastS,
    lastE,
    hasFrontier,
    mode: "after_frontier",
  });
}

type ResolvedShowStatus = "watching" | "completed" | "plan_to_watch";

export function formatSeriesStatusLabel(status: string): string {
  const map: Record<string, string> = {
    Ended: "Conclusa",
    "Returning Series": "In onda",
    "In Production": "In produzione",
    Planned: "In programmazione",
    Canceled: "Annullata",
    Cancelled: "Annullata",
  };
  return map[status] ?? status;
}

export interface ShowProgressResult {
  inferredStatus: ResolvedShowStatus;
  seriesEnded: boolean;
  seriesStatus: string;
  seriesStatusLabel: string;
  /** Nessun episodio già uscito da recuperare dopo l'ultimo visto. */
  caughtUp: boolean;
  next: NextUnwatchedInfo | null;
  /** Sposta automaticamente in "Vista" se la serie è chiusa e in pari. */
  shouldAutoComplete: boolean;
}

async function analyzeShowProgress(
  tmdbId: number,
  watched: string[],
  lastSeason?: number,
  lastEpisode?: number,
  currentStatus?: string,
): Promise<ShowProgressResult> {
  const locked = currentStatus === "paused" || currentStatus === "dropped";
  const hasProgress = watched.length > 0 || (lastSeason ?? 0) > 0;

  // Se TMDB non risponde NON si inventa uno stato: senza dati una serie
  // completata verrebbe retrocessa a "in corso" (il sync stati la corrompeva
  // a ogni errore di rete). Meglio lasciare quello che c'è.
  const keepCurrent = (): ShowProgressResult => ({
    inferredStatus: (currentStatus as ResolvedShowStatus) ?? (hasProgress ? "watching" : "plan_to_watch"),
    seriesEnded: false,
    seriesStatus: "",
    seriesStatusLabel: "",
    caughtUp: false,
    next: null,
    shouldAutoComplete: false,
  });

  let seriesStatus = "";
  try {
    const det = await tmdb<any>(`/tv/${tmdbId}`);
    seriesStatus = det.status ?? "";
  } catch {
    return keepCurrent();
  }

  let next: NextUnwatchedInfo | null;
  try {
    next = await findNextUnwatchedEpisode(tmdbId, watched, lastSeason, lastEpisode);
  } catch {
    return keepCurrent();
  }
  const seriesEnded = isDeadSeries(seriesStatus);
  const caughtUp = !next?.aired;

  let inferredStatus: ResolvedShowStatus = "watching";
  if (locked) {
    inferredStatus = (currentStatus as ResolvedShowStatus) ?? "watching";
  } else if (!hasProgress) {
    inferredStatus = "plan_to_watch";
  } else if (next?.aired) {
    inferredStatus = "watching";
  } else if (next) {
    inferredStatus = "watching";
  } else if (seriesEnded) {
    inferredStatus = "completed";
  } else {
    inferredStatus = "watching";
  }

  const shouldAutoComplete =
    !locked
    && inferredStatus === "completed"
    && currentStatus !== "completed";

  return {
    inferredStatus,
    seriesEnded,
    seriesStatus,
    seriesStatusLabel: formatSeriesStatusLabel(seriesStatus),
    caughtUp,
    next,
    shouldAutoComplete,
  };
}

async function inferTvShowStatus(
  tmdbId: number,
  watched: string[],
  lastSeason?: number,
  lastEpisode?: number,
  currentStatus?: string,
): Promise<ResolvedShowStatus> {
  const r = await analyzeShowProgress(tmdbId, watched, lastSeason, lastEpisode, currentStatus);
  return r.inferredStatus;
}

export const tmdbCheckShowProgress = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    tmdbId: z.number().int().positive(),
    watched: z.array(z.string()).default([]),
    lastSeason: z.number().int().positive().optional(),
    lastEpisode: z.number().int().positive().optional(),
    currentStatus: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }): Promise<ShowProgressResult> => {
    return analyzeShowProgress(
      data.tmdbId,
      data.watched,
      data.lastSeason,
      data.lastEpisode,
      data.currentStatus,
    );
  });

export const tmdbResolveShowStatuses = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    items: z.array(z.object({
      tmdbId: z.number().int().positive(),
      watched: z.array(z.string()).default([]),
      lastSeason: z.number().int().positive().optional(),
      lastEpisode: z.number().int().positive().optional(),
      currentStatus: z.string().optional(),
    })).max(12),
  }).parse(data))
  .handler(async ({ data }) => {
    const results = await Promise.all(
      data.items.map(async (item) => ({
        tmdbId: item.tmdbId,
        status: await inferTvShowStatus(
          item.tmdbId,
          item.watched,
          item.lastSeason,
          item.lastEpisode,
          item.currentStatus,
        ),
      })),
    );
    return { results };
  });

export const tmdbNextUnwatched = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    tmdbId: z.number().int().positive(),
    watched: z.array(z.string()).default([]),
    /** Ultimo episodio segnato visto — il prossimo sarà quello immediatamente dopo. */
    lastSeason: z.number().int().positive().optional(),
    lastEpisode: z.number().int().positive().optional(),
    locale: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }): Promise<NextUnwatchedInfo | null> => runWithLocale(data.locale, () =>
    findNextUnwatchedEpisode(
      data.tmdbId,
      data.watched,
      data.lastSeason,
      data.lastEpisode,
    )));

export const tmdbNextUnwatchedBatch = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    items: z.array(z.object({
      tmdbId: z.number().int().positive(),
      watched: z.array(z.string()).default([]),
      lastSeason: z.number().int().positive().optional(),
      lastEpisode: z.number().int().positive().optional(),
    })).max(24),
    locale: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }): Promise<{ tmdbId: number; next: NextUnwatchedInfo }[]> => runWithLocale(data.locale, async () => {
    const results = await Promise.all(
      data.items.map(async (item) => ({
        tmdbId: item.tmdbId,
        next: await findNextUnwatchedEpisode(
          item.tmdbId,
          item.watched,
          item.lastSeason,
          item.lastEpisode,
        ),
      })),
    );
    return results.filter((r): r is { tmdbId: number; next: NextUnwatchedInfo } => !!r.next);
  }));


// ============================================================
// Main Quest — pool candidati TMDB + watchlist
// ============================================================

function parseMediaKey(key: string): { type: "movie" | "tv"; tmdbId: number } | null {
  const m = key.match(/^(tv|movie)-(\d+)$/);
  if (!m) return null;
  return { type: m[1] as "movie" | "tv", tmdbId: Number(m[2]) };
}

async function discoverPage(
  type: "movie" | "tv",
  genreIds: number[],
  page: number,
): Promise<any[]> {
  const params: Record<string, string | number> = {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": 80,
    "vote_average.gte": 6.2,
    page,
  };
  if (genreIds.length) params.with_genres = genreIds.slice(0, 4).join("|");
  if (type === "movie") params.region = "IT";
  else params.watch_region = "IT";

  const path = type === "movie" ? "/discover/movie" : "/discover/tv";
  const res = await tmdb<any>(path, params);
  return res.results ?? [];
}

async function enrichDiscoverRow(r: any, type: "movie" | "tv"): Promise<TmdbItem | null> {
  try {
    const det = await tmdb<any>(`/${type}/${r.id}`);
    return mapDetail(det, type);
  } catch {
    const base = mapMulti({ ...r, media_type: type });
    return base;
  }
}

async function similarItems(type: "movie" | "tv", tmdbId: number, limit = 8): Promise<TmdbItem[]> {
  try {
    const res = await tmdb<any>(`/${type}/${tmdbId}/similar`, { page: 1 });
    const rows = (res.results ?? []).slice(0, limit);
    return (await Promise.all(rows.map((r: any) => enrichDiscoverRow(r, type)))).filter(Boolean) as TmdbItem[];
  } catch {
    return [];
  }
}

async function recommendationItems(type: "movie" | "tv", tmdbId: number, limit = 6): Promise<TmdbItem[]> {
  try {
    const res = await tmdb<any>(`/${type}/${tmdbId}/recommendations`, { page: 1 });
    const rows = (res.results ?? []).slice(0, limit);
    return (await Promise.all(rows.map((r: any) => enrichDiscoverRow(r, type)))).filter(Boolean) as TmdbItem[];
  } catch {
    return [];
  }
}

async function hiddenGemPage(type: "movie" | "tv", page: number): Promise<any[]> {
  const params: Record<string, string | number> = {
    sort_by: "vote_average.desc",
    include_adult: "false",
    "vote_count.gte": 120,
    "vote_average.gte": 7.4,
    page,
  };
  if (type === "movie") {
    params.region = "IT";
    params["with_runtime.lte"] = 180;
  } else {
    params.watch_region = "IT";
  }
  const path = type === "movie" ? "/discover/movie" : "/discover/tv";
  const res = await tmdb<any>(path, params);
  return res.results ?? [];
}

export const tmdbDubbioCandidates = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        mode: z.enum(["movie", "tv", "surprise"]),
        favoriteGenres: z.array(z.string()).optional(),
        moodGenres: z.array(z.string()).optional(),
        watchlistIds: z.array(z.string()).optional(),
        highlyRatedIds: z.array(z.string()).optional(),
        excludeIds: z.array(z.string()).optional(),
        locale: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => runWithLocale(data.locale, async () => {
    const exclude = new Set(data.excludeIds ?? []);
    const genreNames = [...new Set([...(data.favoriteGenres ?? []), ...(data.moodGenres ?? [])])];

    const types: ("movie" | "tv")[] =
      data.mode === "movie" ? ["movie"] : data.mode === "tv" ? ["tv"] : ["movie", "tv"];

    const byKey = new Map<string, ReturnType<typeof tmdbToCatalogItem>>();

    const add = (t: TmdbItem | null, fromWatchlist = false) => {
      if (!t) return;
      const key = `${t.type}-${t.tmdb_id}`;
      if (exclude.has(key)) return;
      byKey.set(key, tmdbToCatalogItem(t, { fromWatchlist }));
    };

    // Trending TMDB
    try {
      const trend = await tmdb<any>("/trending/all/week");
      for (const r of (trend.results ?? []).slice(0, 25)) {
        const mt = r.media_type === "movie" || r.media_type === "tv" ? r.media_type : null;
        if (!mt || !types.includes(mt)) continue;
        add(await enrichDiscoverRow(r, mt));
      }
    } catch {
      /* skip */
    }

    // Watchlist utente (priorità)
    const wl = (data.watchlistIds ?? []).slice(0, 12);
    for (const id of wl) {
      const parsed = parseMediaKey(id);
      if (!parsed) continue;
      if (data.mode === "movie" && parsed.type !== "movie") continue;
      if (data.mode === "tv" && parsed.type !== "tv") continue;
      try {
        const det = await tmdb<any>(`/${parsed.type}/${parsed.tmdbId}`);
        add(mapDetail(det, parsed.type), true);
        const sim = await similarItems(parsed.type, parsed.tmdbId, 5);
        sim.forEach(s => add(s));
        const rec = await recommendationItems(parsed.type, parsed.tmdbId, 5);
        rec.forEach(s => add(s));
      } catch {
        /* skip */
      }
    }

    // Recommendations da titoli votati bene
    const rated = (data.highlyRatedIds ?? []).slice(0, 8);
    for (const id of rated) {
      const parsed = parseMediaKey(id);
      if (!parsed) continue;
      if (data.mode === "movie" && parsed.type !== "movie") continue;
      if (data.mode === "tv" && parsed.type !== "tv") continue;
      try {
        const rec = await recommendationItems(parsed.type, parsed.tmdbId, 6);
        rec.forEach(s => add(s));
        const sim = await similarItems(parsed.type, parsed.tmdbId, 4);
        sim.forEach(s => add(s));
      } catch {
        /* skip */
      }
    }

    // Discover TMDB per genere
    for (const type of types) {
      const ids = tmdbGenreIds(genreNames, type);
      for (const page of [1, 2, 3, 4]) {
        const rows = await discoverPage(type, ids, page);
        for (const r of rows) {
          add(await enrichDiscoverRow(r, type));
        }
      }
    }

    // Hidden gems — buon rating, popolarità media
    for (const type of types) {
      for (const page of [1, 2]) {
        const rows = await hiddenGemPage(type, page);
        for (const r of rows) {
          add(await enrichDiscoverRow(r, type));
        }
      }
    }

    // Fallback popolari se pool troppo piccolo
    if (byKey.size < 40) {
      for (const type of types) {
        for (const page of [1, 2, 3]) {
          const rows = await discoverPage(type, [], page);
          for (const r of rows) add(await enrichDiscoverRow(r, type));
        }
      }
    }

    const items = [...byKey.values()].slice(0, 150);
    return { items, count: items.length };
  }));


