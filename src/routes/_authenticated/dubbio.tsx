import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { NerdacoloTrigger } from "@/components/nerdubbio/NerdacoloTrigger";
import {
  NerdacoloConsultingPulse,
  NerdacoloModePicker,
  NerdacoloQuizView,
} from "@/components/nerdubbio/NerdacoloQuiz";
import { NerdacoloLoader } from "@/components/nerdubbio/NerdacoloLoader";
import type { CatalogItem } from "@/lib/mock-catalog";
import { CATALOG } from "@/lib/mock-catalog";
import { fetchDubbioPool, saveDubbioPool } from "@/lib/recommendation/dubbio-pool";
import {
  answerQuestion,
  buildNerdacoloUserContext,
  saveNerdacoloResult,
  saveNerdacoloSession,
  startNerdacoloSession,
} from "@/lib/recommendation/nerdacoloEngine";
import type { NerdacoloMode, NerdacoloQuestion, NerdacoloSessionState } from "@/lib/recommendation/nerdacolo-types";
import { useUserStore } from "@/lib/user-store";
import { NERDACOLO, QUEST } from "@/lib/brand";
import { useMemo, useState } from "react";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/dubbio")({
  head: () => ({ meta: [{ title: `${QUEST.name} — Nerdubbio` }] }),
  component: DubbioPage,
});

function DubbioPage() {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const { state } = useUserStore();
  const userContext = useMemo(() => buildNerdacoloUserContext(state), [state]);

  const [mode, setMode] = useState<NerdacoloMode | null>(null);
  const [session, setSession] = useState<NerdacoloSessionState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<NerdacoloQuestion | null>(null);
  const [oracleLine, setOracleLine] = useState("");
  const [loadingPool, setLoadingPool] = useState(false);
  const [consulting, setConsulting] = useState(false);

  const selectMode = async (m: NerdacoloMode) => {
    setMode(m);
    setLoadingPool(true);
    try {
      let pool: CatalogItem[];
      try {
        pool = await fetchDubbioPool(m, {
          seenIds: userContext.seenIds,
          dismissedIds: userContext.dismissedIds,
          favoriteGenres: userContext.favoriteGenres,
          moodProfile: userContext.moodProfile,
          watchlistIds: userContext.watchlistIds,
          highlyRatedIds: userContext.highlyRatedIds,
        });
        if (!pool.length) throw new Error("empty");
      } catch {
        pool = CATALOG;
        toast.error("TMDB non disponibile — catalogo locale di backup");
      }

      saveDubbioPool(pool);
      const started = startNerdacoloSession({
        mode: m,
        userProfile: userContext,
        catalogPool: pool,
        language: userContext.language,
      });

      setSession(started.sessionState);
      setCurrentQuestion(started.firstQuestion);
      setOracleLine(started.oracleLine);
      toast.success(`${NERDACOLO.short}: ${started.candidatePool.length} candidati in sfera`);
    } catch (e) {
      toast.error("Errore avvio Nerdacolo");
      setMode(null);
    } finally {
      setLoadingPool(false);
    }
  };

  const handleAnswer = (answerId: string) => {
    if (!session || !currentQuestion) return;

    setConsulting(true);
    const result = answerQuestion(session, currentQuestion.id, answerId);

    setTimeout(() => {
      setConsulting(false);
      setSession(result.updatedSessionState);
      setOracleLine(result.oracleLine);
      saveNerdacoloSession(result.updatedSessionState);

      if (result.shouldStop && result.finalRecommendation) {
        saveNerdacoloResult(result.finalRecommendation);
        saveNerdacoloSession(result.updatedSessionState);
        navigate({ to: "/dubbio/risultato" });
        return;
      }

      if (result.nextQuestion) {
        setCurrentQuestion(result.nextQuestion);
      } else if (result.finalRecommendation) {
        saveNerdacoloResult(result.finalRecommendation);
        navigate({ to: "/dubbio/risultato" });
      }
    }, 700);
  };

  const goBack = () => {
    if (!mode) return;
    if (!session || session.questionCount === 0) {
      setMode(null);
      setSession(null);
      setCurrentQuestion(null);
      return;
    }
    toast("Ricomincia la sessione per cambiare le risposte");
    setMode(null);
    setSession(null);
    setCurrentQuestion(null);
  };

  // /dubbio/risultato è una route figlia: senza questo Outlet la pagina
  // risultato "matcha" ma non viene mai renderizzata (quiz bloccato a 11/10).
  if (matchRoute({ to: "/dubbio/risultato" })) {
    return <Outlet />;
  }

  if (!mode) {
    return (
      <AppShell subtitle={NERDACOLO.title} title="Cosa cerchi stasera?">
        <div className="mb-4 flex items-center gap-3">
          <NerdacoloTrigger compact />
          <p className="text-xs text-muted-foreground">
            Tap su {NERDACOLO.name} per un <span className="text-fuchsia-300">tiro d20</span> veloce.
          </p>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {NERDACOLO.name} interroga TMDB e la tua libreria. Ogni domanda restringe i candidati fino al match perfetto.
        </p>
        <NerdacoloModePicker onSelect={m => void selectMode(m)} />
      </AppShell>
    );
  }

  if (loadingPool) {
    return (
      <AppShell title={`${NERDACOLO.name} scansiona TMDB…`}>
        <NerdacoloLoader title="Raccolgo candidati da trending, discover e watchlist…" />
      </AppShell>
    );
  }

  if (consulting) {
    return (
      <AppShell title="Consultazione…">
        <NerdacoloConsultingPulse line={oracleLine || "Sto consultando la sfera"} />
      </AppShell>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <AppShell title="Ops">
        <p className="text-sm text-muted-foreground">Sessione non valida.</p>
        <button type="button" className="mt-4 text-accent underline" onClick={goBack}>
          Ricomincia
        </button>
      </AppShell>
    );
  }

  return (
    <AppShell subtitle={NERDACOLO.title} title={`${NERDACOLO.name} interroga…`}>
      <NerdacoloQuizView
        question={currentQuestion}
        session={session}
        oracleLine={oracleLine}
        onAnswer={handleAnswer}
        onBack={goBack}
      />
    </AppShell>
  );
}
