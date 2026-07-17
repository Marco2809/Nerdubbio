import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { OverlayBackButton } from "@/components/nerdubbio/OverlayBackButton";
import { findById, type CatalogItem } from "@/lib/mock-catalog";
import { useUserStore, isEpisodeWatched, getEpisodeWatchCount, totalEpisodeWatches, type UserStatus } from "@/lib/user-store";
import { Plus, Heart, CheckCircle2, Pause, X, Star, Check, Loader2, PlayCircle, Trash2, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbDetail, tmdbCredits, tmdbSeason, tmdbPerson, tmdbWatchProviders, tmdbVideos, type TmdbItem, type CastMember } from "@/lib/tmdb/tmdb.functions";
import { useTmdbLocale } from "@/lib/tmdb/use-tmdb-locale";
import { Play } from "lucide-react";
import { useReturnPath, useSmartBack } from "@/lib/media-nav";
import { applyShowProgressAfterWatch, formatSeriesStatusLabel } from "@/lib/check-show-after-watch";
import { toast } from "@/lib/toast";
import { useI18n, localeToBcp47, pageTitle } from "@/lib/i18n";
import { MediaCommentsSection } from "@/components/nerdubbio/MediaCommentsSection";
import { MediaRatingsSection } from "@/components/nerdubbio/MediaRatingsSection";
import { RecapSection } from "@/components/nerdubbio/recap/RecapSection";
import { RecommendDialog } from "@/components/nerdubbio/RecommendDialog";
import { commentsApi, commentCountsKey } from "@/lib/php/comments-client";
import { libraryApi, LIBRARY_QUERY_KEY } from "@/lib/php/library-client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const EPISODES_PER_SEASON = 10;

export const Route = createFileRoute("/_authenticated/media/$type/$id")({
  head: () => ({ meta: [{ title: pageTitle("media") }] }),
  component: MediaDetail,
  notFoundComponent: MediaNotFound,
});

function MediaNotFound() {
  const { t } = useI18n();
  return (
    <div className="p-8 text-center text-muted-foreground">{t("media.contentNotFound")}</div>
  );
}

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
    similar: [],
  };
}

