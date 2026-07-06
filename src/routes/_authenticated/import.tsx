import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { Download, Upload, ArrowLeft } from "lucide-react";
import { useI18n, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: pageTitle("import") }] }),
  component: Import,
});

function Import() {
  const { t } = useI18n();

  return (
    <AppShell>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> {t("common.back")}
      </Link>
      <h1 className="text-2xl font-extrabold">{t("importPage.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("importPage.subtitle")}</p>

      <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface/40 p-8 text-center">
        <Upload className="mx-auto h-8 w-8 text-accent" />
        <p className="mt-3 text-sm font-semibold">{t("importPage.dropHint")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("importPage.sources")}</p>
        <button className="mt-4 rounded-2xl bg-hero px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow">
          {t("importPage.selectFile")}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-3 text-xs text-accent">
        {t("importPage.betaNotice")}
      </div>

      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold">
        <Download className="h-4 w-4" /> {t("importPage.guideBtn")}
      </button>
    </AppShell>
  );
}
