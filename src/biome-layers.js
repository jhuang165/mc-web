// Minecraft Java 1.7.10 Overworld biome layers: GenLayer.initializeAllBiomeGenerators (axn.a(long, WorldType)) and
// WorldChunkManager (aib), decoded with javap and checked cell for cell against the unchanged client by
// src/biome-layers.test.js (reference: public/research/biome-layers-reference.json, tools/verify-biome-layers.mjs).
// See public/research/generation.md. Not wired into World yet: the live game still uses its own 128 x 128 terrain.
//
// Seeds are Java longs. The per-cell LCG runs on [hi, lo] int32 pairs (java-long.js); constructors and
// initWorldGenSeed use BigInt. getInts always returns a fresh Int32Array of w * h cells (IntCache only recycles
// arrays, and every layer writes all of its cells, so it never changes a value).

import { mul, add, H, L, fromBig } from "./java-long.js";
import { B, getBiome, TEMP_MEDIUM } from "./java-biomes.js";

const M = 6364136223846793005n, A = 1442695040888963407n;
const MH = 1481765933, ML = 1284865837, AH = 335903614, AL = -144211633; // M and A as [hi, lo]

export const WORLD_TYPES = ["default", "largeBiomes", "amplified", "default_1_1"];

const toLong = (v) => BigInt.asIntN(64, typeof v === "bigint" ? v : BigInt(v));

// GenLayer (axn).
export class GenLayer {
  constructor(base, parent = null) {
    this.parent = parent;
    const s = toLong(base);
    let b = s;
    for (let i = 0; i < 3; i++) b = BigInt.asIntN(64, b * (b * M + A) + s);
    this.base = b;
    fromBig(b);
    this.bh = H; this.bl = L;
    this.ch = 0; this.cl = 0; // worldGenSeed
    this.dh = 0; this.dl = 0; // chunkSeed
  }
  // initWorldGenSeed (axn.a(long)): parents first, then three LCG steps over the base seed.
  initWorldGenSeed(seed) {
    let c = toLong(seed);
    this.parent?.initWorldGenSeed(seed);
    for (let i = 0; i < 3; i++) c = BigInt.asIntN(64, c * (c * M + A) + this.base);
    fromBig(c);
    this.ch = H; this.cl = L;
  }
  get worldSeed() {
    return BigInt.asIntN(64, (BigInt(this.ch) << 32n) | BigInt(this.cl >>> 0));
  }
  // initChunkSeed (axn.a(long, long)); x and z arrive as ints and are sign-extended.
  initChunkSeed(x, z) {
    const xh = x < 0 ? -1 : 0, zh = z < 0 ? -1 : 0;
    let dh = this.ch, dl = this.cl;
    for (let i = 0; i < 4; i++) {
      mul(dh, dl, MH, ML); add(H, L, AH, AL); mul(dh, dl, H, L);
      if (i & 1) add(H, L, zh, z); else add(H, L, xh, x);
      dh = H; dl = L;
    }
    this.dh = dh; this.dl = dl;
  }
  // nextInt (axn.a(int)): (int)((chunkSeed >> 24) % n), made non-negative, then one step over worldGenSeed.
  nextInt(n) {
    let r = (this.dh * 256 + (this.dl >>> 24)) % n;
    if (r < 0) r += n;
    const dh = this.dh, dl = this.dl;
    mul(dh, dl, MH, ML); add(H, L, AH, AL); mul(dh, dl, H, L); add(H, L, this.ch, this.cl);
    this.dh = H; this.dl = L;
    return r;
  }
  // selectRandom (axn.a(int...)).
  pick2(a, b) {
    return this.nextInt(2) === 0 ? a : b;
  }
  pick4(a, b, c, d) {
    const i = this.nextInt(4);
    return i === 0 ? a : i === 1 ? b : i === 2 ? c : d;
  }
  // selectModeOrRandom (axn.b(int, int, int, int)).
  modeOrRandom(a, b, c, d) {
    if (b === c && c === d) return b;
    if (a === b && a === c) return a;
    if (a === b && a === d) return a;
    if (a === c && a === d) return a;
    if (a === b && c !== d) return a;
    if (a === c && b !== d) return a;
    if (a === d && b !== c) return a;
    if (b === c && a !== d) return b;
    if (b === d && a !== c) return b;
    if (c === d && a !== b) return c;
    return this.pick4(a, b, c, d);
  }
}

