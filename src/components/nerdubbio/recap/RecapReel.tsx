import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SceneView } from "./storyScene";
import { RecapMusic, type Mood } from "./recapMusic";
import type { RecapScene } from "@/lib/php/recap-client";

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
`;

type Phase = "gate" | "playing" | "outro";

export function RecapReel({
  scenes,
  title,
  mood,
  open,
  onClose,
}: {
  scenes: RecapScene[];
  title: string;
  mood: Mood;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("gate");
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [muted, setMuted] = useState(false);
  const musicRef = useRef<RecapMusic | null>(null);

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
  }, [open, phase, idx, scenes]);

  if (!open) return null;

  const start = () => {
    setIdx(0);
    setPhase("playing");
    if (!musicRef.current) musicRef.current = new RecapMusic(mood);
    musicRef.current.setMuted(muted);
    musicRef.current.start();
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
          </>
        )}

        <div className="rbx-content" style={{ opacity: scene && shown ? 1 : 0 }}>
          {scene && (
            <div key={idx} style={{ position: "absolute", inset: 0 }}>
              <SceneView scene={scene} />
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
            <div>
              <div className="rbx-title" style={{ fontSize: 24 }}>
                {t("recap.outroTitle")}
              </div>
              <div className="rbx-sub">{t("recap.outroSub")}</div>
              <button className="rbx-replay" onClick={start}>
                {t("recap.replay")}
              </button>
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
