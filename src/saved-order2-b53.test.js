import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { newOrb } from "./experience.js";
import { primeTnt } from "./explosion.js";
import { mountEntity } from "./mob-riding.js";
import { trackSections } from "./saved-order.js";
import { EntityWorld } from "./entities.js";
import { SHEARS } from "./mooshroom.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// Batch 53 (b53so, public/research/saved-order2-reference.json, executed SavedOrderProbe scenario2): the order of World.loadedEntityList after a save and reload when entities
// changed section or chunk during their updates (the real World.updateEntityWithOptionalForce refiles them at the end of the new list) and when a mount is saved with its rider
// (one nested record: the rider is written, the mount skipped, the loader adds the rider and then its mount). Same harness as saved-order-b52.test.js.
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order2-reference.json", import.meta.url))).cases;
const STONE = 3;

const run = (entities) => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64 });
};
// loadedEntityList order: every walked entity by its stamp (the update walk seats a rider right after its mount, which the list does not)
const walkOrder = (ents, chunks) => { const w = ents.mobs.withBalls(ents.mobs.entities.slice()), s = ents.mobs.orderSeqs; return w.slice().sort((a, b) => s.get(a) - s.get(b)); };
const indexOf = (ents, chunks) => walkOrder(ents, chunks).map((e) => {
  const c = chunks.find((k) => Math.floor(e.x / 16) === k[0] && Math.floor(e.z / 16) === k[1]);
  return Math.round((e.x - c[0] * 16 - 1) / 0.5);
});

