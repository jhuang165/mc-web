// Mushroom random ticks in the Nether and End against the unchanged BlockMushroom.updateTick on the unchanged light engine
// (public/research/dimension-random-tick-reference.json, tools/probes/DimRandomTickProbe.java): the port's NativeLight (hasNoSky) feeds
// plant-light.js mushroomSpread exactly as the game feeds it (world.fullLight), and every seeded trial must place the same cell and leave
// the Random at the same state.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NativeLight, SKY, BLOCK } from "./native-light.js";
import { lightOpacity, lightEmission } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { JavaRandom } from "./java-random.js";
import { mushroomSpread, fullLight } from "./plant-light.js";
import { normalCube } from "./world.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/dimension-random-tick-reference.json", import.meta.url)));
const R = 3, OFF = 48, W = 112, H = 256;
const cache = new Map();
const internal = (mc, meta) => { const k = mc * 16 + meta; if (!cache.has(k)) cache.set(k, mc ? fromOriginal(mc, meta).id : 0); return cache.get(k); };
const OP = new Uint8Array(256), EM = new Uint8Array(256);
for (let b = 0; b < 256; b++) { OP[b] = Math.min(255, lightOpacity(b)); EM[b] = lightEmission(b); }

function replay(s) {
  const ids = new Uint8Array(W * W * H), metas = new Uint8Array(W * W * H), at = (x, z) => ((x + OFF) * W + z + OFF) * H;
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of s.fills) {
    const b = internal(id, meta);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) { ids[at(x, z) + y] = b; metas[at(x, z) + y] = meta; }
  }
  const light = new NativeLight({ width: W, height: H, hasNoSky: s.provider.g, isRemote: true, blockAt: (x, y, z) => ids[(x * W + z) * H + y], opacity: (b) => OP[b], emission: (x, y, z, b) => EM[b] });
  const order = [];
  const tick = () => { light.isRemote = false; for (const c of order) if (light.loaded[c]) { light.enqueueRelightChecks(c); light.tickChunk(c); } light.isRemote = true; };
  for (const op of s.ops) {
    const [name, a, b] = op;
    if (name === "gen" || name === "load") order.push(light.generateChunk(a + R, b + R));
    else if (name === "terrain") for (const c of order) light.terrainPopulated[c] = 1;
    else if (name === "tick") tick();
    else if (name === "set") { const [, x, y, z, id, meta] = op, i = at(x, z) + y, oldOp = OP[ids[i]], n = internal(id, meta); ids[i] = n; light.setBlock(x + OFF, y, z + OFF, oldOp, n, false); }
  }
  return { ids, light, at };
}

for (const s of ref.scenarios) {
  test(`${s.case}: light at the mushroom cell and every seeded spread match the unchanged classes`, () => {
    const { ids, light, at } = replay(s);
    const get = (x, y, z) => (y < 0 || y >= H || x < -OFF || x >= W - OFF || z < -OFF || z >= W - OFF ? 0 : ids[at(x, z) + y]);
    const world = { height: H, get, getMeta: () => 0, inside: (x, y, z) => y >= 0 && y < H, fullLight: (x, y, z) => Math.max(light.saved(SKY, x + OFF, y, z + OFF), light.saved(BLOCK, x + OFF, y, z + OFF)) };
    assert.equal(s.provider.g, true);
    let placed = 0, light13 = 0;
    for (const t of s.trials) {
      const [x, y, z] = t.pos;
      assert.equal(fullLight(world, x, y, z), t.full, `full light ${t.pos}`);
      assert.equal(light.saved(BLOCK, x + OFF, y + 1, z + OFF), t.block, `sapling light above ${t.pos}`);
      if (t.full >= 13) light13++;
      const r = new JavaRandom(t.seed), to = mushroomSpread(world, x, y, z, r);
      assert.deepEqual(to ? [[...to, internal(39, 0), 0]] : [], t.sets.map(([a, b, c, id, m]) => [a, b, c, internal(id, m), m]), `${t.pos} seed ${t.seed}`);
      assert.equal(r.nextInt(), t.next, `random state ${t.pos} seed ${t.seed}`);
      if (to) placed++;
    }
    assert.ok(placed >= 10, `spreads happen (${placed})`);
    assert.ok(light13 > 0, "some sites are lit at or above the 13 limit");
    assert.ok(normalCube(internal(s.case.endsWith("nether") ? 87 : 121, 0)));
  });
}
