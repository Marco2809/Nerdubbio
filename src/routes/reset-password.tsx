import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Sparkles, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { auth as phpAuth } from "@/lib/php/client";
import { z } from "zod";
import { I18nProvider, normalizeLocale, useI18n, pageTitle } from "@/lib/i18n";
import { useUserStore } from "@/lib/user-store";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: pageTitle("resetPassword") }] }),
  validateSearch: searchSchema,
  component: ResetPasswordPageWrapper,
});

function ResetPasswordPageWrapper() {
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
      <ResetPasswordPage />
    </I18nProvider>
  );
}

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error(t("resetPassword.invalidLink"), { description: t("resetPassword.invalidLinkHint") });
      return;
    }
    if (password !== confirm) {
      toast.error(t("resetPassword.mismatch"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("resetPassword.minLength"));
      return;
    }
    setLoading(true);
    try {
      await phpAuth.resetPassword(token, password);
      toast.success(t("resetPassword.updated"));
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(t("common.error"), { description: err instanceof Error ? err.message : t("common.retry") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-sm flex-col px-safe pb-16 pt-safe">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-hero shadow-glow-pink">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-bold">Nerdubbio</span>
        </Link>

        <h1 className="text-3xl font-extrabold">{t("resetPassword.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("resetPassword.subtitle")}</p>

        {!token ? (
          <p className="mt-6 text-sm text-muted-foreground">
            {t("resetPassword.invalidLink")}. {t("resetPassword.invalidLinkHint")}{" "}
            <Link to="/auth" className="text-accent underline">{t("resetPassword.login")}</Link>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              placeholder={t("resetPassword.newPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder={t("resetPassword.confirmPassword")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow-pink disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("resetPassword.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
