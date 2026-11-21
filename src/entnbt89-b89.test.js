// Batch 89 entnbt89: travelToDimension's source dimension, PortalCooldown on fireballs and rockets, the raw mob Fire on import, eggs and bobbers in the
// region export, and the Entity base key order of every exported kind. Evidence (bytecode-read, tools/research/minecraft-1.7.10.jar):
// - sa.b(I) (travelToDimension): j = this.dimension (sa.ap, the saved Dimension), src = MinecraftServer.a(j), dst = MinecraftServer.a(i); j == 1 && i == 1 sends it
//   to world 0 with dimension 0; oi.a(sa, j, src, dst) (transferEntityToWorld) scales by the NEW sa.ap (-1: / 8, 0: * 8, else the End entrance or, when j == 1, the
//   spawn) and runs the Teleporter only when j != 1; MinecraftServer.a(I): -1 -> c[1], 1 -> c[2], anything else -> c[0].
// - ze.h (EntityFireball) and zf.h (EntityFireworkRocket) call sa.h -> sa.C (the PortalCooldown countdown), ze.h after its setDead test.
// - sa.f reads Fire with getShort (raw). sg's static block registers neither zl (EntityEgg) nor xe (EntityFishHook), so sa.W() is null and
//   sa.d(dh) (writeToNBTOptional, the call aqk makes for each chunk entity) returns false: neither is ever saved.
// - sa.e writes Pos, Motion, Rotation, FallDistance, Fire, Air, OnGround, Dimension, Invulnerable, PortalCooldown, UUIDMost, UUIDLeast; sa.d puts id first.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAME_IDS } from "./dimensions.js";
import { travelRoute, travelSource, placeAfterTravel, entityDeparture, EntityPortals } from "./entity-portal.js";
import { DimensionLive, viewRecord, storedRecord } from "./dimension-live.js";
import { EntityWorld } from "./entities.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { NBT } from "./nbt.js";
import { javaMobFromNbt } from "./java-mobs.js";
import { javaProjectileFromNbt, javaProjectileToNbt } from "./java-projectiles.js";
import { Fireballs } from "./fireballs.js";
import { createRocket, tickRocket } from "./firework-rocket.js";
import { JavaRandom } from "./java-random.js";

const t = (type, value) => ({ type, value });
const tagOf = (o) => new Map(Object.entries(o));
const dl = (type, items) => t(NBT.LIST, { elementType: type, items });

// ---- 1. travelToDimension's source ----
test("travelRoute: the source is the saved Dimension; only j == 1 changes the destination (with i == 1) and skips the Teleporter", () => {
  assert.equal(travelSource({}, -1), -1, "a record without nbtDimension is in the dimension it was made in");
  assert.equal(travelSource({ nbtDimension: 0 }, 1), 0);
  assert.deepEqual(travelRoute(1, 1), { to: 0, spawn: true, teleporter: false }, "a natural End entity through the exit portal");
  assert.deepEqual(travelRoute(0, 1), { to: 1, spawn: false, teleporter: true }, "Dimension 0 in the End: back to the End's own platform");
  assert.deepEqual(travelRoute(-1, 1), { to: 1, spawn: false, teleporter: true });
  assert.deepEqual(travelRoute(1, -1), { to: -1, spawn: false, teleporter: false }, "Dimension 1 elsewhere: no Teleporter");
  assert.deepEqual(travelRoute(5, 0), { to: 0, spawn: false, teleporter: true }, "MinecraftServer.a maps any other id to world 0; j stays 5");
  // placeAfterTravel with the saved source: Dimension 1 in the Overworld through a Nether portal lands at x / 8 without a Teleporter.
  const tele = { placeInPortal() { throw new Error("no Teleporter when j == 1"); } };
  const r = placeAfterTravel({ from: 1, arg: -1, entity: { x: 80, y: 70, z: -16, yaw: 30 }, teleporter: tele, spawn: { x: 0, z: 0 }, heightAt: () => 64 });
  assert.deepEqual([r.to, r.e.x, r.e.y, r.e.z, r.teleporter], [-1, 10, 70, -2, false]);
  const back = placeAfterTravel({ from: 1, arg: 0, entity: { x: 10, y: 40, z: -2, yaw: 0 }, teleporter: tele, spawn: { x: 0, z: 0 }, heightAt: () => 64 });
  assert.deepEqual([back.to, back.e.x, back.e.z, back.teleporter], [0, 80, -16, false]);
});

