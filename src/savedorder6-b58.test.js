import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { newOrb } from "./experience.js";
import { primeTnt } from "./explosion.js";
import { mountEntity, releaseStaleRiders } from "./mob-riding.js";
import { orderGroups, stampSavedOrder, trackChunkLoads } from "./saved-order.js";
import { FallingBlocks } from "./falling.js";
import { Boats } from "./boats.js";
import { SAND } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// Batch 58 (b58so, public/research/saved-order6-reference.json, executed SavedOrderLoginProbe): chunks the player's movement loads after the login append to loadedEntityList in load order
// (the real PlayerManager.updateMountedMovingPlayer over the unchanged ChunkProviderServer); falling blocks of the away run carry the saved-order stamp; the player seated in a boat he took
// from a mob is let go within a pass or two (World.updateEntities, bytecode-read).
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order6-reference.json", import.meta.url))).cases;
const STONE = 3;

const run = (entities, spawn) => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities, editSequence: 0, ticks: 0, idBase: 1, ...(spawn ? { spawn } : {}) }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64, sound() {} });
};
const falls = (ents) => { const f = new FallingBlocks(plain([]), {}, []); ents.attachFalling(f, []); return f; };

function joinAll(ents, falling, c) {
  const { items, xp, mobs } = ents;
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
}
const indexOfRecord = (r, chunks) => { const c = chunks.find((k) => Math.floor(r.x / 16) === k[0] && Math.floor(r.z / 16) === k[1]); return Math.round((r.x - c[0] * 16 - 1) / 0.5); };
const lists = (rec) => [rec.drops, rec.xpOrbs, rec.tnt, rec.mobs, rec.arrows, rec.falling, rec.minecarts?.carts].flat().filter((r) => Number.isFinite(r?.ord));
const order = (rec, chunks) => lists(rec).sort((a, b) => a.ord - b.ord).map((r) => indexOfRecord(r, chunks));

test("falling blocks saved by the away run are stamped in the native order (executed b58so-away-falling)", () => {
  const c = reference.find((r) => r.name === "b58so-away-falling");
  const ents = run({}, [0, 64, 0]), falling = falls(ents);
  joinAll(ents, falling, c);
  const rec = ents.finish();
  assert.equal(rec.falling.length, 4);
  assert.ok(rec.falling.every((r) => Number.isFinite(r.ord)), "every falling record has its stamp");
  assert.deepEqual(order(rec, c.chunks), c.after);
});

test("a reloaded away run keeps the falling blocks' places (the records' stamps are restored and stamped again)", () => {
  const c = reference.find((r) => r.name === "b58so-away-falling");
  const ents = run({}, [0, 64, 0]);
  joinAll(ents, falls(ents), c);
  const rec = ents.finish();
  const again = run({ ...rec, editSequence: 0 }, [0, 64, 0]), f2 = new FallingBlocks(plain([]), {}, rec.falling);
  again.attachFalling(f2, rec.falling);
  const rec2 = again.finish();
  assert.equal(rec2.falling.length, 4);
  assert.deepEqual(order(rec2, c.chunks), c.after.filter((i) => i !== 2), "the cow (index 2) does not survive this harness's reload (the bare test world drops it); the rest keep their order");
});

