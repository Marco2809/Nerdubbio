import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { Crown, Check, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({ meta: [{ title: "Premium — Nerdubbio" }] }),
  component: Premium,
});

const FEATURE_KEYS = ["f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"] as const;

function Premium() {
  const { t } = useI18n();

  return (
    <AppShell>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> {t("premium.back")}
      </Link>
      <div className="relative overflow-hidden rounded-3xl bg-hero p-6 text-primary-foreground shadow-glow-pink">
        <Crown className="h-8 w-8" />
        <h1 className="mt-3 text-3xl font-extrabold">{t("premium.title")}</h1>
        <p className="mt-2 text-sm opacity-90">{t("premium.subtitle")}</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-black">4,99€</span>
          <span className="opacity-80">{t("premium.perMonth")}</span>
        </div>
      </div>

      <ul className="mt-6 space-y-2">
        {FEATURE_KEYS.map((key) => (
          <li key={key} className="glass flex items-center gap-3 rounded-2xl p-3">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-foreground">
              <Check className="h-3 w-3" />
            </span>
            <span className="text-sm">{t(`premium.${key}`)}</span>
          </li>
        ))}
      </ul>

      <button className="mt-6 w-full rounded-2xl bg-hero py-4 text-base font-bold text-primary-foreground shadow-glow-pink">
        {t("premium.cta")}
      </button>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">{t("premium.preview")}</p>
    </AppShell>
  );
}
