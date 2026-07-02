/** Parser CSV per l'export GDPR di TV Time. Robusto ai vari nomi di colonna. */

export interface ParsedRow {
  title: string;
  year?: number;
  type?: "movie" | "tv";
  status?: "watching" | "completed" | "plan_to_watch" | "favorite" | "paused" | "dropped";
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

const TITLE_KEYS = ["title", "show", "show_name", "name", "movie", "movie_name", "series_title", "titolo"];
const YEAR_KEYS = ["year", "release_year", "first_air_year", "anno"];
const TYPE_KEYS = ["type", "media_type", "kind"];
const STATUS_KEYS = ["status", "list", "watchlist", "state"];

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
  return undefined;
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

/* -------------------------------------------------------------------------- */
/*  TV Time GDPR export (multi-CSV / .zip)                                    */
/* -------------------------------------------------------------------------- */

export interface TvTimeImportSummary {
  rows: ParsedRow[];
  counts: {
    shows: number;
    favorites: number;
    forLater: number;
    movies: number;
    episodes: number;
  };
}

/** Legge un mapping filename → CSV text prodotto dall'export GDPR TV Time. */
export function parseTvTimeExport(files: Record<string, string>): TvTimeImportSummary {
  // normalizza le chiavi: prende solo il basename
  const map: Record<string, Record<string, string>[]> = {};
  for (const [path, text] of Object.entries(files)) {
    const name = path.split("/").pop()!.toLowerCase();
    if (!name.endsWith(".csv")) continue;
    try { map[name] = parseCSV(text); } catch { /* skip */ }
  }

  // aggregatori per show (chiave = tv_show_id oppure title)
  type ShowAgg = {
    id?: string;
    title: string;
    isFavorite: boolean;
    forLater: boolean;
    followed: boolean;
    episodesSeen: number;
  };
  const shows = new Map<string, ShowAgg>();
  const keyFor = (id?: string, title?: string) => (id && id.trim()) || `t:${(title || "").toLowerCase()}`;

  const upsert = (id: string | undefined, title: string, patch: Partial<ShowAgg>) => {
    if (!title) return;
    const k = keyFor(id, title);
    const cur = shows.get(k) ?? { id, title, isFavorite: false, forLater: false, followed: false, episodesSeen: 0 };
    shows.set(k, { ...cur, ...patch, id: cur.id ?? id, title: cur.title || title });
  };

  // 1) serie seguite
  for (const r of map["followed_tv_show.csv"] ?? []) {
    if (r["active"] !== "1") continue;
    upsert(r["tv_show_id"], r["tv_show_name"], { followed: true });
  }

  // 2) status speciali (favorite / for_later)
  for (const r of map["user_show_special_status.csv"] ?? []) {
    const s = (r["status"] || "").toLowerCase();
    upsert(r["tv_show_id"], r["tv_show_name"], {
      isFavorite: s === "favorite" ? true : undefined,
      forLater: s === "for_later" ? true : undefined,
    } as Partial<ShowAgg>);
  }

  // 3) episodi visti aggregati per show
  for (const r of map["user_tv_show_data.csv"] ?? []) {
    const n = Number(r["nb_episodes_seen"] || "0");
    upsert(r["tv_show_id"], r["tv_show_name"], {
      episodesSeen: Number.isFinite(n) ? n : 0,
      isFavorite: r["is_favorited"] === "1" ? true : undefined,
      followed: r["is_followed"] === "1" ? true : undefined,
    } as Partial<ShowAgg>);
  }

  // 4) fallback: se manca il conteggio, deriva da seen_episode_source
  if (!map["user_tv_show_data.csv"]) {
    const byShow = new Map<string, number>();
    for (const r of map["seen_episode_source.csv"] ?? []) {
      const k = keyFor(undefined, r["tv_show_name"]);
      byShow.set(k, (byShow.get(k) ?? 0) + 1);
    }
    for (const [k, n] of byShow) {
      const cur = shows.get(k);
      if (cur) shows.set(k, { ...cur, episodesSeen: n });
    }
  }

  // 5) film valutati (poche righe di solito)
  const movies = new Map<string, ParsedRow>();
  for (const r of map["ratings-live-votes.csv"] ?? []) {
    const t = r["movie_name"]?.trim();
    if (!t) continue;
    movies.set(t.toLowerCase(), { title: t, type: "movie", status: "completed" });
  }

  // Costruisce le righe finali
  const rows: ParsedRow[] = [];
  let favCount = 0, laterCount = 0;
  for (const s of shows.values()) {
    if (!s.followed && !s.forLater && !s.isFavorite && s.episodesSeen === 0) continue;
    const status: ParsedRow["status"] = s.isFavorite
      ? "favorite"
      : s.forLater
      ? "plan_to_watch"
      : s.episodesSeen > 0
      ? "watching"
      : "plan_to_watch";
    if (s.isFavorite) favCount++;
    if (s.forLater) laterCount++;
    rows.push({ title: s.title, type: "tv", status });
  }
  for (const m of movies.values()) rows.push(m);

  // dedupe per title+type
  const seen = new Set<string>();
  const unique = rows.filter(r => {
    const k = `${r.type}:${r.title.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const totalEps = Array.from(shows.values()).reduce((a, s) => a + s.episodesSeen, 0);
  return {
    rows: unique,
    counts: {
      shows: unique.filter(r => r.type === "tv").length,
      favorites: favCount,
      forLater: laterCount,
      movies: movies.size,
      episodes: totalEps,
    },
  };
}

/** Estrae un archivio .zip TV Time e restituisce mapping filename → testo CSV. */
export async function readTvTimeZip(file: File): Promise<Record<string, string>> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const out: Record<string, string> = {};
  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      if (entry.dir) return;
      if (!entry.name.toLowerCase().endsWith(".csv")) return;
      out[entry.name] = await entry.async("string");
    }),
  );
  return out;
}

