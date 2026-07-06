import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Wordmark } from "@/components/nerdubbio/Wordmark";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { auth as phpAuth } from "@/lib/php/client";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { I18nProvider, normalizeLocale, useI18n, pageTitle, translate } from "@/lib/i18n";
import { useUserStore } from "@/lib/user-store";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: pageTitle("auth") },
      { name: "description", content: translate("it", "meta.authDesc") },
    ],
  }),
  validateSearch: searchSchema,
  component: AuthPageWrapper,
});

function AuthPageWrapper() {
  const { state } = useUserStore();
  const [locale, setLocale] = useState(() => normalizeLocale(state.language));

  useEffect(() => {
    if (state.language) {
      setLocale(normalizeLocale(state.language));
      return;
    }
    if (typeof navigator !== "undefined") {
      setLocale(normalizeLocale(navigator.language.slice(0, 2)));
    }
  }, [state.language]);

  return (
    <I18nProvider locale={locale}>
      <AuthPage />
    </I18nProvider>
  );
}

function safeRedirect(input: string | undefined): string {
  if (!input) return "/app";
  try {
    if (input.startsWith("/") && !input.startsWith("//")) return input;
    const u = new URL(input, window.location.origin);
    if (u.origin === window.location.origin) return u.pathname + u.search + u.hash;
  } catch { /* ignore */ }
  return "/app";
}

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = safeRedirect(search.redirect);

  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: redirectTo, replace: true });
    }
  }, [authLoading, user, navigate, redirectTo]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await signUp(email, password, email.split("@")[0]);
        if (error) throw new Error(error);
        toast.success(t("auth.accountCreated"), { description: t("auth.signingIn") });
      } else {
        const { error } = await signIn(email, password);
        if (error) throw new Error(error);
      }
      navigate({ to: redirectTo, replace: true });
    } catch (err: unknown) {
      toast.error(t("auth.oops"), { description: err instanceof Error ? err.message : t("auth.retry") });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    if (!email) {
      toast.error(t("auth.enterEmail"));
      return;
    }
    try {
      await phpAuth.forgotPassword(email);
      toast.success(t("auth.checkEmail"), { description: t("auth.resetSent") });
    } catch (err) {
      toast.error(t("common.error"), { description: err instanceof Error ? err.message : t("auth.retry") });
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-sm flex-col px-safe pb-16 pt-safe">
        <Link to="/" className="mb-6 flex items-center justify-center text-foreground">
          <Wordmark withIcon className="h-12 drop-shadow-[0_0_24px_rgba(168,85,247,0.4)]" />
        </Link>

        <h1 className="text-3xl font-extrabold">
          {mode === "login" ? t("auth.titleLogin") : t("auth.titleSignup")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login" ? t("auth.subtitleLogin") : t("auth.subtitleSignup")}
        </p>

        <div className="mt-6">
          <GoogleSignInButton onSuccess={() => navigate({ to: redirectTo, replace: true })} />
        </div>

        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> {t("auth.or")} <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            placeholder={t("auth.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder={t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow-pink disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? t("auth.signIn") : t("auth.signUp")}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-muted-foreground hover:text-foreground">
            {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}
          </button>
          {mode === "login" && (
            <button onClick={handleForgot} className="text-accent">{t("auth.forgotPassword")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
