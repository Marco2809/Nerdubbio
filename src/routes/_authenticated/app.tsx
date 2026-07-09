import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { findById } from "@/lib/mock-catalog";
import { useUserStore, computeStats, type UserMediaEntry } from "@/lib/user-store";
import { isMediaAlreadyWatched } from "@/lib/library-display";
import { Sparkles, Flame, Trophy, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { tmdbTrending } from "@/lib/tmdb/tmdb.functions";
import { useTmdbLocale } from "@/lib/tmdb/use-tmdb-locale";
import { HomeNextEpisodesSection } from "@/components/nerdubbio/HomeNextEpisodesSection";
import { FriendRecommendationsSection } from "@/components/nerdubbio/FriendRecommendationsSection";
import { NERDACOLO } from "@/lib/brand";
import { useReturnPath } from "@/lib/media-nav";
import { NerdacoloTrigger } from "@/components/nerdubbio/NerdacoloTrigger";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useEffect } from "react";
import { useI18n, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: pageTitle("home") }] }),
  component: HomeDashboard,
});

type LibCard = {
  id: string;
  type: "movie" | "tv";
  title: string;
  year?: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
};

function entryToCard(e: UserMediaEntry): LibCard | null {
  if (e.title) {
    return {
      id: e.id,
      type: e.type ?? (e.id.startsWith("movie-") ? "movie" : "tv"),
      title: e.title,
      year: e.year,
      posterUrl: e.posterUrl ?? null,
      backdropUrl: e.backdropUrl ?? null,
    };
  }
  const mock = findById(e.id);
  if (!mock) return null;
  return {
    id: mock.id,
    type: mock.type,
    title: mock.title,
    year: mock.year,
    posterUrl: null,
    backdropUrl: null,
  };
}

function paramsFor(card: LibCard) {
  // TMDB entries have id "movie-123" or "tv-456"
  const m = /^(movie|tv)-(\d+)$/.exec(card.id);
  if (m) return { type: m[1] as "movie" | "tv", id: m[2] };
  return { type: card.type, id: card.id };
}

function HomeDashboard() {
  const { t } = useI18n();
  const { state, loading } = useUserStore();
  const { user, profile } = useAuthUser();
  const locale = useTmdbLocale();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!state.onboardingDone) navigate({ to: "/onboarding", replace: true });
  }, [navigate, loading, state.onboardingDone]);
  const stats = computeStats(state);

  const watching = Object.values(state.media)
    .filter(m => m.status === "watching")
    .map(entryToCard).filter((c): c is LibCard => !!c);
  const plan = Object.values(state.media)
    .filter(m => m.status === "plan_to_watch")
    .map(entryToCard).filter((c): c is LibCard => !!c);

  const trending = useQuery({
    queryKey: ["tmdb", "trending", locale],
    queryFn: () => tmdbTrending({ data: { window: "week", locale } }),
    staleTime: 1000 * 60 * 30,
  });

  const trendingItems = (trending.data?.items ?? []).filter(
    (it: { id: string }) => !isMediaAlreadyWatched(state.media[it.id]),
  );
  const suggestion = trendingItems[0];

  const greetName = profile?.display_name || user?.email?.split("@")[0] || "nerd";
  const from = useReturnPath();

  return (
    <AppShell subtitle={t("home.greeting", { name: greetName })} title={t("home.title")}
      right={
        <div className="flex items-center gap-1 rounded-full bg-hero px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-glow">
          <Flame className="h-3.5 w-3.5" /> {state.streak}
        </div>
      }>
      {/* CTA Main Quest */}
      <Link to="/dubbio" className="block">
        <div className="relative overflow-hidden rounded-3xl bg-hero p-5 shadow-glow-pink">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-black/30">
              <Sparkles className="h-7 w-7 text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest text-white/70">{NERDACOLO.name}</p>
              <p className="text-lg font-extrabold text-white">{t("home.questCta")}</p>
            </div>
          </div>
        </div>
      </Link>

      <NerdacoloTrigger />

      {/* Migrazione TV Time */}
      <Link to="/da-tvtime" className="mt-3 block">
        <div className="glass flex items-center gap-3 rounded-2xl border border-accent/30 p-3">
          <span className="text-2xl">🚚</span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-accent">{t("home.tvTimeClosing")}</p>
            <p className="truncate text-sm font-bold">{t("home.tvTimeImport")}</p>
          </div>
          <span className="text-xs font-bold text-accent">→</span>
        </div>
      </Link>

      {/* Level card */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatChip icon={<Trophy className="h-4 w-4" />} label={t("home.level")} value={String(state.level)} />
        <StatChip icon={<TrendingUp className="h-4 w-4" />} label={t("home.xp")} value={String(state.xp)} />
        <StatChip icon={<Flame className="h-4 w-4" />} label={t("home.streak")} value={t("home.streakDays", { n: state.streak })} />
      </div>

      {/* Prossimi episodi — tutte le serie in corso */}
      <HomeNextEpisodesSection media={state.media} from={from} />

      <FriendRecommendationsSection from={from} />

      {/* Suggerimento del giorno — TMDB reale */}
      {suggestion && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">{t("home.suggestion")}</h2>
          <Link to="/media/$type/$id" params={{ type: suggestion.type, id: String(suggestion.tmdb_id) }}
            state={{ from }}
            className="relative block h-56 overflow-hidden rounded-3xl bg-surface-2 shadow-glow">
            {(suggestion.backdropUrl || suggestion.posterUrl) && (
              <img src={suggestion.backdropUrl ?? suggestion.posterUrl!} alt={suggestion.title}
                className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/70">{suggestion.type === "tv" ? t("home.seriesShort") : t("home.movieShort")}{suggestion.year ? ` · ${suggestion.year}` : ""}</p>
              <h3 className="text-xl font-bold text-white">{suggestion.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-white/80">{suggestion.overview}</p>
            </div>
          </Link>
        </section>
      )}

      {/* Liste */}
      {watching.length > 0 && <LibRow title={t("home.inProgress")} items={watching} from={from} />}
      {plan.length > 0 && <LibRow title={t("home.toWatch")} items={plan} from={from} />}

      <section className="mt-6 grid grid-cols-4 gap-2 text-center">
        <MiniStat label={t("home.statsSeries")} value={stats.series} />
        <MiniStat label={t("home.statsMovies")} value={stats.movies} />
        <MiniStat label={t("home.statsEpisodes")} value={stats.episodes} />
        <MiniStat label={t("home.statsHours")} value={stats.hours} />
      </section>

    </AppShell>
  );
}

function LibRow({ title, items, from }: { title: string; items: LibCard[]; from: string }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">{title}</h2>
      <div className="-mx-4 overflow-x-auto">
        <div className="flex gap-3 px-4 pb-1">
          {items.map(c => (
            <Link key={c.id} to="/media/$type/$id" params={paramsFor(c)} state={{ from }}
              className="w-28 shrink-0">
              <div className="relative h-40 w-28 overflow-hidden rounded-2xl bg-surface-2 shadow-glow">
                {c.posterUrl
                  ? <img src={c.posterUrl} alt={c.title} className="h-full w-full object-cover" loading="lazy" />
                  : <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />}
              </div>
              <p className="mt-1 line-clamp-2 text-xs font-semibold">{c.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
      <span className="text-accent">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}
function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl px-2 py-3">
      <p className="text-lg font-extrabold text-gradient">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
