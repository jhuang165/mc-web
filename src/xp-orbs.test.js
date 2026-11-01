import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { solidBlock, WATER, LAVA, ICE, CACTUS, FIRE } from "./world.js";
import { JavaRandom } from "./lighting.js";
import { Experience, ExperienceOrbs, newOrb } from "./experience.js";

const f = Math.fround;
// public/research/xporb-reference.json: the unchanged EntityXPOrb.onUpdate (tools/verify-xporbs.mjs).
const ref = JSON.parse(await readFile(new URL("../public/research/xporb-reference.json", import.meta.url)));
// Original ids: stone 1, glass 20, flowing and still water 8/9, still lava 11, fire 51, ice 79, cactus 81.
const internal = { 1: 3, 20: 9, 8: WATER, 9: WATER, 11: LAVA, 51: FIRE, 79: ICE, 81: CACTUS };
// The probe world: stone below y 0, the case's cells elsewhere.
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)) };
}
// Java logs "name@volume/pitch" for playSound and "source:amount" for attackEntityFrom.
const parse = (log) => (log ? log.split(" ").map((t) => (t.includes("@") ? t.split(/[@/]/).map((v, i) => (i ? f(+v) : v)) : t)) : []);

test("ExperienceOrbs replays the original EntityXPOrb.onUpdate tick for tick", () => {
  assert.ok(ref.cases.length >= 19);
  for (const c of ref.cases) {
    const world = probeWorld(c.cells), r = new JavaRandom(c.seed), orbs = new ExperienceOrbs([], () => r.nextFloat());
    const o = newOrb(7, c.x, c.y, c.z, () => 0);
    [o.vx, o.vy, o.vz] = c.motion;
    o.id = c.id;
    orbs.orbs.push(o);
    const player = c.player && { x: c.player[0], y: c.player[1], z: c.player[2] };
    let log;
    const hurt = orbs.hurt.bind(orbs);
    orbs.hurt = (orb, source, n) => (log.push(`${source}:${n.toFixed(1)}`), hurt(orb, source, n));
    c.ticks.forEach(([x, y, z, vx, vy, vz, onGround, fire, health, dead, retarget, target, events], t) => {
      if (player && t === c.leave) player.x += 20;
      log = [];
      orbs.sounds = { push: (s) => log.push([s.name, s.volume, s.pitch]) };
      orbs.tick(world, player);
      const at = `${c.name} tick ${t}`;
      // The reference went through JSON.stringify, which writes -0 as 0.
      assert.deepEqual([o.x, o.posY, o.z, o.vx, o.vy, o.vz].map((v) => v + 0), [x, y, z, vx, vy, vz], at);
      assert.equal(o.y, o.bb[1], at);
      assert.deepEqual([o.onGround, o.fire, o.health, !!o.dead, o.retarget, o.target], [onGround, fire, health, dead, retarget, target], at);
      assert.deepEqual(log, parse(events), at + " events");
    });
    assert.equal(orbs.orbs.includes(o), !o.dead, c.name);
  }
  // Coverage: the lava fizz, lava and fire damage, two cactus cells, a target dropped after the
  // player leaves, and the water stream carrying the orb.
  const byName = Object.fromEntries(ref.cases.map((c) => [c.name, c]));
  assert.match(byName.lava.ticks[0][12], /lava:4.0 random.fizz@0.4\/[\d.]+ inFire:1.0/);
  assert.ok(byName.cactus.ticks.some((t) => t[12] === "cactus:1.0 cactus:1.0"));
  assert.ok(byName["pull-leave"].ticks.at(-1)[11] === false && byName["pull-leave"].ticks[29][11] === true);
  assert.ok(byName.water.ticks.at(-1)[0] > 4);
  assert.ok(byName["pull-out"].ticks.every((t) => !t[11]));
});

test("orbs spawn with the constructor's motion and are picked up one every other tick", () => {
  const values = [0.5, 0.0, 1.0, 0.25];
  const o = newOrb(3, 1.5, 2.5, 3.5, () => values.shift() ?? 0);
  assert.deepEqual([o.vx, o.vy, o.vz], [f(f(0 * 0.2 - 0.1) * 2), f(f(1 * 0.2) * 2), f(f(0.25 * 0.2 - 0.1) * 2)]);
  assert.deepEqual([o.x, o.posY, o.y, o.z, o.health, o.age], [1.5, 2.5, 2.25, 3.5, 5, 0]);
  const orbs = new ExperienceOrbs([], () => 0.5), xp = new Experience(), feet = { x: 0.5, y: 0, z: 0.5 };
  orbs.spawn(18, { x: 0.5, y: 0.25, z: 0.5 });
  assert.deepEqual(orbs.orbs.map((o) => o.value), [17, 1]);
  const picked = [];
  for (let t = 0; t < 4; t++) picked.push(orbs.collect(feet));
  assert.deepEqual(picked, [17, 0, 1, 0]);
  assert.deepEqual(orbs.sounds.map((s) => [s.name, s.volume, s.pitch]), [["random.orb", f(0.1), f(0.9)], ["random.orb", f(0.1), f(0.9)]]);
  for (const v of picked) xp.add(v);
  assert.equal(xp.total, 18);
  // The grown player box (1 sideways, 0.5 up and down) must overlap the orb's box strictly.
  const far = new ExperienceOrbs(), edge = 0.5 + f(0.6) / 2 + 1;
  far.orbs.push(newOrb(3, edge + 0.25, 1, 0.5, () => 0));
  far.orbs[0].bb[0] = edge;
  assert.equal(far.collect(feet), 0);
  far.orbs[0].bb[0] = edge - 1e-9;
  assert.equal(far.collect(feet), 3);
});

