/** Parser CSV/JSON per l'export GDPR di TV Time. Robusto ai vari nomi di colonna e formati. */

export interface ParsedRow {
  title: string;
  year?: number;
  type?: "movie" | "tv";
  status?: "watching" | "completed" | "plan_to_watch" | "favorite" | "paused" | "dropped";
  /** Preferito TV Time: flag indipendente dallo stato. */
  favorite?: boolean;
  /** Episodi visti in formato S1E3 (quando disponibili nel CSV). */
  watchedEpisodes?: string[];
  /** Conteggio aggregato TV Time (fallback se mancano i singoli episodi). */
  episodesSeen?: number;
  /** Voto utente 1–10 (da tv_show_rate.csv). */
  rating?: number;
  /** Data visione per episodio (ISO), chiave S1E3. */
  episodeDates?: Record<string, string>;
  /** Numero visioni per episodio, chiave S1E3. */
  episodeWatchCounts?: Record<string, number>;
  tvShowId?: string;
}

/** "Battlestar Galactica (2003)" → titolo pulito + anno per TMDB. */
export function cleanTitleForMatch(title: string): { title: string; year?: number } {
  const paren = title.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (paren) return { title: paren[1].trim(), year: Number(paren[2]) };
  return { title: title.trim() };
}

export function matchQueryFromRow(row: ParsedRow): {
  title: string;
  year?: number;
  type?: "movie" | "tv";
  tvdbId?: number;
} {
  const cleaned = cleanTitleForMatch(row.title);
  // Il tv_show_id dell'export GDPR è l'id TVDB: permette il match TMDB
  // esatto via /find, senza indovinare per titolo.
  const tvdbId = row.tvShowId ? Number(row.tvShowId) : undefined;
  return {
    title: cleaned.title,
    year: row.year ?? cleaned.year,
    type: row.type,
    tvdbId: Number.isFinite(tvdbId) && (tvdbId as number) > 0 ? tvdbId : undefined,
  };
}

export interface TvTimeImportSummary {
  rows: ParsedRow[];
  counts: {
    shows: number;
    favorites: number;
    forLater: number;
    movies: number;
    episodes: number;
  };
  /** File riconosciuti nell'archivio (per debug). */
  filesFound: string[];
}

/** Semplice parser CSV (RFC-4180-ish, gestisce virgolette e virgole nei campi). */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  const [header, ...body] = rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim()));
  if (!header) return [];
  const keys = header.map(h => h.trim().toLowerCase());
  return body.map(r => {
    const o: Record<string, string> = {};
    keys.forEach((k, i) => { o[k] = (r[i] ?? "").trim(); });
    return o;
  });
}

const TITLE_KEYS = ["title", "show", "show_name", "name", "movie", "movie_name", "series_title", "series_name", "tv_show_name", "titolo"];
const YEAR_KEYS = ["year", "release_year", "first_air_year", "anno"];
const TYPE_KEYS = ["type", "media_type", "kind"];
const STATUS_KEYS = ["status", "list", "watchlist", "state"];
const SHOW_KEYS = ["tv_show_name", "show_name", "series_name", "series", "name"];
const SEASON_KEYS = ["episode_season_number", "season_number", "season", "season_num", "s_no"];
const EPISODE_KEYS = ["episode_number", "episode", "episode_num", "ep_no"];

function pickShowId(r: Record<string, string>): string | undefined {
  return r["tv_show_id"] || r["show_id"] || r["series_id"] || r["s_id"] || undefined;
}

function pick(o: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) if (o[k]) return o[k];
  return undefined;
}

function normalizeStatus(s?: string): ParsedRow["status"] {
  if (!s) return undefined;
  const v = s.toLowerCase();
  if (v.includes("watch") && v.includes("later")) return "plan_to_watch";
  if (v.includes("plan") || v.includes("later") || v.includes("not started")) return "plan_to_watch";
  if (v.includes("watching") || v.includes("in progress") || v.includes("up next")) return "watching";
  if (v.includes("complet") || v.includes("watched") || v.includes("finish") || v.includes("seen")) return "completed";
  if (v.includes("favorite") || v.includes("favourite") || v.includes("loved")) return "favorite";
  if (v.includes("paus") || v.includes("hiatus")) return "paused";
  if (v.includes("drop") || v.includes("stopped")) return "dropped";
  if (v === "watch") return "completed";
  return undefined;
}

function episodeKey(season: number, episode: number): string {
  return `S${season}E${episode}`;
}

