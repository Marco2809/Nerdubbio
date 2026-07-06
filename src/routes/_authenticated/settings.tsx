import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { TmdbAttribution } from "@/components/nerdubbio/TmdbAttribution";
import { useUserStore } from "@/lib/user-store";
import { libraryApi, LIBRARY_QUERY_KEY } from "@/lib/php/library-client";
import { buildStatusPatches } from "@/lib/resolve-show-statuses";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { LOCALES, LOCALE_FLAGS, LOCALE_NAMES, useI18n, pageTitle, type Locale } from "@/lib/i18n";
import { TvTimeReimportCard } from "@/components/nerdubbio/TvTimeReimportCard";
import { ArrowLeft, Globe, Shield, Trash2, Download, Sparkles, PlayCircle, Popcorn, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: pageTitle("settings") }] }),
  component: Settings,
});

function Settings() {
  const queryClient = useQueryClient();
  const { state, update } = useUserStore();
  const { t } = useI18n();
  const [syncing, setSyncing] = useState(false);
  const filters = state.upcomingFilters ?? { newSeries: true, seasonPremieres: true, includeMovies: true };
  const setFilter = (patch: Partial<typeof filters>) =>
    update({ upcomingFilters: { ...filters, ...patch } });

  const syncShowStatuses = async () => {
    setSyncing(true);
    try {
      const patches = await buildStatusPatches(state.media);
      if (patches.length === 0) {
        toast.success(t("settings.syncDone"));
        return;
      }
      const CHUNK = 40;
      let next = state;
      for (let i = 0; i < patches.length; i += CHUNK) {
        next = await libraryApi.bulkImport(patches.slice(i, i + CHUNK), undefined, { withXp: false });
        queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
      }
      const completed = patches.filter(p => p.status === "completed").length;
      toast.success(t("settings.syncUpdated", { count: patches.length }), {
        description: completed ? t("settings.syncCompleted", { count: completed }) : undefined,
      });
    } catch {
      toast.error(t("settings.syncError"));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AppShell>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3"/> {t("common.back")}
      </Link>
      <h1 className="text-2xl font-extrabold">{t("settings.title")}</h1>

      <section className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("settings.language")}</p>
        <div className="glass flex flex-wrap gap-2 rounded-2xl p-2">
          {LOCALES.map(l => {
            const active = state.language === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => update({ language: l as Locale })}
                aria-label={LOCALE_NAMES[l]}
                aria-pressed={active}
                title={LOCALE_NAMES[l]}
                className={`grid h-11 w-11 place-items-center rounded-xl text-2xl transition ${
                  active
                    ? "bg-hero shadow-glow-pink ring-2 ring-accent"
                    : "bg-surface-2 opacity-70 hover:opacity-100"
                }`}
              >
                <span aria-hidden>{LOCALE_FLAGS[l]}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{t("settings.languageHint")}</p>
      </section>

      <section className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("settings.streamingSection")}</p>
        <div className="space-y-2">
          <Toggle
            icon={<Sparkles className="h-4 w-4"/>}
            label={t("settings.newSeries")}
            hint={t("settings.newSeriesHint")}
            checked={filters.newSeries}
            onChange={v => setFilter({ newSeries: v })}
          />
          <Toggle
            icon={<PlayCircle className="h-4 w-4"/>}
            label={t("settings.seasonPremieres")}
            hint={t("settings.seasonPremieresHint")}
            checked={filters.seasonPremieres}
            onChange={v => setFilter({ seasonPremieres: v })}
          />
          <Toggle
            icon={<Popcorn className="h-4 w-4"/>}
            label={t("settings.includeMovies")}
            hint={t("settings.includeMoviesHint")}
            checked={filters.includeMovies}
            onChange={v => setFilter({ includeMovies: v })}
          />
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("settings.librarySection")}</p>
        <button
          type="button"
          disabled={syncing}
          onClick={syncShowStatuses}
          className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-60"
        >
          <span className="text-accent">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t("settings.fixCompletedTitle")}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{t("settings.fixCompletedHint")}</span>
          </span>
        </button>
        <TvTimeReimportCard />
      </section>

      <section className="mt-6 space-y-2">
        <Row icon={<Globe className="h-4 w-4"/>} label={t("settings.account")} hint="—" />
        <Row icon={<Shield className="h-4 w-4"/>} label={t("settings.privacy")} hint="—" />
        <Row icon={<Download className="h-4 w-4"/>} label={t("settings.exportData")} />
        <Row icon={<Trash2 className="h-4 w-4"/>} label={t("settings.deleteAccount")} danger />
      </section>

      <section className="mt-8">
        <TmdbAttribution />
      </section>
    </AppShell>
  );
}

function Row({ icon, label, hint, danger }: { icon: React.ReactNode; label: string; hint?: string; danger?: boolean }) {
  return (
    <button type="button" className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left">
      <span className={danger ? "text-destructive" : "text-accent"}>{icon}</span>
      <span className={`flex-1 text-sm font-semibold ${danger ? "text-destructive" : ""}`}>{label}</span>
      {hint && hint !== "—" && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}

function Toggle({
  icon, label, hint, checked, onChange,
}: {
  icon: React.ReactNode; label: string; hint?: string;
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left"
    >
      <span className={checked ? "text-accent" : "text-muted-foreground"}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-hero" : "bg-surface-2"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
