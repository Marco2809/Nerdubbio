import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { D20Roll } from "@/components/nerdubbio/D20Roll";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { NERDACOLO } from "@/lib/brand";
import type { CatalogItem } from "@/lib/mock-catalog";
import { catalogMediaId } from "@/lib/recommendation/engine";
import {
  fetchNerdacoloRollPool,
  pickByRoll,
  rollD20,
  rollFlavor,
  ROLL_DISCARD_LIMIT,
  ROLL_POOL_SIZE,
  splitRollPool,
} from "@/lib/recommendation/nerdacolo-roll";
import { useUserStore, type MediaMeta } from "@/lib/user-store";
import { createFileRoute } from "@tanstack/react-router";
import { Dices, Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { pageTitle, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/nerdacolo")({
  head: () => ({ meta: [{ title: pageTitle("nerdacoloRoll", "it", { name: NERDACOLO.name }) }] }),
  component: NerdacoloRollPage,
});

type Phase = "loading" | "ready" | "rolling" | "result";

function toMeta(item: CatalogItem): MediaMeta {
  return {
    title: item.title,
    type: item.type,
    year: item.year,
    posterUrl: item.posterUrl ?? null,
    backdropUrl: item.backdropUrl ?? null,
  };
}

function PoolCard({
  item,
  slot,
  canDiscard,
  onDiscard,
}: {
  item: CatalogItem;
  slot: number;
  canDiscard: boolean;
  onDiscard: () => void;
}) {
  return (
    <div className="relative w-full">
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-md border border-white/10 bg-surface-2 shadow-md"
        title={`${slot}. ${item.title}`}
      >
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full" style={{ background: item.poster }} />
        )}
        <span className="absolute left-0.5 top-0.5 rounded bg-black/75 px-1 font-mono text-[8px] font-bold text-white/95">
          {slot}
        </span>
        {canDiscard && (
          <button
            type="button"
            onClick={onDiscard}
            aria-label={`Scarta ${item.title}`}
            className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-md bg-black/75 text-white/90 transition hover:bg-destructive hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-[9px] font-semibold leading-tight text-muted-foreground">
        {item.title}
      </p>
    </div>
  );
}

