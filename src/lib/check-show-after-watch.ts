import { maxWatchedFrontier } from "@/lib/next-episode";
import { tmdbIdFromEntry } from "@/lib/resolve-show-statuses";
import {
  formatSeriesStatusLabel,
  tmdbCheckShowProgress,
  type ShowProgressResult,
} from "@/lib/tmdb/tmdb.functions";
import { toast } from "@/lib/toast";
import type { MediaMeta, UserMediaEntry, UserStatus } from "@/lib/user-store";

function formatAirDate(iso: string | null): string {
  if (!iso) return "data da definire";
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

function progressToast(result: ShowProgressResult, title: string): { title: string; description: string } | null {
  if (result.shouldAutoComplete) {
    return {
      title: `${title} — serie conclusa`,
      description: "Spostata in Vista.",
    };
  }
  if (!result.caughtUp) return null;

  if (result.seriesEnded) {
    return {
      title: `${title} — tutto visto`,
      description: "Serie conclusa: hai visto tutti gli episodi disponibili.",
    };
  }

  if (result.next && !result.next.aired) {
    const when = formatAirDate(result.next.airDate);
    return {
      title: "Sei in pari!",
      description: `Prossimo episodio S${result.next.season}E${result.next.episode} · ${when}. ${result.seriesStatusLabel}.`,
    };
  }

  return {
    title: "Sei in pari!",
    description: `Hai visto tutto ciò che è uscito. ${result.seriesStatusLabel} — la serie potrebbe continuare.`,
  };
}

/** Dopo un episodio/stagione segnati, verifica TMDB e aggiorna lo stato se la serie è chiusa. */
export async function applyShowProgressAfterWatch(opts: {
  entry: UserMediaEntry;
  setStatus: (id: string, status: UserStatus, meta?: MediaMeta) => void | Promise<unknown>;
  title?: string;
  meta?: MediaMeta;
}): Promise<void> {
  const tmdbId = tmdbIdFromEntry(opts.entry.id);
  if (!tmdbId) return;

  const frontier = maxWatchedFrontier(opts.entry);
  let result: ShowProgressResult;
  try {
    result = await tmdbCheckShowProgress({
      data: {
        tmdbId,
        watched: opts.entry.watchedEpisodes ?? [],
        lastSeason: frontier?.season,
        lastEpisode: frontier?.episode,
        currentStatus: opts.entry.status,
      },
    });
  } catch {
    return;
  }

  if (result.shouldAutoComplete) {
    await opts.setStatus(opts.entry.id, "completed", opts.meta);
  }

  const msg = progressToast(result, opts.title ?? opts.entry.title ?? "Serie");
  if (msg) {
    if (result.shouldAutoComplete) {
      toast.success(msg.title, { description: msg.description, duration: 6000 });
    } else {
      toast(msg.title, { description: msg.description, duration: 5000 });
    }
  }
}

export { formatSeriesStatusLabel };
