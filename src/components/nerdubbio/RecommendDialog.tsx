import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Share2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { recommendApi, type RecoFriend } from "@/lib/php/recommend-client";

export function RecommendDialog({
  mediaKey,
  mediaType,
  title,
  posterUrl,
  year,
}: {
  mediaKey: string;
  mediaType?: "tv" | "movie";
  title: string;
  posterUrl?: string | null;
  year?: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const q = useQuery({
    queryKey: ["reco-friends", mediaKey],
    queryFn: () => recommendApi.friendsFor(mediaKey),
    enabled: open,
    staleTime: 30_000,
  });
  const friends = q.data?.friends ?? [];

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const send = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const res = await recommendApi.send({
        mediaKey,
        mediaType,
        title,
        posterUrl,
        year,
        friendIds: [...selected],
        message: message.trim() || undefined,
      });
      toast.success(t("recommend.sent", { n: res.sent }));
      setOpen(false);
      setSelected(new Set());
      setMessage("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const stateLabel = (f: RecoFriend) =>
    f.state === "seen"
      ? t("recommend.stateSeen")
      : f.alreadySent
        ? t("recommend.stateSent")
        : f.state === "listed"
          ? t("recommend.stateListed")
          : `@${f.handle}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition active:bg-surface-1">
          <Share2 className="h-4 w-4" />
          {t("recommend.action")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("recommend.title")}</DialogTitle>
        </DialogHeader>

        {q.isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : friends.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("recommend.noFriends")}</p>
        ) : (
          <div className="max-h-[42vh] space-y-0.5 overflow-y-auto">
            {friends.map((f) => {
              const seen = f.state === "seen";
              const name = f.display_name || `@${f.handle}`;
              return (
                <label
                  key={f.id}
                  className={`flex items-center gap-3 rounded-xl px-2 py-2 ${seen ? "opacity-50" : "cursor-pointer active:bg-surface-1"}`}
                >
                  <Checkbox
                    checked={selected.has(f.id)}
                    disabled={seen}
                    onCheckedChange={() => !seen && toggle(f.id)}
                  />
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-1 text-xs font-bold text-muted-foreground">
                    {f.avatar_url ? (
                      <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{stateLabel(f)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {friends.length > 0 && (
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={t("recommend.messagePlaceholder")}
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        )}

        <DialogFooter>
          <button
            onClick={send}
            disabled={selected.size === 0 || sending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hero px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow-pink transition active:scale-[.98] disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {t("recommend.send")}
            {selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
