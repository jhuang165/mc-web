import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EntityWorld } from "./entities.js";
import { spiderFindsPlayer } from "./spider.js";
import { detectionRangeScale } from "./potion-fx.js";

// public/research/detection-reference.json: the unchanged 1.7.10 World.getClosestVulnerablePlayerToEntity, EntityAINearestAttackableTarget
// (vo, with its selector vp -> vu.a(sv, false)), EntityMob/EntitySpider/EntitySilverfish.findPlayerToAttack, from tools/verify-detection.mjs.
const ref = JSON.parse(await readFile(new URL("../public/research/detection-reference.json", import.meta.url)));
const rec = (name) => ref.records.find((r) => r.case === name);

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const MOB = { x: 64, y: 0, z: 64 };

// A world with one zombie at MOB and the player described by `o` at `d` blocks east of it (and `dy` above its feet).
function scene(o, d, dy = 0) {
  const w = new EntityWorld(grass, [{ id: "m0", health: 10, type: "zombie", ...MOB }], () => 0.99), z = w.entities[0];
  const armor = [null, null, null, null];
  for (let i = 0; i < o.armor; i++) armor[i] = { id: 1, count: 1 };
  const effects = new Map(o.invisible ? [[14, {}]] : []);
  const survival = { health: o.dead ? 0 : 20, creative: !!o.creative, time: 6000, inventory: { armor }, effects: { has: (id) => effects.has(id) } };
  w.ai.beginTick({ x: MOB.x + d, y: MOB.y + dy, z: MOB.z }, survival, 0);
  w.ai.player.sneaking = !!o.sneaking;
  return { w, z, brain: w.ai.brain(z), ai: w.ai };
}
const bits = (step, max, at) => {
  let out = "";
  for (let k = 1; k * step <= max + 1e-9; k++) out += at(Math.round(k * step * 1000) / 1000) ? "1" : "0";
  return out;
};

test("the reference was recorded from the unchanged 1.7.10 classes", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  for (const c of ["ahb", "vo", "vp", "vu", "yg", "yn", "yk"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
  assert.equal(ref.records.length, 5);
});

test("World.getClosestVulnerablePlayer scaling (sneaking 0.8, invisible 0.7 x armour visibility) at the ranges the legacy mobs use", () => {
  let rows = 0;
  for (const set of rec("closestVulnerable").sets)
    for (const [sneaking, invisible, armor, creative, dead, found] of set.rows) {
      const o = { sneaking: !!sneaking, invisible: !!invisible, armor, creative: !!creative, dead: !!dead };
      const mine = bits(set.step, set.range + 1, (d) => { const s = scene(o, d); return s.ai.closestVulnerablePlayer(s.brain, set.range) !== null; });
      assert.equal(mine, found, `range ${set.range} ${JSON.stringify(o)}`);
      rows++;
    }
  assert.equal(rows, 4 * 22);
});

test("detectionRangeScale agrees with the closest vulnerable player boundaries", () => {
  for (const set of rec("closestVulnerable").sets)
    for (const [sneaking, invisible, armor, creative, dead, found] of set.rows) {
      if (creative || dead) continue;
      const reach = set.range * detectionRangeScale({ sneaking: !!sneaking, invisible: !!invisible, armorPieces: armor });
      const last = found.lastIndexOf("1") + 1;
      assert.ok(last * set.step < reach + 1e-6 && (last + 1) * set.step >= reach - 1e-6, `range ${set.range} sneak ${sneaking} inv ${invisible} armor ${armor}`);
    }
});

test("EntityAINearestAttackableTarget does not scale for sneaking or invisible players, only the range box, sight and creative/dead", () => {
  let rows = 0;
  for (const [follow, checkSight, canSee, dy, sneaking, invisible, armor, creative, dead, accepted] of rec("nearestAttackable").rows) {
    if (!checkSight) continue; // the browser's NearestAttackable always checks sight, as the zombie, creeper, skeleton and witch do
    const o = { sneaking: !!sneaking, invisible: !!invisible, armor, creative: !!creative, dead: !!dead };
    const mine = bits(0.5, follow + 2, (d) => {
      const s = scene(o, d, dy);
      s.brain.navigator.followRange = follow;
      s.brain.canSee = () => !!canSee;
      const task = s.brain.targets.entries.find((e) => e.action.constructor.name === "NearestAttackable").action;
      return task.shouldExecute();
    });
    assert.equal(mine, accepted, `follow ${follow} dy ${dy} ${JSON.stringify(o)} canSee ${canSee}`);
    rows++;
  }
  assert.ok(rows >= 60);
});

test("spider, silverfish and EntityMob findPlayerToAttack replay through closestVulnerablePlayer", () => {
  for (const [brightness, sneaking, invisible, armor, found] of rec("spider").rows) {
    const o = { sneaking: !!sneaking, invisible: !!invisible, armor };
    const mine = bits(0.1, 17, (d) => { const s = scene(o, d); return spiderFindsPlayer(brightness) && s.ai.closestVulnerablePlayer(s.brain, 16) !== null; });
    assert.equal(mine, found, `spider ${brightness} ${JSON.stringify(o)}`);
  }
  for (const [sneaking, invisible, armor, found] of rec("silverfish").rows) {
    const o = { sneaking: !!sneaking, invisible: !!invisible, armor };
    assert.equal(bits(0.1, 9, (d) => { const s = scene(o, d); return s.ai.closestVulnerablePlayer(s.brain, 8) !== null; }), found, `silverfish ${JSON.stringify(o)}`);
  }
  for (const [canSee, sneaking, invisible, armor, found] of rec("mob").rows) {
    const o = { sneaking: !!sneaking, invisible: !!invisible, armor };
    assert.equal(bits(0.1, 17, (d) => { const s = scene(o, d); return !!canSee && s.ai.closestVulnerablePlayer(s.brain, 16) !== null; }), found, `mob ${canSee} ${JSON.stringify(o)}`);
  }
});

test("a sneaking player is only found by a legacy mob inside 0.8 x its range (host flag on the player view)", () => {
  const w = new EntityWorld(grass, [{ id: "s0", health: 16, type: "spider", ...MOB }], () => 0.99), spider = w.entities[0];
  const survival = { health: 20, creative: false, time: 18000, inventory: { armor: [null, null, null, null] }, effects: { has: () => false }, count: () => 0, damage() {}, scaledDamage() {} };
  const run = (sneaking, d) => {
    spider.spiderTarget = false;
    w.ai.player.sneaking = sneaking;
    w.ai.beginTick({ x: MOB.x + d, y: 0, z: MOB.z }, survival, 0);
    w.ai.player.sneaking = sneaking;
    return w.ai.closestVulnerablePlayer(w.ai.brain(spider), 16) !== null;
  };
  assert.equal(run(false, 14), true);
  assert.equal(run(true, 14), false);
  assert.equal(run(true, 12), true);
});
