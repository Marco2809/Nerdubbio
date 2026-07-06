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
import { useI18n } from "@/lib/i18n";

const tabSchema = z.enum(["in_corso", "da_vedere", "viste"]).default("in_corso");

export const Route = createFileRoute("/_authenticated/profilo/serie")({
  head: () => ({ meta: [{ title: "Le tue serie — Nerdubbio" }] }),
  validateSearch: (s) => ({ tab: tabSchema.parse(s.tab ?? "in_corso") }),
  component: ProfiloSeriePage,
});

function ProfiloSeriePage() {
  const { t } = useI18n();
  const { state } = useUserStore();
  const { tab } = Route.useSearch();
  const items = filterBySeriesTab(state.media, tab);

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

      <p className="mt-3 text-xs text-muted-foreground">{t("library.titlesCount", { count: items.length })}</p>

      <LibraryGrid items={items} emptyEmoji="📺" emptyText={emptyLabels[tab]!} />
    </AppShell>
  );
}
