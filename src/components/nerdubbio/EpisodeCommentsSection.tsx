import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Loader2, MessageCircle, CornerDownRight, Trash2, Star, Smile, Image as ImageIcon, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { useI18n, useStatusLabel, localeToBcp47, type Locale } from "@/lib/i18n";
import {
  commentsApi, mediaCommentsKey, commentRepliesKey, type MediaComment,
} from "@/lib/php/comments-client";
import { translateApi } from "@/lib/php/translate-client";
import { uploadCommentImage } from "@/lib/php/comment-media-client";
import { GifPicker } from "@/components/nerdubbio/GifPicker";

const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","😢","😭","😡","👍","👎","🙏","🔥","💯","🎉","❤️","💔","😱","🤯","👏","🙌","😅","😴","🤩","😬","🤗","😏","🥳","💀","👀","✨","⭐"];

function formatWhen(iso: string, t: (k: string, v?: Record<string, string | number>) => string, bcp47: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return t("comments.now");
  if (mins < 60) return t("comments.minAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("comments.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("comments.daysAgo", { n: days });
  return d.toLocaleDateString(bcp47, { day: "2-digit", month: "short", year: "numeric" });
}

function CommentBubble({ comment, viewerLang, onDelete }: { comment: MediaComment; viewerLang: Locale; onDelete?: () => void }) {
  const { t } = useI18n();
  const statusLabel = useStatusLabel(comment.author_status ?? undefined);
  const [revealed, setRevealed] = useState(!comment.spoiler);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const when = formatWhen(comment.created_at, t, localeToBcp47(viewerLang));
  const authorLang = comment.author_language ?? "it";
  const canTranslate = !comment.is_mine && authorLang !== viewerLang && revealed;

  async function handleTranslate() {
    if (showTranslation) return setShowTranslation(false);
    if (translated) return setShowTranslation(true);
    setTranslating(true);
    try {
      const res = await translateApi.translate(comment.body, viewerLang, authorLang);
      setTranslated(res.text);
      setShowTranslation(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("comments.translateError"));
    } finally {
      setTranslating(false);
    }
  }

  const displayBody = showTranslation && translated ? translated : comment.body;

  return (
    <div className="flex items-start gap-3">
      <Link to="/u/$handle" params={{ handle: comment.author.handle }} className="shrink-0">
        {comment.author.avatar_url ? (
          <img src={comment.author.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-hero text-xs font-bold text-primary-foreground">
            {(comment.author.display_name || comment.author.handle).charAt(0).toUpperCase()}
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link to="/u/$handle" params={{ handle: comment.author.handle }} className="truncate text-sm font-semibold hover:text-accent">
            {comment.author.display_name || comment.author.handle}
          </Link>
          {comment.author_status && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">{statusLabel}</span>
          )}
          {comment.rating != null && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
              <Star className="h-2.5 w-2.5 fill-accent" />
              {comment.rating}/10
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{when}</p>
        {comment.spoiler && !revealed ? (
          <button type="button" onClick={() => setRevealed(true)} className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
            {t("comments.spoilerReveal")}
          </button>
        ) : (
          <>
            {displayBody ? <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{displayBody}</p> : null}
            {comment.media_url ? (
              <img src={comment.media_url} alt="" loading="lazy" className="mt-2 max-h-64 rounded-xl border border-border" />
            ) : null}
            {canTranslate && (
              <button type="button" disabled={translating} onClick={() => void handleTranslate()} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border bg-surface/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-accent hover:text-accent disabled:opacity-50">
                {translating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                {translating ? t("comments.translating") : showTranslation ? t("comments.showOriginal") : t("comments.translate")}
              </button>
            )}
          </>
        )}
      </div>
      {comment.is_mine && onDelete && (
        <button type="button" onClick={onDelete} aria-label={t("comments.deleteAria")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ThreadComment({ comment, viewerLang, type, tmdbId }: { comment: MediaComment; viewerLang: Locale; type: "tv" | "movie"; tmdbId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const repliesQ = useQuery({
    queryKey: commentRepliesKey(comment.id),
    queryFn: () => commentsApi.replies(comment.id),
    enabled: expanded,
    staleTime: 1000 * 30,
  });
  const replies = repliesQ.data?.replies ?? [];

  const replyMut = useMutation({
    mutationFn: () => commentsApi.create(type, tmdbId, replyBody.trim(), false, { parentId: comment.id }),
    onSuccess: () => {
      setReplyBody("");
      setReplyOpen(false);
      setExpanded(true);
      void qc.invalidateQueries({ queryKey: commentRepliesKey(comment.id) });
      void qc.invalidateQueries({ queryKey: ["media-comments", type, tmdbId] });
      toast.success(t("comments.published"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commentsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentRepliesKey(comment.id) });
      void qc.invalidateQueries({ queryKey: ["media-comments", type, tmdbId] });
      toast.success(t("comments.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article className="glass rounded-2xl p-3">
      <CommentBubble comment={comment} viewerLang={viewerLang} onDelete={comment.is_mine ? () => deleteMut.mutate(comment.id) : undefined} />

      <div className="mt-2 flex items-center gap-3 pl-12">
        <button type="button" onClick={() => setReplyOpen(v => !v)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition hover:text-accent">
          <CornerDownRight className="h-3.5 w-3.5" />
          {t("comments.reply")}
        </button>
        {comment.reply_count > 0 && (
          <button type="button" onClick={() => setExpanded(v => !v)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
            <MessageCircle className="h-3.5 w-3.5" />
            {comment.reply_count}
          </button>
        )}
      </div>

      {replyOpen && (
        <div className="mt-2 pl-12">
          <textarea
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t("comments.replyPlaceholder")}
            className="w-full resize-none rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm outline-none ring-accent focus:ring-1"
          />
          <div className="mt-1.5 flex justify-end">
            <button type="button" disabled={replyBody.trim().length === 0 || replyMut.isPending} onClick={() => replyMut.mutate()} className="rounded-xl bg-hero px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-glow-pink disabled:opacity-40">
              {replyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("comments.publish")}
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-2 space-y-2 border-l border-border pl-3 sm:pl-4">
          {repliesQ.isLoading ? (
            <p className="py-2 text-center text-xs text-muted-foreground animate-pulse">{t("comments.loading")}</p>
          ) : (
            replies.map(r => (
              <CommentBubble key={r.id} comment={r} viewerLang={viewerLang} onDelete={r.is_mine ? () => deleteMut.mutate(r.id) : undefined} />
            ))
          )}
        </div>
      )}
    </article>
  );
}

export function EpisodeCommentsSection({ type, tmdbId, season, episode }: { type: "tv" | "movie"; tmdbId: number; season: number; episode: number }) {
  const qc = useQueryClient();
  const { locale, t } = useI18n();
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [rating, setRating] = useState<number | "">("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const target = { season, episode };
  const queryKey = mediaCommentsKey(type, tmdbId, "all", target);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => commentsApi.list(type, tmdbId, "all", 0, target),
    enabled: tmdbId > 0,
    staleTime: 1000 * 60,
  });

  const createMut = useMutation({
    mutationFn: () => commentsApi.create(type, tmdbId, body.trim(), spoiler, {
      season, episode, rating: rating === "" ? undefined : rating, mediaUrl: mediaUrl ?? undefined,
    }),
    onSuccess: (res) => {
      setBody("");
      setSpoiler(false);
      setRating("");
      setMediaUrl(null);
      setShowEmoji(false);
      qc.setQueryData(queryKey, (prev: typeof data) =>
        prev ? { ...prev, comments: [res.comment, ...prev.comments], total: prev.total + 1 } : prev,
      );
      toast.success(t("comments.published"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const comments = data?.comments ?? [];
  const canSubmit = (body.trim().length > 0 || !!mediaUrl) && !createMut.isPending;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const res = await uploadCommentImage(f);
      setMediaUrl(res.url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
        <MessageCircle className="h-4 w-4 text-accent" />
        {t("comments.title")}
        {data && data.total > 0 ? (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold normal-case text-muted-foreground">{data.total}</span>
        ) : null}
      </h2>

      <div className="glass rounded-2xl p-3">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={t("comments.placeholder")}
          className="w-full resize-none rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm outline-none ring-accent focus:ring-1"
        />

        {mediaUrl && (
          <div className="relative mt-2 inline-block">
            <img src={mediaUrl} alt="" className="max-h-40 rounded-xl border border-border" />
            <button type="button" onClick={() => setMediaUrl(null)} aria-label={t("common.close")} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {showEmoji && (
          <div className="mt-2 flex flex-wrap gap-0.5 rounded-xl border border-border bg-surface-2 p-2">
            {EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setBody(b => b + e)} className="rounded-lg p-1 text-xl leading-none hover:bg-surface-1">{e}</button>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-1">
          <button type="button" onClick={() => setShowEmoji(v => !v)} aria-label={t("comments.emoji")} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-accent">
            <Smile className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShowGif(true)} className="grid h-8 place-items-center rounded-lg border border-border px-2 text-[11px] font-bold text-muted-foreground transition hover:text-accent">GIF</button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label={t("comments.addImage")} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-2 hover:text-accent disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleFile} />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} className="rounded border-border" />
              {t("comments.spoiler")}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5" />
              <select value={rating} onChange={e => setRating(e.target.value === "" ? "" : Number(e.target.value))} className="rounded-lg border border-border bg-surface/60 px-1.5 py-1 text-xs">
                <option value="">{t("comments.rating")}</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}/10</option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" disabled={!canSubmit} onClick={() => createMut.mutate()} className="rounded-xl bg-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow-pink disabled:opacity-40">
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("comments.publish")}
          </button>
        </div>
      </div>

      {showGif && <GifPicker onSelect={(u) => { setMediaUrl(u); setShowGif(false); }} onClose={() => setShowGif(false)} />}

      {isLoading && <p className="mt-4 text-center text-sm text-muted-foreground animate-pulse">{t("comments.loading")}</p>}
      {!isLoading && comments.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-surface/30 p-4 text-center text-sm text-muted-foreground">{t("comments.emptyAll")}</p>
      )}

      <div className="mt-3 space-y-2">
        {comments.map(c => (
          <ThreadComment key={c.id} comment={c} viewerLang={locale} type={type} tmdbId={tmdbId} />
        ))}
      </div>
    </section>
  );
}
