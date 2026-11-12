import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { newOrb } from "./experience.js";
import { primeTnt } from "./explosion.js";
import { orderGroups, stampSavedOrder, restoreSavedOrder } from "./saved-order.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// Batch 52 (b52so): the order of World.loadedEntityList after a save and reload (public/research/saved-order-reference.json, executed SavedOrderProbe: the real
// AnvilChunkLoader entity writer and reader and Chunk.onChunkLoad). The entities join in spec order, the away run saves them (finish() stamps each record with its place
// in the native save walk) and a second run loads the records; the walk order of that second run is compared with the probe's loadedEntityList.
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order-reference.json", import.meta.url))).cases;
const STONE = 3;

const run = (entities) => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64 });
};
const walkOrder = (ents, chunks) => ents.mobs.withBalls(ents.mobs.entities.slice()).map((e) => {
  const c = chunks.find((k) => Math.floor(e.x / 16) === k[0] && Math.floor(e.z / 16) === k[1]);
  return Math.round((e.x - c[0] * 16 - 1) / 0.5);
});

function joinAll(ents, c) {
  const { items, xp, arrows, mobs, primed } = ents;
  c.specs.forEach(([kind, y, chunk], i) => {
    const x = c.chunks[chunk][0] * 16 + 1 + 0.5 * i, z = c.chunks[chunk][1] * 16 + 8.5;
    if (kind === "item") items.spawn({ id: STONE, count: 3, damage: 0 }, x, y, z, { motion: [0, 0, 0] });
    else if (kind === "orb") { const o = newOrb(5, x, y, z, () => 0); xp.orbs.push(o); xp.joined(o); }
    else if (kind === "arrow") { const a = arrows.make({ x, y, z, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, arrows.rng(), {}); arrows.list.push(a); arrows.joined(a); }
    else if (kind === "tnt") primed.push(Object.assign(primeTnt(x, y, z, { fuse: 80, random: () => 0 }), { x, y, z }));
    else if (kind === "cow") { const cow = mobs.create("cow", x, y, z); Object.assign(cow, { x, y, z }); mobs.entities.push(cow); }
    else throw new Error(kind);
  });
}

for (const c of reference) {
  test(`saved order ${c.name}`, () => {
    const first = run({});
    joinAll(first, c);
    assert.deepEqual(walkOrder(first, c.chunks), c.before, "the world order before the save is the join order");
    const saved = first.finish();
    const second = run(saved);
    assert.deepEqual(walkOrder(second, c.chunks), c.after);
  });
}

test("without the stamps the loaded order stays the walk-kind order of the old saves (the probe orders differ)", () => {
  const c = reference.find((r) => r.name === "b52so-one-chunk-mixed");
  const first = run({});
  joinAll(first, c);
  const saved = first.finish();
  const strip = (v) => { if (Array.isArray(v)) v.forEach(strip); else if (v && typeof v === "object") { delete v.ord; Object.values(v).forEach(strip); } };
  strip(saved);
  assert.notDeepEqual(walkOrder(run(saved), c.chunks), c.after);
});

test("restoring leaves unstamped entities after the stamped ones and removes the stamp from a mob's own fields", () => {
  const c = reference.find((r) => r.name === "b52so-one-chunk-mixed");
  const first = run({});
  joinAll(first, c);
  const saved = first.finish();
  assert.ok(saved.mobs.every((m) => Number.isInteger(m.ord)));
  const second = run(saved);
  assert.ok(second.mobs.entities.every((m) => !("ord" in m)));
  const extra = second.items.spawn({ id: STONE, count: 1, damage: 0 }, 1, 1, 8.5, { motion: [0, 0, 0] });
  const order = second.mobs.withBalls(second.mobs.entities.slice());
  assert.equal(order.at(-1), extra, "a new entity joins the end of the loaded list");
});

test("a group whose records do not match its entities one to one is left alone", () => {
  const items = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], records = [{ ord: 1 }];
  const mobs = { walks: new Map([["item", { list: () => items }]]), entities: [], withBalls: () => {}, orderSeqs: new WeakMap() };
  assert.deepEqual(orderGroups({ mobs, items: { items } }, { drops: records }), []);
  stampSavedOrder(mobs, []);
  restoreSavedOrder(mobs, []);
  assert.equal(records[0].ord, 1);
});
