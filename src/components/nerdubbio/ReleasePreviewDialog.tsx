import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrailerSection } from "@/components/nerdubbio/TrailerSection";
import { useI18n } from "@/lib/i18n";
import { useTmdbLocale } from "@/lib/tmdb/use-tmdb-locale";
import { tmdbVideos } from "@/lib/tmdb/tmdb.functions";
import { useUserStore } from "@/lib/user-store";
import { toast } from "@/lib/toast";

export interface ReleasePreviewItem {
  type: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  /** Riga sotto il titolo: data e cosa esce («S2 · E1», «Al cinema»…). */
  when: string;
  overview?: string;
  year?: number;
}

/**
 * Scheda di un'uscita dalla pagina Prossimamente: trailer e «Da vedere» senza
 * aprire la pagina del titolo. Chi vuole tutto il resto ha «Apri la scheda».
 */
export function ReleasePreviewDialog({ item, onClose }: { item: ReleasePreviewItem | null; onClose: () => void }) {
  const { t } = useI18n();
  const locale = useTmdbLocale();
  const { state, addToList } = useUserStore();
  const [saving, setSaving] = useState(false);

  const videosQuery = useQuery({
    queryKey: ["tmdb", "videos", item?.type, item?.tmdbId, locale],
    queryFn: () => tmdbVideos({ data: { type: item!.type, tmdbId: item!.tmdbId, locale } }),
    enabled: !!item,
    staleTime: 1000 * 60 * 60,
  });

  const id = item ? `${item.type}-${item.tmdbId}` : "";
  const entry = item ? state.media[id] : undefined;

  const add = async () => {
    if (!item || entry) return;
    setSaving(true);
    try {
      await addToList(id, "plan_to_watch", {
        title: item.title, type: item.type, year: item.year ?? 0, posterUrl: item.posterUrl, backdropUrl: null,
      });
      toast.success(t("prossimi.addedToWatch", { title: item.title }));
    } catch (e) {
      toast.error(t("media.saveStatusError"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const trailers = videosQuery.data?.trailers ?? [];

  return (
    <Dialog open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        {item && (
          <>
            <DialogHeader>
              <div className="flex gap-3 text-left">
                {item.posterUrl
                  ? <img src={item.posterUrl} alt="" className="h-28 w-20 shrink-0 rounded-xl object-cover" />
                  : <div className="h-28 w-20 shrink-0 rounded-xl bg-surface-2" />}
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-tight">{item.title}</DialogTitle>
                  <DialogDescription className="mt-1 flex items-center gap-1 text-xs text-accent">
                    <CalendarDays className="h-3 w-3 shrink-0" /> {item.when}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {item.overview && <p className="text-sm text-foreground/80">{item.overview}</p>}

            {videosQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("prossimi.loadingTrailer")}
              </div>
            )}
            {!videosQuery.isLoading && trailers.length > 0 && <TrailerSection key={id} trailers={trailers} />}
            {!videosQuery.isLoading && trailers.length === 0 && (
              <p className="rounded-2xl bg-surface-2 py-3 text-center text-xs text-muted-foreground">{t("prossimi.noTrailer")}</p>
            )}

            <div className="mt-1 flex gap-2">
              {entry ? (
                <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-xs font-bold text-accent">
                  <Check className="h-4 w-4" /> {t(`status.${entry.status}`)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void add()}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-hero py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t("status.plan_to_watch")}
                </button>
              )}
              <Link
                to="/media/$type/$id"
                params={{ type: item.type, id }}
                onClick={onClose}
                className="flex flex-1 items-center justify-center rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground"
              >
                {t("prossimi.openPage")}
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
