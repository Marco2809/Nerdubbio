import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Gamepad2, Layers, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/nerdubbio/Wordmark";
import { TmdbAttribution } from "@/components/nerdubbio/TmdbAttribution";
import { LandingBackdrop, NerdHudStrip, NerdTags } from "@/components/nerdubbio/LandingDecor";
import { useUserStore } from "@/lib/user-store";
import { useAuth } from "@/lib/auth";
import { I18nProvider, LOCALES, LOCALE_LABELS, normalizeLocale, useI18n, type Locale } from "@/lib/i18n";

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
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  }),
  component: LandingWrapper,
});

function LandingWrapper() {
  const { state: userState } = useUserStore();
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(userState.language));

  useEffect(() => {
    if (userState.language) {
      setLocale(normalizeLocale(userState.language));
      return;
    }
    if (typeof navigator !== "undefined") {
      setLocale(normalizeLocale(navigator.language.slice(0, 2)));
    }
  }, [userState.language]);

  const cycleLocale = () => {
    const i = LOCALES.indexOf(locale);
    setLocale(LOCALES[(i + 1) % LOCALES.length]!);
  };

  return (
    <I18nProvider locale={locale}>
      <Landing onCycleLocale={cycleLocale} locale={locale} />
    </I18nProvider>
  );
}

function Landing({ onCycleLocale, locale }: { onCycleLocale: () => void; locale: Locale }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    navigate({ to: "/app", replace: true });
  }, [authLoading, user, navigate]);

  const tags = locale === "it"
    ? ["#maratona", "#sci-fi", "#anime", "#comfort-rewatch", "#no-spoiler"]
    : ["#binge", "#sci-fi", "#anime", "#comfort-rewatch", "#no-spoilers"];

  const features = [
    {
      icon: Layers,
      emoji: "📺",
      title: t("landing.featureLoadoutTitle"),
      desc: t("landing.featureLoadoutDesc"),
      accent: "from-cyan-400/20 to-transparent border-cyan-400/30",
    },
    {
      icon: Sparkles,
      emoji: "🎲",
      title: t("landing.featureQuestTitle"),
      desc: t("landing.featureQuestDesc"),
      accent: "from-fuchsia-400/20 to-transparent border-fuchsia-400/30",
    },
    {
      icon: Zap,
      emoji: "⚡",
      title: t("landing.featureXpTitle"),
      desc: t("landing.featureXpDesc"),
      accent: "from-violet-400/20 to-transparent border-violet-400/30",
    },
  ];

  return (
    <div className="relative min-h-screen">
      <LandingBackdrop />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-safe pb-5 pt-safe">
        <Link
          to="/"
          aria-label={`${t("brand.name")} home`}
          className="flex items-center text-foreground"
        >
          <Wordmark lang={locale} withIcon className="h-8 sm:h-9 drop-shadow-[0_0_18px_rgba(168,85,247,0.35)]" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCycleLocale}
            aria-label={t("landing.switchLang")}
            title={LOCALE_LABELS[locale]}
            className="rounded-md border border-cyan-400/30 bg-surface/60 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300/90 hover:bg-surface-2"
          >
            {locale.toUpperCase()}
          </button>
          <Link to="/auth" className="hidden rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline">
            {t("landing.signIn")}
          </Link>
          <Link
            to="/app"
            className="rounded-lg border border-primary/40 bg-hero px-4 py-2 font-display text-sm font-bold text-primary-foreground shadow-glow"
          >
            {t("landing.enter")}
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-3xl px-4 pb-8 pt-6 text-center sm:pt-10">
        <div className="relative mx-auto rounded-2xl border-2 border-primary/25 bg-surface/40 p-6 shadow-[0_0_40px_-12px_oklch(0.68_0.25_305_/_0.5)] backdrop-blur-sm sm:p-10">
          <span className="absolute left-3 top-3 h-3 w-3 border-l-2 border-t-2 border-cyan-400/60" />
          <span className="absolute right-3 top-3 h-3 w-3 border-r-2 border-t-2 border-cyan-400/60" />
          <span className="absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2 border-cyan-400/60" />
          <span className="absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2 border-cyan-400/60" />

          <Wordmark
            lang={locale}
            withIcon
            className="mx-auto mb-5 text-foreground h-12 sm:h-14 drop-shadow-[0_0_28px_rgba(168,85,247,0.4)]"
          />

          <span className="inline-flex items-center gap-2 rounded-md border border-accent/35 bg-accent/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
            <Gamepad2 className="h-3 w-3" aria-hidden />
            {t("landing.badge")}
          </span>

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.25rem]">
            {t("landing.h1a")}
            <span className="text-gradient">{t("landing.h1accent")}</span>
            {t("landing.h1b")}
            <br />
            <span className="text-lg font-bold text-muted-foreground sm:text-xl">{t("landing.h1c")}</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("landing.lede")}
          </p>

          <NerdTags tags={tags} />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dubbio"
              className="rounded-lg bg-hero px-6 py-3 font-display text-sm font-bold text-primary-foreground shadow-glow-pink transition hover:brightness-110"
            >
              {t("landing.ctaQuest")}
            </Link>
            <Link
              to="/app"
              className="rounded-lg border border-border bg-surface/80 px-6 py-3 font-display text-sm font-semibold transition hover:border-primary/40 hover:bg-surface-2"
            >
              {t("landing.ctaApp")}
            </Link>
          </div>

          <NerdHudStrip labels={{ lvl: t("landing.hudLvl"), eps: t("landing.hudEps"), streak: t("landing.hudStreak") }} />
        </div>
      </section>

      <section className="relative mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 pb-12 sm:grid-cols-3">
        {features.map((f, i) => (
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

      <section className="relative mx-auto max-w-lg px-4 pb-16">
        <Link
          to="/da-tvtime"
          className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-accent/40 bg-accent/5 px-5 py-4 transition hover:border-accent/60 hover:bg-accent/10"
        >
          <div className="text-left">
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">{t("landing.migrate")}</p>
            <p className="mt-0.5 text-sm font-semibold">{t("landing.migrateCta")} →</p>
          </div>
          <span className="text-2xl" aria-hidden>📦</span>
        </Link>
      </section>

      <footer className="relative mx-auto max-w-5xl space-y-6 px-4 pb-10">
        <TmdbAttribution compact />
        <p className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("brand.name")} · {t("landing.footer")}
        </p>
      </footer>
    </div>
  );
}
