import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { TmdbAttribution } from "@/components/nerdubbio/TmdbAttribution";
import { useUserStore } from "@/lib/user-store";
import { libraryApi, LIBRARY_QUERY_KEY } from "@/lib/php/library-client";
import { buildStatusPatches } from "@/lib/resolve-show-statuses";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { LOCALES, LOCALE_NAMES, useI18n, pageTitle, type Locale } from "@/lib/i18n";
import { FlagIcon } from "@/components/nerdubbio/FlagIcon";
import { TvTimeReimportCard } from "@/components/nerdubbio/TvTimeReimportCard";
import { pushSupported, getPushSubscription, enablePush, disablePush, sendTestPush } from "@/lib/push-client";
import { ArrowLeft, Globe, Trash2, Download, Sparkles, PlayCircle, Popcorn, CheckCircle2, Loader2, BellRing } from "lucide-react";
import { auth as phpAuth } from "@/lib/php/client";
import { PLATFORMS } from "@/lib/platforms";
import { useAuth } from "@/lib/auth";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: pageTitle("settings") }] }),
  component: Settings,
});

function Settings() {
  const queryClient = useQueryClient();
  const { state, update } = useUserStore();
  const { t } = useI18n();
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await phpAuth.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nerdubbio-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settings.exportDone"));
    } catch {
      toast.error(t("settings.exportError"));
    } finally {
      setExporting(false);
    }
  };
  const filters = state.upcomingFilters ?? { newSeries: true, seasonPremieres: true, includeMovies: true };
  const setFilter = (patch: Partial<typeof filters>) =>
    update({ upcomingFilters: { ...filters, ...patch } });

  // Notifiche push: lo stato reale sta nella subscription del browser.
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    void getPushSubscription().then((sub) => setPushOn(!!sub));
  }, []);

  const togglePush = async (on: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (on) {
        const ok = await enablePush();
        setPushOn(ok);
        if (ok) toast.success(t("settings.pushEnabled"));
        else toast.error(t("settings.pushDenied"));
      } else {
        await disablePush();
        setPushOn(false);
      }
    } catch {
      toast.error(t("settings.pushError"));
    } finally {
      setPushBusy(false);
    }
  };

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
                className={`grid h-11 w-11 place-items-center rounded-xl transition ${
                  active
                    ? "bg-hero shadow-glow-pink ring-2 ring-accent"
                    : "bg-surface-2 opacity-70 hover:opacity-100"
                }`}
              >
                <FlagIcon locale={l} className="h-5 w-[1.875rem]" />
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{t("settings.languageHint")}</p>
      </section>

      <section className="mt-6">
        <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{t("settings.platformsSection")}</p>
        <p className="mb-2 text-[11px] text-muted-foreground">{t("settings.platformsHint")}</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => {
            const mine = state.platforms ?? [];
            const on = mine.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => update({ platforms: on ? mine.filter(x => x !== p) : [...mine, p] })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  on ? "bg-hero text-primary-foreground shadow-glow" : "glass text-foreground/80"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
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

      {pushSupported() && (
        <section className="mt-6 space-y-2">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("settings.notificationsSection")}</p>
          <Toggle
            icon={pushBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            label={t("settings.pushLabel")}
            hint={t("settings.pushHint")}
            checked={pushOn}
            onChange={(v) => void togglePush(v)}
          />
          {pushOn && (
            <button
              type="button"
              onClick={() =>
                void sendTestPush()
                  .then((n) => (n > 0 ? toast.success(t("settings.pushTestSent")) : toast.error(t("settings.pushError"))))
                  .catch(() => toast.error(t("settings.pushError")))
              }
              className="glass w-full rounded-2xl p-3 text-left text-sm font-semibold text-accent"
            >
              {t("settings.pushTest")}
            </button>
          )}
        </section>
      )}

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
        <Link to="/profile" className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left">
          <span className="text-accent"><Globe className="h-4 w-4" /></span>
          <span className="flex-1 text-sm font-semibold">{t("settings.account")}</span>
        </Link>
        <Row
          icon={exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          label={t("settings.exportData")}
          onClick={() => void exportData()}
          disabled={exporting}
        />
        <DeleteAccountRow />
      </section>

      <section className="mt-8">
        <p className="text-center text-[11px] text-muted-foreground">{t("settings.about")}</p>
      </section>

      <section className="mt-4">
        <TmdbAttribution />
      </section>
    </AppShell>
  );
}

function DeleteAccountRow() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const word = t("settings.deleteWord");
  const ok = typed.trim().toUpperCase() === word.toUpperCase();

  const confirmDelete = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await phpAuth.deleteAccount();
      toast.success(t("settings.deleteDone"));
      await signOut();
      window.location.assign("/");
    } catch {
      toast.error(t("settings.deleteError"));
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTyped(""); }}>
      <AlertDialogTrigger asChild>
        <button type="button" className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left">
          <span className="text-destructive"><Trash2 className="h-4 w-4" /></span>
          <span className="flex-1 text-sm font-semibold text-destructive">{t("settings.deleteAccount")}</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("settings.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("settings.deleteBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="block text-xs text-muted-foreground">
          {t("settings.deleteTypeHint", { word })}
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ok || busy}
            onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("settings.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Row({ icon, label, hint, danger, onClick, disabled }: { icon: React.ReactNode; label: string; hint?: string; danger?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-60">
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
