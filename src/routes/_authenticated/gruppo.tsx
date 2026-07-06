import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { Users, Plus, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { SOCIAL_GROUPS_KEY, socialApi, type Group } from "@/lib/php/social-client";
import { useI18n, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/gruppo")({
  head: () => ({ meta: [{ title: pageTitle("gruppo") }] }),
  component: Gruppo,
});

function Gruppo() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [inviteHandle, setInviteHandle] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: SOCIAL_GROUPS_KEY,
    queryFn: () => socialApi.groups(),
  });

  const groups = data?.groups ?? [];
  const active = groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;

  const mutateGroups = useMutation({
    mutationFn: async (fn: () => Promise<{ groups: Group[] }>) => fn(),
    onSuccess: (res) => {
      qc.setQueryData(SOCIAL_GROUPS_KEY, res);
      if (!activeGroupId && res.groups[0]) setActiveGroupId(res.groups[0].id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    mutateGroups.mutate(() => socialApi.groupCreate(newName.trim()));
    setNewName("");
  }

  function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !inviteHandle.trim()) return;
    mutateGroups.mutate(() =>
      socialApi.groupAddMember(active.id, inviteHandle.trim().replace(/^@/, "")),
    );
    setInviteHandle("");
    toast.success(t("gruppo.inviteSent"));
  }

  return (
    <AppShell>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> {t("gruppo.back")}
      </Link>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-hero text-primary-foreground shadow-glow-pink">
          <Users className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">{t("gruppo.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("gruppo.subtitle")}</p>
        </div>
      </div>

      <form onSubmit={createGroup} className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("gruppo.namePlaceholder")}
          className="flex-1 rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={mutateGroups.isPending}
          className="rounded-2xl bg-hero px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>

      {isLoading && (
        <p className="mt-6 text-center text-sm text-muted-foreground animate-pulse">{t("gruppo.loading")}</p>
      )}

      {groups.length > 0 && (
        <section className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("gruppo.yourGroups")}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroupId(g.id)}
                className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold ${
                  active?.id === g.id ? "bg-hero text-primary-foreground" : "glass text-muted-foreground"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {active && (
        <>
          <section className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t("gruppo.members")}</p>
            <div className="grid grid-cols-2 gap-2">
              {active.members.map((m) => (
                <div key={m.id} className="glass flex items-center gap-2 rounded-2xl p-3">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-hero text-xs font-bold text-primary-foreground">
                      {(m.display_name || m.handle).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{m.display_name || m.handle}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {m.role === "owner" ? t("gruppo.admin") : `@${m.handle}`}
                    </p>
                  </div>
                  {active.is_owner && m.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() =>
                        mutateGroups.mutate(() => socialApi.groupRemoveMember(active.id, m.id!))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={inviteMember} className="mt-4 flex gap-2">
            <input
              value={inviteHandle}
              onChange={(e) => setInviteHandle(e.target.value)}
              placeholder={t("gruppo.invitePlaceholder")}
              className="flex-1 rounded-2xl border border-border bg-surface/60 px-4 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={mutateGroups.isPending}
              className="rounded-2xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {t("gruppo.invite")}
            </button>
          </form>

          <div className="mt-6 rounded-3xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{t("gruppo.comingTitle")}</p>
            <p className="mt-1">{t("gruppo.comingHint")}</p>
          </div>

          {active.is_owner && (
            <button
              type="button"
              disabled={mutateGroups.isPending}
              onClick={() => mutateGroups.mutate(() => socialApi.groupDelete(active.id))}
              className="mt-4 w-full rounded-2xl py-2 text-sm text-destructive"
            >
              {t("gruppo.deleteGroup")}
            </button>
          )}
        </>
      )}

      {!isLoading && groups.length === 0 && (
        <p className="mt-6 glass rounded-2xl p-4 text-sm text-muted-foreground">
          {t("gruppo.empty")}{" "}
          <Link to="/amici" className="text-accent underline">{t("gruppo.friendsLink")}</Link>
        </p>
      )}

      {mutateGroups.isPending && (
        <div className="fixed inset-x-0 bottom-24 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      )}
    </AppShell>
  );
}
