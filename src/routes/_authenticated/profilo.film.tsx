import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { LibraryGrid } from "@/components/nerdubbio/LibraryGrid";
import { LibrarySortSelect } from "@/components/nerdubbio/LibrarySortSelect";
import { StatusTabs } from "@/components/nerdubbio/StatusTabs";
import {
  countMovieTab,
  filterByMovieTab,
  applyLibrarySort,
  type LibrarySortKey,
} from "@/lib/library-display";
import { useUserStore } from "@/lib/user-store";
import { ArrowLeft } from "lucide-react";
import { useI18n, pageTitle } from "@/lib/i18n";

const tabSchema = z.enum(["da_vedere", "visti"]).default("da_vedere");

export const Route = createFileRoute("/_authenticated/profilo/film")({
  head: () => ({ meta: [{ title: pageTitle("libraryMovies") }] }),
  validateSearch: (s) => ({ tab: tabSchema.parse(s.tab ?? "da_vedere") }),
  component: ProfiloFilmPage,
});

function ProfiloFilmPage() {
  const { t } = useI18n();
  const { state } = useUserStore();
  const { tab } = Route.useSearch();
  const [sort, setSort] = useState<LibrarySortKey>("default");
  const items = applyLibrarySort(filterByMovieTab(state.media, tab), sort);

  const tabLabels: Record<string, string> = {
    da_vedere: t("library.tabMoviesToWatch"),
    visti: t("library.tabMoviesWatched"),
  };
  const emptyLabels: Record<string, string> = {
    da_vedere: t("library.emptyMoviesPlan"),
    visti: t("library.emptyMoviesCompleted"),
  };

  const tabs = (["da_vedere", "visti"] as const).map(id => ({
    id,
    label: tabLabels[id]!,
    count: countMovieTab(state.media, id),
  }));

  return (
    <AppShell subtitle={t("library.yourLibrary")} title={t("library.moviesTitle")}>
      <Link to="/profile" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> {t("library.backProfile")}
      </Link>

      <StatusTabs
        tabs={tabs}
        active={tab}
        buildTo={id => ({ to: "/profilo/film", search: { tab: id } })}
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("library.titlesCount", { count: items.length })}</p>
        <LibrarySortSelect value={sort} onChange={setSort} />
      </div>

      <LibraryGrid items={items} emptyEmoji="🎬" emptyText={emptyLabels[tab]!} />
    </AppShell>
  );
}
