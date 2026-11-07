import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { WOODEN_DOOR } from "./world.js";
import { Arrows, arrowTargets } from "./bow.js";
import { GaussianRandom, mobTargets } from "./projectiles.js";
import { deathMessage } from "./death-messages.js";

// SkeletonArrowVillagerProbe on the unchanged 1.7.10 classes (tools/verify-skeleton-arrow-villager.mjs): a skeleton's arrow flying into a villager,
// EntityLivingBase.attackEntityFrom with the arrow source, Village.addOrRenewAgressor and a real iron golem's EntityAIDefendVillage afterwards.
// The villager is not ticked (as in the probe); the arrow starts from the recorded state because natively its heading Random cannot be seeded.
const reference = JSON.parse(readFileSync(new URL("../public/research/skeleton-arrow-villager-reference.json", import.meta.url)));
const key = (x, y, z) => `${x},${y},${z}`;
const float = (s) => Math.fround(Number(s));

function plain() {
  const cells = new Map();
  cells.set(key(50, 0, 50), [WOODEN_DOOR, 0]);
  cells.set(key(50, 1, 50), [WOODEN_DOOR, 8]);
  return {
    numericSeed: 1, height: 256,
    get: (x, y, z) => (y < 0 ? 1 : cells.get(key(x, y, z))?.[0] ?? 0),
    getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    set: () => {}, solid: (x, y, z) => y < 0, surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }),
  };
}

function replay(r) {
  const w = plain();
  const ew = new EntityWorld(w, [], () => 0.5);
  ew.difficulty = r.difficulty;
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => true;
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100);
  const c = ew.villages;
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  const village = c.villages[0];
  const villager = ew.create("villager", 52.5, 0, 52.5), skel = ew.create("skeleton", 52.5, 0, 52.5 + r.distance), golem = ew.spawnIronGolem(46.5, 0, 51.5, false);
  for (const e of [villager, skel, golem]) { e.growingAge = 0; e.onGround = true; }
  villager.health = r.hp;
  if (r.name) skel.customName = r.name;
  const bows = [null, [], [{ id: 48, lvl: 3 }, { id: 49, lvl: 2 }, { id: 50, lvl: 1 }], [{ id: 49, lvl: 1 }]];
  if (r.bow) skel.equipment = [{ id: 261, count: 1, damage: 0, enchantments: bows[r.bow] }, null, null, null, null];
  ew.entities.push(villager, skel);
  ew.ai.brain(villager).village = village;
  const gb = ew.ai.brain(golem);
  gb.village = village;
  setEntityRandom(villager, new JavaRandom(BigInt(r.seed + 1)));
  const arrows = new Arrows(() => 0.5);
  // the port's own shot: damage, Punch, Flame and the random.bow pitch come from the skeleton's Random (Gaussian, then the pitch float)
  arrows.mobRands.set(skel, new GaussianRandom(0));
  arrows.mobRands.get(skel).setSeed?.(BigInt(r.seed));
  const shotRand = new JavaRandom(BigInt(r.seed));
  arrows.mobRands.set(skel, shotRand);
  const shot = arrows.skeletonShoot(skel, { x: villager.x, y: villager.y, z: villager.z, height: 1.8 }, Math.fround(r.scale), r.difficulty);
  const got = { damage: shot.damage, knockback: shot.knockback, fire: shot.fire > 0 ? 2000 : 0, sound: arrows.drain()[0] };
  arrows.list.length = 0;
  // then the recorded initial state
  const [x, y, z, mx, my, mz, yaw, pitch] = r.shot.arrow;
  const arrow = arrows.make({ x, y, z, mx, my, mz, yaw: float(yaw), pitch: float(pitch) }, new JavaRandom(BigInt(r.seed + 7)), { shooter: skel, pickup: 0 });
  arrow.damage = r.shot.damage; arrow.knockback = r.shot.knockback; arrow.fire = r.shot.fire > 0 ? 100 : 0;
  arrows.list.push(arrow);
  const task = gb.targets.entries.map((x) => x.action).find((a) => a.constructor.name === "DefendVillage");
  const draws = [];
  { const ni = gb.rand.nextInt.bind(gb.rand); gb.rand.nextInt = (...a) => { if (a.length) draws.push(`i${a[0]}`); return ni(...a); }; }
  const ticks = [], golemRows = [];
  let hit = null, hitTick = -1, last = null;
  for (let t = 0; t < r.ticks.length + 1 && t < 40; t++) {
    if (t % 60 === 0) c.addVillagerPosition(52, 0, 52);
    c.tick();
    const before = villager.health;
    arrows.tick(w, { targets: arrowTargets(mobTargets(ew.entities, null), false), mobs: ew });
    if (hitTick < 0 && (arrow.dead || villager.health !== before)) {
      hitTick = t;
      hit = { tick: t, health: villager.health, motion: [villager.vx, villager.vy, villager.vz], fire: villager.fire || 0, aggressors: village.aggressors.length,
        sounds: [...ew.events.filter((e) => e.sound?.startsWith("mob.villager")).map((e) => [e.sound, e.volume, e.pitch]), ...arrows.drain().filter((e) => e.sound === "random.bowhit").map((e) => [e.sound, e.volume, e.pitch])] };
    }
    ticks.push([arrow.x, arrow.y, arrow.z, arrow.mx, arrow.my, arrow.mz, arrow.dead]);
    if (hitTick >= 0) {
      draws.length = 0;
      const on = task.shouldExecute();
      const ti = task.aggressor ? (task.aggressor.e === skel ? 3 : task.aggressor.e === villager ? 0 : -1) : -1;
      const agg = village.aggressors.map((a) => [a.entity.e === skel ? 3 : -1, a.tick]);
      const row = JSON.stringify([agg, on, ti, [...draws]]);
      if (row !== last) { golemRows.push([t, JSON.parse(row)]); last = row; }
    }
    if (hitTick >= 0 && t >= hitTick + 3) break;
  }
  return { got, ticks, hit, hitTick, golemRows, skel, villager };
}

