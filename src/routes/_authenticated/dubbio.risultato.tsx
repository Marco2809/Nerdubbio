import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { NerdacoloLoader } from "@/components/nerdubbio/NerdacoloLoader";
import {
  clearNerdacoloSession,
  loadNerdacoloResult,
  loadNerdacoloSession,
  recordNerdacoloFeedback,
} from "@/lib/recommendation/nerdacoloEngine";
import type { NerdacoloCandidate, NerdacoloFinalResult } from "@/lib/recommendation/nerdacolo-types";
import { useUserStore, type MediaMeta } from "@/lib/user-store";
import { NERDACOLO, QUEST } from "@/lib/brand";
import {
  Check,
  Film,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Tv,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/dubbio/risultato")({
  head: () => ({ meta: [{ title: `Risultato ${QUEST.name} — Nerdubbio` }] }),
  component: ResultPage,
});

function toMeta(c: NerdacoloCandidate): MediaMeta {
  return {
    title: c.title,
    type: c.mediaType,
    year: c.releaseYear,
    posterUrl: c.posterPath ?? null,
    backdropUrl: c.backdropPath ?? null,
  };
}

function PosterHero({ pick, result }: { pick: NerdacoloCandidate; result: NerdacoloFinalResult }) {
  return (
    <div className="relative h-64 overflow-hidden rounded-3xl shadow-glow-pink">
      {pick.posterPath ? (
        <img src={pick.posterPath} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary/40 to-surface" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-hero px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
            Match {result.compatibilityScore}%
          </span>
          {result.isBoldPick && (
            <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300">
              Scelta audace
            </span>
          )}
          <span className="text-[10px] uppercase tracking-widest text-white/70">
            {pick.mediaType === "tv" ? "Serie" : "Film"} · {pick.releaseYear}
          </span>
        </div>
        <h2 className="mt-1 text-2xl font-extrabold text-white">{pick.title}</h2>
      </div>
    </div>
  );
}

type FeedbackAction =
  | "perfect"
  | "seen"
  | "nope"
  | "heavy"
  | "light"
  | "long"
  | "action"
  | "niche"
  | "watchlist";

function ResultPage() {
  const navigate = useNavigate();
  const { state, addToList, dismiss, update } = useUserStore();
  const [result, setResult] = useState<NerdacoloFinalResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setResult(loadNerdacoloResult());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <AppShell title={`${NERDACOLO.name} calcola…`}>
        <NerdacoloLoader />
      </AppShell>
    );
  }

  if (!result) {
    return (
      <AppShell title="Nessun risultato">
        <p className="text-sm text-muted-foreground">
          {NERDACOLO.name} non ha un verdetto salvato.{" "}
          <Link to="/dubbio" className="text-accent underline">
            Rifai il Dubbio
          </Link>
        </p>
      </AppShell>
    );
  }

  const pick = result.mainRecommendation;
  const mediaId = pick.mediaKey;
  const meta = toMeta(pick);
  const session = loadNerdacoloSession();

  const unlockAchievement = () => {
    if (!state.achievements.includes("primo-dubbio")) {
      update({ achievements: [...state.achievements, "primo-dubbio"] });
    }
  };

  const share = async () => {
    const text = `${NERDACOLO.name} consiglia: ${pick.title} (${result.compatibilityScore}% match) — Nerdubbio`;
    try {
      if (navigator.share) {
        await navigator.share({ title: QUEST.shareTitle, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copiato negli appunti");
      }
    } catch {
      /* cancelled */
    }
  };

  // Il feedback aggiorna anche i pesi delle sessioni future (bias persistente).
  const handleFeedback = (action: FeedbackAction) => {
    switch (action) {
      case "perfect":
        recordNerdacoloFeedback("perfect");
        toast.success("Perfetto! La sfera ringrazia.");
        unlockAchievement();
        break;
      case "seen":
        addToList(mediaId, "completed", meta);
        toast.success("Segnato come già visto");
        break;
      case "nope":
        dismiss(mediaId);
        toast("Scartato — non te lo propongo più");
        break;
      case "heavy":
        recordNerdacoloFeedback("lighter");
        dismiss(mediaId);
        toast("Ok, la prossima sarà più leggera");
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        break;
      case "light":
        recordNerdacoloFeedback("heavier");
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        toast("Rifai il Dubbio per qualcosa di più intenso");
        break;
      case "long":
        recordNerdacoloFeedback("shorter");
        dismiss(mediaId);
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        toast("Cerco qualcosa di più breve");
        break;
      case "action":
        recordNerdacoloFeedback("action");
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        toast("Rifai il Dubbio con più azione");
        break;
      case "niche":
        recordNerdacoloFeedback("niche");
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        toast("Rifai il Dubbio per una chicca");
        break;
      case "watchlist":
        addToList(mediaId, "plan_to_watch", meta);
        unlockAchievement();
        toast.success(`"${pick.title}" in watchlist`);
        break;
    }
  };

  return (
    <AppShell subtitle={`${NERDACOLO.name} ha parlato`} title="Ecco cosa guardi stasera">
      {session && (
        <p className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          {session.initialPoolSize} candidati iniziali · {session.eliminatedCount} scartati · confidence {result.confidence}%
        </p>
      )}

      <PosterHero pick={pick} result={result} />

      <div className="glass mt-4 rounded-3xl p-4">
        <div className="flex items-start gap-2">
          <BrandIcon className="mt-0.5 h-8 w-8 shrink-0" compact />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Perché te lo consiglio</p>
            <p className="mt-1 text-sm leading-relaxed">{result.explanation}</p>
          </div>
        </div>
        {result.matchedTraits.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {result.matchedTraits.map(t => (
              <span
                key={t}
                className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {result.rejectedButRecoveredTraits.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Avviso della sfera: include comunque {result.rejectedButRecoveredTraits.join(", ")} — dosati bene.
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-border bg-surface/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mood</p>
          <p className="mt-0.5 font-semibold">{result.moodLabel}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impegno</p>
          <p className="mt-0.5 font-semibold">{result.commitmentLabel}</p>
        </div>
      </div>

      {result.similarTo.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-accent" />
          Somiglia a: {result.similarTo.join(", ")}
        </p>
      )}

      {result.whyNotOthers.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border/60 bg-surface/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cosa ho scartato
          </p>
          <ul className="mt-2 space-y-1">
            {result.whyNotOthers.map((line, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                · {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleFeedback("watchlist")}
          className="rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow"
        >
          <Plus className="mr-1 inline h-4 w-4" /> Watchlist
        </button>
        <button
          type="button"
          onClick={() => handleFeedback("seen")}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold"
        >
          <Check className="mr-1 inline h-4 w-4" /> Già visto
        </button>
        <button
          type="button"
          onClick={() => handleFeedback("nope")}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold"
        >
          <ThumbsDown className="mr-1 inline h-4 w-4" /> Non fa per me
        </button>
        <Link
          to="/media/$type/$id"
          params={{ type: pick.mediaType, id: String(pick.tmdbId) }}
          className="rounded-2xl border border-accent/40 bg-accent/10 py-3 text-center text-sm font-semibold text-accent"
        >
          {pick.mediaType === "tv" ? <Tv className="mr-1 inline h-4 w-4" /> : <Film className="mr-1 inline h-4 w-4" />}
          Apri scheda
        </Link>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Feedback per la sfera
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "perfect" as const, label: "Perfetto", icon: ThumbsUp },
            { id: "heavy" as const, label: "Troppo pesante", icon: null },
            { id: "light" as const, label: "Troppo leggero", icon: null },
            { id: "long" as const, label: "Troppo lungo", icon: null },
            { id: "action" as const, label: "Più azione", icon: Zap },
            { id: "niche" as const, label: "Meno mainstream", icon: null },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleFeedback(f.id)}
              className="rounded-full border border-border bg-surface/50 px-3 py-1.5 text-[11px] font-medium hover:border-accent"
            >
              {f.icon && <f.icon className="mr-1 inline h-3 w-3" />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {result.alternativeRecommendations.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">Alternative</h3>
          <div className="space-y-2">
            {result.alternativeRecommendations.map(alt => (
              <Link
                key={alt.mediaKey}
                to="/media/$type/$id"
                params={{ type: alt.mediaType, id: String(alt.tmdbId) }}
                className="glass flex items-center gap-3 rounded-2xl p-3"
              >
                {alt.posterPath ? (
                  <img src={alt.posterPath} alt="" className="h-16 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="h-16 w-12 shrink-0 rounded-xl bg-surface-2" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{alt.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {alt.releaseYear} · Match {alt.score}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/dubbio"
          onClick={() => clearNerdacoloSession()}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-center text-sm font-semibold"
        >
          <RotateCcw className="mr-1 inline h-4 w-4" /> Rifai il Dubbio
        </Link>
        <button
          type="button"
          onClick={() => void share()}
          className="rounded-2xl border border-accent/40 bg-accent/10 py-3 text-sm font-semibold text-accent"
        >
          <Share2 className="mr-1 inline h-4 w-4" /> Condividi
        </button>
      </div>
    </AppShell>
  );
}
