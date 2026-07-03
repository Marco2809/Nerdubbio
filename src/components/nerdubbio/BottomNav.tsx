import { Link, useLocation } from "@tanstack/react-router";
import { NERDACOLO } from "@/lib/brand";
import { Home, Search, Sparkles, CalendarDays, User } from "lucide-react";

type NavItem = { to: string; label: string; icon: typeof Home; primary?: boolean };
const items: NavItem[] = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/search", label: "Cerca", icon: Search },
  { to: "/dubbio", label: NERDACOLO.short, icon: Sparkles, primary: true },
  { to: "/prossimi", label: "In arrivo", icon: CalendarDays },
  { to: "/profile", label: "Profilo", icon: User },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe">
      <div className="mx-auto max-w-md px-safe pb-3">
        <div className="glass rounded-3xl shadow-glow flex items-end justify-between px-2 py-2">
          {items.map(it => {
            const Icon = it.icon;
            const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
            if (it.primary) {
              return (
                <Link key={it.to} to={it.to as never} className="-mt-8 flex flex-col items-center gap-1">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-hero shadow-glow-pink text-primary-foreground">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/80">{it.label}</span>
                </Link>
              );
            }
            return (
              <Link key={it.to} to={it.to as never}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${active ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
