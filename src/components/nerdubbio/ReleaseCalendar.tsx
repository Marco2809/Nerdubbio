import { Link } from "@tanstack/react-router";
import { CalendarDays, Film, Sparkles, Tv } from "lucide-react";
import type { CalendarDayGroup, CalendarEvent } from "@/lib/release-calendar";
import { useI18n } from "@/lib/i18n";

type Props = {
  days: CalendarDayGroup[];
  loading?: boolean;
  showMovies: boolean;
  onToggleMovies: (v: boolean) => void;
  hasLibraryShows: boolean;
};

export function ReleaseCalendar({
  days,
  loading,
  showMovies,
  onToggleMovies,
  hasLibraryShows,
}: Props) {
  const { t } = useI18n();
  const totalEvents = days.reduce((n, d) => n + d.events.length, 0);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider">{t("calendar.title")}</h2>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("calendar.subtitle")}</p>
        </div>
        <div className="flex rounded-xl border border-border bg-surface/40 p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => onToggleMovies(false)}
            className={`rounded-lg px-2 py-1 font-semibold transition ${
              !showMovies ? "bg-hero text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t("calendar.series")}
          </button>
          <button
            type="button"
            onClick={() => onToggleMovies(true)}
            className={`rounded-lg px-2 py-1 font-semibold transition ${
              showMovies ? "bg-hero text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t("calendar.plusCinema")}
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          {[0, 1].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
              <div className="glass h-16 animate-pulse rounded-2xl bg-surface-2/50" />
            </div>
          ))}
        </div>
      )}

      {!loading && totalEvents === 0 && (
        <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
          {hasLibraryShows ? t("calendar.emptyPeriod") : t("calendar.emptyShows")}
          {showMovies ? t("calendar.emptyCinema") : null}
        </div>
      )}

      {!loading && days.length > 0 && (
        <div className="space-y-5">
          {days.map(day => (
            <div key={day.date}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">
                {day.label}
              </p>
              <div className="space-y-2">
                {day.events.map(ev => (
                  <CalendarEventRow key={ev.id} ev={ev} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CalendarEventRow({ ev }: { ev: CalendarEvent }) {
  const { t } = useI18n();
  const params = { type: ev.mediaType, id: String(ev.tmdbId) };

  return (
    <Link
      to="/media/$type/$id"
      params={params}
      className="glass flex items-center gap-3 rounded-2xl p-2.5 transition hover:border-accent/40"
    >
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        {ev.posterUrl ? (
          <img src={ev.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            {ev.mediaType === "tv" ? <Tv className="h-4 w-4" /> : <Film className="h-4 w-4" />}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{ev.title}</p>
          {ev.followed && (
            <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent">
              {t("calendar.follow")}
            </span>
          )}
          {ev.kind === "tv_premiere" && (
            <Sparkles className="h-3 w-3 shrink-0 text-neon" aria-hidden />
          )}
          {ev.kind === "movie_cinema" && (
            <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
              {t("calendar.cinema")}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{ev.subtitle}</p>
      </div>
    </Link>
  );
}
