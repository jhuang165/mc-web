// Batch 98 portals98: a mob that touched a portal and is mounted afterwards still travels, and drops its rider (Executed tools/probes/Portals98Probe.java,
// public/research/portals98-reference.jsonl). See .shared-memory/notes/portals98-b98-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { PORTAL } from "./nether-portal.js";
import { GAME_IDS } from "./dimensions.js";
import { EntityWorld } from "./entities.js";
import { mountEntity } from "./mob-riding.js";
import { DimensionLive } from "./dimension-live.js";
import { mobLinks } from "./entity-portal.js";

await populationBlockMapperReady;
const ref = readFileSync(new URL("../public/research/portals98-reference.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const rec = (mode) => ref.find((r) => r.mode === mode);

test("portals98: native records (real pig + zombie): touch-then-mount travels and drops the rider; mount-then-touch and a riding mob stay", () => {
  const a = rec("touch-then-mount");
  assert.equal(a.inPortalAfterCollide, true);
  assert.equal(a.traveled, true);
  assert.equal(a.copyRiddenByNull && a.copyRidingNull, true);
  assert.equal(a.riderRidingAfter, false);
  assert.equal(a.riderStillInSource, true);
  assert.equal(a.copyCooldown, 300);
  assert.equal(rec("touch-then-mount-pig-rider").traveled, true);
  assert.equal(rec("mount-then-touch").inPortalAfterCollide, false);
  assert.equal(rec("mount-then-touch").traveled, false);
  assert.equal(rec("riding-other").traveled, false);
  assert.equal(rec("riding-other-cooldown").cooldown, 4); // the countdown still runs while riding
  assert.equal(rec("touch-then-mount-cooldown").cooldown, 299); // setInPortal under a cooldown rewrites it to 300, then the tick counts down
});

test("portals98: mobLinks tells a mount from a rider", () => {
  assert.deepEqual(mobLinks({}), { riding: false, ridden: false });
  assert.deepEqual(mobLinks({ rider: {} }), { riding: false, ridden: true });
  assert.deepEqual(mobLinks({ riddenBy: {} }), { riding: false, ridden: true });
  assert.deepEqual(mobLinks({ ridingEntity: {} }), { riding: true, ridden: false });
  assert.deepEqual(mobLinks({ vehicle: {}, riddenBy: {} }), { riding: true, ridden: true });
});

// ---- single player ----
const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const root = () => ({ id: "w98", seed: "42", biome: "javaStreamed", generationVersion: 22, chunked: true, name: "W", worldSpawn: [3, 64, -5], position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], entities: [], drops: [], xpOrbs: [], player: { health: 20, chests: {} } });
const portalWorld = { dimension: 0, get: (x, y, z) => (x === 64 && z === 64 && y === 5 ? GAME_IDS.portal : y < 0 ? 1 : 0) };

async function spTrip({ mountFirst, ridingOther = false }) {
  const r = root();
  const live = new DimensionLive({ active: () => r, worlds: () => [r], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 5, z: 0, yaw: 0 }), openWorld: async () => {} });
  live.readEdits = async () => [];
  const mobs = new EntityWorld(air, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10 }, { id: "mob-2", type: "zombie", x: 30.5, y: 5, z: 30.5, health: 20 }], () => 0.5);
  mobs.isActive = () => true;
  const [pig, rider] = mobs.entities;
  const h = (m) => mobs.size(m)[1];
  if (mountFirst) mountEntity(rider, pig, h);
  if (ridingOther) { const other = mobs.create("pig", 10.5, 5, 10.5); mobs.entities.push(other); mountEntity(pig, other, h); }
  live.tickEntities(portalWorld, { mobs }); // the pig touches the portal (when nothing rides it)
  if (!mountFirst) mountEntity(rider, pig, h); // the rider mounts after the collision
  live.tickEntities(portalWorld, { mobs });
  await live.settle();
  const out = Object.values(r.portalArrivals ?? {}).flatMap((i) => i.entities);
  return { out, pig, rider, mobs };
}

