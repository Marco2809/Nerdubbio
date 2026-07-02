import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { parseCSV, toParsedRows, parseTvTimeExport, readTvTimeZip, type ParsedRow, type TvTimeImportSummary } from "@/lib/tvtime-import";
import { tmdbMatchTitles, type TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { useUserStore, type UserMediaEntry } from "@/lib/user-store";
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2, Sparkles, ShieldCheck, Rocket, Import } from "lucide-react";
import { toast } from "sonner";

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

type MatchRow = { row: ParsedRow; match: TmdbItem | null; accept: boolean };

function DaTvTimePage() {
  const { bulkImport } = useUserStore();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [busy, setBusy] = useState<"idle" | "matching" | "importing">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [kindOverride, setKindOverride] = useState<"auto" | "tv" | "movie">("auto");
  const [summary, setSummary] = useState<TvTimeImportSummary["counts"] | null>(null);

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
          description: `${res.counts.favorites} preferiti · ${res.counts.forLater} da vedere · ${res.counts.episodes} episodi tracciati`,
        });
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

    const parsed = toParsedRows(raw, kindOverride === "auto" ? undefined : kindOverride);
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
        const { results } = await tmdbMatchTitles({ data: { items: c.map(r => ({ title: r.title, year: r.year, type: r.type })) } });
        results.forEach((r, i) => all.push({ row: c[i], match: r.match, accept: !!r.match }));
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

  const runImport = () => {
    if (!matches) return;
    setBusy("importing");
    const entries: UserMediaEntry[] = matches
      .filter(m => m.accept && m.match)
      .map(m => ({
        id: `${m.match!.type}-${m.match!.tmdb_id}`,
        status: m.row.status ?? "plan_to_watch",
        addedAt: new Date().toISOString(),
        source: "tvtime",
      }));
    bulkImport(entries);
    setBusy("idle");
    toast.success(`Importati ${entries.length} titoli. Benvenuto in casa nuova. 🎉`);
    setMatches(null); setRows([]); setFileName(null);
  };

  const toggleAccept = (i: number) => {
    setMatches(prev => prev ? prev.map((m, idx) => idx === i ? { ...m, accept: !m.accept } : m) : prev);
  };

  const acceptedCount = matches?.filter(m => m.accept && m.match).length ?? 0;

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
              Nerdubbio è l'alternativa italiana: dark, senza pubblicità, con provider RaiPlay / NOW / TIMvision, Il&nbsp;Dubbio come consigliere di serata e XP per ogni episodio.
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
          <li>Carica lo zip qui sotto <b>così com'è</b>: leggo io i file giusti (<code>followed_tv_show</code>, <code>user_show_special_status</code>, <code>user_tv_show_data</code>, <code>ratings-live-votes</code>).</li>
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
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <Stat label="Serie" value={summary.shows} />
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
          <div className="space-y-2">
            {matches.map((m, i) => (
              <div key={i} className={`glass flex items-center gap-3 rounded-2xl p-2.5 transition ${m.accept ? "" : "opacity-50"}`}>
                {m.match?.posterUrl
                  ? <img src={m.match.posterUrl} alt="" className="h-14 w-10 rounded-lg object-cover" />
                  : <div className="grid h-14 w-10 place-items-center rounded-lg bg-surface-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">CSV: <span className="text-foreground/80">{m.row.title}</span>{m.row.year ? ` · ${m.row.year}` : ""}</p>
                  {m.match ? (
                    <p className="truncate text-sm font-semibold">→ {m.match.title} <span className="text-muted-foreground">· {m.match.year || "?"}</span></p>
                  ) : (
                    <p className="text-sm font-semibold text-destructive">Nessun match TMDB</p>
                  )}
                  {m.row.status && <p className="text-[10px] uppercase tracking-widest text-accent">{m.row.status.replace("_", " ")}</p>}
                </div>
                {m.match && (
                  <button onClick={() => toggleAccept(i)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${m.accept ? "bg-hero text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                    {m.accept ? "Includi" : "Escludi"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={runImport} disabled={busy !== "idle" || acceptedCount === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-neon py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
            {busy === "importing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Importa {acceptedCount} titoli
          </button>
        </section>
      )}

      <Link to="/app" className="mt-8 block text-center text-xs text-muted-foreground underline">
        Salta e vai alla home
      </Link>
    </AppShell>
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

