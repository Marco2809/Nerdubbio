import { I18nContext, normalizeLocale, translate, type Locale } from "@/lib/i18n/context";
import { useContext } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { BrandIcon } from "./BrandIcon";

type Props = {
  lang?: Locale;
  className?: string;
  withIcon?: boolean;
};

const wordmarkSrc = `/wordmark.png?v=${BRAND.assetVer}`;

export function Wordmark({ lang, className, withIcon = false }: Props) {
  const i18n = useContext(I18nContext);
  const label = lang != null
    ? translate(normalizeLocale(lang), "brand.name")
    : i18n.t("brand.name");

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
        className="h-[1em] w-auto max-w-[min(100%,15rem)] bg-transparent object-contain object-left sm:max-w-[17rem]"
        decoding="async"
        fetchPriority="high"
      />
    </span>
  );
}
