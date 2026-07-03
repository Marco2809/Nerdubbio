import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { BrandIcon } from "./BrandIcon";

type Props = {
  lang?: "it" | "en";
  className?: string;
  /** Sfera oracle + wordmark affiancati (landing, auth, onboarding). */
  withIcon?: boolean;
};

const wordmarkSrc = `/wordmark.png?v=${BRAND.assetVer}`;

/** Wordmark NERDUBBIO — asset ufficiale con gradient neon e play nel «O». */
export function Wordmark({ lang = "it", className, withIcon = false }: Props) {
  const label = lang === "it" ? "Nerdubbio" : "Nerdoubt";

  return (
    <span
      className={cn(
        "inline-flex items-center select-none",
        withIcon && "gap-2 sm:gap-2.5",
        className,
      )}
      role="img"
      aria-label={label}
    >
      {withIcon && (
        <BrandIcon className="h-[1.15em] w-[1.15em] shrink-0" compact />
      )}
      <img
        src={wordmarkSrc}
        alt=""
        width={910}
        height={147}
        className="h-[1em] w-auto max-w-[min(100%,12rem)] bg-transparent object-contain object-left sm:max-w-[14rem]"
        decoding="async"
        fetchPriority="high"
      />
    </span>
  );
}
