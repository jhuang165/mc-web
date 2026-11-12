// Batch 52 (mobexport, tag b52me): Entity.onStruckByLightning (sa.a(xh)) on fire-immune and ordinary mobs, and a pigman shot by a player's arrow.
// Replays the `bolt` and `pigman-arrow` records appended to public/research/mob-victims-reference.json by tools/probes/MobVictimProbe.java: the unchanged 1.7.10 classes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { struckByLightning } from "./weather.js";
import { tickWeatherSimulation } from "./weather-simulation.js";
import { powerCreeper } from "./creeper.js";

const f = Math.fround;
const reference = JSON.parse(readFileSync(new URL("../public/research/mob-victims-reference.json", import.meta.url)));
const bolts = reference.records.filter((r) => r.victim === "bolt"), arrows = reference.records.filter((r) => r.victim === "pigman-arrow");
const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }) };
const TYPES = { zombie: "zombie", pigman: "pigman", witherSkeleton: "wither_skeleton", wither: "wither", magma_cube: "magma_cube", skeleton: "skeleton" };
const stack = (id, enchantments) => ({ id, count: 1, damage: 0, enchantments: enchantments.map(([id, lvl]) => ({ id, lvl })) });
const DIAMOND = [310, 311, 312, 313];

test("the bolt and arrow records were recorded from the unchanged client", () => {
  assert.equal(bolts.length, 54);
  assert.equal(arrows.length, 4);
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
});

test("a lightning strike advances the fire counter by one, ignites at 0 (shortened by Fire Protection) and burns only a mob that is not immune", () => {
  const failures = [];
  for (const r of bolts) {
    const world = new EntityWorld(flat, [{ id: "v", type: TYPES[r.kind], x: 8, y: 0, z: 8, health: r.kind === "magma_cube" ? 4 : 20 }], () => 0.5);
    const [v] = world.entities;
    if (r.kind === "magma_cube") v.size = 1;
    if (r.material >= 0) v.equipment = [null, ...[3, 2, 1, 0].map((i) => stack(DIAMOND[i], [[r.ench, r.level]]))];
    v.fire = r.start;
    const hit = struckByLightning(v.fire, v.equipment ?? []);
    const before = v.health;
    world.hazard(v, hit.damage, "inFire");
    v.fire = hit.fire;
    if (v.fire !== r.fire) failures.push(`${r.kind} start ${r.start} fp ${r.material}: fire ${v.fire} want ${r.fire}`);
    if (r.immune && v.health !== before) failures.push(`${r.kind} start ${r.start}: immune mob lost health`);
    if (!r.immune && !(v.health < before)) failures.push(`${r.kind} start ${r.start}: not hurt`);
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});

test("the weather step passes the worn armour to the strike, and a rested fire-immune mob ignites", () => {
  const world = new EntityWorld(flat, [{ id: "p", type: "pigman", x: 8, y: 0, z: 8, health: 20 }, { id: "z", type: "zombie", x: 8, y: 0, z: 8.2, health: 20 }], () => 0.5);
  const [pig, zombie] = world.entities;
  pig.fire = -1;
  zombie.fire = -1;
  zombie.equipment = [null, ...[3, 2, 1, 0].map((i) => stack(DIAMOND[i], [[1, 4]]))];
  const weather = { struck: [{ x: 8, y: 0, z: 8 }], tick() {} };
  tickWeatherSimulation({ world, weather, mobs: world, survival: { creative: true } }, { x: 100, y: 0, z: 100 }, 0.6, 1.8);
  assert.equal(pig.fire, 160);
  assert.equal(pig.health, 20);
  assert.equal(zombie.fire, 64);
  assert.ok(zombie.health < 20);
});

test("burn() leaves a fire-immune mob's counter at 0 (sv.C extinguishes it after sa.C's run-down by 4; the move tail rests it afterwards)", () => {
  const world = new EntityWorld(flat, [{ id: "a", type: "pigman", x: 8, y: 0, z: 8, health: 20 }], () => 0.5);
  for (const e of world.entities) {
    const t = { width: 0.6, height: 1.8 };
    e.fire = 10;
    world.burn(e, t);
    assert.equal(e.fire, 0, e.type);
    e.fire = -1;
    world.burn(e, t);
    assert.equal(e.fire, 0, e.type);
  }
});

test("a pigman shot by a player's arrow angers itself and every pigman within 32 blocks; a mob shooter angers none", () => {
  const failures = [];
  const whoTarget = (world, v) => { const t = world.silverfishState(v).target; return !t ? "none" : t === world.ai.player ? "player" : "other"; };
  for (const r of arrows) {
    const near = [[70.5, 64.5], [64.5, 95.5], [64.5, 100.5], [100.5, 64.5]].slice(0, r.neighbours);
    const world = new EntityWorld(flat, [{ id: "v", type: "pigman", x: 8, y: 0, z: 8, health: 20 }, { id: "a", type: "zombie", x: 10.5, y: 0, z: 8.5, health: 20 },
      ...near.map(([x, z], i) => ({ id: "p" + i, type: "pigman", x: x - 56.5, y: 0, z: z - 56.5, health: 20 }))], () => 0.5);
    world.currentDate = () => new Date(2014, 5, 1);
    const [v, shooter, ...others] = world.entities;
    // ArrowBow's hit (bow.js hit): damage(ref, dmg, x, z, byPlayer, shooter type, { projectile, shooter }).
    const player = r.shooter === "player";
    const accepted = world.damage(v, f(4), 10.5, 8.5, player, player ? null : "zombie", { projectile: true, shooter: player ? null : shooter });
    const got = JSON.stringify({ accepted, anger: v.angerLevel > 0 ? 1 : 0, target: whoTarget(world, v), others: others.map((o) => [o.angerLevel > 0 ? 1 : 0, whoTarget(world, o)]) });
    const want = JSON.stringify({ accepted: r.accepted, anger: r.self.anger, target: r.self.target === "attacker" ? "other" : r.self.target, others: r.others.map((o) => [o.angerLevel > 0 ? 1 : 0, o.target === "attacker" ? "other" : o.target]) });
    if (got !== want) failures.push(`${r.case}/${r.shooter}: got ${got} want ${want}`);
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});
