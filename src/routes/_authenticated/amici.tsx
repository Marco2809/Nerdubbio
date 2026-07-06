import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/nerdubbio/AppShell';
import { ArrowLeft, Check, Loader2, Search, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import {
  SOCIAL_FRIENDS_KEY,
  socialApi,
  type FriendsData,
  type PublicUser,
} from '@/lib/php/social-client';
import { useI18n, pageTitle } from '@/lib/i18n';

export const Route = createFileRoute('/_authenticated/amici')({
  head: () => ({ meta: [{ title: pageTitle('friends') }] }),
  component: AmiciPage,
});

function AmiciPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PublicUser[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: SOCIAL_FRIENDS_KEY,
    queryFn: () => socialApi.friends(),
  });

  const mutateFriends = useMutation({
    mutationFn: async (fn: () => Promise<FriendsData>) => fn(),
    onSuccess: (next) => {
      qc.setQueryData(SOCIAL_FRIENDS_KEY, next);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await socialApi.search(query.trim());
      setResults(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('friends.searchError'));
    } finally {
      setSearching(false);
    }
  }

  return (
    <AppShell title={t('account.friends')} subtitle={t('friends.subtitle')}>
      <Link
        to="/profile"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> {t('friends.backProfile')}
      </Link>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('friends.searchPlaceholder')}
            className="w-full rounded-2xl border border-border bg-surface/60 py-3 pl-10 pr-4 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="rounded-2xl bg-hero px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : t('friends.searchBtn')}
        </button>
      </form>

      {results.length > 0 && (
        <section className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('friends.results')}</p>
          {results.map((u) => (
            <UserRow
              key={u.id ?? u.handle}
              user={u}
              action={
                <button
                  type="button"
                  disabled={mutateFriends.isPending}
                  onClick={() =>
                    mutateFriends.mutate(() => socialApi.friendRequest(u.handle.replace(/^@/, '')))
                  }
                  className="flex items-center gap-1 rounded-xl bg-hero px-3 py-1.5 text-xs font-bold text-primary-foreground"
                >
                  <UserPlus className="h-3 w-3" /> {t('friends.add')}
                </button>
              }
            />
          ))}
        </section>
      )}

      {isLoading && (
        <p className="mt-8 text-center text-sm text-muted-foreground animate-pulse">{t('common.loading')}</p>
      )}

      {data && (
        <div className="mt-6 space-y-6">
          {data.incoming.length > 0 && (
            <section>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                {t('friends.incoming')}
              </p>
              <div className="space-y-2">
                {data.incoming.map((u) => (
                  <UserRow
                    key={u.requester_id ?? u.handle}
                    user={u}
                    action={
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={mutateFriends.isPending}
                          onClick={() =>
                            mutateFriends.mutate(() =>
                              socialApi.friendRespond(u.requester_id!, true),
                            )
                          }
                          className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600/20 text-emerald-400"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={mutateFriends.isPending}
                          onClick={() =>
                            mutateFriends.mutate(() =>
                              socialApi.friendRespond(u.requester_id!, false),
                            )
                          }
                          className="grid h-8 w-8 place-items-center rounded-xl bg-destructive/20 text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              {t('friends.yourFriends', { count: data.friends.length })}
            </p>
            {data.friends.length === 0 ? (
              <p className="glass rounded-2xl p-4 text-sm text-muted-foreground">
                {t('friends.noFriends')}
              </p>
            ) : (
              <div className="space-y-2">
                {data.friends.map((u) => (
                  <UserRow
                    key={u.id ?? u.handle}
                    user={u}
                    linkToProfile
                    action={
                      <button
                        type="button"
                        disabled={mutateFriends.isPending}
                        onClick={() =>
                          mutateFriends.mutate(() => socialApi.friendRemove(u.id!))
                        }
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        {t('friends.remove')}
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {data.outgoing.length > 0 && (
            <section>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t('friends.pending')}</p>
              <div className="space-y-2">
                {data.outgoing.map((u) => (
                  <UserRow key={u.target_id ?? u.handle} user={u} badge={t('friends.pending')} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function UserRow({
  user,
  action,
  linkToProfile,
  badge,
}: {
  user: PublicUser;
  action?: React.ReactNode;
  linkToProfile?: boolean;
  badge?: string;
}) {
  const avatar = user.avatar_url ? (
    <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
  ) : (
    <div className="grid h-10 w-10 place-items-center rounded-full bg-hero text-sm font-bold text-primary-foreground">
      {(user.display_name || user.handle).charAt(0).toUpperCase()}
    </div>
  );

  const text = (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold">{user.display_name || user.handle}</p>
      <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>
    </div>
  );

  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3">
      {linkToProfile ? (
        <Link to="/u/$handle" params={{ handle: user.handle }} className="flex min-w-0 flex-1 items-center gap-3">
          {avatar}
          {text}
        </Link>
      ) : (
        <>
          {avatar}
          {text}
        </>
      )}
      {badge && (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
          {badge}
        </span>
      )}
      {action}
    </div>
  );
}
