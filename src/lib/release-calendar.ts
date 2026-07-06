import type { NextEpisodeInfo, ProviderInfo, UpcomingMovie } from "@/lib/tmdb/tmdb.functions";
import { localeToBcp47, translate, type Locale } from "@/lib/i18n";

export type CalendarEventKind = "tv_episode" | "tv_premiere" | "movie_cinema";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  date: string;
  title: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  posterUrl: string | null;
  followed: boolean;
  subtitle: string;
  providers: ProviderInfo[];
}

export interface CalendarDayGroup {
  date: string;
  label: string;
  events: CalendarEvent[];
}

const CALENDAR_DAYS = 28;

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function dayDiff(fromIso: string, toIso: string): number {
  const a = parseDay(fromIso).getTime();
  const b = parseDay(toIso).getTime();
  return Math.round((b - a) / 86400000);
}

export function formatCalendarDayLabel(dateIso: string, refIso = todayIso(), locale: Locale = "it"): string {
  const diff = dayDiff(refIso, dateIso);
  const bcp = localeToBcp47(locale);
  if (diff === 0) return translate(locale, "calendar.today");
  if (diff === 1) return translate(locale, "calendar.tomorrow");
  const d = parseDay(dateIso);
  const weekday = d.toLocaleDateString(bcp, { weekday: "long" });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  if (diff >= 2 && diff <= 6) {
    return `${cap} ${d.toLocaleDateString(bcp, { day: "numeric", month: "short" })}`;
  }
  return d.toLocaleDateString(bcp, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function eventsFromNextEpisodes(
  items: NextEpisodeInfo[],
  followedIds: Set<number>,
  refIso = todayIso(),
  locale: Locale = "it",
): CalendarEvent[] {
  const max = parseDay(refIso);
  max.setDate(max.getDate() + CALENDAR_DAYS);
  const maxIso = max.toISOString().slice(0, 10);

  return items
    .filter(it => {
      const d = it.nextEpisode?.airDate;
      return d && d >= refIso && d <= maxIso;
    })
    .map(it => {
      const ev = it.nextEpisode!;
      const kind: CalendarEventKind = ev.kind === "premiere" ? "tv_premiere" : "tv_episode";
      const subtitle =
        kind === "tv_premiere"
          ? `${translate(locale, "calendar.premiere")} · S${ev.season}${ev.name ? ` — ${ev.name}` : ""}`
          : `S${ev.season}E${ev.episode}${ev.name ? ` — ${ev.name}` : ""}`;

      return {
        id: `tv-${it.tmdb_id}-${ev.airDate}-${ev.season}-${ev.episode ?? 0}`,
        kind,
        date: ev.airDate,
        title: it.title,
        tmdbId: it.tmdb_id,
        mediaType: "tv" as const,
        posterUrl: it.posterUrl,
        followed: followedIds.has(it.tmdb_id),
        subtitle,
        providers: it.providers,
      };
    });
}

export function eventsFromMovies(
  items: UpcomingMovie[],
  refIso = todayIso(),
  locale: Locale = "it",
): CalendarEvent[] {
  const max = parseDay(refIso);
  max.setDate(max.getDate() + CALENDAR_DAYS);
  const maxIso = max.toISOString().slice(0, 10);

  return items
    .filter(m => m.releaseDate && m.releaseDate >= refIso && m.releaseDate <= maxIso)
    .map(m => ({
      id: `movie-${m.tmdb_id}-${m.releaseDate}`,
      kind: "movie_cinema" as const,
      date: m.releaseDate,
      title: m.title,
      tmdbId: m.tmdb_id,
      mediaType: "movie" as const,
      posterUrl: m.posterUrl,
      followed: false,
      subtitle: translate(locale, "calendar.cinemaIt"),
      providers: m.providers,
    }));
}

export function groupCalendarEvents(
  events: CalendarEvent[],
  refIso = todayIso(),
  locale: Locale = "it",
): CalendarDayGroup[] {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const list = byDate.get(ev.date) ?? [];
    list.push(ev);
    byDate.set(ev.date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEvents]) => ({
      date,
      label: formatCalendarDayLabel(date, refIso, locale),
      events: dayEvents.sort((a, b) => {
        if (a.followed !== b.followed) return a.followed ? -1 : 1;
        return a.title.localeCompare(b.title, localeToBcp47(locale));
      }),
    }));
}

export function filterCalendarByProvider(
  events: CalendarEvent[],
  providerId?: number,
): CalendarEvent[] {
  if (!providerId) return events;
  return events.filter(
    ev => ev.mediaType === "movie" || ev.providers.some(p => p.id === providerId),
  );
}

export { CALENDAR_DAYS };