function MediaDetail() {
  const { t } = useI18n();
  const { id, type } = Route.useParams();
  const mockItem = findById(id);
  // Accetta sia "tv-123" / "movie-45" sia solo "123"
  const stripped = id.replace(/^(tv|movie)-/, "");
  const numericId = Number(stripped);
  const shouldFetchTmdb = !mockItem && Number.isFinite(numericId) && numericId > 0;
  const locale = useTmdbLocale();

  const tmdbQuery = useQuery({
    queryKey: ["tmdb", "detail", type, numericId, locale],
    queryFn: () => tmdbDetail({ data: { type: type as "movie" | "tv", tmdbId: numericId, locale } }),
    enabled: shouldFetchTmdb,
    staleTime: 1000 * 60 * 60,
  });

  const creditsQuery = useQuery({
    queryKey: ["tmdb", "credits", type, numericId, locale],
    queryFn: () => tmdbCredits({ data: { type: type as "movie" | "tv", tmdbId: numericId, locale } }),
    enabled: Number.isFinite(numericId) && numericId > 0,
    staleTime: 1000 * 60 * 60,
  });

  const providersQuery = useQuery({
    queryKey: ["tmdb", "providers", type, numericId],
    queryFn: () => tmdbWatchProviders({ data: { type: type as "movie" | "tv", tmdbId: numericId } }),
    enabled: shouldFetchTmdb,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const videosQuery = useQuery({
    queryKey: ["tmdb", "videos", type, numericId, locale],
    queryFn: () => tmdbVideos({ data: { type: type as "movie" | "tv", tmdbId: numericId, locale } }),
    enabled: Number.isFinite(numericId) && numericId > 0,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const commentCountsQuery = useQuery({
    queryKey: commentCountsKey("tv", numericId),
    queryFn: () => commentsApi.counts("tv", numericId),
    enabled: type === "tv" && Number.isFinite(numericId) && numericId > 0,
    staleTime: 1000 * 60,
  });

  const { state, addToList, setStatus, setFavorite, removeFromList, toggleEpisode, unwatchEpisode, logMovieWatch, setRating, markAllSeriesWatched, clearWatchedEpisodes } = useUserStore();
  const [syncOpen, setSyncOpen] = useState(false);
  const goBack = useSmartBack("/app");
  const returnPath = useReturnPath();

  // Deve stare prima dei return anticipati: aggiungere hook dopo un render
  // condizionale fa crashare React ("Rendered more hooks than during the previous render").
  const streamingOn = useMemo(() => {
    if ((mockItem?.where?.length ?? 0) > 0) return mockItem!.where!;
    const wp = providersQuery.data?.providers;
    if (!wp) return [];
    const providers = wp.flatrate.length
      ? wp.flatrate
      : wp.free.length
        ? wp.free
        : wp.rent.length
          ? wp.rent
          : wp.buy;
    return providers.map(p => p.name);
  }, [mockItem, providersQuery.data]);

  if (!mockItem && !shouldFetchTmdb) throw notFound();

  if (!mockItem && tmdbQuery.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }
  if (!mockItem && tmdbQuery.error) {
    return <div className="p-8 text-center text-destructive">{t("media.loadError", { message: (tmdbQuery.error as Error).message })}</div>;
  }

  const item: CatalogItem = mockItem ?? tmdbToCatalogItem(tmdbQuery.data!.item);
  const entry = state.media[item.id];
  // Recap disponibile solo per stagioni/film visti per intero.
  const recapWatchedSeasons = (tmdbQuery.data?.item.seasonsInfo ?? [])
    .filter(
      (s) =>
        s.episodeCount > 0 &&
        (entry?.watchedEpisodes?.filter((k) => k.startsWith(`S${s.seasonNumber}E`)).length ?? 0) >= s.episodeCount,
    )
    .map((s) => s.seasonNumber);
  const recapMovieWatched = entry?.status === "completed" || (entry?.watchCount ?? 0) > 0;
  const mediaMeta = {
    title: item.title,
    type: item.type,
    year: item.year,
    posterUrl: tmdbQuery.data?.item.posterUrl ?? null,
    backdropUrl: tmdbQuery.data?.item.backdropUrl ?? null,
  };
  const seriesStatus = tmdbQuery.data?.item.seriesStatus;

  const runProgressCheck = (updatedEntry: typeof entry) => {
    if (!updatedEntry || item.type !== "tv") return;
    void applyShowProgressAfterWatch({
      entry: updatedEntry,
      setStatus,
      title: item.title,
      meta: mediaMeta,
    });
  };

  // "favorite" NON è più uno stato: è un flag separato (cuore) gestito sotto.
  const actions: { s: UserStatus; label: string; icon: React.ReactNode }[] = [
    { s: "plan_to_watch", label: t("status.plan_to_watch"), icon: <Plus className="h-4 w-4" /> },
    { s: "watching", label: t("status.watching"), icon: <Star className="h-4 w-4" /> },
    { s: "completed", label: t("status.completed"), icon: <CheckCircle2 className="h-4 w-4" /> },
    { s: "paused", label: t("status.paused"), icon: <Pause className="h-4 w-4" /> },
    { s: "dropped", label: t("status.dropped"), icon: <X className="h-4 w-4" /> },
  ];

  const isFavorite = !!entry?.favorite;
  const toggleFavorite = () => {
    const meta = {
      title: item.title, type: item.type, year: item.year,
      posterUrl: tmdbQuery.data?.item.posterUrl ?? null,
      backdropUrl: tmdbQuery.data?.item.backdropUrl ?? null,
    };
    const next = !isFavorite;
    void setFavorite(item.id, next, meta)
      .then(() => {
        toast.success(next
          ? t("media.favoriteAdded", { title: item.title })
          : t("media.favoriteRemoved", { title: item.title }));
      })
      .catch((e: unknown) => {
        toast.error(t("media.saveStatusError"), { description: e instanceof Error ? e.message : undefined });
      });
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="relative h-72 w-full overflow-hidden" style={{ background: item.poster }}>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <OverlayBackButton onClick={goBack} />
      </div>

      {/* relative z-10: l'hero è posizionato e coprirebbe le righe alte di un
          titolo lungo (che salgono nell'area -mt-14). Così il testo sta sopra. */}
      <div className="relative z-10 mx-auto -mt-14 max-w-md px-safe">
        <p className="text-xs uppercase tracking-widest text-white/80 [text-shadow:0_1px_8px_rgb(0_0_0_/_0.7)]">{item.type === "tv" ? t("media.series") : t("media.movie")} · {item.year}</p>
        <h1 className="mt-1 text-3xl font-extrabold [text-shadow:0_2px_12px_rgb(0_0_0_/_0.7)]">{item.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {item.rating.toFixed(1)}</span>
          <span>·</span>
          {(item.seasons ?? 0) > 0 && <><span>{t("media.seasons", { n: item.seasons! })}</span><span>·</span></>}
          {(item.runtimeMin ?? 0) > 0 && <span>{t("media.runtime", { n: item.runtimeMin! })}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {item.genres.map(g => <span key={g} className="rounded-full border border-border px-2 py-0.5 text-[10px]">{g}</span>)}
          {item.type === "tv" && seriesStatus && (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
              {formatSeriesStatusLabel(seriesStatus)}
            </span>
          )}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground/90">{item.overview || t("media.synopsisMissing")}</p>

        {streamingOn.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("media.whereToWatch")}</p>
            <p className="mt-1 text-sm font-semibold">{streamingOn.join(" · ")}</p>
          </div>
        ) : null}

        {(videosQuery.data?.trailers.length ?? 0) > 0 && (
          <TrailerSection trailerKey={videosQuery.data!.trailers[0]!.key} />
        )}

        <RecapSection
          type={item.type as "movie" | "tv"}
          tmdbId={numericId}
          title={item.title}
          year={item.year}
          genres={item.genres}
          overview={item.overview}
          seasons={tmdbQuery.data?.item.seasonsInfo}
          watchedSeasons={recapWatchedSeasons}
          movieWatched={recapMovieWatched}
        />

        <RecommendDialog
          mediaKey={item.id}
          mediaType={item.type as "movie" | "tv"}
          title={item.title}
          posterUrl={tmdbQuery.data?.item.posterUrl}
          year={item.year}
        />

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("media.state")}</p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                entry
                  ? "bg-hero text-primary-foreground shadow-glow-pink"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {entry ? actions.find(a => a.s === entry.status)?.label ?? entry.status : t("status.notInLibrary")}
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
                    const save = wasInLibrary
                      ? setStatus(item.id, a.s, meta)
                      : addToList(item.id, a.s, meta);
                    void save
                      .then(() => {
                        toast.success(
                          wasInLibrary
                            ? t("media.movedTo", { title: item.title, status: a.label })
                            : t("media.addedTo", { title: item.title, status: a.label }),
                          {
                            description: wasInLibrary && prevLabel
                              ? t("media.prevStatus", { status: prevLabel })
                              : t("media.nowInLibrary"),
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
                      })
                      .catch((e: unknown) => {
                        toast.error(t("media.saveStatusError"), {
                          description: e instanceof Error ? e.message : undefined,
                        });
                      });
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

          {/* Preferito: flag indipendente — non cambia lo stato */}
          <button
            type="button"
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            className={`mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              isFavorite
                ? "border border-accent bg-accent/15 text-accent"
                : "glass text-foreground/80 hover:bg-white/10"
            }`}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? "fill-accent" : ""}`} />
            {isFavorite ? t("media.favoriteOn") : t("status.favorite")}
          </button>

          {entry && item.type === "movie" && entry.status === "completed" && (
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-surface/40 px-3 py-2">
              <div>
                <p className="text-xs font-semibold">{t("media.views")}</p>
                <p className="text-lg font-bold tabular-nums">
                  ×{Math.max(entry.watchCount ?? 1, 1)}
                </p>
                {(entry.lastWatchedAt ?? entry.addedAt) && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("media.watchedOn", { date: formatItDate(entry.lastWatchedAt ?? entry.addedAt) })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const meta = {
                    title: item.title, type: item.type, year: item.year,
                    posterUrl: tmdbQuery.data?.item.posterUrl ?? null,
                    backdropUrl: tmdbQuery.data?.item.backdropUrl ?? null,
                  };
                  const prev = entry.watchCount ?? 1;
                  logMovieWatch(item.id, meta);
                  toast.reward(t("media.rewatched", { title: item.title }), 15, {
                    description: t("media.viewCount", { n: prev + 1 }),
                  });
                }}
                className="rounded-xl bg-hero px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow-pink"
              >
                {t("media.rewatchedBtn")}
              </button>
            </div>
          )}

          {entry && <EntryNotes key={item.id} entryId={item.id} initial={entry.notes ?? ""} />}

          {entry && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/10 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("media.removeFromLibrary")}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("media.removeTitle", { title: item.title })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("media.removeDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const prevLabel = entry ? actions.find(x => x.s === entry.status)?.label : null;
                      const epsCount = entry?.watchedEpisodes?.length ?? 0;
                      removeFromList(item.id);
                      toast.success(t("media.removed", { title: item.title }), {
                        description: [
                          prevLabel ? t("media.statusLabel", { status: prevLabel }) : null,
                          epsCount > 0 ? t("media.episodesDeleted", { count: epsCount }) : null,
                        ].filter(Boolean).join(" · ") || t("media.progressCleared"),
                      });
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("media.remove")}
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
              <AlertDialogTitle>{t("media.syncEpisodesTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("media.syncEpisodesDesc", { title: item.title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel>{t("media.syncOnlyStatus")}</AlertDialogCancel>
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
                  toast.success(t("media.episodesSynced"), {
                    action: {
                      label: t("common.cancel"),
                      onClick: () => {
                        clearWatchedEpisodes(item.id, prevStatus);
                        void prevWatched;
                      },
                    },
                    duration: 6000,
                  });
                }}
                className="bg-hero text-primary-foreground hover:opacity-90"
              >
                {t("media.syncYes")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>



        {/* Rating a livello opera */}
        <SeriesRating value={entry?.rating} onChange={(r) => setRating(item.id, r)} />

        {shouldFetchTmdb && Number.isFinite(numericId) && numericId > 0 && (
          <MediaRatingsSection
            mediaType={type as "tv" | "movie"}
            tmdbId={item.tmdb_id ?? numericId}
            tmdbRating={tmdbQuery.data?.item.rating ?? item.rating}
            voteCount={tmdbQuery.data?.item.voteCount}
            seasonsInfo={tmdbQuery.data?.item.seasonsInfo}
            userRating={entry?.rating}
          />
        )}


        {item.type === "tv" && (item.seasons ?? 0) > 0 && (
          <SeasonsTracker
            item={item}
            tmdbId={item.tmdb_id ?? numericId}
            commentCounts={commentCountsQuery.data?.counts ?? {}}
            from={returnPath}
            totalSeasons={item.seasons ?? 0}
            watched={entry?.watchedEpisodes ?? []}
            entry={entry}
            onToggle={async (s, e, epsInSeason, opts) => {
              const prevCount = getEpisodeWatchCount(entry, s, e);
              if (opts?.unwatch) {
                await unwatchEpisode(item.id, s, e, epsInSeason, item.seasons!, mediaMeta);
                if (!opts.silent) {
                  if (prevCount > 1) {
                    toast(t("media.episodeWatchDecrement", { s, e, from: prevCount, to: prevCount - 1 }), {
                      action: {
                        label: t("common.cancel"),
                        onClick: () => toggleEpisode(item.id, s, e, epsInSeason, item.seasons!, mediaMeta),
                      },
                      duration: 4000,
                    });
                  } else {
                    toast(t("media.episodeUnwatched", { s, e }), {
                      action: {
                        label: t("common.cancel"),
                        onClick: () => toggleEpisode(item.id, s, e, epsInSeason, item.seasons!, mediaMeta),
                      },
                      duration: 4000,
                    });
                  }
                }
                return;
              }
              try {
                const nextState = await toggleEpisode(item.id, s, e, epsInSeason, item.seasons!, mediaMeta);
                if (!opts?.silent) {
                  const undoFirstWatch = {
                    action: {
                      label: t("common.cancel"),
                      onClick: () => unwatchEpisode(item.id, s, e, epsInSeason, item.seasons!, mediaMeta),
                    },
                    duration: 4000,
                  };
                  if (prevCount > 0) {
                    toast.reward(t("media.episodeRewatched", { s, e }), 15, {
                      description: t("media.viewCount", { n: prevCount + 1 }),
                      ...undoFirstWatch,
                    });
                  } else {
                    toast.reward(t("media.episodeWatched", { s, e }), 15, undoFirstWatch);
                  }
                }
                runProgressCheck(nextState.media[item.id]);
              } catch (err: unknown) {
                toast.error(t("media.saveEpisodeError"), {
                  description: err instanceof Error ? err.message : undefined,
                });
              }
            }}
            onMarkSeasonWatched={async (seasonNumber, episodeNumbers, epsCount) => {
              // Una sola chiamata bulk: segnare episodio per episodio faceva
              // N round-trip e ci metteva un'eternità sulle stagioni lunghe.
              // complete:false → segna la stagione ma NON conclude l'intera
              // serie; il sync TMDB la completerà solo se è davvero finita.
              const nextState = await markAllSeriesWatched(
                item.id,
                [{ seasonNumber, episodeCount: epsCount }],
                { meta: mediaMeta, complete: false },
              );
              toast.reward(t("media.seasonCompleted", { n: seasonNumber }), episodeNumbers.length * 15 + 50, {
                description: t("media.seasonCompletedDesc", { count: episodeNumbers.length }),
              });
              runProgressCheck(nextState.media[item.id]);
            }}
          />

        )}



        <CastSection cast={creditsQuery.data?.cast ?? []} loading={creditsQuery.isLoading} returnPath={returnPath} />

        {shouldFetchTmdb && Number.isFinite(numericId) && numericId > 0 && (
          <MediaCommentsSection
            mediaType={type as "tv" | "movie"}
            tmdbId={item.tmdb_id ?? numericId}
          />
        )}

        {(item.similar?.length ?? 0) > 0 ? (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">{t("media.similar")}</h2>
            <div className="grid grid-cols-3 gap-2">
              {item.similar!.map(sid => {
                const s = findById(sid); if (!s) return null;
                return (
                  <Link key={sid} to="/media/$type/$id" params={{ type: s.type, id: s.id }}
                    state={{ from: returnPath }}
                    className="h-32 rounded-2xl" style={{ background: s.poster }} title={s.title} />
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SeriesRating({ value, onChange }: { value: number | undefined; onChange: (r: number | undefined) => void }) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  // Durante il drag si aggiorna solo lo stato locale: il salvataggio (chiamata
  // API) avviene UNA volta sola, al rilascio.
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;

  const valueFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0.5;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.max(0.5, Math.round(ratio * 10 * 2) / 2);
  };

  const commit = () => {
    setDrag((d) => {
      if (d == null || d === value) return null;
      onChange(d);
      // Tieni il valore trascinato a schermo finché il salvataggio non
      // riporta il nuovo `value`: azzerare subito faceva lampeggiare il
      // voto vecchio per un frame.
      return d;
    });
  };

  useEffect(() => {
    if (drag != null && value === drag) setDrag(null);
  }, [value, drag]);

  const pct = shown != null ? (shown / 10) * 100 : 0;

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("media.yourRating")}</p>
        {value != null && (
          <button type="button" onClick={() => onChange(undefined)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
            {t("media.removeRating")}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className={`w-14 shrink-0 text-3xl font-extrabold tabular-nums ${shown != null ? "text-gradient" : "text-muted-foreground"}`}>
          {shown != null ? shown.toFixed(1) : "–"}
        </span>
        <div className="flex-1">
          <div
            ref={trackRef}
            role="slider"
            aria-valuemin={0.5}
            aria-valuemax={10}
            aria-valuenow={shown ?? 0}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag(valueFromClientX(e.clientX));
            }}
            onPointerMove={(e) => {
              if (drag != null && (e.buttons === 1 || e.pressure > 0)) setDrag(valueFromClientX(e.clientX));
            }}
            onPointerUp={commit}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") onChange(Math.max(0.5, (value ?? 0.5) - 0.5));
              else if (e.key === "ArrowRight") onChange(Math.min(10, (value ?? 0) + 0.5));
            }}
            className="relative h-9 cursor-pointer touch-none select-none"
          >
            <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-surface-2" />
            <div className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-hero shadow-glow-pink" style={{ width: `${pct}%` }} />
            {shown != null && (
              <div
                className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hero bg-background shadow-glow-pink"
                style={{ left: `${pct}%` }}
              />
            )}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
            <span>0.5</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>
      </div>

      {shown == null && <p className="mt-1 text-[11px] text-muted-foreground">{t("media.ratingHint")}</p>}
    </div>
  );
}

function SeasonsTracker({
  item, tmdbId, commentCounts, from, totalSeasons, watched, entry, onToggle, onMarkSeasonWatched,
}: {
  item: NonNullable<ReturnType<typeof findById>>;
  tmdbId: number | undefined;
  commentCounts: Record<string, number>;
  from: string;
  totalSeasons: number;
  watched: string[];
  entry: ReturnType<typeof useUserStore>["state"]["media"][string] | undefined;
  onToggle: (
    season: number,
    episode: number,
    episodesInSeason: number,
    opts?: { silent?: boolean; unwatch?: boolean },
  ) => void | Promise<void>;
  onMarkSeasonWatched: (
    seasonNumber: number,
    episodeNumbers: number[],
    epsCount: number,
  ) => Promise<void>;
}) {
  const { t } = useI18n();
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
        <h2 className="text-sm font-bold uppercase tracking-wider">{t("media.seasonsEpisodes")}</h2>
        <span className="text-xs text-muted-foreground">
          {t("media.viewsCount", { n: totalEpisodeWatches(entry) || watched.length })}
          {totalEpisodeWatches(entry) > watched.length ? t("media.episodesCount", { n: watched.length }) : ""}
        </span>
      </div>

      <div className="space-y-2">
        {Array.from({ length: totalSeasons }).map((_, i) => {
          const s = i + 1;
          return (
            <SeasonCard
              key={s}
              tmdbId={tmdbId}
              commentCounts={commentCounts}
              from={from}
              seasonNumber={s}
              open={openSeason === s}
              onToggleOpen={() => setOpenSeason(openSeason === s ? 0 : s)}
              watchedSet={watchedSet}
              entry={entry}
              onToggle={onToggle}
              onMarkSeasonWatched={onMarkSeasonWatched}
            />
          );
        })}
      </div>
      {(entry?.currentSeason ?? 0) > 0 && (entry?.currentEpisode ?? 0) > 0 ? (
        <p className="mt-3 text-center text-xs text-accent">
          {t("media.lastEpisode", { s: entry!.currentSeason!, e: entry!.currentEpisode! })}
        </p>
      ) : null}
    </section>
  );
}

function SeasonCard({
  tmdbId, commentCounts, from, seasonNumber, open, onToggleOpen, watchedSet, entry, onToggle, onMarkSeasonWatched,
}: {
  tmdbId: number | undefined;
  commentCounts: Record<string, number>;
  from: string;
  seasonNumber: number;
  open: boolean;
  onToggleOpen: () => void;
  watchedSet: Set<string>;
  entry: ReturnType<typeof useUserStore>["state"]["media"][string] | undefined;
  onToggle: (
    season: number,
    episode: number,
    episodesInSeason: number,
    opts?: { silent?: boolean; unwatch?: boolean },
  ) => void | Promise<void>;
  onMarkSeasonWatched: (
    seasonNumber: number,
    episodeNumbers: number[],
    epsCount: number,
  ) => Promise<void>;
}) {
  const { t } = useI18n();
  const locale = useTmdbLocale();
  const q = useQuery({
    queryKey: ["tmdb", "season", tmdbId, seasonNumber, locale],
    queryFn: () => tmdbSeason({ data: { tmdbId: tmdbId!, seasonNumber, locale } }),
    enabled: open && !!tmdbId,
    staleTime: 1000 * 60 * 60,
  });

  const episodes = q.data?.episodes ?? [];
  const epsCount = episodes.length || EPISODES_PER_SEASON;
  const watchedInSeason = Array.from({ length: epsCount }, (_, i) => `S${seasonNumber}E${i+1}`)
    .filter(k => watchedSet.has(k)).length;
  const pct = epsCount ? (watchedInSeason / epsCount) * 100 : 0;

  // Toggle silenzioso per episodio + un unico toast riassuntivo (niente spam di notifiche).
  const markAll = async () => {
    const missing = episodes.filter(ep => !watchedSet.has(`S${seasonNumber}E${ep.episodeNumber}`));
    if (!missing.length) return;
    await onMarkSeasonWatched(
      seasonNumber,
      missing.map(ep => ep.episodeNumber),
      epsCount,
    );
  };
  const unmarkAll = () => {
    const marked = episodes.filter(ep => watchedSet.has(`S${seasonNumber}E${ep.episodeNumber}`));
    marked.forEach(ep => onToggle(seasonNumber, ep.episodeNumber, epsCount, { silent: true, unwatch: true }));
    if (marked.length) toast(t("media.seasonUnmarked", { n: seasonNumber }));
  };

  return (
    <div id={`season-${seasonNumber}`} className="glass overflow-hidden rounded-2xl scroll-mt-24">
      <button onClick={onToggleOpen} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{q.data?.name ?? t("media.seasonN", { n: seasonNumber })}</p>
          <p className="text-xs text-muted-foreground">
            {epsCount ? t("media.epsProgress", { watched: watchedInSeason, total: epsCount }) : t("media.tapToLoad")}
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
            <p className="py-3 text-center text-xs text-destructive">{t("media.loadEpisodesError")}</p>
          )}
          {episodes.length > 0 && (
            <>
              <div className="space-y-2">
                {episodes.map(ep => (
                  <EpisodeRow
                    key={ep.episodeNumber}
                    tmdbId={tmdbId}
                    from={from}
                    commentCount={commentCounts[`S${seasonNumber}E${ep.episodeNumber}`] ?? 0}
                    seasonNumber={seasonNumber}
                    ep={ep}
                    watched={watchedSet.has(`S${seasonNumber}E${ep.episodeNumber}`)}
                    watchCount={getEpisodeWatchCount(entry, seasonNumber, ep.episodeNumber)}
                    onLogWatch={() => onToggle(seasonNumber, ep.episodeNumber, epsCount)}
                    onUnwatch={() => onToggle(seasonNumber, ep.episodeNumber, epsCount, { unwatch: true })}
                  />
                ))}
              </div>
              {watchedInSeason === epsCount ? (
                <button onClick={unmarkAll}
                  className="mt-3 w-full rounded-xl border border-border bg-surface/60 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  {t("media.unmarkSeason")}
                </button>
              ) : (
                <button onClick={markAll}
                  className="mt-3 w-full rounded-xl border border-border bg-surface/60 py-2 text-xs font-semibold">
                  {t("media.markSeason")}
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
  tmdbId, from, commentCount, seasonNumber, ep, watched, watchCount, onLogWatch, onUnwatch,
}: {
  tmdbId: number | undefined;
  from: string;
  commentCount: number;
  seasonNumber: number;
  ep: import("@/lib/tmdb/tmdb.functions").EpisodeInfo;
  watched: boolean;
  watchCount: number;
  onLogWatch: () => void;
  onUnwatch: () => void;
}) {
  const { t, locale } = useI18n();
  const airDate = ep.airDate ? new Date(ep.airDate) : null;
  const airLabel = airDate && !isNaN(airDate.getTime())
    ? airDate.toLocaleDateString(localeToBcp47(locale), { day: "2-digit", month: "short", year: "numeric" })
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
          {watchCount > 1 && (
            <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white/90">
              ×{watchCount}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ep.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {airLabel && <span className={isFuture ? "text-accent" : ""}>{isFuture ? t("media.airing") : ""}{airLabel}</span>}
            {ep.runtime ? <span>· {ep.runtime}′</span> : null}
            {ep.voteCount > 0 && (
              <span className="flex items-center gap-0.5">
                · <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> {ep.voteAverage.toFixed(1)}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {tmdbId ? (
              <Link
                to="/episode/$id/$season/$episode"
                params={{ id: String(tmdbId), season: String(seasonNumber), episode: String(ep.episodeNumber) }}
                state={{ from }}
                className="text-[11px] font-semibold text-accent hover:underline"
              >
                {t("media.plot")}
              </Link>
            ) : null}
            {tmdbId ? (
              <Link
                to="/episode/$id/$season/$episode"
                params={{ id: String(tmdbId), season: String(seasonNumber), episode: String(ep.episodeNumber) }}
                state={{ from }}
                aria-label={t("comments.title")}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition hover:text-accent"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {commentCount > 0 ? commentCount : null}
              </Link>
            ) : null}
            <button
              onClick={onLogWatch}
              disabled={!!isFuture && !watched}
              className={`ml-auto grid min-w-8 place-items-center rounded-lg px-1.5 text-xs font-bold transition ${
                watched ? "h-8 bg-hero text-primary-foreground shadow-glow-pink" :
                isFuture ? "h-8 border border-border/50 bg-surface/40 text-muted-foreground/40" :
                "h-8 border border-border bg-surface/60 text-muted-foreground hover:border-accent"
              }`}
              aria-label={
                watched && watchCount > 1
                  ? `S${seasonNumber}E${ep.episodeNumber} rivisto ${watchCount} volte — aggiungi visione`
                  : watched
                    ? `Segna S${seasonNumber}E${ep.episodeNumber} come rivisto`
                    : `Segna S${seasonNumber}E${ep.episodeNumber} come visto`
              }
            >
              {watched
                ? watchCount > 1
                  ? `×${watchCount}`
                  : <Check className="h-4 w-4" />
                : "+"}
            </button>
            {watched && (
              <button
                onClick={onUnwatch}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface/60 text-muted-foreground hover:border-destructive hover:text-destructive"
                aria-label={
                  watchCount > 1
                    ? `Rimuovi una visione da S${seasonNumber}E${ep.episodeNumber} (×${watchCount} → ×${watchCount - 1})`
                    : `Segna S${seasonNumber}E${ep.episodeNumber} come non visto`
                }
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function TrailerSection({ trailerKey }: { trailerKey: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4">
      {open ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-glow">
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
              title={t("media.trailer")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {t("media.hideTrailer")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow-pink"
        >
          <Play className="h-4 w-4 fill-current" /> {t("media.watchTrailer")}
        </button>
      )}
    </section>
  );
}

function CastSection({ cast, loading, returnPath }: { cast: CastMember[]; loading: boolean; returnPath: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const locale = useTmdbLocale();

  const prefetchPerson = (personId: number) => {
    void queryClient.prefetchQuery({
      queryKey: ["tmdb", "person", personId, locale],
      queryFn: () => tmdbPerson({ data: { personId, locale } }),
      staleTime: 1000 * 60 * 60,
    });
  };

  if (loading) {
    return (
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t("media.cast")}</h2>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            {t("common.loading")}
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
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">{t("media.cast")}</h2>
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

function formatItDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString();
}

/** Note private sull'entry (film o serie), salvate sul server. */
function EntryNotes({ entryId, initial }: { entryId: string; initial: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== initial.trim();

  const save = async () => {
    setSaving(true);
    try {
      const next = await libraryApi.setNotes(entryId, value.trim());
      queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
      toast.success(t("media.notesSaved"));
    } catch {
      toast.error(t("media.notesError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("media.notesTitle")}
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={t("media.notesPlaceholder")}
        className="w-full rounded-2xl border border-border bg-surface/40 p-3 text-sm outline-none focus:border-accent"
      />
      {dirty && (
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="mt-1 rounded-full bg-hero px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-glow-pink disabled:opacity-50"
        >
          {t("media.notesSave")}
        </button>
      )}
    </div>
  );
}