function parseEpisodeRef(seasonStr?: string, episodeStr?: string): string | null {
  const season = Number(seasonStr);
  const episode = Number(episodeStr);
  if (!Number.isFinite(season) || !Number.isFinite(episode) || season < 1 || episode < 1) return null;
  return episodeKey(season, episode);
}

/** Chiave per serie: sempre per titolo così episodi e follow condividono lo stesso bucket. */
function showKey(_id: string | undefined, title: string): string {
  return `t:${(title || "").toLowerCase().trim()}`;
}

function basename(path: string): string {
  return path.split("/").pop()!.toLowerCase();
}

function csvByPattern(map: Record<string, Record<string, string>[]>, ...patterns: string[]): Record<string, string>[] {
  for (const pattern of patterns) {
    const p = pattern.toLowerCase();
    for (const [path, rows] of Object.entries(map)) {
      const name = basename(path);
      if (name === p || name.includes(p)) return rows;
    }
  }
  return [];
}

function indexCsvFiles(files: Record<string, string>): Record<string, Record<string, string>[]> {
  const map: Record<string, Record<string, string>[]> = {};
  for (const [path, text] of Object.entries(files)) {
    const name = basename(path);
    if (!name.endsWith(".csv")) continue;
    try {
      const rows = parseCSV(text);
      if (map[name]) map[name].push(...rows);
      else map[name] = rows;
    } catch { /* skip */ }
  }
  return map;
}

function collectEpisodeRows(map: Record<string, Record<string, string>[]>): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const pattern of [
    "seen_episode.csv",
    "seen_episode_source.csv",
    "seen_episode_latest.csv",
    "tracking-prod-records.csv",
    "tracking-prod-records-v2.csv",
  ]) {
    const rows = csvByPattern(map, pattern);
    if (rows.length) out.push(...rows);
  }
  return out;
}

type EpisodeAgg = {
  title: string;
  id?: string;
  eps: Set<string>;
  epDates: Map<string, string>;
  epCounts: Map<string, number>;
};

function pickWatchedAt(r: Record<string, string>): string | undefined {
  const raw = r.created_at || r.updated_at || r.watched_at || r.date || "";
  if (!raw.trim()) return undefined;
  const d = new Date(raw.replace(" ", "T"));
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

function addEpisodeToShow(
  episodesByShow: Map<string, EpisodeAgg>,
  showTitle: string | undefined,
  showId: string | undefined,
  seasonStr?: string,
  episodeStr?: string,
  watchedAt?: string,
) {
  if (!showTitle?.trim()) return;
  const ep = parseEpisodeRef(seasonStr, episodeStr);
  if (!ep) return;
  const k = showKey(showId, showTitle);
  const cur = episodesByShow.get(k) ?? {
    title: showTitle.trim(),
    id: showId,
    eps: new Set<string>(),
    epDates: new Map(),
    epCounts: new Map(),
  };
  cur.eps.add(ep);
  cur.epCounts.set(ep, Math.max(cur.epCounts.get(ep) ?? 0, 1));
  if (watchedAt) {
    const prev = cur.epDates.get(ep);
    if (!prev || watchedAt > prev) cur.epDates.set(ep, watchedAt);
  }
  episodesByShow.set(k, cur);
}

function ingestRewatchedRows(
  episodesByShow: Map<string, EpisodeAgg>,
  rows: Record<string, string>[],
) {
  for (const r of rows) {
    const title = pick(r, SHOW_KEYS);
    const showId = pickShowId(r);
    const epNum = pick(r, EPISODE_KEYS);
    if (!epNum) continue;
    const ep = parseEpisodeRef(pick(r, SEASON_KEYS), epNum);
    if (!ep || !title?.trim()) continue;
    const k = showKey(showId, title);
    const cur = episodesByShow.get(k) ?? {
      title: title.trim(),
      id: showId,
      eps: new Set<string>(),
      epDates: new Map(),
      epCounts: new Map(),
    };
    cur.eps.add(ep);
    cur.epCounts.set(ep, (cur.epCounts.get(ep) ?? 1) + 1);
    episodesByShow.set(k, cur);
  }
}

function ingestEpisodeRows(
  episodesByShow: Map<string, EpisodeAgg>,
  rows: Record<string, string>[],
) {
  for (const r of rows) {
    const title = pick(r, SHOW_KEYS);
    const showId = pickShowId(r);
    const epNum = pick(r, EPISODE_KEYS);
    if (!epNum) continue;
    // Salta righe aggregate / film nel tracking-prod-records
    const entity = (r.entity_type || "").toLowerCase();
    const typeCol = (r.type || "").toLowerCase();
    if (entity === "movie") continue;
    if (typeCol.startsWith("count-watch") || typeCol === "last-episode-watched") continue;
    addEpisodeToShow(episodesByShow, title, showId, pick(r, SEASON_KEYS), epNum, pickWatchedAt(r));
  }
}

function ingestJsonEpisodes(episodesByShow: Map<string, EpisodeAgg>, data: unknown) {
  const list = Array.isArray(data) ? data : (data && typeof data === "object" && Array.isArray((data as { episodes?: unknown }).episodes))
    ? (data as { episodes: unknown[] }).episodes
    : null;
  if (!list) return;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = String(o.tv_show_name ?? o.show_name ?? o.series_name ?? o.name ?? "");
    const showId = o.tv_show_id != null ? String(o.tv_show_id) : o.show_id != null ? String(o.show_id) : undefined;
    addEpisodeToShow(
      episodesByShow,
      title,
      showId,
      String(o.episode_season_number ?? o.season_number ?? o.season ?? ""),
      String(o.episode_number ?? o.episode ?? ""),
      typeof o.created_at === "string" ? pickWatchedAt({ created_at: o.created_at }) : undefined,
    );
  }
}

