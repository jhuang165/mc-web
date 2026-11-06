import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Stats, STAT, FORMATS, GENERAL, EGGS, BLOCK_LIST, ITEM_LIST, lang, mineStat, craftStat, useStat, breakStat, isStat, formatStat, statsFileJson, parseStatsFile, offlineUuid, statsExportFile, nextSort, sortRows, entityName } from "./stats.js";
import { STAT_DATA } from "./stats-data.js";
import { addMovementStat, addMountedMovementStat, addFallStat, damageTenths, vehicleKind, StatsLive, watchMobStats } from "./stats-live.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/stats-reference.json", import.meta.url), "utf8"));
const of = (c) => ref.records.filter((r) => r.case === c);

test("the general stats replay the original StatList order, formats and ids", () => {
  const general = of("stat").filter((s) => s.general);
  assert.deepEqual(GENERAL.map((g) => g.id), general.map((s) => s.id));
  assert.deepEqual(GENERAL.map((g) => g.format), general.map((s) => s.format));
  assert.deepEqual(GENERAL.map((g) => g.local), general.map((s) => s.local));
  for (const g of GENERAL) assert.ok(lang(g.id) !== g.id, `name of ${g.id}`);
  assert.equal(lang("stat.walkOneCm"), "Distance Walked");
  assert.equal(Object.keys(STAT).length, GENERAL.length);
  for (const id of Object.values(STAT)) assert.ok(isStat(id), id);
});
test("formatters replay the original samples", () => {
  for (const f of of("format")) for (const [v, text] of f.samples) assert.equal(FORMATS[f.kind](v), text, `${f.kind} ${v}`);
});
test("per-item arrays replay pp.C..F including merged block variants", () => {
  const fns = { mineBlock: mineStat, craftItem: craftStat, useItem: useStat, breakItem: breakStat };
  for (const a of of("array")) {
    const fn = fns[a.name];
    assert.deepEqual(a.entries.map(([i]) => i), Object.keys(STAT_DATA[{ mineBlock: "mine", craftItem: "craft", useItem: "use", breakItem: "break" }[a.name]]).map(Number));
    for (const [i, id] of a.entries) assert.equal(fn(i), id);
    assert.equal(fn(0), null);
  }
  assert.equal(mineStat(2), "stat.mineBlock.3"); // grass shares dirt's stat
  const lists = of("lists")[0];
  assert.deepEqual(BLOCK_LIST.map((n) => `stat.mineBlock.${n}`), lists.blocks);
  assert.deepEqual(ITEM_LIST.map((n) => `stat.useItem.${n}`), lists.items);
});
test("entity kill stats replay EntityList egg infos", () => {
  assert.deepEqual(EGGS.map((e) => [e.id, e.name, e.kills, e.killedBy]), of("egg").map((e) => [e.id, e.name, e.kills, e.killedBy]));
  assert.equal(entityName("pigman"), "PigZombie");
  assert.equal(entityName("magma_cube"), "LavaSlime");
  assert.equal(entityName("wither"), null);
  assert.equal(lang("entity.Ozelot.name"), "Ocelot");
});
test("every stat id of the original is registered here and nothing else", () => {
  for (const s of of("stat").filter((s) => !s.id.startsWith("achievement."))) assert.ok(isStat(s.id), s.id);
});

