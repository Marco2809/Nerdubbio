import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/nerdubbio/AppShell";
import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { NerdacoloLoader } from "@/components/nerdubbio/NerdacoloLoader";
import {
  clearNerdacoloSession,
  loadNerdacoloResult,
  loadNerdacoloSession,
  recordNerdacoloFeedback,
} from "@/lib/recommendation/nerdacoloEngine";
import type { NerdacoloCandidate, NerdacoloFinalResult } from "@/lib/recommendation/nerdacolo-types";
import { useUserStore, type MediaMeta } from "@/lib/user-store";
import { NERDACOLO, QUEST } from "@/lib/brand";
import {
  Check,
  Film,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Tv,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { tmdbWatchProviders } from "@/lib/tmdb/tmdb.functions";
import { toast } from "@/lib/toast";
import { useI18n, pageTitle, type Locale } from "@/lib/i18n";

const LOCALE_COUNTRY: Record<Locale, string> = { it: "IT", en: "US", es: "ES", fr: "FR", de: "DE" };

// Match "Prime Video" (utente) vs "Amazon Prime Video" (TMDB), "Sky / NOW" vs "Now TV", ecc.
function providerMatchesUser(providerName: string, userPlatforms: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const p = norm(providerName);
  return userPlatforms.some((u) => {
    const tokens = u.split(/[\s/]+/).map(norm).filter((tk) => tk.length >= 3);
    if (tokens.length === 0) return false;
    const whole = norm(u);
    return p.includes(whole) || whole.includes(p) || tokens.some((tk) => p.includes(tk));
  });
}

export const Route = createFileRoute("/_authenticated/dubbio/risultato")({
  head: () => ({ meta: [{ title: pageTitle("dubbioResult", "it", { name: QUEST.name }) }] }),
  component: ResultPage,
});

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // image.tmdb.org manda CORS *
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Card 1080x1350 (4:5): poster + match% + brand. */
async function buildShareCard(pick: NerdacoloCandidate, score: number): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#17102b");
  bg.addColorStop(0.55, "#0c0a14");
  bg.addColorStop(1, "#1a0f22");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Poster centrale con angoli arrotondati
  const pw = 560;
  const ph = 840;
  const px = (W - pw) / 2;
  const py = 150;
  if (pick.posterPath) {
    try {
      const img = await loadImage(pick.posterPath);
      ctx.save();
      roundRect(ctx, px, py, pw, ph, 36);
      ctx.clip();
      ctx.drawImage(img, px, py, pw, ph);
      ctx.restore();
    } catch {
      /* senza poster: solo testo */
    }
  }
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 36);
  ctx.strokeStyle = "rgba(232,121,249,0.55)";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  // Badge match
  ctx.fillStyle = "#e879f9";
  roundRect(ctx, W / 2 - 130, py + ph + 36, 260, 72, 36);
  ctx.fill();
  ctx.fillStyle = "#17102b";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`MATCH ${score}%`, W / 2, py + ph + 84);

  // Titolo (max 2 righe)
  ctx.fillStyle = "#f5f0ff";
  ctx.font = "bold 58px system-ui, sans-serif";
  const words = pick.title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 160 && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => {
    ctx.fillText(lines.length > 2 && i === 1 ? `${l}…` : l, W / 2, py + ph + 200 + i * 70);
  });

  // Brand
  ctx.fillStyle = "rgba(245,240,255,0.65)";
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText("Nerdubbio · Nerdacolo", W / 2, H - 70);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

function toMeta(c: NerdacoloCandidate): MediaMeta {
  return {
    title: c.title,
    type: c.mediaType,
    year: c.releaseYear,
    posterUrl: c.posterPath ?? null,
    backdropUrl: c.backdropPath ?? null,
  };
}

