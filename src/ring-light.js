// Bulk light for one headless ring column (headless-columns.js RingLight, public/research/light-engine.md "Batch 29").
//
// RingLight answers one cell at a time with a reverse search (about 30k grid cells reset per query). A column that is asked about
// often is lit once instead: the 3 x 3 chunks around it are read into a work volume (held columns and resident chunks; a missing
// column reads as air, as in the search), the sky is seeded at every cell at or above the height map where a neighbouring column
// is taller, block light at every emitter, and both are spread by value (a cell takes its brightest neighbour minus
// max(1, opacity); cells with opacity 15 receive nothing, an emitting opaque block costs 1, the rule of World.computeLightValue).
// That is the fixed point LightVolume keeps for the resident window, so the centre column's values are exactly what a resident
// column would hold at build time. Light travels at most 14 cells, so the centre needs only the ring of chunks around it.
import { lightEmission, lightOpacity } from "./lighting.js";

const OPACITY = new Uint8Array(256), EMISSION = new Uint8Array(256), COST = new Uint8Array(256);
for (let b = 0; b < 256; b++) {
  const op = Math.min(255, lightOpacity(b)), e = lightEmission(b);
  OPACITY[b] = op; EMISSION[b] = e;
  COST[b] = op >= 15 && e > 0 ? 1 : Math.max(1, Math.min(15, op));
}
export { OPACITY, EMISSION, COST };

const BARRIER = 1; // stone: opacity 15, no emission
const N = 48; // work volume: 3 x 3 chunks
let work = new Uint8Array(0), skyArr = new Uint8Array(0), blockArr = new Uint8Array(0);
const heights = new Uint16Array(N * N);
const buckets = Array.from({ length: 16 }, () => []);

// Spreads `arr` (seeds already written and listed in buckets[level]) over `ids`: a popped cell hands value - cost to every
// neighbour that can receive light and holds less.
function spread(arr, ids, Hh) {
  const XS = N * Hh;
  for (let level = 15; level > 1; level--) {
    const list = buckets[level];
    for (let q = 0; q < list.length; q++) {
      const idx = list[q];
      if (arr[idx] !== level) continue; // raised later
      const y = idx % Hh, t = (idx - y) / Hh, lz = t % N, lx = (t - lz) / N;
      if (lx > 0) { const n = idx - XS, c = COST[ids[n]]; if (c < 15 && level - c > arr[n]) { arr[n] = level - c; buckets[level - c].push(n); } }
      if (lx < N - 1) { const n = idx + XS, c = COST[ids[n]]; if (c < 15 && level - c > arr[n]) { arr[n] = level - c; buckets[level - c].push(n); } }
      if (lz > 0) { const n = idx - Hh, c = COST[ids[n]]; if (c < 15 && level - c > arr[n]) { arr[n] = level - c; buckets[level - c].push(n); } }
      if (lz < N - 1) { const n = idx + Hh, c = COST[ids[n]]; if (c < 15 && level - c > arr[n]) { arr[n] = level - c; buckets[level - c].push(n); } }
      if (y > 0) { const n = idx - 1, c = COST[ids[n]]; if (c < 15 && level - c > arr[n]) { arr[n] = level - c; buckets[level - c].push(n); } }
      if (y < Hh - 1) { const n = idx + 1, c = COST[ids[n]]; if (c < 15 && level - c > arr[n]) { arr[n] = level - c; buckets[level - c].push(n); } }
    }
    list.length = 0;
  }
  buckets[1].length = 0;
}