function joinAll(ents, c) {
  const { items, xp, arrows, mobs, primed, minecarts } = ents, made = [];
  c.specs.forEach(([kind, y, chunk], i) => {
    const x = c.chunks[chunk][0] * 16 + 1 + 0.5 * i, z = c.chunks[chunk][1] * 16 + 8.5;
    let e;
    if (kind === "item") e = items.spawn({ id: STONE, count: 3, damage: 0 }, x, y, z, { motion: [0, 0, 0] });
    else if (kind === "orb") { e = newOrb(5, x, y, z, () => 0); xp.orbs.push(e); xp.joined(e); }
    else if (kind === "arrow") { e = arrows.make({ x, y, z, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, arrows.rng(), {}); arrows.list.push(e); arrows.joined(e); }
    else if (kind === "tnt") { e = Object.assign(primeTnt(x, y, z, { fuse: 80, random: () => 0 }), { x, y, z }); primed.push(e); }
    else if (kind === "cow") { e = mobs.create("cow", x, y, z); Object.assign(e, { x, y, z }); mobs.entities.push(e); }
    else if (kind === "cart") { e = minecarts.spawnCart(1, { x, y, z, items: [] }); Object.assign(e, { x, y, z }); }
    else throw new Error(kind);
    made.push(e);
  });
  c.specs.forEach((s, i) => { if (s[3] >= 0) { mountEntity(made[i], made[s[3]], () => 1); if (s[0] === "cow" && c.specs[s[3]][0] === "cart") made[s[3]].passenger = made[i]; } });
  return made;
}

// One pass of moves: the entities are set at their new places, then the end-of-pass check of the walk runs (what tickMobs does after the list walk).
function moveTick(ents, made, moves, chunks) {
  for (const [i, y, dcx] of moves) Object.assign(made[i], { x: made[i].x + 16 * dcx, [made[i].posY !== undefined ? "posY" : "y"]: y });
  trackSections(ents.mobs, ents.mobs.withBalls(ents.mobs.entities.slice()));
}

for (const c of reference) {
  test(`saved order 2 ${c.name}`, () => {
    const first = run({});
    const made = joinAll(first, c);
    trackSections(first.mobs, first.mobs.withBalls(first.mobs.entities.slice()), true);
    assert.deepEqual(indexOf(first, c.chunks), c.before, "the world order before the save is the join order");
    for (const moves of c.ticks) moveTick(first, made, moves, c.chunks);
    assert.deepEqual(indexOf(first, c.chunks), c.before, "moving between sections does not change loadedEntityList");
    const saved = first.finish();
    const second = run(saved);
    assert.deepEqual(indexOf(second, c.chunks), c.after);
  });
}

test("a pass of the real walk files an item that fell into the section below at the end of that list", () => {
  const first = run({});
  const { items } = first;
  const x = 8.5, z = 8.5;
  items.spawn({ id: STONE, count: 1, damage: 0 }, x, 64.15, z, { motion: [0, 0, 0] }); // the item's y is 0.125 lower: section 4, falls into section 3 in the pass
  items.spawn({ id: STONE, count: 1, damage: 0 }, x + 1, 63.5, z, { motion: [0, 0, 0] }); // section 3 already
  first.tick();
  const [a, b] = items.items;
  assert.ok(a.y < 64 && b.y < 64);
  const saved = first.finish();
  const second = run(saved);
  assert.deepEqual(second.mobs.withBalls([]).map((e) => Math.round(e.x - 8.5)), [1, 0], "the item that came from above is after the one that was already there");
});

test("an entity at the very top or bottom is refiled every pass, a moved one in a section that did not change is not", () => {
  const mobs = { walks: new Map([["item", {}]]), orderCount: 0, orderStamp() { return ++this.orderCount; } };
  const a = { x: 1, y: 300, z: 1 }, b = { x: 2, y: 5, z: 1 }, c = { x: 3, y: -5, z: 1 };
  const order = [a, b, c];
  trackSections(mobs, order, true);
  trackSections(mobs, order);
  assert.ok(mobs.sectionSeqs.has(a) && mobs.sectionSeqs.has(c) && !mobs.sectionSeqs.has(b));
  const first = mobs.sectionSeqs.get(a);
  trackSections(mobs, order);
  assert.ok(mobs.sectionSeqs.get(a) > first && mobs.sectionSeqs.get(c) > mobs.sectionSeqs.get(a) - 1);
  b.y = 10;
  trackSections(mobs, order);
  assert.ok(!mobs.sectionSeqs.has(b));
});

test("fireballs and wither skulls are stamped and restored in the order of the world list", () => {
  const first = run({});
  const { mobs, items } = first;
  const spec = [["ball", 0], ["item", 1], ["skull", 2], ["item", 3], ["ball", 4]];
  for (const [kind, i] of spec) {
    const x = 1 + i * 0.5, z = 8.5;
    if (kind === "item") items.spawn({ id: STONE, count: 1, damage: 0 }, x, 70, z, { motion: [0, 0, 0] });
    else if (kind === "ball") mobs.fireballs.launch({ large: true, owner: null, x, y: 70, z, exact: [0, 0, 0.1] });
    else mobs.skulls.launch({ owner: null, x, y: 70, z, exact: [0, 0, 0.1] });
  }
  const walk = (w) => w.mobs.withBalls([]).map((e) => Math.round((e.x - 1) / 0.5));
  assert.deepEqual(walk(first), [0, 1, 2, 3, 4]);
  const saved = first.finish();
  assert.equal(saved.fireballs.length, 3);
  assert.ok(saved.fireballs.every((r) => Number.isInteger(r.ord)));
  assert.deepEqual(saved.fireballs.map((r) => r.ord).sort((a, b) => a - b).length, 3);
  const second = run(saved);
  assert.deepEqual(walk(second), [0, 1, 2, 3, 4], "the restored balls and skulls keep their places among the items");
});

test("a removed mooshroom and a cured zombie keep the health they had (removedHealth)", () => {
  const w = new EntityWorld(plain([]));
  const moo = w.create("mooshroom", 0.5, 70, 0.5), zom = w.create("zombie", 5.5, 70, 0.5);
  moo.health = 7; zom.health = 13;
  w.entities.push(moo, zom);
  w.mooshroomInteract(moo, { held: { id: SHEARS }, creative: true, wear() {} });
  assert.equal(moo.health, 0);
  assert.equal(moo.removedHealth, 7);
  w.cureZombie(zom);
  assert.equal(zom.health, 0);
  assert.equal(zom.removedHealth, 13);
});
