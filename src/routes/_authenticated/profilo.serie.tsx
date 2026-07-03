import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { LibraryGrid } from "@/components/nerdubbio/LibraryGrid";
import { StatusTabs } from "@/components/nerdubbio/StatusTabs";
import {
  countSeriesTab,
  filterBySeriesTab,
} from "@/lib/library-display";
import { useUserStore } from "@/lib/user-store";
import { ArrowLeft } from "lucide-react";

const tabSchema = z.enum(["in_corso", "da_vedere", "viste"]).default("in_corso");

export const Route = createFileRoute("/_authenticated/profilo/serie")({
  head: () => ({ meta: [{ title: "Le tue serie — Nerdubbio" }] }),
  validateSearch: (s) => ({ tab: tabSchema.parse(s.tab ?? "in_corso") }),
  component: ProfiloSeriePage,
});

const TAB_LABELS: Record<string, string> = {
  in_corso: "In corso",
  da_vedere: "Da vedere",
  viste: "Viste",
};

const EMPTY: Record<string, string> = {
  in_corso: "Nessuna serie in corso. Aggiungine una dalla ricerca.",
  da_vedere: "La watchlist serie è vuota.",
  viste: "Nessuna serie completata ancora.",
};

function ProfiloSeriePage() {
  const { state } = useUserStore();
  const { tab } = Route.useSearch();
  const items = filterBySeriesTab(state.media, tab);

  const tabs = (["in_corso", "da_vedere", "viste"] as const).map(id => ({
    id,
    label: TAB_LABELS[id]!,
    count: countSeriesTab(state.media, id),
  }));

  return (
    <AppShell subtitle="La tua libreria" title="Serie TV">
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Profilo
      </Link>

      <StatusTabs
        tabs={tabs}
        active={tab}
        buildTo={id => ({ to: "/profilo/serie", search: { tab: id } })}
      />

      <p className="mt-3 text-xs text-muted-foreground">{items.length} titoli</p>

      <LibraryGrid items={items} emptyEmoji="📺" emptyText={EMPTY[tab]} />
    </AppShell>
  );
}
