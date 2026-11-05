// EntityOcelot rules against public/research/ocelot-reference.json (tools/verify-ocelot.mjs, the unchanged 1.7.10 classes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import * as O from "./ocelot.js";
import { ocelotParts } from "./ocelot-renderer.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/ocelot-reference.json", import.meta.url)));
const M = (1n << 64n) - 1n;
// OcelotProbe.mix: splitmix64, so that small seeds are not correlated.
function mix(seed) {
  let z = (BigInt(seed) + 0x9E3779B97F4A7C15n) & M;
  z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & M;
  z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & M;
  return BigInt.asIntN(64, z ^ (z >> 31n));
}
const rng = (seed) => new JavaRandom(mix(seed));

test("facts match the probe", () => {
  const f = ref.facts;
  assert.equal(O.OCELOT_WIDTH, Math.fround(f.width));
  assert.equal(O.OCELOT_HEIGHT, Math.fround(f.height));
  assert.equal(O.OCELOT_SPEED, Math.fround(f.speed));
  assert.equal(O.OCELOT_HEALTH, f.maxHealth);
  assert.equal(O.OCELOT_SOUNDS.hit, f.hurt);
  assert.equal(O.OCELOT_SOUNDS.volume, Math.fround(f.volume));
});

test("despawn: only a wild ocelot older than 2400", () => {
  for (const r of ref.despawn.rows) assert.equal(O.canDespawn({ owner: r.tamed ? "p" : "", age: r.age }), r.canDespawn);
});

test("raw fish tame rolls match 300 seeded probe rows", () => {
  const rows = ref.interact.filter((r) => r.kind === "fish");
  assert.equal(rows.length, 300);
  for (const r of rows) {
    const e = { ...O.ocelotFields(), love: 0 };
    const out = O.interact(e, { id: 701, count: 2 }, { isOwner: true, creative: false, tempting: true, distSq: 1, rand: rng(r.seed), worldRand: rng(r.seed + 1000) });
    assert.equal(out.handled, r.result, `seed ${r.seed}`);
    assert.equal(out.tamed, r.cat.tamed, `seed ${r.seed}`);
    assert.equal(out.status, r.states[0], `seed ${r.seed}`);
    if (r.cat.tamed) assert.equal(e.catType, r.cat.catType, `seed ${r.seed}`);
  }
});

test("other interactions: sticks and cooked fish do nothing, a far or scared ocelot breeds", () => {
  const stick = O.interact({ ...O.ocelotFields() }, { id: 280, count: 1 }, { isOwner: true, tempting: true, distSq: 1, rand: rng(0), worldRand: rng(1) });
  assert.equal(stick.handled, false);
  const far = O.interact({ ...O.ocelotFields() }, { id: 701, count: 1 }, { isOwner: true, tempting: true, distSq: 9, rand: rng(0), worldRand: rng(1) });
  assert.equal(far.tamed, false);
  const notTempting = O.interact({ ...O.ocelotFields() }, { id: 701, count: 1 }, { isOwner: true, tempting: false, distSq: 1, rand: rng(0), worldRand: rng(1) });
  assert.equal(notTempting.tamed, false);
  const tamed = { ...O.ocelotFields(), owner: "p", sitting: false };
  O.interact(tamed, null, { isOwner: true, tempting: false, distSq: 1, rand: rng(0), worldRand: rng(1) });
  assert.equal(tamed.sitWish, true);
});

test("living sound rows", () => {
  for (const r of ref.sound) {
    const tamed = r.mode !== 0, love = r.mode === 2 ? 600 : 0;
    assert.equal(O.ocelotSay({ owner: tamed ? "p" : "", love }, rng(r.seed)), r.say, JSON.stringify(r));
  }
});