function NerdacoloRollPage() {
  const { t } = useI18n();
  const { state, addToList } = useUserStore();
  const [phase, setPhase] = useState<Phase>("loading");
  const [pool, setPool] = useState<CatalogItem[]>([]);
  const [bench, setBench] = useState<CatalogItem[]>([]);
  const [discardsUsed, setDiscardsUsed] = useState(0);
  const [roll, setRoll] = useState(1);
  const [pick, setPick] = useState<CatalogItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rollRef = useRef(1);

  const discardsLeft = ROLL_DISCARD_LIMIT - discardsUsed;
  const canDiscard = phase === "ready" && discardsLeft > 0 && bench.length > 0;

  const loadPool = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setPick(null);
    setDiscardsUsed(0);
    try {
      const items = await fetchNerdacoloRollPool(state);
      const { active, bench: spare } = splitRollPool(items);
      setPool(active);
      setBench(spare);
      setPhase("ready");
    } catch {
      setError("Nerdacolo non riesce a consultare la sfera. Riprova.");
      setPool([]);
      setBench([]);
      setPhase("ready");
    }
  }, [state]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  const discardAt = (index: number) => {
    if (!canDiscard || index < 0 || index >= pool.length) return;
    const replacement = bench[0];
    if (!replacement) return;

    const discarded = pool[index]!;
    setBench(b => b.slice(1));
    setPool(p => {
      const next = [...p];
      next[index] = replacement;
      return next;
    });
    setDiscardsUsed(u => u + 1);
    toast.message(t("nerdacoloRoll.discarded", { title: discarded.title }), {
      description: t("nerdacoloRoll.discardedDesc", {
        slot: String(index + 1),
        replacement: replacement.title,
      }),
    });
  };

  const startRoll = () => {
    if (pool.length === 0) return;
    const r = rollD20();
    rollRef.current = r;
    setRoll(r);
    setPhase("rolling");
  };

  const handleSettled = useCallback(() => {
    setPick(pickByRoll(pool, rollRef.current));
    setPhase("result");
  }, [pool]);

  if (phase === "loading") {
    return (
      <AppShell subtitle={NERDACOLO.title} title="Consultazione in corso…">
        <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
          <BrandIcon className="h-20 w-20 animate-pulse" />
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
          <p className="max-w-xs text-center text-sm">
            {NERDACOLO.name} prepara {ROLL_POOL_SIZE} titoli + {ROLL_DISCARD_LIMIT} di scorta…
          </p>
        </div>
      </AppShell>
    );
  }

  if (error && pool.length === 0) {
    return (
      <AppShell title="Sfera off-line">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void loadPool()}
          className="mt-4 w-full rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground"
        >
          Riprova
        </button>
      </AppShell>
    );
  }

  return (
    <AppShell
      subtitle={
        phase === "result"
          ? "Il fato ha scelto"
          : phase === "ready"
            ? `${discardsLeft} scarti rimasti`
            : "Oracolo del binge"
      }
      title={phase === "result" ? "Ecco il verdetto" : `${NERDACOLO.name} — tiro d20`}
    >
      {phase === "ready" && (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          Scarta fino a {ROLL_DISCARD_LIMIT} titoli (sostituiti in automatico). Poi tira il d20.
        </p>
      )}

      {phase !== "rolling" && phase !== "result" && pool.length > 0 && (
        <div className="mb-5 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
          {pool.map((item, i) => (
            <PoolCard
              key={`${i}-${item.id}`}
              item={item}
              slot={i + 1}
              canDiscard={canDiscard}
              onDiscard={() => discardAt(i)}
            />
          ))}
        </div>
      )}

      {phase === "result" && pool.length > 0 && (
        <div className="mb-4 grid grid-cols-5 gap-1.5 opacity-40 sm:grid-cols-10">
          {pool.map((item, i) => (
            <div
              key={`${i}-${item.id}`}
              className={`relative aspect-[2/3] overflow-hidden rounded-md border bg-surface-2 ${
                i + 1 === roll ? "border-accent ring-1 ring-accent" : "border-white/10"
              }`}
            >
              {item.posterUrl ? (
                <img src={item.posterUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full" style={{ background: item.poster }} />
              )}
              <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 font-mono text-[8px] text-white/90">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center py-2">
        <D20Roll
          rolling={phase === "rolling"}
          finalValue={roll}
          onSettled={handleSettled}
          className="my-2"
        />

        {phase === "ready" && (
          <>
            <p className="mt-3 max-w-sm text-center text-sm text-muted-foreground">
              Ogni numero corrisponde a un titolo. Quando il pool ti convince, tira il d20.
            </p>
            <button
              type="button"
              onClick={startRoll}
              className="mt-5 flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-hero py-4 text-base font-bold text-primary-foreground shadow-glow-pink"
            >
              <Dices className="h-5 w-5" /> Tira il d20
            </button>
          </>
        )}

        {phase === "rolling" && (
          <p className="mt-4 animate-pulse text-sm font-semibold text-accent">
            {NERDACOLO.name} rolla…
          </p>
        )}

        {phase === "result" && pick && (
          <div className="mt-4 w-full animate-in fade-in slide-in-from-bottom-4">
            <p className="mb-3 text-center text-xs text-muted-foreground">
              Tiro <span className="font-bold text-foreground">{roll}</span> · {rollFlavor(roll)}
            </p>

            <Link
              to="/media/$type/$id"
              params={{ type: pick.type, id: String(pick.tmdb_id) }}
              className="block overflow-hidden rounded-3xl border border-accent/30 shadow-glow"
            >
              <div className="relative h-48">
                {pick.posterUrl ? (
                  <img src={pick.posterUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: pick.poster }} />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4">
                  <p className="text-lg font-extrabold text-white">{pick.title}</p>
                  <p className="text-xs text-white/70">
                    {pick.type === "tv" ? "Serie" : "Film"} · {pick.year || "—"}
                  </p>
                </div>
              </div>
            </Link>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  addToList(catalogMediaId(pick), "plan_to_watch", toMeta(pick));
                  toast.success(t("nerdacoloRoll.addedWatchlist", { title: pick.title }));
                }}
                className="rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground"
              >
                <Plus className="mr-1 inline h-4 w-4" /> Watchlist
              </button>
              <button
                type="button"
                onClick={() => void loadPool()}
                className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold"
              >
                <RotateCcw className="mr-1 inline h-4 w-4" /> Nuovo tiro
              </button>
            </div>

            <Link
              to="/dubbio"
              className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground underline-offset-2 hover:text-accent hover:underline"
            >
              <Sparkles className="h-3 w-3" /> Oppure fai la Main Quest completa
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
