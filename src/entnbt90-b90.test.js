// Batch 90 entnbt90: arrows and firework rockets cross Nether portals with their NBT, and a travelToDimension copy that lands in the player's own dimension joins the live
// lists at once. Evidence (bytecode-read, tools/research/minecraft-1.7.10.jar):
// - zc.h (EntityArrow) calls sa.h (-> sa.C, the portal countdown) first and, when it did not start the update in the ground, ends with I() (doBlockCollisions) after
//   setPosition; an arrow that starts in the ground returns before it (the `inGround` branch's returns). zf.h (rocket) runs moveEntity (doBlockCollisions) after sa.h.
// - sa.C/Entity.setInPortal, getMaxInPortalTime (0 for a non-player) and travelToDimension (sa.b(I)) are not overridden by zc or zf; sg registers "Arrow" and
//   "FireworksRocketEntity", so createEntityByName succeeds and copyDataFrom (writeToNBT -> readFromNBT, minus Dimension) carries the NBT: arrow tile/inTile/inData/shake/inGround/
//   pickup/life/damage, rocket Life/LifeTime/FireworksItem. The shooter is not written by zc.b, so the copy has none.
// - sa.b(I) ends with dst.spawnEntityInWorld(copy) (mt.d at offset 229) for every destination, the dimension the entity started in included (a mismatched Dimension tag).
import test from "node:test";
import assert from "node:assert/strict";
import { GAME_IDS } from "./dimensions.js";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { EntityWorld } from "./entities.js";
import { Arrows } from "./bow.js";
import { FireworkRockets } from "./fireworks-live.js";
import { createRocket } from "./firework-rocket.js";
import { JavaRandom } from "./java-random.js";
import { ITEM_FIREWORK_ROCKET } from "./fireworks.js";

const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const makeRoot = (extra = {}) => ({ id: "w90", seed: "42", biome: "javaStreamed", chunked: true, name: "W", worldSpawn: [3, 64, -5], position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], entities: [], drops: [], xpOrbs: [], player: { health: 20, chests: {} }, ...extra });
const netherPortalWorld = (dim) => ({ dimension: dim, get: (x, y, z) => (x >= 63 && x <= 65 && z >= 63 && z <= 65 && y >= 4 && y <= 7 ? GAME_IDS.portal : y < 0 ? 1 : 0) });
const endPortalWorld = (dim) => ({ dimension: dim, get: (x, y, z) => (x === 64 && z === 64 && y === 5 ? GAME_IDS.endPortal : y < 0 ? 1 : 0) });
const liveFor = (root, active = root, extra = {}) => {
  const live = new DimensionLive({ active: () => active, worlds: () => [root], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 5, z: 0, yaw: 0 }), openWorld: async () => {}, ...extra });
  live.readEdits = async () => [];
  return live;
};
const newArrow = (arrows, extra = {}) => arrows.make({ x: 64.5, y: 5, z: 64.5, mx: 0.1, my: -0.05, mz: 0.2, yaw: 30, pitch: -10 }, () => 0.5, { damage: 3.5, pickup: 2, ticksInGround: 7, inTile: 5, inData: 2, shake: 3, xTile: 10, yTile: 20, zTile: 30, ...extra });

test("an arrow in a Nether portal travels the next update with its NBT (damage, pickup, life, tile), no shooter, the 300-tick cooldown and a built portal", async () => {
  const root = makeRoot(), live = liveFor(root), arrows = new Arrows();
  const a = newArrow(arrows, { shooter: { name: "someone" } });
  arrows.list.push(a);
  live.tickEntities(netherPortalWorld(0), { arrows });
  assert.equal(arrows.list.length, 1, "the collision only sets inPortal; the travel is the next update's");
  live.tickEntities(netherPortalWorld(0), { arrows });
  assert.equal(arrows.list.length, 0, "the arrow left its list at once");
  await live.settle();
  const inbox = root.portalArrivals[-1], rec = inbox.arrows[0];
  assert.ok(rec);
  assert.deepEqual([rec.damage, rec.pickup, rec.life, rec.inTile, rec.inData, rec.shake, rec.inGround], [3.5, 2, 7, 5, 2, 3, false]);
  assert.equal(rec.portalCooldown, 300);
  assert.equal(rec.nbtDimension, undefined);
  assert.equal(rec.shooter, undefined);
  assert.ok(inbox.writes.length > 0, "an untagged arrow takes the Teleporter");
  assert.ok(Number.isFinite(rec.x) && Number.isFinite(rec.y) && Number.isFinite(rec.yaw));
  const record = { arrows: [] };
  live.deliverArrivals({ set() {} }, Object.assign(record, { rootId: "w90", dimension: -1, pendingArrivals: inbox }));
  assert.equal(record.arrows.length, 1);
  const back = new Arrows(); back.load(record.arrows);
  const b = back.list[0];
  assert.deepEqual([b.damage, b.pickup, b.ticksInGround, b.inTile, b.shake, b.portalCooldown], [3.5, 2, 7, 5, 3, 300]);
});