// GenLayer.compareBiomesById (static axn.a(int, int)).
export function compareBiomesById(a, b) {
  if (a === b) return true;
  if (a === B.mesaPlateau_F || a === B.mesaPlateau) return b === B.mesaPlateau_F || b === B.mesaPlateau;
  const x = getBiome(a), y = getBiome(b);
  return x !== null && y !== null && x.isEqualTo(y);
}
// GenLayer.isBiomeOceanic (static axn.b(int)).
export const isOceanic = (id) => id === B.ocean || id === B.deepOcean || id === B.frozenOcean;

// The parent area one cell wider on every side, (w + 2) x (h + 2) from (x - 1, z - 1).
function padded(layer, x, z, w, h) {
  return layer.parent.getInts(x - 1, z - 1, w + 2, h + 2);
}

// GenLayerIsland (axm).
export class IslandLayer extends GenLayer {
  getInts(x, z, w, h) {
    const out = new Int32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        this.initChunkSeed(x + i, z + j);
        out[i + j * w] = this.nextInt(10) === 0 ? 1 : 0;
      }
    if (x > -w && x <= 0 && z > -h && z <= 0) out[-x + -z * w] = 1;
    return out;
  }
}

// GenLayerZoom (ayc); FuzzyZoom overrides the corner choice with a plain random pick.
export class ZoomLayer extends GenLayer {
  corner(a, b, c, d) {
    return this.modeOrRandom(a, b, c, d);
  }
  getInts(x, z, w, h) {
    const px = x >> 1, pz = z >> 1, pw = (w >> 1) + 2, ph = (h >> 1) + 2;
    const p = this.parent.getInts(px, pz, pw, ph);
    const tw = (pw - 1) << 1, t = new Int32Array(tw * ((ph - 1) << 1));
    for (let j = 0; j < ph - 1; j++) {
      let idx = (j << 1) * tw, a = p[j * pw], c = p[(j + 1) * pw];
      for (let i = 0; i < pw - 1; i++) {
        this.initChunkSeed((i + px) << 1, (j + pz) << 1);
        const b = p[i + 1 + j * pw], d = p[i + 1 + (j + 1) * pw];
        t[idx] = a;
        t[idx++ + tw] = this.pick2(a, c);
        t[idx] = this.pick2(a, b);
        t[idx++ + tw] = this.corner(a, b, c, d);
        a = b;
        c = d;
      }
    }
    const out = new Int32Array(w * h);
    for (let row = 0; row < h; row++) {
      const from = (row + (z & 1)) * tw + (x & 1);
      out.set(t.subarray(from, from + w), row * w);
    }
    return out;
  }
  // GenLayerZoom.magnify (ayc.b(long, GenLayer, int)).
  static magnify(base, layer, n) {
    for (let i = 0; i < n; i++) layer = new ZoomLayer(toLong(base) + BigInt(i), layer);
    return layer;
  }
}
export class FuzzyZoomLayer extends ZoomLayer {
  corner(a, b, c, d) {
    return this.pick4(a, b, c, d);
  }
}

