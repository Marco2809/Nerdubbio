import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useUserStore } from "@/lib/user-store";
import { Sparkles, Check, ArrowLeft, ArrowRight, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { tmdbTrending, type TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { Wordmark } from "@/components/nerdubbio/Wordmark";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — Nerdubbio" }] }),
  component: Onboarding,
});

const GENRES = [
  "Sci-Fi","Drama","Comedy","Fantasy","Thriller","Action",
  "Animation","Romance","Mystery","Crime","Horror","Musical",
];

/** Domande "Dubbio nerd" ironiche per profilare mood iniziale. */
const DUBBIO = [
  {
    id: "tone",
    q: "Stasera vuoi ridere, piangere o sospettare di tutti?",
    sub: "Nessuna risposta sbagliata. Ci giudichiamo tutti a vicenda.",
    choices: [
      { label: "Ridere fino alle lacrime", emoji: "😂", moods: ["funny", "cozy"] },
      { label: "Piangere in modo elegante", emoji: "😭", moods: ["sad", "romantic"] },
      { label: "Sospettare di tutti", emoji: "🕵️", moods: ["thriller", "mind-bending"] },
      { label: "Sentirmi epico", emoji: "⚔️", moods: ["epic", "action"] },
    ],
  },
  {
    id: "brain",
    q: "Quanto cervello vuoi usare?",
    sub: "Il Genio ti giudica ma non ti abbandona.",
    choices: [
      { label: "Zero. Coperta e patatine.", emoji: "🛋️", moods: ["cozy", "funny"] },
      { label: "Il giusto per non annoiarmi", emoji: "🧠", moods: ["slow-burn"] },
      { label: "Voglio una crisi esistenziale", emoji: "🌀", moods: ["mind-bending", "dark"] },
    ],
  },
  {
    id: "length",
    q: "Impegno richiesto?",
    sub: "Serve saperlo prima, poi è tardi.",
    choices: [
      { label: "Chiuso in una serata", emoji: "⏱️", moods: ["short"] },
      { label: "Una mini-serie, 6-10 ore", emoji: "📺", moods: ["short", "binge"] },
      { label: "Vita nuova, 7 stagioni", emoji: "♾️", moods: ["binge", "epic"] },
    ],
  },
] as const;

type StepKey = "welcome" | "lang" | "genres" | "dubbio" | "seen" | "done";
const STEPS: StepKey[] = ["welcome", "lang", "genres", "dubbio", "seen", "done"];

