import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { OverlayBackButton } from "@/components/nerdubbio/OverlayBackButton";
import { findById, type CatalogItem } from "@/lib/mock-catalog";
import { useUserStore, isEpisodeWatched, type UserStatus } from "@/lib/user-store";
import { Plus, Heart, CheckCircle2, Pause, X, Star, Check, Loader2, PlayCircle, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbDetail, tmdbCredits, tmdbSeason, tmdbPerson, type TmdbItem, type CastMember } from "@/lib/tmdb/tmdb.functions";
import { useReturnPath, useSmartBack } from "@/lib/media-nav";
import { toast } from "@/lib/toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const EPISODES_PER_SEASON = 10;

export const Route = createFileRoute("/_authenticated/media/$type/$id")({
  head: () => ({ meta: [{ title: "Dettaglio — Nerdubbio" }] }),
  component: MediaDetail,
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Contenuto non trovato.</div>
  ),
});

function tmdbToCatalogItem(t: TmdbItem): CatalogItem {
  return {
    id: t.id,
    tmdb_id: t.tmdb_id,
    type: t.type,
    title: t.title,
    year: t.year,
    rating: t.rating,
    popularity: t.popularity,
    runtimeMin: t.runtimeMin,
    seasons: t.seasons,
    genres: t.genres,
    moods: [],
    overview: t.overview,
    poster: t.posterUrl ? `url(${t.posterUrl}) center/cover` : "linear-gradient(135deg,#3b1361,#0ea5e9)",
    where: [],
    similar: [],
  };
}

