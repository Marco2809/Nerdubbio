import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { recommendationEngine, type DoubtMode, type QuizAnswers } from "@/lib/recommendation/engine";
import { useUserStore } from "@/lib/user-store";
import { Sparkles, Plus, Check, RotateCcw, Share2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ d: z.string().optional() });

export const Route = createFileRoute("/_authenticated/dubbio/risultato")({
  head: () => ({ meta: [{ title: "Risultato del Dubbio — Nerdubbio" }] }),
  validateSearch: searchSchema,
  component: ResultPage,
});

function ResultPage() {
  const { d } = Route.useSearch();
  const { state, addToList, dismiss } = useUserStore();

  const parsed = useMemo(() => {
    if (!d) return null;
    try {
      const raw = JSON.parse(decodeURIComponent(d)) as { mode: DoubtMode; answers: QuizAnswers };
      return raw;
    } catch { return null; }
  }, [d]);

  if (!parsed) {
    return (
      <AppShell title="Nessun dubbio">
        <p className="text-sm text-muted-foreground">Il Genio ha bisogno di risposte. <Link to="/dubbio" className="text-accent underline">Rifai il quiz</Link>.</p>
      </AppShell>
    );
  }

  const result = recommendationEngine(parsed.answers, parsed.mode, {
    seenIds: Object.entries(state.media).filter(([,m])=>m.status==="completed"||m.status==="dropped").map(([k])=>k),
    dismissedIds: state.dismissed,
  });

  const p = result.primary;

  return (
    <AppShell subtitle="Il Genio ha deciso" title="Ecco cosa guardi stasera">
      <div className="relative overflow-hidden rounded-3xl shadow-glow-pink">
        <div className="h-56" style={{ background: p.item.poster }} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-hero px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Match {p.score}%</span>
            <span className="text-[10px] uppercase tracking-widest text-white/70">{p.item.type === "tv" ? "Serie" : "Film"} · {p.item.year}</span>
          </div>
          <h2 className="mt-1 text-2xl font-extrabold text-white">{p.item.title}</h2>
        </div>
      </div>

      <div className="glass mt-4 rounded-3xl p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-accent" />
          <p className="text-sm leading-relaxed">{result.explanation}</p>
        </div>
        {p.reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {p.reasons.map((r,i) => <span key={i} className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{r}</span>)}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            addToList(p.item.id, "plan_to_watch");
            toast.success(`"${p.item.title}" aggiunto alla watchlist`);
          }}
          className="rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow">
          <Plus className="mr-1 inline h-4 w-4" /> In watchlist
        </button>
        <button
          onClick={() => {
            addToList(p.item.id, "completed");
            toast.success(`"${p.item.title}" segnato come visto`);
          }}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold">
          <Check className="mr-1 inline h-4 w-4" /> L'ho già visto
        </button>
        <button
          onClick={() => {
            dismiss(p.item.id);
            toast(`"${p.item.title}" ignorato dai suggerimenti`);
          }}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold">
          Non fa per me
        </button>
        <Link to="/dubbio" className="rounded-2xl border border-border bg-surface/60 py-3 text-center text-sm font-semibold">
          <RotateCcw className="mr-1 inline h-4 w-4" /> Ritenta
        </Link>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">Alternative</h3>
        <div className="space-y-2">
          {result.alternatives.map(alt => (
            <Link key={alt.item.id} to="/media/$type/$id" params={{ type: alt.item.type, id: alt.item.id }}
              className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="h-16 w-12 shrink-0 rounded-xl" style={{ background: alt.item.poster }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{alt.item.title}</p>
                <p className="text-xs text-muted-foreground">{alt.item.year} · Match {alt.score}%</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 py-3 text-sm font-semibold text-accent">
        <Share2 className="h-4 w-4" /> Condividi il mio consiglio Nerdubbio
      </button>
    </AppShell>
  );
}