// GenLayerAddIsland (axb).
export class AddIslandLayer extends GenLayer {
  getInts(x, z, w, h) {
    const pw = w + 2, p = padded(this, x, z, w, h), out = new Int32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const c00 = p[i + j * pw], c20 = p[i + 2 + j * pw], c02 = p[i + (j + 2) * pw], c22 = p[i + 2 + (j + 2) * pw];
        const v = p[i + 1 + (j + 1) * pw];
        this.initChunkSeed(i + x, j + z);
        if (v === 0 && (c00 !== 0 || c20 !== 0 || c02 !== 0 || c22 !== 0)) {
          let n = 1, r = 1;
          if (c00 !== 0 && this.nextInt(n++) === 0) r = c00;
          if (c20 !== 0 && this.nextInt(n++) === 0) r = c20;
          if (c02 !== 0 && this.nextInt(n++) === 0) r = c02;
          if (c22 !== 0 && this.nextInt(n++) === 0) r = c22;
          out[i + j * w] = this.nextInt(3) === 0 ? r : r === 4 ? 4 : 0;
        } else if (v > 0 && (c00 === 0 || c20 === 0 || c02 === 0 || c22 === 0)) {
          out[i + j * w] = this.nextInt(5) === 0 ? (v === 4 ? 4 : 0) : v;
        } else out[i + j * w] = v;
      }
    return out;
  }
}

// Base for the layers that look at the four cross neighbours of each cell.
class CrossLayer extends GenLayer {
  getInts(x, z, w, h) {
    const pw = w + 2, p = padded(this, x, z, w, h), out = new Int32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const up = p[i + 1 + j * pw], left = p[i + (j + 1) * pw], right = p[i + 2 + (j + 1) * pw], down = p[i + 1 + (j + 2) * pw];
        out[i + j * w] = this.cell(p[i + 1 + (j + 1) * pw], up, right, left, down, i + x, j + z);
      }
    return out;
  }
}

// GenLayerRemoveTooMuchOcean (axs).
export class RemoveTooMuchOceanLayer extends CrossLayer {
  cell(v, up, right, left, down, x, z) {
    this.initChunkSeed(x, z);
    return v === 0 && up === 0 && right === 0 && left === 0 && down === 0 && this.nextInt(2) === 0 ? 1 : v;
  }
}

// GenLayerAddSnow (axd).
export class AddSnowLayer extends CrossLayer {
  cell(v, up, right, left, down, x, z) {
    this.initChunkSeed(x, z);
    if (v === 0) return 0;
    const r = this.nextInt(6);
    return r === 0 ? 4 : r <= 1 ? 3 : 1;
  }
}

// GenLayerEdge (awy) with GenLayerEdge.Mode (axa): 0 COOL_WARM, 1 HEAT_ICE, 2 SPECIAL.
export const EDGE_COOL_WARM = 0, EDGE_HEAT_ICE = 1, EDGE_SPECIAL = 2;
export class EdgeLayer extends CrossLayer {
  constructor(base, parent, mode) {
    super(base, parent);
    this.mode = mode;
  }
  getInts(x, z, w, h) {
    if (this.mode !== EDGE_SPECIAL) return super.getInts(x, z, w, h);
    const p = this.parent.getInts(x, z, w, h), out = new Int32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        this.initChunkSeed(i + x, j + z);
        let v = p[i + j * w];
        if (v !== 0 && this.nextInt(13) === 0) v |= ((1 + this.nextInt(15)) << 8) & 0xf00;
        out[i + j * w] = v;
      }
    return out;
  }
  cell(v, up, right, left, down, x, z) {
    this.initChunkSeed(x, z);
    if (this.mode === EDGE_COOL_WARM)
      return v === 1 && (up === 3 || right === 3 || left === 3 || down === 3 || up === 4 || right === 4 || left === 4 || down === 4) ? 2 : v;
    return v === 4 && (up === 2 || right === 2 || left === 2 || down === 2 || up === 1 || right === 1 || left === 1 || down === 1) ? 3 : v;
  }
}

// GenLayerAddMushroomIsland (axc): reads the diagonal corners.
export class AddMushroomIslandLayer extends GenLayer {
  getInts(x, z, w, h) {
    const pw = w + 2, p = padded(this, x, z, w, h), out = new Int32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const v = p[i + 1 + (j + 1) * pw];
        this.initChunkSeed(i + x, j + z);
        out[i + j * w] = v === 0 && p[i + j * pw] === 0 && p[i + 2 + j * pw] === 0 && p[i + (j + 2) * pw] === 0
          && p[i + 2 + (j + 2) * pw] === 0 && this.nextInt(100) === 0 ? B.mushroomIsland : v;
      }
    return out;
  }
}

