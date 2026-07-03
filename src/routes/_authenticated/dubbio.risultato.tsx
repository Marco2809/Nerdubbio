import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { NerdacoloLoader } from "@/components/nerdubbio/NerdacoloLoader";
import {
  recommendationEngine,
  catalogMediaId,
  type RecommendationResult,
} from "@/lib/recommendation/engine";
import type { CatalogItem } from "@/lib/mock-catalog";
import {
  buildDubbioProfile,
  fetchDubbioPool,
  loadDubbioPool,
  loadDubbioSession,
  saveDubbioSession,
  type DubbioSession,
} from "@/lib/recommendation/dubbio-pool";
import { useUserStore, type MediaMeta } from "@/lib/user-store";
import { NERDACOLO, QUEST } from "@/lib/brand";
import { Plus, Check, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { z } from "zod";

/** Solo per link vecchi con risposte in query — migrati in sessionStorage e rimossi dall'URL. */
const searchSchema = z.object({ d: z.string().optional() });

export const Route = createFileRoute("/_authenticated/dubbio/risultato")({
  head: () => ({ meta: [{ title: `Risultato ${QUEST.name} — Nerdubbio` }] }),
  validateSearch: searchSchema,
  component: ResultPage,
});

function toMeta(item: CatalogItem): MediaMeta {
  return {
    title: item.title,
    type: item.type,
    year: item.year,
    posterUrl: item.posterUrl ?? null,
    backdropUrl: item.backdropUrl ?? null,
  };
}

function PosterHero({ item, score }: { item: CatalogItem; score: number }) {
  return (
    <div className="relative h-56 overflow-hidden rounded-3xl shadow-glow-pink">
      {item.posterUrl ? (
        <img src={item.posterUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full" style={{ background: item.poster }} />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-hero px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
            Match {score}%
          </span>
          <span className="text-[10px] uppercase tracking-widest text-white/70">
            {item.type === "tv" ? "Serie" : "Film"} · {item.year}
          </span>
        </div>
        <h2 className="mt-1 text-2xl font-extrabold text-white">{item.title}</h2>
      </div>
    </div>
  );
}

function ResultPage() {
  const { d } = Route.useSearch();
  const navigate = useNavigate();
  const { state, addToList, dismiss, update } = useUserStore();
  const profile = useMemo(() => buildDubbioProfile(state), [state]);

  const [sessionReady, setSessionReady] = useState(false);
  const [parsed, setParsed] = useState<DubbioSession | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [poolSize, setPoolSize] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let session = loadDubbioSession();
    if (!session && d) {
      try {
        session = JSON.parse(decodeURIComponent(d)) as DubbioSession;
        saveDubbioSession(session);
      } catch {
        session = null;
      }
    }
    setParsed(session);
    setSessionReady(true);
    if (d) {
      navigate({ to: "/dubbio/risultato", search: {}, replace: true });
    }
  }, [d, navigate]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!parsed) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let pool: CatalogItem[] = loadDubbioPool() ?? [];
        if (pool.length < 20) {
          pool = await fetchDubbioPool(parsed.mode, profile, parsed.answers);
        } else {
          pool = await fetchDubbioPool(parsed.mode, profile, parsed.answers);
        }
        if (cancelled) return;
        setPoolSize(pool.length);
        setResult(recommendationEngine(parsed.answers, parsed.mode, profile, pool));
      } catch {
        if (!cancelled) toast.error("Errore TMDB nel calcolo del risultato");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsed, profile, sessionReady]);

  if (!sessionReady || loading) {
    return (
      <AppShell title={`${NERDACOLO.name} calcola il match…`}>
        <NerdacoloLoader title={sessionReady ? "Scoring su TMDB e watchlist…" : "Calcolo in corso…"} />
      </AppShell>
    );
  }

  if (!parsed) {
    return (
      <AppShell title="Nessuna quest">
        <p className="text-sm text-muted-foreground">
          {NERDACOLO.name} ha bisogno di risposte.{" "}
          <Link to="/dubbio" className="text-accent underline">
            Rifai la quest
          </Link>
          .
        </p>
      </AppShell>
    );
  }

  if (!result?.primary) {
    return (
      <AppShell subtitle={NERDACOLO.title} title="Nessun titolo disponibile">
        <p className="text-sm text-muted-foreground">
          Hai visto o scartato tutto nel pool ({poolSize} titoli). Prova un altro mode o rimuovi
          qualche titolo da &quot;non fa per me&quot;.
        </p>
        <Link
          to="/dubbio"
          className="mt-4 block rounded-2xl bg-hero py-3 text-center text-sm font-bold text-primary-foreground"
        >
          Nuova Quest
        </Link>
      </AppShell>
    );
  }

  const p = result.primary;
  const mediaId = catalogMediaId(p.item);
  const meta = toMeta(p.item);

  const unlockAchievement = () => {
    if (!state.achievements.includes("primo-dubbio")) {
      update({ achievements: [...state.achievements, "primo-dubbio"] });
    }
  };

  const share = async () => {
    const text = `${NERDACOLO.name} consiglia: ${p.item.title} (${p.score}% match) — Nerdubbio`;
    try {
      if (navigator.share) {
        await navigator.share({ title: QUEST.shareTitle, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copiato negli appunti");
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <AppShell subtitle={`${NERDACOLO.name} ha deciso`} title="Ecco cosa guardi stasera">
      <p className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        {poolSize} candidati da TMDB · libreria esclusa
      </p>

      {result.emptyPool && (
        <p className="mb-3 rounded-2xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
          Pool esaurito — Nerdacolo ha ripescato tra tutti i candidati TMDB.
        </p>
      )}

      <PosterHero item={p.item} score={p.score} />

      <div className="glass mt-4 rounded-3xl p-4">
        <div className="flex items-start gap-2">
          <BrandIcon className="mt-0.5 h-8 w-8 shrink-0" compact />
          <p className="text-sm leading-relaxed">{result.explanation}</p>
        </div>
        {p.reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {p.reasons.map((r, i) => (
              <span
                key={i}
                className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent"
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            addToList(mediaId, "plan_to_watch", meta);
            unlockAchievement();
            toast.success(`"${p.item.title}" in watchlist`);
          }}
          className="rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow"
        >
          <Plus className="mr-1 inline h-4 w-4" /> In watchlist
        </button>
        <button
          onClick={() => {
            addToList(mediaId, "completed", meta);
            unlockAchievement();
            toast.success(`"${p.item.title}" segnato come visto`);
          }}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold"
        >
          <Check className="mr-1 inline h-4 w-4" /> Già visto
        </button>
        <button
          onClick={() => {
            dismiss(p.item.id);
            dismiss(mediaId);
            toast(`"${p.item.title}" ignorato`);
          }}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold"
        >
          Non fa per me
        </button>
        <Link
          to="/dubbio"
          className="rounded-2xl border border-border bg-surface/60 py-3 text-center text-sm font-semibold"
        >
          <RotateCcw className="mr-1 inline h-4 w-4" /> Ritenta
        </Link>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">Alternative</h3>
        <div className="space-y-2">
          {result.alternatives.map(alt => (
            <Link
              key={alt.item.id}
              to="/media/$type/$id"
              params={{ type: alt.item.type, id: String(alt.item.tmdb_id) }}
              className="glass flex items-center gap-3 rounded-2xl p-3"
            >
              {alt.item.posterUrl ? (
                <img src={alt.item.posterUrl} alt="" className="h-16 w-12 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="h-16 w-12 shrink-0 rounded-xl" style={{ background: alt.item.poster }} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{alt.item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {alt.item.year} · Match {alt.score}%
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void share()}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 py-3 text-sm font-semibold text-accent"
      >
        <Share2 className="h-4 w-4" /> Condividi il consiglio del {NERDACOLO.short}
      </button>
    </AppShell>
  );
}
