import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { useUserStore } from "@/lib/user-store";
import { useI18n, localeToBcp47 } from "@/lib/i18n";
import { findById } from "@/lib/mock-catalog";
import {
  tmdbUpcomingMovies,
  tmdbNextEpisodes,
  tmdbUpcomingTv,
  type ProviderInfo,
  type UpcomingMovie,
  type NextEpisodeInfo,
} from "@/lib/tmdb/tmdb.functions";
import { ReleaseCalendar } from "@/components/nerdubbio/ReleaseCalendar";
import {
  eventsFromMovies,
  eventsFromNextEpisodes,
  filterCalendarByProvider,
  groupCalendarEvents,
} from "@/lib/release-calendar";
import { listTvShowsForNextEpisode, tmdbIdFromMediaKey } from "@/lib/next-episode";
import { CalendarDays, Film, Popcorn, MapPin, Sparkles, X } from "lucide-react";

const searchSchema = z.object({
  provider: fallback(z.number().int().positive().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/prossimi")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Prossime uscite — Nerdubbio" },
      { name: "description", content: "Calendario giorno per giorno dei prossimi episodi, premiere su streaming e film al cinema in Italia." },
    ],
  }),
  component: ProssimiPage,
});


/** Estrae {type, tmdb_id} da un id user-store: "tv-123" | "movie-45" | catalog id. */
function resolveMedia(id: string): { type: "tv" | "movie"; tmdbId: number; title?: string; poster?: string } | null {
  const m = /^(tv|movie)-(\d+)$/.exec(id);
  if (m) return { type: m[1] as "tv" | "movie", tmdbId: Number(m[2]) };
  const c = findById(id);
  if (c) return { type: c.type, tmdbId: c.tmdb_id, title: c.title, poster: c.poster };
  return null;
}