test("PortalCooldown: the portal walk does not count an arrow's cooldown a second time (Arrows.step already does)", () => {
  const root = makeRoot(), live = liveFor(root), arrows = new Arrows();
  const a = newArrow(arrows, { portalCooldown: 50 });
  arrows.list.push(a);
  live.tickEntities(netherPortalWorld(0), { arrows }); // inside the portal block with a cooldown: setInPortal resets it, no travel
  assert.equal(arrows.list.length, 1);
  const kept = a.portalCooldown;
  live.tickEntities({ dimension: 0, get: () => 0 }, { arrows });
  assert.equal(a.portalCooldown, kept);
});

test("an arrow that started the update in the ground touches no portal; Arrows.step records that state", async () => {
  const root = makeRoot(), live = liveFor(root), arrows = new Arrows();
  const stuck = newArrow(arrows, { inGround: true });
  stuck.groundAtStart = true;
  arrows.list.push(stuck);
  for (let i = 0; i < 4; i++) live.tickEntities(netherPortalWorld(0), { arrows });
  await live.settle();
  assert.equal(arrows.list.length, 1);
  assert.equal(root.portalArrivals?.[-1], undefined);
  const sim = new Arrows(), f = newArrow(sim, { inGround: true });
  sim.list.push(f);
  try { sim.step({ ...air, dimension: 0 }, f, {}); } catch { /* a bare world can lack hooks the in-ground branch reads */ }
  assert.equal(f.groundAtStart, true);
});

test("a firework rocket crosses a Nether portal with Life, LifeTime and its FireworksItem", async () => {
  const root = makeRoot(), live = liveFor(root), rockets = new FireworkRockets(new JavaRandom(1));
  const r = createRocket(64.5, 5, 64.5, { id: ITEM_FIREWORK_ROCKET, count: 1, fireworks: { flight: 2, explosions: [] } }, new JavaRandom(3));
  r.life = 9; r.lifetime = 31; r.mx = 0.01; r.my = 0.4; r.mz = -0.02;
  rockets.rockets.push(r);
  live.tickEntities(netherPortalWorld(0), { rockets });
  live.tickEntities(netherPortalWorld(0), { rockets });
  assert.equal(rockets.rockets.length, 0);
  await live.settle();
  const rec = root.portalArrivals[-1].rockets[0];
  assert.deepEqual([rec.life, rec.lifetime, rec.portalCooldown, rec.nbtDimension], [9, 31, 300, undefined]);
  assert.equal(rec.stack.fireworks.flight, 2);
  assert.deepEqual([rec.px, rec.py, rec.pz], [rec.x, rec.y, rec.z], "the copy's previous position is its new one");
  const record = { rockets: { random: null, rockets: [] } };
  live.deliverArrivals({ set() {} }, Object.assign(record, { rootId: "w90", dimension: -1, pendingArrivals: root.portalArrivals[-1] }));
  const back = new FireworkRockets(new JavaRandom(1)); back.load(record.rockets);
  assert.equal(back.rockets.length, 1);
  assert.deepEqual([back.rockets[0].life, back.rockets[0].lifetime, back.rockets[0].portalCooldown], [9, 31, 300]);
});

test("an arrow in an End portal travels at once (BlockEndPortal.onEntityCollidedWithBlock)", async () => {
  const root = makeRoot(), live = liveFor(root), arrows = new Arrows();
  arrows.list.push(newArrow(arrows));
  live.tickEntities(endPortalWorld(0), { arrows });
  assert.equal(arrows.list.length, 0);
  await live.settle();
  assert.ok(root.portalArrivals[1].arrows[0]);
});

test("a copy that lands in the dimension the player is in is added to the live lists at once, not held in a late inbox", async () => {
  const root = makeRoot(), view = viewRecord(root, 1), landed = [];
  const live = liveFor(root, view, { arriveLive: (kind, rec) => { landed.push([kind, rec]); return true; } });
  const mobs = new EntityWorld({ ...air, dimension: 1 }, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, nbtDimension: 0 }], () => 0.5);
  mobs.isActive = () => true;
  live.tickEntities(endPortalWorld(1), { mobs });
  await live.settle();
  const kinds = landed.map(([k]) => k);
  assert.ok(kinds.includes("mob"), "the pig joined the End's live list");
  assert.ok(kinds.includes("write"), "the platform the Teleporter built is written to the live world");
  assert.equal(root.portalArrivals?.[1], undefined, "nothing waits in a late inbox");
  assert.equal(landed.find(([k]) => k === "mob")[1].nbtDimension, undefined);
  // A host that declines keeps the late inbox.
  const root2 = makeRoot(), view2 = viewRecord(root2, 1), live2 = liveFor(root2, view2, { arriveLive: () => false });
  const mobs2 = new EntityWorld({ ...air, dimension: 1 }, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, nbtDimension: 0 }], () => 0.5);
  mobs2.isActive = () => true;
  live2.tickEntities(endPortalWorld(1), { mobs: mobs2 });
  await live2.settle();
  assert.equal(root2.portalArrivals[1].late, true);
  assert.equal(root2.portalArrivals[1].entities.length, 1);
});
