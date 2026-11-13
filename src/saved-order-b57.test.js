import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { newOrb } from "./experience.js";
import { primeTnt } from "./explosion.js";
import { mountEntity } from "./mob-riding.js";
import { orderGroups, stampSavedOrder } from "./saved-order.js";
import { FallingBlocks } from "./falling.js";
import { Boats } from "./boats.js";
import { SAND } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// Batch 57 (b57so, public/research/saved-order5-reference.json, executed SavedOrderLoginProbe): the Nether and End login with no spawn grid (MinecraftServer.g loads dimension 0 only, bytecode-read),
// the Overworld with nobody logged in loads its grid only, a mob in a boat the player takes (stale link), and non-mob entities high above the world (items, boats, falling blocks, TNT, arrows, orbs,
// carts: every kind is written and read back, filed in section 15 above y 256 and in section 0 below y 0). Same harness as saved-order4-b56.test.js, saved the way main.js save() does.
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order5-reference.json", import.meta.url))).cases;
const STONE = 3;

const run = (entities, spawn) => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities, editSequence: 0, ticks: 0, idBase: 1, ...(spawn ? { spawn } : {}) }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64, sound() {} });
};

function joinAll(ents, falling, c) {
  const { items, xp, arrows, mobs, primed, minecarts, boats } = ents, made = [];
  c.specs.forEach(([kind, y, chunk], i) => {
    const x = c.chunks[chunk][0] * 16 + 1 + 0.5 * i, z = c.chunks[chunk][1] * 16 + 8.5;
    let e;
    if (kind === "item") e = items.spawn({ id: STONE, count: 3, damage: 0 }, x, y, z, { motion: [0, 0, 0] });
    else if (kind === "orb") { e = newOrb(5, x, y, z, () => 0); xp.orbs.push(e); xp.joined(e); }
    else if (kind === "arrow") { e = arrows.make({ x, y, z, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, arrows.rng(), {}); arrows.list.push(e); arrows.joined(e); }
    else if (kind === "tnt") { e = Object.assign(primeTnt(x, y, z, { fuse: 80, random: () => 0 }), { x, y, z }); primed.push(e); }
    else if (kind === "cow") { e = mobs.create("cow", x, y, z); Object.assign(e, { x, y, z }); mobs.entities.push(e); }
    else if (kind === "cart") { e = minecarts.spawnCart(1, { x, y, z, items: [] }); Object.assign(e, { x, y, z }); }
    else if (kind === "boat") { e = boats.spawnBoat({ x, y, z }); Object.assign(e, { x, z, posY: y }); }
    else if (kind === "fall") { falling.restoreEntity({ block: SAND, meta: 0, x, y, z, vx: 0, vy: 0, vz: 0, ticks: 1 }); e = falling.entities.at(-1); ents.mobs.joined(e, "falling"); }
    else throw new Error(kind);
    made.push(e);
  });
  return made;
}

// main.js save(): the groups of the live systems against the records they wrote
function save(ents, falling, frame) {
  const { mobs } = ents, rec = {
    entities: mobs.serialize(), drops: ents.items.serialize(), xpOrbs: ents.xp.serialize(), tnt: ents.primed.map((t) => ({ x: t.x, y: t.y, z: t.z, vx: t.vx, vy: t.vy, vz: t.vz, fuse: t.fuse })),
    arrows: ents.arrows.serialize(), projectiles: ents.projectiles.serialize(), falling: falling.serialize(), minecarts: ents.minecarts.toJSON(), boats: ents.boats.carts.length ? ents.boats.toJSON() : [],
  };
  stampSavedOrder(mobs, orderGroups({ mobs, items: ents.items, xpOrbs: ents.xp, primed: ents.primed, arrows: ents.arrows, projectiles: ents.projectiles, falling, minecarts: ents.minecarts, boats: ents.boats, hanging: ents.hanging }, rec), 0, frame);
  return rec;
}
const indexOfRecord = (r, chunks) => { const c = chunks.find((k) => Math.floor(r.x / 16) === k[0] && Math.floor(r.z / 16) === k[1]); return Math.round((r.x - c[0] * 16 - 1) / 0.5); };
const order = (rec, chunks) => [rec.drops, rec.xpOrbs, rec.tnt, rec.minecarts.carts, rec.boats, rec.entities, rec.arrows, rec.projectiles, rec.falling].flat().filter((r) => Number.isFinite(r.ord)).sort((a, b) => a.ord - b.ord).map((r) => indexOfRecord(r, chunks));
const falls = (ents) => { const f = new FallingBlocks(plain([]), {}, []); ents.falling = f; return f; };

const NETHER = new Set(["b57so-nether-no-grid", "b57so-nether-far", "b57so-nether-view-one", "b57so-nether-mount"]), AWAY = new Set(["b57so-away-grid", "b57so-away-far"]);
for (const c of reference.filter((r) => !r.name.startsWith("b57so-stale"))) {
  test(`saved order 5 ${c.name}`, () => {
    const away = AWAY.has(c.name), ents = run({}, away ? [c.spawn[0], 64, c.spawn[1]] : undefined), falling = falls(ents);
    const made = joinAll(ents, falling, c);
    if (c.playerMount >= 0) made[c.playerMount].rider = { player: true, dead: false };
    // the Nether and End have no grid (spawn null as main.js passes it); the away stamp uses the plan's spawn and no player
    const frame = away ? undefined : { spawn: NETHER.has(c.name) ? null : [c.spawn[0], 64, c.spawn[1]], player: { x: c.player[0], z: c.player[1] }, view: c.view };
    const rec = away ? ents.finish() : save(ents, falling, frame);
    const got = away ? [rec.drops, rec.xpOrbs, rec.tnt, rec.minecarts.carts, rec.boats, rec.mobs, rec.arrows, rec.projectiles].flat().filter((r) => Number.isFinite(r.ord)).sort((a, b) => a.ord - b.ord).map((r) => indexOfRecord(r, c.chunks)) : order(rec, c.chunks);
    const want = c.after.filter((i) => i >= 0);
    assert.deepEqual(got.filter((i) => want.includes(i)), want, "the entities a reload brings back are in the executed order");
    if (c.name.startsWith("b57so-high")) assert.deepEqual(got, want, "every kind is saved, at any height, in the executed order");
    if (c.playerMount >= 0) assert.equal(want.at(-1), c.playerMount, "the mount is last natively");
    if (c.playerMount < 0 || NETHER.has(c.name) || AWAY.has(c.name)) assert.deepEqual(got.slice(0, want.length - (c.playerMount >= 0 ? 1 : 0)).filter((i) => want.includes(i)), want.slice(0, want.length - (c.playerMount >= 0 ? 1 : 0)).filter((i) => got.slice(0, want.length).includes(i)), "loaded chunks first");
  });
}

test("the Nether has no spawn grid: only the player's chunk and the view square are loaded (executed: grid entities outside the view are not in the list)", () => {
  const nether = reference.find((r) => r.name === "b57so-nether-no-grid"), over = reference.find((r) => r.name === "b56so-grid-order");
  assert.deepEqual(nether.after.filter((i) => i >= 0), [0, 5]);
  assert.ok(nether.after.length < 8, "the five grid chunks are not all loaded");
});

test("the Overworld's away stamp ranks the spawn grid from the plan (no player, no view square)", () => {
  const c = reference.find((r) => r.name === "b57so-away-grid");
  const ents = run({}, [0, 64, 0]);
  joinAll(ents, falls(ents), c);
  const rec = ents.finish();
  const got = [rec.drops, rec.xpOrbs, rec.tnt, rec.minecarts.carts, rec.boats, rec.mobs, rec.arrows].flat().filter((r) => Number.isFinite(r.ord)).sort((a, b) => a.ord - b.ord).map((r) => indexOfRecord(r, c.chunks));
  assert.deepEqual(got, c.after);
});

test("a mob in a boat the player clicks: the executed link stays stale (the port seats the player, see savedorder6-b58.test.js)", () => {
  const stale = reference.find((r) => r.name === "b57so-stale-cow-in-cart");
  const count = (i) => stale.after.filter((v) => v === i).length;
  assert.equal(count(2), 2, "the cart is read twice natively: nested under the cow and from the player's Riding");
  assert.equal(count(1), 1);
  assert.equal(stale.after.at(-1), 2, "the player's copy is spawned last");
  const boats = new Boats(), boat = boats.spawnBoat({ x: 0, y: 64, z: 0 }), cow = { type: "cow", x: 0, y: 64, z: 0 };
  mountEntity(cow, boat, () => 0.6); Object.defineProperty(boat, "passenger", { value: cow, writable: true, configurable: true, enumerable: false });
  const player = { player: true, x: 0, y: 64, z: 0 };
  assert.equal(boats.mount(boat, player), true, "b58so: the click seats the player");
  assert.equal(boat.rider, player);
});

test("the carrier's chunk is loaded right after the view square, with the entities it holds (executed b57so-nether-mount)", () => {
  const c = reference.find((r) => r.name === "b57so-nether-mount");
  assert.deepEqual(c.after, [0, 4, -1, 3, 1]);
  const ents = run({}), falling = falls(ents), made = joinAll(ents, falling, c);
  made[1].rider = { player: true, dead: false };
  const rec = save(ents, falling, { spawn: null, player: { x: c.player[0], z: c.player[1] }, view: c.view });
  const got = order(rec, c.chunks);
  assert.deepEqual([got[0], got[1], got[2], got.at(-1)], [0, 4, 3, 1].map((i) => i), "player chunk, then the mount's chunk mate, the mount last");
});

test("boats and falling blocks above y 256 are restored and kept", () => {
  for (const y of [255, 256, 300, 1000]) {
    const w = run({}), falling = falls(w);
    w.boats.spawnBoat({ x: 8.5, y, z: 8.5 });
    const again = run({ ...w.finish(), editSequence: 0 });
    assert.equal(again.boats.carts.length, 1, `boat at y ${y}`);
    falling.restoreEntity({ block: SAND, meta: 0, x: 8.5, y, z: 8.5, vx: 0, vy: 0, vz: 0, ticks: 1 });
    const g = new FallingBlocks(plain([]), {}, falling.serialize());
    assert.equal(g.entities.length, 1, `falling block at y ${y}`);
    assert.equal(g.entities[0].y, y);
  }
});
