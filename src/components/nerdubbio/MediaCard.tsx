import { Link } from "@tanstack/react-router";
import type { CatalogItem } from "@/lib/mock-catalog";
import { Star } from "lucide-react";

export function MediaCard({ item, size = "md" }: { item: CatalogItem; size?: "sm" | "md" | "lg" }) {
  const heights = { sm: "h-40", md: "h-56", lg: "h-72" }[size];
  return (
    <Link to="/media/$type/$id" params={{ type: item.type, id: item.id }}
      className="group block">
      <div className={`relative overflow-hidden rounded-2xl ${heights} shadow-glow`}
        style={{ background: item.poster }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold">
          <Star className="h-3 w-3 fill-accent text-accent" /> {item.rating.toFixed(1)}
        </div>
        <div className="absolute bottom-0 inset-x-0 p-3">
          <p className="text-[10px] uppercase tracking-widest text-white/70">{item.type === "tv" ? "Serie" : "Film"} · {item.year}</p>
          <h3 className="text-sm font-semibold text-white line-clamp-2">{item.title}</h3>
        </div>
      </div>
    </Link>
  );
}

export function MediaRow({ title, items }: { title: string; items: CatalogItem[] }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="-mx-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-3 px-4 pb-2">
          {items.map(it => (
            <div key={it.id} className="w-36 shrink-0">
              <MediaCard item={it} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
