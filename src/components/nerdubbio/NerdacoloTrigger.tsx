import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { NERDACOLO } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Dices } from "lucide-react";

type Props = {
  className?: string;
  compact?: boolean;
};

/** Tap su Nerdacolo → tiro d20 con 20 titoli non visti. */
export function NerdacoloTrigger({ className, compact = false }: Props) {
  if (compact) {
    return (
      <Link
        to="/nerdacolo"
        aria-label={`${NERDACOLO.name}: tira un d20`}
        className={cn(
          "group relative inline-flex shrink-0 rounded-full transition-transform active:scale-95",
          className,
        )}
      >
        <span className="absolute inset-0 rounded-full bg-fuchsia-500/20 blur-md transition group-hover:bg-fuchsia-500/35" />
        <BrandIcon className="relative h-12 w-12" />
      </Link>
    );
  }

  return (
    <Link to="/nerdacolo" className={cn("mt-3 block", className)}>
      <div className="glass relative overflow-hidden rounded-3xl border border-fuchsia-400/25 p-4 transition hover:border-fuchsia-400/45 hover:shadow-glow">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <BrandIcon className="h-14 w-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-fuchsia-300">{NERDACOLO.name}</p>
            <p className="font-bold leading-snug">Tira un d20 — 20 titoli, un destino</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Non visti · watchlist · TMDB</p>
          </div>
          <Dices className="h-6 w-6 shrink-0 text-fuchsia-300/80" />
        </div>
      </div>
    </Link>
  );
}
