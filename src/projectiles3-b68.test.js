import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { createRocket, tickRocket } from "./firework-rocket.js";
import { ITEM_FIREWORK_ROCKET, normalizeFireworks } from "./fireworks.js";
import { FENCE, WEB } from "./world.js";
import { STONE_SLAB } from "./stone-utility.js";

// Batch 68 (projectiles3). public/research/firework-collide-reference.json (tools/probes/FireworkCollideProbe.java, executed over the unchanged EntityFireworkRocket,
// Entity.onEntityUpdate and moveEntity): a rocket against a ceiling, slabs, a fence, a cobweb, a wall and the void.
const collide = JSON.parse(readFileSync(new URL("../public/research/firework-collide-reference.json", import.meta.url))).records;
const state = (raw) => { const r = new JavaRandom(0); r.seed = BigInt(raw); return r; };
const FLAT = 3, ORIGINAL = { 1: FLAT, 20: FLAT, 30: WEB, 44: STONE_SLAB, 85: FENCE };
function blockWorld(blocks) {
  const cells = new Map(blocks.map(([x, y, z, id, meta]) => [`${x},${y},${z}`, [ORIGINAL[id], meta]]));
  const cell = (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 64 ? [FLAT, 0] : [0, 0]);
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => ![0, WEB].includes(cell(x, y, z)[0]) };
}
const stack = (flight) => ({ id: ITEM_FIREWORK_ROCKET, fireworks: normalizeFireworks({ flight, explosions: [{ type: 1, colors: [11743532] }] }) });
function replay(r) {
  const rand = state(r.seed), world = blockWorld(r.blocks);
  const ro = createRocket(...r.start, stack(r.flight), rand);
  assert.equal(ro.lifetime, r.lifetime, r.name);
  const rows = [];
  for (let t = 0; t < r.ticks; t++) {
    tickRocket(ro, world, rand, { remote: r.remote, server: !r.remote });
    rows.push([ro.x, ro.y, ro.z, ro.mx, ro.my, ro.mz, ro.yaw, ro.pitch, ro.prevYaw, ro.prevPitch, ro.life, ro.dead ? 1 : 0]);
    if (ro.dead) break;
  }
  return { rows, ro };
}
test("31 executed rocket-against-blocks records", () => assert.equal(collide.length, 31));
for (const r of collide) {
  test(`native rocket ${r.name}`, () => {
    const { rows } = replay(r);
    assert.equal(rows.length, r.ticks, `${r.name} ticks`);
    rows.forEach((row, t) => row.forEach((v, i) => assert.ok(Math.abs(v - r.rows[t][i]) < 1e-12, `${r.name} tick ${t} col ${i}: ${v} vs ${r.rows[t][i]}`)));
  });
}

// ---- balls at item frames: a mob thrower, and an EntityPlayerMP's pearl (tools/probes/EntityThrowMobProbe.java, entity-throw-mob-reference.json) ----
import { replayEntityList, entityListDivergence } from "./entity-list-replay.js";
const mob = JSON.parse(readFileSync(new URL("../public/research/entity-throw-mob-reference.json", import.meta.url))).cases;
test("12 executed records: mob-thrown balls and an EntityPlayerMP pearl at item frames", () => assert.equal(mob.length, 12));
for (const c of mob) test(`native frame hit ${c.name}`, () => assert.equal(entityListDivergence(c, replayEntityList(c)), null));
const byName = (n) => mob.find((r) => r.name === n), frameAt = (n, t) => byName(n).rows[t][0].find((e) => e.length === 8);
test("what the mob-thrown balls do to a frame", () => {
  const end = (n) => frameAt(n, byName(n).ticks - 1);
  // snowball, egg and pearl act as a dispenser's: a held item is knocked out and the frame stays, an empty one breaks (the thrower is not a player, so no Creative case)
  for (const k of ["snowball", "egg", "pearl"]) {
    assert.deepEqual([end(`mthrow-${k}-frame-item`)[6], end(`mthrow-${k}-frame-item`)[7]], [0, 0], k);
    assert.deepEqual([end(`mthrow-${k}-frame-empty`)[6], end(`mthrow-${k}-frame-empty`)[7]], [1, 0], k);
  }
  // a witch's potion (and an exp bottle) splash at the frame without touching it: attackEntityFrom is never called
  for (const k of ["potion", "expbottle"]) {
    assert.deepEqual([end(`mthrow-${k}-frame-item`)[6], end(`mthrow-${k}-frame-item`)[7]], [0, 1], k);
    assert.deepEqual([end(`mthrow-${k}-frame-empty`)[6], end(`mthrow-${k}-frame-empty`)[7]], [0, 0], k);
  }
});
test("an EntityPlayerMP pearl at a frame: teleport to the impact, 5 fall damage, the frame outcome of a Survival player", () => {
  for (const held of ["item", "empty"]) {
    const c = byName(`pthrow-pearl-mp-frame-${held}`), last = c.rows[c.ticks - 1][0], pearl = last.find((e) => e.length === 11), fr = last.find((e) => e.length === 8);
    assert.equal(pearl[10], 5);
    assert.deepEqual(pearl.slice(7, 10), [0.5, 3.2029850338063035, 1.5396019586102596]); // the thrower stands where the pearl was before its last move
    assert.deepEqual([fr[6], fr[7]], held === "item" ? [0, 0] : [1, 0]);
  }
});
