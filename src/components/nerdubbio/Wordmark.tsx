import wordmarkIt from "@/assets/wordmark-nerdubbio.png";
import wordmarkEn from "@/assets/wordmark-nerdoubt.png";

type Props = {
  lang?: "it" | "en";
  className?: string;
  priority?: boolean;
};

/**
 * Nerdubbio brand wordmark.
 * - lang="it" → "Nerdubbio" (default)
 * - lang="en" → "Nerdoubt"
 */
export function Wordmark({ lang = "it", className, priority = false }: Props) {
  const isIt = lang === "it";
  const src = isIt ? wordmarkIt : wordmarkEn;
  const alt = isIt ? "Nerdubbio" : "Nerdoubt";
  return (
    <img
      src={src}
      alt={alt}
      width={1600}
      height={544}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className ?? "h-10 w-auto drop-shadow-[0_0_18px_rgba(236,72,153,0.35)]"}
    />
  );
}

export { wordmarkIt, wordmarkEn };
