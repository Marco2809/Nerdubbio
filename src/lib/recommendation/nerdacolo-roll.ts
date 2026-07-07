import type { CatalogItem } from "@/lib/mock-catalog";
import { CATALOG, findById } from "@/lib/mock-catalog";
import type { LibraryState } from "@/lib/php/library-client";
import type { UserMediaEntry } from "@/lib/user-store";
import { buildDubbioProfile, fetchDubbioPool } from "./dubbio-pool";

export const ROLL_POOL_SIZE = 20;
export const ROLL_BENCH_SIZE = 5;
export const ROLL_FETCH_SIZE = ROLL_POOL_SIZE + ROLL_BENCH_SIZE;
export const ROLL_DISCARD_LIMIT = ROLL_BENCH_SIZE;

const fallbackPoster = "linear-gradient(135deg, #1a1033, #4c1d95)";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function entryToCatalogItem(id: string, entry: UserMediaEntry): CatalogItem | null {
  const mock = findById(id);
  if (mock) return mock;

  const m = /^(movie|tv)-(\d+)$/.exec(id);
  if (!m) return null;

  const type = m[1] as "movie" | "tv";
  const tmdb_id = Number(m[2]);
  return {
    id,
    tmdb_id,
    type,
    title: entry.title ?? "Senza titolo",
    year: entry.year ?? 0,
    rating: 7,
    popularity: 50,
    genres: [],
    moods: [],
    overview: "",
    poster: entry.posterUrl ? `url("${entry.posterUrl}") center/cover` : fallbackPoster,
    posterUrl: entry.posterUrl ?? null,
    backdropUrl: entry.backdropUrl ?? null,
  };
}

function unwatchedFromLibrary(state: LibraryState): CatalogItem[] {
  const exclude = new Set([
    ...Object.entries(state.media)
      .filter(([, m]) => m.status === "completed" || m.status === "dropped")
      .map(([id]) => id),
    ...state.dismissed,
  ]);

  return Object.entries(state.media)
    .filter(([id, m]) => !exclude.has(id) && (m.favorite || ["plan_to_watch", "watching"].includes(m.status)))
    .map(([id, m]) => entryToCatalogItem(id, m))
    .filter((c): c is CatalogItem => !!c);
}

function dedupeById(items: CatalogItem[]): CatalogItem[] {
  const seen = new Set<string>();
  return items.filter(i => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

export function pickRollPool(items: CatalogItem[], size = ROLL_POOL_SIZE): CatalogItem[] {
  const unique = dedupeById(items);
  if (unique.length >= size) return shuffle(unique).slice(0, size);

  const seen = new Set(unique.map(i => i.id));
  const extras = CATALOG.filter(c => !seen.has(c.id));
  return shuffle([...unique, ...extras]).slice(0, size);
}

/** Prepara 25 titoli: 20 in pool + 5 di scorta per gli scarti. */
export async function fetchNerdacoloRollPool(state: LibraryState): Promise<CatalogItem[]> {
  const profile = buildDubbioProfile(state);
  const library = unwatchedFromLibrary(state);

  let tmdbPool: CatalogItem[] = [];
  try {
    tmdbPool = await fetchDubbioPool("surprise", profile);
  } catch {
    tmdbPool = CATALOG;
  }

  const merged = dedupeById([...library, ...tmdbPool]);
  return pickRollPool(merged, ROLL_FETCH_SIZE);
}

export function splitRollPool(items: CatalogItem[]): { active: CatalogItem[]; bench: CatalogItem[] } {
  return {
    active: items.slice(0, ROLL_POOL_SIZE),
    bench: items.slice(ROLL_POOL_SIZE, ROLL_FETCH_SIZE),
  };
}

/** Tiro d20 → indice 0..19 nel pool da 20. */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function pickByRoll(pool: CatalogItem[], roll: number): CatalogItem {
  const idx = Math.max(0, Math.min(pool.length - 1, roll - 1));
  return pool[idx]!;
}

export function rollFlavor(roll: number): string {
  if (roll === 20) return "Critico naturale! Il fato è dalla tua parte.";
  if (roll === 1) return "Fallimento critico… ma il binge non si ferma mai.";
  if (roll >= 15) return "Tiro alto — Nerdacolo approva.";
  if (roll <= 5) return "Tiro basso, ma la sfera ha comunque deciso.";
  return "Il d20 ha parlato. Nessun ripensamento.";
}