// GenLayerDeepOcean (awx): no chunk seed.
export class DeepOceanLayer extends CrossLayer {
  cell(v, up, right, left, down) {
    if (v !== 0) return v;
    const n = (up === 0) + (right === 0) + (left === 0) + (down === 0);
    return n > 3 ? B.deepOcean : v;
  }
}

// GenLayerBiome (axf).
export class BiomeLayer extends GenLayer {
  constructor(base, parent, type) {
    super(base, parent);
    this.warm = type === "default_1_1"
      ? [B.desert, B.forest, B.extremeHills, B.swampland, B.plains, B.taiga]
      : [B.desert, B.desert, B.desert, B.savanna, B.savanna, B.plains];
    this.medium = [B.forest, B.roofedForest, B.extremeHills, B.plains, B.birchForest, B.swampland];
    this.cold = [B.forest, B.extremeHills, B.taiga, B.plains];
    this.icy = [B.icePlains, B.icePlains, B.icePlains, B.coldTaiga];
  }
  getInts(x, z, w, h) {
    const p = this.parent.getInts(x, z, w, h), out = new Int32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        this.initChunkSeed(i + x, j + z);
        let v = p[i + j * w];
        const special = (v & 0xf00) >> 8;
        v &= ~0xf00;
        let r;
        if (isOceanic(v)) r = v;
        else if (v === B.mushroomIsland) r = v;
        else if (v === 1) r = special > 0 ? (this.nextInt(3) === 0 ? B.mesaPlateau : B.mesaPlateau_F) : this.warm[this.nextInt(this.warm.length)];
        else if (v === 2) r = special > 0 ? B.jungle : this.medium[this.nextInt(this.medium.length)];
        else if (v === 3) r = special > 0 ? B.megaTaiga : this.cold[this.nextInt(this.cold.length)];
        else if (v === 4) r = this.icy[this.nextInt(this.icy.length)];
        else r = B.mushroomIsland;
        out[i + j * w] = r;
      }
    return out;
  }
}

// GenLayerBiomeEdge.canBiomesBeNeighbors (axe): same biome class, or temperature categories that may touch.
function canBeNeighbors(a, b) {
  if (compareBiomesById(a, b)) return true;
  const x = getBiome(a), y = getBiome(b);
  if (x === null || y === null) return false;
  return x.category === y.category || x.category === TEMP_MEDIUM || y.category === TEMP_MEDIUM;
}

// GenLayerBiomeEdge (axe).
export class BiomeEdgeLayer extends CrossLayer {
  cell(v, up, right, left, down, x, z) {
    this.initChunkSeed(x, z);
    if (compareBiomesById(v, B.extremeHills))
      return canBeNeighbors(up, B.extremeHills) && canBeNeighbors(right, B.extremeHills) && canBeNeighbors(left, B.extremeHills)
        && canBeNeighbors(down, B.extremeHills) ? v : B.extremeHillsEdge;
    if (v === B.mesaPlateau_F || v === B.mesaPlateau || v === B.megaTaiga) {
      const base = v === B.megaTaiga ? B.taiga : B.mesa;
      if (compareBiomesById(up, v) && compareBiomesById(right, v) && compareBiomesById(left, v) && compareBiomesById(down, v)) return v;
      return base;
    }
    if (v === B.desert)
      return up === B.icePlains || right === B.icePlains || left === B.icePlains || down === B.icePlains ? B.extremeHillsPlus : v;
    if (v === B.swampland) {
      if (up === B.desert || right === B.desert || left === B.desert || down === B.desert
        || up === B.coldTaiga || right === B.coldTaiga || left === B.coldTaiga || down === B.coldTaiga
        || up === B.icePlains || right === B.icePlains || left === B.icePlains || down === B.icePlains) return B.plains;
      if (up === B.jungle || right === B.jungle || left === B.jungle || down === B.jungle) return B.jungleEdge;
      return v;
    }
    return v;
  }
}

