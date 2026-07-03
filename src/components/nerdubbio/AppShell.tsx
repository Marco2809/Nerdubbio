import type { ReactNode } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut, User as UserIcon, Users, Loader2, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { scheduleAllReminders } from "@/lib/reminders";
import { BottomNav } from "./BottomNav";
import { Wordmark } from "./Wordmark";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useUserStore } from "@/lib/user-store";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";

export function AppShell({ children, title, subtitle, right }: {
  children: ReactNode; title?: string; subtitle?: string; right?: ReactNode;
}) {
  const { state } = useUserStore();
  const lang: "it" | "en" = state.language === "en" ? "en" : "it";
  useEffect(() => { scheduleAllReminders(); }, []);
  return (
    <div className="min-h-screen pb-32">
      <div className="mx-auto max-w-md px-safe pt-safe">
        <div className="mb-4 flex min-h-12 items-center justify-between py-1">
          <Link
            to="/app"
            aria-label={lang === "en" ? "Nerdoubt home" : "Nerdubbio home"}
            className="inline-flex items-center rounded-lg transition-opacity hover:opacity-80 active:opacity-70 text-foreground"
          >
            <Wordmark
              lang={lang}
              withIcon
              className="h-10 sm:h-11 drop-shadow-[0_0_14px_rgba(168,85,247,0.4)]"
            />
          </Link>
          <AccountMenu />
        </div>
        {(title || subtitle || right) && (
          <header className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {subtitle && <p className="text-xs uppercase tracking-widest text-muted-foreground">{subtitle}</p>}
              {title && <h1 className="text-2xl font-bold text-foreground truncate">{title}</h1>}
            </div>
            {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
          </header>
        )}
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

function AccountMenu() {
  const { user, profile } = useAuthUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const initial = (profile?.display_name || profile?.handle || user.email || "N").charAt(0).toUpperCase();
  const avatar = profile?.avatar_url;

  async function handleSignOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    setSigningOut(false);
    setOpen(false);
    toast.success("A presto!");
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-border bg-surface/60 text-sm font-bold"
        aria-label="Account"
      >
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-border p-1 shadow-xl">
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-semibold">{profile?.display_name ?? "Nerd"}</p>
              <p className="truncate text-[11px] text-muted-foreground">@{profile?.handle ?? "..."}</p>
            </div>
            <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
              <UserIcon className="h-4 w-4" /> Profilo
            </Link>
            <Link to="/amici" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
              <Users className="h-4 w-4" /> Amici
            </Link>
            <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
              <Settings2 className="h-4 w-4" /> Impostazioni
            </Link>
            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-surface-2 disabled:opacity-50"
            >
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Esci
            </button>
          </div>
        </>
      )}
    </div>
  );
}
