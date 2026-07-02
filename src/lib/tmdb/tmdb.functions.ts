import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  popularity: number;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  runtimeMin?: number;
  seasons?: number;
  seasonsInfo?: SeasonSummary[];
}

async function tmdb<T = any>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN missing");
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("language", "it-IT");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
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
    popularity: Number(r.popularity ?? 0),
    overview: r.overview ?? "",
    posterUrl: posterUrl(r.poster_path),
    backdropUrl: backdropUrl(r.backdrop_path),
    genres: [],
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
  };
}

export const tmdbSearch = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ query: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const res = await tmdb<any>(`/search/multi`, { query: data.query, include_adult: "false", page: 1 });
    const items = (res.results ?? [])
      .map(mapMulti)
      .filter((x: TmdbItem | null): x is TmdbItem => x !== null)
      .slice(0, 30);
    return { items };
  });

/** Match "best guess" per titolo — usato dall'import CSV TV Time. */
export const tmdbMatchTitles = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    items: z.array(z.object({
      title: z.string().min(1),
      year: z.number().int().optional(),
      type: z.enum(["movie", "tv"]).optional(),
    })).max(80),
  }).parse(data))
  .handler(async ({ data }) => {
    const results = await Promise.all(data.items.map(async (q) => {
      try {
        const endpoint = q.type ? `/search/${q.type}` : `/search/multi`;
        const params: Record<string, string | number> = { query: q.title, include_adult: "false", page: 1 };
        if (q.year && q.type === "movie") params.year = q.year;
        if (q.year && q.type === "tv") params.first_air_date_year = q.year;
        const res = await tmdb<any>(endpoint, params);
        const raws = (res.results ?? []).slice(0, 5);
        const mapped = raws.map((r: any) => mapMulti(q.type ? { ...r, media_type: q.type } : r)).filter((x: TmdbItem | null): x is TmdbItem => !!x);
        mapped.sort((a: TmdbItem, b: TmdbItem) => {
          const ay = q.year && a.year === q.year ? 1 : 0;
          const by = q.year && b.year === q.year ? 1 : 0;
          if (ay !== by) return by - ay;
          const at = a.title.toLowerCase() === q.title.toLowerCase() ? 1 : 0;
          const bt = b.title.toLowerCase() === q.title.toLowerCase() ? 1 : 0;
          if (at !== bt) return bt - at;
          return b.popularity - a.popularity;
        });
        return { query: q, match: mapped[0] ?? null };
      } catch {
        return { query: q, match: null };
      }
    }));
    return { results };
  });



export const tmdbTrending = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ window: z.enum(["day", "week"]).default("week") }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const res = await tmdb<any>(`/trending/all/${data.window}`);
    const items = (res.results ?? [])
      .map(mapMulti)
      .filter((x: TmdbItem | null): x is TmdbItem => x !== null)
      .slice(0, 20);
    return { items };
  });