test("spawn rows and seed list", () => {
  for (const r of ref.spawn) {
    let trues = 0;
    for (let s = 0; s < r.of; s++) trues += O.canSpawnHere({ rand: rng(s), collides: r.blocked, liquid: r.liquid, y: r.y, below: [2, 18, 161].includes(r.block) }) ? 1 : 0;
    assert.equal(trues, r.trues, JSON.stringify(r));
  }
  const res = ref.spawnSeeds.results.map((_, s) => (O.canSpawnHere({ rand: rng(s), collides: false, liquid: false, y: 64, below: true }) ? 1 : 0));
  assert.deepEqual(res, ref.spawnSeeds.results);
});

test("move helper speed sets sneaking and sprinting", () => {
  for (const r of ref.speed) {
    const p = O.movePose(r.updating, r.speed);
    assert.equal(p.sneaking, r.sneaking);
    assert.equal(p.sprinting, r.sprinting);
  }
});

test("sit blocks and chest blocking", () => {
  assert.equal(O.sitBlockValid({ chest: true, chestUsers: 0 }), true);
  assert.equal(O.sitBlockValid({ chest: true, chestUsers: 1 }), false);
  assert.equal(O.sitBlockValid({ furnaceLit: true }), true);
  assert.equal(O.sitBlockValid({ bed: true, bedMeta: 8 }), false);
  assert.equal(O.sitBlockValid({ bed: true, bedMeta: 4 }), true);
  assert.equal(O.sitBlockValid({}), false);
  assert.equal(O.findSitSpot(64.5, 64, 64.5, { valid: (x, y, z) => x === 60 && z === 64, air: () => true })?.x, 60);
  assert.equal(O.findSitSpot(64.5, 64, 64.5, { valid: (x) => x === 40, air: () => true }), null);
  const cat = (sitting, y) => ({ sitting, minX: 64.2, maxX: 64.8, minY: y, maxY: y + 0.8, minZ: 64.2, maxZ: 64.8 });
  assert.equal(O.sitsOnChest([cat(true, 65)], 64, 64, 64), true);
  assert.equal(O.sitsOnChest([cat(false, 65)], 64, 64, 64), false);
  assert.equal(O.sitsOnChest([cat(true, 64)], 64, 64, 64), false);
  assert.equal(O.sitsOnChest([cat(true, 67)], 64, 64, 64), false);
});

test("mating, kittens and the egg litter", () => {
  const cat = (tamed, love) => ({ type: "ocelot", owner: tamed ? "p" : "", love: love ? 600 : 0 });
  for (const r of ref.mate) {
    const a = cat(r.tamedA, r.loveA), b = cat(r.tamedB, r.loveB);
    a.sitting = r.sitA;
    assert.equal(O.canMateWith(a, b), r.result, JSON.stringify(r));
  }
  assert.deepEqual(O.kittenFields({ owner: "p", catType: 2 }), { owner: "p", catType: 2 });
  assert.deepEqual(O.kittenFields({ owner: "", catType: 2 }), {});
  for (const r of ref.egg.rows) assert.equal(O.kittenLitter(rng(r.seed)), r.kittens.length, `seed ${r.seed}`);
});

test("ModelOcelot pose maths matches the probe's 13 rows", () => {
  const poseOf = (i) => ({ sneaking: i === 0, sprinting: i === 2, sitting: i === 3 });
  for (const row of ref.model) {
    const { parts } = ocelotParts(poseOf(row.i), { limbSwing: row.limbSwing ?? 0, limbAmount: row.limbAmount ?? 0, headYaw: row.headYaw ?? 0, headPitch: row.headPitch ?? 0 });
    for (const [k, p] of Object.entries(row.parts)) {
      p.point.forEach((v, j) => assert.ok(Math.abs(v - parts[k].point[j]) < 1e-4, `${row.tag} ${k} point ${j}: ${parts[k].point[j]} vs ${v}`));
      // The rest row is the constructed model, before setRotationAngles has set the body and tail 2 angles.
      if (row.tag !== "rest") p.angle.forEach((v, j) => assert.ok(Math.abs(v - parts[k].angle[j]) < 1e-4, `${row.tag} ${k} angle ${j}: ${parts[k].angle[j]} vs ${v}`));
    }
  }
});