for (const c of reference.filter((r) => r.move)) {
  test(`chunks loaded after the login are ranked in load order (executed ${c.name})`, () => {
    const ents = run({}), falling = falls(ents), { mobs } = ents;
    joinAll(ents, falling, c);
    const view = c.view;
    trackChunkLoads(mobs, { x: c.player[0], z: c.player[1] }, view); // the login square
    trackChunkLoads(mobs, { x: c.move[0], z: c.move[1] }, view); // the chunks the walk loads
    const rec = {
      entities: mobs.serialize(), drops: ents.items.serialize(), xpOrbs: ents.xp.serialize(), tnt: ents.primed.map((t) => ({ x: t.x, y: t.y, z: t.z, vx: t.vx, vy: t.vy, vz: t.vz, fuse: t.fuse })),
      arrows: ents.arrows.serialize(), projectiles: ents.projectiles.serialize(), falling: falling.serialize(), minecarts: ents.minecarts.toJSON(), boats: [],
    };
    // the save stamps against the login frame (the player's place natively reloaded); chunks outside it follow in the order they were loaded
    stampSavedOrder(mobs, orderGroups({ mobs, items: ents.items, xpOrbs: ents.xp, primed: ents.primed, arrows: ents.arrows, projectiles: ents.projectiles, falling, minecarts: ents.minecarts, boats: ents.boats, hanging: ents.hanging }, rec), 0,
      { spawn: null, player: { x: c.player[0], z: c.player[1] }, view });
    const got = order({ ...rec, mobs: rec.entities }, c.chunks);
    assert.deepEqual(got, c.after.filter((i) => i >= 0));
  });
}

test("a chunk that the player left and re-entered loads again, at the end", () => {
  const mobs = { };
  trackChunkLoads(mobs, { x: 8, z: 8 }, 1);
  const first = new Map(mobs.chunkLoads.map);
  trackChunkLoads(mobs, { x: 8 + 16 * 3, z: 8 }, 1);
  assert.equal(mobs.chunkLoads.map.get("0,0"), first.get("0,0"), "a chunk that left keeps its place");
  trackChunkLoads(mobs, { x: 8, z: 8 }, 1);
  assert.ok(mobs.chunkLoads.map.get("0,0") > mobs.chunkLoads.map.get("3,0"), "the return loads it again");
  assert.deepEqual([...mobs.chunkLoads.map.values()].sort((a, b) => a - b).length, new Set(mobs.chunkLoads.map.values()).size);
});

const seated = () => {
  const boats = new Boats(), boat = boats.spawnBoat({ x: 0, y: 64, z: 0 }), cow = { type: "cow", x: 0, y: 64, z: 0 };
  mountEntity(cow, boat, () => 0.6); Object.defineProperty(boat, "passenger", { value: cow, writable: true, configurable: true, enumerable: false });
  const player = { player: true, x: 0, y: 64, z: 0 };
  assert.equal(boats.mount(boat, player), true, "EntityBoat.interactFirst refuses only another player: the click mounts");
  return { boats, boat, cow, player };
};

test("the player takes a boat from a mob: seated now, the mob's turn clears the stale pair and the player is let go in the same pass when the mob is before him", () => {
  const { boat, cow, player } = seated();
  assert.equal(player.vehicle, boat);
  assert.equal(boat.rider, player);
  assert.equal(cow.ridingEntity, boat, "the mob keeps its link until its turn");
  const pending = new Set();
  releaseStaleRiders([cow], pending, () => true);
  assert.equal(cow.ridingEntity ?? null, null);
  assert.equal(boat.passenger ?? null, null);
  assert.equal(boat.rider, null);
  assert.equal(player.vehicle, null);
  assert.equal(pending.size, 0);
});

test("when the player is before the mob in the list he stays seated for the pass and is let go in the next", () => {
  const { boat, cow, player } = seated();
  const pending = new Set();
  releaseStaleRiders([cow], pending, () => false);
  assert.equal(cow.ridingEntity ?? null, null, "the mob is free at once");
  assert.equal(boat.rider, player, "the player is skipped by the loop while his mount lists him");
  assert.equal(player.vehicle, boat);
  releaseStaleRiders([cow], pending, () => false);
  assert.equal(boat.rider, null);
  assert.equal(player.vehicle, null);
});

test("a boat the player rides with no mob is left alone", () => {
  const boats = new Boats(), boat = boats.spawnBoat({ x: 0, y: 64, z: 0 }), player = { player: true, x: 0, y: 64, z: 0 };
  assert.equal(boats.mount(boat, player), true);
  releaseStaleRiders([], new Set(), () => true);
  assert.equal(boat.rider, player);
});
