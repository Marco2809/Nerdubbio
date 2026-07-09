/**
 * Musica di sottofondo del recap, sintetizzata nel browser (Web Audio API).
 * Nessun file, nessun copyright: un tappeto ambient (pad + basso + arpeggio)
 * con timbro/scala/tempo diversi in base al mood del genere.
 */

export type Mood = "tense" | "epic" | "warm" | "light" | "neutral";

interface Preset {
  rootHz: number;
  chord: number[];
  scale: number[];
  wave: OscillatorType;
  arpWave: OscillatorType;
  cutoff: number;
  tempo: number; // ms tra una nota d'arpeggio e l'altra
  arpGain: number;
}

const PRESETS: Record<Mood, Preset> = {
  tense: { rootHz: 110.0, chord: [0, 3, 7], scale: [0, 3, 5, 7, 10], wave: "sawtooth", arpWave: "triangle", cutoff: 620, tempo: 900, arpGain: 0.12 },
  epic: { rootHz: 130.81, chord: [0, 7, 12], scale: [0, 3, 5, 7, 10, 12], wave: "sawtooth", arpWave: "square", cutoff: 1100, tempo: 540, arpGain: 0.09 },
  warm: { rootHz: 146.83, chord: [0, 4, 7], scale: [0, 2, 4, 7, 9, 12], wave: "triangle", arpWave: "sine", cutoff: 1400, tempo: 800, arpGain: 0.15 },
  light: { rootHz: 174.61, chord: [0, 4, 7], scale: [0, 2, 4, 7, 9, 12], wave: "triangle", arpWave: "triangle", cutoff: 2200, tempo: 440, arpGain: 0.11 },
  neutral: { rootHz: 130.81, chord: [0, 4, 7], scale: [0, 2, 4, 7, 9, 12], wave: "triangle", arpWave: "sine", cutoff: 1600, tempo: 720, arpGain: 0.13 },
};

const MOOD_KEYWORDS: [Mood, string[]][] = [
  ["tense", ["thrill", "suspense", "horror", "terror", "horreur", "épouvante", "crim", "crimen", "krimi", "policier", "poliz", "myst", "mister", "mystè", "war", "guerr", "guerr", "krieg", "bélico"]],
  ["epic", ["sci-fi", "science f", "fantasc", "ciencia f", "fantas", "adventur", "avventur", "aventur", "abenteuer", "action", "azione", "acci", "aventure"]],
  ["warm", ["dram", "roman", "sentiment", "liebe", "romantik", "famil", "famigl", "familie"]],
  ["light", ["comed", "commed", "komö", "coméd", "anim", "music", "música", "musik"]],
];

export function moodFromGenres(genres: string[] | undefined): Mood {
  const hay = (genres ?? []).join(" ").toLowerCase();
  for (const [mood, keys] of MOOD_KEYWORDS) {
    if (keys.some((k) => hay.includes(k))) return mood;
  }
  return "neutral";
}

const freq = (root: number, semi: number) => root * Math.pow(2, semi / 12);

/** WAV muto: serve solo a spostare la sessione audio iOS su "playback". */
function makeSilentWavUrl(): string {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1s di silenzio, in loop
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

export class RecapMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private timer: number | null = null;
  private muted = false;
  private silentEl: HTMLAudioElement | null = null;
  private silentUrl: string | null = null;
  private readonly preset: Preset;

  constructor(mood: Mood) {
    this.preset = PRESETS[mood];
  }

  start(): void {
    if (this.ctx) return;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    void ctx.resume();

    // iOS: un <audio> in riproduzione porta la sessione audio in "playback",
    // così il Web Audio non viene silenziato dall'interruttore muto.
    try {
      const url = makeSilentWavUrl();
      const el = document.createElement("audio");
      el.loop = true;
      el.setAttribute("playsinline", "");
      el.volume = 0.001;
      el.src = url;
      void el.play().catch(() => undefined);
      this.silentEl = el;
      this.silentUrl = url;
    } catch {
      /* nessun unlock disponibile */
    }

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.16;
    master.connect(ctx.destination);
    this.master = master;

    const p = this.preset;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = p.cutoff;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.45;
    filter.connect(padGain);
    padGain.connect(master);

    for (const semi of p.chord) {
      const o = ctx.createOscillator();
      o.type = p.wave;
      o.frequency.value = freq(p.rootHz, semi);
      o.detune.value = Math.random() * 10 - 5;
      o.connect(filter);
      o.start();
      this.nodes.push(o);
    }

    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.value = p.rootHz / 2;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.22;
    bass.connect(bassGain);
    bassGain.connect(master);
    bass.start();
    this.nodes.push(bass);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.cutoff * 0.4;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.nodes.push(lfo);

    let i = 0;
    const pattern = [0, 2, 1, 3, 2, 4, 3, 1];
    this.timer = window.setInterval(() => {
      const p2 = this.preset;
      const deg = p2.scale[pattern[i % pattern.length]! % p2.scale.length]!;
      const oct = i % 16 >= 8 ? 12 : 0;
      const o = ctx.createOscillator();
      o.type = p2.arpWave;
      o.frequency.value = freq(p2.rootHz, deg + oct + 12);
      const g = ctx.createGain();
      o.connect(g);
      g.connect(master);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(p2.arpGain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t);
      o.stop(t + 0.56);
      i++;
    }, p.tempo);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.16, this.ctx.currentTime + 0.12);
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* già fermato */
      }
    }
    this.nodes = [];
    if (this.silentEl) {
      try {
        this.silentEl.pause();
      } catch {
        /* già fermo */
      }
      this.silentEl.src = "";
      this.silentEl = null;
    }
    if (this.silentUrl) {
      URL.revokeObjectURL(this.silentUrl);
      this.silentUrl = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.master = null;
  }
}
