import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { giphyApi, type GiphyGif } from "@/lib/php/comment-media-client";

export function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(false);
    const query = q.trim();
    const timer = setTimeout(async () => {
      try {
        const res = query ? await giphyApi.search(query, 0, locale) : await giphyApi.trending();
        if (!cancelled) setGifs(res.gifs);
      } catch {
        if (!cancelled) setErr(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, locale]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-surface-0 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("comments.searchGif")}
              className="w-full rounded-xl border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-surface-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
          ) : err ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("comments.giphyError")}</p>
          ) : gifs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("comments.noGif")}</p>
          ) : (
            <div className="columns-2 gap-2 sm:columns-3">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onSelect(g.url)}
                  className="mb-2 block w-full overflow-hidden rounded-lg bg-surface-2"
                >
                  <img src={g.preview} alt="" loading="lazy" className="w-full" />
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="border-t border-border py-1.5 text-center text-[10px] text-muted-foreground">Powered by GIPHY</p>
      </div>
    </div>,
    document.body,
  );
}
