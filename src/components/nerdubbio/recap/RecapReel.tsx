import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SceneView, EpChip } from "./storyScene";
import { RecapMusic, type Mood } from "./recapMusic";
import { exportRecapVideo, type ExportHandle } from "./videoExport";
import type { RecapScene } from "@/lib/php/recap-client";

export interface RecapCastPhoto {
  character: string;
  photo: string | null;
}

// Normalizza un nome per l'abbinamento (minuscole, senza accenti/punteggiatura).
function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const REEL_CSS = `
.rbx-overlay{position:fixed;inset:0;z-index:9999;background:#05060480;backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;font-family:var(--font-sans),system-ui,sans-serif}
.rbx-reel{position:relative;width:min(340px,92vw);aspect-ratio:9/16;max-height:92vh;border-radius:18px;overflow:hidden;background:#0c0e0b;box-shadow:0 20px 70px rgba(0,0,0,.55)}
.rbx-reel *{box-sizing:border-box}
.rbx-close{position:absolute;top:8px;right:8px;z-index:20;width:34px;height:34px;border-radius:50%;border:none;background:rgba(0,0,0,.45);color:#f2efe4;display:flex;align-items:center;justify-content:center;cursor:pointer}
.rbx-mute{position:absolute;top:8px;left:8px;z-index:20;width:34px;height:34px;border-radius:50%;border:none;background:rgba(0,0,0,.45);color:#f2efe4;display:flex;align-items:center;justify-content:center;cursor:pointer}
.rbx-lb{position:absolute;left:0;right:0;height:6.4%;background:#050604;z-index:6;pointer-events:none}
.rbx-content{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .32s ease;z-index:3}
.rbx-motif{width:78%;aspect-ratio:1/1;margin-top:-8%;display:flex;align-items:center;justify-content:center}
.rbx-motif svg{width:100%;height:100%}
.rbx-lower{position:absolute;left:8%;right:8%;bottom:11%;text-align:center}
.rbx-chip{display:inline-block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:#0d0f0c;background:#e0a52e;padding:5px 12px;border-radius:20px;margin-bottom:12px}
.rbx-cap{color:#f2efe4;font-size:16.5px;line-height:1.5;font-weight:500;text-shadow:0 2px 12px rgba(0,0,0,.85)}
.rbx-panel{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 28px;background:radial-gradient(120% 80% at 50% 38%,#16241a 0%,#0a0d09 72%)}
.rbx-kicker{color:#8fb36a;font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:600;margin-bottom:14px}
.rbx-title{color:#f2efe4;font-size:30px;font-weight:600;letter-spacing:-.01em;line-height:1.15}
.rbx-sub{color:#b9c4ac;font-size:13px;margin-top:8px}
.rbx-play{margin-top:26px;width:72px;height:72px;border-radius:50%;border:none;background:#e0a52e;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding-left:4px;animation:rbx-pulse 2.2s ease-out infinite}
.rbx-play:active,.rbx-replay:active{transform:scale(.95)}
.rbx-replay{margin-top:22px;background:transparent;color:#e0a52e;border:1.5px solid #e0a52e;padding:9px 18px;border-radius:22px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.rbx-progress{position:absolute;top:9%;left:8%;right:8%;height:3px;background:rgba(255,255,255,.16);border-radius:3px;z-index:8}
.rbx-progress-fill{height:100%;background:#e0a52e;border-radius:3px;transition:width .5s linear}
.rbx-counter{position:absolute;top:calc(9% + 10px);right:8%;color:#cfd6c4;font-size:11px;font-weight:600;letter-spacing:.08em;z-index:8}
.rbx-vig{position:absolute;inset:0;z-index:4;pointer-events:none;box-shadow:inset 0 0 120px 30px rgba(0,0,0,.55)}
.rbx-grain{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:.05;background-image:radial-gradient(#fff 1px,transparent 1px);background-size:3px 3px;mix-blend-mode:overlay}
.rb-fx{transform-origin:center}
@keyframes rbx-pulse{0%{box-shadow:0 0 0 0 rgba(224,165,46,.45)}70%{box-shadow:0 0 0 22px rgba(224,165,46,0)}100%{box-shadow:0 0 0 0 rgba(224,165,46,0)}}
@keyframes rb-draw{to{stroke-dashoffset:0}}
@keyframes rb-rise{0%{transform:translateY(14px);opacity:0}30%{opacity:1}100%{transform:translateY(-70px);opacity:0}}
@keyframes rb-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes rb-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes rb-throb{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.2);opacity:1}}
@keyframes rb-spin{to{transform:rotate(360deg)}}
@keyframes rb-fall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(90px) rotate(60deg);opacity:0}}
@keyframes rb-sweep{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes rb-shake{0%,100%{transform:translateX(-3px)}50%{transform:translateX(3px)}}
@keyframes rb-flash{0%,100%{opacity:1}50%{opacity:.28}}
@keyframes rb-slide{from{transform:translateX(-130px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes rb-swing{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
@keyframes rb-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes rb-grow-x{from{transform:scaleX(0)}to{transform:scaleX(1)}}
`;

