import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { TmdbAttribution } from "@/components/nerdubbio/TmdbAttribution";
import { useUserStore } from "@/lib/user-store";
import { libraryApi, LIBRARY_QUERY_KEY } from "@/lib/php/library-client";
import { buildStatusPatches } from "@/lib/resolve-show-statuses";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { ArrowLeft, Globe, Shield, Trash2, Download, Sparkles, PlayCircle, Popcorn, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Impostazioni — Nerdubbio" }] }),
  component: Settings,
});

function Settings() {
  const queryClient = useQueryClient();
  const { state, update } = useUserStore();
  const [syncing, setSyncing] = useState(false);
  const filters = state.upcomingFilters ?? { newSeries: true, seasonPremieres: true, includeMovies: true };
  const setFilter = (patch: Partial<typeof filters>) =>
    update({ upcomingFilters: { ...filters, ...patch } });

  const syncShowStatuses = async () => {
    setSyncing(true);
    try {
      const patches = await buildStatusPatches(state.media);
      if (patches.length === 0) {
        toast.success("Stati serie già corretti");
        return;
      }
      const CHUNK = 40;
      let next = state;
      for (let i = 0; i < patches.length; i += CHUNK) {
        next = await libraryApi.bulkImport(patches.slice(i, i + CHUNK), undefined, { withXp: false });
        queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
      }
      const completed = patches.filter(p => p.status === "completed").length;
      toast.success(`Aggiornate ${patches.length} serie`, {
        description: completed ? `${completed} segnate come concluse` : undefined,
      });
    } catch {
      toast.error("Errore sincronizzazione stati");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AppShell>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3 w-3"/> Indietro</Link>
      <h1 className="text-2xl font-extrabold">Impostazioni</h1>

      <section className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Lingua</p>
        <div className="glass flex gap-2 rounded-2xl p-1">
          {(["it","en"] as const).map(l => (
            <button key={l} onClick={() => update({ language: l })}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${state.language === l ? "bg-hero text-primary-foreground" : "text-muted-foreground"}`}>
              {l === "it" ? "🇮🇹 Italiano" : "🇬🇧 English"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Salvato sul tuo account e sincronizzato tra dispositivi.</p>
      </section>

      <section className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">In arrivo su streaming</p>
        <div className="space-y-2">
          <Toggle
            icon={<Sparkles className="h-4 w-4"/>}
            label="Nuove serie e nuove stagioni"
            hint="Premiere assoluta o inizio di una nuova stagione"
            checked={filters.newSeries}
            onChange={v => setFilter({ newSeries: v })}
          />
          <Toggle
            icon={<PlayCircle className="h-4 w-4"/>}
            label="Solo episodio 1 di una stagione"
            hint="Ignora gli episodi a metà stagione delle serie che non segui"
            checked={filters.seasonPremieres}
            onChange={v => setFilter({ seasonPremieres: v })}
          />
          <Toggle
            icon={<Popcorn className="h-4 w-4"/>}
            label="Includi film al cinema"
            hint="Mostra la sezione 'Al cinema in Italia'"
            checked={filters.includeMovies}
            onChange={v => setFilter({ includeMovies: v })}
          />
        </div>
      </section>

      <section className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Libreria</p>
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
            <span className="block text-sm font-semibold">Correggi serie concluse</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Confronta TMDB e segna come &quot;Viste&quot; le serie finite che hai completato
            </span>
          </span>
        </button>
      </section>

      <section className="mt-6 space-y-2">
        <Row icon={<Globe className="h-4 w-4"/>} label="Profilo pubblico" hint="Attivo" />
        <Row icon={<Shield className="h-4 w-4"/>} label="Spoiler protection" hint="Sempre" />
        <Row icon={<Download className="h-4 w-4"/>} label="Esporta i miei dati" />
        <Row icon={<Trash2 className="h-4 w-4"/>} label="Cancella account" danger />
      </section>

      <section className="mt-8">
        <TmdbAttribution />
      </section>

      <p className="mt-6 text-center text-[10px] text-muted-foreground">Privacy by design. Nessun dato venduto. Mai.</p>
    </AppShell>
  );
}

function Row({ icon, label, hint, danger }: { icon: React.ReactNode; label: string; hint?: string; danger?: boolean }) {
  return (
    <button className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left">
      <span className={danger ? "text-destructive" : "text-accent"}>{icon}</span>
      <span className={`flex-1 text-sm font-semibold ${danger ? "text-destructive" : ""}`}>{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
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
