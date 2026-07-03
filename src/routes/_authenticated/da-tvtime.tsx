import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { parseCSV, toParsedRows, parseTvTimeExport, readTvTimeZip, deriveEpisodeProgress, pendingFromRow, matchQueryFromRow, cleanTitleForMatch, isLikelyMediaTitle, type ParsedRow, type TvTimeImportSummary, type TvTimePendingItem } from "@/lib/tvtime-import";
import { tmdbMatchTitles, tmdbSearch, type TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { useUserStore, type UserMediaEntry } from "@/lib/user-store";
import { libraryApi, LIBRARY_QUERY_KEY } from "@/lib/php/library-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2, Sparkles, ShieldCheck, Rocket, Import, Search, Check } from "lucide-react";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/da-tvtime")({
  head: () => ({
    meta: [
      { title: "Da TV Time a Nerdubbio — importa la tua libreria" },
      { name: "description", content: "TV Time chiude il 15 luglio 2026. Importa il tuo export CSV in Nerdubbio in 30 secondi: watchlist, serie in corso, film già visti." },
      { property: "og:title", content: "Migra da TV Time a Nerdubbio in 30 secondi" },
      { property: "og:description", content: "Non perdere anni di episodi tracciati. Importa il tuo CSV TV Time in Nerdubbio, senza account, senza abbonamento." },
    ],
  }),
  component: DaTvTimePage,
});

type MatchRow = { row: ParsedRow; match: TmdbItem | null; accept: boolean; suggestions: TmdbItem[] };

