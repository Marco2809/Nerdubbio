import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { parseCSV, toParsedRows, parseTvTimeExport, readTvTimeZip, deriveEpisodeProgress, pendingFromRow, matchQueryFromRow, cleanTitleForMatch, isLikelyMediaTitle, type ParsedRow, type TvTimeImportSummary, type TvTimePendingItem } from "@/lib/tvtime-import";
import { tmdbMatchTitles, tmdbSearch, type TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { useUserStore, type UserMediaEntry } from "@/lib/user-store";
import { libraryApi, LIBRARY_QUERY_KEY } from "@/lib/php/library-client";
import { applyResolvedTvStatuses } from "@/lib/resolve-show-statuses";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2, Sparkles, ShieldCheck, Rocket, Import, Search, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { useI18n, pageTitle, translate } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/da-tvtime")({
  head: () => ({
    meta: [
      { title: pageTitle("tvtime") },
      { name: "description", content: translate("it", "meta.tvtimeOgDesc") },
      { property: "og:title", content: translate("it", "meta.tvtimeOgTitle") },
      { property: "og:description", content: translate("it", "meta.tvtimeOgDesc") },
    ],
  }),
  component: DaTvTimePage,
});

type MatchRow = { row: ParsedRow; match: TmdbItem | null; accept: boolean; suggestions: TmdbItem[] };

