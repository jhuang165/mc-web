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
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// Batch 54 (b54so, public/research/saved-order3-reference.json, executed SavedOrderProbe scenario3): the chunk/section check runs per entity right after its own update, and a mount
// that carries the player is spawned after the chunks (read back from the player's Riding compound), so it is last in loadedEntityList. Same harness as saved-order2-b53.test.js.
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order3-reference.json", import.meta.url))).cases;
const STONE = 3;

const run = (entities) => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64 });
};
const walkOrder = (ents) => { const w = ents.mobs.withBalls(ents.mobs.entities.slice()), s = ents.mobs.orderSeqs; return w.slice().sort((a, b) => s.get(a) - s.get(b)); };
const indexOf = (ents, chunks) => walkOrder(ents).map((e) => {
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
  return made;
}

// One pass: the list is walked by index; an entity applies its own moves and is checked right after (World.updateEntities); a pusher's move lands after the pusher's check.
function pass(ents, made, tick) {
  for (const e of ents.mobs.withBalls(ents.mobs.entities.slice())) {
    const me = made.indexOf(e);
    for (const [i, y, dcx, by] of tick) if (i === me && by < 0) Object.assign(e, { x: e.x + 16 * dcx, [e.posY !== undefined ? "posY" : "y"]: y });
    trackSections(ents.mobs, [e]);
    for (const [i, y, dcx, by] of tick) if (by === me) Object.assign(made[i], { x: made[i].x + 16 * dcx, [made[i].posY !== undefined ? "posY" : "y"]: y });
  }
}

for (const c of reference) {
  test(`saved order 3 ${c.name}`, () => {
    const first = run({});
    const made = joinAll(first, c);
    trackSections(first.mobs, first.mobs.withBalls(first.mobs.entities.slice()), true);
    for (const tick of c.ticks) pass(first, made, tick);
    if (c.playerCart >= 0) made[c.playerCart].rider = { player: true, dead: false }; // the local player sits in this mount (minecarts.js `rider`)
    const saved = first.finish();
    const second = run(saved);
    assert.deepEqual(indexOf(second, c.chunks), c.after);
  });
}

test("a move another entity gives after an entity's own turn is refiled one pass later (tickMobs checks per entity)", () => {
  const w = run({});
  const { items } = w;
  items.spawn({ id: STONE, count: 1, damage: 0 }, 8.5, 70, 8.5, { motion: [0, 0, 0] });
  items.spawn({ id: STONE, count: 1, damage: 0 }, 9.5, 70, 8.5, { motion: [0, 0, 0] });
  const [a] = items.items;
  w.tick();
  w.mobs.lateEntity = { lateHook: () => { a.y = 20; a.posY = 20; } }; // moved after its own turn and the check that follows it
  w.tick();
  assert.ok(!w.mobs.sectionSeqs?.has(a), "not refiled in the pass that moved it");
  w.mobs.lateEntity = null;
  w.tick();
  assert.ok(w.mobs.sectionSeqs.has(a), "refiled at its next turn");
});

test("a mob saved above y 256 is restored by the away run and filed in the top section", () => {
  for (const y of [255, 256, 300]) {
    const first = run({});
    const c = first.mobs.create("cow", 8.5, y, 8.5);
    Object.assign(c, { x: 8.5, y, posY: y, z: 8.5 });
    first.mobs.entities.push(c);
    const second = run(first.finish());
    assert.equal(second.mobs.entities.length, 1, `y ${y}`);
    assert.equal(second.mobs.entities[0].y, y);
  }
});

test("a despawned mob keeps the health it had (removedHealth, as the cure and the shear do)", () => {
  const w = new EntityWorld(plain([]));
  const cow = w.create("cow", 0.5, 70, 0.5);
  cow.health = 6;
  w.ai.despawn(cow);
  assert.equal(cow.health, 0);
  assert.equal(cow.removedHealth, 6);
  assert.equal(cow.despawnedHealth, 6);
});
