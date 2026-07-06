import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { NerdacoloLoader } from "@/components/nerdubbio/NerdacoloLoader";
import type { NerdacoloMode } from "@/lib/recommendation/nerdacolo-types";
import type { NerdacoloQuestion, NerdacoloSessionState } from "@/lib/recommendation/nerdacolo-types";
import { MAX_QUESTIONS } from "@/lib/recommendation/nerdacolo-types";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Props = {
  question: NerdacoloQuestion;
  session: NerdacoloSessionState;
  oracleLine: string;
  onAnswer: (answerId: string) => void;
  onBack: () => void;
  consulting?: boolean;
};

export function NerdacoloQuizView({
  question,
  session,
  oracleLine,
  onAnswer,
  onBack,
  consulting = false,
}: Props) {
  const { t } = useI18n();
  const step = session.questionCount + 1;
  const progress = (session.questionCount / MAX_QUESTIONS) * 100;
  const remaining = session.candidates.length;
  const scrapped = session.eliminatedCount;

  const statusLines = [
    scrapped > 0 ? t("dubbio.sphereScrapped", { n: scrapped }) : null,
    remaining > 0 ? t("dubbio.remainingSuspects", { n: remaining }) : null,
    session.confidence > 50 ? t("dubbio.doubtNarrows") : null,
  ].filter(Boolean);

  if (consulting) {
    return <NerdacoloLoader title={t("dubbio.consultSphere")} />;
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
          {t("dubbio.questionOf", { n: step, total: MAX_QUESTIONS })}
        </p>
        <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-[10px] text-fuchsia-300">
          {t("dubbio.inRace", { n: remaining })}
        </span>
      </div>

      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-hero transition-all duration-500"
          style={{ width: `${Math.max(progress, 8)}%` }}
        />
      </div>

      <div className="mb-4 min-h-[2.5rem] rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-accent" aria-hidden />
          {oracleLine}
        </p>
        {statusLines.length > 0 && (
          <p className="mt-1 text-[10px] text-accent/80">{statusLines.join(" · ")}</p>
        )}
      </div>

      <div className="glass relative overflow-hidden rounded-3xl p-5 shadow-glow">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-2xl" />
        <div className="flex items-start gap-3">
          <BrandIcon className="h-12 w-12 shrink-0 animate-[pulse_3s_ease-in-out_infinite]" compact />
          <div>
            <p className="text-xl font-bold leading-snug">{question.text}</p>
            {question.subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{question.subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {question.options.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onAnswer(opt.id)}
            className={cn(
              "group w-full rounded-2xl border border-border bg-surface/60 p-4 text-left transition",
              "hover:border-accent hover:bg-accent/10 active:scale-[0.99]",
            )}
          >
            <p className="text-sm font-semibold group-hover:text-accent">{opt.label}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        ← {t("dubbio.back")}
      </button>
    </div>
  );
}

export function NerdacoloModePicker({
  onSelect,
}: {
  onSelect: (mode: NerdacoloMode) => void;
}) {
  const { t } = useI18n();
  const modes: { key: NerdacoloMode; label: string; sub: string; emoji: string }[] = [
    { key: "tv", label: t("dubbio.modeTv"), sub: t("dubbio.modeTvSub"), emoji: "📺" },
    { key: "movie", label: t("dubbio.modeMovie"), sub: t("dubbio.modeMovieSub"), emoji: "🎬" },
    { key: "surprise", label: t("dubbio.modeSurprise"), sub: t("dubbio.modeSurpriseSub"), emoji: "🔮" },
  ];

  return (
    <div className="space-y-3">
      {modes.map(m => (
        <button
          key={m.key}
          type="button"
          onClick={() => onSelect(m.key)}
          className="glass flex w-full items-center gap-4 rounded-3xl p-4 text-left transition hover:shadow-glow"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-hero text-2xl shadow-glow-pink">
            {m.emoji}
          </span>
          <div className="flex-1">
            <p className="font-bold">{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.sub}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/** Breve animazione tra una risposta e la prossima domanda. */
export function NerdacoloConsultingPulse({ line }: { line: string }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center py-10">
      <BrandIcon className="h-20 w-20 animate-pulse" compact />
      <p className="mt-4 text-center text-sm font-medium">{line}{dots}</p>
    </div>
  );
}
