import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCelebration, dismissCelebration, type CelebrationKind } from "@/lib/celebration-store";
import { useI18n } from "@/lib/i18n";

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

const VISUAL: Record<CelebrationKind, { emoji: string; confetti: boolean; ring: string }> = {
  ended: { emoji: "🎉", confetti: true, ring: "from-amber-400/40 to-pink-500/30" },
  nextSeasonDated: { emoji: "🗓️", confetti: false, ring: "from-sky-400/30 to-primary/30" },
  caughtUpOpen: { emoji: "✅", confetti: false, ring: "from-emerald-400/30 to-primary/30" },
};

const CONFETTI_COLORS = ["#f5c542", "#ec4899", "#8b5cf6", "#38bdf8", "#34d399", "#fb7185"];

function Confetti() {
  // 44 coriandoli con parametri deterministici-per-indice (niente flash SSR:
  // il modal si monta solo dopo un'azione utente).
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => {
        const left = (i * 97) % 100;
        const delay = (i % 10) * 0.12;
        const dur = 2.4 + ((i * 13) % 18) / 10;
        const size = 6 + (i % 4) * 2;
        const rot = (i * 47) % 360;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        return { left, delay, dur, size, rot, color, i };
      }),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes nd-confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(360px) rotate(540deg); opacity: 0; }
        }
      `}</style>
      {pieces.map(p => (
        <span
          key={p.i}
          style={{
            position: "absolute",
            top: "-16px",
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            background: p.color,
            borderRadius: "1px",
            transform: `rotate(${p.rot}deg)`,
            animation: `nd-confetti-fall ${p.dur}s ${p.delay}s cubic-bezier(.25,.6,.4,1) forwards`,
          }}
        />
      ))}
    </div>
  );
}

export function CelebrationModal() {
  const { t } = useI18n();
  const celebration = useCelebration();

  const open = celebration !== null;
  const kind = celebration?.kind ?? "caughtUpOpen";
  const visual = VISUAL[kind];
  const title = celebration?.title ?? "";
  const dateLabel = celebration?.airDate ? formatShortDate(celebration.airDate) : "";

  const headline =
    kind === "ended"
      ? t("celebration.endedTitle")
      : kind === "nextSeasonDated"
        ? t("celebration.seasonTitle")
        : t("celebration.caughtUpTitle");

  const body =
    kind === "ended"
      ? t("celebration.endedBody", { title })
      : kind === "nextSeasonDated"
        ? t("celebration.nextSeasonBody", { title, date: dateLabel })
        : t("celebration.caughtUpBody", { title });

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) dismissCelebration(); }}>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl border-border bg-surface text-center">
        {visual.confetti && <Confetti />}
        <div className="relative flex flex-col items-center gap-3 px-2 py-2">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${visual.ring} shadow-glow-pink`}
          >
            <span className="text-5xl" style={{ animation: "nd-pop .5s cubic-bezier(.2,1.4,.4,1)" }}>
              {visual.emoji}
            </span>
          </div>
          <style>{`@keyframes nd-pop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }`}</style>
          <h2 className="text-xl font-extrabold tracking-tight">{headline}</h2>
          {title && <p className="text-base font-semibold text-accent">{title}</p>}
          <p className="text-sm text-muted-foreground">{body}</p>
          <button
            type="button"
            onClick={dismissCelebration}
            className="mt-2 w-full rounded-full bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow-pink transition active:scale-[.98]"
          >
            {t("celebration.close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
