// Oak saplings and leaves in the Nether and End against the unchanged BlockSapling.updateTick (anj.a) and BlockLeaves.updateTick (alt.a) on real
// Nether/End chunks (public/research/dimension-tree-reference.json, tools/probes/DimTreeProbe.java). The port's NativeLight (hasNoSky) must give the
// light above the sapling that ahb.k gave, and Trees.tickSapling / tickLeaves on a world of the same cells must give every event string, the same
// changed cells (sha256) and the same Random state.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { NativeLight, SKY, BLOCK } from "./native-light.js";
import { lightOpacity, lightEmission } from "./lighting.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { JavaRandom } from "./java-random.js";
import { Trees } from "./trees.js";
import { treeRegistryReady as growthReady } from "./tree-growth.js";

await growthReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/dimension-tree-reference.json", import.meta.url)));
const R = 3, OFF = 48, W = 112, H = 256;
const cache = new Map();
const internal = (mc, meta) => { const k = mc * 16 + meta; if (!cache.has(k)) cache.set(k, mc ? fromOriginal(mc, meta).id : 0); return cache.get(k); };
const OP = new Uint8Array(256), EM = new Uint8Array(256);
for (let b = 0; b < 256; b++) { OP[b] = Math.min(255, lightOpacity(b)); EM[b] = lightEmission(b); }
const sha = (s) => createHash("sha256").update(s).digest("hex");

function replay(s, onSite) {
  const ids = new Uint8Array(W * W * H), metas = new Uint8Array(W * W * H), at = (x, z) => ((x + OFF) * W + z + OFF) * H;
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of s.fills) {
    const b = internal(id, meta);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) { ids[at(x, z) + y] = b; metas[at(x, z) + y] = meta; }
  }
  const light = new NativeLight({ width: W, height: H, hasNoSky: s.provider.g, isRemote: true, blockAt: (x, y, z) => ids[(x * W + z) * H + y], opacity: (b) => OP[b], emission: (x, y, z, b) => EM[b] });
  const order = [];
  const tick = () => { light.isRemote = false; for (const c of order) if (light.loaded[c]) { light.enqueueRelightChecks(c); light.tickChunk(c); } light.isRemote = true; };
  let snaps = 0;
  for (const op of s.ops) {
    const [name, a, b] = op;
    if (name === "gen" || name === "load") order.push(light.generateChunk(a + R, b + R));
    else if (name === "terrain") for (const c of order) light.terrainPopulated[c] = 1;
    else if (name === "tick") tick();
    else if (name === "set") { const [, x, y, z, id, meta] = op, i = at(x, z) + y, oldOp = OP[ids[i]], n = internal(id, meta); ids[i] = n; metas[i] = meta; light.setBlock(x + OFF, y, z + OFF, oldOp, n, false); }
    else if (name === "snap" && String(a).startsWith("site:")) onSite(a.slice(5).split("|").map(Number), light);
    else if (name === "snap") snaps++;
  }
  return { ids, metas, light, at };
}

// The cells Trees and the generators read and write, over the replayed array (this build's ids; metadata kept beside them).
class CellWorld {
  constructor(ids, metas, at) { this.ids = ids; this.metas = metas; this.at = at; this.original = new Map(); this.onChange = null; this.height = H; this.generationVersion = 15; }
  inside(x, y, z) { return y >= 0 && y < H && x >= -OFF && x < W - OFF && z >= -OFF && z < W - OFF; }
  get(x, y, z) { return this.inside(x, y, z) ? this.ids[this.at(x, z) + y] : 0; }
  getMeta(x, y, z) { return this.inside(x, y, z) ? this.metas[this.at(x, z) + y] : 0; }
  put(x, y, z, b, meta = 0) {
    if (!this.inside(x, y, z)) return false;
    const i = this.at(x, z) + y, k = `${x},${y},${z}`;
    if (!this.original.has(k)) this.original.set(k, [this.ids[i], this.metas[i]]);
    this.ids[i] = b; this.metas[i] = meta; return true;
  }
  set(x, y, z, b, track = true, meta = 0) {
    const old = this.get(x, y, z), oldMeta = this.getMeta(x, y, z);
    if (!this.put(x, y, z, b, meta)) return false;
    if (track && (old !== b || oldMeta !== meta)) this.onChange?.(x, y, z, old, b);
    return true;
  }
  // The changed cells in x, y, z order as the probe writes them ("x,y,z,mcId,meta"), then everything restored.
  digestAndRestore() {
    const lines = [];
    const cells = [...this.original].map(([k, v]) => [k.split(",").map(Number), v]).sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1] || a[0][2] - b[0][2]);
    for (const [[x, y, z], [id, meta]] of cells) {
      const now = [this.get(x, y, z), this.getMeta(x, y, z)];
      const [mc, mm] = now[0] ? toOriginal(now[0], now[1]) : [0, 0];
      const [omc, omm] = id ? toOriginal(id, meta) : [0, 0];
      if (mc !== omc || mm !== omm) lines.push(`${x},${y},${z},${mc},${mm}\n`);
    }
    for (const [k, [id, meta]] of this.original) { const [x, y, z] = k.split(",").map(Number); const i = this.at(x, z) + y; this.ids[i] = id; this.metas[i] = meta; }
    this.original.clear();
    return sha(lines.join(""));
  }
}

