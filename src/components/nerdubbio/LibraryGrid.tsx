import { Link } from "@tanstack/react-router";
import type { LibraryDisplayItem } from "@/lib/library-display";
import { mediaRouteParams } from "@/lib/library-display";
import { useReturnPath } from "@/lib/media-nav";
import { Heart, PlayCircle } from "lucide-react";

export function LibraryGrid({
  items,
  emptyEmoji = "🍿",
  emptyText = "Nessun titolo qui. Per ora.",
}: {
  items: LibraryDisplayItem[];
  emptyEmoji?: string;
  emptyText?: string;
}) {
  const from = useReturnPath();

  if (items.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="text-4xl">{emptyEmoji}</p>
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(item => {
        const params = mediaRouteParams(item);
        const epCount = item.entry.watchedEpisodes?.length ?? 0;
        return (
          <Link
            key={item.id}
            to="/media/$type/$id"
            params={params}
            state={{ from }}
            className="group block"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-surface-2 shadow-glow">
              {item.posterUrl ? (
                <img src={item.posterUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              {item.entry.rating != null && (
                <span className="absolute left-2 top-2 rounded-full bg-hero px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow-pink">
                  {item.entry.rating}/10
                </span>
              )}
              {item.entry.status === "favorite" && (
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-accent">
                  <Heart className="h-3.5 w-3.5 fill-current" />
                </span>
              )}
              {item.type === "tv" && epCount > 0 && (
                <span className="absolute right-2 bottom-12 flex items-center gap-0.5 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-semibold text-white/90">
                  <PlayCircle className="h-3 w-3" /> {epCount} ep.
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="text-[9px] uppercase tracking-widest text-white/65">
                  {item.type === "tv" ? "Serie" : "Film"}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
                <h3 className="line-clamp-2 text-xs font-bold text-white">{item.title}</h3>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
