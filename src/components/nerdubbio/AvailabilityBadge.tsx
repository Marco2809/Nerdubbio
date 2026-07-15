import { useQuery } from "@tanstack/react-query";
import { Clapperboard } from "lucide-react";
import { tmdbAvailability, type AvailabilityInfo } from "@/lib/tmdb/tmdb.functions";
import { useTmdbRegion } from "@/lib/tmdb/use-tmdb-locale";
import { useI18n } from "@/lib/i18n";

export type AvailabilityItem = { type: "movie" | "tv"; tmdbId: number };

/** Chiave `movie-123` / `tv-456` usata dalla mappa di disponibilità. */
export function availabilityKey(type: "movie" | "tv", tmdbId: number): string {
  return `${type}-${tmdbId}`;
}

/**
 * Disponibilità per una griglia di copertine, in un'unica chiamata batch.
 * Cache lunga: provider e date d'uscita cambiano di rado.
 */
export function useAvailability(items: AvailabilityItem[]) {
  const region = useTmdbRegion();
  // Max 40 per richiesta (limite della server function).
  const capped = items.slice(0, 40);
  const keys = capped.map((i) => availabilityKey(i.type, i.tmdbId)).sort();

  const q = useQuery({
    queryKey: ["tmdb", "availability", region, keys],
    queryFn: () => tmdbAvailability({ data: { items: capped, region } }),
    enabled: capped.length > 0,
    staleTime: 1000 * 60 * 60 * 12,
  });

  return q.data?.availability ?? {};
}

function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

/**
 * Pill compatta da sovrapporre alla copertina: logo della piattaforma se il
 * titolo è in streaming, ciak se è al cinema o in uscita. Il posizionamento
 * lo decide il chiamante.
 */
export function AvailabilityBadge({ info }: { info?: AvailabilityInfo }) {
  const { t } = useI18n();
  if (!info || info.status === "none") return null;

  if (info.status === "streaming" || info.status === "rent") {
    if (info.providers.length === 0) return null;
    const rent = info.status === "rent";
    return (
      <span
        className="flex items-center gap-0.5 rounded-full bg-black/70 p-0.5 pr-1"
        title={info.providers.map((p) => p.name).join(", ") + (rent ? ` · ${t("availability.rent")}` : "")}
      >
        {info.providers.slice(0, 2).map((p) =>
          p.logoUrl ? (
            <img
              key={p.id}
              src={p.logoUrl}
              alt={p.name}
              loading="lazy"
              className={`h-4 w-4 rounded ${rent ? "opacity-60" : ""}`}
            />
          ) : null,
        )}
        {rent && <span className="px-0.5 text-[8px] font-bold text-white/80">€</span>}
      </span>
    );
  }

  const theaters = info.status === "theaters";
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white"
      title={theaters ? t("availability.inTheaters") : t("availability.upcomingOn", { date: shortDate(info.releaseDate) })}
    >
      <Clapperboard className="h-3 w-3" style={{ color: "#e0a52e" }} />
      {theaters ? t("availability.cinema") : shortDate(info.releaseDate)}
    </span>
  );
}