// The packed light (sky << 4 | block) of the 16 x 16 column (cx, cz), layout (lx * 16 + lz) * hh + y for y < hh, or null when the
// column itself is not held. `hh` is the work volume's height (cells at or above it are open air: sky 15, block 0).
export function computeColumnLight(ring, cx, cz, noSky) {
  const world = ring.world, H = ring.height;
  // Source of each of the nine chunks: a held column, a resident chunk, or nothing.
  const src = [];
  let Hh = 16;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    const ccx = cx + a - 1, ccz = cz + b - 1, x0 = ccx * 16, z0 = ccz * 16;
    let s = null;
    if (ring.resident(x0, z0)) {
      const top = world.chunkAt(ccx, ccz);
      if (top) {
        let h = 0;
        for (let i = 0; i < 256; i++) { const base = i * H; for (let y = H - 1; y >= h; y--) if (top.blocks[base + y]) { h = y + 1; break; } }
        s = { blocks: top.blocks, h: H, rows: H, hh: Math.min(H, (h + 15) & ~15) };
        Hh = Math.max(Hh, s.hh);
      }
    } else {
      const col = ring.cols.get(ring.key(ccx, ccz));
      if (col) { s = { blocks: col.blocks, h: col.h, rows: col.h, hh: col.h }; Hh = Math.max(Hh, col.h); }
    }
    src.push(s);
  }
  // Emitters near the top light cells up to 14 above them.
  Hh = Math.min(H, Hh + 16);
  const centre = src[4];
  if (!centre) return null;
  // A neighbouring chunk that is neither resident nor held is unloaded: natively no light update runs within 17 blocks of an unloaded
  // chunk and generation leaves lateral light lazy, so nothing is lit from or across it. It is a barrier here (no seeds, no emitters,
  // receives and carries nothing) instead of open air with sky 15, which lit rim columns brighter than native.
  const total = N * N * Hh;
  if (work.length < total) { work = new Uint8Array(total); skyArr = new Uint8Array(total); blockArr = new Uint8Array(total); }
  const ids = work.subarray(0, total), sky = skyArr.subarray(0, total), block = blockArr.subarray(0, total);
  ids.fill(0); sky.fill(0); block.fill(0);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    const s = src[a * 3 + b];
    if (!s) continue;
    const copy = Math.min(s.h, Hh);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const from = (x * 16 + z) * s.rows, to = ((a * 16 + x) * N + b * 16 + z) * Hh;
      ids.set(s.blocks.subarray(from, from + copy), to);
    }
  }
  // Height map (the first opaque cell from the top, plus one) and the sky seeds.
  if (!noSky) {
    for (let c = 0; c < N * N; c++) {
      const base = c * Hh;
      let y = Hh - 1;
      while (y >= 0 && OPACITY[ids[base + y]] === 0) y--;
      heights[c] = y + 1;
    }
    for (let lx = 0; lx < N; lx++) for (let lz = 0; lz < N; lz++) {
      if (!src[(lx >> 4) * 3 + (lz >> 4)]) continue;
      const c = lx * N + lz, h = heights[c], base = c * Hh;
      let m = h;
      if (lx > 0 && heights[c - N] > m) m = heights[c - N];
      if (lx < N - 1 && heights[c + N] > m) m = heights[c + N];
      if (lz > 0 && heights[c - 1] > m) m = heights[c - 1];
      if (lz < N - 1 && heights[c + 1] > m) m = heights[c + 1];
      if (h < Hh) sky.fill(15, base + h, base + Hh);
      // The cell just above the height map also seeds: the top block may be translucent (water, leaves) and take light from above.
      if (m <= h) m = h + 1;
      if (m > Hh) m = Hh;
      for (let y = h; y < m; y++) buckets[15].push(base + y);
    }
  }
  // Barrier cells for the absent chunks (after the height map, which reads them as air and so never lets them raise a neighbour's seeds).
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    if (src[a * 3 + b]) continue;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) { const to = ((a * 16 + x) * N + b * 16 + z) * Hh; ids.fill(BARRIER, to, to + Hh); }
  }
  if (!noSky) spread(sky, ids, Hh);
  // Block light: every emitter, then the spread.
  for (let i = 0; i < total; i++) {
    const e = EMISSION[ids[i]];
    if (e) { block[i] = e; if (e > 1) buckets[e].push(i); }
  }
  spread(block, ids, Hh);
  const out = new Uint8Array(256 * Hh);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const from = ((16 + x) * N + 16 + z) * Hh, to = (x * 16 + z) * Hh;
    for (let y = 0; y < Hh; y++) out[to + y] = sky[from + y] << 4 | block[from + y];
  }
  return { hh: Hh, packed: out };
}
