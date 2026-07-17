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
import { useQuery } from "@tanstack/react-query";
import { socialApi, SOCIAL_GROUPS_KEY } from "@/lib/php/social-client";
import { Users, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { useI18n, localeToBcp47, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dubbio")({
  head: () => ({ meta: [{ title: pageTitle("dubbio", "it", { name: QUEST.name }) }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    group: typeof search.group === "string" && search.group ? search.group : undefined,
    seed: typeof search.seed === "string" && /^(tv|movie)-\d+$/.test(search.seed) ? search.seed : undefined,
    seedTitle: typeof search.seedTitle === "string" && search.seedTitle ? search.seedTitle.slice(0, 80) : undefined,
  }),
  component: DubbioPage,
});

function DubbioPage() {
  const { t, locale } = useI18n();
  const tmdbLocale = localeToBcp47(locale);
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const { state } = useUserStore();
  const { group: groupId, seed: seedKey, seedTitle } = Route.useSearch();

  // Dubbio di gruppo: gusti fusi dei membri dal server.
  const groupCtxQ = useQuery({
    queryKey: ["social", "group-context", groupId],
    queryFn: () => socialApi.groupContext(groupId!),
    enabled: !!groupId,
    staleTime: 1000 * 60,
  });
  const groupsQ = useQuery({
    queryKey: SOCIAL_GROUPS_KEY,
    queryFn: () => socialApi.groups(),
    enabled: !!groupId,
    staleTime: 1000 * 60,
  });
  const groupName = groupsQ.data?.groups.find((g) => g.id === groupId)?.name;

  const userContext = useMemo(() => {
    const base = buildNerdacoloUserContext(state);
    const g = groupCtxQ.data;
    if (!groupId || !g) return base;
    // Fusione: escludi ciò che QUALUNQUE membro ha visto/scartato; generi in
    // unione; niente boost personali (watchlist/voti miei) per essere equi.
    return {
      ...base,
      seenIds: [...new Set([...base.seenIds, ...g.seenIds])],
      dismissedIds: [...new Set([...base.dismissedIds, ...g.dismissedIds])],
      favoriteGenres: g.favoriteGenres.length ? g.favoriteGenres : base.favoriteGenres,
      watchlistIds: [],
      highlyRatedIds: [],
      highlyRatedTitles: [],
    };
  }, [state, groupId, groupCtxQ.data]);

  const [mode, setMode] = useState<NerdacoloMode | null>(null);
  const [session, setSession] = useState<NerdacoloSessionState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<NerdacoloQuestion | null>(null);
  const [oracleLine, setOracleLine] = useState("");
  const [loadingPool, setLoadingPool] = useState(false);
  const [consulting, setConsulting] = useState(false);

  const selectMode = async (m: NerdacoloMode) => {
    if (groupId && !groupCtxQ.data) {
      toast(t("dubbio.groupLoading"));
      return;
    }
    // Il badge "Dubbio di gruppo" sul risultato legge questo marker.
    if (groupId && groupCtxQ.data) {
      sessionStorage.setItem(
        "nb_group_dubbio",
        JSON.stringify({ name: groupName ?? "", count: groupCtxQ.data.memberCount }),
      );
    } else {
      sessionStorage.removeItem("nb_group_dubbio");
    }
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
        }, undefined, tmdbLocale, seedKey);
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
      <AppShell subtitle={NERDACOLO.title} title={groupId ? t("dubbio.groupTitle") : t("dubbio.whatTonight")}>
        <NerdacoloTrigger />
        {seedKey && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-xs text-amber-100">
              {t("dubbio.seedBanner", { title: seedTitle ?? seedKey })}
            </p>
          </div>
        )}
        {groupId && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-3">
            <Users className="h-4 w-4 shrink-0 text-cyan-300" />
            <p className="text-xs text-cyan-100">
              {groupCtxQ.data
                ? t("dubbio.groupBanner", {
                    name: groupName ?? "…",
                    count: groupCtxQ.data.memberCount,
                    names: groupCtxQ.data.memberNames.slice(0, 4).join(", "),
                  })
                : t("dubbio.groupLoading")}
            </p>
          </div>
        )}
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
