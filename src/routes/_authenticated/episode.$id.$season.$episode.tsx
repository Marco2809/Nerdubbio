import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { OverlayBackButton } from "@/components/nerdubbio/OverlayBackButton";
import { EpisodeCommentsSection } from "@/components/nerdubbio/EpisodeCommentsSection";
import { tmdbSeason } from "@/lib/tmdb/tmdb.functions";
import { useTmdbLocale } from "@/lib/tmdb/use-tmdb-locale";
import { useSmartBack } from "@/lib/media-nav";
import { useI18n, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/episode/$id/$season/$episode")({
  head: () => ({ meta: [{ title: pageTitle("media") }] }),
  component: EpisodePage,
});

function EpisodePage() {
  const { t } = useI18n();
  const { id, season, episode } = Route.useParams();
  const tmdbId = Number(id);
  const seasonN = Number(season);
  const episodeN = Number(episode);
  const locale = useTmdbLocale();
  const goBack = useSmartBack("/app");

  const q = useQuery({
    queryKey: ["tmdb", "season", tmdbId, seasonN, locale],
    queryFn: () => tmdbSeason({ data: { tmdbId, seasonNumber: seasonN, locale } }),
    enabled: Number.isFinite(tmdbId) && tmdbId > 0 && Number.isFinite(seasonN),
    staleTime: 1000 * 60 * 60,
  });
  const ep = q.data?.episodes.find((e) => e.episodeNumber === episodeN);

  if (q.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  const epLabel = `${t("recap.season", { n: seasonN })} · ${t("episode.label")} ${episodeN}`;
  const epName = ep?.name || `${t("episode.label")} ${episodeN}`;

  return (
    <div className="pb-16">
      <div className="relative h-56 w-full overflow-hidden bg-surface-2">
        {ep?.stillUrl ? (
          <img src={ep.stillUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <OverlayBackButton onClick={goBack} label={t("common.back")} />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-xs uppercase tracking-widest text-white/80 [text-shadow:0_1px_8px_rgb(0_0_0_/_0.7)]">{epLabel}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-white [text-shadow:0_2px_12px_rgb(0_0_0_/_0.7)]">{epName}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4">
        {ep?.overview ? (
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">{ep.overview}</p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t("episode.noOverview")}</p>
        )}

        <EpisodeCommentsSection type="tv" tmdbId={tmdbId} season={seasonN} episode={episodeN} />
      </div>
    </div>
  );
}