/** Esclude chiavi di configurazione TV Time (user_setting.csv) scambiate per titoli. */
export function isLikelyMediaTitle(title: string): boolean {
  const t = title.trim();
  if (!t || t.length > 200) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (/^(signup|show_skip|profile_giftbox|auto_share|episode_airing|latest-version|locale|last_time|last_reco|last_notifications)/i.test(t)) {
    return false;
  }
  // snake_case senza spazi → impostazioni app, non titoli
  if (!/\s/.test(t) && /_/.test(t) && !/[A-Z]/.test(t)) return false;
  // kebab-case tutto minuscolo con keyword da settings
  if (!/\s/.test(t) && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(t)) {
    if (/hint|signup|giftbox|popover|skip|cta|min-days|text-color|bg-color|style|smart-categories|notifications|loaded|version/.test(t)) {
      return false;
    }
  }
  return true;
}

const MOVIE_NAME_KEYS = ["movie_name", "title", "film_name", "film"];
const MOVIE_NAME_FALLBACK_KEYS = ["name"];
const MOVIE_YEAR_KEYS = ["year", "release_year", "first_release_date", "first_air_year", "release_date"];

function metaOf(o: Record<string, unknown>): Record<string, unknown> | null {
  const meta = o.meta;
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta as Record<string, unknown> : null;
}

function parseYearFromValue(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).slice(0, 4));
  return Number.isFinite(n) && n > 1888 ? n : undefined;
}

function pickMovieTitle(r: Record<string, string>, filename: string): string | undefined {
  const direct = pick(r, MOVIE_NAME_KEYS);
  if (direct) return direct;
  const fn = filename.toLowerCase();
  if (/movie|film|rating.*vote/.test(fn)) return pick(r, MOVIE_NAME_FALLBACK_KEYS);
  return undefined;
}

function movieStatusFromCsv(r: Record<string, string>): ParsedRow["status"] {
  return normalizeStatus(pick(r, STATUS_KEYS)) ?? normalizeStatus(pick(r, TYPE_KEYS)) ?? "completed";
}

function extractJsonRecords(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.objects)) return o.objects;
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.records)) return o.records;
  if (Array.isArray(o.movies)) return o.movies;
  if (Array.isArray(o.episodes)) return o.episodes;
  if (o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    if (Array.isArray(d.objects)) return d.objects;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.movies)) return d.movies;
    if (Array.isArray(d.episodes)) return d.episodes;
  }
  return [];
}

function isJsonTvEpisodeItem(o: Record<string, unknown>): boolean {
  if (o.tv_show_name || o.show_name || o.series_name) return true;
  if (o.episode_number != null || o.episode_id != null) return true;
  if (Array.isArray(o.seasons)) return true;
  const meta = metaOf(o);
  if (meta?.season_count != null || meta?.number_of_seasons != null) return true;
  const entity = String(o.entity_type ?? o.entityType ?? o.media_type ?? meta?.entity_type ?? meta?.type ?? "").toLowerCase();
  return entity === "show" || entity === "tv" || entity === "series" || entity === "episode";
}

