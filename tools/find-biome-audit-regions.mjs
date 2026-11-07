// Picks 6x6-chunk regions whose inner 2x2 populated chunks all read one natural biome slot, for
// tools/probes/PopulateChainProbe.java's audit mode (tools/verify-biome-audit.mjs). populate reads
// the biome at (chunk * 16 + 16, chunk * 16 + 16), so that is the point checked. Pure JS layers.
// Usage: node tools/find-biome-audit-regions.mjs [perSlot=1] [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WorldChunkManager } from "../src/biome-layers.js";

export const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
  129, 130, 131, 132, 133, 134, 140, 149, 151, 155, 156, 157, 158, 160, 161, 162, 163, 164, 165, 166, 167];
const SEEDS = [1234567, 8675309, 0, 7, 42, 17, 10, 99, 2024, 31337, 555, 1, 2, 3, ...Array.from({ length: 120 }, (_, i) => 100 + i)];
// Slots the chosen regions have to hit a second time or more (rare in short scans).
export const MORE = Object.fromEntries([17, 130, 6, 21, 22, 23, 149, 151, 161, 163, 164, 14, 157, 134].map((s) => [s, 2]));
export function findRegions(perSlot = 1, extra = MORE, loose = new Set()) {
  const found = new Map(SLOTS.map((s) => [s, []]));
  const SIDE = 1024; // chunks per scanned square (blocks = 16 * SIDE would be too slow); scan in 512-block tiles
  for (const n of SEEDS) {
    if ([...found].every(([s, l]) => l.length >= (extra[s] ?? perSlot))) break;
    const manager = new WorldChunkManager(BigInt(n), "default");
    for (let tx = -2; tx < 2; tx++) for (let tz = -2; tz < 2; tz++) {
      const bx = tx * 512, bz = tz * 512, area = manager.biomeIndexLayer.getInts(bx, bz, 512, 512);
      // Chunk cell (cx, cz) samples block (cx*16+16, cz*16+16); tile cells with 0 <= i,j < 32 are samples at bx+16i+16.
      const at = (i, j) => (i < 0 || j < 0 || i >= 32 || j >= 32 ? -1 : area[(j * 16) * 512 + i * 16]);
      for (let i = 0; i < 31; i++) for (let j = 0; j < 31; j++) {
        const slot = at(i, j);
        const list = found.get(slot);
        if (!list || list.length >= (extra[slot] ?? perSlot)) continue;
        // Pure 2x2 first; a slot that never shows one in the scan keeps a region whose first populated chunk reads it.
        const pure = at(i + 1, j) === slot && at(i, j + 1) === slot && at(i + 1, j + 1) === slot;
        if (!pure && !loose.has(slot)) continue;
        // Chunk (cx, cz) with cx*16+16 = bx + 16*i  ->  cx = bx/16 + i - 1.
        const cx = bx / 16 + i - 1, cz = bz / 16 + j - 1;
        if (list.some((r) => r[0] === n)) continue; // one region per seed per slot
        list.push([n, cx - 2, cz - 2, slot]);
      }
    }
  }
  return [...found.values()].flat();
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  let regions = findRegions(Number(args[0] ?? 1));
  const pure = new Set(regions.map((r) => r[3])), loose = new Set(SLOTS.filter((s) => !pure.has(s)));
  if (loose.size) regions = [...regions, ...findRegions(1, {}, loose).filter((r) => loose.has(r[3]))];
  const have = new Set(regions.map((r) => r[3]));
  console.log("regions", regions.length, "missing slots", SLOTS.filter((s) => !have.has(s)).join(","));
  // Rows with a fifth field are forced single-biome regions (slots 10, 20, 151; regions picked by native scan for desert wells and
  // jungle melons, tools/verify-biome-audit.mjs with AUDIT_SCAN=1); they are not found here, so --write keeps them.
  const file = new URL("./probes/biome-audit-regions.json", import.meta.url);
  if (process.argv.includes("--write")) writeFileSync(file, JSON.stringify([...regions, ...JSON.parse(readFileSync(file, "utf8")).filter((r) => r.length > 4)]) + "\n");
}
