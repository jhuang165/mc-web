// Column meshes built from a region snapshot (mesh-region.js, what the mesh worker runs) are byte-identical to the page thread's own
// ChunkMesher over the live world: fluids, leaves in Fancy and Fast, ambient occlusion off/minimum/maximum, anaglyph mesh multipliers,
// the Nether and the End, lit furnaces, repeaters and flower pots. A strict snapshot throws on any read beyond its padding.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { World } from "./world.js";
import { DimensionWorld } from "./dimension-world.js";
import { StreamingLight } from "./streaming-light.js";
import { lightEmission } from "./lighting.js";
import { BiomeColorField, setColormaps } from "./biome-colors.js";
import { ChunkMesher, arraysGeometry } from "./chunk-mesher.js";
import { snapshotRegion, runMeshJob, meshLayerArrays, layersOf, LAYERS } from "./mesh-region.js";
import { render } from "./render-settings.js";
import { meshAnaglyph } from "./anaglyph.js";
import { setPotContents } from "./stone-utility.js";

function rgba(bytes) { // PNG decode as in biome-colors.test.js
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), idat = [];
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at), kind = bytes.toString("latin1", at + 4, at + 8);
    if (kind === "IDAT") idat.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * 4, data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? data[y * stride + x - 4] : 0, b = y ? data[(y - 1) * stride + x] : 0, c = x >= 4 && y ? data[(y - 1) * stride + x - 4] : 0,
        pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      data[y * stride + x] = raw[y * (stride + 1) + 1 + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
    }
  }
  return data;
}
const png = (name) => rgba(readFileSync(new URL(`../public/media/1.7.10/colormap/${name}.png`, import.meta.url)));
setColormaps(png("grass"), png("foliage"));

// A deterministic scatter of the block kinds the mesher has special paths for, in and around the column (cx, cz).
function decorate(w, cx, cz, litFurnaces) {
  let s = 12345 + cx * 31 + cz;
  const rnd = (n) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
  const top = (x, z) => { for (let y = w.height - 1; y > 0; y--) if (w.get(x, y, z)) return y + 1; return 1; };
  const kinds = [[5, 0], [5, 1], [5, 2], [71, 0], [85, 0], [101, 0], [102, 0], [53, 1], [64, 0], [64, 8], [65, 2], [20, 1], [20, 5], [50, 0], [51, 0], [8, 0], [9, 0], [10, 0], [11, 0], [79, 0], [95, 3], [26, 0], [54, 0], [117, 0], [118, 0], [145, 0], [154, 0], [93, 1], [94, 2], [55, 0], [69, 5], [77, 1], [70, 0], [72, 0], [96, 1], [107, 0], [108, 0], [109, 0], [139, 0], [44, 0], [43, 0], [126, 0], [158, 0], [159, 0], [160, 0], [36, 0], [31, 1], [37, 0], [38, 0], [175, 2], [175, 3], [120, 0], [120, 4], [18, 0], [17, 0], [2, 0], [3, 0], [12, 0], [13, 0], [82, 0], [89, 0], [123, 0], [14, 0], [61, 0], [62, 0], [112, 0], [113, 0], [27, 0], [28, 0], [66, 0], [106, 0], [131, 0], [132, 0], [146, 0], [147, 0], [148, 0], [149, 0], [150, 0], [151, 0], [152, 0], [153, 0], [155, 0], [156, 0], [157, 0]];
  for (let i = 0; i < 260; i++) {
    const x = cx - 3 + rnd(22), z = cz - 3 + rnd(22);
    if (!w.isLoaded(x, z)) continue;
    const y = top(x, z) + rnd(3) - 1, [b, m] = kinds[rnd(kinds.length)];
    if (y > 1 && y < w.height - 2) w.set(x, y, z, b, false, m);
    if (b === 14 && litFurnaces) litFurnaces.add(`${x},${y},${z}`);
    if (b === 140) setPotContents(w, x, y, z, { id: 38, damage: 0 });
  }
  // a water and lava pool and a wall of leaves across the column edges
  for (let x = cx - 2; x < cx + 6; x++) for (let z = cz + 5; z < cz + 9; z++) if (w.isLoaded(x, z)) { const y = top(x, z); w.set(x, y, z, x < cx + 2 ? 8 : 10, false, 0); }
  for (let y = 66; y < 74; y++) for (let x = cx + 12; x < cx + 20; x++) if (w.isLoaded(x, cz + 17)) w.set(x, y, cz + 17, 18, false, 0);
}

function sources(world, litFurnaces, repeaterLit) {
  const light = new StreamingLight(world, (x, y, z, b) => (b === 112 ? lightEmission(b, repeaterLit(x, y, z)) : lightEmission(b, b === 14 && litFurnaces.has(`${x},${y},${z}`))), { native: false });
  const ox = world.originX ?? 0, oz = world.originZ ?? 0, preset = world.biomeAt(0, 0) ?? { slot: 1, id: 1, temperature: 0.8, rainfall: 0.4 };
  return { world, light, litFurnaces, repeaterLit, colorX: ox, colorZ: oz,
    biomeColors: new BiomeColorField((x, z) => world.biomeAt?.(x - ox, z - oz) ?? preset) };
}

