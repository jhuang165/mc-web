import test from "node:test";
import assert from "node:assert/strict";
import { IRON_BARS } from "./world.js";
import reference from "../public/research/zombie-villager-reference.json" with { type: "json" };
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { PEACEFUL, EASY, NORMAL, HARD } from "./difficulty.js";
import { decodeNbt, encodeNbt } from "./nbt.js";
import { villagesFromNbt, villagesToNbt, villageDocument } from "./village.js";
import { GOLDEN_APPLE, WEAKNESS, STRENGTH, NAUSEA, killConverts, startConversionTicks, conversionBoost, canCure, startConversion } from "./zombie-villager.js";

// public/research/zombie-villager-reference.json: the unchanged 1.7.10 EntityZombie (yq), its villager target task,
// getConversionTimeBoost, convertToVillager and VillageCollection NBT (tools/probes/ZombieVillagerProbe.java).
const rec = (c) => reference.records.filter((r) => r.case === c);
const hex = (s) => Uint8Array.from(s.match(/../g).map((b) => parseInt(b, 16)));
const BLOCKS = { 101: IRON_BARS, 26: -26, 1: 1 }; // the probe's iron bars and bed ids on this build's ids; a bed has no block here

const plain = () => {
  const cells = new Map();
  return {
    cells, numericSeed: 1,
    get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0), getMeta: () => 0, set: (x, y, z, b) => cells.set(`${x},${y},${z}`, b),
    solid: (x, y, z) => (cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0)) !== 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
  };
};
const survival = { health: 20, creative: false, time: 6000, damage() {}, scaledDamage: () => true, count: () => 0 };
const player = { x: 110, y: 0, z: 110 };

test("the zombie's task and target lists have the native priorities and mutex bits", () => {
  const facts = rec("facts")[0], ew = new EntityWorld(plain(), null, () => 0.5), z = ew.create("zombie", 64.5, 0, 64.5);
  ew.entities.push(z);
  const brain = ew.ai.brain(z);
  const native = (list) => facts.tasks.filter((t) => t.list === list).map((t) => [t.priority, t.mutex]);
  assert.deepEqual(brain.tasks.entries.map((x) => [x.priority, x.action.mutex]), native("tasks"));
  assert.deepEqual(brain.targets.entries.map((x) => [x.priority, x.action.mutex]), native("targets"));
  assert.deepEqual(facts.tasks.filter((t) => t.class === "uq").map((t) => [t.filter, t.params.d, t.params.e]), [["yz", 1, false], ["yv", 1, true]]);
  assert.deepEqual(facts.tasks.filter((t) => t.class === "us").map((t) => [t.params.b, t.params.e]), [[1, false]]);
  assert.deepEqual(facts.tasks.filter((t) => t.class === "vo").map((t) => [t.filter, t.params.d]), [["yz", true], ["yv", false]]);
  assert.deepEqual([facts.followRange, facts.maxHealth, facts.attackDamage, facts.child, facts.villager], [40, 20, 3, false, false]);
});

test("target replays: the nearest living villager in the follow-range box (grown 4 vertically), no sight needed", () => {
  for (const r of rec("target")) {
    const w = plain();
    if (r.label === "wall") for (let y = 0; y <= 3; y++) for (let z = 60; z <= 68; z++) w.set(66, y, z, 1);
    const ew = new EntityWorld(w, null, () => 0.5);
    const z = ew.create("zombie", 64.5, 0, 64.5);
    ew.entities.push(z);
    const vs = r.villagers.map(([x, y, zz, health, age]) => {
      const v = ew.create("villager", x, y, zz);
      v.health = health; v.growingAge = age;
      ew.entities.push(v);
      return v;
    });
    ew.ai.beginTick(player, survival);
    const brain = ew.ai.brain(z), task = brain.targets.entries[2].action;
    const run = task.shouldExecute();
    if (run) task.startExecuting();
    assert.equal(run, r.run, r.label);
    assert.equal(run ? vs.indexOf(brain.attackTarget.e) : -1, r.chosen, r.label);
  }
});

test("kill replays: onKillEntity draws one nextBoolean on Normal, none on Hard, Easy or Peaceful", () => {
  const rows = rec("kill")[0].rows;
  let normal = 0;
  for (const [difficulty, victim, seed, spawned, , , , aux, next] of rows) {
    const rand = new JavaRandom(seed);
    const converts = victim === 2 ? false : killConverts(difficulty, rand); // a zombie victim never reaches the roll
    assert.equal(converts ? 1 : 0, spawned, `${difficulty} ${victim} ${seed}`);
    assert.equal(rand.nextInt(1000000), next, `${difficulty} ${victim} ${seed} next draw`);
    assert.equal(aux.length, spawned);
    if (difficulty === NORMAL && victim !== 2) normal += converts;
  }
  assert.deepEqual([PEACEFUL, EASY, NORMAL, HARD], [0, 1, 2, 3]);
  assert.equal(normal, 80, "40 of 80 adult and 40 of 80 child kills convert on Normal");
});

