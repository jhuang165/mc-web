// Column meshing off the page thread. A job is a snapshot of everything the mesher of one 16 x 16 column reads: block ids and metadata
// of the column plus PAD cells on every side, the sky and block light of the same cells, the biomes for the colour averages, lit
// furnaces, repeaters and flower pots in the region, and the render options. `RegionSource` rebuilds a mesher source from that snapshot
// (get/getMeta, LightVolume.packed, BiomeColorField) and `runMeshJob` runs the page thread's own ChunkMesher over it, so the arrays are
// those the page thread builds. The page makes only the buffers (chunk-mesher.js arraysGeometry).
import { ChunkMesher } from "./chunk-mesher.js";
import { BiomeColorField } from "./biome-colors.js";
import { World, HEIGHT, SIZE } from "./world.js";
import { useNeighborBrightness, lightEmission, pack } from "./lighting.js";
import { render } from "./render-settings.js";
import { meshAnaglyph } from "./anaglyph.js";

// The mesher reads at most two cells outside its column (corner light of a neighbour that itself reads its neighbours).
export const PAD = 2, SPAN = 16 + 2 * PAD, BIOME_PAD = 1, BIOME_SPAN = 16 + 2 * BIOME_PAD;
const MAX_LAYER = 0xffff;

// --- page side: the snapshot -----------------------------------------------------------------------------------------------------

// `scene` is the VoxelScene (or any source with world, light, biomeColors, colorX, colorZ, litFurnaces, repeaterLit).
export function snapshotRegion(scene, cx, cz) {
  const world = scene.world, H = world.height ?? HEIGHT, light = scene.light, vol = light.inner ?? light, offX = light.inner ? light.x : 0, offZ = light.inner ? light.z : 0;
  const noSky = !!vol.world.hasNoSky, n = SPAN * SPAN * H, blocks = new Uint8Array(n), meta = new Uint8Array(n), sky = new Uint8Array(n), block = new Uint8Array(n);
  const x0 = cx - PAD, z0 = cz - PAD, skyFill = noSky ? 0 : 15;
  for (let rx = 0; rx < SPAN; rx++)
    for (let rz = 0; rz < SPAN; rz++) {
      const x = x0 + rx, z = z0 + rz, o = (rx * SPAN + rz) * H;
      if (world.inside ? world.inside(x, 0, z) : true) {
        const c = world.chunkAt ? world.chunkAt(x >> 4, z >> 4) : null;
        if (c) { const s = ((x & 15) * 16 + (z & 15)) * H; blocks.set(c.blocks.subarray(s, s + H), o); meta.set(c.meta.subarray(s, s + H), o); }
        else if (world.ringReads) for (let y = 0; y < H; y++) { blocks[o + y] = world.get(x, y, z); meta[o + y] = world.getMeta(x, y, z); }
      }
      const lx = x - offX, lz = z - offZ;
      if (lx >= 0 && lz >= 0 && lx < SIZE && lz < SIZE) { const s = (lx * SIZE + lz) * vol.height; sky.set(vol.sky.subarray(s, s + H), o); block.set(vol.block.subarray(s, s + H), o); }
      else sky.fill(skyFill, o, o + H);
    }
  // Biomes at the column's native coordinates plus one cell (the 3 x 3 colour averages), as indices into a small palette.
  const palette = [], seen = new Map(), biomeIdx = new Uint16Array(BIOME_SPAN * BIOME_SPAN), bx0 = cx + scene.colorX - BIOME_PAD, bz0 = cz + scene.colorZ - BIOME_PAD;
  for (let i = 0; i < BIOME_SPAN; i++)
    for (let j = 0; j < BIOME_SPAN; j++) {
      const b = scene.biomeColors.biome(bx0 + i, bz0 + j);
      let k = seen.get(b);
      if (k === undefined) { k = palette.length; palette.push(b); seen.set(b, k); }
      biomeIdx[i * BIOME_SPAN + j] = k;
    }
  const inRegion = (x, z) => x >= x0 && x < x0 + SPAN && z >= z0 && z < z0 + SPAN;
  const furnaces = []; for (const key of scene.litFurnaces ?? []) { const [x, , z] = key.split(",").map(Number); if (inRegion(x, z)) furnaces.push(key); }
  const repeaters = []; // lit repeaters in the region (BlockRedstoneRepeater light 9 reads LiveRedstone.lit)
  for (let i = blocks.indexOf(112); i >= 0; i = blocks.indexOf(112, i + 1)) {
    const y = i % H, t = (i - y) / H, rz = t % SPAN, rx = (t - rz) / SPAN, x = x0 + rx, z = z0 + rz;
    repeaters.push([x, y, z, !!scene.repeaterLit(x, y, z)]);
  }
  const pots = []; if (world.pots?.size) for (const [key, rec] of world.pots) { const [x, , z] = key.split(",").map(Number); if (inRegion(x, z)) pots.push([key, rec]); }
  const job = { cx, cz, height: H, noSky, colorX: scene.colorX, colorZ: scene.colorZ, fancy: render.fancy, ao: render.ao, anaglyph: !!meshAnaglyph.on,
    blocks, meta, sky, block, palette, biomeIdx, furnaces, repeaters, pots };
  return { job, transfer: [blocks.buffer, meta.buffer, sky.buffer, block.buffer, biomeIdx.buffer] };
}

// --- worker side: the mesher source ----------------------------------------------------------------------------------------------

