import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { useUserStore } from "@/lib/user-store";
import { LIBRARY_QUERY_KEY } from "@/lib/php/library-client";
import {
  parseTvTimeFile,
  matchTvTimeRows,
  buildEntriesFromMatches,
  executeTvTimeImport,
} from "@/lib/tvtime-import-run";
import { toast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Preview = {
  fileName: string;
  shows: number;
  movies: number;
  episodes: number;
  matched: number;
  total: number;
};

export function TvTimeReimportCard() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { state } = useUserStore();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setProgress(t("reimport.progressRead"));
    try {
      const summary = await parseTvTimeFile(file);
      if (summary.rows.length === 0) {
        toast.error(t("reimport.noMedia"));
        return;
      }
      setProgress(t("reimport.progressMatch"));
      const matches = await matchTvTimeRows(summary.rows);
      const matched = matches.filter((m) => m.match).length;
      setPendingFile(file);
      setPreview({
        fileName: file.name,
        shows: summary.counts.shows,
        movies: summary.counts.movies,
        episodes: summary.counts.episodes,
        matched,
        total: matches.length,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reimport.fileReadError"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const runUpdate = async (mode: "merge" | "repair") => {
    if (!pendingFile || !preview) return;
    setBusy(true);
    try {
      const summary = await parseTvTimeFile(pendingFile);
      const matches = await matchTvTimeRows(summary.rows);
      const entries = buildEntriesFromMatches(matches);
      if (entries.length === 0) {
        toast.error(t("reimport.noMatches"));
        return;
      }

      const beforeIds = new Set(Object.keys(state.media));
      const beforeEps = Object.values(state.media).reduce(
        (n, m) => n + (m.watchedEpisodes?.length ?? 0),
        0,
      );

      const { removed } = await executeTvTimeImport({
        entries,
        mode,
        queryClient,
        initialState: state,
        onProgress: (stage, pct) => setProgress(`${stage} ${pct}%`),
      });

      const after = queryClient.getQueryData<typeof state>(LIBRARY_QUERY_KEY) ?? state;
      const newTitles = entries.filter((e) => !beforeIds.has(e.id)).length;
      const afterEps = Object.values(after.media).reduce(
        (n, m) => n + (m.watchedEpisodes?.length ?? 0),
        0,
      );
      const addedEps = Math.max(0, afterEps - beforeEps);

      toast.success(mode === "repair" ? t("reimport.repairSuccessTitle") : t("reimport.successTitle"), {
        description: [
          t("reimport.successProcessed", { count: preview.matched }),
          newTitles > 0 ? t("reimport.successNew", { count: newTitles }) : null,
          mode === "repair" && removed > 0 ? t("reimport.repairRemoved", { count: removed }) : null,
          addedEps > 0 ? t("reimport.successEpisodes", { count: addedEps }) : t("reimport.successRewatches"),
        ]
          .filter(Boolean)
          .join(" · "),
      });
      setPreview(null);
      setPendingFile(null);
    } catch (e) {
      toast.error(t("reimport.updateError"), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <>
      <div className="glass rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("reimport.title")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{t("reimport.hint")}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/60 py-2.5 text-xs font-semibold transition hover:border-accent disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? (progress ?? t("reimport.processing")) : t("reimport.selectFile")}
            </button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPreview(null);
            setPendingFile(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reimport.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {t("reimport.confirmFile")}{" "}
                  <strong className="text-foreground">{preview?.fileName}</strong>
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    {t("reimport.confirmMatched", {
                      matched: preview?.matched ?? 0,
                      total: preview?.total ?? 0,
                    })}
                  </li>
                  <li>
                    {t("reimport.confirmStats", {
                      shows: preview?.shows ?? 0,
                      movies: preview?.movies ?? 0,
                    })}
                  </li>
                  <li>{t("reimport.confirmEpisodes", { episodes: preview?.episodes ?? 0 })}</li>
                </ul>
                <p className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {t("reimport.confirmMergeHint")}
                </p>
                <p className="flex items-start gap-2 rounded-xl border border-neon/30 bg-neon/10 p-3 text-xs text-foreground">
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
                  {t("reimport.repairHint")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void runUpdate("repair");
              }}
              className="border border-neon/40 bg-surface-2 text-foreground hover:bg-neon/15"
            >
              {busy ? t("reimport.repairing") : t("reimport.repairAction")}
            </AlertDialogAction>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void runUpdate("merge");
              }}
              className="bg-hero text-primary-foreground hover:opacity-90"
            >
              {busy ? t("reimport.updating") : t("reimport.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