// Page-thread arrays for a column: ChunkMesher over the live world, then three's own geometry attributes.
function direct(src, cx, cz) {
  const meshers = new ChunkMesher(src).meshColumn(cx, cz), out = {};
  const all = layersOf(meshers);
  for (const name of LAYERS) {
    const g = all[name].geometry();
    out[name] = g && { position: g.attributes.position.array, uv: g.attributes.uv.array, shade: g.attributes.shade.array, lightCoord: g.attributes.lightCoord.array, index: g.index.array };
  }
  return out;
}
// Worker-path arrays: snapshot, structured-clone-like copy, strict region mesher, then the page's buffers.
function viaWorker(src, cx, cz) {
  const { job } = snapshotRegion(src, cx, cz), copy = structuredClone(job), { message } = runMeshJob(copy, { strict: true }), out = {};
  for (const name of LAYERS) { const g = arraysGeometry(message.layers[name]); out[name] = g && { position: g.attributes.position.array, uv: g.attributes.uv.array, shade: g.attributes.shade.array, lightCoord: g.attributes.lightCoord.array, index: g.index.array }; }
  return { out, message };
}
const same = (a, b, label) => {
  for (const name of LAYERS) {
    assert.equal(!!a[name], !!b[name], `${label} ${name}: layer present`);
    if (!a[name]) continue;
    for (const k of Object.keys(a[name])) {
      assert.equal(a[name][k].constructor, b[name][k].constructor, `${label} ${name}.${k}: array type`);
      assert.ok(Buffer.from(a[name][k].buffer, a[name][k].byteOffset, a[name][k].byteLength).equals(Buffer.from(b[name][k].buffer, b[name][k].byteOffset, b[name][k].byteLength)), `${label} ${name}.${k}: bytes`);
    }
  }
};
const settings = [
  { fancy: true, ao: 2, anaglyph: false }, { fancy: false, ao: 2, anaglyph: false }, { fancy: true, ao: 0, anaglyph: false },
  { fancy: true, ao: 1, anaglyph: false }, { fancy: true, ao: 2, anaglyph: true }, { fancy: false, ao: 1, anaglyph: true },
];
const apply = (o) => { render.fancy = o.fancy; render.ao = o.ao; meshAnaglyph.on = o.anaglyph; };

function compare(world, label, columns) {
  const lit = new Set(), repeaters = new Set();
  for (const [cx, cz] of columns) decorate(world, cx, cz, lit);
  // repeaters: some lit
  for (const [cx, cz] of columns) for (let x = cx; x < cx + 16; x++) for (let z = cz; z < cz + 16; z++) for (let y = 0; y < world.height; y++) if (world.get(x, y, z) === 112 && (x + z) % 2) repeaters.add(`${x},${y},${z}`);
  const src = sources(world, lit, (x, y, z) => repeaters.has(`${x},${y},${z}`));
  let verts = 0;
  for (const o of settings) {
    apply(o);
    for (const [cx, cz] of columns) {
      const a = direct(src, cx, cz), { out, message } = viaWorker(src, cx, cz), tag = `${label} ${JSON.stringify(o)} ${cx},${cz}`;
      same(a, out, tag);
      for (const name of LAYERS) verts += a[name]?.position.length / 3 || 0;
      assert.ok(Array.isArray(message.repeaters));
    }
  }
  apply({ fancy: true, ao: 2, anaglyph: false });
  return verts;
}

test("worker region meshes equal the page-thread mesher: Overworld window, every render setting", () => {
  const w = new World("mesh-1", "javaStreamed", 12);
  const verts = compare(w, "overworld", [[0, 0], [48, 32], [16, 112], [112, 0], [64, 64]]);
  assert.ok(verts > 20000, `meshes carry geometry (${verts} vertices)`);
});

test("worker region meshes equal the page-thread mesher: Nether and End windows", () => {
  for (const dim of [-1, 1]) {
    const w = new DimensionWorld("mesh-2", dim);
    w.streamAround(8, 8);
    const columns = [[w.minX, w.minZ], [w.minX + 48, w.minZ + 48], [w.minX + 112, w.minZ + 112]];
    assert.ok(compare(w, dim === -1 ? "nether" : "end", columns) > 5000);
  }
});

test("a snapshot is transferable typed arrays and the layers are typed", () => {
  const w = new World("mesh-3", "javaStreamed", 12), lit = new Set(), src = sources(w, lit, () => false);
  const { job, transfer } = snapshotRegion(src, 32, 32);
  assert.equal(transfer.length, 5);
  assert.equal(job.blocks.length, 20 * 20 * w.height);
  const { message, transfer: out } = runMeshJob(structuredClone(job), { strict: true });
  assert.ok(message.layers.solid.position instanceof Float32Array);
  assert.ok(out.length >= 5);
  assert.deepEqual(Object.keys(message.layers), LAYERS);
});

test('?meshWorkers=N sets the pool size (1 to 16); anything else keeps min(3, cores - 2)', async () => {
  const { defaultMeshWorkers } = await import('./mesh-pool.js'), had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    for (const [search, want] of [['?meshWorkers=6', 6], ['?meshWorkers=1', 1], ['?meshWorkers=0', Math.max(1, Math.min(3, (globalThis.navigator?.hardwareConcurrency ?? 4) - 2))], ['?meshWorkers=99', Math.max(1, Math.min(3, (globalThis.navigator?.hardwareConcurrency ?? 4) - 2))]]) {
      Object.defineProperty(globalThis, 'location', { value: { search }, configurable: true });
      assert.equal(defaultMeshWorkers(), want, search);
    }
  } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
});
