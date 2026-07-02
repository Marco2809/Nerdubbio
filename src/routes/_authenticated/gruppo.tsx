import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { Users, Plus, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { CATALOG } from "@/lib/mock-catalog";

export const Route = createFileRoute("/_authenticated/gruppo")({
  head: () => ({ meta: [{ title: "Dubbio di gruppo — Nerdubbio" }] }),
  component: Gruppo,
});

function Gruppo() {
  const [computed, setComputed] = useState(false);
  const pick = CATALOG.find(c => c.id === "glass-onion")!;

  return (
    <AppShell>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3 w-3"/> Indietro</Link>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-hero text-primary-foreground shadow-glow-pink"><Users className="h-6 w-6"/></span>
        <div>
          <h1 className="text-2xl font-extrabold">Dubbio di gruppo</h1>
          <p className="text-xs text-muted-foreground">Preferenze combinate. Zero litigi. Forse.</p>
        </div>
      </div>

      <section className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Chi guarda?</p>
        <div className="flex gap-2">
          {["Tu","Partner"].map(n => (
            <div key={n} className="glass flex-1 rounded-2xl p-3 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-hero text-sm font-bold text-primary-foreground">{n[0]}</div>
              <p className="mt-1 text-xs font-semibold">{n}</p>
            </div>
          ))}
          <button className="glass grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            <Plus className="mx-auto h-4 w-4"/> Aggiungi
          </button>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <Pref label="Tempo disponibile" value="~2 ore" />
        <Pref label="Generi vietati" value="Horror" />
        <Pref label="Mood combinato" value="funny + mystery" />
      </section>

      {!computed ? (
        <button onClick={() => setComputed(true)}
          className="mt-6 w-full rounded-2xl bg-hero py-4 text-base font-bold text-primary-foreground shadow-glow-pink">
          Trova il consenso
        </button>
      ) : (
        <div className="mt-6 rounded-3xl bg-hero p-5 text-primary-foreground shadow-glow-pink">
          <p className="text-xs uppercase tracking-widest opacity-80">Compatibilità di gruppo 87%</p>
          <h3 className="mt-1 text-2xl font-extrabold">{pick.title}</h3>
          <p className="mt-1 text-xs opacity-90">Detective, risate, poche vittime. Vi mette d'accordo.</p>
        </div>
      )}
    </AppShell>
  );
}
function Pref({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass flex items-center justify-between rounded-2xl p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
