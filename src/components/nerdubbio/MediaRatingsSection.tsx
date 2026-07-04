import { useQuery } from "@tanstack/react-query";
import { Loader2, Star, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { tmdbRatingTrend } from "@/lib/tmdb/tmdb.functions";

type Props = {
  mediaType: "tv" | "movie";
  tmdbId: number;
  userRating?: number;
};

const chartConfig = {
  rating: {
    label: "Voto TMDB",
    color: "hsl(var(--accent))",
  },
};

const SEASON_COLORS = [
  "hsl(var(--accent) / 0.06)",
  "hsl(var(--hero) / 0.06)",
];

export function MediaRatingsSection({ mediaType, tmdbId, userRating }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tmdb", "rating-trend", mediaType, tmdbId],
    queryFn: () => tmdbRatingTrend({ data: { type: mediaType, tmdbId } }),
    enabled: tmdbId > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });

  if (tmdbId <= 0) return null;

  if (isLoading) {
    return (
      <section className="mt-6">
        <SectionHeader />
        <div className="glass flex h-32 items-center justify-center rounded-2xl">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      </section>
    );
  }

  if (error || !data) return null;

  if (mediaType === "movie") {
    return (
      <section className="mt-6">
        <SectionHeader subtitle="Voto medio TMDB" />
        <div className="grid grid-cols-2 gap-2">
          <ScoreCard
            label="TMDB"
            value={data.tmdbRating}
            detail={formatVoteCount(data.voteCount)}
            accent
          />
          <ScoreCard
            label="Il tuo voto"
            value={userRating != null ? userRating : null}
            detail={userRating != null ? "su 10" : "Non ancora votato"}
            muted={userRating == null}
          />
        </div>
      </section>
    );
  }

  const chartPoints = data.points.filter(p => p.rating != null);
  if (chartPoints.length === 0) return null;

  return (
    <section className="mt-6">
      <SectionHeader
        subtitle={
          data.seriesAvg != null
            ? `Media episodi ${data.seriesAvg.toFixed(1)}/10 · TMDB ${data.tmdbRating.toFixed(1)}`
            : `TMDB ${data.tmdbRating.toFixed(1)}`
        }
      />
      <TvRatingChart
        points={data.points}
        seasonMarkers={data.seasonMarkers}
        seriesAvg={data.seriesAvg}
        userRating={userRating}
      />
      {data.seasonMarkers.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.seasonMarkers.map(m => (
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

function TvRatingChart({
  points,
  seasonMarkers,
  seriesAvg,
  userRating,
}: {
  points: import("@/lib/tmdb/tmdb.functions").EpisodeRatingPoint[];
  seasonMarkers: import("@/lib/tmdb/tmdb.functions").SeasonRatingMarker[];
  seriesAvg: number | null;
  userRating?: number;
}) {
  const seasonTicks = useMemo(() => {
    const ticks = new Map<number, string>();
    for (const m of seasonMarkers) {
      ticks.set(m.startIndex, `S${m.season}`);
    }
    return ticks;
  }, [seasonMarkers]);

  const chartWidth = Math.max(320, points.length * 12);

  return (
    <div className="glass overflow-hidden rounded-2xl p-3">
      {userRating != null && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Il tuo voto serie: <span className="font-bold text-accent">{userRating}/10</span>
        </p>
      )}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div style={{ minWidth: chartWidth }}>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              {seasonMarkers.map((m, i) => (
                <ReferenceArea
                  key={m.season}
                  x1={m.startIndex}
                  x2={m.endIndex + 0.99}
                  fill={SEASON_COLORS[i % SEASON_COLORS.length]}
                  strokeOpacity={0}
                />
              ))}
              {seriesAvg != null && (
                <ReferenceLine
                  y={seriesAvg}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              )}
              <XAxis
                dataKey="index"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={({ x, y, payload }) => {
                  const label = seasonTicks.get(Number(payload.value));
                  if (!label) return null;
                  return (
                    <text x={x} y={y + 12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>
                      {label}
                    </text>
                  );
                }}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tickLine={false}
                axisLine={false}
                width={28}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as typeof points[number] | undefined;
                      if (!p) return "";
                      return `${p.label} · ${p.name}`;
                    }}
                    formatter={(value) => [
                      typeof value === "number" ? `${value.toFixed(1)}/10` : "—",
                      "TMDB",
                    ]}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="rating"
                stroke="hsl(var(--accent))"
                fill="hsl(var(--accent))"
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ r: 2, fill: "hsl(var(--accent))", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        Scorri → · linea tratteggiata = media episodi
      </p>
    </div>
  );
}

function formatVoteCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M voti`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k voti`;
  if (n > 0) return `${n} voti`;
  return "Pochi voti";
}
