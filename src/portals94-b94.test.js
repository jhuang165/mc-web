// Batch 94 portals94: single-player held leads, reload of port-only mob state, and item / orb / cart / boat portal records. See .shared-memory/notes/portals94-b94-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { GAME_IDS } from "./dimensions.js";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { EntityWorld } from "./entities.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { Boats } from "./boats.js";
import { TRANSIENT_MOB } from "./mob-transient.js";

const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const makeRoot = () => ({ id: "w94", seed: "42", biome: "javaStreamed", chunked: true, name: "W", worldSpawn: [3, 64, -5], position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], entities: [], drops: [], xpOrbs: [], player: { health: 20, chests: {} } });
const endPortalWorld = (dim) => ({ dimension: dim, get: (x, y, z) => (x === 64 && z === 64 && y === 5 ? GAME_IDS.endPortal : y < 0 ? 1 : 0) });
const liveFor = (root, active, extra = {}) => {
  const live = new DimensionLive({ active: () => active, worlds: () => [root], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 5, z: 0, yaw: 0 }), openWorld: async () => {}, ...extra });
  live.readEdits = async () => [];
  return live;
};
const pigAt = (extra = {}) => ({ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, nbtDimension: 0, ...extra });

// A pig saved with Dimension 0 stands in the End's portal in a world where the player is: the copy lands in the player's own dimension (b90), so its holder is there.
async function leashed(playerThere) {
  const root = makeRoot(), view = playerThere ? viewRecord(root, 1) : root, landed = [];
  const live = liveFor(root, view, { arriveLive: (kind, rec) => { landed.push([kind, rec]); return true; } });
  const mobs = new EntityWorld({ ...air, dimension: playerThere ? 1 : 0 }, [pigAt({ leash: { holder: "player" } })], () => 0.5);
  mobs.isActive = () => true;
  live.tickEntities(endPortalWorld(playerThere ? 1 : 0), { mobs });
  await live.settle();
  return { root, landed };
}

test("single player: a lead held by the player stays on the copy that lands in the player's dimension (sw.bP looks the holder up there)", async () => {
  const { root, landed } = await leashed(true);
  const rec = landed.find(([k]) => k === "mob")[1];
  assert.deepEqual(rec.leash, { holder: "player" });
  assert.equal(root.portalArrivals?.[1], undefined);
});

test("single player: a holder in another dimension cannot be found: the lead drops as an item (unchanged)", async () => {
  const { root } = await leashed(false);
  const inbox = root.portalArrivals[1];
  assert.equal(inbox.entities[0].leash, undefined);
  assert.equal(inbox.drops.filter((d) => d.stack.id === 2020).length, 1);
});

test("restore starts the port-only mob state over (a reload builds a mob from NBT only), while the saved fields stay", () => {
  const mobs = new EntityWorld(air, [], () => 0.5);
  const rec = { id: "mob-1", type: "zombie", x: 5.5, y: 0, z: 5.5, health: 12, hurt: 6, age: 900, idle: 40, revenge: 12, burn: 1, lastDamage: 4, livingSoundTime: 33, home: [1, 1, 1], homeRadius: 9, attack: 7, flee: 5 };
  const m = mobs.restore(rec);
  for (const k of ["age", "idle", "revenge", "burn", "lastDamage", "livingSoundTime", "attack", "flee"]) assert.ok(!m[k], `${k} starts over, got ${m[k]}`);
  assert.equal(m.home, undefined);
  assert.equal(m.health, 12);
  assert.equal(m.hurt, 6, "HurtTime is NBT");
  assert.equal(rec.age, 900, "the caller's record is not changed");
  assert.ok(TRANSIENT_MOB.includes("age"));
});

test("an item's portal record drops the pickup delay and hover (not NBT in 1.7.10: xk.b writes Health, Age, Thrower, Owner, Item), keeps Age, Health and Thrower", async () => {
  const root = makeRoot(), live = liveFor(root, root), items = new ItemEntities();
  const e = items.spawn({ id: 1, count: 3, damage: 0 }, 64.5, 5, 64.5, { delay: 33, motion: [0, 0, 0] });
  e.age = 1234; e.health = 3; e.thrower = "Steve"; e.onGround = true;
  live.tickEntities(endPortalWorld(0), { items });
  await live.settle();
  const rec = root.portalArrivals[1].drops.find((d) => d.stack.id === 1);
  assert.ok(rec);
  assert.equal(rec.delay, undefined);
  assert.equal(rec.hover, undefined);
  assert.deepEqual([rec.age, rec.health, rec.thrower, rec.onGround], [1234, 3, "Steve", true]);
  const back = new ItemEntities(); back.load([rec], (s) => s, 0);
  assert.equal(back.items[0].delay, 0);
});

test("an orb and a boat keep the saved OnGround flag across the portal (sa.f reads it; the copy is not forced airborne)", async () => {
  const root = makeRoot(), live = liveFor(root, root), xpOrbs = new ExperienceOrbs(), boats = new Boats();
  const o = newOrb(7, 64.5, 5.25, 64.5); o.onGround = true; o.age = 100; xpOrbs.orbs.push(o);
  const b = boats.spawnBoat({ x: 64.5, y: 5, z: 64.5 }); b.onGround = true;
  live.tickEntities(endPortalWorld(0), { xpOrbs, boats });
  await live.settle();
  const inbox = root.portalArrivals[1];
  assert.equal(inbox.xpOrbs[0].onGround, true);
  assert.equal(inbox.xpOrbs[0].age, 100);
  assert.equal(inbox.boats[0].onGround, true);
});