test("orb saves keep age, health, fire and motion; older saves convert life to age", () => {
  const world = probeWorld([]), orbs = new ExperienceOrbs([], () => 0.5);
  orbs.spawn(5, { x: 0.5, y: 3, z: 0.5 });
  for (let t = 0; t < 3; t++) orbs.tick(world, null);
  const saved = orbs.serialize()[0];
  for (const k of ["px", "py", "pz", "posY", "bb", "color", "retarget", "target"]) assert.ok(!(k in saved), k);
  assert.equal(saved.age, 3);
  const back = new ExperienceOrbs(orbs.serialize()).orbs[0], live = orbs.orbs[0];
  assert.deepEqual([back.x, back.y, back.z, back.vx, back.vy, back.vz, back.health, back.fire], [live.x, live.y, live.z, live.vx, live.vy, live.vz, live.health, live.fire]);
  assert.deepEqual([back.px, back.py, back.pz, back.color, back.posY], [back.x, back.y, back.z, 0, back.y + 0.25]);
  const old = new ExperienceOrbs([{ x: 10, y: 0, z: 0, value: 3, life: 1 }]);
  assert.equal(old.orbs[0].age, 5999);
  old.tick(world, null);
  assert.equal(old.orbs.length, 0);
  assert.equal(new ExperienceOrbs([{ x: 1, y: 1, z: 1, value: 3, age: 6000 }]).orbs.length, 0);
  assert.equal(new ExperienceOrbs([{ x: 1, y: 1, z: 1, value: 3, health: 0 }]).orbs.length, 0);
});


test("explosions replay original XP orb damage and knockback through full and partial shielding", () => {
  assert.equal(ref.explosions.length, 9);
  for (const c of ref.explosions) {
    const orbs = new ExperienceOrbs(), world = probeWorld(c.cells);
    const targets = c.targets.map(([x, y, z]) => {
      const o = newOrb(7, x, y, z, () => 0);
      [o.vx, o.vy, o.vz] = [0.01, -0.02, 0.03];
      return o;
    });
    orbs.orbs.push(...targets);
    orbs.explode(world, 0.5, 1.5, 0.5, c.size);
    targets.forEach((o, i) => {
      assert.deepEqual([o.x, o.posY, o.z, o.vx, o.vy, o.vz, o.health, !!o.dead], c.targets[i], `shield ${c.shield}, size ${c.size}, target ${i}`);
      assert.equal(orbs.orbs.includes(o), !o.dead);
    });
    // An orb killed in the blast must disappear from rendering, saves and pickup immediately.
    assert.ok(orbs.serialize().every(o => o.health > 0));
  }
  const open = ref.explosions.find(c => c.shield === 0 && c.size === 3);
  const wall = ref.explosions.find(c => c.shield === 1 && c.size === 3);
  assert.equal(open.targets[0][6], 5); // Coincident centre has a zero-length push and is skipped.
  assert.equal(open.targets[1][7], true);
  assert.equal(wall.targets[2][6], 4); // Even zero exposure deals the minimum one damage.
  assert.equal(open.targets[3][6], 4); // Exactly radius 6: minimum damage, no push.
  assert.equal(open.targets[4][6], 5); // Outside radius.
});

test("orb explosions skip the exploder and remove casualties before newly dropped ore XP", () => {
  const orbs = new ExperienceOrbs(), world = probeWorld([]);
  const excluded = newOrb(7, 1.5, 1.5, 0.5, () => 0);
  const casualty = newOrb(3, 1.5, 1.5, 0.5, () => 0);
  orbs.orbs.push(excluded, casualty);
  orbs.explode(world, 0.5, 1.5, 0.5, 3, excluded);
  assert.equal(excluded.health, 5);
  assert.ok(casualty.dead);
  assert.deepEqual(orbs.orbs, [excluded]);
  orbs.spawn(1, {x: 1.5, y: 1.5, z: 0.5});
  assert.equal(orbs.orbs[1].health, 5);
  assert.equal(orbs.collect({x: 1.5, y: 0, z: 0.5}), 7);
  assert.equal(orbs.collect({x: 1.5, y: 0, z: 0.5}), 0);
  assert.equal(orbs.collect({x: 1.5, y: 0, z: 0.5}), 1);
});
