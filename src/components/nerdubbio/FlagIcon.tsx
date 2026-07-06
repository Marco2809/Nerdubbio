import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Bandiere SVG inline: le flag-emoji non renderizzano su Windows/Chrome
 * (mostrano solo i due codici lettera). Nessuna dipendenza esterna.
 */
const FLAGS: Record<Locale, React.ReactNode> = {
  it: (
    <svg viewBox="0 0 3 2" preserveAspectRatio="none" className="h-full w-full">
      <rect width="1" height="2" x="0" fill="#009246" />
      <rect width="1" height="2" x="1" fill="#fff" />
      <rect width="1" height="2" x="2" fill="#ce2b37" />
    </svg>
  ),
  fr: (
    <svg viewBox="0 0 3 2" preserveAspectRatio="none" className="h-full w-full">
      <rect width="1" height="2" x="0" fill="#0055A4" />
      <rect width="1" height="2" x="1" fill="#fff" />
      <rect width="1" height="2" x="2" fill="#EF4135" />
    </svg>
  ),
  es: (
    <svg viewBox="0 0 3 2" preserveAspectRatio="none" className="h-full w-full">
      <rect width="3" height="2" fill="#AA151B" />
      <rect width="3" height="1" y="0.5" fill="#F1BF00" />
    </svg>
  ),
  de: (
    <svg viewBox="0 0 5 3" preserveAspectRatio="none" className="h-full w-full">
      <rect width="5" height="3" y="0" fill="#000" />
      <rect width="5" height="2" y="1" fill="#D00" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <clipPath id="flag-uk-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="flag-uk-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#flag-uk-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#flag-uk-t)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  ),
};

export function FlagIcon({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <span
      className={cn("block overflow-hidden rounded-[3px] ring-1 ring-black/20", className)}
      aria-hidden
    >
      {FLAGS[locale]}
    </span>
  );
}