function isJsonMovieItem(o: Record<string, unknown>, filename = ""): boolean {
  if (isJsonTvEpisodeItem(o)) return false;
  const meta = metaOf(o);
  const entity = String(
    o.entity_type ?? o.entityType ?? o.media_type ?? meta?.entity_type ?? meta?.type ?? "",
  ).toLowerCase();
  if (entity.includes("movie") || entity === "film") return true;
  if (entity === "show" || entity === "tv" || entity === "series") return false;
  if (o.movie_name) return true;
  if (meta?.name && !o.episode_number) return true;
  const fn = filename.toLowerCase();
  if ((fn.includes("movie") || fn.includes("film")) && (meta?.name || o.title || o.name)) return true;
  return false;
}

function ingestJsonMovieObject(movies: Map<string, ParsedRow>, o: Record<string, unknown>) {
  const meta = metaOf(o);
  const title = String(o.movie_name ?? meta?.name ?? o.title ?? o.name ?? "").trim();
  if (!title) return;
  const year = parseYearFromValue(
    o.year ?? o.release_date ?? meta?.first_release_date ?? meta?.release_date ?? meta?.year,
  );
  const status =
    normalizeStatus(String(o.status ?? o.state ?? "")) ??
    (o.watched_at || o.is_watched === true || String(o.type ?? "").toLowerCase() === "watch"
      ? "completed"
      : normalizeStatus(String(o.type ?? ""))) ??
    "completed";
  const key = title.toLowerCase();
  const prev = movies.get(key);
  movies.set(key, {
    title,
    type: "movie",
    status: prev?.status ?? status,
    year: year ?? prev?.year,
  });
}

function ingestJsonPayload(
  movies: Map<string, ParsedRow>,
  episodesByShow: Map<string, EpisodeAgg>,
  data: unknown,
  filename: string,
) {
  const records = extractJsonRecords(data);
  if (!records.length && data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (isJsonMovieItem(o, filename)) ingestJsonMovieObject(movies, o);
    return;
  }
  const fn = filename.toLowerCase();
  const movieHint = fn.includes("movie") || fn.includes("film");
  const showHint = fn.includes("show") || fn.includes("episode") || fn.includes("series");

  for (const item of records) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (isJsonTvEpisodeItem(o) || (showHint && !isJsonMovieItem(o, filename))) {
      ingestJsonEpisodes(episodesByShow, [item]);
      continue;
    }
    if (isJsonMovieItem(o, filename) || movieHint) {
      ingestJsonMovieObject(movies, o);
    }
  }
}

function ingestMovieCsvRow(
  movies: Map<string, ParsedRow>,
  r: Record<string, string>,
  filename: string,
) {
  if (r.tv_show_id || r.tv_show_name || r.episode_number || r.episode_id) return;
  const entity = (r.entity_type || r.media_type || "").toLowerCase();
  if (entity === "show" || entity === "tv" || entity === "series") return;

  const title = pickMovieTitle(r, filename);
  if (!title || !isLikelyMediaTitle(title)) return;

  const fn = filename.toLowerCase();
  const looksTvFile = /tv_show|episode|followed_tv|seen_episode|user_tv|special_status/.test(fn);
  if (looksTvFile && !fn.includes("movie")) return;

  const year = parseYearFromValue(pick(r, MOVIE_YEAR_KEYS));
  addMovieToMap(movies, title, movieStatusFromCsv(r), year);
}

function mergeShowStatus(a?: ParsedRow["status"], b?: ParsedRow["status"]): ParsedRow["status"] {
  const rank: Record<string, number> = {
    favorite: 5,
    watching: 4,
    completed: 3,
    plan_to_watch: 2,
    paused: 1,
    dropped: 0,
  };
  const pick = (s?: ParsedRow["status"]) => (s ? rank[s] ?? 0 : -1);
  return (pick(a) >= pick(b) ? a : b) ?? "plan_to_watch";
}