for (const s of ref.scenarios) {
  test(`${s.case}: sapling ticks, growth and leaf decay match the unchanged classes`, () => {
    const lights = new Map();
    const { ids, metas, light, at } = replay(s, ([x, y, z, d], l) => lights.set(`${x},${y},${z},${d}`, l.saved(BLOCK, x + OFF, y + 1, z + OFF) | 0));
    assert.equal(s.provider.g, true); // hasNoSky: both dimensions have no sky light
    const world = new CellWorld(ids, metas, at);
    const SAP = internal(6, 0), DIRT = internal(3, 0), GLOW = internal(89, 0), LOG = internal(17, 0);
    let grown = 0, marked = 0, failed = 0, leavesChecked = 0;
    for (const t of s.trials) {
      const [x, y, z] = t.pos;
      if (t.kind === "sapling") {
        const key = `${x},${y},${z},${t.d}`;
        assert.equal(lights.get(key), t.light, `block light above ${key}`);
        const gx = x + t.d + (t.d === 0 ? 1 : 0), floor = world.get(x, y - 1, z), glowCell = world.get(gx, y + 1, z);
        world.ids[at(x, z) + y - 1] = DIRT; world.ids[at(x, z) + y] = SAP; world.metas[at(x, z) + y] = 0;
        if (t.d >= 0) world.ids[at(gx, z) + y + 1] = GLOW;
        const random = new JavaRandom(t.seed % 2 ** 48);
        const trees = new Trees(world, { random: Object.assign(random, {}), light: () => t.light, maxY: 256 }).watch();
        let events = "";
        for (let tick = 0; tick < 60; tick++) {
          if (world.get(x, y, z) !== SAP) break;
          const r = trees.tickSapling(x, y, z);
          const c = r === "marked" ? "m" : r === "grew" || r === "big" ? "g" : r === "failed" ? "f" : r === true ? "d" : ".";
          events += c;
          if (c === "g" || c === "d") break;
        }
        assert.equal(events, t.events, `${s.case} ${key} seed ${t.seed}`);
        assert.equal(world.digestAndRestore(), t.digest, `cells ${key} seed ${t.seed}`);
        assert.equal(random.nextInt(), t.next, `random ${key} seed ${t.seed}`);
        world.ids[at(x, z) + y - 1] = floor; world.ids[at(x, z) + y] = 0; world.metas[at(x, z) + y] = 0;
        if (t.d >= 0) world.ids[at(gx, z) + y + 1] = glowCell;
        for (const c of events) { if (c === "g") grown++; else if (c === "m") marked++; else if (c === "f") failed++; }
      } else {
        // a log column in a 5x5x5 cube of check-decay (bit 8) oak leaves: each leaf's own tick, the leaf kept and the bit cleared
        const saved = new Map(), put = (x1, y1, z1, id, meta) => { const i = at(x1, z1) + y1; saved.set(i, [world.ids[i], world.metas[i]]); world.ids[i] = id; world.metas[i] = meta; };
        for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy <= 4; dy++) for (let dz = -2; dz <= 2; dz++) put(x + dx, y + dy, z + dz, dx === 0 && dz === 0 ? LOG : internal(18, 0), dx === 0 && dz === 0 ? 0 : 8);
        const random = new JavaRandom(t.seed), trees = new Trees(world, { random, light: () => 0, maxY: 256 }).watch();
        let out = "";
        for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy <= 4; dy++) for (let dz = -2; dz <= 2; dz++) {
          if (dx === 0 && dz === 0) continue;
          trees.tickLeaves(x + dx, y + dy, z + dz);
          const [mc, meta] = toOriginal(world.get(x + dx, y + dy, z + dz), world.getMeta(x + dx, y + dy, z + dz));
          out += `${mc}:${meta},`;
          world.ids[at(x + dx, z + dz) + y + dy] = internal(18, 0); world.metas[at(x + dx, z + dz) + y + dy] = 8; // the probe restores the cell
          leavesChecked++;
        }
        assert.equal(out, t.cells, `leaves ${x},${y},${z} seed ${t.seed}`);
        assert.equal(random.nextInt(), t.next, `leaf random ${t.seed}`);
        for (const [i, [id, meta]] of saved) { world.ids[i] = id; world.metas[i] = meta; }
        world.original.clear();
      }
    }
    assert.ok(grown >= 24 && marked >= 100 && failed >= 24, `grown ${grown} marked ${marked} failed ${failed}`);
    assert.ok(leavesChecked >= 8 * 120);
  });
}