// GenLayerHills (axr): the biome parent and a river-noise parent (RiverInit zoomed twice).
export class HillsLayer extends GenLayer {
  constructor(base, parent, river) {
    super(base, parent);
    this.river = river;
  }
  // GenLayerHills does not override initWorldGenSeed, so the river input is never seeded here.
  getInts(x, z, w, h) {
    const pw = w + 2, p = padded(this, x, z, w, h), rv = this.river.getInts(x - 1, z - 1, w + 2, h + 2), out = new Int32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        this.initChunkSeed(i + x, j + z);
        const b = p[i + 1 + (j + 1) * pw], r = rv[i + 1 + (j + 1) * pw];
        const flag = (r - 2) % 29 === 0;
        let res;
        if (b !== 0 && r >= 2 && (r - 2) % 29 === 1 && b < 128) res = getBiome(b + 128) !== null ? b + 128 : b;
        else if (this.nextInt(3) !== 0 && !flag) res = b;
        else {
          let hill = b;
          if (b === B.desert) hill = B.desertHills;
          else if (b === B.forest) hill = B.forestHills;
          else if (b === B.birchForest) hill = B.birchForestHills;
          else if (b === B.roofedForest) hill = B.plains;
          else if (b === B.taiga) hill = B.taigaHills;
          else if (b === B.megaTaiga) hill = B.megaTaigaHills;
          else if (b === B.coldTaiga) hill = B.coldTaigaHills;
          else if (b === B.plains) hill = this.nextInt(3) === 0 ? B.forestHills : B.forest;
          else if (b === B.icePlains) hill = B.iceMountains;
          else if (b === B.jungle) hill = B.jungleHills;
          else if (b === B.ocean) hill = B.deepOcean;
          else if (b === B.extremeHills) hill = B.extremeHillsPlus;
          else if (b === B.savanna) hill = B.savannaPlateau;
          else if (compareBiomesById(b, B.mesaPlateau_F)) hill = B.mesa;
          else if (b === B.deepOcean && this.nextInt(3) === 0) hill = this.nextInt(2) === 0 ? B.plains : B.forest;
          if (flag && hill !== b) hill = getBiome(hill + 128) !== null ? hill + 128 : b;
          if (hill === b) res = b;
          else {
            const up = p[i + 1 + j * pw], right = p[i + 2 + (j + 1) * pw], left = p[i + (j + 1) * pw], down = p[i + 1 + (j + 2) * pw];
            const n = compareBiomesById(up, b) + compareBiomesById(right, b) + compareBiomesById(left, b) + compareBiomesById(down, b);
            res = n >= 3 ? hill : b;
          }
        }
        out[i + j * w] = res;
      }
    return out;
  }
}

// GenLayerRiverInit (axt).
export class RiverInitLayer extends GenLayer {
  getInts(x, z, w, h) {
    const p = this.parent.getInts(x, z, w, h), out = new Int32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        this.initChunkSeed(i + x, j + z);
        out[i + j * w] = p[i + j * w] > 0 ? this.nextInt(299999) + 2 : 0;
      }
    return out;
  }
}

// GenLayerRiver (axu): no chunk seed.
const riverFilter = (v) => (v >= 2 ? 2 + (v & 1) : v);
export class RiverLayer extends CrossLayer {
  cell(v, up, right, left, down) {
    const c = riverFilter(v);
    return c === riverFilter(left) && c === riverFilter(up) && c === riverFilter(right) && c === riverFilter(down) ? -1 : B.river;
  }
}

// GenLayerSmooth (axx).
export class SmoothLayer extends CrossLayer {
  cell(v, up, right, left, down, x, z) {
    if (left === right && up === down) {
      this.initChunkSeed(x, z);
      return this.nextInt(2) === 0 ? left : up;
    }
    if (up === down) return up;
    if (left === right) return left;
    return v;
  }
}

// GenLayerRareBiome (axq).
export class RareBiomeLayer extends CrossLayer {
  cell(v, up, right, left, down, x, z) {
    this.initChunkSeed(x, z);
    return this.nextInt(57) === 0 && v === B.plains ? B.plains + 128 : v;
  }
}

