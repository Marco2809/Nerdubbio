import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type Props = {
  rolling: boolean;
  /** Valore finale 1–20 */
  finalValue: number;
  onSettled?: () => void;
  className?: string;
};

export function D20Roll({ rolling, finalValue, onSettled, className }: Props) {
  const [display, setDisplay] = useState(1);
  const [settled, setSettled] = useState(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    if (!rolling) {
      setDisplay(finalValue);
      setSettled(true);
      return;
    }

    setSettled(false);
    let tick = 0;
    const maxTicks = 28;
    let timeout: ReturnType<typeof setTimeout>;

    const step = () => {
      tick++;
      if (tick < maxTicks) {
        setDisplay(Math.floor(Math.random() * 20) + 1);
      } else {
        setDisplay(finalValue);
        setSettled(true);
        onSettledRef.current?.();
        return;
      }
      timeout = setTimeout(step, 60 + tick * 12);
    };

    timeout = setTimeout(step, 80);
    return () => clearTimeout(timeout);
  }, [rolling, finalValue]);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div
        className={cn(
          "relative grid h-36 w-36 place-items-center transition-transform duration-300",
          rolling && !settled && "animate-[d20-wobble_0.45s_ease-in-out_infinite]",
          settled && "scale-105",
        )}
      >
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full drop-shadow-[0_0_24px_rgba(236,72,153,0.55)]" aria-hidden>
          <defs>
            <linearGradient id="d20-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <polygon
            points="60,8 108,38 92,108 28,108 12,38"
            fill="#0c0618"
            stroke="url(#d20-fill)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <polygon
            points="60,22 94,44 82,96 38,96 26,44"
            fill="none"
            stroke="url(#d20-fill)"
            strokeWidth="1.5"
            opacity="0.45"
          />
        </svg>
        <span
          className={cn(
            "relative z-10 font-display text-5xl font-black tabular-nums text-white",
            settled && finalValue === 20 && "text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]",
            settled && finalValue === 1 && "text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.8)]",
          )}
        >
          {display}
        </span>
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">d20</p>
    </div>
  );
}
