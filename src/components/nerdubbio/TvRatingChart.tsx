import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { SeasonChartData, SeasonChartEpisode } from "@/components/nerdubbio/MediaRatingsSection";

const chartConfig = {
  score: {
    label: "Community",
    color: "var(--accent)",
  },
};

/** Colori SVG: var() oklch del tema — mai hsl(var(...)) */
const DOT = {
  accent: "var(--accent)",
  foreground: "var(--foreground)",
  line: "var(--accent)",
} as const;

type ChartRow = SeasonChartEpisode & {
  label: string;
};

export function TvRatingChart({ seasons }: { seasons: SeasonChartData[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, Math.max(0, seasons.length - 1));
  const current = seasons[safeIdx];

  const { chartData, bestEp, worstEp } = useMemo(() => {
    if (!current) return { chartData: [] as ChartRow[], bestEp: 0, worstEp: 0 };

    const data: ChartRow[] = current.episodes.map(ep => ({
      ...ep,
      label: `E${ep.episode}`,
    }));

    let best = data[0]?.episode ?? 0;
    let worst = data[0]?.episode ?? 0;
    let bestScore = data[0]?.score ?? 0;
    let worstScore = data[0]?.score ?? 0;

    for (const ep of data) {
      if (ep.score > bestScore) {
        bestScore = ep.score;
        best = ep.episode;
      }
      if (ep.score < worstScore) {
        worstScore = ep.score;
        worst = ep.episode;
      }
    }

    return { chartData: data, bestEp: best, worstEp: worst };
  }, [current]);

  if (!current || chartData.length === 0) return null;

  const canPrev = safeIdx > 0;
  const canNext = safeIdx < seasons.length - 1;

  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Voti della community</h3>
        <div className="flex items-center gap-1">
          {seasons.length > 1 && (
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setActiveIdx(i => i - 1)}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 disabled:opacity-30"
              aria-label="Stagione precedente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <span className="min-w-[5.5rem] text-center text-sm font-semibold text-muted-foreground">
            Stagione {current.season}
          </span>
          {seasons.length > 1 && (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setActiveIdx(i => i + 1)}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 disabled:opacity-30"
              aria-label="Stagione successiva"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <LineChart data={chartData} margin={{ top: 14, right: 14, left: -4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--foreground)" strokeOpacity={0.1} />
          <XAxis dataKey="episode" hide />
          <YAxis
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            tickLine={false}
            axisLine={false}
            width={20}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as ChartRow | undefined;
                  if (!p) return "";
                  return `E${p.episode} · ${p.name}`;
                }}
                formatter={(value, _name, item) => {
                  const raw = (item.payload as ChartRow).rawScore;
                  return [
                    typeof value === "number"
                      ? `${value.toFixed(1)}/5 (${raw.toFixed(1)}/10 TMDB)`
                      : "—",
                    "Community",
                  ];
                }}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={DOT.line}
            strokeOpacity={0.65}
            strokeWidth={2.5}
            connectNulls
            dot={(props) => (
              <EpisodeDot
                {...props}
                bestEp={bestEp}
                worstEp={worstEp}
                multi={chartData.length > 1}
              />
            )}
            activeDot={(props) => (
              <NormalEpisodeDot cx={props.cx} cy={props.cy} large />
            )}
          />
        </LineChart>
      </ChartContainer>

      {seasons.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {seasons.map((s, i) => (
            <button
              key={s.season}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={`Stagione ${s.season}`}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIdx ? "w-4 bg-accent" : "w-1.5 bg-muted-foreground/35"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EpisodeDot({
  cx,
  cy,
  payload,
  bestEp,
  worstEp,
  multi,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartRow;
  bestEp: number;
  worstEp: number;
  multi: boolean;
}) {
  if (cx == null || cy == null || !payload) return null;

  const isBest = multi && payload.episode === bestEp;
  const isWorst = multi && payload.episode === worstEp && bestEp !== worstEp;

  if (isBest) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={13} fill="#10b981" />
        <circle cx={cx} cy={cy} r={13} fill="none" stroke="#6ee7b7" strokeWidth={2} />
        <SvgIcon cx={cx} cy={cy} type="star" />
      </g>
    );
  }

  if (isWorst) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={13} fill="#f97316" />
        <circle cx={cx} cy={cy} r={13} fill="none" stroke="#fdba74" strokeWidth={2} />
        <SvgIcon cx={cx} cy={cy} type="trend-down" />
      </g>
    );
  }

  return <NormalEpisodeDot cx={cx} cy={cy} />;
}

/** Opzione B mockup: alone bianco + nucleo accent */
function NormalEpisodeDot({
  cx,
  cy,
  large,
}: {
  cx?: number;
  cy?: number;
  large?: boolean;
}) {
  if (cx == null || cy == null) return null;

  const outer = large ? 11 : 9;
  const inner = large ? 7.5 : 6.5;

  return (
    <g>
      <circle cx={cx} cy={cy} r={outer} fill={DOT.foreground} fillOpacity={0.96} />
      <circle cx={cx} cy={cy} r={inner} fill={DOT.accent} />
    </g>
  );
}

function SvgIcon({ cx, cy, type }: { cx: number; cy: number; type: "star" | "trend-down" }) {
  const size = 12;
  const x = cx - size / 2;
  const y = cy - size / 2;

  if (type === "star") {
    return (
      <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  }

  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}
