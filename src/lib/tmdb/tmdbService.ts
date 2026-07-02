/**
 * tmdbService — placeholder mock intercambiabile con implementazione reale.
 * In produzione: proxy serverless che tiene la API key server-side.
 */
import { CATALOG, type CatalogItem } from "@/lib/mock-catalog";

export interface TmdbSearchResult {
  results: CatalogItem[];
}

export const tmdbService = {
  async multiSearch(query: string): Promise<TmdbSearchResult> {
    const q = query.trim().toLowerCase();
    if (!q) return { results: CATALOG.slice(0, 12) };
    return { results: CATALOG.filter(c => c.title.toLowerCase().includes(q)) };
  },
  async trending(): Promise<CatalogItem[]> {
    return [...CATALOG].sort((a,b)=>b.popularity-a.popularity).slice(0,12);
  },
  async discover(opts: { type?: "movie"|"tv"; genre?: string; year?: number }): Promise<CatalogItem[]> {
    return CATALOG.filter(c =>
      (!opts.type || c.type === opts.type) &&
      (!opts.genre || c.genres.includes(opts.genre)) &&
      (!opts.year || c.year === opts.year));
  },
  async detail(id: string) {
    return CATALOG.find(c => c.id === id) ?? null;
  },
};
