import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { useUserStore, computeStats } from "@/lib/user-store";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useFriendRequestCount } from "@/hooks/use-friend-requests-count";
import { Trophy, Flame, Star, Settings2, Crown, Users, Download, ExternalLink, BarChart3, Tv, Clapperboard, Bookmark } from "lucide-react";
import { countAllMovies, countAllSeries } from "@/lib/library-display";
import { useI18n, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: pageTitle("profile") }] }),
  component: Profile,
});

const BADGE_KEYS = [
  { code: "primo-dubbio", titleKey: "profile.badgeFirstQuest", icon: "🎲" },
  { code: "serial-watcher", titleKey: "profile.badgeSerialWatcher", icon: "📺" },
  { code: "binge-warrior", titleKey: "profile.badgeBingeWarrior", icon: "⚔️" },
  { code: "plot-twist", titleKey: "profile.badgePlotTwist", icon: "🌀" },
  { code: "sci-fi", titleKey: "profile.badgeSciFi", icon: "🛸" },
  { code: "comfort", titleKey: "profile.badgeComfort", icon: "💥" },
] as const;

function Profile() {
  const { t } = useI18n();
  const { state } = useUserStore();
  const { user, profile } = useAuthUser();
  const friendRequests = useFriendRequestCount();
  const stats = computeStats(state);
  const seriesCount = countAllSeries(state.media);
  const moviesCount = countAllMovies(state.media);
  const xpToNext = 400;
  const name = profile?.display_name || user?.email?.split("@")[0] || "Nerd";
  const handle = profile?.handle ?? "nerd";
  const initial = name.charAt(0).toUpperCase();

  return (
    <AppShell subtitle={t("profile.subtitle")} title={t("profile.title")}
      right={<Link to="/settings" className="grid h-9 w-9 place-items-center rounded-full glass"><Settings2 className="h-4 w-4"/></Link>}>
      <div className="glass rounded-3xl p-5">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-hero/30" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-hero text-2xl font-black text-primary-foreground shadow-glow-pink">{initial}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold truncate">{name}</p>
            <p className="text-xs text-muted-foreground">@{handle} · {t("profile.levelXp", { level: state.level, xp: state.xp })}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-hero" style={{ width: `${(state.xp % xpToNext) / xpToNext * 100}%` }} />
            </div>
          </div>
        </div>
        <Link
          to="/u/$handle"
          params={{ handle }}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" /> {t("profile.publicProfile")}
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Stat icon={<Star className="h-4 w-4"/>} label={t("profile.watched")} value={stats.watched} />
        <Stat icon={<Flame className="h-4 w-4"/>} label={t("profile.streak")} value={state.streak} />
        <Stat icon={<Trophy className="h-4 w-4"/>} label={t("profile.badges")} value={state.achievements.length} />
        <Stat icon={<Star className="h-4 w-4"/>} label={t("profile.hours")} value={stats.hours} />
      </div>

      <section className="mt-4">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("profile.library")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/profilo/serie"
            search={{ tab: "in_corso" }}
            className="glass flex flex-col gap-2 rounded-2xl p-4 transition hover:border-accent/40"
          >
            <div className="flex items-center justify-between">
              <Tv className="h-5 w-5 text-accent" />
              <span className="text-lg font-extrabold text-gradient">{seriesCount}</span>
            </div>
            <div>
              <p className="text-sm font-bold">{t("profile.series")}</p>
              <p className="text-[11px] text-muted-foreground">{t("profile.seriesHint")}</p>
            </div>
          </Link>
          <Link
            to="/profilo/film"
            search={{ tab: "da_vedere" }}
            className="glass flex flex-col gap-2 rounded-2xl p-4 transition hover:border-accent/40"
          >
            <div className="flex items-center justify-between">
              <Clapperboard className="h-5 w-5 text-accent" />
              <span className="text-lg font-extrabold text-gradient">{moviesCount}</span>
            </div>
            <div>
              <p className="text-sm font-bold">{t("profile.movies")}</p>
              <p className="text-[11px] text-muted-foreground">{t("profile.moviesHint")}</p>
            </div>
          </Link>
        </div>
        <Link to="/watchlist" className="mt-2 glass flex items-center gap-3 rounded-2xl p-4 transition hover:border-accent/40">
          <Bookmark className="h-5 w-5 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{t("profile.watchlist")}</p>
            <p className="text-[11px] text-muted-foreground">{t("profile.watchlistHint")}</p>
          </div>
          <span className="text-xs font-bold text-accent">→</span>
        </Link>
      </section>

      <Link to="/statistiche" className="mt-3 glass flex items-center gap-3 rounded-2xl p-4">
        <BarChart3 className="h-5 w-5 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t("profile.bingeStats")}</p>
          <p className="text-[11px] text-muted-foreground">{t("profile.bingeStatsHint")}</p>
        </div>
        <span className="text-xs font-bold text-accent">→</span>
      </Link>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">{t("profile.achievements")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {BADGE_KEYS.map(b => {
            const unlocked = state.achievements.includes(b.code);
            return (
              <div key={b.code} className={`glass rounded-2xl p-3 text-center ${unlocked ? "shadow-glow" : "opacity-40"}`}>
                <div className="text-2xl">{b.icon}</div>
                <p className="mt-1 text-[10px] font-semibold leading-tight">{t(b.titleKey)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <Link to="/amici" className="glass flex items-center gap-3 rounded-2xl p-4">
          <Users className="h-5 w-5 text-accent" />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {t("profile.friends")}
              {friendRequests > 0 && (
                <span className="ml-2 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                  {friendRequests > 9 ? "9+" : friendRequests}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {friendRequests > 0
                ? friendRequests === 1
                  ? t("profile.friendRequestOne")
                  : t("profile.friendRequests", { count: friendRequests })
                : t("profile.friendsHint")}
            </p>
          </div>
        </Link>
        <Link to="/premium" className="glass flex items-center gap-3 rounded-2xl p-4">
          <Crown className="h-5 w-5 text-accent" />
          <div className="flex-1"><p className="text-sm font-semibold">{t("profile.premium")}</p><p className="text-xs text-muted-foreground">{t("profile.premiumHint")}</p></div>
        </Link>
        <Link to="/gruppo" className="glass flex items-center gap-3 rounded-2xl p-4">
          <Users className="h-5 w-5 text-accent" />
          <div className="flex-1"><p className="text-sm font-semibold">{t("profile.groupQuest")}</p><p className="text-xs text-muted-foreground">{t("profile.groupQuestHint")}</p></div>
        </Link>
        <Link to="/da-tvtime" className="glass flex items-center gap-3 rounded-2xl p-4">
          <Download className="h-5 w-5 text-accent" />
          <div className="flex-1"><p className="text-sm font-semibold">{t("profile.tvTime")}</p><p className="text-xs text-muted-foreground">{t("profile.tvTimeHint")}</p></div>
        </Link>
      </section>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass rounded-2xl px-1 py-3">
      <div className="flex justify-center text-accent">{icon}</div>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