const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const makeRoot = (extra = {}) => ({ id: "w89", seed: "42", biome: "javaStreamed", chunked: true, name: "W", worldSpawn: [3, 64, -5], position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], entities: [], drops: [], xpOrbs: [], player: { health: 20, chests: {} }, ...extra });
const endPortalWorld = (dim) => ({ dimension: dim, get: (x, y, z) => (x === 64 && z === 64 && y === 5 ? GAME_IDS.endPortal : y < 0 ? 1 : 0) });
const netherPortalWorld = (dim) => ({ dimension: dim, get: (x, y, z) => (x === 64 && z === 64 && y >= 4 && y <= 7 ? GAME_IDS.portal : y < 0 ? 1 : 0) });

test("an End mob tagged Dimension 0 (an untagged /summon) through the exit portal lands on the End platform, held in a late inbox until the End next loads", async () => {
  const root = makeRoot();
  let view = viewRecord(root, 1);
  const worlds = [root], live = new DimensionLive({ active: () => view, worlds: () => worlds, dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 64.5, y: 5, z: 64.5, yaw: 0 }), openWorld: async () => {} });
  live.readEdits = async () => [];
  // Consumed at open: an older inbox for the End that the view already delivered.
  root.portalArrivals = { 1: { entities: [{ type: "pig", x: 1, y: 2, z: 3, health: 10 }], drops: [], xpOrbs: [], writes: [] } };
  const mobs = new EntityWorld({ ...air, dimension: 1 }, [
    { id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, nbtDimension: 0 },
  ], () => 0.5);
  live.tickEntities(endPortalWorld(1), { mobs });
  assert.equal(mobs.entities.length, 0, "BlockEndPortal: travelToDimension(1) at once");
  await live.settle();
  const inbox = root.portalArrivals[1];
  assert.equal(inbox.late, true);
  assert.equal(inbox.entities.length, 1, "the delivered one is replaced");
  const rec = inbox.entities[0];
  assert.deepEqual([rec.x, rec.y, rec.z], [100, 49, 0], "the End Teleporter's platform at the entrance (100, 50, 0)");
  assert.equal(rec.nbtDimension, undefined, "sa.b(I) sets this.dimension to 1");
  assert.ok(inbox.writes.some(([, y, , id]) => y === 48 && id === GAME_IDS.obsidian), "the obsidian platform");
  assert.equal(root.portalArrivals[0], undefined, "not sent to the Overworld");
  // Saving the End view keeps it (it has not been delivered), a second save too.
  let stored = storedRecord(view, root);
  assert.equal(stored.portalArrivals[1], inbox);
  worlds[0] = stored;
  stored = storedRecord(view, worlds[0]);
  assert.equal(stored.portalArrivals[1], inbox);
  worlds[0] = stored;
  // The next load of the End delivers it; then the save drops the inbox.
  view = viewRecord(worlds[0], 1);
  assert.equal(view.pendingArrivals, inbox);
  live.deliverArrivals({ set() {} }, view);
  assert.equal(view.entities.length, 1);
  assert.equal(inbox.late, undefined);
  assert.equal(storedRecord(view, worlds[0]).portalArrivals, undefined);
});

