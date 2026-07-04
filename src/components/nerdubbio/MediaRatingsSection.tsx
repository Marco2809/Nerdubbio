import { useQueries } from "@tanstack/react-query";
import { Loader2, Star, TrendingUp } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";
import type { SeasonSummary } from "@/lib/tmdb/tmdb.functions";
import { tmdbSeason } from "@/lib/tmdb/tmdb.functions";

const TvRatingChart = lazy(() =>
  import("@/components/nerdubbio/TvRatingChart").then(m => ({ default: m.TvRatingChart })),
);

export type EpisodeRatingPoint = {
  index: number;
  season: number;
  episode: number;
  label: string;
  name: string;
  rating: number | null;
  voteCount: number;
  airDate: string | null;
};

export type SeasonRatingMarker = {
  season: number;
  startIndex: number;
  endIndex: number;
  name: string;
  avgRating: number;
  episodeCount: number;
};

type Props = {
  mediaType: "tv" | "movie";
  tmdbId: number;
  tmdbRating: number;
  voteCount?: number;
  seasonsInfo?: SeasonSummary[];
  userRating?: number;
};

export function MediaRatingsSection({
  mediaType,
  tmdbId,
  tmdbRating,
  voteCount = 0,
  seasonsInfo,
  userRating,
}: Props) {
  const seasons = seasonsInfo ?? [];

  const seasonQueries = useQueries({
    queries: seasons.map(s => ({
      queryKey: ["tmdb", "season", tmdbId, s.seasonNumber],
      queryFn: () => tmdbSeason({ data: { tmdbId, seasonNumber: s.seasonNumber } }),
      enabled: mediaType === "tv" && tmdbId > 0,
      staleTime: 1000 * 60 * 60,
    })),
  });

  const seasonsLoading = seasonQueries.some(q => q.isLoading);
  const trend = useMemo(
    () => (mediaType === "tv" ? buildEpisodeTrend(seasonQueries.map(q => q.data)) : null),
    [mediaType, seasonQueries],
  );

  if (tmdbId <= 0) return null;

  if (mediaType === "movie") {
    return (
      <section className="mt-6">
        <SectionHeader subtitle="Voto medio TMDB" />
        <div className="grid grid-cols-2 gap-2">
          <ScoreCard
            label="TMDB"
            value={tmdbRating}
            detail={formatVoteCount(voteCount)}
            accent
          />
          <ScoreCard
            label="Il tuo voto"
            value={userRating ?? null}
            detail={userRating != null ? "su 10" : "Non ancora votato"}
            muted={userRating == null}
          />
        </div>
      </section>
    );
  }

  const chartPoints = trend?.points.filter(p => p.rating != null) ?? [];
  const subtitle = trend?.seriesAvg != null
    ? `Media episodi ${trend.seriesAvg.toFixed(1)}/10 · TMDB ${tmdbRating.toFixed(1)}`
    : `TMDB ${tmdbRating.toFixed(1)}`;

  return (
    <section className="mt-6">
      <SectionHeader subtitle={subtitle} />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <ScoreCard label="TMDB serie" value={tmdbRating} detail={formatVoteCount(voteCount)} accent />
        <ScoreCard
          label="Il tuo voto"
          value={userRating ?? null}
          detail={userRating != null ? "su 10" : "Non ancora votato"}
          muted={userRating == null}
        />
      </div>

      {seasonsLoading && (
        <div className="glass flex h-28 items-center justify-center rounded-2xl">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      )}

      {!seasonsLoading && chartPoints.length > 0 && trend && (
        <Suspense
          fallback={
            <div className="glass flex h-28 items-center justify-center rounded-2xl">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          }
        >
          <TvRatingChart
            points={trend.points}
            seasonMarkers={trend.seasonMarkers}
            seriesAvg={trend.seriesAvg}
            userRating={userRating}
          />
        </Suspense>
      )}

      {!seasonsLoading && chartPoints.length === 0 && (
        <p className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
          Grafico episodi non disponibile: TMDB non ha ancora abbastanza voti per episodio.
        </p>
      )}

      {!seasonsLoading && (trend?.seasonMarkers.length ?? 0) > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {trend!.seasonMarkers.map(m => (
            <span
              key={m.season}
              className="rounded-full border border-border bg-surface/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
            >
              S{m.season}: {m.avgRating > 0 ? `${m.avgRating.toFixed(1)}/10` : "—"}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function buildEpisodeTrend(
  seasons: Array<Awaited<ReturnType<typeof tmdbSeason>> | undefined>,
): {
  points: EpisodeRatingPoint[];
  seasonMarkers: SeasonRatingMarker[];
  seriesAvg: number | null;
} {
  const points: EpisodeRatingPoint[] = [];
  const seasonMarkers: SeasonRatingMarker[] = [];
  let index = 0;
  const now = Date.now();

  for (const data of seasons) {
    if (!data) continue;
    const sn = data.seasonNumber;
    const startIndex = index;
    let sum = 0;
    let rated = 0;

    for (const e of data.episodes) {
      const airDate = e.airDate;
      const isFuture = airDate && new Date(airDate).getTime() > now;
      if (isFuture) continue;

      const rating = e.voteCount > 0 ? e.voteAverage : null;
      points.push({
        index,
        season: sn,
        episode: e.episodeNumber,
        label: `S${sn}E${e.episodeNumber}`,
        name: e.name,
        rating,
        voteCount: e.voteCount,
        airDate,
      });
      if (rating != null) {
        sum += rating;
        rated++;
      }
      index++;
    }

    if (startIndex < index) {
      seasonMarkers.push({
        season: sn,
        startIndex,
        endIndex: index - 1,
        name: data.name,
        avgRating: rated > 0 ? sum / rated : 0,
        episodeCount: index - startIndex,
      });
    }
  }

  const ratedPoints = points.filter(p => p.rating != null);
  const seriesAvg = ratedPoints.length
    ? ratedPoints.reduce((s, p) => s + (p.rating ?? 0), 0) / ratedPoints.length
    : null;

  return { points, seasonMarkers, seriesAvg };
}

function SectionHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
        <TrendingUp className="h-4 w-4 text-accent" />
        Voti
      </h2>
      {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function ScoreCard({
  label,
  value,
  detail,
  accent,
  muted,
}: {
  label: string;
  value: number | null;
  detail: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`glass rounded-2xl p-4 ${accent ? "ring-1 ring-accent/30" : ""}`}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end gap-1">
        {value != null ? (
          <>
            <span className={`text-3xl font-extrabold tabular-nums ${muted ? "text-muted-foreground" : "text-gradient"}`}>
              {value.toFixed(1)}
            </span>
            <Star className={`mb-1 h-4 w-4 ${accent ? "fill-accent text-accent" : "text-muted-foreground"}`} />
          </>
        ) : (
          <span className="text-lg font-semibold text-muted-foreground">—</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatVoteCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M voti`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k voti`;
  if (n > 0) return `${n} voti`;
  return "Pochi voti";
}