function mergeParsedRows(prev: ParsedRow, next: ParsedRow): ParsedRow {
  const watched = new Set([...(prev.watchedEpisodes ?? []), ...(next.watchedEpisodes ?? [])]);
  const watchedList = [...watched].sort();
  const dates: Record<string, string> = { ...(prev.episodeDates ?? {}), ...(next.episodeDates ?? {}) };
  const counts: Record<string, number> = { ...(prev.episodeWatchCounts ?? {}), ...(next.episodeWatchCounts ?? {}) };
  for (const ep of watchedList) {
    const a = prev.episodeWatchCounts?.[ep] ?? 0;
    const b = next.episodeWatchCounts?.[ep] ?? 0;
    counts[ep] = Math.max(a, b, watched.has(ep) ? 1 : 0);
  }
  const episodesSeen = Math.max(prev.episodesSeen ?? 0, next.episodesSeen ?? 0, watchedList.length);
  const rating = Math.max(prev.rating ?? 0, next.rating ?? 0) || undefined;
  return {
    ...prev,
    ...next,
    tvShowId: prev.tvShowId ?? next.tvShowId,
    year: prev.year ?? next.year,
    watchedEpisodes: watchedList.length ? watchedList : undefined,
    episodeDates: Object.keys(dates).length ? dates : undefined,
    episodeWatchCounts: Object.keys(counts).length ? counts : undefined,
    episodesSeen: episodesSeen > 0 ? episodesSeen : undefined,
    rating: rating && rating > 0 ? rating : undefined,
    favorite: prev.favorite || next.favorite || undefined,
    status: mergeShowStatus(prev.status, next.status),
  };
}

/** Normalizza eventuali status "favorite" residui (film/liste) nel flag + stato reale. */
function normalizeFavoriteRow(r: ParsedRow): ParsedRow {
  if (r.status !== "favorite") return r;
  const hasProgress = (r.watchedEpisodes?.length ?? 0) > 0 || (r.episodesSeen ?? 0) > 0;
  const status: ParsedRow["status"] = r.type === "movie"
    ? "completed"
    : hasProgress ? "watching" : "plan_to_watch";
  return { ...r, favorite: true, status };
}

/** TV Time usa 0–5 stelle; Nerdubbio 1–10. */
function tvTimeRatingToApp(raw: string | undefined): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n <= 5) return Math.min(10, Math.max(1, Math.round(n * 2)));
  return Math.min(10, Math.max(1, Math.round(n)));
}

function mergeMovieStatus(
  prev?: ParsedRow["status"],
  next?: ParsedRow["status"],
): ParsedRow["status"] {
  if (prev === "completed" || next === "completed") return "completed";
  if (prev === "watching" || next === "watching") return "watching";
  if (prev === "favorite" || next === "favorite") return "favorite";
  return next ?? prev ?? "completed";
}

function ingestTrackingProdRecordsMovies(
  movies: Map<string, ParsedRow>,
  rows: Record<string, string>[],
) {
  for (const r of rows) {
    const entity = (r.entity_type || "").toLowerCase();
    const typeCol = (r.type || "").toLowerCase();
    if (typeCol.startsWith("count-watch")) continue;
    if (entity === "episode") continue;

    const title = r.movie_name?.trim();
    if (!title || !isLikelyMediaTitle(title)) continue;
    if (entity && entity !== "movie") continue;

    const year = parseYearFromValue(r.release_date);
    let status: ParsedRow["status"];
    if (typeCol === "watch") status = "completed";
    else if (typeCol === "follow") status = "plan_to_watch";
    else status = movieStatusFromCsv(r);

    const key = title.toLowerCase();
    const prev = movies.get(key);
    movies.set(key, {
      title,
      type: "movie",
      status: mergeMovieStatus(prev?.status, status),
      year: year ?? prev?.year,
    });
  }
}

const SKIP_MOVIE_SCAN = new RegExp(
  [
    "comments-prod",
    "lists-prod",
    "notifications-prod",
    "recommendations-prod",
    "stats-prod",
    "tracking-prod-count",
    "tracking-deployment",
    "where-to-watch",
    "user_connection",
    "user_facebook",
    "user_quiz",
    "user_badge",
    "user_setting",
    "user_session",
    "user_statistics",
    "user_personal",
    "user_social",
    "user_platform",
    "user_device",
    "user_list",
    "user_object",
    "user_last",
    "^user\\.csv$",
    "friend\\.csv",
    "profile_comment",
    "auth-prod",
    "access_token",
    "refresh_token",
    "device_",
    "webhook",
    "ip_address",
    "installed_app",
    "gdpr_requests",
    "install_tracking",
    "ad_identifier",
    "_appsflyer",
    "show_addiction",
    "show_character",
    "episode_comments",
    "seen_episode_latest",
    "show_seen_episode",
    "tv_show_rate",
    "followed_tv_show_source",
  ].join("|"),
  "i",
);

