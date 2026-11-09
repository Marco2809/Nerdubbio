import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clapperboard, Loader2, MapPin, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReleasePreviewItem } from "@/components/nerdubbio/ReleasePreviewDialog";
import { useI18n, localeToBcp47 } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { tmdbMatchCinemaTitles, type TmdbItem } from "@/lib/tmdb/tmdb.functions";
import { cinemaApi, type MyCinemasResult } from "@/lib/php/cinema-client";

const MINE_KEY = ["cinema", "mine"] as const;

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * I miei cinema: fino a 6 sale scelte dall'utente, orari giorno per giorno e
 * film per film, un cinema per riga per confrontarli. Toccando il film si apre
 * la scheda dell'uscita (trailer, «Da vedere»).
 */
export function MyCinemasSection({ onOpen }: { onOpen: (item: ReleasePreviewItem) => void }) {
  const { t, locale } = useI18n();
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState<string | null>(null);

  const mine = useQuery({ queryKey: MINE_KEY, queryFn: () => cinemaApi.mine(), staleTime: 1000 * 60 * 30 });
  const data = mine.data;
  const days = useMemo(() => data?.days ?? [], [data]);
  const current = days.find(d => d.day === day) ?? days[0];

  const titles = useMemo(
    () => Array.from(new Set(days.flatMap(d => d.films.map(f => f.title)))).slice(0, 80),
    [days],
  );
  const tmdbLocale = localeToBcp47(locale);
  const matches = useQuery({
    queryKey: ["tmdb", "cinema-titles", titles, tmdbLocale],
    queryFn: () => tmdbMatchCinemaTitles({ data: { titles, locale: tmdbLocale } }),
    enabled: titles.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const matchOf = useMemo(() => {
    const m = new Map<string, TmdbItem>();
    for (const r of matches.data?.results ?? []) if (r.match) m.set(r.title, r.match);
    return m;
  }, [matches.data]);

  const dayLabel = (iso: string) => {
    const today = isoToday();
    if (iso === today) return t("calendar.today");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (iso === `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`) {
      return t("calendar.tomorrow");
    }
    const [y, mo, d] = iso.split("-").map(Number);
    return new Date(y!, mo! - 1, d!).toLocaleDateString(tmdbLocale, { weekday: "short", day: "numeric", month: "short" });
  };

  const hasCinemas = (data?.cinemas.length ?? 0) > 0;
  const isToday = current?.day === isoToday();
  const now = nowHHMM();

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold uppercase tracking-wider">{t("cinemas.title")}</h2>
        </div>
        {hasCinemas && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-semibold text-foreground"
          >
            <Settings2 className="h-3 w-3" /> {t("cinemas.edit")}
          </button>
        )}
      </div>

      {mine.isLoading && <div className="glass h-20 animate-pulse rounded-2xl" />}
      {mine.error && <div className="glass rounded-2xl p-4 text-sm text-destructive">{t("cinemas.loadError")}</div>}

      {data && !hasCinemas && (
        <div className="glass rounded-2xl p-4">
          <p className="text-sm text-muted-foreground">{t("cinemas.empty", { max: data.max })}</p>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-3 flex items-center gap-1.5 rounded-xl bg-hero px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            <MapPin className="h-4 w-4" /> {t("cinemas.choose")}
          </button>
        </div>
      )}

      {data && hasCinemas && days.length === 0 && (
        <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">{t("cinemas.noShows")}</div>
      )}

      {current && (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {days.map(d => (
              <button
                key={d.day}
                type="button"
                onClick={() => setDay(d.day)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  d.day === current.day ? "bg-hero text-primary-foreground" : "glass text-foreground/80"
                }`}
              >
                {dayLabel(d.day)}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {current.films.map(f => {
              const m = matchOf.get(f.title);
              const open = () => onOpen({
                type: "movie",
                tmdbId: m!.tmdb_id,
                title: m!.title,
                posterUrl: m!.posterUrl,
                year: m!.year,
                when: `${dayLabel(current.day)} · ${f.cinemas.map(c => c.name).join(", ")}`,
                overview: m!.overview || undefined,
              });
              return (
                <div key={f.title} className="glass rounded-2xl p-3">
                  <button
                    type="button"
                    onClick={m ? open : undefined}
                    disabled={!m}
                    className="flex w-full items-center gap-3 text-left disabled:cursor-default"
                  >
                    {m?.posterUrl
                      ? <img src={m.posterUrl} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover" />
                      : <div className="h-16 w-11 shrink-0 rounded-lg bg-surface-2" />}
                    <p className="min-w-0 flex-1 text-sm font-bold">{f.title}</p>
                  </button>
                  <div className="mt-2 space-y-2">
                    {f.cinemas.map(c => (
                      <div key={c.id} className="rounded-xl bg-surface-2/60 px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold">{c.name}</p>
                          {c.price && <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{c.price}</span>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.times.map(time => {
                            const past = isToday && time < now;
                            return (
                              <span
                                key={time}
                                className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${
                                  past ? "bg-surface-2 text-muted-foreground line-through" : "bg-accent/15 text-accent"
                                }`}
                              >
                                {time}
                              </span>
                            );
                          })}
                        </div>
                        {c.hall && <p className="mt-1 truncate text-[10px] text-muted-foreground">{c.hall}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <CinemaPicker open={picking} onClose={() => setPicking(false)} data={data} />
    </section>
  );
}

function CinemaPicker({ open, onClose, data }: { open: boolean; onClose: () => void; data?: MyCinemasResult }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [city, setCity] = useState("");
  const [filter, setFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  // La città parte da quella dell'ultimo cinema scelto.
  const lastCity = data?.cinemas[data.cinemas.length - 1]?.city ?? "";
  useEffect(() => {
    if (open && !city && lastCity) setCity(lastCity);
  }, [open, city, lastCity]);

  const cities = useQuery({
    queryKey: ["cinema", "cities"],
    queryFn: () => cinemaApi.cities(),
    enabled: open,
    staleTime: 1000 * 60 * 60 * 24,
  });
  const list = useQuery({
    queryKey: ["cinema", "list", city],
    queryFn: () => cinemaApi.list(city),
    enabled: open && !!city,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const toggle = useMutation({
    mutationFn: (id: string) => cinemaApi.toggle(city, id),
    onMutate: id => setPendingId(id),
    onSuccess: result => queryClient.setQueryData(MINE_KEY, result),
    onError: e => toast.error(e instanceof Error ? e.message : t("cinemas.loadError")),
    onSettled: () => setPendingId(null),
  });

  const chosen = new Set((data?.cinemas ?? []).map(c => c.id));
  const max = data?.max ?? 6;
  const q = filter.trim().toLowerCase();
  const options = (list.data?.cinemas ?? []).filter(c => !q || c.name.toLowerCase().includes(q));
  const elsewhere = (data?.cinemas ?? []).filter(c => c.city !== city);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>{t("cinemas.title")}</DialogTitle>
          <DialogDescription>{t("cinemas.count", { n: chosen.size, max })}</DialogDescription>
        </DialogHeader>

        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="cinema-city">
          {t("cinemas.city")}
        </label>
        <select
          id="cinema-city"
          value={city}
          onChange={e => { setCity(e.target.value); setFilter(""); }}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">{cities.isLoading ? t("cinemas.loading") : t("cinemas.cityPlaceholder")}</option>
          {(cities.data?.cities ?? []).map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>

        {elsewhere.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {t("cinemas.alsoChosen")}: {elsewhere.map(c => c.name).join(", ")}
          </p>
        )}

        {city && (
          <input
            type="search"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={t("cinemas.search")}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
        )}

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {list.isLoading && <p className="py-4 text-center text-xs text-muted-foreground">{t("cinemas.loading")}</p>}
          {list.data && options.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">{t("cinemas.noCinemasInCity")}</p>
          )}
          <ul className="space-y-1">
            {options.map(c => {
              const on = chosen.has(c.id);
              const pending = pendingId === c.id;
              const full = !on && chosen.size >= max;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={toggle.isPending || full}
                    onClick={() => toggle.mutate(c.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                      on ? "bg-accent/15 font-semibold text-accent" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? "border-accent bg-accent text-primary-foreground" : "border-border"}`}>
                      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {pending && !on && <span className="shrink-0 text-[10px] text-muted-foreground">{t("cinemas.reading")}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-hero py-2.5 text-sm font-bold text-primary-foreground"
        >
          {t("cinemas.done")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