export const tmdbDetail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ type: z.enum(["movie", "tv"]), tmdbId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const res = await tmdb<any>(`/${data.type}/${data.tmdbId}`);
    return { item: mapDetail(res, data.type) };
  });

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
export const tmdbSeason = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    tmdbId: z.number().int().positive(),
    seasonNumber: z.number().int().min(0),
  }).parse(data))
  .handler(async ({ data }) => {
    const res = await tmdb<any>(`/tv/${data.tmdbId}/season/${data.seasonNumber}`);
    const episodes: EpisodeInfo[] = (res.episodes ?? []).map((e: any) => ({
      episodeNumber: e.episode_number,
      name: e.name ?? `Episodio ${e.episode_number}`,
      overview: e.overview ?? "",
      airDate: e.air_date ?? null,
      runtime: e.runtime ?? null,
      voteAverage: Number(e.vote_average ?? 0),
      voteCount: Number(e.vote_count ?? 0),
      stillUrl: e.still_path ? `${IMG_BASE}/w300${e.still_path}` : null,
    }));
    return {
      seasonNumber: res.season_number,
      name: res.name ?? `Stagione ${res.season_number}`,
      overview: res.overview ?? "",
      posterUrl: res.poster_path ? `${IMG_BASE}/w342${res.poster_path}` : null,
      episodes,
    };
  });

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profileUrl: string | null;
  order: number;
}
export const tmdbCredits = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ type: z.enum(["movie", "tv"]), tmdbId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const res = await tmdb<any>(`/${data.type}/${data.tmdbId}/credits`);
    const cast: CastMember[] = (res.cast ?? [])
      .slice(0, 30)
      .map((c: any) => ({
        id: c.id,
        name: c.name ?? "",
        character: c.character ?? "",
        profileUrl: c.profile_path ? `${IMG_BASE}/w185${c.profile_path}` : null,
        order: c.order ?? 999,
      }));
    return { cast };
  });

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
  .inputValidator((data) => z.object({ personId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const [p, credits] = await Promise.all([
      tmdb<any>(`/person/${data.personId}`),
      tmdb<any>(`/person/${data.personId}/combined_credits`),
    ]);
    // Fallback biography EN se manca in italiano
    let biography: string = p.biography ?? "";
    if (!biography) {
      try {
        const pEn = await tmdb<any>(`/person/${data.personId}`);
        // richiama con lingua override tramite fetch diretta
        const token = process.env.TMDB_READ_ACCESS_TOKEN;
        const url = new URL(`${TMDB_BASE}/person/${data.personId}`);
        url.searchParams.set("language", "en-US");
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
        if (r.ok) { const j = await r.json(); biography = j.biography ?? ""; }
        void pEn;
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
  });

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

export interface UpcomingMovie extends TmdbItem {
  releaseDate: string;
  providers: ProviderInfo[];
}
export const tmdbUpcomingMovies = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ region: z.string().length(2).default("IT") }).parse(data ?? {}))
  .handler(async ({ data }) => {
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
  });

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
  }).parse(data))
  .handler(async ({ data }) => {
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
  });


/** Serie con episodi in onda nei prossimi N giorni (nuove stagioni, premiere, ecc.). */
export const tmdbUpcomingTv = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    region: z.string().length(2).default("IT"),
    days: z.number().int().min(1).max(120).default(45),
  }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const now = new Date();
    const later = new Date(now.getTime() + data.days * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const res = await tmdb<any>(`/discover/tv`, {
      sort_by: "popularity.desc",
      "air_date.gte": fmt(now),
      "air_date.lte": fmt(later),
      watch_region: data.region,
      include_adult: "false",
      page: 1,
    });
    const raws = (res.results ?? []).slice(0, 25);
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
  });

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

export const tmdbNextUnwatched = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    tmdbId: z.number().int().positive(),
    watched: z.array(z.string()).default([]),
  }).parse(data))
  .handler(async ({ data }): Promise<NextUnwatchedInfo | null> => {
    const today = new Date().toISOString().slice(0, 10);
    const watched = new Set(data.watched);
    let det: any;
    try { det = await tmdb<any>(`/tv/${data.tmdbId}`); } catch { return null; }
    const seasons: any[] = (det.seasons ?? [])
      .filter((s: any) => s && s.season_number > 0 && (s.episode_count ?? 0) > 0)
      .sort((a: any, b: any) => a.season_number - b.season_number);

    for (const s of seasons) {
      // Intera stagione ancora nel futuro → premiere annunciata.
      if (s.air_date && s.air_date > today) {
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
      let sd: any;
      try { sd = await tmdb<any>(`/tv/${data.tmdbId}/season/${s.season_number}`); } catch { continue; }
      const eps: any[] = Array.isArray(sd.episodes) ? sd.episodes : [];
      for (const e of eps) {
        const key = `S${e.season_number}E${e.episode_number}`;
        if (watched.has(key)) continue;
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
  });


