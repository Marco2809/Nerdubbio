import { useQueries } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";
import type { SeasonSummary } from "@/lib/tmdb/tmdb.functions";
import { tmdbSeason } from "@/lib/tmdb/tmdb.functions";

const TvRatingChart = lazy(() =>
  import("@/components/nerdubbio/TvRatingChart").then(m => ({ default: m.TvRatingChart })),
);

export type SeasonChartEpisode = {
  episode: number;
  name: string;
  /** Voto su scala 0–5 (da TMDB / 2) */
  score: number;
  /** Voto TMDB originale 0–10 */
  rawScore: number;
};

export type SeasonChartData = {
  season: number;
  name: string;
  episodes: SeasonChartEpisode[];
  avgScore: number;
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
  const seasonCharts = useMemo(
    () => (mediaType === "tv" ? buildSeasonCharts(seasonQueries.map(q => q.data)) : []),
    [mediaType, seasonQueries],
  );

  if (tmdbId <= 0) return null;

  if (mediaType === "movie") {
    return (
      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider">Voti della community</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Voto medio TMDB</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ScoreCard
            label="Community"
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

  const hasChart = seasonCharts.some(s => s.episodes.length > 0);

  return (
    <section className="mt-6">
      {seasonsLoading && (
        <div className="glass flex h-36 items-center justify-center rounded-2xl">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      )}

      {!seasonsLoading && hasChart && (
        <Suspense
          fallback={
            <div className="glass flex h-36 items-center justify-center rounded-2xl">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          }
        >
          <TvRatingChart seasons={seasonCharts.filter(s => s.episodes.length > 0)} />
        </Suspense>
      )}

      {!seasonsLoading && !hasChart && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wider">Voti della community</h2>
          <p className="mt-3 glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
            Grafico episodi non disponibile: TMDB non ha ancora abbastanza voti per episodio.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ScoreCard label="TMDB serie" value={tmdbRating} detail={formatVoteCount(voteCount)} accent />
            <ScoreCard
              label="Il tuo voto"
              value={userRating ?? null}
              detail={userRating != null ? "su 10" : "Non ancora votato"}
              muted={userRating == null}
            />
          </div>
        </>
      )}
    </section>
  );
}

function buildSeasonCharts(
  seasons: Array<Awaited<ReturnType<typeof tmdbSeason>> | undefined>,
): SeasonChartData[] {
  const now = Date.now();
  const result: SeasonChartData[] = [];

  for (const data of seasons) {
    if (!data) continue;

    const episodes: SeasonChartEpisode[] = [];
    for (const e of data.episodes) {
      const airDate = e.airDate;
      const isFuture = airDate && new Date(airDate).getTime() > now;
      if (isFuture || e.voteCount <= 0) continue;

      episodes.push({
        episode: e.episodeNumber,
        name: e.name,
        score: e.voteAverage / 2,
        rawScore: e.voteAverage,
      });
    }

    if (episodes.length === 0) continue;

    const avgScore = episodes.reduce((s, ep) => s + ep.score, 0) / episodes.length;
    result.push({
      season: data.seasonNumber,
      name: data.name,
      episodes,
      avgScore,
    });
  }

  return result;
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
