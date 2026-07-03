import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { Crown, Check, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({ meta: [{ title: "Premium — Nerdubbio" }] }),
  component: Premium,
});

const FEATURES = [
  "Quest illimitate ogni giorno",
  "Statistiche avanzate e insight AI",
  "Import da TV Time / Trakt / Letterboxd",
  "Liste illimitate e backup dati",
  "Consigli AI di ultima generazione",
  "Temi visuali premium",
  "Profilo pubblico personalizzato",
  "Confronto gusti con amici",
  "Modalità coppia/gruppo avanzata",
];

function Premium() {
  return (
    <AppShell>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3 w-3"/> Indietro</Link>
      <div className="relative overflow-hidden rounded-3xl bg-hero p-6 text-primary-foreground shadow-glow-pink">
        <Crown className="h-8 w-8" />
        <h1 className="mt-3 text-3xl font-extrabold">Nerdubbio Premium</h1>
        <p className="mt-2 text-sm opacity-90">Sblocca Nerdacolo senza limiti. Zero pubblicità, tutta magia.</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-black">4,99€</span>
          <span className="opacity-80">/mese</span>
        </div>
      </div>

      <ul className="mt-6 space-y-2">
        {FEATURES.map(f => (
          <li key={f} className="glass flex items-center gap-3 rounded-2xl p-3">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-3 w-3"/></span>
            <span className="text-sm">{f}</span>
          </li>
        ))}
      </ul>

      <button className="mt-6 w-full rounded-2xl bg-hero py-4 text-base font-bold text-primary-foreground shadow-glow-pink">
        Diventa Premium
      </button>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">Anteprima. Pagamenti in arrivo.</p>
    </AppShell>
  );
}