test("a natural End mob (no saved Dimension) still leaves through the exit portal for the Overworld spawn", async () => {
  const root = makeRoot(), view = viewRecord(root, 1);
  const live = new DimensionLive({ active: () => view, worlds: () => [root], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 5, z: 0, yaw: 0 }), openWorld: async () => {} });
  live.readEdits = async () => [];
  live.peekFor = async () => ({ writes: [], actualHeight: 256, get: (x, y) => (y < 64 ? 1 : 0), teleporter: { cache: new Map(), keys: [], placeInPortal() { throw new Error("no Teleporter from the End"); } } });
  live.shareTeleporter = (r, to, peek) => peek.teleporter;
  const mobs = new EntityWorld({ ...air, dimension: 1 }, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10 }], () => 0.5);
  live.tickEntities(endPortalWorld(1), { mobs });
  await live.settle();
  const rec = root.portalArrivals[0].entities[0];
  assert.deepEqual([rec.x, rec.y, rec.z], [3, 64, -5], "the world spawn at its top");
  assert.equal(root.portalArrivals[0].late, undefined);
});

test("an Overworld mob tagged Dimension 1 goes through a Nether portal without the Teleporter, at x / 8 and its own y", async () => {
  const root = makeRoot();
  const live = new DimensionLive({ active: () => root, worlds: () => [root], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 5, z: 0, yaw: 0 }), openWorld: async () => {} });
  live.readEdits = async () => [];
  const mobs = new EntityWorld(air, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, nbtDimension: 1 }], () => 0.5);
  live.tickEntities(netherPortalWorld(0), { mobs }); live.tickEntities(netherPortalWorld(0), { mobs });
  await live.settle();
  const inbox = root.portalArrivals[-1], rec = inbox.entities[0];
  assert.deepEqual([rec.x, rec.y, rec.z], [64.5 / 8, 5, 64.5 / 8]);
  assert.equal(inbox.writes.length, 0, "no portal was built");
  assert.equal(rec.portalCooldown, 300);
  // The same mob without the tag takes the Teleporter (a portal is built near x / 8).
  const root2 = makeRoot();
  const live2 = new DimensionLive({ active: () => root2, worlds: () => [root2], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 5, z: 0, yaw: 0 }), openWorld: async () => {} });
  live2.readEdits = async () => [];
  const mobs2 = new EntityWorld(air, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10 }], () => 0.5);
  live2.tickEntities(netherPortalWorld(0), { mobs: mobs2 }); live2.tickEntities(netherPortalWorld(0), { mobs: mobs2 });
  await live2.settle();
  assert.ok(root2.portalArrivals[-1].writes.length > 0);
});

