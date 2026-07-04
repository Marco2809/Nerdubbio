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
import type { EpisodeRatingPoint, SeasonRatingMarker } from "@/components/nerdubbio/MediaRatingsSection";

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

export function TvRatingChart({
  points,
  seasonMarkers,
  seriesAvg,
  userRating,
}: {
  points: EpisodeRatingPoint[];
  seasonMarkers: SeasonRatingMarker[];
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
                      const p = payload?.[0]?.payload as EpisodeRatingPoint | undefined;
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
