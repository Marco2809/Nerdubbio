import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { NerdacoloTrigger } from "@/components/nerdubbio/NerdacoloTrigger";
import type { CatalogItem } from "@/lib/mock-catalog";
import { CATALOG } from "@/lib/mock-catalog";
import type { DoubtMode } from "@/lib/recommendation/engine";
import {
  buildDubbioProfile,
  fetchDubbioPool,
} from "@/lib/recommendation/dubbio-pool";
import {
  pickNextQuestion,
  randomNerdacoloIntro,
  sessionLength,
} from "@/lib/recommendation/dynamic-quiz";
import type { QuizQuestion } from "@/lib/recommendation/questions";
import { useUserStore } from "@/lib/user-store";
import { NERDACOLO, QUEST } from "@/lib/brand";
import { Film, Loader2, Tv, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dubbio")({
  head: () => ({ meta: [{ title: `${QUEST.name} — Nerdubbio` }] }),
  component: DubbioQuiz,
});

const MODES: { key: DoubtMode; label: string; sub: string; icon: React.ReactNode }[] = [
  { key: "tv", label: "Voglio una serie", sub: "impegno emotivo garantito", icon: <Tv className="h-5 w-5" /> },
  { key: "movie", label: "Voglio un film", sub: "una serata sola, promesso", icon: <Film className="h-5 w-5" /> },
  { key: "surprise", label: "Sorprendimi", sub: `${NERDACOLO.short} decide tutto`, icon: <Shuffle className="h-5 w-5" /> },
];

function DubbioQuiz() {
  const navigate = useNavigate();
  const { state } = useUserStore();
  const profile = useMemo(() => buildDubbioProfile(state), [state]);

  const [mode, setMode] = useState<DoubtMode | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<QuizQuestion[]>([]);
  const [pool, setPool] = useState<CatalogItem[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const intro = useMemo(() => randomNerdacoloIntro(), [mode]);

  const total = sessionLength();
  const step = history.length;
  const q = mode && pool.length ? pickNextQuestion(mode, answers, step, pool, profile) : null;

  const goToResult = (nextAnswers: Record<string, number>) => {
    const payload = encodeURIComponent(JSON.stringify({ mode, answers: nextAnswers }));
    navigate({ to: "/dubbio/risultato", search: { d: payload } as never });
  };

  const selectMode = async (m: DoubtMode) => {
    setMode(m);
    setAnswers({});
    setHistory([]);
    setLoadingPool(true);
    try {
      const items = await fetchDubbioPool(m, profile);
      setPool(items);
      if (items.length === 0) throw new Error("empty");
      toast.success(`${NERDACOLO.short}: ${items.length} titoli da TMDB e watchlist`);
    } catch {
      setPool(CATALOG);
      toast.error("TMDB non disponibile — catalogo locale di backup");
    } finally {
      setLoadingPool(false);
    }
  };

  if (!mode) {
    return (
      <AppShell subtitle={NERDACOLO.title} title="Cosa cerchi stasera?">
        <div className="mb-4 flex items-center gap-3">
          <NerdacoloTrigger compact />
          <p className="text-xs text-muted-foreground">
            Tap su {NERDACOLO.name} per un <span className="text-fuchsia-300">tiro d20</span> veloce — senza quiz.
          </p>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {NERDACOLO.name} interroga TMDB e la tua libreria importata. Scegli il format:
        </p>
        <div className="space-y-3">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => void selectMode(m.key)}
              className="glass flex w-full items-center gap-4 rounded-3xl p-4 text-left transition hover:shadow-glow"
            >
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

  if (loadingPool || !pool.length) {
    return (
      <AppShell title={`${NERDACOLO.name} scansiona TMDB…`}>
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm">Carico titoli reali + la tua watchlist…</p>
        </div>
      </AppShell>
    );
  }

  if (!q && step >= total) {
    return (
      <AppShell title="Calcolo in corso…">
        <p className="text-sm text-muted-foreground">{NERDACOLO.name} sta tirando i dadi…</p>
      </AppShell>
    );
  }

  if (!q) {
    return (
      <AppShell title="Ops">
        <p className="text-sm text-muted-foreground">
          Nessuna altra domanda disponibile.{" "}
          <button type="button" className="text-accent underline" onClick={() => goToResult(answers)}>
            Vedi risultato
          </button>
        </p>
      </AppShell>
    );
  }

  const progress = (step / total) * 100;

  const answer = (idx: number) => {
    const next = { ...answers, [q.id]: idx };
    setAnswers(next);
    const nextHistory = [...history, q];
    setHistory(nextHistory);

    if (nextHistory.length >= total || !pickNextQuestion(mode, next, nextHistory.length, pool, profile)) {
      goToResult(next);
    }
  };

  const goBack = () => {
    if (!history.length) {
      setMode(null);
      setPool([]);
      return;
    }
    const prev = history[history.length - 1]!;
    const nextAnswers = { ...answers };
    delete nextAnswers[prev.id];
    setAnswers(nextAnswers);
    setHistory(h => h.slice(0, -1));
  };

  return (
    <AppShell subtitle={`Domanda ${step + 1} / ~${total}`} title={`${NERDACOLO.name} interroga…`}>
      <p className="mb-1 text-[10px] uppercase tracking-widest text-accent">
        Pool: {pool.length} titoli TMDB
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        {step === 0 ? intro : q.masterLine ?? NERDACOLO.tagline}
      </p>

      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-hero transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="glass rounded-3xl p-5 shadow-glow">
        <div className="flex items-start gap-3">
          <BrandIcon className="h-10 w-10 shrink-0" compact />
          <p className="text-lg font-bold leading-snug">{q.question}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {q.choices.map((c, i) => (
          <button
            key={i}
            onClick={() => answer(i)}
            className="w-full rounded-2xl border border-border bg-surface/60 p-4 text-left transition hover:border-accent hover:bg-accent/10"
          >
            <p className="text-sm font-semibold">{c.label}</p>
          </button>
        ))}
      </div>

      <button onClick={goBack} className="mt-4 w-full text-center text-xs text-muted-foreground">
        ← indietro
      </button>
    </AppShell>
  );
}