test("entityDeparture reports the saved Dimension as the source (the away run's finishAway delivers from it)", () => {
  const portals = new EntityPortals(), owner = { serializeOne: (e) => ({ ...e }) };
  const tagged = entityDeparture(portals, "item", { x: 1, y: 2, z: 3, nbtDimension: 1 }, { arg: -1, endPortal: false, direction: 0 }, owner);
  assert.equal(tagged.source, 1);
  assert.equal(tagged.rec.nbtDimension, undefined);
  assert.equal(entityDeparture(portals, "item", { x: 1, y: 2, z: 3 }, { arg: -1, endPortal: false, direction: 0 }, owner).source, undefined);
  const src = readFileSync(new URL("./dimension-live.js", import.meta.url), "utf8");
  assert.match(src, /this\.deliver\(root\.id, t\.source \?\? OVERWORLD,/);
});

// ---- 2. PortalCooldown on fireballs and rockets ----
test("fireballs and firework rockets count a positive PortalCooldown down by one per server update (ze.h / zf.h -> sa.h -> sa.C)", () => {
  const world = new World("entnbt89", "meadow", 1), mobs = new EntityWorld(world, []);
  mobs.isActive = () => true;
  const balls = new Fireballs(mobs);
  const b = balls.launch({ large: false, x: 8.5, y: 120, z: 8.5, exact: [8.5, 120, 8.5, 0, 0.1, 0] });
  b.portalCooldown = 3;
  const neg = balls.launch({ large: false, x: 10.5, y: 120, z: 10.5, exact: [10.5, 120, 10.5, 0, 0.1, 0] });
  neg.portalCooldown = -7;
  balls.tickOne(b); balls.tickOne(neg);
  assert.deepEqual([b.portalCooldown, neg.portalCooldown], [2, -7], "only a positive cooldown counts down");
  balls.tickOne(b); balls.tickOne(b);
  assert.equal(b.portalCooldown, undefined, "0 is left out of the record");
  // ze.h's setDead branch returns before super.onUpdate: no countdown.
  const gone = balls.launch({ large: false, x: 8.5, y: 300, z: 8.5, exact: [8.5, 300, 8.5, 0, 0.1, 0] });
  gone.portalCooldown = 5;
  balls.tickOne(gone);
  assert.deepEqual([gone.dead, gone.portalCooldown], [true, 5]);

  const r = createRocket(8.5, 120, 8.5, null, new JavaRandom(1));
  r.portalCooldown = 2;
  tickRocket(r, world, new JavaRandom(2));
  assert.equal(r.portalCooldown, 1);
  const client = createRocket(8.5, 120, 8.5, null, new JavaRandom(1));
  client.portalCooldown = 2;
  tickRocket(client, world, new JavaRandom(2), { remote: true, server: false });
  assert.equal(client.portalCooldown, 2, "sa.C counts only on a WorldServer");
});

// ---- 3. Mob Fire on import ----
test("a chunk mob keeps its raw Fire short (sa.f getShort); an absent Fire reads 0", () => {
  const mob = (extra) => tagOf({ id: t(NBT.STRING, "Pig"), Pos: dl(NBT.DOUBLE, [0.5, 70, 0.5]), Health: t(NBT.SHORT, 10), ...extra });
  assert.equal(javaMobFromNbt(mob({ Fire: t(NBT.SHORT, -20) })).fire, -20, "clamped to -1 before b89");
  assert.equal(javaMobFromNbt(mob({ Fire: t(NBT.SHORT, 15) })).fire, 15);
  assert.equal(javaMobFromNbt(mob({})).fire, 0);
  const zombie = tagOf({ id: t(NBT.STRING, "Zombie"), Pos: dl(NBT.DOUBLE, [0.5, 70, 0.5]), Health: t(NBT.SHORT, 20), Fire: t(NBT.SHORT, -300) });
  assert.equal(javaMobFromNbt(zombie).fire, -300);
});

// ---- 4. Eggs and bobbers ----
test("eggs and fishing bobbers are never saved natively (no EntityList id: writeToNBTOptional returns false), and the export writes neither", async () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/projectile-nbt-reference.json", import.meta.url), "utf8"));
  const egg = ref.projectiles.find((p) => p.kind === "egg");
  assert.deepEqual([egg.id, egg.saved], [null, false], "executed: EntityEgg's writeToNBTOptional refuses it");
  assert.equal(javaProjectileToNbt("projectiles", { kind: "egg", x: 0, y: 70, z: 0 }), null);
  const { overworld, report } = await exportChunk({ projectiles: [{ kind: "egg", x: -3.5, y: 101, z: -3.5, mx: 0, my: 0, mz: 0 }], fishing: { x: -4.5, y: 101, z: -4.5 } });
  assert.equal(overworld.length, 0);
  assert.equal(report.unsupportedEntities, 1, "the egg is counted; the bobber is not a saved list");
});

