import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { giphyApi, type GiphyGif } from "@/lib/php/comment-media-client";

const PAGE = 24;

export function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const offsetRef = useRef(0);
  const reqRef = useRef(0);

  // autoFocus non è affidabile dentro un portal: forzo il focus al mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const fetchPage = useCallback(
    (query: string, offset: number) => (query ? giphyApi.search(query, offset, locale) : giphyApi.trending(offset)),
    [locale],
  );

  // Cambio query / lingua → azzera e ricarica la prima pagina (debounce).
  useEffect(() => {
    const query = q.trim();
    const myReq = ++reqRef.current;
    setLoading(true);
    setErr(false);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchPage(query, 0);
        if (reqRef.current !== myReq) return;
        setGifs(res.gifs);
        offsetRef.current = res.gifs.length;
        setHasMore(res.gifs.length >= PAGE);
      } catch {
        if (reqRef.current === myReq) {
          setErr(true);
          setGifs([]);
          setHasMore(false);
        }
      } finally {
        if (reqRef.current === myReq) setLoading(false);
      }
    }, query ? 350 : 0);
    return () => clearTimeout(timer);
  }, [q, fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const myReq = reqRef.current;
    setLoadingMore(true);
    try {
      const res = await fetchPage(q.trim(), offsetRef.current);
      if (reqRef.current !== myReq) return;
      setGifs((prev) => [...prev, ...res.gifs]);
      offsetRef.current += res.gifs.length;
      setHasMore(res.gifs.length >= PAGE);
    } catch {
      /* mantengo i risultati già mostrati */
    } finally {
      if (reqRef.current === myReq) setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, q]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 320) loadMore();
  };

  const refreshing = loading && gifs.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-surface-0 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("comments.searchGif")}
              className="w-full rounded-xl border border-border bg-surface-2 py-2 pl-9 pr-9 text-sm outline-none focus:border-accent"
            />
            {refreshing ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : q ? (
              <button
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label={t("common.close")}
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground active:bg-surface-1"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-surface-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto p-2" onScroll={onScroll}>
          {loading && gifs.length === 0 ? (
            <div className="grid h-40 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : err && gifs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("comments.giphyError")}</p>
          ) : gifs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("comments.noGif")}</p>
          ) : (
            <>
              <div className={`columns-2 gap-2 sm:columns-3 ${refreshing ? "opacity-50" : ""}`}>
                {gifs.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => onSelect(g.url)}
                    className="mb-2 block w-full overflow-hidden rounded-lg bg-surface-2 transition-transform active:scale-95"
                  >
                    <img src={g.preview} alt="" loading="lazy" className="w-full" />
                  </button>
                ))}
              </div>
              {loadingMore ? (
                <div className="grid h-10 place-items-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : null}
            </>
          )}
        </div>
        <p className="border-t border-border py-1.5 text-center text-[10px] text-muted-foreground">Powered by GIPHY</p>
      </div>
    </div>,
    document.body,
  );
}
