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
  if (g.some(x => x.includes("animation") || x.includes("animazione"))) moods.add("cozy");

  if (/dark|mister|conspir|distop|death|murder|kill|war|apocalyp/.test(text)) moods.add("dark");
  if (/funny|laugh|comic|hilar/.test(text)) moods.add("funny");
  if (/love|heart|romanc/.test(text)) moods.add("romantic");
  if (/mind|twist|time|parallel|universe|simul/.test(text)) moods.add("mind-bending");

  if (type === "movie" && runtimeMin && runtimeMin < 100) moods.add("short");
  if (type === "tv" && (seasons ?? 0) >= 3) moods.add("binge");
  if (type === "movie" && (runtimeMin ?? 0) >= 150) moods.add("epic");

  if (moods.size === 0) moods.add("slow-burn");
  if ((seasons ?? 0) >= 5 || runtimeMin === undefined) moods.add("binge");

  return [...moods];
}
