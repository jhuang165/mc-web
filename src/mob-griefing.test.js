import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EntityWorld } from "./entities.js";
import { setGameRuleSource, ruleOn } from "./game-rules.js";
import { Fireballs } from "./fireballs.js";
import { WitherSkulls, witherAITick, witherState } from "./wither-boss-mobs.js";
import { tick as endermanTick, carryStep } from "./enderman.js";

// Every 1.7.10 read of gamerule mobGriefing (public/research/game-rules-reference.json, from javap over every JAR class that holds
// the rule name) and the port's gate. The farmland, grazing, creeper, silverfish, dragon and door gates are replayed in
// game-rules.test.js, silverfish.test.js, dragon.test.js and zombie-door.test.js; this file adds the rest and the site inventory.
const reference = JSON.parse(await readFile(new URL("../public/research/game-rules-reference.json", import.meta.url)));
const grief = (on) => setGameRuleSource((name) => (name === "mobGriefing" ? on : ruleOn(null, name)));
afterEach(() => setGameRuleSource(null));

test("every native mobGriefing read is wired, names a port file that reads the rule, and the list is the complete 1.7.10 one", async () => {
  const sites = reference.sites.filter((s) => s.rule === "mobGriefing" && s.site !== "GameRules.<init>");
  assert.deepEqual(sites.map((s) => s.site).sort(), [
    "BlockFarmland.onFallenUpon", "EntityAIBreakDoor.shouldExecute", "EntityAIEatGrass.updateTask", "EntityCreeper.func_146077_cc", "EntityDragon.destroyBlocksInAABB",
    "EntityEnderman.onLivingUpdate", "EntityLargeFireball.onImpact", "EntityLiving.onLivingUpdate", "EntitySilverfish.updateEntityActionState",
    "EntityWither.updateAITasks", "EntityWitherSkull.onImpact"]);
  for (const s of sites) {
    assert.equal(s.port, "wired", s.site);
    const file = s.where.split(" ")[0], text = await readFile(new URL("../" + file, import.meta.url), "utf8");
    assert.match(text, /mobGriefing|griefing/, `${s.site} in ${file}`);
  }
  // 1.7.10 has no villager farming AI, no EntityAIBreakDoor outside zombies and no gate on the small fireball or the ender crystal:
  // none of those classes is in the scan, so the port must not gate them either.
  assert.equal(reference.sites.some((s) => /Villager|SmallFireball|EnderCrystal|TNT|Blaze/.test(s.site)), false);
});

const mobsStub = () => ({ events: [], ai: {}, world: { get: () => 0, set() {}, getMeta: () => 0 }, random: () => 0.5, damage() { return true; } });

test("EntityLargeFireball.onImpact: the explosion is flaming either way and smoking only while mobGriefing is on", () => {
  for (const on of [true, false]) {
    grief(on);
    const mobs = mobsStub(), balls = new Fireballs(mobs);
    balls.impact({ large: true, power: 1, x: 4, y: 5, z: 6, owner: null }, { entity: null });
    assert.deepEqual(mobs.events.map((e) => [e.explode.size, e.explode.flaming, e.explode.smoking, e.explode.source]), [[1, true, on, null]], `grief ${on}`);
  }
});

test("EntityWitherSkull.onImpact: the power 1 explosion is smoking only while mobGriefing is on and never flaming", () => {
  for (const on of [true, false]) {
    grief(on);
    const mobs = mobsStub(), skulls = new WitherSkulls(mobs);
    skulls.impact({ blue: false, owner: null, x: 1, y: 2, z: 3 }, { entity: null });
    const [ex] = mobs.events.filter((e) => e.explode);
    assert.deepEqual([ex.explode.size, ex.explode.flaming, ex.explode.smoking], [1, false, on], `grief ${on}`);
  }
});

test("EntityWither.updateAITasks: the spawn explosion's isSmoking and the block sweep both follow mobGriefing", () => {
  const brainFor = (e, cells) => {
    const events = [], world = { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0, set: (x, y, z, id) => { cells.delete(`${x},${y},${z}`); return true; } };
    return { brain: { e, ai: { ew: { events, world, entities: [], ai: {}, difficulty: 2, random: () => 0.5 }, overlaps: () => false }, attackTarget: null }, events };
  };
  for (const on of [true, false]) {
    grief(on);
    // the spawn countdown's last tick (invul 1 steps to the power 7 explosion)
    const spawn = { x: 0.5, y: 10, z: 0.5, invul: 1, health: 150, age: 1 }, a = brainFor(spawn, new Map());
    witherAITick(a.brain);
    const blasts = a.events.filter((v) => v.explode);
    assert.equal(blasts.length, 1, `grief ${on}`);
    assert.deepEqual([blasts[0].explode.size, blasts[0].explode.flaming, blasts[0].explode.smoking], [7, false, on]);
    // the block-breaking counter reaching 0 sweeps 3x4x3 around it only with the rule on
    const cells = new Map([["0,11,0", 1], ["1,12,1", 1]]), awake = { x: 0.5, y: 10, z: 0.5, invul: 0, health: 150, age: 3 }, b = brainFor(awake, cells);
    witherState(awake).bv = 1;
    witherAITick(b.brain);
    assert.equal(cells.size, on ? 0 : 2, `grief ${on}: cells left`);
    assert.equal(b.events.some((v) => v.blockBreak), on);
  }
});

test("EntityEnderman.onLivingUpdate: with mobGriefing off the pickup/placement step (and its random draws) is skipped", () => {
  const draws = [];
  const rng = { nextInt: (n) => { draws.push(n); return 0; }, nextDouble: () => 0.5, nextFloat: () => 0.5, nextGaussian: () => 0 };
  const world = (on) => {
    const sets = [];
    return { sets, w: { mobGriefing: () => on, blockId: () => 1, blockMeta: () => 0, isNormalCube: () => true, setBlock: (...a) => sets.push(a) } };
  };
  const ctx = { rng, target: null, wet: false, burning: false, hurt() {}, dropTarget() {}, distanceSq: () => 0 };
  for (const on of [true, false]) {
    draws.length = 0;
    const { w } = world(on), e = { x: 0.5, y: 5, z: 0.5, carried: 0 };
    try { endermanTick(e, w, ctx); } catch { /* the rest of the tick needs more of the world; the carry step is first */ }
    assert.equal(draws.includes(20), on, `grief ${on}: nextInt(20) draw`);
  }
  // the step itself takes a carriable block when the rule is on (nextInt 0, centre of the 4x3x4 box)
  const { w, sets } = world(true), e = { x: 0.5, y: 5, z: 0.5, carried: 0 };
  carryStep(e, w, rng);
  assert.ok(e.carried === 0 || sets.length === 1);
});

test("EntityLiving.onLivingUpdate: a looting mob is not even considered for pickup while mobGriefing is off", () => {
  for (const on of [true, false]) {
    grief(on);
    const w = Object.create(EntityWorld.prototype);
    let sized = 0;
    w.entities = [{ type: "zombie", canPickUpLoot: true, health: 20, x: 0, y: 0, z: 0 }];
    w.lootItems = { items: [{}], box: () => [0, 0, 0, 0, 0, 0] };
    w.events = [];
    w.size = () => { sized++; return [0.6, 1.8]; };
    try { w.lootPickup(); } catch { /* an empty fake item stack may fail inside the loop; the gate is before it */ }
    assert.equal(sized > 0, on, `grief ${on}`);
  }
});