function PosterHero({ pick, result }: { pick: NerdacoloCandidate; result: NerdacoloFinalResult }) {
  const { t } = useI18n();
  return (
    <div className="relative h-64 overflow-hidden rounded-3xl shadow-glow-pink">
      {pick.posterPath ? (
        <img src={pick.posterPath} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary/40 to-surface" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-hero px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
            {t("dubbio.match", { n: result.compatibilityScore })}
          </span>
          {result.isBoldPick && (
            <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300">
              {t("dubbio.boldPick")}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-widest text-white/70">
            {pick.mediaType === "tv" ? t("home.seriesShort") : t("home.movieShort")} · {pick.releaseYear}
          </span>
        </div>
        <h2 className="mt-1 text-2xl font-extrabold text-white">{pick.title}</h2>
      </div>
    </div>
  );
}

type FeedbackAction =
  | "perfect"
  | "seen"
  | "nope"
  | "heavy"
  | "light"
  | "long"
  | "action"
  | "niche"
  | "watchlist";

function ResultPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { state, addToList, dismiss, update } = useUserStore();
  const [result, setResult] = useState<NerdacoloFinalResult | null>(null);
  const [ready, setReady] = useState(false);

  const pickForQuery = result?.mainRecommendation ?? null;
  const providersQ = useQuery({
    queryKey: ["tmdb", "providers", pickForQuery?.mediaType, pickForQuery?.tmdbId, locale],
    queryFn: () =>
      tmdbWatchProviders({
        data: {
          type: pickForQuery!.mediaType,
          tmdbId: pickForQuery!.tmdbId,
          region: LOCALE_COUNTRY[locale] ?? "IT",
        },
      }),
    enabled: !!pickForQuery,
    staleTime: 1000 * 60 * 60,
  });
  const flatrate = providersQ.data?.providers.flatrate ?? [];

  useEffect(() => {
    setResult(loadNerdacoloResult());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <AppShell title={t("dubbio.computing", { name: NERDACOLO.name })}>
        <NerdacoloLoader />
      </AppShell>
    );
  }

  if (!result) {
    return (
      <AppShell title={t("dubbio.noResult")}>
        <p className="text-sm text-muted-foreground">
          {t("dubbio.noResultHint", { name: NERDACOLO.name })}{" "}
          <Link to="/dubbio" className="text-accent underline">
            {t("dubbio.retryDubbio")}
          </Link>
        </p>
      </AppShell>
    );
  }

  const pick = result.mainRecommendation;
  const mediaId = pick.mediaKey;
  const meta = toMeta(pick);
  const session = loadNerdacoloSession();

  const unlockAchievement = () => {
    if (!state.achievements.includes("primo-dubbio")) {
      update({ achievements: [...state.achievements, "primo-dubbio"] });
    }
  };

  const share = async () => {
    const text = t("dubbio.recommendShare", {
      name: NERDACOLO.name,
      title: pick.title,
      score: result.compatibilityScore,
    });
    // Card immagine: su WhatsApp/IG un testo nudo non porta nessuno.
    try {
      const blob = await buildShareCard(pick, result.compatibilityScore);
      if (blob && navigator.canShare) {
        const file = new File([blob], "nerdubbio.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: QUEST.shareTitle, text, files: [file] });
          return;
        }
      }
    } catch {
      /* card fallita o annullata: fallback testo */
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: QUEST.shareTitle, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success(t("dubbio.copied"));
      }
    } catch {
      /* cancelled */
    }
  };

  const handleFeedback = (action: FeedbackAction) => {
    switch (action) {
      case "perfect":
        recordNerdacoloFeedback("perfect");
        toast.success(t("dubbio.perfectToast"));
        unlockAchievement();
        break;
      case "seen":
        addToList(mediaId, "completed", meta);
        toast.success(t("dubbio.markedSeen"));
        break;
      case "nope":
        dismiss(mediaId);
        toast(t("dubbio.dismissed"));
        break;
      case "heavy":
        recordNerdacoloFeedback("lighter");
        dismiss(mediaId);
        toast(t("dubbio.lighterNext"));
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        break;
      case "light":
        recordNerdacoloFeedback("heavier");
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        toast(t("dubbio.heavierRetry"));
        break;
      case "long":
        recordNerdacoloFeedback("shorter");
        dismiss(mediaId);
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        toast(t("dubbio.shorterSearch"));
        break;
      case "action":
        recordNerdacoloFeedback("action");
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        toast(t("dubbio.actionRetry"));
        break;
      case "niche":
        recordNerdacoloFeedback("niche");
        clearNerdacoloSession();
        navigate({ to: "/dubbio" });
        toast(t("dubbio.nicheRetry"));
        break;
      case "watchlist":
        addToList(mediaId, "plan_to_watch", meta);
        unlockAchievement();
        toast.success(t("dubbio.addedWatchlist", { title: pick.title }));
        break;
    }
  };

  const feedbackButtons = [
    { id: "perfect" as const, label: t("dubbio.perfect"), icon: ThumbsUp },
    { id: "heavy" as const, label: t("dubbio.tooHeavy"), icon: null },
    { id: "light" as const, label: t("dubbio.tooLight"), icon: null },
    { id: "long" as const, label: t("dubbio.tooLong"), icon: null },
    { id: "action" as const, label: t("dubbio.moreAction"), icon: Zap },
    { id: "niche" as const, label: t("dubbio.lessMainstream"), icon: null },
  ];

  return (
    <AppShell subtitle={t("dubbio.spoken", { name: NERDACOLO.name })} title={t("dubbio.tonightPick")}>
      {session && (
        <p className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          {t("dubbio.sessionStats", {
            pool: session.initialPoolSize,
            eliminated: session.eliminatedCount,
            confidence: result.confidence,
          })}
        </p>
      )}

      <PosterHero pick={pick} result={result} />

      <div className="glass mt-4 rounded-3xl p-4">
        <div className="flex items-start gap-2">
          <BrandIcon className="mt-0.5 h-8 w-8 shrink-0" compact />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("dubbio.whyRecommend")}</p>
            <p className="mt-1 text-sm leading-relaxed">{result.explanation}</p>
          </div>
        </div>
        {result.matchedTraits.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {result.matchedTraits.map(trait => (
              <span
                key={trait}
                className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent"
              >
                {trait}
              </span>
            ))}
          </div>
        )}
        {result.rejectedButRecoveredTraits.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("dubbio.sphereWarning", { traits: result.rejectedButRecoveredTraits.join(", ") })}
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-border bg-surface/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dubbio.mood")}</p>
          <p className="mt-0.5 font-semibold">{result.moodLabel}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dubbio.commitment")}</p>
          <p className="mt-0.5 font-semibold">{result.commitmentLabel}</p>
        </div>
      </div>

      {/* Dove vederlo — la domanda che decide se il consiglio è usabile stasera */}
      {flatrate.length > 0 && (
        <div className="mt-3 rounded-2xl border border-border bg-surface/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dubbio.whereToWatch")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {flatrate.slice(0, 6).map((p) => {
              const mine = (state.platforms?.length ?? 0) > 0 && providerMatchesUser(p.name, state.platforms!);
              return (
                <span
                  key={p.id}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    mine ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-surface/60"
                  }`}
                >
                  {p.logoUrl && <img src={p.logoUrl} alt="" className="h-4 w-4 rounded" />}
                  {p.name}
                  {mine && <Check className="h-3 w-3" />}
                </span>
              );
            })}
          </div>
          {(state.platforms?.length ?? 0) > 0 &&
            !flatrate.some((p) => providerMatchesUser(p.name, state.platforms!)) && (
              <p className="mt-2 text-[11px] text-amber-400/90">{t("dubbio.notOnYourPlatforms")}</p>
            )}
        </div>
      )}

      {result.similarTo.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-accent" />
          {t("dubbio.similarTo")} {result.similarTo.join(", ")}
        </p>
      )}

      {result.whyNotOthers.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border/60 bg-surface/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("dubbio.rejected")}
          </p>
          <ul className="mt-2 space-y-1">
            {result.whyNotOthers.map((line, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                · {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleFeedback("watchlist")}
          className="rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow"
        >
          <Plus className="mr-1 inline h-4 w-4" /> {t("dubbio.watchlist")}
        </button>
        <button
          type="button"
          onClick={() => handleFeedback("seen")}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold"
        >
          <Check className="mr-1 inline h-4 w-4" /> {t("dubbio.alreadySeen")}
        </button>
        <button
          type="button"
          onClick={() => handleFeedback("nope")}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-sm font-semibold"
        >
          <ThumbsDown className="mr-1 inline h-4 w-4" /> {t("dubbio.notForMe")}
        </button>
        <Link
          to="/media/$type/$id"
          params={{ type: pick.mediaType, id: String(pick.tmdbId) }}
          className="rounded-2xl border border-accent/40 bg-accent/10 py-3 text-center text-sm font-semibold text-accent"
        >
          {pick.mediaType === "tv" ? <Tv className="mr-1 inline h-4 w-4" /> : <Film className="mr-1 inline h-4 w-4" />}
          {t("dubbio.openDetail")}
        </Link>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("dubbio.feedbackTitle")}
        </p>
        <div className="flex flex-wrap gap-2">
          {feedbackButtons.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleFeedback(f.id)}
              className="rounded-full border border-border bg-surface/50 px-3 py-1.5 text-[11px] font-medium hover:border-accent"
            >
              {f.icon && <f.icon className="mr-1 inline h-3 w-3" />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {result.alternativeRecommendations.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">{t("dubbio.alternatives")}</h3>
          <div className="space-y-2">
            {result.alternativeRecommendations.map(alt => (
              <Link
                key={alt.mediaKey}
                to="/media/$type/$id"
                params={{ type: alt.mediaType, id: String(alt.tmdbId) }}
                className="glass flex items-center gap-3 rounded-2xl p-3"
              >
                {alt.posterPath ? (
                  <img src={alt.posterPath} alt="" className="h-16 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="h-16 w-12 shrink-0 rounded-xl bg-surface-2" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{alt.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {alt.releaseYear} · {t("dubbio.match", { n: alt.score })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/dubbio"
          onClick={() => clearNerdacoloSession()}
          className="rounded-2xl border border-border bg-surface/60 py-3 text-center text-sm font-semibold"
        >
          <RotateCcw className="mr-1 inline h-4 w-4" /> {t("dubbio.retryDubbio")}
        </Link>
        <button
          type="button"
          onClick={() => void share()}
          className="rounded-2xl border border-accent/40 bg-accent/10 py-3 text-sm font-semibold text-accent"
        >
          <Share2 className="mr-1 inline h-4 w-4" /> {t("dubbio.share")}
        </button>
      </div>
    </AppShell>
  );
}