// ---- 5. Entity base keys in native order ----
async function exportChunk(state) {
  const { exportJavaSave } = await import("./region-export.js");
  const { regionSlot, readRegion, decodeRegionChunk, regionAddress } = await import("./region-file.js");
  const { chunkFromNbt } = await import("./chunk-nbt.js");
  const w = new World("17", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const { files, report } = await exportJavaSave({ id: "e89", name: "E89", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, ...state }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz), file = files.get(`region/r.${a.regionX}.${a.regionZ}.mca`), slot = file && readRegion(file).get(regionSlot(a.x, a.z));
  return { overworld: slot ? chunkFromNbt(await decodeRegionChunk(slot), { hasSky: true }).entities ?? [] : [], report };
}
const BASE = ["id", "Pos", "Motion", "Rotation", "FallDistance", "Fire", "Air", "OnGround", "Dimension", "Invulnerable", "PortalCooldown", "UUIDMost", "UUIDLeast"];

test("every exported kind starts with id and the Entity base keys in sa.e's order", async () => {
  const at = (x) => ({ x, y: 101, z: x });
  const proj = (id, extra = {}) => javaProjectileFromNbt(tagOf({ id: t(NBT.STRING, id), Pos: dl(NBT.DOUBLE, [0, 70, 0]), Motion: dl(NBT.DOUBLE, [0, 0.1, 0]), direction: dl(NBT.DOUBLE, [0, 0.1, 0]), ...extra }), {});
  const potionItem = t(NBT.COMPOUND, tagOf({ id: t(NBT.SHORT, 373), Count: t(NBT.BYTE, 1), Damage: t(NBT.SHORT, 16384) }));
  const rocketItem = t(NBT.COMPOUND, tagOf({ id: t(NBT.SHORT, 401), Count: t(NBT.BYTE, 1), Damage: t(NBT.SHORT, 0) }));
  const made = [proj("Snowball"), proj("ThrownEnderpearl"), proj("ThrownExpBottle"), proj("ThrownPotion", { Potion: potionItem }), proj("Arrow"), proj("Fireball"), proj("SmallFireball"), proj("WitherSkull"),
    proj("EyeOfEnderSignal"), proj("FireworksRocketEntity", { FireworksItem: rocketItem })];
  const state = { entities: [{ type: "pig", id: "mob-1", health: 10, ...at(-1.5) }, { type: "ender_crystal", id: "mob-2", health: 5, ...at(-1.5) }], drops: [{ stack: { id: 1, count: 1, damage: 0 }, ...at(-2.5) }], xpOrbs: [{ value: 3, ...at(-3.5) }],
    tnt: [{ fuse: 80, ...at(-4.5) }], falling: [{ block: 12, meta: 0, ticks: 1, ...at(-5.5) }], boats: [{ ...at(-6.5) }], minecarts: { version: 1, carts: [{ type: 0, ...at(-7.5) }, { type: 1, items: [], ...at(-7.5) }] },
    hanging: [{ kind: "painting", dir: 0, art: "Kebab", tx: -9, ty: 101, tz: -10, ...at(-8.5) }, { kind: "frame", dir: 0, tx: -10, ty: 101, tz: -11, ...at(-9.5) }] };
  for (const m of made) { assert.ok(m.record, JSON.stringify(m)); (state[m.list] ??= []).push({ ...m.record, ...at(-10.5) }); }
  state.eyes = { eyes: state.eyes }; state.rockets = { rockets: state.rockets }; // EyesOfEnder / FireworkRockets serialize() shapes
  const { overworld } = await exportChunk(state);
  const ids = overworld.map((n) => n.get("id").value).sort();
  assert.deepEqual(ids, ["Arrow", "Boat", "EnderCrystal", "EyeOfEnderSignal", "FallingSand", "Fireball", "FireworksRocketEntity", "ItemFrame", "Item", "MinecartChest", "MinecartRideable", "Painting", "Pig", "PrimedTnt",
    "SmallFireball", "Snowball", "ThrownEnderpearl", "ThrownExpBottle", "ThrownPotion", "WitherSkull", "XPOrb"].sort());
  for (const n of overworld) assert.deepEqual([...n.keys()].slice(0, BASE.length), BASE, n.get("id").value);
});
