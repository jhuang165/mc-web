import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { createRocket, tickRocket } from "./firework-rocket.js";
import { ITEM_FIREWORK_ROCKET, normalizeFireworks } from "./fireworks.js";
import { WATER, LAVA } from "./world.js";

// Batch 69 (projectiles4). public/research/firework-fluid-reference.json (tools/probes/FireworkFluidProbe.java, executed over the unchanged EntityFireworkRocket,
// Entity.onEntityUpdate, World.handleMaterialAcceleration and moveEntity, with real EntityBoat and EntityMinecartEmpty objects in the world double's entity list).
const fluid = JSON.parse(readFileSync(new URL("../public/research/firework-fluid-reference.json", import.meta.url))).records;
const state = (raw) => { const r = new JavaRandom(0); r.seed = BigInteger(raw); return r; };
function BigInteger(v) { return BigInt(v); }
const FLAT = 3, ORIGINAL = { 8: WATER, 9: WATER, 10: LAVA, 11: LAVA };
function blockWorld(blocks) {
  const cells = new Map(blocks.map(([x, y, z, id, meta]) => [`${x},${y},${z}`, [ORIGINAL[id], meta]]));
  const cell = (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 64 ? [FLAT, 0] : [0, 0]);
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => ![0, WATER, LAVA].includes(cell(x, y, z)[0]) };
}
const stack = (flight) => ({ id: ITEM_FIREWORK_ROCKET, fireworks: normalizeFireworks({ flight, explosions: [{ type: 1, colors: [11743532] }] }) });
const intersects = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5];
// the entity part of World.getCollidingBoundingBoxes: only a boat answers with a box (Entity.getBoundingBox); a minecart's is null and the rocket's getCollisionBox(other) is null
const boxesOf = (r) => (box) => (r.entities ?? []).filter(([kind, bb]) => kind === "boat" && intersects(box, bb)).map(([, bb]) => bb);
function replay(r) {
  const rand = state(r.seed), world = blockWorld(r.blocks);
  const ro = createRocket(...r.start, stack(r.flight), rand);
  assert.equal(ro.lifetime, r.lifetime, r.name);
  const rows = [], sparks = [];
  for (let t = 0; t < r.ticks; t++) {
    const out = tickRocket(ro, world, rand, { remote: r.remote, server: !r.remote, entityBoxes: boxesOf(r) });
    rows.push([ro.x, ro.y, ro.z, ro.mx, ro.my, ro.mz, ro.yaw, ro.pitch, ro.prevYaw, ro.prevPitch, ro.life, ro.dead ? 1 : 0]);
    sparks.push(out);
    if (ro.dead) break;
  }
  return { rows, sparks, ro };
}
test("34 executed rocket records in fluids and against boat and minecart boxes", () => assert.equal(fluid.length, 34));
for (const r of fluid) {
  test(`native rocket ${r.name}`, () => {
    const { rows, sparks } = replay(r);
    assert.equal(rows.length, r.ticks, `${r.name} ticks`);
    rows.forEach((row, t) => {
      row.forEach((v, i) => assert.ok(Math.abs(v - r.rows[t][i]) < 1e-12, `${r.name} tick ${t} col ${i}: ${v} vs ${r.rows[t][i]}`));
      // the client copy's trail: on a tick whose first world.spawnParticle is the spark itself (no splash bubble before it) the spark matches, which also proves the splash drew the right number of floats
      const native = r.rows[t][12];
      if (r.remote && native && native[0] === "fireworksSpark") native.slice(1).forEach((v, i) => assert.ok(Math.abs(v - sparks[t].spark[i]) < 1e-12, `${r.name} tick ${t} spark ${i}`));
    });
  });
}
const rec = (n) => fluid.find((r) => r.name === n), at = (n, t = 12) => rec(n).rows[t];
test("what native does: flowing water pushes a rocket sideways (about 0.2 a tick in x or z), still water and lava do not", () => {
  assert.ok(at("water-flow-x-server")[3] < -0.1 && at("water-flow-z-server")[5] > 0.1 && at("water-falling-server")[3] > 0.1);
  for (const n of ["water-still-inside-server", "lava-still-inside-server"]) assert.ok(Math.abs(at(n)[3]) < 0.02 && Math.abs(at(n)[5]) < 0.02, n);
});
test("what native does: a rocket stops under a boat's box and flies through a minecart's", () => {
  const top = (n) => Math.max(...rec(n).rows.map((row) => row[1]));
  assert.ok(Math.abs(top("boat-above-server") - 66.75) < 1e-9); // its top (66.75 + 0.25) meets the boat's floor at y 67
  assert.ok(top("cart-above-server") > 69, "the cart's box is no obstacle");
  assert.ok(Math.abs(at("boat-and-cart")[1] - 68.75) < 1e-9, "the cart below is ignored, the boat above stops it"); // later the growing sideways drift (1.15 a tick) slides it off the 1.5 wide boat: the replay above matches that too
});
test("a rocket's splash draws 32 Entity.rand floats the first update after it enters water, not on a first update inside it", () => {
  const w = replay(rec("water-still-below-client")), splashes = w.sparks.filter((o) => o.splash).length;
  assert.ok(splashes > 0);
  assert.equal(replay(rec("water-still-inside-client")).sparks[0].splash, undefined);
});
