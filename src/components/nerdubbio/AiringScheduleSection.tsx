import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { useMemo } from "react";
import { tmdbSeason } from "@/lib/tmdb/tmdb.functions";
import { useTmdbLocale, useTmdbRegion } from "@/lib/tmdb/use-tmdb-locale";
import { useI18n, localeToBcp47 } from "@/lib/i18n";
import { airingSchedule, type AiringDrop } from "@/lib/airing-schedule";
import { itaApi } from "@/lib/php/ita-client";

const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y!, m! - 1, d!); };

/**
 * La stagione in onda: ritmo, prossima e ultima puntata (Marco, 12/11).
 * In Italia valgono le date italiane delle tabelle di Wikipedia, se ci sono (le legge il
 * server con lo stato in italiano); altrimenti le date di TMDB, del paese d'origine.
 * Stesse queryKey della sezione italiana e della scheda stagione: niente letture doppie.
 */
export function AiringScheduleSection({ tmdbId, season, seriesStatus, originCountry }: {
  tmdbId: number;
  season?: number;
  seriesStatus?: string;
  originCountry?: string[];
}) {
  const { t, locale } = useI18n();
  const tmdbLocale = useTmdbLocale();
  const region = useTmdbRegion();
  const bcp47 = localeToBcp47(locale);
  const key = `tv-${tmdbId}`;
  const ita = useQuery({ queryKey: ["ita", "get", key], queryFn: () => itaApi.get(key), staleTime: 1000 * 60 * 30, enabled: region === "IT" });
  const q = useQuery({
    queryKey: ["tmdb", "season", tmdbId, season, tmdbLocale],
    queryFn: () => tmdbSeason({ data: { tmdbId, seasonNumber: season!, locale: tmdbLocale } }),
    enabled: !!season,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const today = todayIso();
  const itaSched = region === "IT" ? ita.data?.ita?.schedule_it ?? null : null;
  const fromItaly = !!itaSched && itaSched.calendar.length > 0 && itaSched.calendar[itaSched.calendar.length - 1]!.date >= today;
  const sched = useMemo(
    () => (fromItaly ? itaSched : q.data ? airingSchedule(q.data.episodes, today, (seriesStatus ?? "").toLowerCase() === "ended") : null),
    [fromItaly, itaSched, q.data, today, seriesStatus],
  );
  const shownSeason = fromItaly ? itaSched!.season : season;
  if (!sched || !shownSeason) return null;
  const cal = sched.calendar;
  const started = cal[0]!.date <= today;
  if (!started && cal.length < 2) return null; // c'è solo l'esordio: lo dice già «In arrivo»

  const next = cal.find(x => x.date >= today)!;
  const last = cal[cal.length - 1]!;
  const aired = cal.filter(x => x.date < today).reduce((n, x) => n + x.episodes.length, 0);
  const when = (x: AiringDrop) => {
    const day = x.date === today ? t("airing.today") : parse(x.date).toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "long" });
    const eps = x.episodes.length === 1 ? String(x.episodes[0]) : `${x.episodes[0]}–${x.episodes[x.episodes.length - 1]}`;
    const s = `${day} (${t("airing.ep", { n: eps })})`;
    return x.estimated ? t("airing.about", { when: s }) : s;
  };

  const r = sched.rhythm;
  let rhythm = "";
  if (r?.kind === "allAtOnce") rhythm = t("airing.allAtOnce");
  else if (r) {
    if (r.kind === "weekly") {
      const days = new Intl.ListFormat(bcp47, { type: "conjunction" }).format(
        r.weekdays.map(w => new Date(Date.UTC(2026, 0, 4 + w, 12)).toLocaleDateString(bcp47, { weekday: "long", timeZone: "UTC" })),
      );
      rhythm = r.perDrop === 1 ? t("airing.weeklyOne", { days }) : t("airing.weeklyMany", { days, n: r.perDrop });
    } else {
      rhythm = r.perDrop === 1 ? t("airing.dailyOne") : t("airing.dailyMany", { n: r.perDrop });
    }
    if (r.premiere) rhythm += ` (${t("airing.premiere", { n: r.premiere })})`;
  }
  const original = !fromItaly && !(originCountry ?? []).includes(region);

  return (
    <section className="glass mt-4 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-bold uppercase tracking-wider">
          {t(started ? "airing.titleOn" : "airing.title", { n: shownSeason })}
        </h2>
      </div>
      {rhythm && <p className="mt-2 text-sm font-semibold">{rhythm}</p>}
      <ul className="mt-2 space-y-1 text-sm">
        {started && <li>{t("airing.aired", { aired, total: sched.total })}</li>}
        {next !== last && <li><strong>{t("airing.next")}</strong> {when(next)}</li>}
        <li><strong>{t(sched.closed && !sched.undated ? "airing.last" : "airing.lastKnown")}</strong> {when(last)}</li>
        {sched.undated > 0 && <li className="text-muted-foreground">{t("airing.undated", { n: sched.undated })}</li>}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {fromItaly ? t("airing.sourceItaly") : t("airing.source") + (original ? " · " + t("airing.originalDates") : "")}
      </p>
    </section>
  );
}
