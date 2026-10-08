import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { groupVoteKey, nerdacoloApi, voteLeader, type GroupVote } from "@/lib/php/nerdacolo-client";
import { useI18n, pageTitle } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { Crown, Loader2, Share2, ThumbsDown, ThumbsUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/voto/$id")({
  head: () => ({ meta: [{ title: pageTitle("gruppo") }] }),
  component: GroupVotePage,
});

function GroupVotePage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();

  // Aggiornamento in diretta: ogni 4s finché la votazione è aperta.
  const q = useQuery({
    queryKey: groupVoteKey(id),
    queryFn: () => nerdacoloApi.getVote(id),
    refetchInterval: (query) => (query.state.data?.expired ? false : 4000),
    staleTime: 0,
  });

  const cast = useMutation({
    mutationFn: ({ key, vote }: { key: string; vote: 1 | -1 | 0 }) => nerdacoloApi.castVote(id, key, vote),
    // Ottimistico: il voto si vede subito, poi il server conferma.
    onMutate: async ({ key, vote }) => {
      await qc.cancelQueries({ queryKey: groupVoteKey(id) });
      const prev = qc.getQueryData<GroupVote>(groupVoteKey(id));
      if (prev) {
        const before = prev.myVotes[key];
        const tally = { ...prev.tally, [key]: { ...(prev.tally[key] ?? { yes: 0, no: 0 }) } };
        if (before === 1) tally[key]!.yes--;
        if (before === -1) tally[key]!.no--;
        if (vote === 1) tally[key]!.yes++;
        if (vote === -1) tally[key]!.no++;
        const myVotes = { ...prev.myVotes };
        if (vote === 0) delete myVotes[key];
        else myVotes[key] = vote;
        qc.setQueryData(groupVoteKey(id), { ...prev, tally, myVotes });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(groupVoteKey(id), ctx.prev);
      toast.error(t("vote.castError"));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: groupVoteKey(id) }),
  });

  const share = async () => {
    const url = `${window.location.origin}/voto/${id}`;
    const text = t("vote.shareText");
    try {
      if (navigator.share) await navigator.share({ title: "Nerdubbio", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success(t("vote.linkCopied"));
      }
    } catch {
      /* condivisione annullata */
    }
  };

  if (q.isLoading) {
    return (
      <AppShell title={t("vote.title")}>
        <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      </AppShell>
    );
  }
  if (q.error || !q.data) {
    return (
      <AppShell title={t("vote.title")}>
        <p className="glass rounded-2xl p-4 text-sm text-muted-foreground">{t("vote.loadError")}</p>
      </AppShell>
    );
  }

  const v = q.data;
  const leader = voteLeader(v);

  return (
    <AppShell
      title={t("vote.title")}
      subtitle={t("vote.subtitle", { name: v.createdBy, group: v.groupName })}
      right={
        <button type="button" onClick={() => void share()} aria-label={t("vote.share")}
          className="grid h-9 w-9 place-items-center rounded-full bg-hero text-primary-foreground shadow-glow">
          <Share2 className="h-4 w-4" />
        </button>
      }
    >
      <div className="glass mb-4 rounded-2xl p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
          {v.expired ? t("vote.winner") : t("vote.leading")}
        </p>
        {leader ? (
          <Link to="/media/$type/$id" params={{ type: leader.mediaType, id: String(leader.tmdbId) }}
            className="mt-1 flex items-center gap-2 text-base font-extrabold hover:text-accent">
            <Crown className="h-4 w-4 text-amber-300" /> {leader.title}
          </Link>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t("vote.noVotesYet")}</p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("vote.votedCount", { n: v.voterCount, m: v.memberCount })}
          {v.expired ? ` · ${t("vote.expired")}` : ""}
        </p>
      </div>

      <div className="space-y-2">
        {v.candidates.map((c) => {
          const tally = v.tally[c.mediaKey] ?? { yes: 0, no: 0 };
          const mine = v.myVotes[c.mediaKey];
          const isLeader = leader?.mediaKey === c.mediaKey;
          return (
            <div key={c.mediaKey}
              className={`glass flex items-center gap-3 rounded-2xl p-2.5 ${isLeader ? "ring-2 ring-accent" : ""}`}>
              <Link to="/media/$type/$id" params={{ type: c.mediaType, id: String(c.tmdbId) }}
                className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                {c.posterPath && <img src={c.posterPath} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {c.mediaType === "tv" ? t("home.seriesShort") : t("home.movieShort")}
                  {c.releaseYear ? ` · ${c.releaseYear}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">👍 {tally.yes} · 👎 {tally.no}</p>
              </div>
              {!v.expired && (
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" aria-pressed={mine === 1} aria-label="👍"
                    onClick={() => cast.mutate({ key: c.mediaKey, vote: mine === 1 ? 0 : 1 })}
                    className={`grid h-10 w-10 place-items-center rounded-full transition active:scale-90 ${
                      mine === 1 ? "bg-emerald-500 text-white" : "bg-surface-2 text-muted-foreground"}`}>
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button type="button" aria-pressed={mine === -1} aria-label="👎"
                    onClick={() => cast.mutate({ key: c.mediaKey, vote: mine === -1 ? 0 : -1 })}
                    className={`grid h-10 w-10 place-items-center rounded-full transition active:scale-90 ${
                      mine === -1 ? "bg-destructive text-white" : "bg-surface-2 text-muted-foreground"}`}>
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
