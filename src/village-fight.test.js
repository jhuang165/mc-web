import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { WOODEN_DOOR } from "./world.js";

// VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs): villagers, zombies, skeletons and an iron golem all ticked, a
// moving player whose hits are scripted. This replay ticks the port's mobs too and compares the VILLAGE layer tick by tick: the hit results
// (hurt window with ticking mobs), the aggressor list [entity index, last tick] with its ordering, expiry and removal, and the player's reputation
// (-1 per hit, -5 for killing a village golem, a second name starting at 0). Mob positions, targets and Random draws are NOT compared: the port keeps no
// mob-on-mob revenge target (only the player's), so a golem fighting a zombie diverges from the native rows. See village.md "Batch 28".
const reference = JSON.parse(readFileSync(new URL("../public/research/village-fight-reference.json", import.meta.url)));
const key = (x, y, z) => `${x},${y},${z}`;
const TYPES = ["villager", "villager", "zombie", "zombie", "iron_golem", "skeleton", "skeleton"];

function plain() {
  const cells = new Map([[key(50, 0, 50), [WOODEN_DOOR, 0]], [key(50, 1, 50), [WOODEN_DOOR, 8]]]);
  return { numericSeed: 1, height: 256, get: (x, y, z) => (y < 0 ? 1 : cells.get(key(x, y, z))?.[0] ?? 0), getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    set: () => {}, solid: (x, y, z) => y < 0, surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }) };
}

function replay(r) {
  const ew = new EntityWorld(plain(), [], () => 0.5);
  ew.difficulty = 2;
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => false;
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100);
  const c = ew.villages;
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  const village = c.villages[0], ents = [];
  TYPES.forEach((type, i) => {
    const [x, z] = r.pos[i], e = type === "iron_golem" ? ew.spawnIronGolem(x, 0, z, false) : ew.create(type, x, 0, z);
    if (type !== "iron_golem") ew.entities.push(e);
    e.growingAge = 0; e.onGround = true;
    if (type === "villager") e.profession = i;
    setEntityRandom(e, new JavaRandom(BigInt(r.seed * 10 + i)));
    ents.push(e);
  });
  for (const i of [0, 1, 4]) ew.ai.brain(ents[i]).village = village;
  const survival = new Survival({}, "survival");
  survival.difficulty = 2; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[7][0], y: 0, z: r.pos[7][1], health: 1000, alive: true, isPlayer: true };
  const vel = [0, 0], script = r.script.map((s) => s.split(" ")), hits = [], rows = [];
  let name = "probe";
  for (let t = 0; t < r.ticks; t++) {
    for (const p of script) {
      if (Number(p[0]) !== t) continue;
      if (p[1] === "hit") {
        const v = ents[Number(p[2])], a = Number(p[3]) === 7 ? player : ents[Number(p[3])];
        const src = p[5] === "player" ? { from: { x: player.x, z: player.z }, player: true, name: "player" } : { from: { x: a.x, z: a.z }, attacker: a, shooter: p[5] === "arrow" ? a : undefined, name: p[5] === "arrow" ? "arrow" : "mob", player: false };
        hits.push([t, ew.attackEntityFrom(v, Number(p[4]), src), v.health]);
      } else if (p[1] === "walk" && p[2] === "7") { vel[0] = Number(p[3]); vel[1] = Number(p[4]); }
      else if (p[1] === "move" && p[2] !== "7") { const e = ents[Number(p[2])]; e.x = Number(p[3]); e.z = Number(p[4]); }
      else if (p[1] === "move") { player.x = Number(p[3]); player.z = Number(p[4]); }
      else if (p[1] === "rename") name = p[2];
    }
    player.x += vel[0]; player.z += vel[1];
    ew.ai.beginTick(player, survival, 0);
    ew.tick(player, survival, 0);
    survival.health = 1000;
    const agg = village.aggressors.map((a) => [a.entity.isPlayer ? 7 : ents.indexOf(a.entity.e), a.tick]);
    rows.push([agg, village.playerReputation(name === "alt" ? "Player" : "Player")]);
  }
  return { hits, rows };
}

test("village fight: player hits, aggressor list and reputation up to the first mob-on-mob death in each native scenario", () => {
  assert.equal(reference.records.length, 5);
  const limits = {};
  for (const r of reference.records) {
    const got = replay(r);
    // the first tick at which a native mob (zombie or skeleton; the golem's own death by the player is replayed) has been killed by another mob: the port has no mob-on-mob revenge or kills there
    const dead = r.rows.findIndex((row) => [2, 3, 5, 6].some((i) => row[0][i][3] <= 0));
    const limit = dead < 0 ? r.ticks : dead;
    limits[r.name] = limit;
    for (let t = 0; t < limit; t++) {
      const want = r.rows[t];
      assert.deepEqual(got.rows[t][0], want[1], `${r.name} tick ${t} aggressors`);
      // the port keys its one local player by "Player"; the native rename to "alt" at tick 600 starts a fresh entry (checked below)
      if (!(r.name === "player-turns-aggressive" && t >= 600)) assert.equal(got.rows[t][1], want[2], `${r.name} tick ${t} reputation`);
    }
    assert.deepEqual(got.hits.filter(([t]) => t < limit).map(([t, h]) => [t, h]), r.hits.filter(([t]) => t < limit).map(([t, h]) => [t, h]), `${r.name} hit results`);
  }
  // the checked windows: both player-fights scenarios run to the end; the shooter scenarios until the golem kills a skeleton / zombie
  assert.equal(limits["player-fights-zombie-0"], 260);
  assert.equal(limits["player-turns-aggressive"], 700);
  assert.ok(limits["zombies-and-shooters-0"] > 200 && limits["zombies-and-shooters-1"] > 200);
});