// GenLayerShore (axw).
const jungleCompatible = (id) => {
  const b = getBiome(id);
  if (b !== null && b.biomeClass === "Jungle") return true;
  return id === B.jungleEdge || id === B.jungle || id === B.jungleHills || id === B.forest || id === B.taiga || isOceanic(id);
};
const isMesa = (id) => getBiome(id)?.biomeClass === "Mesa";
export class ShoreLayer extends CrossLayer {
  cell(v, up, right, left, down, x, z) {
    this.initChunkSeed(x, z);
    const biome = getBiome(v);
    const any = (f) => f(up) || f(right) || f(left) || f(down);
    if (v === B.mushroomIsland) return any((n) => n === B.ocean) ? B.mushroomIslandShore : v;
    if (biome !== null && biome.biomeClass === "Jungle") {
      if (!(jungleCompatible(up) && jungleCompatible(right) && jungleCompatible(left) && jungleCompatible(down))) return B.jungleEdge;
      return any(isOceanic) ? B.beach : v;
    }
    if (v === B.extremeHills || v === B.extremeHillsPlus || v === B.extremeHillsEdge) return this.stoneBeach(v, up, right, left, down, B.stoneBeach);
    if (biome !== null && biome.snowy) return this.stoneBeach(v, up, right, left, down, B.coldBeach);
    if (v === B.mesa || v === B.mesaPlateau_F) {
      if (any(isOceanic)) return v;
      return !(isMesa(up) && isMesa(right) && isMesa(left) && isMesa(down)) ? B.desert : v;
    }
    if (v !== B.ocean && v !== B.deepOcean && v !== B.river && v !== B.swampland) return any(isOceanic) ? B.beach : v;
    return v;
  }
  stoneBeach(v, up, right, left, down, beach) {
    if (isOceanic(v)) return v;
    return isOceanic(up) || isOceanic(right) || isOceanic(left) || isOceanic(down) ? beach : v;
  }
}

// GenLayerRiverMix (axv).
export class RiverMixLayer extends GenLayer {
  constructor(base, biome, river) {
    super(base, biome);
    this.river = river;
  }
  initWorldGenSeed(seed) {
    this.parent.initWorldGenSeed(seed);
    this.river.initWorldGenSeed(seed);
    let c = toLong(seed);
    for (let i = 0; i < 3; i++) c = BigInt.asIntN(64, c * (c * M + A) + this.base);
    fromBig(c);
    this.ch = H; this.cl = L;
  }
  getInts(x, z, w, h) {
    const b = this.parent.getInts(x, z, w, h), r = this.river.getInts(x, z, w, h), out = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const v = b[i];
      if (v === B.ocean || v === B.deepOcean) out[i] = v;
      else if (r[i] === B.river) out[i] = v === B.icePlains ? B.frozenRiver : v === B.mushroomIsland || v === B.mushroomIslandShore ? B.mushroomIslandShore : r[i] & 255;
      else out[i] = v;
    }
    return out;
  }
}

