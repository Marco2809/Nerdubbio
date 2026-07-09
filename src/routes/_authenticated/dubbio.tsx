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
  generateFinalRecommendation,
  saveNerdacoloResult,
  saveNerdacoloSession,
  startNerdacoloSession,
} from "@/lib/recommendation/nerdacoloEngine";
import type { NerdacoloMode, NerdacoloQuestion, NerdacoloSessionState } from "@/lib/recommendation/nerdacolo-types";
import { useUserStore } from "@/lib/user-store";
import { NERDACOLO, QUEST } from "@/lib/brand";
import { useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { useI18n, localeToBcp47, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dubbio")({
  head: () => ({ meta: [{ title: pageTitle("dubbio", "it", { name: QUEST.name }) }] }),
  component: DubbioPage,
});

function DubbioPage() {
  const { t, locale } = useI18n();
  const tmdbLocale = localeToBcp47(locale);
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
        }, undefined, tmdbLocale);
        if (!pool.length) throw new Error("empty");
      } catch {
        pool = CATALOG;
        toast.error(t("dubbio.tmdbFallback"));
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
      toast.success(`${NERDACOLO.short}: ${t("dubbio.candidatesInSphere", { count: started.candidatePool.length })}`);
    } catch (e) {
      toast.error(t("dubbio.startError"));
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

      const stuckOnSameQuestion =
        result.nextQuestion != null && result.nextQuestion.id === currentQuestion.id;
      const finalRec =
        result.finalRecommendation
        ?? ((result.shouldStop || !result.nextQuestion || stuckOnSameQuestion)
          ? generateFinalRecommendation(result.updatedSessionState)
          : null);

      if (finalRec && (result.shouldStop || !result.nextQuestion || stuckOnSameQuestion)) {
        saveNerdacoloResult(finalRec);
        saveNerdacoloSession(result.updatedSessionState);
        navigate({ to: "/dubbio/risultato" });
        return;
      }

      if (result.nextQuestion) {
        setCurrentQuestion(result.nextQuestion);
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
    toast(t("dubbio.restartToChange"));
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
      <AppShell subtitle={NERDACOLO.title} title={t("dubbio.whatTonight")}>
        <NerdacoloTrigger />
        <p className="mb-4 mt-3 text-sm text-muted-foreground">
          {t("dubbio.intro", { name: NERDACOLO.name })}
        </p>
        <NerdacoloModePicker onSelect={m => void selectMode(m)} />
      </AppShell>
    );
  }

  if (loadingPool) {
    return (
      <AppShell title={t("dubbio.scanning", { name: NERDACOLO.name })}>
        <NerdacoloLoader title={t("dubbio.collectingPool")} />
      </AppShell>
    );
  }

  if (consulting) {
    return (
      <AppShell title={t("dubbio.consulting")}>
        <NerdacoloConsultingPulse line={oracleLine || t("dubbio.consultingSphere")} />
      </AppShell>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <AppShell title={t("auth.oops")}>
        <p className="text-sm text-muted-foreground">{t("dubbio.invalidSession")}</p>
        <button type="button" className="mt-4 text-accent underline" onClick={goBack}>
          {t("dubbio.restart")}
        </button>
      </AppShell>
    );
  }

  return (
    <AppShell subtitle={NERDACOLO.title} title={t("dubbio.interrogating", { name: NERDACOLO.name })}>
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