function addMovieToMap(
  movies: Map<string, ParsedRow>,
  title: string,
  status: ParsedRow["status"] = "completed",
  year?: number,
) {
  const t = title.trim();
  if (!t || !isLikelyMediaTitle(t)) return;
  const key = t.toLowerCase();
  const prev = movies.get(key);
  movies.set(key, {
    title: t,
    type: "movie",
    status: mergeMovieStatus(prev?.status, status),
    year: year ?? prev?.year,
  });
}

function scanAllCsvForMovies(
  csvMap: Record<string, Record<string, string>[]>,
  movies: Map<string, ParsedRow>,
) {
  for (const [filename, rows] of Object.entries(csvMap)) {
    if (SKIP_MOVIE_SCAN.test(filename)) continue;
    if (filename === "tracking-prod-records.csv") continue;
    for (const r of rows) ingestMovieCsvRow(movies, r, filename);
  }
}

/** Interpreta le righe grezze del CSV in ParsedRow tipizzati. */
export function toParsedRows(rows: Record<string, string>[], kind?: "movie" | "tv"): ParsedRow[] {
  return rows.map(r => {
    const title = pick(r, TITLE_KEYS);
    if (!title) return null;
    const yearStr = pick(r, YEAR_KEYS);
    const year = yearStr ? Number(String(yearStr).slice(0, 4)) : undefined;
    const typeRaw = pick(r, TYPE_KEYS)?.toLowerCase();
    const type: ParsedRow["type"] =
      kind ??
      (typeRaw === "movie" || typeRaw === "film" ? "movie"
        : typeRaw === "tv" || typeRaw === "show" || typeRaw === "series" ? "tv"
        : undefined);
    return {
      title,
      year: Number.isFinite(year) ? year : undefined,
      type,
      status: normalizeStatus(pick(r, STATUS_KEYS)),
    } as ParsedRow;
  }).filter((x): x is ParsedRow => !!x);
}

