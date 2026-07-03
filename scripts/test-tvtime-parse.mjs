import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseTvTimeExport } from "../src/lib/tvtime-import.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: npx tsx scripts/test-tvtime-parse.mjs <folder>");
  process.exit(1);
}

const files = {};
for (const f of readdirSync(dir)) {
  if (f.endsWith(".csv") || f.endsWith(".json")) {
    files[f] = readFileSync(join(dir, f), "utf8");
  }
}

const res = parseTvTimeExport(files);
console.log(JSON.stringify({
  counts: res.counts,
  filesFound: res.filesFound.length,
  sampleMovies: res.rows.filter((r) => r.type === "movie").slice(0, 8).map((r) => ({
    title: r.title,
    status: r.status,
    year: r.year,
  })),
}, null, 2));
