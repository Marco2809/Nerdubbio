import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { LibraryGrid } from "@/components/nerdubbio/LibraryGrid";
import { LibrarySortSelect, usePersistentSort } from "@/components/nerdubbio/LibrarySortSelect";
import { LibrarySearch } from "@/components/nerdubbio/LibrarySearch";
import { StatusTabs } from "@/components/nerdubbio/StatusTabs";
import {
  countSeriesTab,
  filterBySeriesTab,
  applyLibrarySort,
  filterByQuery,
} from "@/lib/library-display";
import { useUserStore } from "@/lib/user-store";
import { ArrowLeft } from "lucide-react";
import { useI18n, pageTitle } from "@/lib/i18n";

const tabSchema = z.enum(["in_corso", "da_vedere", "viste"]).default("in_corso");

export const Route = createFileRoute("/_authenticated/profilo/serie")({
  head: () => ({ meta: [{ title: pageTitle("librarySeries") }] }),
  validateSearch: (s) => ({ tab: tabSchema.parse(s.tab ?? "in_corso") }),
  component: ProfiloSeriePage,
});

function ProfiloSeriePage() {
  const { t } = useI18n();
  const { state } = useUserStore();
  const { tab } = Route.useSearch();
  const [sort, setSort] = usePersistentSort("nb_lib_sort_serie");
  const [query, setQuery] = useState("");
  const items = filterByQuery(applyLibrarySort(filterBySeriesTab(state.media, tab), sort), query);

  const tabLabels: Record<string, string> = {
    in_corso: t("library.tabInProgress"),
    da_vedere: t("library.tabToWatch"),
    viste: t("library.tabWatched"),
  };
  const emptyLabels: Record<string, string> = {
    in_corso: t("library.emptySeriesWatching"),
    da_vedere: t("library.emptySeriesPlan"),
    viste: t("library.emptySeriesCompleted"),
  };

  const tabs = (["in_corso", "da_vedere", "viste"] as const).map(id => ({
    id,
    label: tabLabels[id]!,
    count: countSeriesTab(state.media, id),
  }));

  return (
    <AppShell subtitle={t("library.yourLibrary")} title={t("library.seriesTitle")}>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> {t("library.backProfile")}
      </Link>

      <StatusTabs
        tabs={tabs}
        active={tab}
        buildTo={id => ({ to: "/profilo/serie", search: { tab: id } })}
      />

      <LibrarySearch value={query} onChange={setQuery} />

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("library.titlesCount", { count: items.length })}</p>
        <LibrarySortSelect value={sort} onChange={setSort} />
      </div>

      <LibraryGrid items={items} emptyEmoji="📺" emptyText={query ? t("library.noMatch") : emptyLabels[tab]!} />
    </AppShell>
  );
}
