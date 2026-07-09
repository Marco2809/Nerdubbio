import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { recommendApi, RECO_SENT_KEY } from "@/lib/php/recommend-client";

export function SentRecommendationsNotice() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: RECO_SENT_KEY,
    queryFn: () => recommendApi.sentFeedback(),
    staleTime: 1000 * 60,
  });
  const items = q.data?.feedback ?? [];
  if (items.length === 0) return null;

  const ack = async (id?: string) => {
    try {
      const res = await recommendApi.sentAck(id);
      qc.setQueryData(RECO_SENT_KEY, res);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section className="mt-4 space-y-2">
      {items.map((f) => {
        const name = f.to.display_name || `@${f.to.handle}`;
        return (
          <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Check className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug">
              {t("recommend.friendAdded", { name, title: f.media.title })}
            </p>
            <button
              onClick={() => void ack(f.id)}
              aria-label={t("common.close")}
              className="shrink-0 rounded-full p-1 text-muted-foreground active:bg-surface-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </section>
  );
}
