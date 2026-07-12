import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { useUserStore, type UserStatus, type UserMediaEntry } from "@/lib/user-store";
import { useState, useMemo } from "react";
import { ArrowDownUp } from "lucide-react";
import { useReturnPath } from "@/lib/media-nav";
import { useI18n, pageTitle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({ meta: [{ title: pageTitle("watchlist") }] }),
  component: WatchlistPage,
});

type SortKey = "recent" | "added" | "title" | "mine";

type Card = {
  entry: UserMediaEntry;
  type: "movie" | "tv";
  tmdbId: string;
  title: string;
};

function toCard(e: UserMediaEntry): Card | null {
  const m = /^(movie|tv)-(\d+)$/.exec(e.id);
  if (!m) return null;
  return {
    entry: e,
    type: m[1] as "movie" | "tv",
    tmdbId: m[2]!,
    title: e.title || "?",
  };
}

function WatchlistPage() {
  const { t } = useI18n();
  const statusLabel = (s: string) => {
    const key = `status.${s}`;
    const label = t(key);
    return label === key ? s : label;
  };
  const { state } = useUserStore();
  const from = useReturnPath();
  const [tab, setTab] = useState<UserStatus | "all" | "favorite">("plan_to_watch");
  const [sort, setSort] = useState<SortKey>("recent");

  const tabs: { s: UserStatus | "all" | "favorite"; label: string }[] = useMemo(
    () => [
      { s: "plan_to_watch", label: statusLabel("plan_to_watch") },
      { s: "watching", label: statusLabel("watching") },
      { s: "all", label: t("watchlist.tabAll") },
      { s: "completed", label: statusLabel("completed") },
      { s: "favorite", label: statusLabel("favorite") },
      { s: "paused", label: t("watchlist.tabCourage") },
      { s: "dropped", label: statusLabel("dropped") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const sorts: { k: SortKey; label: string }[] = useMemo(
    () => [
      { k: "recent", label: t("watchlist.sortRecent") },
      { k: "added", label: t("watchlist.sortAdded") },
      { k: "title", label: t("watchlist.sortTitle") },
      { k: "mine", label: t("watchlist.sortMine") },
    ],
    [t],
  );

  const list = useMemo(() => {
    const arr = Object.values(state.media)
      .filter((m) => tab === "all" || (tab === "favorite" ? !!m.favorite : m.status === tab))
      .map(toCard)
      .filter((c): c is Card => !!c);
    const cmp = (a: Card, b: Card) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "mine":
          return (b.entry.rating ?? 0) - (a.entry.rating ?? 0);
        case "added":
          return (b.entry.addedAt ?? "").localeCompare(a.entry.addedAt ?? "");
        case "recent":
        default:
          return (b.entry.lastWatchedAt ?? b.entry.updatedAt ?? b.entry.addedAt ?? "").localeCompare(
            a.entry.lastWatchedAt ?? a.entry.updatedAt ?? a.entry.addedAt ?? "",
          );
      }
    };
    return arr.sort(cmp);
  }, [state.media, tab, sort]);

  return (
    <AppShell subtitle={t("watchlist.subtitle")} title={t("watchlist.title")}>
      <div className="-mx-4 overflow-x-auto">
        <div className="flex gap-2 px-4 pb-2">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.s}
              onClick={() => setTab(tabItem.s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                tab === tabItem.s ? "bg-hero text-primary-foreground shadow-glow" : "bg-surface-2 text-muted-foreground"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="glass rounded-full bg-transparent px-3 py-1 text-xs font-semibold outline-none"
        >
          {sorts.map((s) => (
            <option key={s.k} value={s.k} className="bg-background">
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">· {t("watchlist.titlesCount", { count: list.length })}</span>
      </div>

      {list.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-4xl">🍿</p>
          <p className="mt-3 text-sm text-muted-foreground">{t("watchlist.empty")}</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {list.map(({ entry, type, tmdbId, title }) => (
            <Link
              key={entry.id}
              to="/media/$type/$id"
              params={{ type, id: tmdbId }}
              state={{ from }}
              className="relative block"
            >
              <div className="relative h-52 overflow-hidden rounded-2xl bg-surface-2 shadow-glow">
                {entry.posterUrl ? (
                  <img src={entry.posterUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/40 to-accent/40 p-3 text-center text-sm font-bold">
                    {title}
                  </div>
                )}
                {entry.rating != null && (
                  <span className="absolute left-2 top-2 rounded-full bg-hero px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow-pink">
                    {entry.rating}/10
                  </span>
                )}
                {entry.source === "tvtime" && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/80">
                    {t("watchlist.fromTvTime")}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs font-semibold">{title}</p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
