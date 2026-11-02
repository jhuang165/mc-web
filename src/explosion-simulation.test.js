import { test } from "node:test";
import assert from "node:assert/strict";
import { applyExplosion } from "./explosion-simulation.js";
import { JavaRandom } from "./lighting.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Projectiles } from "./projectiles.js";
import { Arrows } from "./bow.js";
import { TNT } from "./world.js";

const key = (x, y, z) => `${x},${y},${z}`;
function arena(initial = {}, calls = []) {
  const blocks = new Map(Object.entries(initial));
  return {
    blocks, calls, height: 256,
    get(x, y, z) { return blocks.get(key(x, y, z)) || 0; },
    getMeta() { return 0; },
    solid(x, y, z) { return this.get(x, y, z) !== 0; },
    set(x, y, z, id) { calls.push(["set", x, y, z, id]); if (id) blocks.set(key(x, y, z), id); else blocks.delete(key(x, y, z)); return true; },
  };
}
const random = (seed) => new JavaRandom(seed);

test("explosion applies all entity hits before burst/sound and ordered block/container/drop mutations", () => {
  const calls = [], world = arena({ [key(2, 10, 0)]: 1, [key(2, 10, 1)]: TNT }, calls),
    itemRandom = () => 0.5;
  class TracedItems extends ItemEntities {
    explode(...args) { calls.push("items.explode"); return super.explode(...args); }
    spill(...args) { calls.push("spill"); return super.spill(...args); }
    spawn(...args) { calls.push("item.spawn"); return super.spawn(...args); }
  }
  class TracedOrbs extends ExperienceOrbs {
    explode(...args) { calls.push("orbs.explode"); return super.explode(...args); }
    spawn(...args) { calls.push("xp.spawn"); return super.spawn(...args); }
  }
  class TracedProjectiles extends Projectiles {
    explode(...args) { calls.push("projectiles.explode"); return super.explode(...args); }
  }
  class TracedArrows extends Arrows {
    explode(...args) { calls.push("arrows.explode"); return super.explode(...args); }
  }
  const items = new TracedItems(itemRandom), xpOrbs = new TracedOrbs([], itemRandom),
    projectiles = new TracedProjectiles(itemRandom), arrows = new TracedArrows(itemRandom),
    mob = { type: "pig", x: 1, y: 10, z: 0.5, vx: 0, vy: 0, vz: 0, growingAge: 0, health: 20 },
    mobs = {
      entities: [mob],
      damage(e, damage, x, z, fromPlayer, source) { calls.push("mob.damage"); return true; },
      hazard(e, damage, source) { calls.push("mob.hazard"); },
    },
    position = { x: 0.5, y: 10, z: 0.5 }, velocity = { x: 0, y: 0, z: 0 },
    survival = {
      health: 20, creative: false, furnaces: {},
      chests: { [key(2, 10, 0)]: { items: [{ id: 3, count: 2, damage: 0 }] } },
      scaledDamage(damage, source) { calls.push("player.damage"); return true; },
    };
  // The additional TNT and a chest share the affected area so the mutation tail
  // covers both ordered spills and the native chained-fuse result.
  survival.furnaces[key(2, 10, 0)] = { items: [{ id: 4, count: 1, damage: 0 }] };
  const out = applyExplosion({
    world, random: random(123), mobs, items, xpOrbs, arrows, projectiles,
    falling: { explode: () => { calls.push("falling.explode"); } },
    primed: [], survival, position, velocity,
    farming: { observe(x, y, z) { calls.push("farm.observe"); } },
  }, { x: 0.5, y: 10.5, z: 0.5, size: 4 }, {
    brokenTool() { calls.push("brokenTool"); },
    burst() { calls.push("burst"); },
    sound(name) { assert.equal(name, "random.explode"); calls.push("sound"); },
    updateBlocks(changes) { calls.push(["updateBlocks", changes]); },
    syncChests() { calls.push("syncChests"); },
    renderVitals() { calls.push("renderVitals"); },
    markDirty() { calls.push("markDirty"); },
  });
  const firstSet = calls.findIndex((c) => Array.isArray(c) && c[0] === "set");
  assert.ok(out.mobHits.some((hit) => hit.entity === mob));
  assert.ok(out.playerHit);
  assert.ok(firstSet >= 0, "at least one block from the real explosion rays broke");
  assert.ok(out.chainedTnt.length > 0, "destroyed TNT becomes a chained primed entity");
  assert.ok(out.changes.some(([x, y, z]) => x === 2 && y === 10 && z === 0), "fixture chest/furnace block is in the ordered edit list");
  assert.equal(survival.furnaces[key(2, 10, 0)], undefined);
  assert.equal(survival.chests[key(2, 10, 0)], undefined);
  assert.ok(calls.filter((c) => c === "spill").length >= 2, "furnace and chest contents spill after their block is removed");
  assert.ok(calls.indexOf("mob.damage") < calls.indexOf("items.explode"));
  assert.ok(calls.indexOf("items.explode") < calls.indexOf("arrows.explode"));
  assert.ok(calls.indexOf("arrows.explode") < calls.indexOf("player.damage"));
  assert.ok(calls.indexOf("player.damage") < calls.indexOf("brokenTool"));
  assert.ok(calls.indexOf("brokenTool") < calls.indexOf("burst"));
  assert.ok(calls.indexOf("burst") < calls.indexOf("sound"));
  assert.ok(calls.indexOf("sound") < calls.indexOf("farm.observe"));
  assert.ok(calls.indexOf("sound") < firstSet, "entity damage, burst and sound finish before the first block write");
  assert.ok(calls.indexOf("farm.observe") < calls.indexOf("syncChests"));
  assert.deepEqual(calls.slice(-4), [["updateBlocks", out.changes], "syncChests", "renderVitals", "markDirty"]);
  assert.ok(out.changes.length > 0);
});

test("Creative player receives explosion knockback without scaled damage or broken-tool callback", () => {
  const world = arena(), calls = [], position = { x: 0.5, y: 10, z: 0.5 }, velocity = { x: 0, y: 0, z: 0 },
    survival = { health: 20, creative: true, furnaces: {}, chests: {}, scaledDamage() { calls.push("damage"); return true; } };
  const result = applyExplosion({
    world, random: random(7), mobs: { entities: [] },
    items: { explode() {}, spill() {}, spawn() {} },
    xpOrbs: { explode() {}, spawn() {} }, arrows: { explode() {} }, projectiles: { explode() {} },
    primed: [], survival, position, velocity, farming: { observe() {} },
  }, { x: 0.5, y: 10.5, z: 0.5, size: 4 }, {
    brokenTool() { calls.push("brokenTool"); },
    burst() {}, sound() {}, updateBlocks() {}, syncChests() {}, renderVitals() {}, markDirty() {},
  });
  assert.ok(result.playerHit);
  assert.notDeepEqual(velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(calls, []);
});
