import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { useTmdbLocale } from "@/lib/tmdb/use-tmdb-locale";
import { tmdbSeason, type SeasonSummary } from "@/lib/tmdb/tmdb.functions";
import { recapApi, type RecapScene, type RecapEpisodeInput } from "@/lib/php/recap-client";
import { RecapReel } from "./RecapReel";
import { moodFromGenres } from "./recapMusic";

export function RecapSection({
  type,
  tmdbId,
  title,
  year,
  genres,
  overview,
  seasons,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  title: string;
  year?: number;
  genres?: string[];
  overview?: string;
  seasons?: SeasonSummary[];
}) {
  const { t, locale } = useI18n();
  const tmdbLocale = useTmdbLocale();

  const isTv = type === "tv";
  const today = new Date().toISOString().slice(0, 10);
  const realSeasons = (seasons ?? [])
    // Solo stagioni già iniziate (niente stagioni future non ancora uscite).
    .filter((s) => s.seasonNumber >= 1 && s.episodeCount > 0 && (!s.airDate || s.airDate <= today))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const lastSeason = realSeasons.length ? realSeasons[realSeasons.length - 1]!.seasonNumber : null;

  const [selected, setSelected] = useState<number | null>(null);
  const effective = selected ?? lastSeason;

  const [byKey, setByKey] = useState<Record<string, RecapScene[]>>({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const plot = (overview ?? "").trim();
  const canGenerate = plot.length >= 20 || (isTv && realSeasons.length > 0);
  if (!canGenerate || !Number.isFinite(tmdbId) || tmdbId <= 0) return null;

  const activeKey = isTv && effective != null ? String(effective) : "full";
  const scenes = byKey[activeKey] ?? null;
  const reelTitle = isTv && effective != null ? `${title} · ${t("recap.season", { n: effective })}` : title;

  const run = async () => {
    if (scenes) {
      setOpen(true);
      return;
    }
    setLoading(true);
    try {
      let episodes: RecapEpisodeInput[] | undefined;
      let seasonStr = "full";
      if (isTv && effective != null) {
        seasonStr = String(effective);
        const data = await tmdbSeason({ data: { tmdbId, seasonNumber: effective, locale: tmdbLocale } });
        // Niente recap di una stagione ancora in corso: se un episodio non è
        // ancora uscito (data futura o assente), blocca.
        const unaired = data.episodes.filter((e) => !e.airDate || e.airDate > today);
        if (data.episodes.length === 0 || unaired.length > 0) {
          toast.warning(t("recap.incompleteSeason"));
          return;
        }
        episodes = data.episodes
          .map((e) => ({ n: e.episodeNumber, t: e.name, o: (e.overview || "").slice(0, 600) }))
          .filter((e) => e.o || e.t);
      }
      const res = await recapApi.generate({
        type,
        tmdbId,
        season: seasonStr,
        lang: locale,
        title,
        year,
        genres,
        plot,
        episodes,
      });
      setByKey((prev) => ({ ...prev, [activeKey]: res.scenes }));
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message || t("recap.error"));
    } finally {
      setLoading(false);
    }
  };

  const tileTitle = isTv
    ? effective != null
      ? t("recap.tileSeason", { n: effective })
      : t("recap.tileSeries")
    : t("recap.tileMovie");

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface-2 p-3">
        <button
          onClick={run}
          disabled={loading}
          aria-label={tileTitle}
          className="flex items-center gap-4 text-left transition active:opacity-80 disabled:opacity-90"
        >
          <div
            className="relative grid h-32 w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl"
            style={{
              background: "#15140f",
              backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)",
              backgroundSize: "4px 4px",
            }}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#e0a52e" }} />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "#e0a52e" }}>
                <Play className="h-4 w-4" style={{ color: "#20241b", fill: "#20241b" }} />
              </span>
            )}
            {isTv && effective != null && !loading && (
              <span
                className="absolute bottom-1.5 left-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: "#e8e2d0" }}
              >
                S{effective}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#c98f14" }}>
              {t("recap.title")}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-foreground">
              {loading ? t("recap.generating") : tileTitle}
            </p>
          </div>
        </button>

        {isTv && realSeasons.length > 1 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
            {realSeasons.map((s) => {
              const active = s.seasonNumber === effective;
              return (
                <button
                  key={s.seasonNumber}
                  onClick={() => setSelected(s.seasonNumber)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active ? "" : "border border-border text-muted-foreground active:bg-surface-1"
                  }`}
                  style={active ? { background: "#e0a52e", color: "#20241b" } : undefined}
                >
                  {t("recap.season", { n: s.seasonNumber })}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {scenes && (
        <RecapReel
          scenes={scenes}
          title={reelTitle}
          mood={moodFromGenres(genres)}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
