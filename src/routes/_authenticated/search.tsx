import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { Search as SearchIcon, Loader2, BookmarkCheck, SlidersHorizontal, X, Star, Plus, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { tmdbSearch, tmdbTrending, tmdbDiscover, type TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { Link } from "@tanstack/react-router";
import { useUserStore } from "@/lib/user-store";
import { isMediaAlreadyWatched } from "@/lib/library-display";
import { useReturnPath } from "@/lib/media-nav";
import { useI18n, pageTitle } from "@/lib/i18n";
import { useTmdbLocale } from "@/lib/tmdb/use-tmdb-locale";
import { toast } from "@/lib/toast";

type SearchType = "all" | "movie" | "tv";
type PersistedSearch = {
  q: string; type: SearchType; genres: string[]; minRating: number;
  sort: SortMode; yearPreset: YearPreset; hideWatched: boolean; hideInLibrary: boolean; showFilters: boolean;
};
const SEARCH_STATE_KEY = "nerdubbio:search-state:v1";

function loadSearchState(): Partial<PersistedSearch> {
  if (typeof sessionStorage === "undefined") return {};
  try { return JSON.parse(sessionStorage.getItem(SEARCH_STATE_KEY) ?? "{}") as Partial<PersistedSearch>; }
  catch { return {}; }
}

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: pageTitle("search") }] }),
  component: SearchPage,
});

const GENRES = ["Sci-Fi","Drama","Comedy","Fantasy","Thriller","Action","Animation","Romance","Mystery","Crime","Horror"];
type SortMode = "popularity" | "rating" | "recent";
type YearPreset = "any" | "2020" | "2010" | "2000" | "classic";