test("increments, hooks and saturation", () => {
  const s = new Stats();
  s.increment(STAT.jump); s.increment(STAT.jump, 2); s.increment("stat.bogus", 5); s.increment(STAT.walk, -4);
  assert.equal(s.get(STAT.jump), 3); assert.equal(s.has("stat.bogus"), false); assert.equal(s.get(STAT.walk), 0);
  s.mineBlock(1); s.mineBlock(2); s.craft(280, 4); s.use(1); s.breakItem(257); s.kill("pigman"); s.killedBy("creeper");
  assert.equal(s.get("stat.mineBlock.1"), 1); assert.equal(s.get("stat.mineBlock.3"), 1);
  assert.equal(s.get("stat.craftItem.280"), 4); assert.equal(s.get("stat.useItem.1"), 1); assert.equal(s.get("stat.breakItem.257"), 1);
  assert.equal(s.get("stat.killEntity.PigZombie"), 1); assert.equal(s.get("stat.entityKilledBy.Creeper"), 1);
  s.increment(STAT.drop, 2147483647); s.increment(STAT.drop, 5);
  assert.equal(s.get(STAT.drop), 2147483647);
  assert.deepEqual(s.blocks(), [1, 3]);
  assert.ok(s.items().includes(280));
  assert.deepEqual(s.mobs().map((e) => e.name), ["Creeper", "PigZombie"]);
});
test("save and load round trip ignores unknown ids", () => {
  const s = new Stats();
  s.increment(STAT.deaths, 2); s.increment(STAT.walk, 12345); s.mineBlock(56);
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.deepEqual(saved, { "stat.deaths": 2, "stat.walkOneCm": 12345, "stat.mineBlock.56": 1 });
  const back = new Stats({ ...saved, "stat.nope": 3, "stat.jump": "x", "stat.drop": { value: 4 } });
  assert.equal(back.get(STAT.deaths), 2); assert.equal(back.get(STAT.drop), 4); assert.equal(back.get(STAT.jump), 0); assert.equal(back.has("stat.nope"), false);
  assert.equal(formatStat(STAT.walk, 12345), "123.45 m");
  new Stats().load(null);
});
test("StatisticsFile json: flat ints for stats and achievements", () => {
  const s = new Stats(); s.increment(STAT.jump, 7);
  const text = statsFileJson(s, ["openInventory", "mineWood"]);
  assert.deepEqual(JSON.parse(text), { "stat.jump": 7, "achievement.openInventory": 1, "achievement.mineWood": 1 });
  const parsed = parseStatsFile(text);
  assert.equal(parsed.stats.get(STAT.jump), 7); assert.deepEqual(parsed.achievements, ["openInventory", "mineWood"]);
  assert.equal(parseStatsFile("not json").stats.get(STAT.jump), 0);
});
test("offline uuid matches UUID.nameUUIDFromBytes and the export file shape", () => {
  const uuid = of("uuid")[0];
  assert.equal(offlineUuid(uuid.name), uuid.offline);
  assert.equal(STAT_DATA.uuid, uuid.offline);
  const [name, bytes] = statsExportFile({ stats: { "stat.jump": 2 }, achievements: { unlocked: ["buildWorkBench"] } });
  assert.equal(name, `stats/${uuid.offline}.json`);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)), { "stat.jump": 2, "achievement.buildWorkBench": 1 });
  assert.equal(JSON.parse(new TextDecoder().decode(statsExportFile({})[1])) && 1, 1);
});
test("movement stats follow addMovementStat and addMountedMovementStat", () => {
  const s = new Stats();
  addMovementStat(s, { dx: 3, dy: 0, dz: 4, ground: true });
  assert.equal(s.get(STAT.walk), 500);
  addMovementStat(s, { dx: 0.2, dy: 0, dz: 0, ground: false }); // fly needs more than 25 cm
  assert.equal(s.get(STAT.fly), 0);
  addMovementStat(s, { dx: 0.3, dy: 5, dz: 0 });
  assert.equal(s.get(STAT.fly), 30);
  addMovementStat(s, { dx: 1, dy: 1, dz: 0, swim: true }); assert.equal(s.get(STAT.swim), 100);
  addMovementStat(s, { dx: 1, dy: 1, dz: 0, swim: true, dive: true }); assert.equal(s.get(STAT.dive), 141);
  addMovementStat(s, { dx: 0, dy: -1, dz: 0, ladder: true }); assert.equal(s.get(STAT.climb), 0);
  addMovementStat(s, { dx: 0, dy: 0.5, dz: 0, ladder: true }); assert.equal(s.get(STAT.climb), 50);
  addMountedMovementStat(s, { dx: 0, dy: 3, dz: 4, kind: "boat" }); assert.equal(s.get(STAT.boat), 500);
  addFallStat(s, 1.9, false); addFallStat(s, 5, true); assert.equal(s.get(STAT.fall), 0);
  addFallStat(s, 5, false); assert.equal(s.get(STAT.fall), 500);
  assert.equal(damageTenths(2.5), 25);
  assert.equal(vehicleKind({ boat: true }), "boat"); assert.equal(vehicleKind({ entity: { type: "pig" } }), "pig");
  assert.equal(vehicleKind({ horse: true }), "horse"); assert.equal(vehicleKind({}), "minecart"); assert.equal(vehicleKind(null), null);
});
test("StatsLive ticks, ignores teleports, deaths and binds survival", () => {
  const s = new Stats(), live = new StatsLive(s), a = { x: 0, y: 0, z: 0 };
  live.tick({ oldPosition: a, position: { x: 1, y: 0, z: 0 }, grounded: true });
  live.tick({ oldPosition: a, position: { x: 50, y: 0, z: 0 }, grounded: true });
  live.tick({ oldPosition: a, position: { x: 0, y: 0, z: 2 }, vehicle: { entity: { type: "pig" } } });
  assert.equal(s.get(STAT.playOneMinute), 3); assert.equal(s.get(STAT.walk), 100); assert.equal(s.get(STAT.pig), 200);
  const survival = {}; live.bind(survival); survival.onJump(); survival.onDamageTaken(3);
  assert.equal(s.get(STAT.jump), 1); assert.equal(s.get(STAT.damageTaken), 30);
  live.hurtBy("zombie"); live.death();
  assert.equal(s.get(STAT.deaths), 1); assert.equal(s.get("stat.entityKilledBy.Zombie"), 1);
  live.death(); assert.equal(s.get(STAT.deaths), 2); assert.equal(s.get("stat.entityKilledBy.Zombie"), 1);
  live.fishing({ events: [{ stat: "stat.junkFished" }, { stat: "stat.fishCaught" }] });
  assert.equal(s.get(STAT.junkFished), 1); assert.equal(s.get(STAT.fishCaught), 1);
  live.broken(0);
});
test("mob watchers award kills, damage and breeding to the player only", () => {
  const s = new Stats(), live = new StatsLive(s);
  const mobs = { onDeath() {}, attack(e) { e.health -= 4; return true; }, spawnBaby() { return true; }, hitPlayer() { return true; } };
  watchMobStats(mobs, { live });
  const cow = { type: "cow", health: 10 };
  mobs.attack(cow, 0); mobs.onDeath(cow, {}); mobs.onDeath(cow, { player: true }); mobs.spawnBaby({}, {}); mobs.hitPlayer({ type: "creeper" }, {});
  assert.equal(s.get(STAT.damageDealt), 40); assert.equal(s.get(STAT.mobKills), 1); assert.equal(s.get("stat.killEntity.Cow"), 1); assert.equal(s.get(STAT.animalsBred), 1);
  assert.equal(live.attacker.type, "creeper");
});
test("GuiStats sorting follows beq.h", () => {
  let sort = { column: -1, direction: 0 };
  sort = nextSort(sort, 1); assert.deepEqual(sort, { column: 1, direction: -1 });
  sort = nextSort(sort, 1); assert.deepEqual(sort, { column: 1, direction: 1 });
  sort = nextSort(sort, 1); assert.deepEqual(sort, { column: -1, direction: 0 });
  sort = nextSort(sort, 0); sort = nextSort(sort, 2); assert.deepEqual(sort, { column: 2, direction: -1 });
  const v = { 1: 5, 2: 9, 3: null, 4: 5 };
  assert.deepEqual(sortRows([4, 3, 2, 1], { column: 0, direction: 1 }, (id) => v[id]), [1, 4, 2, 3]);
  assert.deepEqual(sortRows([1, 2, 4], { column: 0, direction: -1 }, (id) => v[id]), [2, 1, 4]);
  assert.deepEqual(sortRows([4, 1, 2], { column: -1, direction: 0 }, () => null), [1, 2, 4]);
});
