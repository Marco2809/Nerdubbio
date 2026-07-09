import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { useUserStore } from "@/lib/user-store";
import { recommendApi, RECO_RECEIVED_KEY, type RecoReceived } from "@/lib/php/recommend-client";

function paramsFor(key: string): { type: "movie" | "tv"; id: string } {
  const m = /^(movie|tv)-(\d+)$/.exec(key);
  if (m) return { type: m[1] as "movie" | "tv", id: m[2]! };
  return { type: key.startsWith("movie-") ? "movie" : "tv", id: key };
}

export function FriendRecommendationsSection({ from }: { from: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { addToList } = useUserStore();

  const q = useQuery({
    queryKey: RECO_RECEIVED_KEY,
    queryFn: () => recommendApi.received(),
    staleTime: 1000 * 60,
  });
  const items = q.data?.received ?? [];
  if (items.length === 0) return null;

  const restore = async (id: string) => {
    try {
      const res = await recommendApi.act(id, "restore");
      qc.setQueryData(RECO_RECEIVED_KEY, res);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const act = async (r: RecoReceived, action: "add" | "dismiss") => {
    if (action === "add") {
      addToList(r.media.key, "plan_to_watch", {
        title: r.media.title,
        type: r.media.type ?? undefined,
        year: r.media.year ?? undefined,
        posterUrl: r.media.posterUrl,
        backdropUrl: null,
      });
      toast.success(t("recommend.added", { title: r.media.title }));
    }
    try {
      const res = await recommendApi.act(r.id, action);
      qc.setQueryData(RECO_RECEIVED_KEY, res);
      if (action === "dismiss") {
        toast(t("recommend.ignored"), {
          action: { label: t("recommend.undo"), onClick: () => void restore(r.id) },
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider">{t("recommend.homeTitle")}</h2>
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-hero px-1.5 text-[11px] font-bold text-primary-foreground">
          {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((r) => {
          const name = r.from.display_name || `@${r.from.handle}`;
          return (
            <div key={r.id} className="flex gap-3 rounded-2xl border border-border bg-surface-2 p-2.5">
              <Link
                to="/media/$type/$id"
                params={paramsFor(r.media.key)}
                state={{ from }}
                className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-1"
              >
                {r.media.posterUrl ? (
                  <img src={r.media.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </Link>

              <div className="min-w-0 flex-1">
                <Link to="/media/$type/$id" params={paramsFor(r.media.key)} state={{ from }} className="block">
                  <p className="truncate text-sm font-bold">{r.media.title}</p>
                </Link>
                <p className="truncate text-[11px] text-muted-foreground">{t("recommend.by", { name })}</p>
                {r.message ? (
                  <p className="mt-0.5 line-clamp-2 text-xs italic text-foreground/80">«{r.message}»</p>
                ) : null}

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => act(r, "add")}
                    className="flex items-center gap-1 rounded-full bg-hero px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow-pink active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("recommend.add")}
                  </button>
                  <button
                    onClick={() => act(r, "dismiss")}
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground active:bg-surface-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("recommend.ignore")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