function DaTvTimePage() {
  const queryClient = useQueryClient();
  const { state } = useUserStore();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [busy, setBusy] = useState<"idle" | "matching" | "importing">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [kindOverride, setKindOverride] = useState<"auto" | "tv" | "movie">("auto");
  const [summary, setSummary] = useState<TvTimeImportSummary["counts"] | null>(null);
  const cleanedPendingRef = useRef(false);

  const validPending = useMemo(
    () => (state.importPending ?? []).filter(p => isLikelyMediaTitle(p.title)),
    [state.importPending],
  );

  useEffect(() => {
    const pending = state.importPending ?? [];
    if (cleanedPendingRef.current || pending.length === 0) return;
    const clean = pending.filter(p => isLikelyMediaTitle(p.title));
    if (clean.length === pending.length) return;
    cleanedPendingRef.current = true;
    void libraryApi.patchSettings({ importPending: clean }).then(next => {
      queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
      toast.info("Rimossi voci spurie dal salvataggio TV Time (impostazioni app, non titoli).");
    }).catch(() => {
      cleanedPendingRef.current = false;
    });
  }, [state.importPending, queryClient]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setMatches(null);
    setSummary(null);

    // ZIP GDPR TV Time completo
    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        const files = await readTvTimeZip(file);
        const res = parseTvTimeExport(files);
        if (res.rows.length === 0) { toast.error("Zip letto ma nessuna serie/film trovato."); return; }
        setRows(res.rows);
        setSummary(res.counts);
        toast.success(`Export TV Time letto: ${res.counts.shows} serie, ${res.counts.movies} film`, {
          description: res.counts.movies === 0
            ? `${res.counts.favorites} preferiti · ${res.counts.episodes} episodi · nessun film nel file (export JSON/CSV film?)`
            : `${res.counts.favorites} preferiti · ${res.counts.forLater} da vedere · ${res.counts.episodes} episodi`,
        });
        if (res.filesFound.length) {
          console.info("[tvtime-import] file riconosciuti:", res.filesFound);
        }
      } catch (e) {
        toast.error("Impossibile leggere lo zip. Estrai i CSV e caricali singolarmente.");
      }
      return;
    }

    // CSV singolo
    const text = await file.text();
    const raw = parseCSV(text);
    if (raw.length === 0) { toast.error("CSV vuoto o non valido."); return; }

    // Se sembra un file GDPR noto (contiene tv_show_id o simili), usa il parser dedicato
    const first = raw[0] ?? {};
    const looksGdpr = "tv_show_id" in first || "tv_show_name" in first || "episode_id" in first;
    if (looksGdpr) {
      const res = parseTvTimeExport({ [file.name]: text });
      if (res.rows.length > 0) {
        setRows(res.rows);
        setSummary(res.counts);
        toast.success(`Letto ${file.name}: ${res.rows.length} titoli`);
        return;
      }
    }

    const parsed = toParsedRows(raw, kindOverride === "auto" ? undefined : kindOverride)
      .filter(r => isLikelyMediaTitle(r.title));
    if (parsed.length === 0) { toast.error("Nessuna riga con un titolo riconoscibile."); return; }
    setRows(parsed);
  };

  const runMatch = async () => {
    if (rows.length === 0) return;
    setBusy("matching");
    try {
      const chunks: ParsedRow[][] = [];
      for (let i = 0; i < rows.length; i += 60) chunks.push(rows.slice(i, i + 60));
      const all: MatchRow[] = [];
      for (const c of chunks) {
        const { results } = await tmdbMatchTitles({
          data: { items: c.map(r => matchQueryFromRow(r)) },
        });
        results.forEach((r, i) => all.push({
          row: c[i],
          match: r.match,
          accept: !!r.match,
          suggestions: r.suggestions ?? [],
        }));
      }
      setMatches(all);
      const found = all.filter(m => m.match).length;
      toast(`Trovati ${found} su ${all.length} titoli su TMDB`);
    } catch (e) {
      toast.error("Errore durante il matching. Riprova tra un attimo.");
    } finally {
      setBusy("idle");
    }
  };

  const runImport = async () => {
    if (!matches) return;
    setBusy("importing");
    const IMPORT_CHUNK = 35;
    try {
      const accepted = matches.filter(m => m.accept && m.match);
      const unmatched = matches.filter(m => !m.match && isLikelyMediaTitle(m.row.title));

      const entries: UserMediaEntry[] = accepted.map(m => {
        const progress = m.match!.type === "tv" ? deriveEpisodeProgress(m.row) : {};
        return {
          id: `${m.match!.type}-${m.match!.tmdb_id}`,
          status: m.row.status ?? "plan_to_watch",
          addedAt: new Date().toISOString(),
          source: "tvtime",
          title: m.match!.title,
          posterUrl: m.match!.posterUrl,
          backdropUrl: m.match!.backdropUrl ?? null,
          type: m.match!.type,
          year: m.match!.year,
          ...progress,
        };
      });

      const existingPending = (state.importPending ?? []).filter(p => isLikelyMediaTitle(p.title));
      const pendingById = new Map(existingPending.map(p => [p.id, p]));
      for (const m of unmatched) {
        pendingById.set(pendingFromRow(m.row).id, pendingFromRow(m.row));
      }
      const importPending = [...pendingById.values()];

      let next = state;
      for (let i = 0; i < entries.length; i += IMPORT_CHUNK) {
        const chunk = entries.slice(i, i + IMPORT_CHUNK);
        const isLast = i + IMPORT_CHUNK >= entries.length;
        next = await libraryApi.bulkImport(
          chunk,
          isLast ? importPending : undefined,
          { withXp: isLast, replaceEpisodes: true },
        );
        queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
      }

      const epCount = entries.reduce((n, e) => n + (e.watchedEpisodes?.length ?? 0), 0);
      toast.success(`Importati ${entries.length} titoli (${epCount} episodi)`, {
        description: importPending.length
          ? `${importPending.length} titoli senza match salvati per correzione`
          : undefined,
      });
      setMatches(null);
      setRows([]);
      setFileName(null);
      setSummary(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      toast.error("Errore durante l'import. Riprova.", { description: msg });
    } finally {
      setBusy("idle");
    }
  };

  const pickMatch = (index: number, item: TmdbItem) => {
    setMatches(prev => prev
      ? prev.map((m, idx) => idx === index ? { ...m, match: item, accept: true } : m)
      : prev);
  };

  const toggleAccept = (i: number) => {
    setMatches(prev => prev ? prev.map((m, idx) => idx === i ? { ...m, accept: !m.accept } : m) : prev);
  };

  const sortedIndices = useMemo(() => {
    if (!matches) return [];
    return matches
      .map((_, i) => i)
      .sort((a, b) => Number(!!matches[a].match) - Number(!!matches[b].match));
  }, [matches]);

  const unmatchedIndices = sortedIndices.filter(
    i => !matches?.[i]?.match && isLikelyMediaTitle(matches![i].row.title),
  );
  const matchedIndices = sortedIndices.filter(i => !!matches?.[i]?.match);
  const acceptedCount = matches?.filter(m => m.accept && m.match).length ?? 0;
  const unresolvedCount = matches?.filter(m => !m.match).length ?? 0;

  return (
    <AppShell subtitle="Migrazione" title="Da TV Time"
      right={<span className="rounded-full bg-hero px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">Beta</span>}>

      {/* Hero */}
      <div className="glass overflow-hidden rounded-3xl p-5 shadow-glow">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-hero shadow-glow-pink">
            <Rocket className="h-6 w-6 text-primary-foreground" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-accent">TV Time chiude il 15 luglio 2026</p>
            <h2 className="mt-1 text-lg font-extrabold leading-tight">Non perdere anni di episodi tracciati.</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Nerdubbio è l'alternativa italiana: dark, senza pubblicità, con provider RaiPlay / NOW / TIMvision, la&nbsp;Main&nbsp;Quest come consigliere di serata e XP per ogni episodio.
            </p>
          </div>
        </div>

        <ul className="mt-4 grid gap-2 text-xs">
          <Bullet icon={<ShieldCheck className="h-3.5 w-3.5" />} text="I tuoi dati restano sul tuo dispositivo. Nessun data broker." />
          <Bullet icon={<Sparkles className="h-3.5 w-3.5" />} text="Provider streaming italiani (RaiPlay, Mediaset, TIMvision, NOW, MUBI)." />
          <Bullet icon={<CheckCircle2 className="h-3.5 w-3.5" />} text="Le tue liste importate mantengono lo stato (Da vedere / In corso / Visto)." />
        </ul>
      </div>

      {/* Step 1 — Come esportare */}
      <section className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">1 · Esporta da TV Time</h3>
        <ol className="glass space-y-1.5 rounded-2xl p-4 text-xs text-foreground/85">
          <li>Apri TV Time → <b>Impostazioni</b> → <b>Account</b> → <b>Scarica i tuoi dati</b> (GDPR).</li>
          <li>Ti arriva una mail con un archivio <code className="rounded bg-surface-2 px-1">.zip</code>.</li>
          <li>Carica lo zip qui sotto <b>così com&apos;è</b>: leggo serie (CSV/JSON) e film (<code>tracking-prod-records</code>, <code>user_movie_data</code>, JSON con <code>meta.name</code>).</li>
        </ol>
      </section>

      {/* Step 2 — Upload */}
      <section className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">2 · Carica lo zip o un CSV</h3>
        <div className="mb-2 flex gap-2">
          {(["auto", "tv", "movie"] as const).map(k => (
            <button key={k} onClick={() => setKindOverride(k)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${kindOverride === k ? "bg-hero text-primary-foreground shadow-glow" : "bg-surface-2 text-muted-foreground"}`}>
              {k === "auto" ? "Auto" : k === "tv" ? "Solo serie" : "Solo film"}
            </button>
          ))}
          <span className="ml-1 self-center text-[10px] text-muted-foreground">(override solo per CSV generici)</span>
        </div>
        <label className="glass flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border p-4 transition hover:border-accent">
          <UploadCloud className="h-6 w-6 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{fileName ?? "Trascina o seleziona il .zip TV Time (o un .csv)"}</p>
            <p className="text-[11px] text-muted-foreground">
              {rows.length > 0 ? `${rows.length} titoli pronti per il match TMDB` : "Tutto resta sul tuo dispositivo, nessun upload sui nostri server."}
            </p>
          </div>
          <input type="file" accept=".zip,.csv,text/csv,application/zip,application/x-zip-compressed" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>

        {summary && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-5">
            <Stat label="Serie" value={summary.shows} />
            <Stat label="Film" value={summary.movies} />
            <Stat label="Preferite" value={summary.favorites} />
            <Stat label="Da vedere" value={summary.forLater} />
            <Stat label="Episodi" value={summary.episodes} />
          </div>
        )}

        {rows.length > 0 && !matches && (
          <button onClick={runMatch} disabled={busy !== "idle"}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow-pink disabled:opacity-60">
            {busy === "matching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
            {busy === "matching" ? "Cerco su TMDB…" : `Trova su TMDB (${rows.length})`}
          </button>
        )}
      </section>


      {/* Step 3 — Review */}
      {matches && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider">3 · Rivedi & importa</h3>
            <span className="text-xs text-muted-foreground">{acceptedCount}/{matches.length}</span>
          </div>

          {unresolvedCount > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-destructive">
                  Da risolvere ({unresolvedCount})
                </h4>
              </div>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Scegli un suggerimento TMDB o cerca manualmente il titolo giusto prima di importare.
              </p>
              <div className="space-y-3">
                {unmatchedIndices.map(i => (
                  <UnmatchedCard
                    key={`u-${i}-${matches[i].row.title}`}
                    m={matches[i]}
                    onPick={item => pickMatch(i, item)}
                  />
                ))}
              </div>
            </div>
          )}

          {matchedIndices.length > 0 && (
            <div>
              {unresolvedCount > 0 && (
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pronti all&apos;import ({matchedIndices.length})
                </h4>
              )}
              <div className="space-y-2">
                {matchedIndices.map(i => (
                  <MatchedRow key={`m-${i}-${matches[i].row.title}`} m={matches[i]} onToggle={() => toggleAccept(i)} />
                ))}
              </div>
            </div>
          )}

          <button onClick={runImport} disabled={busy !== "idle" || acceptedCount === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
            {busy === "importing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Importa {acceptedCount} titoli
            {unresolvedCount > 0 ? ` · ${unresolvedCount} restano in sospeso` : ""}
          </button>
        </section>
      )}

      {(validPending.length > 0) && (
        <PendingSection pending={validPending} />
      )}

      <Link to="/app" className="mt-8 block text-center text-xs text-muted-foreground underline">
        Salta e vai alla home
      </Link>
    </AppShell>
  );
}

function RowMeta({ row }: { row: ParsedRow }) {
  return (
    <>
      {row.status && <p className="text-[10px] uppercase tracking-widest text-accent">{row.status.replace(/_/g, " ")}</p>}
      {(row.watchedEpisodes?.length ?? row.episodesSeen) ? (
        <p className="text-[10px] text-muted-foreground">
          {row.watchedEpisodes?.length
            ? `${row.watchedEpisodes.length} episodi nel CSV`
            : `${row.episodesSeen} episodi (solo conteggio)`}
        </p>
      ) : null}
    </>
  );
}

function TmdbPickGrid({ items, onPick }: { items: TmdbItem[]; onPick: (item: TmdbItem) => void }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item)}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 p-2 text-left transition hover:border-accent hover:bg-surface-2"
        >
          {item.posterUrl
            ? <img src={item.posterUrl} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
            : <div className="grid h-12 w-8 shrink-0 place-items-center rounded bg-surface-2 text-[10px] text-muted-foreground">?</div>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{item.title}</p>
            <p className="text-[10px] text-muted-foreground">{item.type === "tv" ? "Serie" : "Film"} · {item.year || "?"}</p>
          </div>
          <Check className="h-3.5 w-3.5 shrink-0 text-accent opacity-70" />
        </button>
      ))}
    </div>
  );
}

function TmdbSearchPicker({
  defaultQuery,
  typeFilter,
  onPick,
}: {
  defaultQuery: string;
  typeFilter?: "movie" | "tv";
  onPick: (item: TmdbItem) => void;
}) {
  const [q, setQ] = useState(defaultQuery);
  const [debouncedQ, setDebouncedQ] = useState(defaultQuery);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const searchQ = useQuery({
    queryKey: ["tmdb", "tvtime-search", debouncedQ, typeFilter],
    queryFn: () => tmdbSearch({ data: { query: debouncedQ } }),
    enabled: debouncedQ.length >= 2,
    staleTime: 60_000,
  });

  const results = (searchQ.data?.items ?? []).filter(i => !typeFilter || i.type === typeFilter).slice(0, 8);

  return (
    <div className="mt-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Cerca su TMDB…"
          className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-accent"
        />
      </div>
      {searchQ.isFetching && <p className="mt-2 text-[10px] text-muted-foreground">Cerco…</p>}
      {debouncedQ.length >= 2 && !searchQ.isFetching && results.length === 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">Nessun risultato per &quot;{debouncedQ}&quot;</p>
      )}
      {results.length > 0 && (
        <div className="mt-2">
          <TmdbPickGrid items={results} onPick={onPick} />
        </div>
      )}
    </div>
  );
}

function UnmatchedCard({ m, onPick }: { m: MatchRow; onPick: (item: TmdbItem) => void }) {
  const cleaned = cleanTitleForMatch(m.row.title);
  const defaultSearch = cleaned.title;

  return (
    <div className="glass rounded-2xl border border-destructive/30 p-3">
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-10 shrink-0 place-items-center rounded-lg bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            TV Time: <span className="font-semibold text-foreground">{m.row.title}</span>
            {m.row.year ?? cleaned.year ? ` · ${m.row.year ?? cleaned.year}` : ""}
          </p>
          <p className="text-sm font-semibold text-destructive">Nessun match automatico</p>
          <RowMeta row={m.row} />
        </div>
      </div>

      {m.suggestions.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suggerimenti TMDB</p>
          <TmdbPickGrid items={m.suggestions} onPick={onPick} />
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Oppure cerca manualmente</p>
        <TmdbSearchPicker defaultQuery={defaultSearch} typeFilter={m.row.type} onPick={onPick} />
      </div>
    </div>
  );
}

function MatchedRow({ m, onToggle }: { m: MatchRow; onToggle: () => void }) {
  return (
    <div className={`glass flex items-center gap-3 rounded-2xl p-2.5 transition ${m.accept ? "" : "opacity-50"}`}>
      {m.match?.posterUrl
        ? <img src={m.match.posterUrl} alt="" className="h-14 w-10 rounded-lg object-cover" />
        : <div className="grid h-14 w-10 place-items-center rounded-lg bg-surface-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">
          TV Time: <span className="text-foreground/80">{m.row.title}</span>
        </p>
        <p className="truncate text-sm font-semibold">
          → {m.match!.title} <span className="text-muted-foreground">· {m.match!.year || "?"}</span>
        </p>
        <RowMeta row={m.row} />
      </div>
      <button onClick={onToggle}
        className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${m.accept ? "bg-hero text-primary-foreground" : "border border-border text-muted-foreground"}`}>
        {m.accept ? "Includi" : "Escludi"}
      </button>
    </div>
  );
}

function PendingSection({ pending }: { pending: TvTimePendingItem[] }) {
  const queryClient = useQueryClient();
  const { state } = useUserStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  const resolvePending = async (p: TvTimePendingItem, item: TmdbItem) => {
    setBusyId(p.id);
    try {
      const progress = deriveEpisodeProgress({
        title: p.title,
        year: p.year,
        type: p.type,
        status: p.status,
        watchedEpisodes: p.watchedEpisodes,
        episodesSeen: p.episodesSeen,
      });
      const entry: UserMediaEntry = {
        id: `${item.type}-${item.tmdb_id}`,
        status: p.status ?? "plan_to_watch",
        addedAt: new Date().toISOString(),
        source: "tvtime",
        title: item.title,
        posterUrl: item.posterUrl,
        backdropUrl: item.backdropUrl ?? null,
        type: item.type,
        year: item.year,
        ...progress,
      };
      const nextPending = (state.importPending ?? []).filter(x => x.id !== p.id);
      const next = await libraryApi.bulkImport([entry], nextPending, { replaceEpisodes: true });
      queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
      toast.success(`Importato: ${item.title}`);
    } catch {
      toast.error("Errore import titolo");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Da correggere ({pending.length})</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Titoli salvati senza match. Scegli un suggerimento o cerca il titolo giusto qui sotto.
      </p>
      <div className="space-y-3">
        {pending.slice(0, 20).map(p => (
          <div key={p.id} className="glass rounded-2xl border border-destructive/20 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{p.title}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {p.type ?? "tv"} · {p.status?.replace(/_/g, " ") ?? "?"}
                {p.watchedEpisodes?.length ? ` · ${p.watchedEpisodes.length} ep.` : p.episodesSeen ? ` · ~${p.episodesSeen} ep.` : ""}
              </p>
            </div>
            {busyId === p.id ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Importo…
              </div>
            ) : (
              <div className="mt-3">
                <PendingSuggestions pending={p} onPick={item => resolvePending(p, item)} />
                <TmdbSearchPicker
                  defaultQuery={cleanTitleForMatch(p.title).title}
                  typeFilter={p.type}
                  onPick={item => resolvePending(p, item)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PendingSuggestions({ pending, onPick }: { pending: TvTimePendingItem; onPick: (item: TmdbItem) => void }) {
  const q = matchQueryFromRow({
    title: pending.title,
    year: pending.year,
    type: pending.type,
    status: pending.status,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["tmdb", "pending-suggest", q.title, q.year, q.type],
    queryFn: async () => {
      const { results } = await tmdbMatchTitles({ data: { items: [q] } });
      return results[0]?.suggestions ?? [];
    },
    staleTime: 300_000,
  });

  if (isLoading) return <p className="mb-2 text-[10px] text-muted-foreground">Carico suggerimenti…</p>;
  if (!data?.length) return null;

  return (
    <div className="mb-2">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suggerimenti</p>
      <TmdbPickGrid items={data} onPick={onPick} />
    </div>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl p-2 text-center">
      <div className="text-base font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