type Phase = "gate" | "playing" | "outro";

/** Card condivisibile 1080x1350: solo testo/gradiente, nessuna immagine esterna. */
async function buildRecapCard(title: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a2415");
  bg.addColorStop(0.55, "#0c0e0b");
  bg.addColorStop(1, "#242015");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.font = "200px serif";
  ctx.fillText("🔮", W / 2, 430);

  ctx.fillStyle = "#f2efe4";
  ctx.font = "bold 64px Georgia, serif";
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const testLine = line ? `${line} ${w}` : w;
    if (ctx.measureText(testLine).width > W - 160 && line) {
      lines.push(line);
      line = w;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, 640 + i * 84));

  ctx.fillStyle = "#e0a52e";
  ctx.font = "600 38px system-ui, sans-serif";
  ctx.fillText("Story Journey · Recap", W / 2, 640 + Math.min(lines.length, 3) * 84 + 40);

  ctx.fillStyle = "rgba(242,239,228,0.6)";
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText("Nerdubbio", W / 2, H - 80);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export function RecapReel({
  scenes,
  title,
  mood,
  open,
  onClose,
  cast,
}: {
  scenes: RecapScene[];
  title: string;
  mood: Mood;
  open: boolean;
  onClose: () => void;
  cast?: RecapCastPhoto[];
}) {
  const { t } = useI18n();

  // Abbina un nome personaggio (dalla scena) alla foto attore del cast.
  const photoFor = useMemo(() => {
    const entries = (cast ?? [])
      .filter((c) => c.photo && c.character)
      .map((c) => {
        const norm = normName(c.character);
        return { norm, tokens: norm.split(" ").filter((w) => w.length >= 4), photo: c.photo! };
      });
    if (entries.length === 0) return undefined;
    return (name: string): string | undefined => {
      const n = normName(name);
      if (!n) return undefined;
      for (const e of entries) if (e.norm === n) return e.photo;
      for (const e of entries) if (n.length >= 4 && (e.norm.includes(n) || n.includes(e.norm))) return e.photo;
      const nt = n.split(" ").filter((w) => w.length >= 4);
      if (nt.length) for (const e of entries) if (e.tokens.some((tk) => nt.includes(tk))) return e.photo;
      return undefined;
    };
  }, [cast]);

  // Precarica le foto così non lampeggiano durante il reel.
  useEffect(() => {
    if (!open || !cast) return;
    for (const c of cast) if (c.photo) new Image().src = c.photo;
  }, [open, cast]);
  const [phase, setPhase] = useState<Phase>("gate");
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const musicRef = useRef<RecapMusic | null>(null);

  // Export video: stato + canvas anteprima + handle di annullamento.
  const [exportState, setExportState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [exportPct, setExportPct] = useState(0);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportHandleRef = useRef<ExportHandle>({ cancelled: false });
  const [videoOut, setVideoOut] = useState<{ blob: Blob; ext: string } | null>(null);

  const startExport = async () => {
    const canvas = exportCanvasRef.current;
    if (!canvas) return;
    exportHandleRef.current = { cancelled: false };
    setExportState("running");
    setExportPct(0);
    setVideoOut(null);
    // Silenzia la musica del player: il video ha la sua traccia.
    musicRef.current?.setMuted(true);
    try {
      const out = await exportRecapVideo({
        scenes,
        mood,
        canvas,
        photoFor,
        onProgress: setExportPct,
        handle: exportHandleRef.current,
      });
      if (exportHandleRef.current.cancelled) setExportState("idle");
      else if (out) { setVideoOut(out); setExportState("done"); }
      else setExportState("error");
    } catch {
      setExportState("error");
    } finally {
      musicRef.current?.setMuted(muted);
    }
  };

  const cancelExport = () => {
    exportHandleRef.current.cancelled = true;
    setExportState("idle");
  };

  const shareVideo = async () => {
    if (!videoOut) return;
    const file = new File([videoOut.blob], `nerdubbio-recap.${videoOut.ext}`, { type: videoOut.blob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }
    } catch {
      /* annullato o non supportato: fallback download */
    }
    const url = URL.createObjectURL(videoOut.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nerdubbio-recap.${videoOut.ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const holdRef = useRef<{ timer: number; held: boolean }>({ timer: 0, held: false });

  // Controlli stile stories: tenere premuto = pausa, tap sinistra/destra =
  // scena precedente/successiva.
  const onPointerDown = () => {
    holdRef.current.held = false;
    holdRef.current.timer = window.setTimeout(() => {
      holdRef.current.held = true;
      setPaused(true);
    }, 250);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    clearTimeout(holdRef.current.timer);
    if (holdRef.current.held) {
      setPaused(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const leftThird = e.clientX - rect.left < rect.width / 3;
    setPaused(false);
    if (leftThird) setIdx((i) => Math.max(0, i - 1));
    else setIdx((i) => i + 1);
  };

  useEffect(() => {
    if (open) {
      setPhase("gate");
      setIdx(0);
      setShown(false);
    } else if (musicRef.current) {
      musicRef.current.stop();
      musicRef.current = null;
    }
  }, [open]);

  useEffect(
    () => () => {
      musicRef.current?.stop();
      musicRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "playing") return;
    if (idx >= scenes.length) {
      setPhase("outro");
      return;
    }
    // In pausa: la scena resta visibile, nessun timer di avanzamento.
    if (paused) {
      setShown(true);
      return;
    }
    setShown(false);
    const t0 = window.setTimeout(() => setShown(true), 40);
    const dur = scenes[idx]!.dur;
    const t1 = window.setTimeout(() => setShown(false), Math.max(700, dur - 320));
    const t2 = window.setTimeout(() => setIdx((i) => i + 1), dur);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, phase, idx, scenes, paused]);

  if (!open) return null;

  const start = () => {
    setIdx(0);
    setPaused(false);
    setPhase("playing");
    if (!musicRef.current) musicRef.current = new RecapMusic(mood);
    musicRef.current.setMuted(muted);
    musicRef.current.start();
  };

  const shareRecap = async () => {
    const text = t("recap.shareText", { title });
    try {
      const blob = await buildRecapCard(title);
      if (blob && navigator.canShare) {
        const file = new File([blob], "nerdubbio-recap.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ text, files: [file] });
          return;
        }
      }
    } catch {
      /* fallback testo */
    }
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* annullato */
    }
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      musicRef.current?.setMuted(next);
      return next;
    });
  };
  const scene = phase === "playing" && idx < scenes.length ? scenes[idx] : null;
  const progress = scenes.length ? ((idx + 1) / scenes.length) * 100 : 0;

  return createPortal(
    <div className="rbx-overlay" onClick={onClose}>
      <style>{REEL_CSS}</style>
      <div className="rbx-reel" onClick={(e) => e.stopPropagation()}>
        <button className="rbx-close" onClick={onClose} aria-label={t("common.close")}>
          <X className="h-4 w-4" />
        </button>
        <button className="rbx-mute" onClick={toggleMute} aria-label={t("recap.sound")}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <div className="rbx-lb" style={{ top: 0 }} />
        <div className="rbx-lb" style={{ bottom: 0 }} />

        {phase === "playing" && (
          <>
            <div className="rbx-progress">
              <div className="rbx-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="rbx-counter">
              {Math.min(idx + 1, scenes.length)} / {scenes.length}
            </div>
            {/* Tap sinistra/destra = scena prec/succ; pressione = pausa */}
            <div
              className="absolute inset-0"
              style={{ zIndex: 10, touchAction: "manipulation" }}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerLeave={() => {
                clearTimeout(holdRef.current.timer);
                if (holdRef.current.held) {
                  holdRef.current.held = false;
                  setPaused(false);
                }
              }}
            />
            {paused && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center" style={{ zIndex: 11 }}>
                <span className="rounded-full bg-black/55 px-4 py-1.5 text-xs font-bold text-white">⏸</span>
              </div>
            )}
          </>
        )}

        <div className="rbx-content" style={{ opacity: scene && shown ? 1 : 0 }}>
          {scene && (
            <div key={idx} style={{ position: "absolute", inset: 0 }}>
              <SceneView scene={scene} photoFor={photoFor} />
              <EpChip ep={scene.ep} />
            </div>
          )}
        </div>

        {phase === "gate" && (
          <div className="rbx-panel">
            <div>
              <div className="rbx-kicker">{t("recap.kicker")}</div>
              <div className="rbx-title">{title}</div>
              <div className="rbx-sub">{t("recap.intro")}</div>
              <button className="rbx-play" onClick={start} aria-label={t("recap.play")}>
                <svg viewBox="0 0 24 24" width="28" height="28">
                  <path d="M8 5v14l11-7z" fill="#0d0f0c" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {phase === "outro" && (
          <div className="rbx-panel" style={{ zIndex: 9 }}>
            <div style={{ width: "100%" }}>
              {/* Anteprima live dell'export: il canvas È il video in lavorazione */}
              <canvas
                ref={exportCanvasRef}
                style={{
                  display: exportState === "running" ? "block" : "none",
                  width: "62%", margin: "0 auto 12px", borderRadius: 14,
                  border: "1px solid rgba(224,165,46,0.4)",
                }}
              />
              {exportState === "running" ? (
                <>
                  <div className="rbx-sub">{t("recap.exporting", { pct: Math.round(exportPct * 100) })}</div>
                  <div style={{ margin: "10px auto 0", width: "70%", height: 5, borderRadius: 3, background: "rgba(255,255,255,.15)" }}>
                    <div style={{ width: `${exportPct * 100}%`, height: "100%", borderRadius: 3, background: "#e0a52e", transition: "width .3s linear" }} />
                  </div>
                  <button className="rbx-replay" onClick={cancelExport}>
                    {t("common.cancel")}
                  </button>
                </>
              ) : exportState === "done" && videoOut ? (
                <>
                  <div className="rbx-title" style={{ fontSize: 22 }}>{t("recap.exportReady")}</div>
                  <button className="rbx-replay" onClick={() => void shareVideo()}>
                    {t("recap.exportShare")}
                  </button>
                  <button className="rbx-replay" style={{ marginLeft: 10 }} onClick={() => setExportState("idle")}>
                    {t("common.close")}
                  </button>
                </>
              ) : (
                <>
                  <div className="rbx-title" style={{ fontSize: 24 }}>
                    {t("recap.outroTitle")}
                  </div>
                  <div className="rbx-sub">{t("recap.outroSub")}</div>
                  {exportState === "error" && (
                    <div className="rbx-sub" style={{ color: "#f0a5a5" }}>{t("recap.exportError")}</div>
                  )}
                  <div>
                    <button className="rbx-replay" onClick={start}>
                      {t("recap.replay")}
                    </button>
                    <button
                      className="rbx-replay"
                      style={{ marginLeft: 10 }}
                      onClick={() => void shareRecap()}
                    >
                      {t("recap.shareCta")}
                    </button>
                    <button
                      className="rbx-replay"
                      style={{ marginLeft: 10 }}
                      onClick={() => void startExport()}
                    >
                      🎬 {t("recap.exportCta")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="rbx-vig" />
        <div className="rbx-grain" />
      </div>
    </div>,
    document.body,
  );
}