test("portals98 single player: a pig that touched the portal and is mounted afterwards travels; the rider stays and is unmounted; the copy has no link", async () => {
  const { out, rider, mobs } = await spTrip({ mountFirst: false });
  assert.equal(out.length, 1);
  assert.equal(out[0].riding, undefined);
  assert.equal(out[0].playerRides, undefined);
  assert.equal(rider.ridingEntity ?? null, null);
  assert.ok(mobs.entities.includes(rider));
  assert.ok(!mobs.entities.some((e) => e.type === "pig" && e.x === 64.5));
});

test("portals98 single player: a pig mounted before it touched never starts the countdown, and a riding mob never travels", async () => {
  assert.equal((await spTrip({ mountFirst: true })).out.length, 0);
  assert.equal((await spTrip({ mountFirst: false, ridingOther: true })).out.length, 0);
});

test("portals98 single player: a player riding the pig is let go (riderSneakOff) when the mount that touched before the player mounted travels", async () => {
  const r = root();
  const live = new DimensionLive({ active: () => r, worlds: () => [r], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 5, z: 0, yaw: 0 }), openWorld: async () => {} });
  live.readEdits = async () => [];
  const mobs = new EntityWorld(air, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10 }], () => 0.5);
  mobs.isActive = () => true;
  let off = 0;
  mobs.riderSneakOff = (e) => { off++; e.rider = null; };
  live.tickEntities(portalWorld, { mobs });
  mobs.entities[0].rider = { player: true };
  live.tickEntities(portalWorld, { mobs });
  await live.settle();
  assert.equal(off, 1);
  const out = Object.values(r.portalArrivals ?? {}).flatMap((i) => i.entities);
  assert.equal(out.length, 1);
  assert.equal(out[0].playerRides, undefined);
});

// ---- dedicated server ----
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function flat() {
  const w = new World("portals98");
  for (let x = 40; x <= 110; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
function fixture() {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "survival", mobs: false });
  const a = s.addPlayer("a", "Alice", key(1)); a.position.copy({ x: 45.5, y: 10, z: 45.5 }); a.previous.copy(a.position);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  s.dimensions.ensureNether();
  for (let i = 0; i < 20; i++) s.tick();
  return { s, n: s.dimensions.nether };
}
const frame = (w, x0, z0, y0) => { for (let y = y0; y < y0 + 4; y++) for (const dx of [0, 1]) w.put(x0 + dx, y, z0, PORTAL, 0, false); };

test("dedicated server: a cow that touched the portal and is mounted afterwards travels; its rider stays in the Overworld, unmounted", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10); frame(n.world, 64, 64, 10);
  const list = s.mobs.mobs, h = (m) => list.size(m)[1];
  const cow = list.create("cow", 64.9, 10, 64.5); cow.customName = "Probe"; list.entities.push(cow);
  const rider = list.create("zombie", 50.5, 10, 50.5); rider.customName = "Rider"; list.entities.push(rider);
  s.dimensions.travel.step(0); // the cow touches
  mountEntity(rider, cow, h);
  assert.equal(cow.riddenBy, rider);
  s.dimensions.travel.step(0); // one step: the unmounted rider stands in the portal itself and would start its own countdown
  assert.ok(n.mobs.mobs.entities.some((e) => e.customName === "Probe"), "the cow reached the Nether");
  assert.ok(!list.entities.some((e) => e.customName === "Probe"));
  assert.ok(list.entities.includes(rider));
  assert.equal(rider.ridingEntity ?? null, null);
  const copy = n.mobs.mobs.entities.find((e) => e.customName === "Probe");
  assert.equal(copy.riddenBy ?? null, null);
});

test("dedicated server: a cow mounted before it touched stays", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10); frame(n.world, 64, 64, 10);
  const list = s.mobs.mobs;
  const cow = list.create("cow", 64.9, 10, 64.5); cow.customName = "Probe"; list.entities.push(cow);
  const rider = list.create("zombie", 50.5, 10, 50.5); list.entities.push(rider);
  mountEntity(rider, cow, (m) => list.size(m)[1]);
  for (let i = 0; i < 4; i++) s.dimensions.travel.step(0);
  assert.ok(list.entities.includes(cow));
  assert.ok(!n.mobs.mobs.entities.some((e) => e.customName === "Probe"));
});