function ProssimiPage() {
  const { state } = useUserStore();
  const { t, locale } = useI18n();
  const { provider: providerId } = Route.useSearch();
  const navigate = useNavigate({ from: "/prossimi" });
  const [calendarMovies, setCalendarMovies] = useState(true);

  const calendarTvEntries = useMemo(
    () => listTvShowsForNextEpisode(state.media).slice(0, 30),
    [state.media],
  );
  const calendarTvIds = useMemo(
    () => calendarTvEntries.map(e => tmdbIdFromMediaKey(e.id)).filter((id): id is number => id != null),
    [calendarTvEntries],
  );

  const followedTv = Object.values(state.media)
    .filter(m => m.status === "watching" || m.status === "plan_to_watch")
    .map(m => ({
      media: resolveMedia(m.id),
      recency: Date.parse(m.lastWatchedAt ?? m.addedAt ?? "") || 0,
    }))
    .filter((x): x is { media: { type: "tv"; tmdbId: number }; recency: number } =>
      !!x.media && x.media.type === "tv");

  const allFollowedIds = Array.from(new Set(followedTv.map(x => x.media.tmdbId)));
  // L'API next-episodes accetta max 30 id: interroga le serie toccate più di recente.
  const uniqueTvIds = Array.from(new Set(
    [...followedTv].sort((a, b) => b.recency - a.recency).map(x => x.media.tmdbId),
  )).slice(0, 30);

  const tmdbLocale = localeToBcp47(locale);

  const upcomingQuery = useQuery({
    queryKey: ["tmdb", "upcoming-it", tmdbLocale],
    queryFn: () => tmdbUpcomingMovies({ data: { region: "IT", locale: tmdbLocale } }),
    staleTime: 1000 * 60 * 60,
  });

  const nextEpQuery = useQuery({
    queryKey: ["tmdb", "next-eps", uniqueTvIds, tmdbLocale],
    queryFn: () => tmdbNextEpisodes({ data: { tvIds: uniqueTvIds, region: "IT", locale: tmdbLocale } }),
    enabled: uniqueTvIds.length > 0,
    staleTime: 1000 * 60 * 30,
  });

  const calendarEpQuery = useQuery({
    queryKey: ["tmdb", "calendar-eps", calendarTvIds, tmdbLocale],
    queryFn: () => tmdbNextEpisodes({ data: { tvIds: calendarTvIds, region: "IT", locale: tmdbLocale } }),
    enabled: calendarTvIds.length > 0,
    staleTime: 1000 * 60 * 30,
  });

  const upcomingTvQuery = useQuery({
    queryKey: ["tmdb", "upcoming-tv-it", tmdbLocale],
    queryFn: () => tmdbUpcomingTv({ data: { region: "IT", days: 45, locale: tmdbLocale } }),
    staleTime: 1000 * 60 * 60,
  });

  // Filtri "In arrivo su streaming" configurabili dalle Impostazioni.
  const filters = state.upcomingFilters ?? { newSeries: true, seasonPremieres: true, includeMovies: true };
  const followedSet = new Set(allFollowedIds);

  // Solo "prime": serie nuove (stagione 1) per tutti; nuove stagioni SOLO di
  // serie che segui, e solo con l'episodio 1. Gli episodi correnti delle serie
  // seguite vivono in home, non qui.
  const isPremiereEvent = (i: NextEpisodeInfo) => {
    const ev = i.nextEpisode;
    return !!ev && (ev.kind === "premiere" || ev.episode === 1);
  };
  const passesSeasonRule = (i: NextEpisodeInfo, followed: boolean) => {
    const season = i.nextEpisode!.season;
    if (season <= 1) return filters.newSeries;
    return followed && filters.seasonPremieres;
  };

  const followedPremieres = (nextEpQuery.data?.items ?? [])
    .filter(i => isPremiereEvent(i) && passesSeasonRule(i, true));
  const discoverPremieres = (upcomingTvQuery.data?.items ?? [])
    .filter(i => !followedSet.has(i.tmdb_id) && isPremiereEvent(i) && passesSeasonRule(i, false));

  const rawUpcomingTv = [...followedPremieres, ...discoverPremieres]
    .sort((a, b) => (a.nextEpisode?.airDate ?? "").localeCompare(b.nextEpisode?.airDate ?? ""));
  const rawMovies = filters.includeMovies ? (upcomingQuery.data?.items ?? []) : [];

  // Provider disponibili: unione da tutte le sezioni, ordinati per frequenza (più comuni prima).
  const availableProviders = useMemo(() => {
    const freq = new Map<number, { info: ProviderInfo; count: number }>();
    const bump = (p: ProviderInfo) => {
      const cur = freq.get(p.id);
      if (cur) cur.count += 1;
      else freq.set(p.id, { info: p, count: 1 });
    };
    rawUpcomingTv.forEach(i => i.providers.forEach(bump));
    return Array.from(freq.values())
      .sort((a, b) => b.count - a.count || a.info.name.localeCompare(b.info.name))
      .map(x => x.info);
  }, [rawUpcomingTv]);

  const matchesProvider = <T extends { providers: ProviderInfo[] }>(x: T) =>
    !providerId || x.providers.some(p => p.id === providerId);

  const upcomingTvItems = rawUpcomingTv.filter(matchesProvider);
  const movies = rawMovies; // il filtro provider non si applica ai film al cinema

  const setProvider = (id: number | undefined) =>
    navigate({ search: { provider: id }, replace: true });

  const activeProvider = availableProviders.find(p => p.id === providerId);

  const calendarEvents = useMemo(() => {
    const tvItems = calendarEpQuery.data?.items ?? [];
    let events = eventsFromNextEpisodes(tvItems, followedSet, undefined, locale);
    if (calendarMovies && filters.includeMovies) {
      events = [...events, ...eventsFromMovies(upcomingQuery.data?.items ?? [], undefined, locale)];
    }
    events = filterCalendarByProvider(events, providerId);
    return groupCalendarEvents(events, undefined, locale);
  }, [
    calendarEpQuery.data,
    calendarMovies,
    filters.includeMovies,
    followedSet,
    providerId,
    upcomingQuery.data,
    locale,
  ]);

  const calendarLoading =
    (calendarTvIds.length > 0 && calendarEpQuery.isLoading)
    || (calendarMovies && filters.includeMovies && upcomingQuery.isLoading);

  return (
    <AppShell title={t("prossimi.title")} subtitle={t("prossimi.subtitle")}
      right={<span className="rounded-full bg-hero px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">{t("common.regionIt")}</span>}>

      <ReleaseCalendar
        days={calendarEvents}
        loading={calendarLoading}
        showMovies={calendarMovies}
        onToggleMovies={setCalendarMovies}
        hasLibraryShows={calendarTvIds.length > 0}
      />

      {/* Filtro provider */}
      {availableProviders.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("prossimi.filterProvider")}</p>
            {activeProvider && (
              <button
                type="button"
                onClick={() => setProvider(undefined)}
                className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-foreground"
              >
                <X className="h-3 w-3" /> {t("common.removeFilter")}
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setProvider(undefined)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                !providerId ? "bg-hero text-primary-foreground" : "glass text-foreground/80"
              }`}
            >
              {t("common.all")}
            </button>
            {availableProviders.map(p => {
              const active = p.id === providerId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(active ? undefined : p.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold transition ${
                    active ? "bg-hero text-primary-foreground" : "glass text-foreground/80"
                  }`}
                  title={p.name}
                >
                  {p.logoUrl
                    ? <img src={p.logoUrl} alt="" className="h-5 w-5 rounded-full" />
                    : <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[9px]">{p.name[0]}</span>}
                  <span className="max-w-[8rem] truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Serie in arrivo: nuove serie (S1) + nuove stagioni delle serie che segui */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider">{t("prossimi.streamingSection")}</h2>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("prossimi.streamingWindow")}</span>
        </div>
        {(upcomingTvQuery.isLoading || nextEpQuery.isLoading) && <SkeletonList />}
        {upcomingTvQuery.error && (
          <div className="glass rounded-2xl p-4 text-sm text-destructive">{t("prossimi.loadStreamingError")}</div>
        )}
        {upcomingTvQuery.data && !nextEpQuery.isLoading && upcomingTvItems.length === 0 && (
          <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
            {activeProvider
              ? <>{t("prossimi.noStreamingProvider", { provider: activeProvider.name })}</>
              : t("prossimi.noStreaming")}
          </div>
        )}
        {upcomingTvItems.length > 0 && (
          <ShowMoreList
            items={upcomingTvItems}
            initial={3}
            render={it => (
              <NextEpisodeCard key={it.tmdb_id} it={it} followed={followedSet.has(it.tmdb_id)} />
            )}
          />
        )}
      </section>


      {filters.includeMovies && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Popcorn className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold uppercase tracking-wider">{t("prossimi.cinemaSection")}</h2>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("prossimi.cinemaHint")}</span>
          </div>
          {upcomingQuery.isLoading && <SkeletonList />}
          {upcomingQuery.error && (
            <div className="glass rounded-2xl p-4 text-sm text-destructive">{t("prossimi.loadCinemaError")}</div>
          )}
          {upcomingQuery.data && movies.length === 0 && (
            <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
              {t("prossimi.noCinema")}
            </div>
          )}
          {movies.length > 0 && (
            <ShowMoreList
              items={movies}
              initial={3}
              className="grid grid-cols-1 gap-3"
              render={m => <UpcomingMovieCard key={m.tmdb_id} m={m} />}
            />
          )}
        </section>
      )}
    </AppShell>
  );
}

