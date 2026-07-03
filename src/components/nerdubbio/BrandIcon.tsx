import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

type Props = {
  className?: string;
  compact?: boolean;
};

const iconSrc = `/icon.png?v=${BRAND.assetVer}`;

/** Icona Nerdubbio — sfera oracle con play neon (Nerdacolo / Main Quest). */
export function BrandIcon({ className, compact }: Props) {
  return (
    <img
      src={iconSrc}
      alt=""
      width={1024}
      height={1024}
      aria-hidden
      decoding="async"
      className={cn(
        "aspect-square bg-transparent object-contain",
        compact ? className : cn("drop-shadow-[0_0_14px_rgba(236,72,153,0.45)]", className),
      )}
    />
  );
}
