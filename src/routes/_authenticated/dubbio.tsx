import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { QUIZ } from "@/lib/recommendation/questions";
import type { DoubtMode } from "@/lib/recommendation/engine";
import { Sparkles, Film, Tv, Shuffle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dubbio")({
  head: () => ({ meta: [{ title: "Il Dubbio — Nerdubbio" }] }),
  component: DubbioQuiz,
});

const MODES: { key: DoubtMode; label: string; sub: string; icon: React.ReactNode }[] = [
  { key: "tv", label: "Voglio una serie", sub: "impegno emotivo garantito", icon: <Tv className="h-5 w-5" /> },
  { key: "movie", label: "Voglio un film", sub: "una serata sola, promesso", icon: <Film className="h-5 w-5" /> },
  { key: "surprise", label: "Sorprendimi", sub: "Il Genio decide tutto lui", icon: <Shuffle className="h-5 w-5" /> },
];

function DubbioQuiz() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<DoubtMode | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  if (!mode) {
    return (
      <AppShell subtitle="Il Genio del Dubbio" title="Cosa cerchi stasera?">
        <p className="mb-4 text-sm text-muted-foreground">
          Il Genio sta consultando il multiverso dello streaming. Prima però: cosa vuoi guardare?
        </p>
        <div className="space-y-3">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className="glass flex w-full items-center gap-4 rounded-3xl p-4 text-left transition hover:shadow-glow">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-hero text-primary-foreground shadow-glow-pink">
                {m.icon}
              </span>
              <div className="flex-1">
                <p className="font-bold">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </AppShell>
    );
  }

  const q = QUIZ[step];
  const progress = ((step) / QUIZ.length) * 100;

  const answer = (idx: number) => {
    const next = { ...answers, [q.id]: idx };
    setAnswers(next);
    if (step + 1 < QUIZ.length) {
      setStep(step + 1);
    } else {
      const payload = encodeURIComponent(JSON.stringify({ mode, answers: next }));
      navigate({ to: "/dubbio/risultato", search: { d: payload } as never });
    }
  };

  return (
    <AppShell subtitle={`Domanda ${step+1} / ${QUIZ.length}`} title="Il Genio interroga…">
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-hero transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="glass rounded-3xl p-5 shadow-glow">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-hero text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="text-lg font-bold leading-snug">{q.question}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {q.choices.map((c, i) => (
          <button key={i} onClick={() => answer(i)}
            className="w-full rounded-2xl border border-border bg-surface/60 p-4 text-left transition hover:border-accent hover:bg-accent/10">
            <p className="text-sm font-semibold">{c.label}</p>
          </button>
        ))}
      </div>

      {step > 0 && (
        <button onClick={() => setStep(step - 1)} className="mt-4 w-full text-center text-xs text-muted-foreground">
          ← indietro
        </button>
      )}
    </AppShell>
  );
}