function ShowMoreList<T>({
  items,
  initial = 3,
  render,
  className = "space-y-3",
}: {
  items: T[];
  initial?: number;
  render: (item: T) => ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initial);
  const hidden = items.length - initial;

  return (
    <>
      <div className={className}>{visible.map(render)}</div>
      {items.length > initial && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-3 w-full rounded-xl border border-border bg-surface/60 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-foreground"
        >
          {expanded ? t("common.showLess") : t("common.showMore", { count: hidden })}
        </button>
      )}
    </>
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

function ProviderStrip({ providers, label = "Su" }: { providers: ProviderInfo[]; label?: string }) {
  if (!providers.length) {
    return <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Nessun provider IT</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {providers.slice(0, 4).map(p => (
        <span key={p.id} title={p.name} className="glass flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2">
          {p.logoUrl
            ? <img src={p.logoUrl} alt={p.name} className="h-5 w-5 rounded-full" />
            : <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[8px]">{p.name[0]}</span>}
          <span className="text-[10px] font-semibold">{p.name}</span>
        </span>
      ))}
    </div>
  );
}

function NextEpisodeCard({ it, followed = false }: { it: NextEpisodeInfo; followed?: boolean }) {
  const ev = it.nextEpisode;
  return (
    <Link to="/media/$type/$id" params={{ type: "tv", id: `tv-${it.tmdb_id}` }}
      className="glass block rounded-2xl p-3">
      <div className="flex gap-3">
        {it.posterUrl
          ? <img src={it.posterUrl} alt={it.title} className="h-24 w-16 rounded-xl object-cover" />
          : <div className="h-24 w-16 rounded-xl bg-surface-2" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold">{it.title}</p>
            <span className="flex shrink-0 items-center gap-1">
              {followed && (
                <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  La segui
                </span>
              )}
              {ev?.kind === "premiere" && (
                <span className="rounded-full bg-neon px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Sparkles className="mr-1 inline h-3 w-3" />Premiere
                </span>
              )}
            </span>
          </div>
          {ev ? (
            <>
              <p className="mt-0.5 text-xs text-accent">
                {ev.kind === "episode"
                  ? <>S{ev.season} · E{ev.episode}{ev.name && <span className="text-foreground/80"> — {ev.name}</span>}</>
                  : <>Nuova stagione {ev.season}{ev.name && ev.name !== `Stagione ${ev.season}` && <span className="text-foreground/80"> — {ev.name}</span>}</>}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> {formatDate(ev.airDate)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">Nessun episodio annunciato</p>
          )}
          <div className="mt-2"><ProviderStrip providers={it.providers} /></div>
        </div>
      </div>
    </Link>
  );
}

function UpcomingMovieCard({ m }: { m: UpcomingMovie }) {
  return (
    <Link to="/media/$type/$id" params={{ type: "movie", id: `movie-${m.tmdb_id}` }}
      className="glass block overflow-hidden rounded-2xl">
      <div className="flex gap-3 p-3">
        {m.posterUrl
          ? <img src={m.posterUrl} alt={m.title} className="h-28 w-20 shrink-0 rounded-xl object-cover" />
          : <div className="h-28 w-20 shrink-0 rounded-xl bg-surface-2" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold">{m.title}</p>
            <span className="shrink-0 rounded-full bg-neon px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              <Film className="mr-1 inline h-3 w-3" />Cinema
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> {formatDate(m.releaseDate)}
            <span className="mx-1">·</span>
            <MapPin className="h-3 w-3" /> IT
          </p>
          {m.overview && <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{m.overview}</p>}
        </div>
      </div>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="glass flex gap-3 rounded-2xl p-3">
          <div className="h-24 w-16 animate-pulse rounded-xl bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
