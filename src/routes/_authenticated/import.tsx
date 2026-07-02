import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { Download, Upload, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Import da TV Time — Nerdubbio" }] }),
  component: Import,
});

function Import() {
  return (
    <AppShell>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3 w-3"/> Indietro</Link>
      <h1 className="text-2xl font-extrabold">Arrivi da TV Time?</h1>
      <p className="mt-1 text-sm text-muted-foreground">Salva la tua memoria nerd prima che sparisca. Importa la cronologia e ricomincia da dove eri.</p>

      <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface/40 p-8 text-center">
        <Upload className="mx-auto h-8 w-8 text-accent"/>
        <p className="mt-3 text-sm font-semibold">Trascina qui il tuo CSV o JSON</p>
        <p className="mt-1 text-xs text-muted-foreground">TV Time · Trakt · Letterboxd</p>
        <button className="mt-4 rounded-2xl bg-hero px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow">
          Seleziona file
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-3 text-xs text-accent">
        Funzione in beta. Il mapping dei contenuti sarà attivo alla prossima release.
      </div>

      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold">
        <Download className="h-4 w-4"/> Guida import passo passo
      </button>
    </AppShell>
  );
}