test("interact replays: golden apple, villager, Weakness, damage 0; the timer, Strength and the stack", () => {
  for (const [variant, seed, ret, stack, second, ticks, converting, weakness, strength, events, next] of rec("interact")[0].rows) {
    const rand = new JavaRandom(seed);
    const z = { type: "zombie", villager: variant !== 4, health: 20, effects: variant === 2 ? [] : [{ id: WEAKNESS, duration: 600, amplifier: 0 }] };
    const id = variant === 7 ? 0 : variant === 6 ? 280 : GOLDEN_APPLE;
    assert.equal(canCure(z, id, variant === 3 ? 1 : 0), ret, `variant ${variant}`);
    if (!ret) { assert.equal(rand.nextInt(1000000), next); assert.equal(weakness, variant !== 2 ? true : false); continue; }
    const t = startConversionTicks(rand);
    assert.equal(t, ticks);
    startConversion(z, t, (e, pid, d, a) => e.effects.push({ id: pid, duration: d, amplifier: a }));
    assert.equal(z.conversionTime, ticks);
    assert.equal(z.effects.some((x) => x.id === WEAKNESS), weakness);
    const s = z.effects.find((x) => x.id === STRENGTH);
    assert.deepEqual([s.duration, s.amplifier], strength);
    assert.deepEqual(events, ["yq|16"]);
    assert.equal(converting, true);
    assert.equal(stack, variant === 1 ? 3 : 2, "the stack shrinks except in Creative");
    assert.equal(second, false);
    assert.equal(canCure(z, id, 0), false, "a second apple is refused");
    assert.equal(rand.nextInt(1000000), next);
  }
});

test("boost replays: the scan region, 0.3 per block, the cap of 14, bars count and so do beds", () => {
  const b = rec("boost")[0];
  const bed = 26; // no bed block in this build: beds are taken from the probe's own block ids
  for (const [cfg, seed, boost, next] of b.rows) {
    const cells = new Map();
    const put = (x, y, z, id) => cells.set(`${x},${y},${z}`, id);
    const bars = 101;
    switch (cfg) {
      case 1: for (let x = 8; x <= 12; x++) for (let z = 8; z <= 12; z++) put(x, 5, z, bars); break;
      case 2: put(10, 5, 10, bars); break;
      case 3: put(6, 5, 10, bars); break;
      case 4: put(14, 5, 10, bars); break;
      case 5: put(10, 9, 10, bars); put(10, 1, 10, bars); break;
      case 6: for (let x = 9; x <= 11; x++) put(x, 5, 10, bed); break;
      case 7: for (let x = 6; x <= 13; x++) for (let z = 6; z <= 13; z++) put(x, 5, z, bars); break;
      case 8: put(9, 4, 9, bars); put(11, 6, 11, bed); put(10, 5, 10, 1); break;
    }
    const rand = new JavaRandom(seed);
    const got = conversionBoost(rand, (x, y, z) => ({ [bars]: IRON_BARS, [bed]: -1 })[cells.get(`${x},${y},${z}`)] ?? 0, 10.5, 5.0, 10.5, new Set([IRON_BARS, -1]));
    assert.equal(got, boost, `${b.configs[cfg]} ${seed}`);
    assert.equal(rand.nextInt(1000000), next, `${b.configs[cfg]} ${seed} draws`);
  }
});

test("convert replays: profession from World.rand, child stays a child, Nausea 200, flag, aux 1017", () => {
  // Entity.rand is seeded from Math.random (entityRandom); a fixed stream keeps the 4-sigma bonus check deterministic.
  const random = Math.random;
  let s = 1;
  Math.random = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  try {
  for (const [seed, child, profession, age, followRange, nausea, flag, spawned, dead, aux] of rec("convert")[0].rows) {
    const w = plain(), ew = new EntityWorld(w, null, () => 0.5);
    ew.worldRandom = new JavaRandom(seed);
    const z = ew.create("zombie", 64.5, 0, 64.5);
    z.villager = true; z.growingAge = child ? -1 : 0; z.conversionTime = 1;
    ew.entities.push(z);
    ew.events.length = 0;
    ew.cureZombie(z);
    const vs = ew.entities.filter((e) => e.type === "villager");
    assert.equal(vs.length, spawned);
    const v = vs[0];
    assert.equal(v.profession, profession, `profession ${seed}`);
    assert.equal(v.growingAge, age);
    assert.equal(v.defaultReputation, flag);
    assert.deepEqual(v.effects.filter((x) => x.id === NAUSEA).map((x) => [x.duration, x.amplifier]), [nausea]);
    assert.ok(Math.abs(v.followRange - 16) <= 16 * 0.05 * 4 && Math.abs(followRange - 16) <= 16 * 0.05 * 4, "within four sigma of the 5 % spawn bonus");
    assert.equal(z.health <= 0, dead);
    assert.equal(aux.length, 1);
    assert.ok(ew.events.some((e) => e.sound === "mob.zombie.unfect" && e.volume === 2));
  }
  } finally { Math.random = random; }
});

test("villages.dat written by the native VillageCollection reads, re-writes and matches", () => {
  const v = rec("villages")[0];
  const doc = decodeNbt(hex(v.nbt));
  const json = villagesFromNbt(doc.tag);
  const [cx, cy, cz, radius, doors, pop, golems] = v.digest[0];
  assert.deepEqual([json.villages.length, json.villages[0].c, json.villages[0].radius, json.villages[0].doors.length, json.villages[0].pop, json.villages[0].golems], [1, [cx, cy, cz], radius, doors, pop, golems]);
  assert.deepEqual(json.villages[0].players, [["Alex", 7], ["Steve", -4]].sort((a, b) => json.villages[0].players.findIndex((p) => p[0] === a[0]) - json.villages[0].players.findIndex((p) => p[0] === b[0])));
  assert.deepEqual(json.villages[0].doors.map((d) => d.slice(0, 5)), v.doors.map((d) => [d[0], d[1], d[2], d[3], d[4]]));
  // The native re-write of the re-read collection has the same bytes, and ours reads back to the same JSON.
  assert.equal(v.nbt, v.reread);
  assert.deepEqual(v.rereadDigest, v.digest);
  const ours = decodeNbt(encodeNbt(villageDocument(json)));
  assert.deepEqual(villagesFromNbt(ours.tag.value.get("data")), json);
  assert.ok(villagesToNbt(json).value.has("Tick"));
});
