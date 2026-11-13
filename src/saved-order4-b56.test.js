import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { newOrb } from "./experience.js";
import { primeTnt } from "./explosion.js";
import { mountEntity } from "./mob-riding.js";
import { loadRanks } from "./saved-order.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// Batch 56 (b56so, public/research/saved-order4-reference.json, executed SavedOrderLoginProbe): the chunk order of a native login (spawn grid, the player's chunk, the view square, then the
// player's mount), and the chain below a mount that carries the player (the login reads the first Riding only, so that chain is in no file). Same harness as saved-order3-b54.test.js.
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order4-reference.json", import.meta.url))).cases;
const STONE = 3;

const run = (entities) => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  return awayEntities({ entities, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64, sound() {} });
};

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

const records = (saved) => [saved.drops, saved.xpOrbs, saved.tnt, saved.minecarts.carts, saved.boats, saved.mobs, saved.arrows, saved.projectiles].flat();
const indexOfRecord = (r, chunks) => { const c = chunks.find((k) => Math.floor(r.x / 16) === k[0] && Math.floor(r.z / 16) === k[1]); return Math.round((r.x - c[0] * 16 - 1) / 0.5); };

// entities that a reload does not bring back: the chain below the mount that carries the player
const LOST = { "b56so-stacked-cow-on-cart": [2], "b56so-stacked-chain": [2, 3], "b56so-stacked-plus-pair": [3] };

for (const c of reference) {
  test(`saved order 4 ${c.name}`, () => {
    const first = run({});
    const made = joinAll(first, c);
    if (c.playerMount >= 0) made[c.playerMount].rider = { player: true, dead: false }; // the local player sits in this mount
    first.mobs.loadFrame = { spawn: [c.spawn[0], 64, c.spawn[1]], player: { x: c.player[0], z: c.player[1] }, view: c.view };
    const saved = first.finish();
    const all = records(saved).filter((r) => Number.isFinite(r.ord)).sort((a, b) => a.ord - b.ord);
    const got = all.map((r) => indexOfRecord(r, c.chunks));
    const want = c.after.filter((i) => i >= 0);
    // a chunk outside the login frame is not loaded natively: its entities are not in the list, the port keeps them after the loaded ones
    assert.deepEqual(got.filter((i) => want.includes(i)), want);
    assert.deepEqual(got.slice(0, want.length), want, "loaded chunks first");
    for (const i of LOST[c.name] ?? []) assert.ok(!got.includes(i), `entity ${i} is not saved`);
    if (c.playerMount >= 0 && !(LOST[c.name] ?? []).includes(c.playerMount)) assert.equal(want.at(-1), c.playerMount, "the mount is last natively");
  });
}

test("the carrier's own mount link is dropped with the chain below it", () => {
  const c = reference.find((r) => r.name === "b56so-stacked-cow-on-cart");
  const first = run({});
  const made = joinAll(first, c);
  made[1].rider = { player: true, dead: false, vehicle: { entity: made[1] } }; // the seat state a real ride has (entities.js serializeOne's playerRides rule)
  first.mobs.loadFrame = { spawn: [0, 64, 0], player: { x: c.player[0], z: c.player[1] }, view: c.view };
  const saved = first.finish();
  assert.equal(saved.mobs.filter((m) => m.playerRides).length, 1);
  assert.equal(saved.mobs.find((m) => m.playerRides).riding, undefined);
  assert.equal(saved.minecarts.carts.length, 0);
  assert.ok(!made[2].dead, "the live cart stays until the page is reloaded");
  assert.equal(first.minecarts.carts.length, 1);
});

test("loadRanks: the spawn grid, then the player's chunk, then the view square (x outer, z inner)", () => {
  const r = loadRanks({ spawn: [8, 64, 8], player: { x: 400.5, z: 8.5 }, view: 1 });
  assert.equal(r.get("-12,-12"), 0);
  assert.equal(r.get("-12,-11"), 1);
  assert.equal(r.get("-11,-12"), 25);
  assert.equal(r.get("12,12"), 624);
  assert.equal(r.get("25,0"), 625); // the player's chunk
  assert.equal(r.get("24,-1"), 626);
  assert.equal(r.get("24,0"), 627);
  assert.equal(r.size, 625 + 1 + 8);
  assert.equal(loadRanks(null).size, 0);
});

// The away run keeps ticking a cart or mob that was saved with the player aboard (b43, unchanged by b56): the player leaves a dimension through ServerConfigurationManager.transferPlayerToDimension,
// whose removePlayerEntityDangerously only sets the player dead (bytecode-read: no mountEntity(null)), so the mount stays in the old world and World.updateEntityWithOptionalForce clears its
// dead rider (riddenByEntity.isDead) after its first update, after which it is a free entity. Only playerLoggedOut removes the mount (the player file keeps it), and no away run follows that.
test("the mount the player rode when he left the dimension keeps ticking (a free entity after its dead rider is cleared)", () => {
  const w = run({});
  const cow = w.mobs.create("cow", 8.5, 70, 8.5); Object.assign(cow, { x: 8.5, y: 70, z: 8.5 }); w.mobs.entities.push(cow);
  const saved = w.finish();
  saved.mobs[0].playerRides = true;
  const away = run({ ...saved, editSequence: 0 });
  assert.equal(away.mobs.entities.length, 1);
  for (let i = 0; i < 40; i++) away.tick();
  assert.ok(away.finish().mobs[0].y < 70, "it fell");
});

test("non-mob entities saved above y 256 are restored and keep ticking (the loader has no height limit; executed b52so sections clamp)", () => {
  for (const y of [255, 256, 300, 400]) {
    const w = run({});
    w.items.spawn({ id: STONE, count: 1, damage: 0 }, 8.5, y, 8.5, { motion: [0, 0, 0] });
    const o = newOrb(5, 9.5, y, 8.5, () => 0); w.xp.orbs.push(o); w.xp.joined(o);
    const cart = w.minecarts.spawnCart(1, { x: 10.5, y, z: 8.5, items: [] }); Object.assign(cart, { x: 10.5, y, z: 8.5 });
    const b = w.arrows.make({ x: 11.5, y, z: 8.5, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, w.arrows.rng(), {}); w.arrows.list.push(b); w.arrows.joined(b);
    const t = Object.assign(primeTnt(12.5, y, 8.5, { fuse: 80, random: () => 0 }), { x: 12.5, y, z: 8.5 }); w.primed.push(t);
    const again = run({ ...w.finish(), editSequence: 0 });
    assert.deepEqual([again.items.items.length, again.xp.orbs.length, again.minecarts.carts.length, again.arrows.list.length, again.primed.length], [1, 1, 1, 1, 1], `y ${y}`);
  }
});
