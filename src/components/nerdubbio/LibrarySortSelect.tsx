import { ArrowDownUp } from "lucide-react";
import type { LibrarySortKey } from "@/lib/library-display";
import { useI18n } from "@/lib/i18n";

const KEYS: LibrarySortKey[] = ["default", "rating", "title", "year"];

/** Selettore di ordinamento per Profilo Film/Serie. */
export function LibrarySortSelect({
  value,
  onChange,
}: {
  value: LibrarySortKey;
  onChange: (v: LibrarySortKey) => void;
}) {
  const { t } = useI18n();
  const label: Record<LibrarySortKey, string> = {
    default: t("library.sortDefault"),
    rating: t("library.sortRating"),
    title: t("library.sortTitle"),
    year: t("library.sortYear"),
  };
  return (
    <label className="glass flex items-center gap-1.5 rounded-full px-3 py-1">
      <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LibrarySortKey)}
        className="bg-transparent text-xs font-semibold outline-none"
        aria-label={t("library.sortBy")}
      >
        {KEYS.map((k) => (
          <option key={k} value={k} className="bg-background">
            {label[k]}
          </option>
        ))}
      </select>
    </label>
  );
}
