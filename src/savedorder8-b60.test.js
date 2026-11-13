import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { trackChunkLoads, unloadQueued, liveOrder, nearSpawn } from "./saved-order.js";
import { FallingBlocks } from "./falling.js";
import { Boats } from "./boats.js";
import { newOrb } from "./experience.js";
import { primeTnt } from "./explosion.js";
import { SAND } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// Batch 60 (b60so, public/research/saved-order8-reference.json, executed SavedOrderLoginProbe): the unload queue. A chunk the player leaves is only queued; one that comes back before ms.d runs stays loaded,
// ms.d unloads at most 100 per call (HashSet<Long> order), and the entities of an unloaded chunk are out of the walk until it loads again, when they join the end in load order.
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order8-reference.json", import.meta.url))).cases;
const STONE = 3, K = ["item", "cow", "orb", "item", "cart", "orb", "cow", "arrow"];
const run = () => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities: {}, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64, sound() {} });
};
const indexOf = (e, chunks) => { const c = chunks.find((k) => Math.floor(e.x / 16) === k[0] && Math.floor(e.z / 16) === k[1]); return Math.round((e.x - c[0] * 16 - 1) / 0.5); };
const build = (c) => {
  const ents = run(), { items, xp, mobs } = ents, falling = new FallingBlocks(plain([]), {}, []);
  ents.attachFalling(falling, []);
  c.specs.forEach(([, y, chunk], i) => {
    const kind = K[i % K.length], x = c.chunks[chunk][0] * 16 + 1 + 0.5 * i, z = c.chunks[chunk][1] * 16 + 8.5;
    if (kind === "item") items.spawn({ id: STONE, count: 3, damage: 0 }, x, y, z, { motion: [0, 0, 0] });
    else if (kind === "orb") { const e = newOrb(5, x, y, z, () => 0); xp.orbs.push(e); xp.joined(e); }
    else if (kind === "arrow") { const e = ents.arrows.make({ x, y, z, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, ents.arrows.rng(), {}); ents.arrows.list.push(e); ents.arrows.joined(e); }
    else if (kind === "cart") { const e = ents.minecarts.spawnCart(1, { x, y, z, items: [] }); Object.assign(e, { x, y, z }); }
    else if (kind === "cow") { const e = mobs.create("cow", x, y, z); Object.assign(e, { x, y, z }); mobs.entities.push(e); }
    else throw new Error(kind);
  });
  return mobs;
};
const live = (mobs, chunks) => liveOrder(mobs, mobs.withBalls(mobs.entities.slice())).map((e) => indexOf(e, chunks));

for (const c of reference) {
  test(`the unload queue and the entities of unloaded chunks (executed ${c.name})`, () => {
    const mobs = build(c), keeps = nearSpawn({ x: c.spawn[0], z: c.spawn[1] }), all = [...Array(c.specs.length).keys()];
    mobs.withBalls(mobs.entities.slice());
    const first = live(mobs, c.chunks);
    trackChunkLoads(mobs, { x: c.player[0], z: c.player[1] }, c.view, keeps, false);
    c.path.forEach(([x, z], i) => {
      trackChunkLoads(mobs, { x, z }, c.view, keeps, false); // the move's packet (end of the previous server tick)
      if (c.mask[i]) unloadQueued(mobs); // WorldServer.tick: unloadQueuedChunks, then updateEntities drops the unloaded entities
      const want = c.steps[i].filter((n) => n >= 0), got = live(mobs, c.chunks);
      assert.deepEqual([...got].sort((a, b) => a - b), [...want].sort((a, b) => a - b), `step ${i}`);
    });
    const end = live(mobs, c.chunks), want = c.after.filter((n) => n >= 0);
    assert.deepEqual([...end].sort((a, b) => a - b), all);
    if (c.name.endsWith("cancel")) assert.deepEqual(end, first, "a cancelled unload leaves the list as it was");
    else assert.deepEqual(end, want, "reloaded in load order");
  });
}

test("ms.d takes 100 queued chunks per call, in HashSet<Long> order, and every entity of them leaves the walk", () => {
  const mobs = build(reference.find((c) => c.name.endsWith("limit")));
  trackChunkLoads(mobs, { x: 40.5, z: 8.5 }, 6, null, false);
  trackChunkLoads(mobs, { x: 1604.5, z: 8.5 }, 6, null, false);
  assert.equal(mobs.chunkLoads.queue.size, 169);
  unloadQueued(mobs);
  assert.equal(mobs.chunkLoads.queue.size, 69);
  assert.equal(mobs.chunkLoads.out.size, 100);
  assert.ok(mobs.frozen.set.size > 0 && mobs.frozen.set.size < 12);
  unloadQueued(mobs);
  assert.equal(mobs.chunkLoads.queue.size, 0);
  assert.equal(mobs.frozen.set.size, 12);
  assert.equal(liveOrder(mobs, mobs.withBalls(mobs.entities.slice())).length, 0);
});
