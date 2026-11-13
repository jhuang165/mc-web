import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { mountEntity, clearStaleRider, releaseSeats } from "./mob-riding.js";
import { orderGroups, stampSavedOrder, trackChunkLoads, nearSpawn } from "./saved-order.js";
import { FallingBlocks } from "./falling.js";
import { Boats } from "./boats.js";
import { newOrb } from "./experience.js";
import { primeTnt } from "./explosion.js";
import { SAND } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// Batch 59 (b59so, public/research/saved-order7-reference.json, executed SavedOrderLoginProbe): the player walks away and back; chunks ms.b queues are unloaded (ms.d, World.updateEntities removes
// their entities) and load again at the end on return, chunks near the spawn of an Overworld-like world stay. The taker of a boat that held a mob is let go at his own turn.
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order7-reference.json", import.meta.url))).cases;
const STONE = 3;

const run = () => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities: {}, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64, sound() {} });
};
const indexOfRecord = (r, chunks) => { const c = chunks.find((k) => Math.floor(r.x / 16) === k[0] && Math.floor(r.z / 16) === k[1]); return Math.round((r.x - c[0] * 16 - 1) / 0.5); };

for (const c of reference) {
  test(`a chunk the player left and re-entered ranks by its new load (executed ${c.name})`, () => {
    const ents = run(), { items, xp, mobs } = ents, falling = new FallingBlocks(plain([]), {}, []);
    ents.attachFalling(falling, []);
    c.specs.forEach(([kind, y, chunk], i) => {
      const x = c.chunks[chunk][0] * 16 + 1 + 0.5 * i, z = c.chunks[chunk][1] * 16 + 8.5;
      if (kind === "item") items.spawn({ id: STONE, count: 3, damage: 0 }, x, y, z, { motion: [0, 0, 0] });
      else if (kind === "orb") { const e = newOrb(5, x, y, z, () => 0); xp.orbs.push(e); xp.joined(e); }
      else if (kind === "arrow") { const e = ents.arrows.make({ x, y, z, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, ents.arrows.rng(), {}); ents.arrows.list.push(e); ents.arrows.joined(e); }
      else if (kind === "tnt") ents.primed.push(Object.assign(primeTnt(x, y, z, { fuse: 80, random: () => 0 }), { x, y, z }));
      else if (kind === "cart") { const e = ents.minecarts.spawnCart(1, { x, y, z, items: [] }); Object.assign(e, { x, y, z }); }
      else if (kind === "cow") { const e = mobs.create("cow", x, y, z); Object.assign(e, { x, y, z }); mobs.entities.push(e); }
      else if (kind === "fall") { falling.restoreEntity({ block: SAND, meta: 0, x, y, z, vx: 0, vy: 0, vz: 0, ticks: 1 }); mobs.joined(falling.entities.at(-1), "falling"); }
      else throw new Error(kind);
    });
    const keeps = c.name.endsWith("nether") ? null : nearSpawn({ x: c.spawn[0], z: c.spawn[1] });
    trackChunkLoads(mobs, { x: c.player[0], z: c.player[1] }, c.view, keeps);
    for (const [x, z] of c.path) trackChunkLoads(mobs, { x, z }, c.view, keeps);
    const rec = {
      entities: mobs.serialize(), drops: items.serialize(), xpOrbs: xp.serialize(), tnt: ents.primed.map((t) => ({ x: t.x, y: t.y, z: t.z, vx: t.vx, vy: t.vy, vz: t.vz, fuse: t.fuse })),
      arrows: ents.arrows.serialize(), projectiles: ents.projectiles.serialize(), falling: falling.serialize(), minecarts: ents.minecarts.toJSON(), boats: [],
    };
    stampSavedOrder(mobs, orderGroups({ mobs, items, xpOrbs: xp, primed: ents.primed, arrows: ents.arrows, projectiles: ents.projectiles, falling, minecarts: ents.minecarts, boats: ents.boats, hanging: ents.hanging }, rec), 0, { spawn: null, player: { x: c.player[0], z: c.player[1] }, view: c.view });
    const got = [rec.drops, rec.xpOrbs, rec.tnt, rec.entities, rec.arrows, rec.falling, rec.minecarts?.carts].flat().filter((r) => Number.isFinite(r?.ord)).sort((a, b) => a.ord - b.ord).map((r) => indexOfRecord(r, c.chunks));
    assert.deepEqual(got, c.after.filter((i) => i >= 0));
  });
}

test("nearSpawn is ms.b's 128-block rule on the chunk centre", () => {
  const k = nearSpawn({ x: 170, z: 0 });
  assert.equal(k(2, 0), false);
  assert.equal(k(3, 0), true);
  assert.equal(k(3, 7), true);
  assert.equal(k(3, 8), false);
  assert.equal(nearSpawn(null), null);
});

const seated = () => {
  const boats = new Boats(), boat = boats.spawnBoat({ x: 0, y: 64, z: 0 }), cow = { type: "cow", x: 0, y: 64, z: 0 };
  mountEntity(cow, boat, () => 0.6); Object.defineProperty(boat, "passenger", { value: cow, writable: true, configurable: true, enumerable: false });
  const player = { player: true, x: 0, y: 64, z: 0 };
  assert.equal(boats.mount(boat, player), true);
  return { boat, cow, player };
};

test("the taker is let go at his own turn, not when the pass starts", () => {
  const { boat, cow, player } = seated(), seats = new Set();
  assert.equal(clearStaleRider(cow, seats), true, "the mob's turn clears the pair");
  assert.equal(cow.ridingEntity ?? null, null);
  assert.equal(boat.rider, player, "the player still sits until his own turn");
  releaseSeats(seats);
  assert.equal(boat.rider, null);
  assert.equal(player.vehicle, null);
});

test("a mob with no stale pair is left alone", () => {
  const seats = new Set();
  assert.equal(clearStaleRider({ type: "cow" }, seats), false);
  assert.equal(seats.size, 0);
});