function Onboarding() {
  const navigate = useNavigate();
  const { update } = useUserStore();
  const [stepIdx, setStepIdx] = useState(0);
  const [lang, setLang] = useState<"it" | "en">("it");
  const [genres, setGenres] = useState<string[]>([]);
  const [seen, setSeen] = useState<TmdbItem[]>([]);
  const [dubbioIdx, setDubbioIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const trendingQ = useQuery({
    queryKey: ["tmdb", "trending", "week"],
    queryFn: () => tmdbTrending({ data: { window: "week" } }),
    staleTime: 1000 * 60 * 30,
  });
  const trendingItems = trendingQ.data?.items ?? [];
  const toggleSeen = (item: TmdbItem) =>
    setSeen((prev) =>
      prev.some((x) => x.id === item.id) ? prev.filter((x) => x.id !== item.id) : [...prev, item],
    );

  const step = STEPS[stepIdx];
  const total = STEPS.length;
  const dubbioQ = DUBBIO[dubbioIdx];
  const moodProfile = useMemo(() => {
    const s = new Set<string>();
    for (const [qid, idx] of Object.entries(answers)) {
      const q = DUBBIO.find((d) => d.id === qid);
      q?.choices[idx]?.moods.forEach((m) => s.add(m));
    }
    return [...s];
  }, [answers]);

  const canAdvance =
    step === "welcome" ||
    (step === "lang" && !!lang) ||
    (step === "genres" && genres.length >= 3) ||
    (step === "dubbio" && Object.keys(answers).length === DUBBIO.length) ||
    (step === "seen" && seen.length >= 1) ||
    step === "done";

  const finish = () => {
    update((s) => ({
      ...s,
      language: lang,
      favoriteGenres: genres,
      moodProfile,
      onboardingDone: true,
      media: {
        ...s.media,
        ...Object.fromEntries(
          seen.map((item) => [
            item.id,
            {
              id: item.id,
              status: "completed" as const,
              addedAt: new Date().toISOString(),
              title: item.title,
              posterUrl: item.posterUrl ?? undefined,
              backdropUrl: item.backdropUrl ?? undefined,
              type: item.type,
              year: item.year,
            },
          ]),
        ),
      },
    }));
    navigate({ to: "/app" });
  };

  const goNext = () => {
    if (step === "done") return finish();
    setStepIdx((i) => Math.min(i + 1, total - 1));
  };
  const goBack = () => {
    if (step === "dubbio" && dubbioIdx > 0) {
      setDubbioIdx((i) => i - 1);
      return;
    }
    setStepIdx((i) => Math.max(i - 1, 0));
  };

  const answerDubbio = (idx: number) => {
    setAnswers((a) => ({ ...a, [dubbioQ.id]: idx }));
    setTimeout(() => {
      if (dubbioIdx < DUBBIO.length - 1) setDubbioIdx((i) => i + 1);
      else setStepIdx((i) => i + 1);
    }, 220);
  };

  const toggle = (arr: string[], v: string, setter: (a: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Neon backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-fuchsia-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Onboarding · {stepIdx + 1}/{total}
            </span>
          </div>
          {step === "dubbio" && (
            <span className="text-[11px] font-semibold uppercase tracking-widest text-cyan-300">
              Dubbio {dubbioIdx + 1}/{DUBBIO.length}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="mb-8 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= stepIdx
                  ? "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1">
          {step === "welcome" && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="mb-6 flex justify-center sm:justify-start">
                <Wordmark
                  lang={lang}
                  priority
                  className="h-14 w-auto max-w-[80vw] drop-shadow-[0_0_24px_rgba(236,72,153,0.45)] sm:h-16"
                />
              </div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold text-fuchsia-300">
                <Wand2 className="h-3.5 w-3.5" /> Benvenutə su Nerdubbio
              </div>
              <h1 className="text-4xl font-black leading-tight">
                Ciao, sono il{" "}
                <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-300 bg-clip-text text-transparent">
                  Genio nerd
                </span>
                .
              </h1>
              <p className="mt-4 text-base text-muted-foreground">
                In 4 tap risolvo il dubbio "cosa guardo?" senza scroll infinito, senza
                pentimenti, senza giudizi. (Ok, un po' di giudizi.)
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Scegli lingua e generi preferiti",
                  "Rispondi a 3 domande ironiche",
                  "Dimmi qualche titolo che hai già visto",
                  "Entra nell'app con il tuo profilo nerd pronto",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 backdrop-blur">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-foreground/90">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === "lang" && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-3xl font-black">In che lingua ci sentiamo?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Puoi cambiarla poi dalle impostazioni. Non ti giudichiamo.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {(["it", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`group relative overflow-hidden rounded-3xl border p-5 text-left transition-all ${
                      lang === l
                        ? "border-fuchsia-400/60 bg-fuchsia-400/10 shadow-[0_0_30px_-8px_rgba(232,121,249,0.6)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    <p className="text-3xl">{l === "it" ? "🇮🇹" : "🇬🇧"}</p>
                    <p className="mt-2 text-sm font-bold">
                      {l === "it" ? "Italiano" : "English"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {l === "it" ? "Interfaccia in italiano" : "English interface"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "genres" && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-3xl font-black">Generi preferiti</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Scegli almeno <span className="font-semibold text-foreground">3</span>. Il Genio
                prende appunti su un blocchetto immaginario.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const on = genres.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggle(genres, g, setGenres)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                        on
                          ? "border-fuchsia-400/60 bg-fuchsia-400/15 text-fuchsia-200 shadow-[0_0_20px_-6px_rgba(232,121,249,0.7)]"
                          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Selezionati: <span className="font-semibold text-foreground">{genres.length}</span>
              </p>
            </div>
          )}

          {step === "dubbio" && (
            <div key={dubbioQ.id} className="animate-in fade-in slide-in-from-right-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-cyan-300">
                Dubbio nerd
              </div>
              <h2 className="text-3xl font-black leading-tight">{dubbioQ.q}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{dubbioQ.sub}</p>
              <div className="mt-6 space-y-3">
                {dubbioQ.choices.map((c, i) => {
                  const selected = answers[dubbioQ.id] === i;
                  return (
                    <button
                      key={c.label}
                      onClick={() => answerDubbio(i)}
                      className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? "border-fuchsia-400/60 bg-fuchsia-400/10 shadow-[0_0_30px_-8px_rgba(232,121,249,0.7)]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 text-2xl">
                        {c.emoji}
                      </span>
                      <span className="flex-1 text-[15px] font-semibold">{c.label}</span>
                      {selected && <Check className="h-5 w-5 text-fuchsia-300" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "seen" && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-3xl font-black">Titoli che hai già visto</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tappa almeno <span className="font-semibold text-foreground">1</span>. Servono al
                Genio per non ri-consigliarteli.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {trendingQ.isLoading &&
                  Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-32 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
                    />
                  ))}
                {trendingItems.map((item: TmdbItem) => {
                  const on = seen.some((x) => x.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleSeen(item)}
                      className={`relative h-32 overflow-hidden rounded-2xl bg-white/5 transition-all ${
                        on
                          ? "ring-2 ring-fuchsia-400 shadow-[0_0_20px_-4px_rgba(232,121,249,0.7)]"
                          : "ring-1 ring-white/10"
                      }`}
                    >
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {on && (
                        <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-fuchsia-500 text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <p className="absolute inset-x-2 bottom-1.5 text-[11px] font-bold leading-tight text-white line-clamp-2">
                        {item.title}
                      </p>
                    </button>
                  );
                })}
              </div>
              {trendingQ.isError && (
                <p className="mt-3 text-xs text-rose-300">
                  Impossibile caricare i titoli da TMDB. Vai avanti e aggiungili dopo dalla Ricerca.
                </p>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Selezionati: <span className="font-semibold text-foreground">{seen.length}</span>
              </p>
            </div>
          )}

          {step === "done" && (
            <div className="animate-in fade-in zoom-in-95">
              <h2 className="text-3xl font-black">Profilo pronto.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ecco cosa ha capito il Genio su di te:
              </p>
              <div className="mt-6 space-y-3">
                <SummaryRow label="Lingua" value={lang === "it" ? "Italiano" : "English"} />
                <SummaryRow label="Generi" value={genres.slice(0, 4).join(" · ") || "—"} extra={genres.length > 4 ? `+${genres.length - 4}` : undefined} />
                <SummaryRow label="Mood serata" value={moodProfile.slice(0, 4).join(" · ") || "—"} extra={moodProfile.length > 4 ? `+${moodProfile.length - 4}` : undefined} />
                <SummaryRow label="Titoli visti" value={`${seen.length} selezionati`} />
              </div>
              <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/20 via-pink-500/10 to-cyan-500/20 p-6 backdrop-blur">
                <p className="text-[11px] uppercase tracking-widest text-fuchsia-200/80">
                  Il tuo profilo nerd
                </p>
                <p className="mt-1 text-2xl font-black">Livello 1 · 0 XP</p>
                <p className="mt-1 text-sm text-foreground/80">
                  Guadagni XP guardando episodi. Sblocchi badge. Ti giudichiamo con affetto.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step !== "dubbio" && (
          <div className="mt-8 flex gap-3">
            {stepIdx > 0 && (
              <button
                onClick={goBack}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-foreground/80 hover:bg-white/[0.06]"
              >
                <ArrowLeft className="h-4 w-4" />
                Indietro
              </button>
            )}
            <button
              onClick={goNext}
              disabled={!canAdvance}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 py-3.5 text-sm font-bold text-white shadow-[0_10px_40px_-10px_rgba(232,121,249,0.8)] transition-opacity disabled:opacity-40"
            >
              {step === "done" ? "Entra nell'app" : "Avanti"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === "dubbio" && stepIdx > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={goBack}
              className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {dubbioIdx > 0 ? "Domanda precedente" : "Indietro"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-foreground/90">
        {value}
        {extra && <span className="ml-1 text-xs text-fuchsia-300">{extra}</span>}
      </span>
    </div>
  );
}
