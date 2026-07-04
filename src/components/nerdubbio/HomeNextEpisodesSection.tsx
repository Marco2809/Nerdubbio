import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useUserStore, type MediaMeta, type UserMediaEntry } from "@/lib/user-store";
import {
  buildNextUnwatchedPayload,
  HOME_NEXT_EPISODES_DISPLAY,
  HOME_NEXT_EPISODES_LIMIT,
  listTvShowsForNextEpisode,
  localNextAfterFrontier,
  nextEpisodeQueryKey,
  NEXT_UNWATCHED_BATCH_KEY,
  tmdbIdFromMediaKey,
} from "@/lib/next-episode";
import { tmdbNextUnwatched, type NextUnwatchedInfo } from "@/lib/tmdb/tmdb.functions";
import { PremiereReminderButton } from "@/components/nerdubbio/PremiereReminderButton";
import { toast } from "@/lib/toast";
import { CalendarDays, Check, ChevronRight } from "lucide-react";

type Props = {
  media: Record<string, UserMediaEntry>;
  from: string;
};

export function HomeNextEpisodesSection({ media, from }: Props) {
  const { toggleEpisode } = useUserStore();
  const [expanded, setExpanded] = useState(false);
  // Ordinate per ultima visione: in cima le serie toccate di recente,
  // mai ripescaggi casuali di anni fa.
  const inProgress = useMemo(
    () => listTvShowsForNextEpisode(media).slice(0, HOME_NEXT_EPISODES_LIMIT),
    [media],
  );

  const markWatched = (entry: UserMediaEntry, next: NextUnwatchedInfo) => {
    const meta: MediaMeta = {
      title: entry.title,
      type: "tv",
      year: entry.year,
      posterUrl: entry.posterUrl ?? null,
      backdropUrl: entry.backdropUrl ?? null,
    };
    // episodesPerSeason 999: da qui non conosciamo il totale stagione — nessun
    // falso bonus "+50 stagione completa" (si prende dalla scheda serie).
    toggleEpisode(entry.id, next.season, next.episode, 999, 1, meta);
    toast.reward(`S${next.season}E${next.episode} vista!`, 15, {
      description: entry.title ?? undefined,
      action: {
        label: "Annulla",
        onClick: () => toggleEpisode(entry.id, next.season, next.episode, 999, 1, meta),
      },
      duration: 4000,
    });
  };

  const nextQueries = useQueries({
    queries: inProgress.map(entry => {
      const payload = buildNextUnwatchedPayload(entry);
      return {
        queryKey: nextEpisodeQueryKey(entry),
        queryFn: async (): Promise<{ entry: UserMediaEntry; next: NextUnwatchedInfo; fromLocal: boolean } | null> => {
          if (!payload) return null;
          try {
            const next = await tmdbNextUnwatched({ data: payload });
            // null = sei in pari con la serie: niente riga, NON inventare episodi.
            return next ? { entry, next, fromLocal: false } : null;
          } catch {
            // Solo se TMDB è giù: stima locale frontier+1.
            const local = localNextAfterFrontier(entry);
            return local ? { entry, next: local, fromLocal: true } : null;
          }
        },
        enabled: !!payload,
        staleTime: 0,
        refetchOnMount: "always" as const,
      };
    }),
  });

  const isLoading = nextQueries.some(q => q.isLoading);

  const rows = useMemo(() => {
    const out: { entry: UserMediaEntry; tmdbId: number; next: NextUnwatchedInfo; fromLocal: boolean }[] = [];
    for (const q of nextQueries) {
      const row = q.data;
      if (!row) continue;
      const tmdbId = tmdbIdFromMediaKey(row.entry.id);
      if (!tmdbId) continue;
      out.push({ ...row, tmdbId });
    }
    return out;
  }, [nextQueries]);

  const hasErrors = nextQueries.some(q => q.isError);

  if (inProgress.length === 0) return null;

  const visibleRows = expanded ? rows : rows.slice(0, HOME_NEXT_EPISODES_DISPLAY);
  const hiddenCount = rows.length - HOME_NEXT_EPISODES_DISPLAY;

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

      {isLoading && (
        <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
          Calcolo prossimi episodi…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
          {inProgress.length === 1 ? (
            <>
              Nessun prossimo episodio per <strong>{inProgress[0]!.title ?? "questa serie"}</strong>.
              {maxProgressLabel(inProgress[0]!)}
            </>
          ) : (
            <>Nessun prossimo episodio calcolabile per le serie in corso.</>
          )}
          {hasErrors ? " Errore TMDB — riprova tra poco." : null}
          {" "}Apri la scheda serie per verificare il progresso.
        </div>
      )}

      <div className="space-y-3">
        {visibleRows.map(({ tmdbId, entry, next, fromLocal }) => (
          <NextEpisodeRow
            key={entry.id}
            entry={entry}
            tmdbId={tmdbId}
            next={next}
            fromLocal={fromLocal}
            from={from}
            onMark={() => markWatched(entry, next)}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-3 w-full rounded-xl border border-border bg-surface/60 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-foreground"
        >
          {expanded ? "Mostra meno" : `Mostra altro (${hiddenCount})`}
        </button>
      )}
    </section>
  );
}

function maxProgressLabel(entry: UserMediaEntry): string {
  const n = entry.watchedEpisodes?.length ?? 0;
  const cs = entry.currentSeason;
  const ce = entry.currentEpisode;
  if (cs && ce) return ` Ultimo segnato: S${cs}E${ce}${n ? ` (${n} episodi in libreria)` : ""}.`;
  if (n) return ` ${n} episodi segnati in libreria.`;
  return " Nessun episodio segnato ancora.";
}

function NextEpisodeRow({
  entry,
  tmdbId,
  next,
  fromLocal,
  from,
  onMark,
}: {
  entry: UserMediaEntry;
  tmdbId: number;
  next: NextUnwatchedInfo;
  fromLocal?: boolean;
  from: string;
  onMark: () => void;
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
          {next.name && next.aired && next.name !== "Prossimo episodio"
            ? <span className="text-foreground/80"> — {next.name}</span>
            : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-accent">
          {isFuture && <CalendarDays className="h-3 w-3" />}
          {badge}
          {fromLocal && (
            <span className="rounded-full border border-border px-1.5 text-[9px] text-muted-foreground">
              stima locale
            </span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {next.aired && (
            <button
              type="button"
              onClick={onMark}
              className="flex items-center gap-1 rounded-full bg-hero px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-glow-pink"
            >
              <Check className="h-3 w-3" /> Segna S{next.season}E{next.episode} vista
            </button>
          )}
          {isFuture && next.airDate && (
            <PremiereReminderButton
              id={`${tmdbId}:S${next.season}E${next.episode}`}
              tmdbId={tmdbId}
              title={entry.title ?? "Serie"}
              label={`${label}${next.kind === "premiere" ? " — Premiere" : ""}`}
              airDate={next.airDate}
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
