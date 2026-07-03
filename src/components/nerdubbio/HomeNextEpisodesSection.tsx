import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UserMediaEntry } from "@/lib/user-store";
import { maxWatchedFrontier, listTvShowsForNextEpisode, tmdbIdFromMediaKey } from "@/lib/next-episode";
import { tmdbNextUnwatchedBatch, type NextUnwatchedInfo } from "@/lib/tmdb/tmdb.functions";
import { PremiereReminderButton } from "@/components/nerdubbio/PremiereReminderButton";
import { CalendarDays, ChevronRight } from "lucide-react";

type Props = {
  media: Record<string, UserMediaEntry>;
  from: string;
};

export function HomeNextEpisodesSection({ media, from }: Props) {
  const navigate = useNavigate();
  const inProgress = useMemo(() => listTvShowsForNextEpisode(media), [media]);

  const batchItems = useMemo(
    () => inProgress.map(entry => {
      const tmdbId = tmdbIdFromMediaKey(entry.id)!;
      const frontier = maxWatchedFrontier(entry);
      return {
        tmdbId,
        watched: entry.watchedEpisodes ?? [],
        lastSeason: frontier?.season,
        lastEpisode: frontier?.episode,
      };
    }),
    [inProgress],
  );

  const nextQuery = useQuery({
    queryKey: ["tmdb", "next-unwatched-batch", batchItems],
    queryFn: () => tmdbNextUnwatchedBatch({ data: { items: batchItems } }),
    enabled: batchItems.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const entryByTmdb = useMemo(() => {
    const map = new Map<number, UserMediaEntry>();
    for (const e of inProgress) {
      const id = tmdbIdFromMediaKey(e.id);
      if (id) map.set(id, e);
    }
    return map;
  }, [inProgress]);

  const rows = (nextQuery.data ?? []).slice(0, 6);

  if (inProgress.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider">Prossimi episodi</h2>
        <Link
          to="/profilo/serie"
          search={{ tab: "in_corso" }}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-accent"
        >
          Tutte <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {nextQuery.isLoading && (
        <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
          Calcolo prossimi episodi…
        </div>
      )}

      {!nextQuery.isLoading && rows.length === 0 && (
        <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
          Sei aggiornato su tutte le serie in corso.
        </div>
      )}

      <div className="space-y-3">
        {rows.map(({ tmdbId, next }) => {
          const entry = entryByTmdb.get(tmdbId);
          if (!entry) return null;
          return (
            <NextEpisodeRow
              key={tmdbId}
              entry={entry}
              tmdbId={tmdbId}
              next={next}
              from={from}
              onOpen={() => navigate({
                to: "/media/$type/$id",
                params: { type: "tv", id: String(tmdbId) },
                hash: `ep-S${next.season}E${next.episode}`,
                state: { from },
              })}
            />
          );
        })}
      </div>
    </section>
  );
}

function NextEpisodeRow({
  entry,
  tmdbId,
  next,
  from,
  onOpen,
}: {
  entry: UserMediaEntry;
  tmdbId: number;
  next: NextUnwatchedInfo;
  from: string;
  onOpen: () => void;
}) {
  const label = `S${next.season} · E${next.episode}`;
  const badge = next.kind === "premiere"
    ? "Premiere"
    : next.aired
      ? (next.name || "Da vedere")
      : next.airDate
        ? `Esce ${formatShortDate(next.airDate)}`
        : "In arrivo";
  const isFuture = !next.aired && !!next.airDate;

  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3">
      <Link
        to="/media/$type/$id"
        params={{ type: "tv", id: String(tmdbId) }}
        state={{ from }}
        className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2"
      >
        {entry.posterUrl
          ? <img src={entry.posterUrl} alt={entry.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
          : <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/media/$type/$id"
          params={{ type: "tv", id: String(tmdbId) }}
          state={{ from }}
          className="block truncate text-sm font-semibold hover:text-accent"
        >
          {entry.title ?? "Serie"}
        </Link>
        <p className="text-xs text-muted-foreground">
          {label}
          {next.name && next.aired ? <span className="text-foreground/80"> — {next.name}</span> : null}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-accent">
          {isFuture && <CalendarDays className="h-3 w-3" />}
          {badge}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full bg-hero px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-glow-pink"
          >
            Apri episodio →
          </button>
          {isFuture && (
            <PremiereReminderButton
              id={`${tmdbId}:S${next.season}E${next.episode}`}
              tmdbId={tmdbId}
              title={entry.title ?? "Serie"}
              label={`${label}${next.kind === "premiere" ? " — Premiere" : ""}`}
              airDate={next.airDate!}
              href={`/media/tv/${tmdbId}#ep-S${next.season}E${next.episode}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}
