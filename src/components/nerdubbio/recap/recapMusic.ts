/**
 * Musica di sottofondo del recap: loop audio royalty-free scelti per mood.
 * I file vanno in public/recap-music/<mood>.mp3 (vedi SRC). Se un file manca,
 * il play fallisce in silenzio senza rompere nulla.
 *
 * Nota iOS: un <audio> reale riproduce nella sessione "playback", quindi NON
 * viene silenziato dall'interruttore muto (a differenza del Web Audio).
 */

export type Mood = "tense" | "epic" | "warm" | "light" | "neutral";

const SRC: Record<Mood, string> = {
  tense: "/recap-music/tense.mp3",
  epic: "/recap-music/epic.mp3",
  warm: "/recap-music/warm.mp3",
  light: "/recap-music/light.mp3",
  neutral: "/recap-music/neutral.mp3",
};

const BASE_VOLUME = 0.5;

const MOOD_KEYWORDS: [Mood, string[]][] = [
  ["tense", ["thrill", "suspense", "horror", "terror", "horreur", "épouvante", "crim", "crimen", "krimi", "policier", "poliz", "myst", "mister", "mystè", "war", "guerr", "krieg", "bélico"]],
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

export class RecapMusic {
  private el: HTMLAudioElement | null = null;
  private fadeTimer: number | null = null;
  private muted = false;
  private readonly src: string;

  constructor(mood: Mood) {
    this.src = SRC[mood];
  }

  start(): void {
    if (this.el) return;
    try {
      const el = new Audio(this.src);
      el.loop = true;
      el.preload = "auto";
      el.setAttribute("playsinline", "");
      el.volume = 0;
      this.el = el;
      void el
        .play()
        .then(() => this.fadeTo(this.muted ? 0 : BASE_VOLUME, 700))
        .catch(() => undefined);
    } catch {
      /* audio non disponibile */
    }
  }

  private fadeTo(target: number, ms: number): void {
    const el = this.el;
    if (!el) return;
    if (this.fadeTimer !== null) clearInterval(this.fadeTimer);
    const from = el.volume;
    const steps = Math.max(1, Math.round(ms / 40));
    let i = 0;
    this.fadeTimer = window.setInterval(() => {
      i++;
      el.volume = Math.min(1, Math.max(0, from + (target - from) * (i / steps)));
      if (i >= steps && this.fadeTimer !== null) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 40);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.el) this.fadeTo(muted ? 0 : BASE_VOLUME, 200);
  }

  stop(): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.el) {
      try {
        this.el.pause();
      } catch {
        /* già fermo */
      }
      this.el.src = "";
      this.el = null;
    }
  }
}
