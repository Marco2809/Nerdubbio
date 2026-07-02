import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { tmdbPerson } from "@/lib/tmdb/tmdb.functions";
import { ArrowLeft, Loader2, Calendar, MapPin } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/person/$id")({
  head: () => ({ meta: [{ title: "Cast — Nerdubbio" }] }),
  component: PersonPage,
});

function PersonPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const personId = Number(id);

  const q = useQuery({
    queryKey: ["tmdb", "person", personId],
    queryFn: () => tmdbPerson({ data: { personId } }),
    enabled: Number.isFinite(personId) && personId > 0,
    staleTime: 1000 * 60 * 60,
  });

  if (q.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return <div className="p-8 text-center text-destructive">Errore nel caricamento.</div>;
  }
  const p = q.data.person;

  return (
    <div className="min-h-screen pb-32">
      <div className="relative">
        <button
          onClick={() => router.history.back()}
          className="absolute left-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur"
          aria-label="Indietro"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-64 w-full bg-gradient-to-b from-primary/30 via-accent/20 to-background" />
      </div>

      <div className="mx-auto -mt-24 max-w-md px-4">
        <div className="flex items-end gap-4">
          <div
            className="h-32 w-24 shrink-0 rounded-2xl border border-border bg-surface-2 bg-cover bg-center shadow-xl"
            style={p.profileUrl ? { backgroundImage: `url(${p.profileUrl})` } : undefined}
          >
            {!p.profileUrl && (
              <div className="grid h-full w-full place-items-center text-3xl text-muted-foreground">
                {p.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="text-2xl font-extrabold leading-tight">{p.name}</h1>
            {p.knownFor && (
              <p className="text-xs uppercase tracking-widest text-accent">{p.knownFor}</p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          {p.birthday && (
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Nato il {formatDate(p.birthday)}
              {p.deathday && <> · † {formatDate(p.deathday)}</>}
            </p>
          )}
          {p.placeOfBirth && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {p.placeOfBirth}
            </p>
          )}
        </div>

        {p.biography && <Biography text={p.biography} />}

        {p.credits.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Filmografia</h2>
            <div className="grid grid-cols-3 gap-3">
              {p.credits.map(c => (
                <Link
                  key={`${c.type}-${c.id}`}
                  to="/media/$type/$id"
                  params={{ type: c.type, id: `${c.type}-${c.id}` }}
                  className="group"
                >
                  <div
                    className="aspect-[2/3] rounded-xl border border-border bg-surface-2 bg-cover bg-center"
                    style={c.posterUrl ? { backgroundImage: `url(${c.posterUrl})` } : undefined}
                  />
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.year || "—"} · {c.type === "tv" ? "Serie" : "Film"}
                  </p>
                  {c.character && (
                    <p className="line-clamp-1 text-[10px] text-accent">{c.character}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Biography({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 320;
  return (
    <div className="mt-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Biografia</p>
      <p className={`mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90 ${!expanded && long ? "line-clamp-6" : ""}`}>
        {text}
      </p>
      {long && (
        <button onClick={() => setExpanded(v => !v)} className="mt-1 text-xs font-semibold text-accent">
          {expanded ? "Mostra meno" : "Leggi tutto"}
        </button>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}
