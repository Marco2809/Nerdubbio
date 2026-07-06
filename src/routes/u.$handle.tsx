import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Flame, Star, User } from "lucide-react";
import { Wordmark } from "@/components/nerdubbio/Wordmark";
import { socialApi } from "@/lib/php/social-client";
import { useAuthUser } from "@/hooks/use-auth-user";
import { I18nProvider, normalizeLocale, useI18n } from "@/lib/i18n";
import { useUserStore } from "@/lib/user-store";

export const Route = createFileRoute("/u/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} — Nerdubbio` },
      { name: "description", content: `Profilo pubblico @${params.handle} su Nerdubbio` },
    ],
  }),
  component: PublicProfilePageWrapper,
});

function PublicProfilePageWrapper() {
  const { state } = useUserStore();
  const [locale, setLocale] = useState(() => normalizeLocale(state.language));

  useEffect(() => {
    if (state.language) {
      setLocale(normalizeLocale(state.language));
      return;
    }
    if (typeof navigator !== "undefined") {
      setLocale(normalizeLocale(navigator.language.slice(0, 2)));
    }
  }, [state.language]);

  return (
    <I18nProvider locale={locale}>
      <PublicProfilePage />
    </I18nProvider>
  );
}

function PublicProfilePage() {
  const { t } = useI18n();
  const { handle } = Route.useParams();
  const { profile: me } = useAuthUser();
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: () => socialApi.publicProfile(handle),
  });

  const isMe = me?.handle === handle;

  return (
    <div className="min-h-screen pb-10">
      <div className="mx-auto max-w-md px-4 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowLeft className="h-3 w-3" /> Nerdubbio
          </Link>
          <Wordmark className="h-5 w-auto opacity-80" />
        </div>

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground animate-pulse">{t("publicProfile.loading")}</p>
        )}

        {error && (
          <div className="glass rounded-3xl p-6 text-center">
            <p className="font-semibold">{t("publicProfile.notFound")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("publicProfile.notFoundHint", { handle })}</p>
          </div>
        )}

        {data && (
          <>
            <div className="glass rounded-3xl p-5">
              <div className="flex items-center gap-4">
                {data.avatar_url ? (
                  <img
                    src={data.avatar_url}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-hero/40"
                  />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-hero text-2xl font-black text-primary-foreground">
                    {(data.display_name || data.handle).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{data.display_name || data.handle}</p>
                  <p className="text-sm text-muted-foreground">@{data.handle}</p>
                  {data.bio && <p className="mt-2 text-sm text-muted-foreground">{data.bio}</p>}
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-center text-sm">
                <div className="flex-1">
                  <p className="font-bold">{data.level}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">{t("publicProfile.level")}</p>
                </div>
                <div className="flex-1">
                  <p className="flex items-center justify-center gap-1 font-bold">
                    <Flame className="h-4 w-4 text-orange-400" /> {data.streak}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground">{t("publicProfile.streak")}</p>
                </div>
                <div className="flex-1">
                  <p className="font-bold">{data.xp}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">XP</p>
                </div>
              </div>
            </div>

            {isMe && (
              <Link
                to="/profile"
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold"
              >
                <User className="h-4 w-4" /> {t("publicProfile.editProfile")}
              </Link>
            )}

            {data.watching.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">{t("publicProfile.watching")}</h2>
                <MediaGrid items={data.watching} />
              </section>
            )}

            {data.topRated.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                  <Star className="h-4 w-4 text-accent" /> {t("publicProfile.topRated")}
                </h2>
                <MediaGrid items={data.topRated} showRating />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MediaGrid({
  items,
  showRating,
}: {
  items: { id: string; title?: string | null; posterUrl?: string | null; rating?: number | null; type?: string | null }[];
  showRating?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => {
        const type = item.type ?? (item.id.startsWith("movie-") ? "movie" : "tv");
        return (
          <Link
            key={item.id}
            to="/media/$type/$id"
            params={{ type, id: item.id }}
            className="glass overflow-hidden rounded-2xl"
          >
            {item.posterUrl ? (
              <img src={item.posterUrl} alt="" className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[2/3] place-items-center bg-surface-2 text-[10px] text-muted-foreground">
                {item.title ?? "N/A"}
              </div>
            )}
            {showRating && item.rating != null && (
              <p className="px-2 py-1 text-center text-xs font-bold text-accent">{item.rating}/10</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