test("skeleton arrow on a villager: 52 native scenarios (the shot, flight, damage, Punch, Flame, knockback, aggressor, golem target, sounds)", () => {
  assert.equal(reference.records.length, 52);
  let hits = 0, kills = 0, aggressors = 0;
  for (const r of reference.records) {
    const label = `d${r.difficulty} bow${r.bow} seed${r.seed} dist${r.distance}`;
    const g = replay(r);
    // the port's skeleton makes the same damage, Punch and Flame (the arrow's own aim is covered by bow-reference.json)
    assert.ok(Math.abs(g.got.damage - r.shot.damage) < 1e-9, `${label} damage ${g.got.damage} vs ${r.shot.damage}`);
    assert.equal(g.got.knockback, r.shot.knockback, label);
    assert.equal(g.got.fire, r.shot.fire, label);
    assert.equal(g.got.sound.pitch, float(r.shot.sounds[0].split("|")[2]), `${label} random.bow pitch`);
    assert.equal(g.hitTick, r.hitTick, `${label} hit tick`);
    // a dead arrow is never ticked in the game (the probe keeps calling it)
    g.ticks.slice(0, r.hitTick >= 0 ? r.hitTick + 1 : undefined).forEach((row, i) => row.forEach((v, j) => {
      if (typeof v === "boolean") assert.equal(v, r.ticks[i][j], `${label} tick ${i} dead`);
      else assert.ok(Math.abs(v - r.ticks[i][j]) < 1e-6, `${label} tick ${i} field ${j}: ${v} vs ${r.ticks[i][j]}`);
    }));
    if (!r.hit) continue;
    hits++;
    assert.equal(g.hit.health, r.hit.health, `${label} health`);
    r.hit.motion.forEach((v, i) => assert.ok(Math.abs(g.hit.motion[i] - v) < 1e-9, `${label} knockback ${i}: ${g.hit.motion[i]} vs ${v}`));
    assert.equal(g.hit.fire, r.hit.fire, `${label} burning`);
    assert.equal(g.hit.aggressors, r.hit.aggressors, `${label} aggressor count`);
    assert.deepEqual(g.hit.sounds.map(([n, v, p]) => `${n}|${v}|${p}`), r.hit.sounds.map((s) => { const [n, v, p] = s.split("|"); return `${n}|${Number(v)}|${float(p)}`; }), `${label} sounds`);
    assert.deepEqual(g.golemRows, r.golem, `${label} golem`);
    if (r.hit.health <= 0) {
      kills++;
      const text = deathMessage("an arrow", "Villager", { attacker: g.skel });
      assert.equal(text, r.hit.deathMessage.text, label);
    }
    aggressors += r.hit.aggressors;
  }
  assert.ok(hits >= 30 && aggressors === hits, `${hits} hits, ${aggressors} aggressors`);
  assert.ok(kills >= 1, "a lethal arrow");
});
