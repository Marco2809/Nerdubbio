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
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { state } = useUserStore();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setProgress("Lettura export…");
    try {
      const summary = await parseTvTimeFile(file);
      if (summary.rows.length === 0) {
        toast.error("Nessuna serie o film trovato nel file.");
        return;
      }
      setProgress("Matching TMDB…");
      const matches = await matchTvTimeRows(summary.rows);
      const matched = matches.filter(m => m.match).length;
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
      toast.error(e instanceof Error ? e.message : "Impossibile leggere il file.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const runMerge = async () => {
    if (!pendingFile || !preview) return;
    setBusy(true);
    try {
      const summary = await parseTvTimeFile(pendingFile);
      const matches = await matchTvTimeRows(summary.rows);
      const entries = buildEntriesFromMatches(matches);
      if (entries.length === 0) {
        toast.error("Nessun titolo abbinato a TMDB.");
        return;
      }

      const beforeIds = new Set(Object.keys(state.media));
      const beforeEps = Object.values(state.media).reduce(
        (n, m) => n + (m.watchedEpisodes?.length ?? 0),
        0,
      );

      await executeTvTimeImport({
        entries,
        mode: "merge",
        queryClient,
        initialState: state,
        onProgress: (stage, pct) => setProgress(`${stage} ${pct}%`),
      });

      const after = queryClient.getQueryData<typeof state>(LIBRARY_QUERY_KEY) ?? state;
      const newTitles = entries.filter(e => !beforeIds.has(e.id)).length;
      const afterEps = Object.values(after.media).reduce(
        (n, m) => n + (m.watchedEpisodes?.length ?? 0),
        0,
      );
      const addedEps = Math.max(0, afterEps - beforeEps);

      toast.success("Libreria aggiornata da TV Time", {
        description: [
          `${preview.matched} titoli elaborati`,
          newTitles > 0 ? `${newTitles} nuovi in libreria` : null,
          addedEps > 0 ? `${addedEps} episodi aggiunti/corretti` : "conteggi rivisioni aggiornati",
        ].filter(Boolean).join(" · "),
      });
      setPreview(null);
      setPendingFile(null);
    } catch (e) {
      toast.error("Errore durante l'aggiornamento.", {
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
            <p className="text-sm font-semibold">Re-import TV Time</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Carica di nuovo il tuo export per correggere episodi mancanti o conteggi rivisioni.
              Unisce i dati senza duplicare titoli già in libreria.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.csv"
              className="hidden"
              onChange={e => {
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
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {busy ? (progress ?? "Elaborazione…") : "Seleziona zip/csv TV Time"}
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!preview} onOpenChange={open => { if (!open && !busy) { setPreview(null); setPendingFile(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aggiornare la libreria?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  File: <strong className="text-foreground">{preview?.fileName}</strong>
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>{preview?.matched} titoli riconosciuti su TMDB (su {preview?.total})</li>
                  <li>{preview?.shows} serie · {preview?.movies} film</li>
                  <li>{preview?.episodes} episodi nel file (inclusi rivisti)</li>
                </ul>
                <p className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Modalità merge: episodi e rivisioni si sommano o si correggono al valore più alto.
                  Nessun titolo duplicato, stati manuali (preferiti, in pausa) restano intatti.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={e => {
                e.preventDefault();
                void runMerge();
              }}
              className="bg-hero text-primary-foreground hover:opacity-90"
            >
              {busy ? "Aggiornamento…" : "Aggiorna libreria"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
