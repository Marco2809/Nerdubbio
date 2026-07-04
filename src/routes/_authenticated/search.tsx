import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { CATALOG } from "@/lib/mock-catalog";
import { Search as SearchIcon, Loader2, BookmarkCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { tmdbSearch, tmdbTrending, type TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useUserStore } from "@/lib/user-store";
import { isMediaAlreadyWatched } from "@/lib/library-display";
import { useReturnPath } from "@/lib/media-nav";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Cerca — Nerdubbio" }] }),
  component: SearchPage,
});

const GENRES = ["Sci-Fi","Drama","Comedy","Fantasy","Thriller","Action","Animation","Romance","Mystery","Crime"];

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function TmdbCard({ item }: { item: TmdbItem }) {
  const { state } = useUserStore();
  const from = useReturnPath();
  const inLibrary = !!state.media[item.id];
  const isWatched = isMediaAlreadyWatched(state.media[item.id]);
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
        {inLibrary && !isWatched && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-hero px-2 py-1 text-[10px] font-bold text-primary-foreground shadow-glow-pink">
            <BookmarkCheck className="h-3 w-3" /> In lista
          </div>
        )}
        {isWatched && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white/90">
            <BookmarkCheck className="h-3 w-3" /> Visto
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 p-3">
          <p className="text-[10px] uppercase tracking-widest text-white/70">
            {item.type === "tv" ? "Serie" : "Film"}{item.year ? ` · ${item.year}` : ""}
          </p>
          <h3 className="text-sm font-semibold text-white line-clamp-2">{item.title}</h3>
        </div>
      </div>
    </Link>
  );
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all"|"movie"|"tv">("all");
  const [genre, setGenre] = useState<string | null>(null);
  const debouncedQ = useDebounced(q.trim(), 400);
  const { state: userState } = useUserStore();

  const trending = useQuery({
    queryKey: ["tmdb", "trending"],
    queryFn: () => tmdbTrending({ data: { window: "week" } }),
    staleTime: 1000 * 60 * 30,
  });

  const search = useQuery({
    queryKey: ["tmdb", "search", debouncedQ],
    queryFn: () => tmdbSearch({ data: { query: debouncedQ } }),
    enabled: debouncedQ.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const raw: TmdbItem[] = debouncedQ ? (search.data?.items ?? []) : (trending.data?.items ?? []);
  const results = useMemo(
    () => raw
      .filter(it => type === "all" || it.type === type)
      // Trending: nascondi solo ciò che hai già visto/abbandonato (non da vedere/in corso)
      .filter(it => debouncedQ ? true : !isMediaAlreadyWatched(userState.media[it.id])),
    [raw, type, debouncedQ, userState.media]
  );

  // Fallback mock only if TMDB is loading and we have nothing
  const showMockFallback = !debouncedQ && trending.isLoading;
  const mockFallback = useMemo(() => CATALOG.slice(0, 8), []);
  const loading = search.isFetching || trending.isFetching;

  return (
    <AppShell subtitle="Trova" title="Cerca contenuti">
      <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Serie, film, attori…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
      </div>

      <div className="mt-3 flex gap-2">
        {(["all","movie","tv"] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${type===t ? "bg-hero text-primary-foreground shadow-glow" : "bg-surface-2 text-muted-foreground"}`}>
            {t === "all" ? "Tutti" : t === "movie" ? "Film" : "Serie"}
          </button>
        ))}
      </div>

      <div className="mt-3 -mx-4 overflow-x-auto">
        <div className="flex gap-2 px-4 pb-1">
          {GENRES.map(g => (
            <button key={g} onClick={() => setGenre(genre === g ? null : g)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${genre === g ? "border-accent bg-accent/20 text-accent" : "border-border text-muted-foreground"}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {debouncedQ ? `${results.length} risultati per "${debouncedQ}"` : `Trending ora · ${results.length}`}
      </p>

      {(search.error || trending.error) && (
        <p className="mt-2 text-xs text-destructive">
          Errore TMDB: {(search.error ?? trending.error)?.message}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        {results.map(it => <TmdbCard key={it.id} item={it} />)}
      </div>

      {showMockFallback && (
        <p className="mt-4 text-center text-xs text-muted-foreground">Sto caricando i trend di TMDB…</p>
      )}

      {!loading && results.length === 0 && debouncedQ && (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          Nulla trovato. Nerdacolo suggerisce di cambiare parola.
        </div>
      )}

      {/* used to keep mockFallback reference alive without rendering when data arrives */}
      <span className="hidden">{mockFallback.length}</span>
    </AppShell>
  );
}
