import { useState } from "react";
import { Clapperboard, Loader2, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { useTmdbLocale } from "@/lib/tmdb/use-tmdb-locale";
import { tmdbSeason, type SeasonSummary } from "@/lib/tmdb/tmdb.functions";
import { recapApi, type RecapScene, type RecapEpisodeInput } from "@/lib/php/recap-client";
import { RecapReel } from "./RecapReel";

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

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("recap.title")}</p>

      {isTv && realSeasons.length > 1 && (
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {realSeasons.map((s) => {
            const active = s.seasonNumber === effective;
            return (
              <button
                key={s.seasonNumber}
                onClick={() => setSelected(s.seasonNumber)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "border border-border text-muted-foreground active:bg-surface-2"
                }`}
              >
                {t("recap.season", { n: s.seasonNumber })}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={run}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hero px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow-pink transition active:scale-[.98] disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("recap.generating")}
          </>
        ) : scenes ? (
          <>
            <Clapperboard className="h-4 w-4" />
            {t("recap.watch")}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {t("recap.generate")}
          </>
        )}
      </button>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t("recap.hint")}</p>

      {scenes && (
        <RecapReel scenes={scenes} title={reelTitle} open={open} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
