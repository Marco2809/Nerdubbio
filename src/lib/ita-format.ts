import type { ItaArriving } from "@/lib/php/ita-client";

type T = (key: string, vars?: Record<string, string | number>) => string;

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** «26 nov» nella lingua dell'utente: per l'etichetta sulla locandina. */
export function arrivingShort(a: ItaArriving, bcp47: string): string {
  return parse(a.date).toLocaleDateString(bcp47, { day: "numeric", month: "short" });
}

/** La frase completa: «Stagione 2: 26 novembre · in originale su Sky Atlantic». */
export function arrivingText(a: ItaArriving, t: T, bcp47: string): string {
  const d = parse(a.date);
  const date = d.toLocaleDateString(bcp47, {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {}),
  });
  const what =
    a.kind === "season" && a.season ? t("ita.arriving.season", { n: a.season })
    : a.kind === "series" ? t("ita.arriving.series")
    : a.kind === "cinema" ? t("ita.arriving.cinema")
    : a.kind === "streaming" ? t("ita.arriving.streaming", { where: a.where || "streaming" })
    : a.kind === "tv" ? t("ita.arriving.tv")
    : a.kind === "homevideo" ? t("ita.arriving.homevideo")
    : t("ita.arriving.release");
  const tail =
    (a.kind === "season" || a.kind === "series") && a.where
      ? " · " + (a.italy ? a.where : t("ita.arriving.original", { where: a.where }))
      : a.kind === "release" ? " · " + t("ita.arriving.notItaly")
      : "";
  return `${what}: ${date}${tail}`;
}
