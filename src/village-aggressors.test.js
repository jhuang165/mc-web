import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { WOODEN_DOOR } from "./world.js";

// VillageAggressorProbe on the unchanged 1.7.10 classes (tools/verify-village-aggressors.mjs): villagers hurt by a zombie, a skeleton's
// arrow, a wolf, a spider and another villager; Village.addOrRenewAgressor / removeDeadAndOldAgressors; EntityAIDefendVillage on a real golem.
// The probe never ticks the entities (the hurt window stays shut, so a repeat hit of the same strength is refused), and neither does this replay.
const reference = JSON.parse(readFileSync(new URL("../public/research/village-aggressors-reference.json", import.meta.url)));
const key = (x, y, z) => `${x},${y},${z}`;

function plain() {
  const cells = new Map();
  cells.set(key(50, 0, 50), [WOODEN_DOOR, 0]);
  cells.set(key(50, 1, 50), [WOODEN_DOOR, 8]);
  return {
    numericSeed: 1,
    height: 256,
    get: (x, y, z) => (y < 0 ? 1 : cells.get(key(x, y, z))?.[0] ?? 0),
    getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    set: () => {},
    solid: (x, y, z) => y < 0,
    surface: () => 1,
    spawn: () => ({ x: 5.5, y: 0, z: 5.5 }),
  };
}

const POS = [[52.5, 52.5], [54.5, 52.5], [63.5, 51.5], [51.5, 60.0], [51.5, 57.5], [51.5, 66.5], [54.5, 51.5]];
const TYPES = ["villager", "villager", "zombie", "skeleton", "wolf", "spider", "zombie"];

function replay(r) {
  const w = plain();
  const ew = new EntityWorld(w, [], () => 0.5);
  ew.difficulty = 2;
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => true;
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100);
  const c = ew.villages;
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  const village = c.villages[0];
  const ents = TYPES.map((type, i) => {
    const e = ew.create(type, POS[i][0], 0, POS[i][1]);
    e.growingAge = 0; e.onGround = true;
    ew.entities.push(e);
    return e;
  });
  for (const i of [0, 1]) ew.ai.brain(ents[i]).village = village;
  const golem = ew.spawnIronGolem(51.5, 0, 51.5, false), gb = ew.ai.brain(golem);
  gb.village = village;
  golem.onGround = true;
  const rand = new JavaRandom(BigInt(r.seed));
  let draws = [];
  { const ni = rand.nextInt.bind(rand); rand.nextInt = (...a) => { if (a.length) draws.push(`i${a[0]}`); return ni(...a); }; }
  setEntityRandom(golem, rand);
  gb.rand = rand;
  const task = gb.targets.entries.map((x) => x.action).find((a) => a.constructor.name === "DefendVillage");
  const script = r.script.map((s) => s.split(" "));
  const hits = [], rows = [];
  let last = null;
  for (let t = 0; t < r.ticks; t++) {
    for (const p of script) {
      if (Number(p[0]) !== t) continue;
      if (p[1] === "hit") {
        const v = ents[Number(p[2])], a = ents[Number(p[3])];
        const hit = ew.attackEntityFrom(v, Number(p[4]), { from: { x: a.x, z: a.z }, attacker: a, name: "mob", player: false });
        hits.push([t, hit, v.health]);
      } else if (p[1] === "kill") ents[Number(p[2])].health = 0;
      else if (p[1] === "setdead") ew.entities.splice(ew.entities.indexOf(ents[Number(p[2])]), 1);
      else if (p[1] === "move") { const e = ents[Number(p[2])]; e.x = Number(p[3]); e.z = Number(p[4]); }
    }
    if (t % 60 === 0) c.addVillagerPosition(52, 0, 52);
    c.tick();
    draws = [];
    const on = task.shouldExecute();
    const target = task.aggressor, ti = target ? ents.indexOf(target.e) : -1;
    const agg = village.aggressors.map((a) => [ents.indexOf(a.entity.e), a.tick]);
    const row = JSON.stringify([agg, on, ti, [...draws]]);
    if (row !== last) { rows.push([t, JSON.parse(row)]); last = row; }
  }
  return { hits, rows };
}

test("village aggressors: 9 native scenarios (hurt window, 300-tick expiry, renewal, dead and removed attackers, nearest search, golem reach draws)", () => {
  assert.equal(reference.records.length, 9);
  let max = 0;
  for (const r of reference.records) {
    const got = replay(r);
    assert.deepEqual(got.hits, r.hits.map(([t, hit, hp]) => [t, hit, hp]), `${r.name} hits`);
    assert.deepEqual(got.rows, r.rows, r.name);
    max = Math.max(max, ...r.rows.map((row) => row[1][0].length));
  }
  assert.equal(max, 3, "three aggressors at once");
});

test("a player hit still costs reputation and a mob hit does not; a villager hurt by a mob names the mob as aggressor", () => {
  const ew = new EntityWorld(plain(), [], () => 0.5);
  ew.worldRandom = new JavaRandom(1);
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100);
  ew.villages.addVillagerPosition(52, 0, 52);
  ew.villages.tick();
  const village = ew.villages.villages[0];
  const v = ew.create("villager", 52.5, 0, 52.5), z = ew.create("zombie", 54.5, 0, 52.5);
  ew.entities.push(v, z);
  ew.ai.brain(v).village = village;
  ew.ai.player = { x: 52.5, y: 0, z: 50.5, alive: true, isPlayer: true };
  ew.attackEntityFrom(v, 1, { from: { x: 54.5, z: 52.5 }, attacker: z, name: "mob", player: false });
  assert.deepEqual(village.aggressors.map((a) => a.entity.e), [z]);
  assert.equal(village.playerReputation("Player"), 0);
  v.hurt = 0;
  ew.attackEntityFrom(v, 1, { from: { x: 0, z: 0 }, player: true, name: "player" });
  assert.equal(village.playerReputation("Player"), -1);
  assert.equal(village.aggressors.length, 2);
  assert.equal(village.aggressors[1].entity, ew.ai.player);
  // no living attacker entity (fall, projectile name string): nothing is recorded
  v.hurt = 0;
  ew.attackEntityFrom(v, 3, { name: "thrown", attacker: "projectile", player: false });
  assert.equal(village.aggressors.length, 2);
});