// The world as the mesher reads it. `strict` throws on a read outside the snapshot (tests assert the PAD is enough).
class RegionWorld {
  constructor(job, strict) {
    this.job = job; this.height = job.height; this.strict = strict; this.x0 = job.cx - PAD; this.z0 = job.cz - PAD;
    this.pots = new Map(job.pots);
  }
  index(x, y, z) {
    const rx = x - this.x0, rz = z - this.z0;
    if (rx < 0 || rz < 0 || rx >= SPAN || rz >= SPAN) { if (this.strict) throw new Error(`mesh read outside the snapshot at ${x},${y},${z}`); return -1; }
    return (rx * SPAN + rz) * this.height + y;
  }
  get(x, y, z) { if (y < 0 || y >= this.height) return 0; const i = this.index(x, y, z); return i < 0 ? 0 : this.job.blocks[i]; }
  getMeta(x, y, z) { if (y < 0 || y >= this.height) return 0; const i = this.index(x, y, z); return i < 0 ? 0 : this.job.meta[i]; }
  solid(x, y, z) { return World.prototype.solid.call(this, x, y, z); } // World.solid reads only get and getMeta
}

// LightVolume.packed / skyAt / blockAt over the snapshot (cells outside the light volume were filled with the volume's defaults).
class RegionLight {
  constructor(job, world, strict) {
    this.job = job; this.world = world; this.height = job.height; this.noSky = job.noSky;
    this.furnaces = new Set(job.furnaces); this.repeaterLit = new Map(job.repeaters.map(([x, y, z, lit]) => [`${x},${y},${z}`, lit]));
    this.queried = new Set(); // repeater cells whose emission was asked for: the page records them as the light volume's emission callback does
  }
  skyAt(x, y, z) {
    if (y >= this.height) return this.noSky ? 0 : 15;
    const i = this.world.index(x, Math.max(0, y), z);
    return i < 0 ? (this.noSky ? 0 : 15) : this.job.sky[i];
  }
  blockAt(x, y, z) {
    if (y >= this.height) return 0;
    const i = this.world.index(x, Math.max(0, y), z);
    return i < 0 ? 0 : this.job.block[i];
  }
  emission(x, y, z, b) {
    if (b === 112) { const key = `${x},${y},${z}`; this.queried.add(key); return lightEmission(b, this.repeaterLit.get(key) === true); }
    return lightEmission(b, b === 14 && this.furnaces.has(`${x},${y},${z}`));
  }
  packed(x, y, z) {
    const b = this.world.get(x, y, z);
    let sky, block;
    if (useNeighborBrightness(b)) {
      sky = Math.max(this.skyAt(x, y + 1, z), this.skyAt(x + 1, y, z), this.skyAt(x - 1, y, z), this.skyAt(x, y, z + 1), this.skyAt(x, y, z - 1));
      block = Math.max(this.blockAt(x, y + 1, z), this.blockAt(x + 1, y, z), this.blockAt(x - 1, y, z), this.blockAt(x, y, z + 1), this.blockAt(x, y, z - 1));
    } else {
      sky = this.skyAt(x, y, z);
      block = this.blockAt(x, y, z);
    }
    return pack(sky, Math.max(block, b ? this.emission(x, y, z, b) : 0));
  }
}

export class RegionSource {
  constructor(job, { strict = false } = {}) {
    this.job = job;
    this.world = new RegionWorld(job, strict);
    this.light = new RegionLight(job, this.world, strict);
    this.colorX = job.colorX; this.colorZ = job.colorZ;
    this.litFurnaces = this.light.furnaces;
    const bx0 = job.cx + job.colorX - BIOME_PAD, bz0 = job.cz + job.colorZ - BIOME_PAD;
    this.biomeColors = new BiomeColorField((x, z) => {
      const i = x - bx0, j = z - bz0;
      if (i < 0 || j < 0 || i >= BIOME_SPAN || j >= BIOME_SPAN) { if (strict) throw new Error(`biome read outside the snapshot at ${x},${z}`); return job.palette[0]; }
      return job.palette[job.biomeIdx[i * BIOME_SPAN + j]];
    });
  }
}

// The layers of one column in the order the page adds them.
export const LAYERS = ["solid", "water", "ice", "flow", "lava", "lavaFlow", "fire0", "fire1", "portal"];
export const layersOf = (m) => ({ solid: m.solid, water: m.water, ice: m.ice, flow: m.flow, lava: m.lava, lavaFlow: m.lavaFlow, fire0: m.fire[0], fire1: m.fire[1], portal: m.portal });

// A Mesher's arrays as typed arrays, or null when it has no triangles. The index is Uint16 unless a vertex index reaches 65535 (three.js arrayNeedsUint32).
export function meshArrays(mesher) {
  if (!mesher.idx.length) return null;
  let big = false;
  for (let i = mesher.idx.length - 1; i >= 0; i--) if (mesher.idx[i] >= MAX_LAYER) { big = true; break; }
  return { position: new Float32Array(mesher.p), uv: new Float32Array(mesher.uv), shade: mesher.colors(), lightCoord: new Float32Array(mesher.light), index: big ? new Uint32Array(mesher.idx) : new Uint16Array(mesher.idx) };
}

export function meshLayerArrays(meshers) {
  const layers = {}, transfer = [], all = layersOf(meshers);
  for (const name of LAYERS) {
    const a = meshArrays(all[name]);
    layers[name] = a;
    if (a) for (const v of Object.values(a)) transfer.push(v.buffer);
  }
  return { layers, transfer };
}

// Runs one job; returns the message to post and its transfer list.
export function runMeshJob(job, { strict = false } = {}) {
  render.fancy = job.fancy; render.ao = job.ao; meshAnaglyph.on = job.anaglyph;
  const source = new RegionSource(job, { strict }), mesher = new ChunkMesher(source), meshers = mesher.meshColumn(job.cx, job.cz);
  const { layers, transfer } = meshLayerArrays(meshers);
  return { message: { type: "mesh", id: job.id, layers, repeaters: [...source.light.queried] }, transfer };
}
