import type { MoodTag } from "@/lib/mock-catalog";

export function inferMoods(
  genres: string[],
  overview: string,
  type: "movie" | "tv",
  runtimeMin?: number,
  seasons?: number,
): MoodTag[] {
  const g = genres.map(x => x.toLowerCase());
  const text = overview.toLowerCase();
  const moods = new Set<MoodTag>();

  if (g.some(x => x.includes("comedy") || x.includes("commedia"))) moods.add("funny");
  if (g.some(x => x.includes("romance") || x.includes("romantic"))) moods.add("romantic");
  if (g.some(x => x.includes("horror"))) moods.add("dark");
  if (g.some(x => x.includes("thriller") || x.includes("crime"))) moods.add("thriller");
  if (g.some(x => x.includes("sci-fi") || x.includes("science"))) moods.add("sci-fi");
  if (g.some(x => x.includes("fantasy") || x.includes("avventura"))) moods.add("fantasy");
  if (g.some(x => x.includes("action") || x.includes("azione"))) moods.add("action");
  if (g.some(x => x.includes("mystery") || x.includes("mistero"))) moods.add("mind-bending");
  if (g.some(x => x.includes("drama") || x.includes("dramma"))) moods.add("slow-burn");
  // Animazione non vuol dire "per famiglie": seinen e crime animati non sono cozy.
  if (
    g.some(x => x.includes("animation") || x.includes("animazione"))
    && g.some(x => x.includes("family") || x.includes("comedy") || x.includes("commedia"))
    && !g.some(x => x.includes("crime") || x.includes("horror"))
  ) moods.add("cozy");

  // Parole intere: "war" non deve scattare su "award", né "time" su ogni trama.
  if (/\b(dark|conspiracy|dystopi\w*|murder\w*|serial killer|apocalyp\w*|war|horror)\b/.test(text)) moods.add("dark");
  if (/\b(funny|hilarious|parody|sitcom|satire|slapstick)\b/.test(text)) moods.add("funny");
  if (/\b(romance|romantic|love story|falling in love|romcom)\b/.test(text)) moods.add("romantic");
  if (/\b(plot twist|twist ending|time travel|time loop|parallel universe|multiverse|simulation|psychological thriller|mind bending|nonlinear timeline)\b/.test(text)) moods.add("mind-bending");

  if (type === "movie" && runtimeMin && runtimeMin < 100) moods.add("short");
  if (type === "tv" && (seasons ?? 0) >= 3) moods.add("binge");
  if (type === "movie" && (runtimeMin ?? 0) >= 150) moods.add("epic");

  if (moods.size === 0) moods.add("slow-burn");
  if ((seasons ?? 0) >= 5 || runtimeMin === undefined) moods.add("binge");

  return [...moods];
}
