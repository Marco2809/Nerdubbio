import { useEffect, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import type { LibrarySortKey } from "@/lib/library-display";
import { useI18n } from "@/lib/i18n";

const KEYS: LibrarySortKey[] = ["default", "rating", "title", "year"];
const VALID = new Set<LibrarySortKey>(KEYS);

/** Sort ricordato tra i cambi di sezione (per pagina). */
export function usePersistentSort(storageKey: string): [LibrarySortKey, (v: LibrarySortKey) => void] {
  const [sort, setSort] = useState<LibrarySortKey>(() => {
    if (typeof sessionStorage === "undefined") return "default";
    const saved = sessionStorage.getItem(storageKey) as LibrarySortKey | null;
    return saved && VALID.has(saved) ? saved : "default";
  });
  useEffect(() => {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(storageKey, sort);
  }, [storageKey, sort]);
  return [sort, setSort];
}

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