/** Legge un mapping filename → CSV/JSON text prodotto dall'export GDPR TV Time. */
export function parseTvTimeExport(files: Record<string, string>): TvTimeImportSummary {
  const csvMap = indexCsvFiles(files);
  const filesFound = [
    ...Object.keys(csvMap).map(n => n),
    ...Object.keys(files).filter(p => basename(p).endsWith(".json")),
  ];

  type ShowAgg = {
    id?: string;
    title: string;
    isFavorite: boolean;
    forLater: boolean;
    followed: boolean;
    episodesSeen: number;
    rating?: number;
    watchedEpisodes: Set<string>;
    episodeDates: Map<string, string>;
    episodeWatchCounts: Map<string, number>;
  };
  const shows = new Map<string, ShowAgg>();
  const episodesByShow = new Map<string, EpisodeAgg>();

  const upsert = (id: string | undefined, title: string, patch: Partial<ShowAgg>) => {
    if (!title) return;
    const k = showKey(id, title);
    const cur = shows.get(k) ?? {
      id,
      title,
      isFavorite: false,
      forLater: false,
      followed: false,
      episodesSeen: 0,
      watchedEpisodes: new Set<string>(),
      episodeDates: new Map<string, string>(),
      episodeWatchCounts: new Map<string, number>(),
    };
    shows.set(k, {
      ...cur,
      ...patch,
      id: cur.id ?? id,
      title: cur.title || title,
      watchedEpisodes: patch.watchedEpisodes ?? cur.watchedEpisodes,
    });
  };

  // 1) serie seguite
  for (const r of csvByPattern(csvMap, "followed_tv_show.csv")) {
    if (r["active"] !== "1") continue;
    upsert(r["tv_show_id"], r["tv_show_name"] || r["name"], { followed: true });
  }

  // 2) status speciali (favorite / for_later)
  for (const r of csvByPattern(csvMap, "user_show_special_status.csv")) {
    const s = (r["status"] || "").toLowerCase();
    upsert(r["tv_show_id"], r["tv_show_name"], {
      isFavorite: s === "favorite" ? true : undefined,
      forLater: s === "for_later" ? true : undefined,
    } as Partial<ShowAgg>);
  }

  // 3b) voti serie (tv_show_rate.csv)
  for (const r of csvByPattern(csvMap, "tv_show_rate.csv")) {
    const rating = tvTimeRatingToApp(r.rating);
    if (!rating) continue;
    upsert(r.tv_show_id, r.tv_show_name, { rating } as Partial<ShowAgg>);
  }

  // 3) aggregati per show
  for (const r of csvByPattern(csvMap, "user_tv_show_data.csv")) {
    const n = Number(r["nb_episodes_seen"] || "0");
    upsert(r["tv_show_id"], r["tv_show_name"], {
      episodesSeen: Number.isFinite(n) ? n : 0,
      isFavorite: r["is_favorited"] === "1" ? true : undefined,
      followed: r["is_followed"] === "1" ? true : undefined,
    } as Partial<ShowAgg>);
  }

  // 4) episodi singoli (fonte principale per S1E3)
  ingestEpisodeRows(episodesByShow, collectEpisodeRows(csvMap));
  ingestRewatchedRows(episodesByShow, csvByPattern(csvMap, "rewatched_episode.csv"));
  for (const [k, agg] of episodesByShow) {
    const watched = [...agg.eps];
    const cur = shows.get(k);
    if (cur) {
      for (const ep of watched) cur.watchedEpisodes.add(ep);
      for (const [ep, dt] of agg.epDates) {
        const prev = cur.episodeDates.get(ep);
        if (!prev || dt > prev) cur.episodeDates.set(ep, dt);
      }
      for (const [ep, cnt] of agg.epCounts) {
        cur.episodeWatchCounts.set(ep, Math.max(cur.episodeWatchCounts.get(ep) ?? 0, cnt));
      }
      cur.episodesSeen = Math.max(cur.episodesSeen, watched.length);
    } else {
      shows.set(k, {
        id: agg.id,
        title: agg.title,
        isFavorite: false,
        forLater: false,
        followed: true,
        episodesSeen: watched.length,
        watchedEpisodes: new Set(watched),
        episodeDates: new Map(agg.epDates),
        episodeWatchCounts: new Map(agg.epCounts),
      });
    }
  }

  // 5) film — tracking-prod-records.csv (formato GDPR TV Time classico)
  const movies = new Map<string, ParsedRow>();

  ingestTrackingProdRecordsMovies(movies, csvByPattern(csvMap, "tracking-prod-records.csv"));

  for (const r of csvByPattern(csvMap, "ratings-live-votes.csv")) {
    const t = pickMovieTitle(r, "ratings-live-votes.csv");
    if (t) addMovieToMap(movies, t, "completed");
  }

  for (const r of csvByPattern(
    csvMap,
    "user_movie_data.csv",
    "followed_movie.csv",
    "movie_watched.csv",
    "movies.csv",
  )) {
    ingestMovieCsvRow(movies, r, "user_movie_data.csv");
  }

  scanAllCsvForMovies(csvMap, movies);

  // 6) JSON (export recenti TV Time — spesso solo JSON, zero CSV)
  for (const [path, text] of Object.entries(files)) {
    if (!basename(path).endsWith(".json")) continue;
    try {
      ingestJsonPayload(movies, episodesByShow, JSON.parse(text) as unknown, basename(path));
    } catch { /* skip malformed json */ }
  }

  // Re-merge episodi JSON nel map shows
  for (const [k, agg] of episodesByShow) {
    const cur = shows.get(k);
    if (cur) {
      for (const ep of agg.eps) cur.watchedEpisodes.add(ep);
      for (const [ep, dt] of agg.epDates) {
        const prev = cur.episodeDates.get(ep);
        if (!prev || dt > prev) cur.episodeDates.set(ep, dt);
      }
      for (const [ep, cnt] of agg.epCounts) {
        cur.episodeWatchCounts.set(ep, Math.max(cur.episodeWatchCounts.get(ep) ?? 0, cnt));
      }
      cur.episodesSeen = Math.max(cur.episodesSeen, cur.watchedEpisodes.size);
    }
  }

  const rows: ParsedRow[] = [];
  let favCount = 0, laterCount = 0;
  for (const s of shows.values()) {
    if (!s.followed && !s.forLater && !s.isFavorite && s.episodesSeen === 0 && s.watchedEpisodes.size === 0) continue;
    const watched = [...s.watchedEpisodes].sort();
    // "favorite" è un flag, non uno stato: lo stato viene dal progresso.
    const status: ParsedRow["status"] = s.forLater
      ? "plan_to_watch"
      : watched.length > 0 || s.episodesSeen > 0
      ? "watching"
      : "plan_to_watch";
    if (s.isFavorite) favCount++;
    if (s.forLater) laterCount++;
    rows.push({
      title: s.title,
      type: "tv",
      status,
      favorite: s.isFavorite || undefined,
      tvShowId: s.id,
      rating: s.rating,
      watchedEpisodes: watched.length ? watched : undefined,
      episodeDates: s.episodeDates.size ? Object.fromEntries(s.episodeDates) : undefined,
      episodeWatchCounts: s.episodeWatchCounts.size ? Object.fromEntries(s.episodeWatchCounts) : undefined,
      episodesSeen: s.episodesSeen > 0 ? s.episodesSeen : undefined,
    });
  }
  for (const m of movies.values()) rows.push(m);

  const byKey = new Map<string, ParsedRow>();
  for (const r of rows) {
    if (!isLikelyMediaTitle(r.title)) continue;
    const k = `${r.type ?? "tv"}:${r.title.toLowerCase()}`;
    const prev = byKey.get(k);
    byKey.set(k, prev ? mergeParsedRows(prev, r) : r);
  }
  const unique = [...byKey.values()].map(normalizeFavoriteRow);

  const episodeRows = unique.reduce((n, r) => {
    if (r.episodeWatchCounts) {
      return n + Object.values(r.episodeWatchCounts).reduce((s, c) => s + c, 0);
    }
    return n + (r.watchedEpisodes?.length ?? r.episodesSeen ?? 0);
  }, 0);
  return {
    rows: unique,
    counts: {
      shows: unique.filter(r => r.type === "tv").length,
      favorites: favCount,
      forLater: laterCount,
      movies: unique.filter(r => r.type === "movie").length,
      episodes: episodeRows,
    },
    filesFound,
  };
}

