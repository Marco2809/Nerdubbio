import { Link, useLocation } from "@tanstack/react-router";
import { NERDACOLO } from "@/lib/brand";
import { useFriendRequestCount } from "@/hooks/use-friend-requests-count";
import { useI18n } from "@/lib/i18n";
import { Home, Search, Sparkles, CalendarDays, User } from "lucide-react";

function NavBadge({ count }: { count: number }) {
  const { t } = useI18n();
  if (count <= 0) return null;
  return (
    <span
      className="absolute -right-2 -top-1.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full border border-background bg-destructive px-1 text-[9px] font-bold leading-none text-white shadow-sm"
      aria-label={t("nav.friendRequests", { count })}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  const friendRequests = useFriendRequestCount();
  const { t } = useI18n();

  const items = [
    { to: "/app", label: t("nav.home"), icon: Home },
    { to: "/search", label: t("nav.search"), icon: Search },
    { to: "/dubbio", label: NERDACOLO.short, icon: Sparkles, primary: true },
    { to: "/prossimi", label: t("nav.upcoming"), icon: CalendarDays },
    { to: "/profile", label: t("nav.profile"), icon: User, badge: true },
  ] as const;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe">
      <div className="mx-auto max-w-md px-safe pb-3">
        <div className="glass rounded-3xl shadow-glow flex items-end justify-between px-2 py-2">
          {items.map(it => {
            const Icon = it.icon;
            const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
            const badgeCount = "badge" in it && it.badge ? friendRequests : 0;
            if ("primary" in it && it.primary) {
              return (
                <Link key={it.to} to={it.to as never} className="-mt-8 flex flex-col items-center gap-1">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-hero shadow-glow-pink text-primary-foreground">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">{it.label}</span>
                </Link>
              );
            }
            return (
              <Link key={it.to} to={it.to as never}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${active ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  <NavBadge count={badgeCount} />
                </span>
                <span className="text-[11px] font-medium">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
