import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { NERDACOLO } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const LINES = [
  `${NERDACOLO.name} consulta il grimorio dello streaming…`,
  `${NERDACOLO.name} calcola il tiro salvezza del binge…`,
  `${NERDACOLO.name} sniffa le tue risposte (senza giudicare… quasi).`,
  `${NERDACOLO.name} rolla un d20 sul catalogo TMDB…`,
  `${NERDACOLO.name} incrocia watchlist e oracolo…`,
];

type Props = {
  title?: string;
  className?: string;
};

/** Loader Nerdacolo — sfera, d20 e messaggi rotanti. */
export function NerdacoloLoader({
  title = "Calcolo in corso…",
  className,
}: Props) {
  const [lineIdx, setLineIdx] = useState(0);
  const [d20, setD20] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setLineIdx(i => (i + 1) % LINES.length), 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setD20(Math.floor(Math.random() * 20) + 1), 110);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={cn("flex flex-col items-center px-4 py-14", className)}>
      <div className="relative h-28 w-28">
        <span
          className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-fuchsia-500/20"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -inset-6 rounded-full bg-primary/15 blur-2xl animate-pulse"
          aria-hidden
        />
        <BrandIcon className="relative mx-auto h-24 w-24 animate-[pulse_2s_ease-in-out_infinite]" />
        <div
          className="absolute -bottom-1 -right-2 grid h-11 w-11 place-items-center rounded-xl border-2 border-accent/50 bg-surface/95 font-display text-lg font-black tabular-nums text-white shadow-glow-pink animate-[d20-wobble_0.5s_ease-in-out_infinite]"
          aria-hidden
        >
          {d20}
        </div>
      </div>

      <p className="mt-8 text-center text-base font-bold tracking-tight">{title}</p>
      <p
        key={lineIdx}
        className="mt-2 max-w-[16rem] animate-in fade-in text-center text-sm leading-relaxed text-muted-foreground duration-500"
      >
        {LINES[lineIdx]}
      </p>

      <div className="mt-8 flex items-center gap-2" aria-hidden>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-accent animate-bounce"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