// GenLayerVoronoiZoom (ayb).
export class VoronoiZoomLayer extends GenLayer {
  jitter() {
    return (this.nextInt(1024) / 1024 - 0.5) * 3.6;
  }
  getInts(x, z, w, h) {
    x -= 2;
    z -= 2;
    const px = x >> 2, pz = z >> 2, pw = (w >> 2) + 2, ph = (h >> 2) + 2;
    const p = this.parent.getInts(px, pz, pw, ph);
    const tw = (pw - 1) << 2, t = new Int32Array(tw * ((ph - 1) << 2));
    for (let j = 0; j < ph - 1; j++) {
      let v00 = p[j * pw], v01 = p[(j + 1) * pw];
      for (let i = 0; i < pw - 1; i++) {
        this.initChunkSeed((i + px) << 2, (j + pz) << 2);
        const ax = this.jitter(), az = this.jitter();
        this.initChunkSeed((i + px + 1) << 2, (j + pz) << 2);
        const bx = this.jitter() + 4, bz = this.jitter();
        this.initChunkSeed((i + px) << 2, (j + pz + 1) << 2);
        const cx = this.jitter(), cz = this.jitter() + 4;
        this.initChunkSeed((i + px + 1) << 2, (j + pz + 1) << 2);
        const dx = this.jitter() + 4, dz = this.jitter() + 4;
        const v10 = p[i + 1 + j * pw] & 255, v11 = p[i + 1 + (j + 1) * pw] & 255;
        for (let zz = 0; zz < 4; zz++) {
          let idx = ((j << 2) + zz) * tw + (i << 2);
          for (let xx = 0; xx < 4; xx++) {
            const da = (zz - az) * (zz - az) + (xx - ax) * (xx - ax);
            const db = (zz - bz) * (zz - bz) + (xx - bx) * (xx - bx);
            const dc = (zz - cz) * (zz - cz) + (xx - cx) * (xx - cx);
            const dd = (zz - dz) * (zz - dz) + (xx - dx) * (xx - dx);
            if (da < db && da < dc && da < dd) t[idx++] = v00;
            else if (db < da && db < dc && db < dd) t[idx++] = v10;
            else if (dc < da && dc < db && dc < dd) t[idx++] = v01;
            else t[idx++] = v11;
          }
        }
        v00 = v10;
        v01 = v11;
      }
    }
    const out = new Int32Array(w * h);
    for (let row = 0; row < h; row++) {
      const from = (row + (z & 3)) * tw + (x & 3);
      out.set(t.subarray(from, from + w), row * w);
    }
    return out;
  }
}

// GenLayer.initializeAllBiomeGenerators (axn.a(long, WorldType)): [riverMix, voronoi, riverMix], all seeded.
export function initializeAllBiomeGenerators(seed, type = "default") {
  seed = toLong(seed);
  let layer = new IslandLayer(1n);
  layer = new FuzzyZoomLayer(2000n, layer);
  layer = new AddIslandLayer(1n, layer);
  layer = new ZoomLayer(2001n, layer);
  layer = new AddIslandLayer(2n, layer);
  layer = new AddIslandLayer(50n, layer);
  layer = new AddIslandLayer(70n, layer);
  layer = new RemoveTooMuchOceanLayer(2n, layer);
  layer = new AddSnowLayer(2n, layer);
  layer = new AddIslandLayer(3n, layer);
  layer = new EdgeLayer(2n, layer, EDGE_COOL_WARM);
  layer = new EdgeLayer(2n, layer, EDGE_HEAT_ICE);
  layer = new EdgeLayer(3n, layer, EDGE_SPECIAL);
  layer = new ZoomLayer(2002n, layer);
  layer = new ZoomLayer(2003n, layer);
  layer = new AddIslandLayer(4n, layer);
  layer = new AddMushroomIslandLayer(5n, layer);
  layer = new DeepOceanLayer(4n, layer);
  const base = ZoomLayer.magnify(1000n, layer, 0);
  const biomeSize = type === "largeBiomes" ? 6 : 4;
  let river = ZoomLayer.magnify(1000n, base, 0);
  river = new RiverInitLayer(100n, river);
  let biome = new BiomeLayer(200n, base, type);
  biome = ZoomLayer.magnify(1000n, biome, 2);
  biome = new BiomeEdgeLayer(1000n, biome);
  const hillsRiver = ZoomLayer.magnify(1000n, river, 2);
  biome = new HillsLayer(1000n, biome, hillsRiver);
  river = ZoomLayer.magnify(1000n, river, 2);
  river = ZoomLayer.magnify(1000n, river, biomeSize);
  river = new RiverLayer(1n, river);
  river = new SmoothLayer(1000n, river);
  biome = new RareBiomeLayer(1001n, biome);
  for (let i = 0; i < biomeSize; i++) {
    biome = new ZoomLayer(BigInt(1000 + i), biome);
    if (i === 0) biome = new AddIslandLayer(3n, biome);
    if (i === 1) biome = new ShoreLayer(1000n, biome);
  }
  biome = new SmoothLayer(1000n, biome);
  const mix = new RiverMixLayer(100n, biome, river);
  const voronoi = new VoronoiZoomLayer(10n, mix);
  mix.initWorldGenSeed(seed);
  voronoi.initWorldGenSeed(seed);
  return [mix, voronoi, mix];
}

