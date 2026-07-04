import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import {
  commentsApi,
  mediaCommentsKey,
  type CommentScope,
  type MediaComment,
} from "@/lib/php/comments-client";

const STATUS_LABEL: Record<string, string> = {
  plan_to_watch: "Da vedere",
  watching: "In corso",
  paused: "In pausa",
  completed: "Visto",
  dropped: "Abbandonato",
  favorite: "Preferito",
};

type Props = {
  mediaType: "tv" | "movie";
  tmdbId: number;
};

export function MediaCommentsSection({ mediaType, tmdbId }: Props) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<CommentScope>("all");
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [extra, setExtra] = useState<MediaComment[]>([]);

  const queryKey = mediaCommentsKey(mediaType, tmdbId, scope);

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => commentsApi.list(mediaType, tmdbId, scope, 0),
    enabled: tmdbId > 0,
    staleTime: 1000 * 60 * 2,
  });

  const createMut = useMutation({
    mutationFn: () => commentsApi.create(mediaType, tmdbId, body.trim(), spoiler),
    onSuccess: (res) => {
      setBody("");
      setSpoiler(false);
      qc.setQueryData(queryKey, (prev: typeof data) => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: [res.comment, ...prev.comments],
          total: prev.total + 1,
        };
      });
      setExtra([]);
      toast.success("Commento pubblicato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commentsApi.delete(id),
    onSuccess: (_r, id) => {
      qc.setQueryData(queryKey, (prev: typeof data) => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: prev.comments.filter(c => c.id !== id),
          total: Math.max(0, prev.total - 1),
        };
      });
      setExtra(prev => prev.filter(c => c.id !== id));
      toast.success("Commento eliminato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadMoreMut = useMutation({
    mutationFn: () => {
      const nextOffset = (data?.comments.length ?? 0) + extra.length;
      return commentsApi.list(mediaType, tmdbId, scope, nextOffset);
    },
    onSuccess: (res) => {
      setExtra(prev => [...prev, ...res.comments]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function switchScope(next: CommentScope) {
    if (next === scope) return;
    setScope(next);
    setExtra([]);
  }

  const comments = [...(data?.comments ?? []), ...extra];
  const hasMore = data ? data.has_more || comments.length < data.total : false;
  const canSubmit = body.trim().length > 0 && !createMut.isPending;

  if (tmdbId <= 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <MessageCircle className="h-4 w-4 text-accent" />
          Commenti
          {data && data.total > 0 ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold normal-case text-muted-foreground">
              {data.total}
            </span>
          ) : null}
        </h2>
        <div className="flex rounded-xl border border-border bg-surface/40 p-0.5 text-[11px]">
          {(["all", "friends"] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => switchScope(s)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                scope === s ? "bg-hero text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "Tutti" : "Amici"}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-3">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Cosa ne pensi? Condividi la tua opinione…"
          className="w-full resize-none rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm outline-none ring-accent focus:ring-1"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={spoiler}
              onChange={e => setSpoiler(e.target.checked)}
              className="rounded border-border"
            />
            Contiene spoiler
          </label>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => createMut.mutate()}
            className="rounded-xl bg-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow-pink disabled:opacity-40"
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pubblica"}
          </button>
        </div>
      </div>

      {isLoading && (
        <p className="mt-4 text-center text-sm text-muted-foreground animate-pulse">Caricamento commenti…</p>
      )}

      {!isLoading && comments.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-surface/30 p-4 text-center text-sm text-muted-foreground">
          {scope === "friends"
            ? "Nessun commento dagli amici. Sii il primo!"
            : "Nessun commento ancora. Sii il primo a scrivere qualcosa!"}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {comments.map(c => (
          <CommentCard
            key={c.id}
            comment={c}
            onDelete={() => deleteMut.mutate(c.id)}
            deleting={deleteMut.isPending}
          />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          disabled={loadMoreMut.isPending || isFetching}
          onClick={() => loadMoreMut.mutate()}
          className="mt-3 w-full rounded-xl border border-border bg-surface/60 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-foreground disabled:opacity-50"
        >
          {loadMoreMut.isPending ? "Caricamento…" : "Carica altri commenti"}
        </button>
      )}
    </section>
  );
}

function CommentCard({
  comment,
  onDelete,
  deleting,
}: {
  comment: MediaComment;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [revealed, setRevealed] = useState(!comment.spoiler);
  const when = formatWhen(comment.created_at);
  const statusLabel = comment.author_status ? STATUS_LABEL[comment.author_status] : null;

  return (
    <article className="glass rounded-2xl p-3">
      <div className="flex items-start gap-3">
        <Link to="/u/$handle" params={{ handle: comment.author.handle }} className="shrink-0">
          {comment.author.avatar_url ? (
            <img
              src={comment.author.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-hero text-xs font-bold text-primary-foreground">
              {(comment.author.display_name || comment.author.handle).charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              to="/u/$handle"
              params={{ handle: comment.author.handle }}
              className="truncate text-sm font-semibold hover:text-accent"
            >
              {comment.author.display_name || comment.author.handle}
            </Link>
            <span className="text-[11px] text-muted-foreground">@{comment.author.handle}</span>
            {statusLabel && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                {statusLabel}
              </span>
            )}
            {comment.author_rating != null && (
              <span className="text-[10px] font-semibold text-accent">{comment.author_rating}/10</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{when}</p>
          {comment.spoiler && !revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200"
            >
              ⚠ Spoiler — tocca per rivelare
            </button>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
          )}
        </div>
        {comment.is_mine && (
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            aria-label="Elimina commento"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Adesso";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} g fa`;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