function MediaDetail() {
  const { id, type } = Route.useParams();
  const mockItem = findById(id);
  // Accetta sia "tv-123" / "movie-45" sia solo "123"
  const stripped = id.replace(/^(tv|movie)-/, "");
  const numericId = Number(stripped);
  const shouldFetchTmdb = !mockItem && Number.isFinite(numericId) && numericId > 0;

  const tmdbQuery = useQuery({
    queryKey: ["tmdb", "detail", type, numericId],
    queryFn: () => tmdbDetail({ data: { type: type as "movie" | "tv", tmdbId: numericId } }),
    enabled: shouldFetchTmdb,
    staleTime: 1000 * 60 * 60,
  });

  const creditsQuery = useQuery({
    queryKey: ["tmdb", "credits", type, numericId],
    queryFn: () => tmdbCredits({ data: { type: type as "movie" | "tv", tmdbId: numericId } }),
    enabled: Number.isFinite(numericId) && numericId > 0,
    staleTime: 1000 * 60 * 60,
  });

  const { state, addToList, removeFromList, toggleEpisode, setRating, markAllSeriesWatched, clearWatchedEpisodes } = useUserStore();
  const [syncOpen, setSyncOpen] = useState(false);
  const goBack = useSmartBack("/app");
  const returnPath = useReturnPath();

  if (!mockItem && !shouldFetchTmdb) throw notFound();

  if (!mockItem && tmdbQuery.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }
  if (!mockItem && tmdbQuery.error) {
    return <div className="p-8 text-center text-destructive">Errore: {(tmdbQuery.error as Error).message}</div>;
  }

  const item: CatalogItem = mockItem ?? tmdbToCatalogItem(tmdbQuery.data!.item);
  const entry = state.media[item.id];

  const actions: { s: UserStatus; label: string; icon: React.ReactNode }[] = [
    { s: "plan_to_watch", label: "Da vedere", icon: <Plus className="h-4 w-4" /> },
    { s: "watching", label: "In corso", icon: <Star className="h-4 w-4" /> },
    { s: "completed", label: "Visto", icon: <CheckCircle2 className="h-4 w-4" /> },
    { s: "paused", label: "In pausa", icon: <Pause className="h-4 w-4" /> },
    { s: "dropped", label: "Abbandonato", icon: <X className="h-4 w-4" /> },
    { s: "favorite", label: "Preferito", icon: <Heart className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen pb-32">
      <div className="relative h-72 w-full overflow-hidden" style={{ background: item.poster }}>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <OverlayBackButton onClick={goBack} />
      </div>

      <div className="mx-auto -mt-14 max-w-md px-safe">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{item.type === "tv" ? "Serie TV" : "Film"} · {item.year}</p>
        <h1 className="mt-1 text-3xl font-extrabold">{item.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {item.rating.toFixed(1)}</span>
          <span>·</span>
          {(item.seasons ?? 0) > 0 && <><span>{item.seasons} stagioni</span><span>·</span></>}
          {(item.runtimeMin ?? 0) > 0 && <span>{item.runtimeMin}′</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {item.genres.map(g => <span key={g} className="rounded-full border border-border px-2 py-0.5 text-[10px]">{g}</span>)}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground/90">{item.overview}</p>

        {(item.where?.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Dove vederlo</p>
            <p className="mt-1 text-sm font-semibold">{item.where.join(" · ")}</p>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Stato</p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                entry
                  ? "bg-hero text-primary-foreground shadow-glow-pink"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {entry ? actions.find(a => a.s === entry.status)?.label ?? entry.status : "Non in libreria"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map(a => {
              const active = entry?.status === a.s;
              return (
                <button
                  key={a.s}
                  onClick={() => {
                    if (active) return;
                    const meta = {
                      title: item.title, type: item.type, year: item.year,
                      posterUrl: tmdbQuery.data?.item.posterUrl ?? null,
                      backdropUrl: tmdbQuery.data?.item.backdropUrl ?? null,
                    };
                    const wasInLibrary = !!entry;
                    const prevLabel = entry ? actions.find(x => x.s === entry.status)?.label : null;
                    addToList(item.id, a.s, meta);
                    toast.success(
                      wasInLibrary
                        ? `"${item.title}" spostato in ${a.label}`
                        : `"${item.title}" aggiunto a ${a.label}`,
                      {
                        description: wasInLibrary && prevLabel
                          ? `Stato precedente: ${prevLabel}`
                          : "Ora è nella tua libreria",
                      },
                    );
                    const seasonsInfo = tmdbQuery.data?.item.seasonsInfo;
                    if (
                      a.s === "completed" &&
                      item.type === "tv" &&
                      seasonsInfo && seasonsInfo.length > 0
                    ) {
                      const totalEps = seasonsInfo.reduce((n, se) => n + se.episodeCount, 0);
                      const watchedCount = entry?.watchedEpisodes?.length ?? 0;
                      if (watchedCount < totalEps) setSyncOpen(true);
                    }
                  }}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-hero text-primary-foreground shadow-glow-pink"
                      : "glass text-foreground/80 hover:bg-white/10"
                  }`}
                >
                  {active ? <Check className="h-3.5 w-3.5" /> : a.icon}
                  {a.label}
                </button>
              );
            })}
          </div>


          {entry && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/10 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Rimuovi dalla libreria
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rimuovere "{item.title}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Il titolo verrà tolto dalla tua libreria. Progressi episodi, voto e stato verranno cancellati. L'azione non è reversibile.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const prevLabel = entry ? actions.find(x => x.s === entry.status)?.label : null;
                      const epsCount = entry?.watchedEpisodes?.length ?? 0;
                      removeFromList(item.id);
                      toast.success(`"${item.title}" rimosso dalla libreria`, {
                        description: [
                          prevLabel ? `Stato: ${prevLabel}` : null,
                          epsCount > 0 ? `${epsCount} episodi tracciati eliminati` : null,
                        ].filter(Boolean).join(" · ") || "Progressi cancellati",
                      });
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Rimuovi
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Dialog di sincronizzazione episodi quando marchi la serie come "Visto" */}
        <AlertDialog open={syncOpen} onOpenChange={setSyncOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sincronizzare gli episodi?</AlertDialogTitle>
              <AlertDialogDescription>
                Hai segnato "{item.title}" come <strong>Visto</strong>, ma alcuni episodi risultano
                ancora non spuntati. Vuoi segnare tutti gli episodi già usciti come visti per mantenere
                la coerenza? Guadagnerai XP per ogni episodio aggiunto.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel>Solo stato</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const seasonsInfo = tmdbQuery.data?.item.seasonsInfo ?? [];
                  const prevWatched = entry?.watchedEpisodes ?? [];
                  const prevStatus = entry?.status;
                  markAllSeriesWatched(item.id, seasonsInfo, {
                    onlyAired: true,
                    meta: {
                      title: item.title, type: item.type, year: item.year,
                      posterUrl: tmdbQuery.data?.item.posterUrl ?? null,
                      backdropUrl: tmdbQuery.data?.item.backdropUrl ?? null,
                    },
                  });
                  toast.success("Episodi sincronizzati come visti", {
                    action: {
                      label: "Annulla",
                      onClick: () => {
                        clearWatchedEpisodes(item.id, prevStatus);
                        // ripristina eventuali episodi già visti in precedenza
                        // (implementazione soft: pulisce e lascia lo stato precedente)
                        void prevWatched;
                      },
                    },
                    duration: 6000,
                  });
                }}
                className="bg-hero text-primary-foreground hover:opacity-90"
              >
                Sì, sincronizza
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>



        {/* Rating a livello opera */}
        <SeriesRating value={entry?.rating} onChange={(r) => setRating(item.id, r)} />


        {item.type === "tv" && (item.seasons ?? 0) > 0 && (
          <SeasonsTracker
            item={item}
            tmdbId={item.tmdb_id ?? numericId}
            totalSeasons={item.seasons}
            watched={entry?.watchedEpisodes ?? []}
            entry={entry}
            onToggle={(s, e, epsInSeason) => {
              const wasWatched = isEpisodeWatched(entry, s, e);
              toggleEpisode(item.id, s, e, epsInSeason, item.seasons!);
              toast(
                wasWatched
                  ? `S${s}E${e} segnato come non visto`
                  : `S${s}E${e} visto! +15 XP`,
                {
                  action: {
                    label: "Annulla",
                    onClick: () => toggleEpisode(item.id, s, e, epsInSeason, item.seasons!),
                  },
                  duration: 4000,
                },
              );
            }}
          />

        )}



        <CastSection cast={creditsQuery.data?.cast ?? []} loading={creditsQuery.isLoading} returnPath={returnPath} />

        {(item.similar?.length ?? 0) > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Simili</h2>
            <div className="grid grid-cols-3 gap-2">
              {item.similar.map(sid => {
                const s = findById(sid); if (!s) return null;
                return (
                  <Link key={sid} to="/media/$type/$id" params={{ type: s.type, id: s.id }}
                    state={{ from: returnPath }}
                    className="h-32 rounded-2xl" style={{ background: s.poster }} title={s.title} />
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SeriesRating({ value, onChange }: { value: number | undefined; onChange: (r: number | undefined) => void }) {
  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Il tuo voto</p>
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: 10 }).map((_, i) => {
          const n = i + 1;
          const active = value != null && n <= value;
          return (
            <button key={n} onClick={() => onChange(value === n ? undefined : n)}
              aria-label={`Vota ${n}/10`}
              className={`h-8 flex-1 rounded-lg text-[10px] font-bold transition ${active ? "bg-hero text-primary-foreground shadow-glow-pink" : "border border-border bg-surface/60 text-muted-foreground"}`}>
              {n}
            </button>
          );
        })}
      </div>
      {value != null && <p className="mt-1 text-[11px] text-accent">Voto {value}/10. Toccalo di nuovo per rimuoverlo.</p>}
    </div>
  );
}

function SeasonsTracker({
  item, tmdbId, totalSeasons, watched, entry, onToggle,
}: {
  item: NonNullable<ReturnType<typeof findById>>;
  tmdbId: number | undefined;
  totalSeasons: number;
  watched: string[];
  entry: ReturnType<typeof useUserStore>["state"]["media"][string] | undefined;
  onToggle: (season: number, episode: number, episodesInSeason: number) => void;
}) {
  const [openSeason, setOpenSeason] = useState<number>(entry?.currentSeason ?? 1);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = /^#ep-S(\d+)E(\d+)$/.exec(window.location.hash);
    if (m) setOpenSeason(Number(m[1]));
  }, []);
  const watchedSet = new Set(watched);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider">Stagioni & episodi</h2>
        <span className="text-xs text-muted-foreground">{watched.length} visti</span>
      </div>

      <div className="space-y-2">
        {Array.from({ length: totalSeasons }).map((_, i) => {
          const s = i + 1;
          return (
            <SeasonCard
              key={s}
              tmdbId={tmdbId}
              seasonNumber={s}
              open={openSeason === s}
              onToggleOpen={() => setOpenSeason(openSeason === s ? 0 : s)}
              watchedSet={watchedSet}
              entry={entry}
              onToggle={onToggle}
            />
          );
        })}
      </div>
      {entry?.currentSeason && entry.currentEpisode && (
        <p className="mt-3 text-center text-xs text-accent">
          Ultimo episodio: S{entry.currentSeason}E{entry.currentEpisode}. Un altro episodio e poi dormi?
        </p>
      )}
    </section>
  );
}

function SeasonCard({
  tmdbId, seasonNumber, open, onToggleOpen, watchedSet, entry, onToggle,
}: {
  tmdbId: number | undefined;
  seasonNumber: number;
  open: boolean;
  onToggleOpen: () => void;
  watchedSet: Set<string>;
  entry: ReturnType<typeof useUserStore>["state"]["media"][string] | undefined;
  onToggle: (season: number, episode: number, episodesInSeason: number) => void;
}) {
  const q = useQuery({
    queryKey: ["tmdb", "season", tmdbId, seasonNumber],
    queryFn: () => tmdbSeason({ data: { tmdbId: tmdbId!, seasonNumber } }),
    enabled: open && !!tmdbId,
    staleTime: 1000 * 60 * 60,
  });

  const episodes = q.data?.episodes ?? [];
  const epsCount = episodes.length || EPISODES_PER_SEASON;
  const watchedInSeason = Array.from({ length: epsCount }, (_, i) => `S${seasonNumber}E${i+1}`)
    .filter(k => watchedSet.has(k)).length;
  const pct = epsCount ? (watchedInSeason / epsCount) * 100 : 0;

  const markAll = () => {
    episodes.forEach(ep => {
      if (!watchedSet.has(`S${seasonNumber}E${ep.episodeNumber}`)) onToggle(seasonNumber, ep.episodeNumber, epsCount);
    });
  };
  const unmarkAll = () => {
    episodes.forEach(ep => {
      if (watchedSet.has(`S${seasonNumber}E${ep.episodeNumber}`)) onToggle(seasonNumber, ep.episodeNumber, epsCount);
    });
  };

  return (
    <div id={`season-${seasonNumber}`} className="glass overflow-hidden rounded-2xl scroll-mt-24">
      <button onClick={onToggleOpen} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{q.data?.name ?? `Stagione ${seasonNumber}`}</p>
          <p className="text-xs text-muted-foreground">
            {epsCount ? `${watchedInSeason}/${epsCount} episodi` : "Tocca per caricare"}
          </p>
        </div>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-neon transition-all" style={{ width: `${pct}%` }} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border/50 p-3">
          {q.isLoading && (
            <div className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
          )}
          {q.error && (
            <p className="py-3 text-center text-xs text-destructive">Impossibile caricare gli episodi.</p>
          )}
          {episodes.length > 0 && (
            <>
              <div className="space-y-2">
                {episodes.map(ep => (
                  <EpisodeRow
                    key={ep.episodeNumber}
                    seasonNumber={seasonNumber}
                    ep={ep}
                    watched={watchedSet.has(`S${seasonNumber}E${ep.episodeNumber}`)}
                    onToggle={() => onToggle(seasonNumber, ep.episodeNumber, epsCount)}
                  />
                ))}
              </div>
              {watchedInSeason === epsCount ? (
                <button onClick={unmarkAll}
                  className="mt-3 w-full rounded-xl border border-border bg-surface/60 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  Annulla: segna tutta la stagione come non vista
                </button>
              ) : (
                <button onClick={markAll}
                  className="mt-3 w-full rounded-xl border border-border bg-surface/60 py-2 text-xs font-semibold">
                  Segna tutta la stagione come vista (+50 XP bonus)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EpisodeRow({
  seasonNumber, ep, watched, onToggle,
}: {
  seasonNumber: number;
  ep: import("@/lib/tmdb/tmdb.functions").EpisodeInfo;
  watched: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const airDate = ep.airDate ? new Date(ep.airDate) : null;
  const airLabel = airDate && !isNaN(airDate.getTime())
    ? airDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
    : null;
  const isFuture = airDate && airDate.getTime() > Date.now();

  const ref = useRef<HTMLDivElement>(null);
  const epKey = `S${seasonNumber}E${ep.episodeNumber}`;
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === `#ep-${epKey}`) {
      const t = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        ref.current?.classList.add("ring-2", "ring-accent");
        setTimeout(() => ref.current?.classList.remove("ring-2", "ring-accent"), 2500);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [epKey]);

  return (
    <div ref={ref} id={`ep-${epKey}`} className={`scroll-mt-24 overflow-hidden rounded-xl border transition ${watched ? "border-accent/40 bg-accent/5" : "border-border bg-surface/40"}`}>
      <div className="flex gap-3 p-2">
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {ep.stillUrl ? (
            <img src={ep.stillUrl} alt={ep.name} loading="lazy" className={`h-full w-full object-cover ${isFuture ? "opacity-50" : ""}`} />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">S{seasonNumber}E{ep.episodeNumber}</div>
          )}
          <span className="absolute left-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">
            E{ep.episodeNumber}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ep.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {airLabel && <span className={isFuture ? "text-accent" : ""}>{isFuture ? "In uscita " : ""}{airLabel}</span>}
            {ep.runtime ? <span>· {ep.runtime}′</span> : null}
            {ep.voteCount > 0 && (
              <span className="flex items-center gap-0.5">
                · <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> {ep.voteAverage.toFixed(1)}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {ep.overview && (
              <button onClick={() => setExpanded(v => !v)} className="text-[11px] font-semibold text-accent hover:underline">
                {expanded ? "Nascondi" : "Trama"}
              </button>
            )}
            <button
              onClick={onToggle}
              disabled={!!isFuture && !watched}
              className={`ml-auto grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition ${
                watched ? "bg-hero text-primary-foreground shadow-glow-pink" :
                isFuture ? "border border-border/50 bg-surface/40 text-muted-foreground/40" :
                "border border-border bg-surface/60 text-muted-foreground hover:border-accent"
              }`}
              aria-label={`Segna S${seasonNumber}E${ep.episodeNumber} ${watched ? "non visto" : "visto"}`}
            >
              {watched ? <Check className="h-4 w-4" /> : "+"}
            </button>
          </div>
        </div>
      </div>
      {expanded && ep.overview && (
        <p className="border-t border-border/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {ep.overview}
        </p>
      )}
    </div>
  );
}


function CastSection({ cast, loading, returnPath }: { cast: CastMember[]; loading: boolean; returnPath: string }) {
  const queryClient = useQueryClient();

  const prefetchPerson = (personId: number) => {
    void queryClient.prefetchQuery({
      queryKey: ["tmdb", "person", personId],
      queryFn: () => tmdbPerson({ data: { personId } }),
      staleTime: 1000 * 60 * 60,
    });
  };

  if (loading) {
    return (
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider">Cast</h2>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            Caricamento…
          </p>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-24 shrink-0">
              <div className="h-32 w-24 animate-pulse rounded-2xl bg-surface-2" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (!cast.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Cast</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {cast.map(c => (
          <Link
            key={c.id}
            to="/person/$id"
            params={{ id: String(c.id) }}
            state={{ from: returnPath }}
            className="w-24 shrink-0 active:opacity-70"
            onMouseEnter={() => prefetchPerson(c.id)}
            onFocus={() => prefetchPerson(c.id)}
            onTouchStart={() => prefetchPerson(c.id)}
          >
            <div className="relative h-32 w-24 overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-md">
              {c.profileUrl ? (
                <img
                  src={c.profileUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-2xl text-muted-foreground">
                  {c.name.charAt(0)}
                </div>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-tight">{c.name}</p>
            {c.character ? (
              <p className="line-clamp-1 text-[10px] text-muted-foreground">{c.character}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