// WorldChunkManager (aib): genBiomes is the river mix (one cell per 4 x 4 blocks), biomeIndexLayer the voronoi zoom
// (one cell per block). BiomeCache keeps whole 16 x 16 chunks of voronoi output.
export const BIOMES_TO_SPAWN_IN = [B.forest, B.plains, B.taiga, B.taigaHills, B.forestHills, B.jungle, B.jungleHills];
export class WorldChunkManager {
  constructor(seed, type = "default") {
    [this.genBiomes, this.biomeIndexLayer] = initializeAllBiomeGenerators(seed, type);
    this.cache = new Map();
  }
  // BiomeCache.getBiomeCacheBlock (no expiry here; the client drops blocks unused for 30 s, which never changes a value).
  cachedChunk(cx, cz) {
    const key = cx + "," + cz;
    let ids = this.cache.get(key);
    if (!ids) this.cache.set(key, (ids = this.biomeIndexLayer.getInts(cx << 4, cz << 4, 16, 16)));
    return ids;
  }
  // getBiomeGenAt(x, z): the cached chunk cell.
  biomeAt(x, z) {
    return getBiome(this.cachedChunk(x >> 4, z >> 4)[(x & 15) | ((z & 15) << 4)]);
  }
  // getBiomesForGeneration: river-mix cells as biomes.
  biomesForGeneration(x, z, w, h) {
    return Array.from(this.genBiomes.getInts(x, z, w, h), getBiome);
  }
  // getBiomeGenAt(x, z, w, h, cache) / loadBlockGeneratorData (cache false).
  biomeArea(x, z, w, h, cache = true) {
    if (cache && w === 16 && h === 16 && (x & 15) === 0 && (z & 15) === 0)
      return Array.from(this.cachedChunk(x >> 4, z >> 4), getBiome);
    return Array.from(this.biomeIndexLayer.getInts(x, z, w, h), getBiome);
  }
  // getRainfall: float min(1, intRainfall / 65536).
  rainfall(x, z, w, h) {
    return Array.from(this.biomeIndexLayer.getInts(x, z, w, h), (id) => Math.min(1, Math.fround(getBiome(id).rainfallInt / 65536)));
  }
  // areBiomesViable.
  areBiomesViable(x, z, r, allowed) {
    const x0 = (x - r) >> 2, z0 = (z - r) >> 2, x1 = (x + r) >> 2, z1 = (z + r) >> 2;
    const ids = this.genBiomes.getInts(x0, z0, x1 - x0 + 1, z1 - z0 + 1);
    for (const id of ids) if (!allowed.includes(getBiome(id).slot)) return false;
    return true;
  }
  // Both take biome slots (BIOMES_TO_SPAWN_IN); the client compares biome objects.
  // findBiomePosition: reservoir pick over the river-mix cells with the caller's java.util.Random; [x, 0, z] or null.
  findBiomePosition(x, z, r, allowed, random) {
    const x0 = (x - r) >> 2, z0 = (z - r) >> 2, x1 = (x + r) >> 2, z1 = (z + r) >> 2, w = x1 - x0 + 1, h = z1 - z0 + 1;
    const ids = this.genBiomes.getInts(x0, z0, w, h);
    let pos = null, n = 0;
    for (let i = 0; i < w * h; i++) {
      const bx = (x0 + (i % w)) << 2, bz = (z0 + Math.trunc(i / w)) << 2;
      if (allowed.includes(getBiome(ids[i]).slot) && (pos === null || random.nextInt(n + 1) === 0)) {
        pos = [bx, 0, bz];
        n++;
      }
    }
    return pos;
  }
}
