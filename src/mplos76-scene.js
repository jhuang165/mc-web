// Batch 76 mplos76: seeded scenes and rays for comparing rayTraceBlocks with rayTraceBlocksReference (tools/bench-raytrace.mjs, mplos76-b76.test.js).
export const lcg = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
// 'flat': stone floor at y 9, air above (the server benchmark's field). 'mixed': the same floor plus a block soup (every id 1..175 with random metadata, ~12%
// density, water, fire, stairs, fences, doors, torches, slabs...) in a 48 x 24 x 48 box so rays meet shaped boxes, liquids and column borders.
export function buildScene(World, kind = 'flat', seed = 11) {
  const world = new World('mplos76-' + kind), size = kind === 'flat' ? 120 : 64;
  for (let x = 4; x < size; x++) for (let z = 4; z < size; z++) { world.put(x, 9, z, 1, 0, false); for (let y = 10; y <= 20; y++) world.put(x, y, z, 0, 0, false); }
  if (kind === 'mixed') {
    const r = lcg(seed), ids = [...Array(176).keys()].slice(1);
    for (let x = 8; x < 56; x++) for (let z = 8; z < 56; z++) for (let y = 10; y < 22; y++) {
      const q = r();
      if (q < 0.12) world.put(x, y, z, ids[Math.floor(r() * ids.length)], Math.floor(r() * 16), false);
      else if (q < 0.15) world.put(x, y, z, [10, 9, 42, 51, 50, 53, 85, 64][Math.floor(r() * 8)], Math.floor(r() * 16), false);
    }
  }
  return world;
}
// [start, end, hasBox] triples: random starts in the box (some on integer coordinates, some inside blocks), ends up to `reach` away, a few far beyond the 200-step limit.
export function randomRays(n, seed = 5, reach = 30, lo = 5, hi = 60, level = false) {
  const r = lcg(seed), out = [];
  for (let i = 0; i < n; i++) {
    const snap = r() < 0.15 ? (v) => Math.round(v) : (v) => v, p = () => [snap(lo + r() * (hi - lo)), snap(level ? 11 + r() * 3 : 8 + r() * 16), snap(lo + r() * (hi - lo))];
    const a = p(), far = r() < 0.03 ? 400 : reach;
    const b = [a[0] + (r() - 0.5) * 2 * far, a[1] + (r() - 0.5) * (level ? 2 : far), a[2] + (r() - 0.5) * 2 * far];
    if (r() < 0.05) b[1 + Math.floor(r() * 2) * 0] = Math.floor(b[1]); // an end on a cell plane
    if (r() < 0.04) b[0] = a[0]; // axis-parallel segments
    if (r() < 0.04) b[2] = a[2];
    out.push([a, b, r() < 0.2]);
  }
  return out;
}