function DaTvTimePage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { state } = useUserStore();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [busy, setBusy] = useState<"idle" | "matching" | "importing">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [kindOverride, setKindOverride] = useState<"auto" | "tv" | "movie">("auto");
  const [summary, setSummary] = useState<TvTimeImportSummary["counts"] | null>(null);
  const [parseProgress, setParseProgress] = useState<{ stage: string; pct: number } | null>(null);
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
      toast.info(t("tvtime.toastCleaned"));
    }).catch(() => {
      cleanedPendingRef.current = false;
    });
  }, [state.importPending, queryClient]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setMatches(null);
    setSummary(null);
    setParseProgress(null);

    // ZIP GDPR TV Time completo
    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        setParseProgress({ stage: t("tvtime.stageReading"), pct: 0 });
        const files = await readTvTimeZip(file, (loaded, total) => {
          setParseProgress({ stage: t("tvtime.stageReading"), pct: Math.round((loaded / total) * 60) });
        });
        setParseProgress({ stage: t("tvtime.stageParsing"), pct: 65 });
        await new Promise(r => setTimeout(r, 0));
        const res = parseTvTimeExport(files);
        setParseProgress({ stage: t("tvtime.stageDone"), pct: 100 });
        if (res.rows.length === 0) { toast.error(t("tvtime.toastZipEmpty")); return; }
        setRows(res.rows);
        setSummary(res.counts);
        toast.success(t("tvtime.toastZipRead", { shows: res.counts.shows, movies: res.counts.movies }), {
          description: res.counts.movies === 0
            ? t("tvtime.toastZipReadDescNoMovies", {
                favorites: res.counts.favorites,
                episodes: res.counts.episodes,
              })
            : t("tvtime.toastZipReadDesc", {
                favorites: res.counts.favorites,
                forLater: res.counts.forLater,
                episodes: res.counts.episodes,
              }),
        });
        if (res.filesFound.length) {
          console.info("[tvtime-import] file riconosciuti:", res.filesFound);
        }
      } catch (e) {
        toast.error(t("tvtime.toastZipError"));
      } finally {
        setTimeout(() => setParseProgress(null), 400);
      }
      return;
    }

    // CSV singolo
    const text = await file.text();
    const raw = parseCSV(text);
    if (raw.length === 0) { toast.error(t("tvtime.toastCsvEmpty")); return; }

    // Se sembra un file GDPR noto (contiene tv_show_id o simili), usa il parser dedicato
    const first = raw[0] ?? {};
    const looksGdpr = "tv_show_id" in first || "tv_show_name" in first || "episode_id" in first;
    if (looksGdpr) {
      const res = parseTvTimeExport({ [file.name]: text });
      if (res.rows.length > 0) {
        setRows(res.rows);
        setSummary(res.counts);
        toast.success(t("tvtime.toastFileRead", { file: file.name, count: res.rows.length }));
        return;
      }
    }

    const parsed = toParsedRows(raw, kindOverride === "auto" ? undefined : kindOverride)
      .filter(r => isLikelyMediaTitle(r.title));
    if (parsed.length === 0) { toast.error(t("tvtime.toastNoRows")); return; }
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
      toast.success(t("tvtime.toastMatchFound", { found, total: all.length }));
    } catch (e) {
      toast.error(t("tvtime.toastMatchError"));
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
          favorite: m.row.favorite,
          rating: m.row.rating,
          episodeDates: m.row.episodeDates,
          episodeWatchCounts: m.row.episodeWatchCounts,
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

      setParseProgress({ stage: t("tvtime.stageVerify"), pct: 5 });
      const statusStats = await applyResolvedTvStatuses(entries, (done, total) => {
        setParseProgress({
          stage: t("tvtime.stageCompletedShows", { done, total }),
          pct: 5 + Math.round((done / Math.max(total, 1)) * 25),
        });
      });

      const existingPending = (state.importPending ?? []).filter(p => isLikelyMediaTitle(p.title));
      const pendingById = new Map(existingPending.map(p => [p.id, p]));
      for (const m of unmatched) {
        pendingById.set(pendingFromRow(m.row).id, pendingFromRow(m.row));
      }
      const importPending = [...pendingById.values()];

      let next = state;
      const totalChunks = Math.ceil(entries.length / IMPORT_CHUNK);
      for (let i = 0; i < entries.length; i += IMPORT_CHUNK) {
        const chunk = entries.slice(i, i + IMPORT_CHUNK);
        const isLast = i + IMPORT_CHUNK >= entries.length;
        const chunkNum = Math.floor(i / IMPORT_CHUNK) + 1;
        setParseProgress({
          stage: t("tvtime.stageLibraryImport", { current: chunkNum, total: totalChunks }),
          pct: Math.round((chunkNum / totalChunks) * 100),
        });
        next = await libraryApi.bulkImport(
          chunk,
          isLast ? importPending : undefined,
          { withXp: isLast, replaceEpisodes: true },
        );
        queryClient.setQueryData(LIBRARY_QUERY_KEY, next);
      }

      const epCount = entries.reduce((n, e) => n + (e.watchedEpisodes?.length ?? 0), 0);
      toast.success(t("tvtime.toastImportSuccess", { count: entries.length, episodes: epCount }), {
        description: [
          statusStats.completed ? t("tvtime.toastImportCompletedShows", { count: statusStats.completed }) : null,
          importPending.length ? t("tvtime.toastImportPendingSaved", { count: importPending.length }) : null,
        ].filter(Boolean).join(" · ") || undefined,
      });
      setMatches(null);
      setRows([]);
      setFileName(null);
      setSummary(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.unknownError");
      toast.error(t("tvtime.toastImportError"), { description: msg });
    } finally {
      setBusy("idle");
      setTimeout(() => setParseProgress(null), 400);
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
    <AppShell subtitle={t("tvtime.subtitle")} title={t("tvtime.title")}
      right={<span className="rounded-full bg-hero px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">{t("tvtime.beta")}</span>}>

      {/* Hero */}
      <div className="glass overflow-hidden rounded-3xl p-5 shadow-glow">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-hero shadow-glow-pink">
            <Rocket className="h-6 w-6 text-primary-foreground" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-accent">{t("tvtime.closing")}</p>
            <h2 className="mt-1 text-lg font-extrabold leading-tight">{t("tvtime.heroTitle")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("tvtime.heroLead")}</p>
          </div>
        </div>

        <ul className="mt-4 grid gap-2 text-xs">
          <Bullet icon={<ShieldCheck className="h-3.5 w-3.5" />} text={t("tvtime.bulletPrivacy")} />
          <Bullet icon={<Sparkles className="h-3.5 w-3.5" />} text={t("tvtime.bulletProviders")} />
          <Bullet icon={<CheckCircle2 className="h-3.5 w-3.5" />} text={t("tvtime.bulletStatus")} />
        </ul>
      </div>

      {/* Step 1 — Come esportare */}
      <section className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">{t("tvtime.step1")}</h3>
        <ol className="glass space-y-1.5 rounded-2xl p-4 text-xs text-foreground/85">
          <li>{t("tvtime.step1a")}</li>
          <li>{t("tvtime.step1b")}</li>
          <li>{t("tvtime.step1c")}</li>
        </ol>
      </section>

      {/* Step 2 — Upload */}
      <section className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">{t("tvtime.step2")}</h3>
        <div className="mb-2 flex gap-2">
          {(["auto", "tv", "movie"] as const).map(k => (
            <button key={k} onClick={() => setKindOverride(k)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${kindOverride === k ? "bg-hero text-primary-foreground shadow-glow" : "bg-surface-2 text-muted-foreground"}`}>
              {k === "auto" ? t("tvtime.kindAuto") : k === "tv" ? t("tvtime.kindTv") : t("tvtime.kindMovie")}
            </button>
          ))}
          <span className="ml-1 self-center text-[10px] text-muted-foreground">{t("tvtime.kindHint")}</span>
        </div>
        <label className="glass flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border p-4 transition hover:border-accent">
          <UploadCloud className="h-6 w-6 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{fileName ?? t("tvtime.uploadDefault")}</p>
            <p className="text-[11px] text-muted-foreground">
              {rows.length > 0 ? t("tvtime.uploadReady", { count: rows.length }) : t("tvtime.uploadHint")}
            </p>
          </div>
          <input type="file" accept=".zip,.csv,text/csv,application/zip,application/x-zip-compressed" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>

        {parseProgress && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{parseProgress.stage}</span>
              <span>{parseProgress.pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-hero transition-all duration-300" style={{ width: `${parseProgress.pct}%` }} />
            </div>
          </div>
        )}

        {summary && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-5">
            <Stat label={t("tvtime.statShows")} value={summary.shows} />
            <Stat label={t("tvtime.statMovies")} value={summary.movies} />
            <Stat label={t("tvtime.statFavorites")} value={summary.favorites} />
            <Stat label={t("tvtime.statForLater")} value={summary.forLater} />
            <Stat label={t("tvtime.statEpisodes")} value={summary.episodes} />
          </div>
        )}

        {rows.length > 0 && !matches && (
          <button onClick={runMatch} disabled={busy !== "idle"}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow-pink disabled:opacity-60">
            {busy === "matching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
            {busy === "matching" ? t("tvtime.matching") : t("tvtime.findTmdb", { count: rows.length })}
          </button>
        )}
      </section>


      {/* Step 3 — Review */}
      {matches && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider">{t("tvtime.step3")}</h3>
            <span className="text-xs text-muted-foreground">{acceptedCount}/{matches.length}</span>
          </div>

          {unresolvedCount > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-destructive">
                  {t("tvtime.toResolve", { count: unresolvedCount })}
                </h4>
              </div>
              <p className="mb-3 text-[11px] text-muted-foreground">
                {t("tvtime.resolveHint")}
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
                  {t("tvtime.readyImport", { count: matchedIndices.length })}
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
            {t("tvtime.importBtn", { count: acceptedCount })}
            {unresolvedCount > 0 ? t("tvtime.importPending", { count: unresolvedCount }) : ""}
          </button>
        </section>
      )}

      {(validPending.length > 0) && (
        <PendingSection pending={validPending} />
      )}

      <Link to="/app" className="mt-8 block text-center text-xs text-muted-foreground underline">
        {t("tvtime.skipHome")}
      </Link>
    </AppShell>
  );
}

function RowMeta({ row }: { row: ParsedRow }) {
  const { t } = useI18n();
  return (
    <>
      {row.status && <p className="text-[10px] uppercase tracking-widest text-accent">{row.status.replace(/_/g, " ")}</p>}
      {(row.watchedEpisodes?.length ?? row.episodesSeen) ? (
        <p className="text-[10px] text-muted-foreground">
          {row.watchedEpisodes?.length
            ? t("tvtime.episodesInCsv", { count: row.watchedEpisodes.length })
            : t("tvtime.episodesCountOnly", { count: row.episodesSeen ?? 0 })}
        </p>
      ) : null}
    </>
  );
}

function TmdbPickGrid({ items, onPick }: { items: TmdbItem[]; onPick: (item: TmdbItem) => void }) {
  const { t } = useI18n();
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
            <p className="text-[10px] text-muted-foreground">{item.type === "tv" ? t("person.typeTv") : t("person.typeMovie")} · {item.year || "?"}</p>
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
  const { t } = useI18n();
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
          placeholder={t("tvtime.searchTmdb")}
          className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-accent"
        />
      </div>
      {searchQ.isFetching && <p className="mt-2 text-[10px] text-muted-foreground">{t("tvtime.searching")}</p>}
      {debouncedQ.length >= 2 && !searchQ.isFetching && results.length === 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">{t("tvtime.noResults", { query: debouncedQ })}</p>
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
  const { t } = useI18n();
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
            {t("tvtime.tvTimeLabel")} <span className="font-semibold text-foreground">{m.row.title}</span>
            {m.row.year ?? cleaned.year ? ` · ${m.row.year ?? cleaned.year}` : ""}
          </p>
          <p className="text-sm font-semibold text-destructive">{t("tvtime.noAutoMatch")}</p>
          <RowMeta row={m.row} />
        </div>
      </div>

      {m.suggestions.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("tvtime.suggestions")}</p>
          <TmdbPickGrid items={m.suggestions} onPick={onPick} />
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("tvtime.searchManual")}</p>
        <TmdbSearchPicker defaultQuery={defaultSearch} typeFilter={m.row.type} onPick={onPick} />
      </div>
    </div>
  );
}

function MatchedRow({ m, onToggle }: { m: MatchRow; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <div className={`glass flex items-center gap-3 rounded-2xl p-2.5 transition ${m.accept ? "" : "opacity-50"}`}>
      {m.match?.posterUrl
        ? <img src={m.match.posterUrl} alt="" className="h-14 w-10 rounded-lg object-cover" />
        : <div className="grid h-14 w-10 place-items-center rounded-lg bg-surface-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">
          {t("tvtime.tvTimeLabel")} <span className="text-foreground/80">{m.row.title}</span>
        </p>
        <p className="truncate text-sm font-semibold">
          → {m.match!.title} <span className="text-muted-foreground">· {m.match!.year || "?"}</span>
        </p>
        <RowMeta row={m.row} />
      </div>
      <button onClick={onToggle}
        className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${m.accept ? "bg-hero text-primary-foreground" : "border border-border text-muted-foreground"}`}>
        {m.accept ? t("tvtime.include") : t("tvtime.exclude")}
      </button>
    </div>
  );
}

function PendingSection({ pending }: { pending: TvTimePendingItem[] }) {
  const { t } = useI18n();
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
        rating: p.rating,
        episodeDates: p.episodeDates,
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
      toast.success(t("tvtime.toastImported", { title: item.title }));
    } catch {
      toast.error(t("tvtime.toastImportItemError"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-bold uppercase tracking-wider">{t("tvtime.pendingTitle", { count: pending.length })}</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {t("tvtime.pendingHint")}
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
                <Loader2 className="h-4 w-4 animate-spin" /> {t("tvtime.importing")}
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
  const { t } = useI18n();
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

  if (isLoading) return <p className="mb-2 text-[10px] text-muted-foreground">{t("tvtime.loadingSuggestions")}</p>;
  if (!data?.length) return null;

  return (
    <div className="mb-2">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("tvtime.suggestions")}</p>
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

