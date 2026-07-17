// Esporta il recap come vero file video: renderer canvas time-based che
// replica i layout del reel + MediaRecorder sul canvas.captureStream, con la
// musica del mood mixata via WebAudio. Registrazione in tempo reale (il canvas
// fa anche da anteprima live).

import type { RecapScene } from "@/lib/php/recap-client";
import { motifSvg } from "./motifs";
import type { Mood } from "./recapMusic";

const W = 720;
const H = 1280;
const FPS = 30;

const GOLD = "#e0a52e";
const CREAM = "#f2efe4";
const DIM = "#aeb6a4";
const BG = "#0c0e0b";

const MUSIC_SRC: Record<Mood, string> = {
  tense: "/recap-music/tense.mp3",
  epic: "/recap-music/epic.mp3",
  warm: "/recap-music/warm.mp3",
  light: "/recap-music/light.mp3",
  neutral: "/recap-music/neutral.mp3",
};

type Assets = {
  motifs: Map<string, HTMLImageElement>;
  photos: Map<string, HTMLImageElement>;
};

export type ExportHandle = { cancelled: boolean };

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------

function loadImage(src: string, cors = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function rasterizeMotif(name: string): Promise<HTMLImageElement | null> {
  let svg = motifSvg(name);
  if (!/\swidth=/.test(svg)) svg = svg.replace("<svg ", '<svg width="512" height="512" ');
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = await loadImage(url);
  URL.revokeObjectURL(url);
  return img;
}

async function preloadAssets(
  scenes: RecapScene[],
  photoFor?: (name: string) => string | undefined,
): Promise<Assets> {
  const motifNames = new Set<string>();
  const photoUrls = new Map<string, string>();
  for (const s of scenes) {
    if (s.motif) motifNames.add(s.motif);
    if (!s.motif && (s.layout ?? "motif") === "motif") motifNames.add("person");
    for (const c of s.characters ?? []) {
      const u = photoFor?.(c.name);
      if (u) photoUrls.set(c.name, u);
    }
    if (s.layout === "character-card" && s.title) {
      const u = photoFor?.(s.title);
      if (u) photoUrls.set(s.title, u);
    }
  }
  const motifs = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...motifNames].map(async (n) => {
      const img = await rasterizeMotif(n);
      if (img) motifs.set(n, img);
    }),
  );
  const photos = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...photoUrls.entries()].map(async ([name, url]) => {
      const img = await loadImage(url, true);
      if (img) photos.set(name, img);
    }),
  );
  return { motifs, photos };
}

// ---------------------------------------------------------------------------
// Draw helpers
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
/** Progresso 0→1 di un'entrata che parte a `delay` e dura `len` secondi. */
const inAt = (t: number, delay: number, len = 0.55) => easeOut((t - delay) / len);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  opts: { bg?: string; color?: string; size?: number } = {},
) {
  const size = opts.size ?? 24;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text.toUpperCase()).width + 44;
  const h = size + 26;
  ctx.fillStyle = opts.bg ?? GOLD;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = opts.color ?? "#0d0f0c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), cx, cy + 2);
}

function drawMotifImg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  cx: number,
  cy: number,
  size: number,
  t: number,
  alpha = 1,
) {
  if (!img) return;
  const pulse = 1 + 0.025 * Math.sin(t * 1.8);
  const s = size * pulse * (0.9 + 0.1 * easeOut(t / 0.6));
  ctx.save();
  ctx.globalAlpha = alpha * clamp01(t / 0.4);
  ctx.translate(cx, cy);
  ctx.rotate(0.015 * Math.sin(t * 0.9));
  ctx.drawImage(img, -s / 2, -s / 2, s, s);
  ctx.restore();
}

function drawCirclePhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  name: string,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = "#1c2a1a";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = CREAM;
    ctx.font = `600 ${r * 0.8}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((name || "?").charAt(0).toUpperCase(), cx, cy + 2);
  }
  ctx.restore();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function fadeUpText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  t: number,
  delay: number,
  font: string,
  color: string,
  maxW?: number,
  lineH = 1.35,
): number {
  const p = inAt(t, delay);
  if (p <= 0) return y;
  ctx.save();
  ctx.globalAlpha = p;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const dy = (1 - p) * 22;
  const size = parseInt(font.match(/(\d+)px/)?.[1] ?? "24", 10);
  const lines = maxW ? wrapLines(ctx, text, maxW) : [text];
  lines.forEach((l, i) => ctx.fillText(l, x, y + dy + i * size * lineH));
  ctx.restore();
  return y + lines.length * size * lineH;
}

// ---------------------------------------------------------------------------
// Scene rendering (t = secondi locali nella scena)
// ---------------------------------------------------------------------------

function drawScene(ctx: CanvasRenderingContext2D, scene: RecapScene, t: number, assets: Assets) {
  const layout = scene.layout ?? "motif";
  const title = scene.title ?? scene.label ?? "";
  const subtitle = scene.subtitle ?? scene.caption ?? "";
  const chars = scene.characters ?? [];
  const motif = assets.motifs.get(scene.motif ?? "");
  const cx = W / 2;

  if (layout === "hero") {
    if (motif) drawMotifImg(ctx, motif, cx, H / 2, W * 0.9, t, 0.12);
    fadeUpText(ctx, "NERDUBBIO · RECAP", cx, H * 0.4, t, 0.1, "600 24px system-ui, sans-serif", GOLD);
    fadeUpText(ctx, title, cx, H * 0.46, t, 0.25, "600 62px Georgia, serif", CREAM, W - 140);
    if (subtitle) fadeUpText(ctx, subtitle, cx, H * 0.62, t, 0.5, "400 28px system-ui, sans-serif", DIM, W - 160);
    return;
  }

  if (layout === "character-card") {
    const name = chars[0]?.name || title;
    const note = chars[0]?.note || subtitle;
    const p = inAt(t, 0.1);
    ctx.save();
    ctx.globalAlpha = p;
    drawCirclePhoto(ctx, assets.photos.get(name), name, cx, H * 0.38, 130 * (0.8 + 0.2 * p));
    ctx.restore();
    fadeUpText(ctx, name, cx, H * 0.53, t, 0.3, "600 44px system-ui, sans-serif", CREAM);
    if (note) fadeUpText(ctx, note, cx, H * 0.58, t, 0.5, "400 27px system-ui, sans-serif", DIM, W - 200);
    return;
  }

  if (layout === "quote") {
    const text = scene.quote?.text || subtitle;
    const speaker = scene.quote?.speaker;
    fadeUpText(ctx, "“", cx, H * 0.3, t, 0.05, "400 120px Georgia, serif", GOLD);
    // Typewriter
    const shown = text.slice(0, Math.floor(Math.max(0, t - 0.35) / 0.035));
    ctx.font = "italic 400 38px Georgia, serif";
    ctx.fillStyle = CREAM;
    ctx.textAlign = "center";
    const lines = wrapLines(ctx, text, W - 180);
    let consumed = 0;
    lines.forEach((l, i) => {
      const part = shown.slice(consumed, consumed + l.length);
      ctx.fillText(part, cx, H * 0.37 + i * 52);
      consumed += l.length + 1;
    });
    const afterY = H * 0.37 + lines.length * 52;
    if (speaker) fadeUpText(ctx, `— ${speaker}`, cx, afterY + 30, t, 0.35 + text.length * 0.035, "600 26px system-ui, sans-serif", GOLD);
    if (title) fadeUpText(ctx, title, cx, afterY + 74, t, 0.5 + text.length * 0.035, "400 21px system-ui, sans-serif", DIM, W - 160);
    return;
  }

  if (layout === "timeline") {
    fadeUpText(ctx, title, cx, H * 0.22, t, 0.1, "600 36px system-ui, sans-serif", CREAM, W - 140);
    const items = scene.items ?? (subtitle ? [subtitle] : []);
    const x0 = 110;
    let y = H * 0.3;
    ctx.strokeStyle = "#3a4a33";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y - 10);
    ctx.lineTo(x0, y + items.length * 96 - 40);
    ctx.stroke();
    items.forEach((it, i) => {
      const p = inAt(t, 0.25 + i * 0.28);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(x0, y + 8, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "400 27px system-ui, sans-serif";
      ctx.fillStyle = CREAM;
      ctx.textAlign = "left";
      const lines = wrapLines(ctx, it, W - x0 - 140);
      lines.forEach((l, j) => ctx.fillText(l, x0 + 36, y + 16 + j * 36));
      ctx.restore();
      y += Math.max(2, lines.length) * 36 + 28;
    });
    return;
  }

  if (layout === "big-reveal") {
    const shake = t > 0.5 && t < 1.3 ? Math.sin(t * 70) * 7 : 0;
    ctx.save();
    ctx.translate(shake, 0);
    if (motif) {
      const flash = t < 1.4 ? 0.75 + 0.25 * Math.sin(t * 22) : 1;
      drawMotifImg(ctx, motif, cx, H * 0.36, W * 0.5, t, flash);
    }
    const p = inAt(t, 0.2);
    if (p > 0) {
      ctx.globalAlpha = p;
      drawChip(ctx, title, cx, H * 0.56, { bg: "#c0392b", color: CREAM, size: 26 });
      ctx.globalAlpha = 1;
    }
    if (subtitle) fadeUpText(ctx, subtitle, cx, H * 0.63, t, 0.4, "500 30px system-ui, sans-serif", CREAM, W - 160);
    ctx.restore();
    return;
  }

  if (layout === "stat") {
    fadeUpText(ctx, title, cx, H * 0.28, t, 0.1, "600 34px system-ui, sans-serif", CREAM, W - 140);
    const stats = scene.stats ?? [];
    const slot = W / Math.max(stats.length, 1);
    stats.forEach((s, i) => {
      const p = inAt(t, 0.3 + i * 0.18);
      if (p <= 0) return;
      const x = slot * i + slot / 2;
      const target = parseInt(s.value, 10);
      const numeric = Number.isFinite(target) && String(target) === s.value.trim();
      const shown = numeric ? String(Math.round(target * clamp01((t - 0.3 - i * 0.18) / 1.1))) : s.value;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.font = "700 76px system-ui, sans-serif";
      ctx.fillStyle = GOLD;
      ctx.textAlign = "center";
      ctx.fillText(shown, x, H * 0.44);
      ctx.font = "600 22px system-ui, sans-serif";
      ctx.fillStyle = DIM;
      wrapLines(ctx, s.label.toUpperCase(), slot - 30).forEach((l, j) => ctx.fillText(l, x, H * 0.48 + j * 28));
      ctx.restore();
    });
    return;
  }

  if (layout === "map") {
    drawMotifImg(ctx, assets.motifs.get(scene.motif ?? "journey"), cx, H * 0.36, W * 0.55, t);
    const p = inAt(t, 0.2);
    if (p > 0) {
      ctx.globalAlpha = p;
      drawChip(ctx, title, cx, H * 0.55, { size: 24 });
      ctx.globalAlpha = 1;
    }
    if (subtitle) fadeUpText(ctx, subtitle, cx, H * 0.62, t, 0.4, "400 27px system-ui, sans-serif", DIM, W - 180);
    return;
  }

  if (layout === "relationship-graph") {
    const a = chars[0]?.name || title;
    const b = chars[1]?.name || "";
    const y = H * 0.4;
    const p = inAt(t, 0.1);
    ctx.save();
    ctx.globalAlpha = p;
    drawCirclePhoto(ctx, assets.photos.get(a), a, W * 0.28, y, 95);
    if (b) drawCirclePhoto(ctx, assets.photos.get(b), b, W * 0.72, y, 95);
    // Linea che si disegna
    const lp = inAt(t, 0.4, 0.7);
    if (b && lp > 0) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(W * 0.28 + 100, y);
      ctx.lineTo(W * 0.28 + 100 + (W * 0.44 - 200) * lp, y);
      ctx.stroke();
    }
    ctx.restore();
    fadeUpText(ctx, a, W * 0.28, y + 135, t, 0.25, "600 26px system-ui, sans-serif", CREAM, 200);
    if (b) fadeUpText(ctx, b, W * 0.72, y + 135, t, 0.3, "600 26px system-ui, sans-serif", CREAM, 200);
    if (subtitle) fadeUpText(ctx, subtitle, cx, H * 0.58, t, 0.55, "400 28px system-ui, sans-serif", DIM, W - 160);
    return;
  }

  if (layout === "split-screen") {
    const a = chars[0];
    const b = chars[1];
    if (a && b) {
      ctx.fillStyle = "#151d13";
      ctx.fillRect(0, 0, W / 2, H);
      ctx.fillStyle = "#1d1513";
      ctx.fillRect(W / 2, 0, W / 2, H);
      [a, b].forEach((c, i) => {
        const p = inAt(t, 0.15 + i * 0.2);
        if (p <= 0) return;
        const x = W * (0.25 + i * 0.5);
        ctx.save();
        ctx.globalAlpha = p;
        drawCirclePhoto(ctx, assets.photos.get(c.name), c.name, x, H * 0.38, 90);
        ctx.restore();
        fadeUpText(ctx, c.name, x, H * 0.5, t, 0.3 + i * 0.2, "600 28px system-ui, sans-serif", CREAM, W / 2 - 50);
        if (c.note) fadeUpText(ctx, c.note, x, H * 0.545, t, 0.45 + i * 0.2, "400 22px system-ui, sans-serif", DIM, W / 2 - 60);
      });
      return;
    }
    fadeUpText(ctx, title, cx, H * 0.42, t, 0.15, "600 40px system-ui, sans-serif", CREAM, W - 140);
    if (subtitle) fadeUpText(ctx, subtitle, cx, H * 0.5, t, 0.35, "400 27px system-ui, sans-serif", DIM, W - 160);
    return;
  }

  if (layout === "threads") {
    const p0 = inAt(t, 0.05);
    if (p0 > 0) {
      ctx.globalAlpha = p0;
      drawChip(ctx, `📌 ${title}`, cx, H * 0.18, { size: 24 });
      ctx.globalAlpha = 1;
    }
    const items = scene.items ?? [];
    let y = H * 0.25;
    items.forEach((it, i) => {
      const p = inAt(t, 0.25 + i * 0.24);
      ctx.save();
      ctx.globalAlpha = p;
      const dx = (1 - p) * -60;
      ctx.font = "400 26px system-ui, sans-serif";
      const lines = wrapLines(ctx, it, W - 240);
      const boxH = lines.length * 34 + 30;
      ctx.fillStyle = "rgba(224,165,46,0.08)";
      ctx.strokeStyle = "rgba(224,165,46,0.35)";
      ctx.lineWidth = 2;
      roundRect(ctx, 70 + dx, y, W - 140, boxH, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.textAlign = "left";
      ctx.font = "700 26px system-ui, sans-serif";
      ctx.fillText(`${i + 1}.`, 92 + dx, y + 36);
      ctx.font = "400 26px system-ui, sans-serif";
      ctx.fillStyle = CREAM;
      lines.forEach((l, j) => ctx.fillText(l, 132 + dx, y + 36 + j * 34));
      ctx.restore();
      y += boxH + 16;
    });
    if (subtitle) fadeUpText(ctx, subtitle, cx, y + 40, t, 0.4 + items.length * 0.24, "600 27px system-ui, sans-serif", GOLD, W - 150);
    return;
  }

  if (layout === "ending") {
    // Pulviscolo dorato
    for (let i = 0; i < 16; i++) {
      const speed = 55 + (i % 5) * 22;
      const px = ((i * 47.3 + 30) % (W - 40)) + 20;
      const py = H - (((t + i * 1.7) * speed) % (H + 60));
      const alpha = clamp01(1.4 - (H - py) / H) * 0.7;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(px, py, i % 3 === 0 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    fadeUpText(ctx, "FINE", cx, H * 0.42, t, 0.1, "600 24px system-ui, sans-serif", GOLD);
    fadeUpText(ctx, title, cx, H * 0.48, t, 0.3, "600 48px Georgia, serif", CREAM, W - 150);
    if (subtitle) fadeUpText(ctx, subtitle, cx, H * 0.58, t, 0.55, "400 27px system-ui, sans-serif", DIM, W - 170);
    return;
  }

  // default: motif
  drawMotifImg(ctx, motif ?? assets.motifs.get("person"), cx, H * 0.4, W * 0.66, t);
  const p = inAt(t, 0.2);
  if (title && p > 0) {
    ctx.globalAlpha = p;
    drawChip(ctx, title, cx, H * 0.66, { size: 22 });
    ctx.globalAlpha = 1;
  }
  if (subtitle) fadeUpText(ctx, subtitle, cx, H * 0.72, t, 0.4, "500 29px system-ui, sans-serif", CREAM, W - 130);
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  scenes: RecapScene[],
  elapsedMs: number,
  totalMs: number,
  assets: Assets,
) {
  // Sfondo + vignetta
  ctx.globalAlpha = 1;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Scena attiva + dissolvenza incrociata di 320ms
  let acc = 0;
  let idx = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (elapsedMs < acc + scenes[i]!.dur) { idx = i; break; }
    acc += scenes[i]!.dur;
    idx = i;
  }
  const scene = scenes[idx]!;
  const tLocal = (elapsedMs - acc) / 1000;
  const fadeIn = clamp01(tLocal / 0.32);
  const fadeOut = clamp01((scenes[idx]!.dur / 1000 - tLocal) / 0.32);
  ctx.globalAlpha = Math.min(fadeIn, fadeOut);
  drawScene(ctx, scene, tLocal, assets);
  ctx.globalAlpha = 1;

  // Chip episodio
  if (scene.ep) {
    const p = inAt(tLocal, 0.15);
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(p, Math.min(fadeIn, fadeOut));
      drawChip(ctx, `EP. ${scene.ep}`, 92, 112, { size: 17 });
      ctx.restore();
    }
  }

  // Vignetta
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Barra progresso + brand
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  roundRect(ctx, 56, 74, W - 112, 6, 3);
  ctx.fill();
  ctx.fillStyle = GOLD;
  roundRect(ctx, 56, 74, (W - 112) * clamp01(elapsedMs / totalMs), 6, 3);
  ctx.fill();
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillStyle = "rgba(242,239,228,0.55)";
  ctx.textAlign = "center";
  ctx.fillText("Nerdubbio", W / 2, H - 46);
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

function pickMime(): { mime: string; ext: string } {
  const candidates: [string, string][] = [
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return { mime: "", ext: "webm" };
}

export async function exportRecapVideo(opts: {
  scenes: RecapScene[];
  mood: Mood;
  canvas: HTMLCanvasElement;
  photoFor?: (name: string) => string | undefined;
  onProgress: (pct: number) => void;
  handle: ExportHandle;
}): Promise<{ blob: Blob; ext: string } | null> {
  const { scenes, canvas, photoFor, onProgress, handle } = opts;
  if (typeof MediaRecorder === "undefined" || !canvas.captureStream) return null;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const assets = await preloadAssets(scenes, photoFor);
  if (handle.cancelled) return null;

  const totalMs = scenes.reduce((s, sc) => s + sc.dur, 0);
  const stream = canvas.captureStream(FPS);

  // Musica nel video (stesso mp3 del reel, mixato via WebAudio; best-effort).
  let audioCtx: AudioContext | null = null;
  try {
    const resp = await fetch(MUSIC_SRC[opts.mood]);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      audioCtx = new AudioContext();
      const audioBuf = await audioCtx.decodeAudioData(buf);
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuf;
      src.loop = true;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.45;
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(gain).connect(dest);
      src.start();
      const track = dest.stream.getAudioTracks()[0];
      if (track) stream.addTrack(track);
    }
  } catch {
    /* niente musica: il video esce comunque */
  }

  const { mime } = pickMime();
  const { ext } = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_500_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
  rec.start(500);

  // Se l'app va in background (cambio tab/schermo bloccato) rAF si ferma ma il
  // wall-clock no: senza pausa il video uscirebbe con lunghi tratti congelati.
  // Qui mettiamo in pausa la registrazione e scaliamo il tempo perso.
  let pausedTotal = 0;
  let hiddenAt = 0;
  const onVisibility = () => {
    try {
      if (document.hidden) {
        hiddenAt = performance.now();
        if (rec.state === "recording") rec.pause();
      } else {
        if (hiddenAt) pausedTotal += performance.now() - hiddenAt;
        hiddenAt = 0;
        if (rec.state === "paused") rec.resume();
      }
    } catch { /* best effort */ }
  };
  document.addEventListener("visibilitychange", onVisibility);

  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (document.hidden) { setTimeout(tick, 250); return; }
      const elapsed = performance.now() - t0 - pausedTotal;
      if (handle.cancelled || elapsed >= totalMs + 300) { resolve(); return; }
      drawFrame(ctx, scenes, Math.min(elapsed, totalMs - 1), totalMs, assets);
      onProgress(clamp01(elapsed / totalMs));
      requestAnimationFrame(tick);
    };
    tick();
  });

  document.removeEventListener("visibilitychange", onVisibility);
  if (rec.state === "paused") { try { rec.resume(); } catch { /* ignore */ } }
  rec.stop();
  await done;
  try { await audioCtx?.close(); } catch { /* ignore */ }
  stream.getTracks().forEach((tr) => tr.stop());

  if (handle.cancelled) return null;
  onProgress(1);
  return { blob: new Blob(chunks, { type: mime || "video/webm" }), ext };
}