const YEAR_RANGES: Record<YearPreset, { from?: number; to?: number }> = {
  any: {},
  "2020": { from: 2020 },
  "2010": { from: 2010, to: 2019 },
  "2000": { from: 2000, to: 2009 },
  classic: { to: 1999 },
};

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function TmdbCard({ item }: { item: TmdbItem }) {
  const { t } = useI18n();
  const { state, addToList } = useUserStore();
  const from = useReturnPath();
  const entry = state.media[item.id];
  const inLibrary = !!entry;
  const isWatched = isMediaAlreadyWatched(entry);

  const addToWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inLibrary) return;
    void addToList(item.id, "plan_to_watch", {
      title: item.title, type: item.type, year: item.year,
      posterUrl: item.posterUrl ?? null, backdropUrl: item.backdropUrl ?? null,
    })
      .then(() => toast.success(t("search.addedToWatchlist", { title: item.title })))
      .catch((err: unknown) => toast.error(t("media.saveStatusError"), {
        description: err instanceof Error ? err.message : undefined,
      }));
  };

  return (
    <Link
      to="/media/$type/$id"
      params={{ type: item.type, id: String(item.tmdb_id) }}
      state={{ from }}
      className="group block"
    >
      <div
        className="relative h-56 overflow-hidden rounded-2xl bg-surface-2 shadow-glow"
        style={item.posterUrl ? undefined : { background: "linear-gradient(135deg,#3b1361,#0ea5e9)" }}
      >
        {item.posterUrl && (
          <img src={item.posterUrl} alt={item.title} loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold">
          <Star className="h-3 w-3 fill-accent text-accent" /> {item.rating.toFixed(1)}
        </div>

        {/* + sempre disponibile: aggiunge a "Da vedere" senza aprire il dettaglio */}
        <button
          type="button"
          onClick={addToWatchlist}
          aria-label={inLibrary ? t("search.inList") : t("search.addToWatchlist")}
          className={`absolute bottom-2 right-2 z-10 grid h-9 w-9 place-items-center rounded-full shadow-glow-pink transition active:scale-90 ${
            inLibrary ? "bg-black/70 text-accent" : "bg-hero text-primary-foreground"
          }`}
        >
          {inLibrary ? <Check className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
        </button>

        {inLibrary && !isWatched && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-hero px-2 py-1 text-[10px] font-bold text-primary-foreground shadow-glow-pink">
            <BookmarkCheck className="h-3 w-3" /> {t("search.inList")}
          </div>
        )}
        {isWatched && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white/90">
            <BookmarkCheck className="h-3 w-3" /> {t("search.watchedBadge")}
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 p-3 pr-12">
          <p className="text-[10px] uppercase tracking-widest text-white/70">
            {item.type === "tv" ? t("home.seriesShort") : t("home.movieShort")}{item.year ? ` · ${item.year}` : ""}
          </p>
          <h3 className="text-sm font-semibold text-white line-clamp-2">{item.title}</h3>
        </div>
      </div>
    </Link>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active ? "border-accent bg-accent/20 text-accent" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SearchPage() {
  const { t } = useI18n();
  const locale = useTmdbLocale();
  const { state: userState } = useUserStore();
  const from = useReturnPath();

  // Stato ripristinato da sessionStorage: tornando dal dettaglio i filtri restano.
  const saved = useMemo(() => loadSearchState(), []);
  const [q, setQ] = useState(saved.q ?? "");
  const [type, setType] = useState<SearchType>(saved.type ?? "all");
  const [genres, setGenres] = useState<string[]>(saved.genres ?? []);
  const [minRating, setMinRating] = useState(saved.minRating ?? 0);
  const [sort, setSort] = useState<SortMode>(saved.sort ?? "popularity");
  const [yearPreset, setYearPreset] = useState<YearPreset>(saved.yearPreset ?? "any");
  const [hideWatched, setHideWatched] = useState(saved.hideWatched ?? true);
  const [hideInLibrary, setHideInLibrary] = useState(saved.hideInLibrary ?? false);
  const [showFilters, setShowFilters] = useState(saved.showFilters ?? false);
  const [page, setPage] = useState(1);

  // Salva lo stato dei filtri a ogni cambio.
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const s: PersistedSearch = { q, type, genres, minRating, sort, yearPreset, hideWatched, hideInLibrary, showFilters };
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(s));
  }, [q, type, genres, minRating, sort, yearPreset, hideWatched, hideInLibrary, showFilters]);

  const debouncedQ = useDebounced(q.trim(), 400);

  // Un filtro è "attivo" se restringe il catalogo → modalità discover.
  const filtersActive =
    genres.length > 0 || minRating > 0 || yearPreset !== "any" || sort !== "popularity" || type !== "all";

  const mode: "search" | "discover" | "trending" = debouncedQ
    ? "search"
    : filtersActive
      ? "discover"
      : "trending";

  // Reset paginazione quando cambiano query o filtri.
  useEffect(() => { setPage(1); }, [debouncedQ, type, genres, minRating, sort, yearPreset, mode]);

  const trending = useQuery({
    queryKey: ["tmdb", "trending", locale],
    queryFn: () => tmdbTrending({ data: { window: "week", locale } }),
    staleTime: 1000 * 60 * 30,
    enabled: mode === "trending",
  });

  const search = useQuery({
    queryKey: ["tmdb", "search", debouncedQ, locale],
    queryFn: () => tmdbSearch({ data: { query: debouncedQ, locale } }),
    enabled: mode === "search",
    staleTime: 1000 * 60 * 10,
  });

  const yr = YEAR_RANGES[yearPreset];
  const discover = useQuery({
    queryKey: ["tmdb", "discover", type, [...genres].sort(), minRating, sort, yearPreset, page, locale],
    queryFn: () => tmdbDiscover({
      data: { type, genres, minRating, sort, yearFrom: yr.from, yearTo: yr.to, page, locale },
    }),
    enabled: mode === "discover",
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 10,
  });

  // Pool grezzo secondo la modalità, con accumulo pagine in discover.
  const [discoverAcc, setDiscoverAcc] = useState<TmdbItem[]>([]);
  useEffect(() => {
    if (mode !== "discover" || !discover.data) return;
    setDiscoverAcc(prev => {
      if (discover.data.page === 1) return discover.data.items;
      const seen = new Set(prev.map(i => i.id));
      return [...prev, ...discover.data.items.filter(i => !seen.has(i.id))];
    });
  }, [discover.data, mode]);

  const raw: TmdbItem[] =
    mode === "search" ? (search.data?.items ?? [])
    : mode === "discover" ? discoverAcc
    : (trending.data?.items ?? []);

  const results = useMemo(() => {
    return raw
      .filter(it => type === "all" || it.type === type)
      .filter(it => minRating <= 0 || it.rating >= minRating)
      .filter(it => {
        const entry = userState.media[it.id];
        if (hideWatched && isMediaAlreadyWatched(entry)) return false;
        if (hideInLibrary && !!entry) return false;
        // In trending, di default nascondi comunque i già visti (come prima).
        if (mode === "trending" && !hideWatched && isMediaAlreadyWatched(entry)) return false;
        return true;
      });
  }, [raw, type, minRating, hideWatched, hideInLibrary, mode, userState.media]);

  const loading = search.isFetching || trending.isFetching || discover.isFetching;
  const activeError = search.error || trending.error || discover.error;

  const resetFilters = () => {
    setGenres([]); setMinRating(0); setSort("popularity"); setYearPreset("any"); setType("all");
  };
  const toggleGenre = (g: string) =>
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const ratingChips = [6, 7, 8, 9];
  const sortOptions: SortMode[] = ["popularity", "rating", "recent"];
  const yearOptions: YearPreset[] = ["any", "2020", "2010", "2000", "classic"];
  const yearLabel: Record<YearPreset, string> = {
    any: t("search.yearAny"), "2020": t("search.year2020"), "2010": t("search.year2010"),
    "2000": t("search.year2000"), classic: t("search.yearClassic"),
  };
  const sortLabel: Record<SortMode, string> = {
    popularity: t("search.sortPopularity"), rating: t("search.sortRating"), recent: t("search.sortRecent"),
  };

  return (
    <AppShell subtitle={t("search.subtitle")} title={t("search.title")}>
      <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder={t("search.placeholder")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
      </div>

      {/* Tipo */}
      <div className="mt-3 flex items-center gap-2">
        {(["all","movie","tv"] as const).map(tab => (
          <button key={tab} onClick={() => setType(tab)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${type===tab ? "bg-hero text-primary-foreground shadow-glow" : "bg-surface-2 text-muted-foreground"}`}>
            {tab === "all" ? t("common.all") : tab === "movie" ? t("home.movieShort") : t("home.seriesShort")}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            showFilters || filtersActive ? "bg-accent/20 text-accent" : "bg-surface-2 text-muted-foreground"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> {t("search.filters")}
        </button>
      </div>

      {/* Generi */}
      <div className="mt-3 -mx-4 overflow-x-auto">
        <div className="flex gap-2 px-4 pb-1">
          {GENRES.map(g => (
            <Chip key={g} active={genres.includes(g)} onClick={() => toggleGenre(g)}>{g}</Chip>
          ))}
        </div>
      </div>

      {/* Pannello filtri avanzati */}
      {showFilters && (
        <div className="mt-3 space-y-3 rounded-2xl border border-border bg-surface/50 p-3">
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("search.minRating")}</p>
            <div className="flex gap-2">
              <Chip active={minRating === 0} onClick={() => setMinRating(0)}>{t("search.yearAny")}</Chip>
              {ratingChips.map(r => (
                <Chip key={r} active={minRating === r} onClick={() => setMinRating(minRating === r ? 0 : r)}>
                  <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-current" />{r}+</span>
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("search.sortBy")}</p>
            <div className="flex gap-2">
              {sortOptions.map(s => <Chip key={s} active={sort === s} onClick={() => setSort(s)}>{sortLabel[s]}</Chip>)}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("search.years")}</p>
            <div className="flex flex-wrap gap-2">
              {yearOptions.map(y => <Chip key={y} active={yearPreset === y} onClick={() => setYearPreset(y)}>{yearLabel[y]}</Chip>)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Chip active={hideWatched} onClick={() => setHideWatched(v => !v)}>{t("search.hideWatched")}</Chip>
            <Chip active={hideInLibrary} onClick={() => setHideInLibrary(v => !v)}>{t("search.hideInLibrary")}</Chip>
            {filtersActive && (
              <button type="button" onClick={resetFilters}
                className="ml-auto flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted-foreground">
                <X className="h-3 w-3" /> {t("search.resetFilters")}
              </button>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {mode === "search"
          ? t("search.resultsFor", { count: results.length, query: debouncedQ })
          : mode === "discover"
            ? t("search.browsing", { count: results.length })
            : t("search.trendingNow", { count: results.length })}
      </p>

      {activeError && (
        <p className="mt-2 text-xs text-destructive">
          {t("search.tmdbError", { message: activeError.message ?? "" })}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        {results.map(it => <TmdbCard key={it.id} item={it} />)}
      </div>

      {/* Carica altri (solo discover) */}
      {mode === "discover" && results.length > 0 && (discover.data?.items.length ?? 0) > 0 && (
        <button
          type="button"
          disabled={discover.isFetching}
          onClick={() => setPage(p => p + 1)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {discover.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("search.loadMore")}
        </button>
      )}

      {!loading && results.length === 0 && mode === "search" && (
        <div className="mt-10 text-center text-sm text-muted-foreground">{t("search.noResults")}</div>
      )}
      {!loading && results.length === 0 && mode === "discover" && (
        <div className="mt-10 text-center text-sm text-muted-foreground">{t("search.noDiscover")}</div>
      )}
      <span className="hidden">{from}</span>
    </AppShell>
  );
}
