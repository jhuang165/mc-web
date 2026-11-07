import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gameRule, setGameRuleSource, ruleOn, DEFAULT_RULES } from "./game-rules.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { Farming } from "./farming.js";
import { explodeBlocks } from "./explosion.js";
import { applyExplosion } from "./explosion-simulation.js";
import { JavaRandom } from "./lighting.js";

const reference = JSON.parse(await readFile(new URL("../public/research/game-rules-reference.json", import.meta.url)));
const off = (...names) => setGameRuleSource((name) => !names.includes(name) && ruleOn(null, name));
afterEach(() => setGameRuleSource(null));

test("every native GameRules read is accounted for, and each wired site names a port file", async () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(reference.rules, Object.keys(DEFAULT_RULES).sort());
  assert.equal(reference.sites.length, 40);
  assert.equal(reference.sites.filter((s) => s.port === "unknown").length, 0);
  for (const rule of reference.rules) assert.ok(reference.sites.some((s) => s.rule === rule && s.site === "GameRules.<init>"), rule);
  for (const s of reference.sites.filter((s) => s.port === "wired")) {
    const file = s.where.split(" ")[0], text = await readFile(new URL("../" + (file.startsWith("src/") ? file : "src/" + file), import.meta.url), "utf8");
    assert.ok(text.length > 0, s.site);
  }
  const wired = (rule) => reference.sites.filter((s) => s.rule === rule && s.port === "wired").map((s) => s.site).sort();
  assert.deepEqual(wired("doFireTick"), ["BlockFire.updateTick", "EntityLightningBolt.<init>", "EntityLightningBolt.onUpdate"]);
  assert.deepEqual(wired("doMobLoot"), ["EntityAIMate.spawnBaby", "EntityLivingBase.onDeath", "EntityLivingBase.onDeathUpdate"]);
  assert.deepEqual(wired("doMobSpawning"), ["WorldServer.tick"]);
  assert.deepEqual(wired("mobGriefing"), ["BlockFarmland.onFallenUpon", "EntityAIBreakDoor.shouldExecute", "EntityAIEatGrass.updateTask", "EntityCreeper.func_146077_cc", "EntityDragon.destroyBlocksInAABB", "EntityEnderman.onLivingUpdate", "EntityLargeFireball.onImpact", "EntityLiving.onLivingUpdate", "EntitySilverfish.updateEntityActionState", "EntityWither.updateAITasks", "EntityWitherSkull.onImpact"]);
});

test("the rule source follows the world record and falls back to the 1.7.10 defaults", () => {
  assert.equal(gameRule("mobGriefing"), true);
  assert.equal(gameRule("keepInventory"), false);
  const record = { gameRules: { ...DEFAULT_RULES, mobGriefing: "false" } };
  setGameRuleSource((name) => ruleOn(record, name));
  assert.equal(gameRule("mobGriefing"), false);
  record.gameRules = { ...record.gameRules, mobGriefing: "TRUE" }; // Boolean.parseBoolean ignores case
  assert.equal(gameRule("mobGriefing"), true);
  record.gameRules.mobGriefing = "yes";
  assert.equal(gameRule("mobGriefing"), false);
});

const flat = { numericSeed: 123, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64, y: 0, z: 64 }), inside: () => true };

test("doMobLoot off: no death drops, no death experience, no breeding experience", () => {
  for (const loot of [true, false]) {
    if (!loot) off("doMobLoot"); else setGameRuleSource(null);
    const w = new EntityWorld(flat, []), cow = w.create("cow", 64, 0, 64);
    cow.recentlyHit = 100;
    w.onDeath(cow, { player: true });
    for (let i = 0; i < 20; i++) w.deathUpdate(cow, { width: 0.9, height: 1.3 });
    const a = w.create("cow", 64, 0, 64), b = w.create("cow", 65, 0, 64);
    w.entities.push(a, b);
    assert.equal(w.spawnBaby(a, b), true, "the baby is born either way");
    const events = w.drain();
    assert.equal(events.some((e) => e.drop), loot, "drops " + loot);
    assert.equal(events.filter((e) => e.xp).length, loot ? 2 : 0, "death and breeding experience " + loot);
  }
});

