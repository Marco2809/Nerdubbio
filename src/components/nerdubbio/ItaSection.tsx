import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Languages, Loader2 } from "lucide-react";
import { useI18n, localeToBcp47 } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { itaApi, type ItaLang, type ItaState } from "@/lib/php/ita-client";
import { arrivingText } from "@/lib/ita-format";

const BORDER: Record<ItaState, string> = {
  completa: "border-l-emerald-500",
  in_corso: "border-l-amber-400",
  inedita: "border-l-rose-500",
  ignoto: "border-l-border",
};
const MARK: Record<string, { sign: string; cls: string }> = {
  si: { sign: "✓", cls: "text-emerald-500" },
  in_corso: { sign: "…", cls: "text-amber-400" },
  no: { sign: "✗", cls: "text-rose-500" },
};

/**
 * L'edizione italiana del titolo: è uscito in italiano, stagione per stagione,
 * doppiato o solo sottotitoli. I testi vengono da Wikipedia italiana e restano
 * in italiano; «Doppiato / Solo sub» lo può indicare l'utente, vale solo per lui.
 */
export function ItaSection({ type, tmdbId }: { type: "movie" | "tv"; tmdbId: number }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const key = `${type}-${tmdbId}`;
  const q = useQuery({ queryKey: ["ita", "get", key], queryFn: () => itaApi.get(key), staleTime: 1000 * 60 * 30 });

  const setLang = useMutation({
    mutationFn: (lang: ItaLang | null) => itaApi.setLang(key, lang),
    onSuccess: (r) => {
      queryClient.setQueryData(["ita", "get", key], (old: Awaited<ReturnType<typeof itaApi.get>> | undefined) => (old ? { ...old, lang: r.lang } : old));
      void queryClient.invalidateQueries({ queryKey: ["ita", "map"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("ita.loadError")),
  });

  if (q.isLoading) {
    return (
      <section className="glass mt-4 flex items-center gap-2 rounded-2xl p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("ita.loading")}
      </section>
    );
  }
  if (q.error || !q.data) return null;
  const { ita, lang, arriving } = q.data;
  if (!ita && !arriving) return null;
  if (!ita) {
    return (
      <section className="glass mt-4 flex items-center gap-2 rounded-2xl p-4 text-sm">
        <CalendarDays className="h-4 w-4 shrink-0 text-accent" /> {arrivingText(arriving!, t, localeToBcp47(locale))}
      </section>
    );
  }

  const state: ItaState = lang && ita.stato === "ignoto" ? "completa" : ita.stato;
  const seasons = ita.seasons.filter((s) => s.episodes > 0);
  const showSeasons = seasons.length > 1 && seasons.some((s) => s.ita !== "?");
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y!, m! - 1, d!).toLocaleDateString(localeToBcp47(locale), { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <section className={`glass mt-4 rounded-2xl border-l-4 p-4 ${BORDER[state]}`}>
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-bold uppercase tracking-wider">{t(`ita.state.${state}`)}</h2>
      </div>
      {arriving && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-surface-2/70 px-3 py-2 text-sm">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            <strong>{t("ita.arriving.title")}</strong> {arrivingText(arriving, t, localeToBcp47(locale))}
            {!arriving.italy && <span className="block text-[11px] text-muted-foreground">{t("ita.arriving.originalOnly")}</span>}
          </span>
        </p>
      )}
      <p className="mt-2 text-sm">{ita.text}</p>
      {ita.next && (
        <p className="mt-1 text-xs text-muted-foreground">
          {ita.next.text || t("ita.next")}: {fmt(ita.next.date)}
        </p>
      )}
      {lang && (
        <p className="mt-1 text-xs">
          <strong>{t(lang === "sub" ? "ita.langSub" : "ita.langDub")}</strong> · {t("ita.langYours")}
        </p>
      )}

      {showSeasons && (
        <ul className="mt-3 space-y-1.5">
          {seasons.map((s) => (
            <li key={s.n} className="grid grid-cols-[1rem_1fr] gap-2 text-xs">
              <span className={`text-center font-bold ${MARK[s.ita]?.cls ?? "text-muted-foreground"}`} aria-hidden="true">{MARK[s.ita]?.sign ?? "?"}</span>
              <span>
                <strong>{t("ita.season", { n: s.n })}</strong> ·{" "}
                {s.aired < s.episodes ? t("ita.episodesAired", { aired: s.aired, total: s.episodes }) : t("ita.episodes", { total: s.episodes })}
                {s.note && <span className="block text-[11px] text-muted-foreground">{s.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("ita.yourChoice")}</span>
        {(["dub", "sub"] as ItaLang[]).map((l) => {
          const on = lang === l;
          return (
            <button
              key={l}
              type="button"
              disabled={setLang.isPending}
              aria-pressed={on}
              onClick={() => setLang.mutate(on ? null : l)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
                on ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground"
              }`}
            >
              {on && <Check className="h-3 w-3" />}
              {t(l === "dub" ? "ita.langDub" : "ita.langSub")}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        {t("ita.source")}:{" "}
        {ita.source ? <a href={ita.source} target="_blank" rel="noreferrer" className="underline">Wikipedia</a> : "TMDB"}
        {" · "}{t("ita.updated", { date: ita.read_at.slice(8, 10) + "/" + ita.read_at.slice(5, 7) })}
      </p>
    </section>
  );
}
