import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseTvTimeExport } from "../src/lib/tvtime-import.ts";

const dir = process.argv[2] ?? "/tmp/tvtime-bubu";
const files: Record<string, string> = {};
for (const f of readdirSync(dir)) {
  if (f.endsWith(".csv")) files[f] = readFileSync(join(dir, f), "utf8");
}
const res = parseTvTimeExport(files);
const movies = res.rows.filter((r) => r.type === "movie");
console.log({
  total: movies.length,
  noYear: movies.filter((m) => !m.year).length,
  plan: movies.filter((m) => m.status === "plan_to_watch").length,
  completed: movies.filter((m) => m.status === "completed").length,
  watching: movies.filter((m) => m.status === "watching").length,
});
