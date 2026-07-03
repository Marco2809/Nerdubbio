import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

/** Icona Nerdubbio — sfera oracle con play neon (Nerdacolo / Main Quest). */
export function BrandIcon({ className, compact }: Props) {
  return (
    <img
      src="/icon.png"
      alt=""
      width={1024}
      height={1024}
      aria-hidden
      decoding="async"
      className={cn(
        "aspect-square object-contain",
        compact ? className : cn("drop-shadow-[0_0_14px_rgba(236,72,153,0.45)]", className),
      )}
    />
  );
}
