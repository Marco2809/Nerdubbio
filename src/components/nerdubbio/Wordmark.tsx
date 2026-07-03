import { cn } from "@/lib/utils";
import { BrandIcon } from "./BrandIcon";

type Props = {
  lang?: "it" | "en";
  className?: string;
  /** Sfera oracle + wordmark affiancati (landing, auth, onboarding). */
  withIcon?: boolean;
};

/** Wordmark NERDUBBIO — asset ufficiale con gradient neon e play nel «O». */
export function Wordmark({ lang = "it", className, withIcon = false }: Props) {
  const label = lang === "it" ? "Nerdubbio" : "Nerdoubt";

  return (
    <span
      className={cn(
        "inline-flex items-center select-none",
        withIcon && "gap-2.5 sm:gap-3",
        className,
      )}
      role="img"
      aria-label={label}
    >
      {withIcon && (
        <BrandIcon className="h-[1.2em] w-[1.2em] shrink-0" compact />
      )}
      <img
        src="/wordmark.png"
        alt=""
        width={1024}
        height={256}
        className="h-[1em] w-auto max-w-full bg-transparent object-contain object-left"
        decoding="async"
        fetchPriority="high"
      />
    </span>
  );
}
