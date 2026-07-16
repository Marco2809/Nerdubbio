import { Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Filtro testuale per la libreria (Profilo Film/Serie). */
export function LibrarySearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface/50 px-3 py-2">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("library.searchPlaceholder")}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label={t("common.close")} className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
