import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, Tv, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/nerdubbio/Wordmark";
import { useUserStore } from "@/lib/user-store";
import { useAuth } from "@/lib/auth";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nerdubbio — Il Genio del Dubbio Nerd" },
      { name: "description", content: "Traccia serie e film, risolvi il dubbio 'cosa guardo stasera' con un quiz nerd stile Akinator. Alternativa moderna a TV Time." },
      { property: "og:title", content: "Nerdubbio — Il Genio del Dubbio Nerd" },
      { property: "og:description", content: "Non sai cosa vedere? È letteralmente il nostro lavoro." },
      { name: "theme-color", content: "#a855f7" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.ico" },
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

  // Se l'utente non ha ancora impostato una lingua (o non è loggato),
  // rileva dal browser una volta lato client.
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
        signIn: "Accedi", enter: "Entra",
        tagline: BRAND.tagline,
        h1a: "Hai un ", h1accent: "dubbio nerd?", h1b: "Il Genio ci pensa.",
        lede: "Traccia serie TV, stagioni e film. Rispondi a 10 domande simpatiche e ironiche. Ricevi il consiglio giusto per stasera, con un match percentuale sui tuoi gusti (discutibili).",
        ctaGenio: "Prova il Genio", ctaApp: "Entra nell'app",
        features: [
          { icon: Tv, title: "Traccia tutto", desc: "Serie, stagioni, episodi e film. Sapere a che episodio sei era il minimo." },
          { icon: Sparkles, title: "Risolvi il Dubbio", desc: "Quiz stile Akinator, 10 domande nerd. Consiglio + 2 alternative." },
          { icon: Trophy, title: "Livella", desc: "XP, badge e statistiche. Uscire di casa era sopravvalutato." },
        ],
        footer: "Alternativa moderna a TV Time · Made with ☕ e crisi esistenziali",
      }
    : {
        signIn: "Sign in", enter: "Enter",
        tagline: "The Nerd Doubt Genie",
        h1a: "Got a ", h1accent: "nerd doubt?", h1b: "The Genie has answers.",
        lede: "Track shows, seasons and movies. Answer 10 tongue-in-cheek questions. Get tonight's pick, with a match score for your (questionable) taste.",
        ctaGenio: "Try the Genie", ctaApp: "Enter the app",
        features: [
          { icon: Tv, title: "Track it all", desc: "Shows, seasons, episodes and movies. Knowing which episode you're on is the bare minimum." },
          { icon: Sparkles, title: "Solve the Doubt", desc: "Akinator-style quiz, 10 nerd questions. One pick + 2 alternatives." },
          { icon: Trophy, title: "Level up", desc: "XP, badges and stats. Leaving the house was overrated anyway." },
        ],
        footer: "A modern alternative to TV Time · Made with ☕ and existential crises",
      };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" aria-label={isIt ? "Nerdubbio home" : "Nerdoubt home"} className="flex items-center">
          <Wordmark lang={lang} priority className="h-8 w-auto drop-shadow-[0_0_18px_rgba(236,72,153,0.35)] sm:h-9" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={isIt ? "Switch to English" : "Passa all'italiano"}
            className="rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            {isIt ? "EN" : "IT"}
          </button>
          <Link to="/auth" className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">{t.signIn}</Link>
          <Link to="/app" className="rounded-full bg-hero px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">{t.enter}</Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Wordmark lang={lang} priority className="mx-auto mb-6 h-16 w-auto drop-shadow-[0_0_28px_rgba(236,72,153,0.45)] sm:h-20" />
        <span className="inline-block rounded-full border border-border bg-surface/60 px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
          {t.tagline}
        </span>
        <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] sm:text-6xl">
          {t.h1a}<span className="text-gradient">{t.h1accent}</span><br/>{t.h1b}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t.lede}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dubbio" className="rounded-full bg-hero px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow-pink">
            {t.ctaGenio}
          </Link>
          <Link to="/app" className="rounded-full border border-border bg-surface/60 px-6 py-3 text-sm font-semibold">
            {t.ctaApp}
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 pb-24 sm:grid-cols-3">
        {t.features.map((f, i) => (
          <div key={i} className="glass rounded-3xl p-6">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-neon shadow-glow">
              <f.icon className="h-5 w-5 text-primary-foreground" />
            </span>
            <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-xs text-muted-foreground">
        {isIt ? "Nerdubbio" : "Nerdoubt"} · {t.footer}

      </footer>
    </div>
  );
}
