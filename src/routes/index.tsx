import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Gamepad2, Layers, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/nerdubbio/Wordmark";
import { TmdbAttribution } from "@/components/nerdubbio/TmdbAttribution";
import { LandingBackdrop, NerdHudStrip, NerdTags } from "@/components/nerdubbio/LandingDecor";
import { useUserStore } from "@/lib/user-store";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nerdubbio — Nerdacolo del binge" },
      {
        name: "description",
        content: "Traccia anime, serie e film come un completionist. Quiz nerd stile Akinator per scegliere la main quest di stasera.",
      },
      { property: "og:title", content: "Nerdubbio — Nerdacolo del binge" },
      {
        property: "og:description",
        content: "4 serie in parallelo e zero certezze? Nerdacolo calcola il match perfetto per stasera.",
      },
      { name: "theme-color", content: "#a855f7" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { state: userState } = useUserStore();
  const storeLang = userState.language;
  const [lang, setLang] = useState<"it" | "en">(storeLang ?? "it");

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = (navigator.language || "it").toLowerCase();
    setLang(storeLang ?? (nav.startsWith("it") ? "it" : "en"));
  }, [storeLang]);

  useEffect(() => {
    if (authLoading || !user) return;
    navigate({ to: "/app", replace: true });
  }, [authLoading, user, navigate]);

  const isIt = lang === "it";
  const toggleLang = () => setLang(isIt ? "en" : "it");

  const t = isIt
    ? {
        signIn: "Login",
        enter: "Entra nel party",
        badge: "Side quest: cosa guardo stasera?",
        h1a: "Hai ",
        h1accent: "4 serie aperte",
        h1b: " e zero idea del prossimo episodio?",
        h1c: "Nerdacolo ha già rollato i dadi.",
        lede: "Nerdubbio è il tracker per completionist: anime, sci-fi, comfort rewatch — tutto in un loadout. Quando serve la main quest, ~7 domande nerd dinamiche e un match % (giudichiamo, sì).",
        ctaQuest: "Lancia la Quest",
        ctaApp: "Apri il loadout",
        hud: { lvl: "Il tuo livello binge", eps: "Episodi tracciati", streak: "Giorni consecutivi" },
        tags: ["#maratona", "#sci-fi", "#anime", "#comfort-rewatch", "#no-spoiler"],
        features: [
          {
            icon: Layers,
            emoji: "📺",
            title: "Loadout serie & film",
            desc: "Stagioni, episodi, film — mai più «aspetta, ero al 3×07 o al 4×02?» a metà season finale.",
            accent: "from-cyan-400/20 to-transparent border-cyan-400/30",
          },
          {
            icon: Sparkles,
            emoji: "🎲",
            title: "Main Quest — quiz nerd",
            desc: "Mood, genere, tempo a disposizione: domande da sala giochi, scelte da Nerdacolo. Output: 1 main quest + 2 backup save.",
            accent: "from-fuchsia-400/20 to-transparent border-fuchsia-400/30",
          },
          {
            icon: Zap,
            emoji: "⚡",
            title: "XP, streak & badge",
            desc: "Ogni episodio = XP. Streak da vero binge warrior. Badge sbloccabili (Plot Twist Survivor incluso).",
            accent: "from-violet-400/20 to-transparent border-violet-400/30",
          },
        ],
        migrate: "Arrivi da TV Time?",
        migrateCta: "Importa il save",
        footer: "Alternativa nerd a TV Time · Zero spoiler · Made with ☕ e troppi cliffhanger",
      }
    : {
        signIn: "Sign in",
        enter: "Join the party",
        badge: "Side quest: what am I watching tonight?",
        h1a: "Got ",
        h1accent: "4 shows running",
        h1b: " and no clue what's next?",
        h1c: "Nerdacolo already rolled the dice.",
        lede: "Nerdoubt is the completionist tracker: anime, sci-fi, comfort rewatches — one loadout. When you need tonight's main quest, ~7 dynamic nerd questions and a match % (yes, we judge).",
        ctaQuest: "Start the Quest",
        ctaApp: "Open loadout",
        hud: { lvl: "Your binge level", eps: "Episodes tracked", streak: "Day streak" },
        tags: ["#binge", "#sci-fi", "#anime", "#comfort-rewatch", "#no-spoilers"],
        features: [
          {
            icon: Layers,
            emoji: "📺",
            title: "Series & movie loadout",
            desc: "Seasons, episodes, films — never again «wait, was I on 3×07 or 4×02?» mid-finale.",
            accent: "from-cyan-400/20 to-transparent border-cyan-400/30",
          },
          {
            icon: Sparkles,
            emoji: "🧞",
            title: "Main Quest — nerd quiz",
            desc: "Mood, genre, time on hand: arcade-style questions from Nerdacolo. Output: 1 main quest + 2 backup saves.",
            accent: "from-fuchsia-400/20 to-transparent border-fuchsia-400/30",
          },
          {
            icon: Zap,
            emoji: "⚡",
            title: "XP, streaks & badges",
            desc: "Every episode = XP. Streaks for true binge warriors. Unlockables included (Plot Twist Survivor).",
            accent: "from-violet-400/20 to-transparent border-violet-400/30",
          },
        ],
        migrate: "Coming from TV Time?",
        migrateCta: "Import your save",
        footer: "Nerd alternative to TV Time · Spoiler-free · Fueled by ☕ and cliffhangers",
      };

  return (
    <div className="relative min-h-screen">
      <LandingBackdrop />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-safe pb-5 pt-safe">
        <Link
          to="/"
          aria-label={isIt ? "Nerdubbio home" : "Nerdoubt home"}
          className="flex items-center text-foreground"
        >
          <Wordmark lang={lang} withIcon className="h-8 sm:h-9 drop-shadow-[0_0_18px_rgba(168,85,247,0.35)]" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={isIt ? "Switch to English" : "Passa all'italiano"}
            className="rounded-md border border-cyan-400/30 bg-surface/60 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300/90 hover:bg-surface-2"
          >
            {isIt ? "EN" : "IT"}
          </button>
          <Link to="/auth" className="hidden rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline">
            {t.signIn}
          </Link>
          <Link
            to="/app"
            className="rounded-lg border border-primary/40 bg-hero px-4 py-2 font-display text-sm font-bold text-primary-foreground shadow-glow"
          >
            {t.enter}
          </Link>
        </div>
      </header>

      {/* Hero — frame CRT / game UI */}
      <section className="relative mx-auto max-w-3xl px-4 pb-8 pt-6 text-center sm:pt-10">
        <div className="relative mx-auto rounded-2xl border-2 border-primary/25 bg-surface/40 p-6 shadow-[0_0_40px_-12px_oklch(0.68_0.25_305_/_0.5)] backdrop-blur-sm sm:p-10">
          {/* corner accents */}
          <span className="absolute left-3 top-3 h-3 w-3 border-l-2 border-t-2 border-cyan-400/60" />
          <span className="absolute right-3 top-3 h-3 w-3 border-r-2 border-t-2 border-cyan-400/60" />
          <span className="absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2 border-cyan-400/60" />
          <span className="absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2 border-cyan-400/60" />

          <Wordmark
            lang={lang}
            withIcon
            className="mx-auto mb-5 text-foreground h-12 sm:h-14 drop-shadow-[0_0_28px_rgba(168,85,247,0.4)]"
          />

          <span className="inline-flex items-center gap-2 rounded-md border border-accent/35 bg-accent/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
            <Gamepad2 className="h-3 w-3" aria-hidden />
            {t.badge}
          </span>

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.25rem]">
            {t.h1a}
            <span className="text-gradient">{t.h1accent}</span>
            {t.h1b}
            <br />
            <span className="text-lg font-bold text-muted-foreground sm:text-xl">{t.h1c}</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.lede}
          </p>

          <NerdTags tags={t.tags} />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dubbio"
              className="rounded-lg bg-hero px-6 py-3 font-display text-sm font-bold text-primary-foreground shadow-glow-pink transition hover:brightness-110"
            >
              {t.ctaQuest}
            </Link>
            <Link
              to="/app"
              className="rounded-lg border border-border bg-surface/80 px-6 py-3 font-display text-sm font-semibold transition hover:border-primary/40 hover:bg-surface-2"
            >
              {t.ctaApp}
            </Link>
          </div>

          <NerdHudStrip labels={t.hud} />
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 pb-12 sm:grid-cols-3">
        {t.features.map((f, i) => (
          <article
            key={i}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${f.accent} p-6 backdrop-blur-sm transition hover:scale-[1.02] hover:shadow-glow`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-surface/80 text-xl shadow-inner">
                {f.emoji}
              </span>
              <f.icon className="h-5 w-5 text-muted-foreground/50 transition group-hover:text-accent" aria-hidden />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </article>
        ))}
      </section>

      {/* TV Time migration strip */}
      <section className="relative mx-auto max-w-lg px-4 pb-16">
        <Link
          to="/da-tvtime"
          className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-accent/40 bg-accent/5 px-5 py-4 transition hover:border-accent/60 hover:bg-accent/10"
        >
          <div className="text-left">
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">{t.migrate}</p>
            <p className="mt-0.5 text-sm font-semibold">{t.migrateCta} →</p>
          </div>
          <span className="text-2xl" aria-hidden>📦</span>
        </Link>
      </section>

      <footer className="relative mx-auto max-w-5xl space-y-6 px-4 pb-10">
        <TmdbAttribution compact />
        <p className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {isIt ? "Nerdubbio" : "Nerdoubt"} · {t.footer}
        </p>
      </footer>
    </div>
  );
}