function maxWatchedEpisode(watched: string[]): { season: number; episode: number } {
  let maxS = 0;
  let maxE = 0;
  for (const key of watched) {
    const m = key.match(/^S(\d+)E(\d+)$/);
    if (!m) continue;
    const s = Number(m[1]);
    const e = Number(m[2]);
    if (s > maxS || (s === maxS && e > maxE)) {
      maxS = s;
      maxE = e;
    }
  }
  return { season: maxS, episode: maxE };
}

/** Deriva currentSeason/Episode da watchedEpisodes o episodesSeen aggregato. */
export function deriveEpisodeProgress(row: ParsedRow): {
  watchedEpisodes?: string[];
  episodeWatchCounts?: Record<string, number>;
  currentSeason?: number;
  currentEpisode?: number;
} {
  if (row.watchedEpisodes?.length) {
    const { season, episode } = maxWatchedEpisode(row.watchedEpisodes);
    return {
      watchedEpisodes: row.watchedEpisodes,
      episodeWatchCounts: row.episodeWatchCounts,
      currentSeason: season || undefined,
      currentEpisode: episode || undefined,
    };
  }
  if (row.episodesSeen && row.episodesSeen > 0 && !row.watchedEpisodes?.length) {
    // Solo conteggio aggregato — non inventare S1E1..N (fuorviante su serie lunghe)
    return { episodesSeen: row.episodesSeen };
  }
  return {};
}

export interface TvTimePendingItem {
  id: string;
  title: string;
  year?: number;
  type?: "movie" | "tv";
  status?: ParsedRow["status"];
  watchedEpisodes?: string[];
  episodesSeen?: number;
  episodeDates?: Record<string, string>;
  rating?: number;
  source: "tvtime";
  addedAt: string;
}

export function pendingFromRow(row: ParsedRow): TvTimePendingItem {
  const progress = deriveEpisodeProgress(row);
  return {
    id: `pending:${row.type ?? "tv"}:${row.title.toLowerCase().replace(/\s+/g, "-")}`,
    title: row.title,
    year: row.year,
    type: row.type,
    status: row.status,
    watchedEpisodes: progress.watchedEpisodes,
    episodesSeen: row.episodesSeen,
    episodeDates: row.episodeDates,
    rating: row.rating,
    source: "tvtime",
    addedAt: new Date().toISOString(),
  };
}

/** Estrae un archivio .zip TV Time e restituisce mapping filename → testo CSV/JSON. */
export async function readTvTimeZip(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Record<string, string>> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const out: Record<string, string> = {};
  const entries = Object.values(zip.files).filter(e => {
    if (e.dir) return false;
    const lower = e.name.toLowerCase();
    return lower.endsWith(".csv") || lower.endsWith(".json");
  });
  const total = entries.length || 1;
  let loaded = 0;
  await Promise.all(
    entries.map(async (entry) => {
      out[entry.name] = await entry.async("string");
      loaded++;
      onProgress?.(loaded, total);
    }),
  );
  return out;
}
