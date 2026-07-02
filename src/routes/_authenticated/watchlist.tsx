import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { MediaCard } from "@/components/nerdubbio/MediaCard";
import { useUserStore, type UserStatus, type UserMediaEntry } from "@/lib/user-store";
import { findById, type CatalogItem } from "@/lib/mock-catalog";
import { useState, useMemo } from "react";
import { ArrowDownUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({ meta: [{ title: "Watchlist — Nerdubbio" }] }),
  component: WatchlistPage,
});

const TABS: { s: UserStatus | "all"; label: string }[] = [
  { s: "all", label: "Tutto" },
  { s: "plan_to_watch", label: "Da vedere" },
  { s: "watching", label: "In corso" },
  { s: "completed", label: "Visto" },
  { s: "favorite", label: "Preferiti" },
  { s: "paused", label: "Coraggio" },
  { s: "dropped", label: "Abbandonato" },
];

type SortKey = "recent" | "added" | "title" | "rating" | "mine";
const SORTS: { k: SortKey; label: string }[] = [
  { k: "recent", label: "Attività recente" },
  { k: "added", label: "Aggiunto di recente" },
  { k: "title", label: "Titolo A→Z" },
  { k: "rating", label: "Rating TMDB" },
  { k: "mine", label: "Il mio voto" },
];

function WatchlistPage() {
  const { state } = useUserStore();
  const [tab, setTab] = useState<UserStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const list = useMemo(() => {
    const arr = Object.values(state.media)
      .filter(m => tab === "all" || m.status === tab)
      .map(m => ({ entry: m, item: findById(m.id) }))
      .filter((x): x is { entry: UserMediaEntry; item: CatalogItem } => !!x.item);
    const cmp = (a: typeof arr[number], b: typeof arr[number]) => {
      switch (sort) {
        case "title": return a.item.title.localeCompare(b.item.title);
        case "rating": return b.item.rating - a.item.rating;
        case "mine": return (b.entry.rating ?? 0) - (a.entry.rating ?? 0);
        case "added": return (b.entry.addedAt ?? "").localeCompare(a.entry.addedAt ?? "");
        case "recent":
        default:
          return (b.entry.lastWatchedAt ?? b.entry.addedAt ?? "").localeCompare(a.entry.lastWatchedAt ?? a.entry.addedAt ?? "");
      }
    };
    return arr.sort(cmp);
  }, [state.media, tab, sort]);

  return (
    <AppShell subtitle="La tua pila" title="Watchlist">
      <div className="-mx-4 overflow-x-auto">
        <div className="flex gap-2 px-4 pb-2">
          {TABS.map(t => (
            <button key={t.s} onClick={() => setTab(t.s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab===t.s ? "bg-hero text-primary-foreground shadow-glow" : "bg-surface-2 text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
          className="glass rounded-full bg-transparent px-3 py-1 text-xs font-semibold outline-none">
          {SORTS.map(s => <option key={s.k} value={s.k} className="bg-background">{s.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">· {list.length} titoli</span>
      </div>

      {list.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-4xl">🍿</p>
          <p className="mt-3 text-sm text-muted-foreground">La pila dell'imbarazzo è vuota. Per ora.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {list.map(({ entry, item }) => (
            <div key={item.id} className="relative">
              <MediaCard item={item} />
              {entry.rating != null && (
                <span className="absolute left-2 top-2 rounded-full bg-hero px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow-pink">
                  {entry.rating}/10
                </span>
              )}
              {entry.source === "tvtime" && (
                <span className="absolute bottom-14 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/80">
                  da TV Time
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