test("mobGriefing off: a grazing sheep keeps the grass but still regrows its fleece", () => {
  off("mobGriefing");
  // Internal block 1 under the sheep is grass, as EntityWorld.eatGrass reads it.
  const edits = [], world = { ...flat, get: (x, y, z) => (y === -1 ? 1 : 0), set: (...a) => edits.push(a) };
  const w = new EntityWorld(world, []), sheep = w.create("sheep", 64.5, 0, 64.5);
  sheep.sheared = true;
  sheep.growingAge = -2000;
  w.eatGrass(sheep);
  assert.deepEqual(edits, []);
  assert.equal(w.drain().filter((e) => e.eatGrass).length, 0);
  assert.equal(sheep.sheared, false);
  assert.equal(sheep.growingAge, -800);
  setGameRuleSource(null);
  w.eatGrass(sheep);
  assert.deepEqual(edits, [[64, -1, 64, 2]]);
});

test("doMobSpawning off: the night spawn pass makes no monsters", () => {
  for (const spawning of [true, false]) {
    if (!spawning) off("doMobSpawning"); else setGameRuleSource(null);
    const w = new EntityWorld({ ...flat, streaming: false }, []), s = new Survival();
    w.naturalSpawning = true;
    w.worldRandom = new JavaRandom(7);
    s.time = 18000;
    w.isDaytime = () => false;
    const player = { x: 64, y: 0, z: 64, alive: true };
    for (let i = 0; i < 260; i++) { s.time = 18000; w.tick(player, s); }
    const hostile = w.entities.filter((e) => ["zombie", "skeleton", "spider", "creeper", "witch"].includes(e.type)).length;
    if (spawning) assert.ok(hostile > 0, "monsters spawn with the rule on");
    else assert.equal(hostile, 0);
  }
});

test("mobGriefing: farmland rolls first, then only the player may trample it", () => {
  const cells = new Map([["5,5,5", 29]]), world = { edits: new Map(), get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, set: (x, y, z, b) => (cells.set(`${x},${y},${z}`, b), true) };
  const farming = new Farming(world);
  let rolls = 0;
  const roll = () => (rolls++, 0);
  assert.equal(farming.trample(5, 5, 5, 3, roll, false), false, "a mob without mobGriefing");
  assert.equal(rolls, 1, "the nextFloat roll still happens");
  assert.equal(cells.get("5,5,5"), 29);
  assert.equal(farming.trample(5, 5, 5, 3, roll, true), true, "a player (or mobGriefing on)");
  assert.equal(cells.get("5,5,5"), 2);
});

test("a creeper blast without mobGriefing hurts but breaks nothing, after the same random draws", () => {
  const blocks = new Map([["2,10,0", 1], ["3,10,0", 4]]);
  const world = { height: 256, get: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0, solid: (x, y, z) => blocks.has(`${x},${y},${z}`), set: (x, y, z, id) => (id ? blocks.set(`${x},${y},${z}`, id) : blocks.delete(`${x},${y},${z}`), true) };
  const a = new JavaRandom(9), b = new JavaRandom(9);
  const on = explodeBlocks(world, 0.5, 10, 0.5, 3, a), quiet = explodeBlocks(world, 0.5, 10, 0.5, 3, b, { smoking: false });
  assert.ok(on.broken.length > 0);
  assert.equal(quiet.broken.length, 0);
  assert.deepEqual(quiet.list, on.list, "doExplosionA's rays are the same");
  assert.equal(quiet.pitch, on.pitch);
  const hits = [], bursts = [];
  const noop = { explode() {}, spill() {}, spawn() {}, dropBlock() {} };
  applyExplosion({
    world, random: new JavaRandom(9), mobs: { entities: [{ type: "pig", x: 1.5, y: 10, z: 0.5, vx: 0, vy: 0, vz: 0, growingAge: 0 }], damage() {}, hazard: (e, d) => hits.push(d) },
    items: noop, xpOrbs: noop, arrows: noop, projectiles: noop, primed: [], farming: { observe() {} },
    survival: { health: 0, furnaces: {}, chests: {} }, position: { x: 50, y: 10, z: 50 }, velocity: { x: 0, y: 0, z: 0 },
  }, { x: 0.5, y: 10, z: 0.5, size: 3, smoking: false }, { burst: (...args) => bursts.push(args[4]) });
  assert.equal(blocks.size, 2, "no block broke");
  assert.ok(hits.length === 1 && hits[0] > 0, "the pig is still hurt");
  assert.deepEqual(bursts, [[]], "the client gets an empty affected-block list");
});
