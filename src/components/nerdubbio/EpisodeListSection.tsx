import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTmdbLocale } from "@/lib/tmdb/use-tmdb-locale";
import { tmdbSeason, type SeasonSummary } from "@/lib/tmdb/tmdb.functions";

export function EpisodeListSection({
  tmdbId,
  seasons,
  from,
}: {
  tmdbId: number;
  seasons?: SeasonSummary[];
  from: string;
}) {
  const { t } = useI18n();
  const tmdbLocale = useTmdbLocale();

  const real = (seasons ?? [])
    .filter((s) => s.seasonNumber >= 1 && s.episodeCount > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  const [selected, setSelected] = useState<number | null>(null);
  const active = selected ?? real[0]?.seasonNumber ?? null;

  const q = useQuery({
    queryKey: ["tmdb", "season", tmdbId, active, tmdbLocale],
    queryFn: () => tmdbSeason({ data: { tmdbId, seasonNumber: active!, locale: tmdbLocale } }),
    enabled: active != null && Number.isFinite(tmdbId) && tmdbId > 0,
    staleTime: 1000 * 60 * 60,
  });
  const episodes = q.data?.episodes ?? [];

  if (real.length === 0 || active == null) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">{t("episode.discussions")}</h2>

      {real.length > 1 && (
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {real.map((s) => {
            const on = s.seasonNumber === active;
            return (
              <button
                key={s.seasonNumber}
                onClick={() => setSelected(s.seasonNumber)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  on ? "bg-accent text-accent-foreground" : "border border-border text-muted-foreground active:bg-surface-2"
                }`}
              >
                {t("recap.season", { n: s.seasonNumber })}
              </button>
            );
          })}
        </div>
      )}

      {q.isLoading ? (
        <div className="grid place-items-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : (
        <div className="space-y-2">
          {episodes.map((e) => (
            <Link
              key={e.episodeNumber}
              to="/episode/$id/$season/$episode"
              params={{ id: String(tmdbId), season: String(active), episode: String(e.episodeNumber) }}
              state={{ from }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-2.5 transition active:bg-surface-1"
            >
              <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-1">
                {e.stillUrl ? <img src={e.stillUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {e.episodeNumber}. {e.name}
                </p>
                {e.overview ? (
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{e.overview}</p>
                ) : null}
              </div>
              <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
