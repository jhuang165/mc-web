// GEN-05b live integration: generation version 10 is the default for new Java worlds, and the
// mineshaft spawners and chest minecarts it records become live state once (structure-simulation.js),
// then persist through saves (a looted cart stays looted, a broken cart or spawner stays gone).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { World, TORCH, FENCE, MOB_SPAWNER } from "./world.js";
import { originalBlockMapperReady } from "./mineshaft-world.js";
import { LightVolume, JavaRandom } from "./lighting.js";
import { PlayerInventory } from "./inventory.js";
import { ITEMS } from "./survival.js";
import { CHEST } from "./chest.js";
import { EntityWorld, moveEntity } from "./entities.js";
import { watchSpawnerBlocks } from "./spawner-block.js";
import { importedRuntime } from "./world-import.js";
import { MobSpawners } from "./mob-spawner.js";
import {
  hasSavedStructures, restoreStructureEntities, saveStructureEntities, tickMinecartSimulation,
  tickSpawnerSimulation, pickMinecart, useMinecart,
} from "./structure-simulation.js";

await originalBlockMapperReady;
const worlds = new Map();
const java = (seed, biome = "java", version) => {
  const key = `${seed}/${biome}/${version}`;
  if (!worlds.has(key)) worlds.set(key, version === undefined ? new World(seed, biome) : new World(seed, biome, version));
  return worlds.get(key);
};
// A save is the seed plus edits, so a reload regenerates the world and restores the saved fields.
const reload = (record) => {
  const w = new World(record.seed, record.biome, record.generationVersion);
  w.restore(record.edits ?? []);
  return w;
};
const saveRecord = (record, world, live) => JSON.parse(JSON.stringify({ ...record, edits: [...world.edits], ...saveStructureEntities(live) }));
const near = (cart, x, y, z) => Math.abs(cart.x - x) < 1e-9 && Math.abs(cart.posY - y) < 1e-9 && Math.abs(cart.z - z) < 1e-9;
const cartItems = (cart) => cart.slots.filter(Boolean).length + cart.unmapped.filter(Boolean).length;

test("GEN-05b live: new Java worlds default to generation version 10; legacy landscapes keep 8", () => {
  assert.equal(java("0").generationVersion, 10);
  assert.ok(java("0").generatedStructures);
  assert.equal(new World("0", "meadow").generationVersion, 8);
});

test("GEN-05b live: the reference worlds instantiate their spawners and chest carts on first creation", () => {
  const cases = [
    { seed: "0", biome: "java", spawner: [120, 31, 37], cart: [115.5, 43.5, 75.5] },
    { seed: "17", biome: "java", cart: [127.5, 41.5, 23.5] },
    { seed: "10", biome: "javaAmplified", spawner: [112, 26, 6], carts: 6 },
    { seed: "0", biome: "javaLargeBiomes", spawner: [60, 18, 113] },
  ];
  for (const c of cases) {
    const world = java(c.seed, c.biome), g = world.generatedStructures, label = `${c.seed}/${c.biome}`;
    const live = restoreStructureEntities({ seed: c.seed, biome: c.biome, generationVersion: 10 }, world);
    assert.equal(live.fresh, true, label);
    assert.equal(live.spawners.size, g.spawners.length, label);
    assert.equal(live.minecarts.carts.length, g.minecartChests.length, label);
    if (c.spawner) {
      const s = live.spawners.get(...c.spawner);
      assert.equal(s?.entityId, "CaveSpider", label);
      assert.equal(world.get(...c.spawner), MOB_SPAWNER, label);
    }
    if (c.cart) {
      const cart = live.minecarts.carts.find((k) => near(k, ...c.cart));
      const record = g.minecartChests.find((r) => r.x === c.cart[0] && r.y === c.cart[1] && r.z === c.cart[2]);
      assert.ok(cart && record, label);
      assert.equal(cartItems(cart), record.items.length, label);
    }
    if (c.carts) assert.equal(live.minecarts.carts.length, c.carts, label);
    assert.deepEqual(live.pendingTicks, [], label);
  }
});

test("GEN-05b live: save then reload neither duplicates nor refills carts and spawners", () => {
  const base = { seed: "0", biome: "java", generationVersion: 10, edits: [] };
  const world = reload(base), live = restoreStructureEntities(base, world);
  const saved = saveRecord(base, world, live);
  assert.ok(hasSavedStructures(saved));
  const again = restoreStructureEntities(saved, reload(saved));
  assert.equal(again.fresh, false);
  assert.deepEqual(saveStructureEntities(again), saveStructureEntities(live));
  // A second round trip stays the same size (the generation records are not added again).
  const third = restoreStructureEntities(saveRecord(saved, reload(saved), again), reload(saved));
  assert.equal(third.minecarts.carts.length, live.minecarts.carts.length);
  assert.equal(third.spawners.size, live.spawners.size);
});

test("GEN-05b live: a looted cart stays looted after a reload of the regenerated world", () => {
  const base = { seed: "0", biome: "java", generationVersion: 10, edits: [] };
  const world = reload(base), live = restoreStructureEntities(base, world);
  const cart = live.minecarts.carts.find((k) => near(k, 115.5, 43.5, 75.5)), before = cartItems(cart);
  assert.ok(before > 0);
  const player = { inventory: new PlayerInventory(ITEMS), creative: false };
  const opened = [];
  assert.deepEqual(useMinecart({ minecarts: live.minecarts, survival: player }, { place: true, cart }, { openContainer: (c) => opened.push(c) }), { handled: true, branch: "open-minecart" });
  const container = opened[0];
  assert.equal(container.rows, 3);
  assert.equal(container.title, "Minecart");
  for (let i = 0; i < 27; i++) if (container.slots[i].has) container.click(i, 0, 1);
  container.close();
  const mappedLeft = cart.slots.filter(Boolean).length;
  assert.equal(mappedLeft, 0, "every mapped stack moved to the player");
  const saved = saveRecord(base, world, live);
  const back = restoreStructureEntities(saved, reload(saved)).minecarts.carts.find((k) => near(k, 115.5, 43.5, 75.5));
  assert.ok(back, "the looted cart is still there");
  assert.equal(back.slots.filter(Boolean).length, 0);
  assert.equal(cartItems(back), cart.unmapped.filter(Boolean).length);
  assert.ok(reload(saved).generatedStructures.minecartChests.some((r) => r.x === 115.5 && r.items.length === before), "regeneration still lists the full loot");
});

test("GEN-05b live: a broken cart spills and stays gone; a broken spawner block loses its record", () => {
  const base = { seed: "0", biome: "java", generationVersion: 10, edits: [] };
  const world = reload(base), live = restoreStructureEntities(base, world);
  const count = live.minecarts.carts.length, cart = live.minecarts.carts.find((k) => near(k, 115.5, 43.5, 75.5));
  const player = { inventory: new PlayerInventory(ITEMS), creative: false, exhausted: 0, exhaust(n) { this.exhausted += n; } };
  // Bare-handed survival hits: damage 10 each, the cart breaks once damage exceeds 40.
  const state = { minecarts: live.minecarts, survival: player, position: { x: 115, y: 43, z: 73 }, velocity: { x: 0, y: 0, z: 0 }, motion: { sprinting: false }, yaw: 0 };
  let swings = 0;
  for (let i = 0; i < 4; i++) assert.equal(useMinecart(state, { place: false, cart }, { swing: () => swings++, damage: () => 1 }).branch, "hit-minecart");
  assert.equal(useMinecart(state, { place: false, cart }, { swing: () => swings++, damage: () => 1 }).branch, "break-minecart");
  assert.equal(swings, 5);
  assert.ok(Math.abs(player.exhausted - 1.5) < 1e-9);
  const drops = [];
  tickMinecartSimulation({ world, minecarts: live.minecarts, mobs: null, position: { x: 0, y: 200, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, width: 0.6, height: 1.8 }, { drop: (d) => drops.push(d) });
  assert.equal(live.minecarts.carts.length, count - 1);
  // The spilled loot, then the minecart and chest items (original 328 and 54, both mapped).
  assert.ok(drops.length >= 3);
  assert.deepEqual(drops.slice(-2).map((d) => d.stack?.id), [366, CHEST]);
  // The spawner: a block edit removes the tile entity at once (watchSpawnerBlocks) and for good.
  watchSpawnerBlocks(world, live.spawners);
  world.set(120, 31, 37, 0);
  assert.equal(live.spawners.get(120, 31, 37), null);
  const saved = saveRecord(base, world, live);
  const back = restoreStructureEntities(saved, reload(saved));
  assert.equal(back.minecarts.carts.length, count - 1);
  assert.ok(!back.minecarts.carts.some((k) => near(k, 115.5, 43.5, 75.5)));
  assert.equal(back.spawners.get(120, 31, 37), null);
  assert.ok(back.spawners.get(118, 44, 119));
  // A saved spawner whose cell is no longer a spawner (an edit saved before the record) is dropped.
  const stale = restoreStructureEntities({ ...saved, spawners: [...saved.spawners, { x: 120, y: 31, z: 37, EntityId: "CaveSpider" }] }, reload(saved));
  assert.equal(stale.spawners.get(120, 31, 37), null);
});

test("GEN-05b live: version 9 saves regenerate byte-identically and carry no structure entities", () => {
  const hash = (w) => {
    const h = createHash("sha1");
    for (const c of [...w.chunks.values()].sort((a, b) => a.x - b.x || a.z - b.z)) { h.update(c.blocks); h.update(c.meta); }
    return h.digest("hex");
  };
  // The v9 hashes of the committed (pre-mineshaft) build for the same seeds.
  assert.equal(hash(java("0", "java", 9)), "c4621fe3c19a34febc010fee761868bee80c5ea6");
  assert.equal(hash(java("10", "javaAmplified", 9)), "590a46dddf0bd86fc1879bbc44d9cb0a12bdf784");
  const v9 = { seed: "0", biome: "java", generationVersion: 9, edits: [] }, world = reload(v9);
  assert.equal(world.generationVersion, 9);
  assert.equal(world.generatedStructures, undefined);
  const live = restoreStructureEntities(v9, world);
  assert.equal(live.spawners.size, 0);
  assert.equal(live.minecarts.carts.length, 0);
  assert.deepEqual(saveStructureEntities(live), { spawners: [], minecarts: { version: 1, carts: [] } });
});

test("GEN-05b live: mineshaft torches give block light 14 once the light volume is built", () => {
  const world = java("0"), light = new LightVolume(world);
  let torches = 0;
  for (const m of world.generatedStructures.mineshafts) {
    const [x0, y0, z0, x1, y1, z1] = m.boundingBox;
    for (let x = Math.max(0, x0); x <= Math.min(127, x1); x++)
      for (let z = Math.max(0, z0); z <= Math.min(127, z1); z++)
        for (let y = Math.max(0, y0); y <= y1; y++)
          if (world.get(x, y, z) === TORCH) {
            torches++;
            assert.equal(light.blockAt(x, y, z), 14);
          }
  }
  assert.ok(torches > 0);
});

test("GEN-05b live: imports carry validated spawner and minecart state", () => {
  const good = {
    spawners: [{ x: 1, y: 2, z: 3, EntityId: "CaveSpider", Delay: 20, bogus: "x" }, { x: 1.5, y: 2, z: 3 }],
    minecarts: { version: 1, carts: [{ x: 1.5, y: 2.5, z: 3.5, motion: [0, 0, 0], items: [{ slot: 0, id: 4, count: 3 }, { slot: 40, id: 4, count: 1 }, { slot: 1, id: 403, count: 1, stored: [{ id: 16, lvl: 2 }, { id: "x" }] }] }, { x: "bad" }] },
  };
  const out = importedRuntime(good);
  assert.deepEqual(out.spawners, [{ x: 1, y: 2, z: 3, EntityId: "CaveSpider", Delay: 20 }]);
  assert.equal(out.minecarts.carts.length, 1);
  assert.deepEqual(out.minecarts.carts[0].items, [{ slot: 0, id: 4, damage: 0, count: 3 }, { slot: 1, id: 403, damage: 0, count: 1, stored: [{ id: 16, lvl: 2 }] }]);
  assert.equal(MobSpawners.fromJSON(out.spawners).size, 1);
  // Malformed fields are dropped, so the world launches as one without saved structure state.
  const bad = importedRuntime({ spawners: "nope", minecarts: { carts: 3 } });
  assert.equal(Object.hasOwn(bad, "spawners") || Object.hasOwn(bad, "minecarts"), false);
  assert.equal(hasSavedStructures(bad), false);
  // An older export without the fields imports as before.
  assert.deepEqual(importedRuntime({ position: { x: 1, y: 2, z: 3 } }), { position: { x: 1, y: 2, z: 3 } });
});

test("GEN-05b live: carts are picked with the 0.1 border, push the player and block nothing", () => {
  const world = java("0"), live = restoreStructureEntities({}, world), carts = live.minecarts;
  const cart = carts.carts.find((k) => near(k, 115.5, 43.5, 75.5));
  const eye = { x: 115.5, y: cart.bb[4] + 0.05, z: 73.5 }, dir = { x: 0, y: 0, z: 1 };
  // The ray runs 0.05 above the box top: only the border makes it a hit.
  const hit = pickMinecart(carts, eye, dir, 3);
  assert.equal(hit?.cart, cart);
  assert.ok(Math.abs(hit.distance - (cart.bb[2] - 0.1 - eye.z)) < 1e-6);
  assert.equal(pickMinecart(carts, eye, dir, 1), null, "out of reach");
  assert.equal(pickMinecart(carts, eye, dir, 3, 1), null, "behind a block");
  // A player standing in the cart's edge is pushed away from it (applyEntityCollision's 1/4 share).
  const position = { x: 115.5, y: cart.bb[1], z: cart.z - 0.75 }, velocity = { x: 0, y: 0, z: 0 };
  tickMinecartSimulation({ world, minecarts: carts, mobs: null, position, velocity, width: 0.6, height: 1.8 });
  assert.ok(velocity.z < 0, `pushed back ${velocity.z}`);
});

test("GEN-05b live: an active mineshaft spawner spawns cave spiders with the aux 2004 burst", () => {
  const world = java("0"), live = restoreStructureEntities({}, world);
  const mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(5);
  const random = new JavaRandom(1), bursts = [];
  let spawned = [];
  for (let t = 0; t < 400 && !spawned.length; t++)
    spawned = tickSpawnerSimulation({ spawners: live.spawners, mobs, minecarts: live.minecarts, random, feet: { x: 120.5, y: 31, z: 40.5 } },
      { skyLight: () => 0, lightValue: () => 0, thunderLightValue: () => 0, thundering: () => false }, { spawnParticles: (x, y, z) => bursts.push([x, y, z]) });
  assert.ok(spawned.length > 0);
  assert.ok(spawned.every((e) => e.type === "cave_spider" && mobs.entities.includes(e)));
  assert.deepEqual(bursts[0], [120, 31, 37]);
  // Without a player within 16 blocks nothing ticks.
  const idle = restoreStructureEntities({}, world);
  assert.deepEqual(tickSpawnerSimulation({ spawners: idle.spawners, mobs, minecarts: idle.minecarts, random, feet: { x: 0, y: 200, z: 0 } }, {}), []);
});

test("Fence collision for mobs uses the post and arm boxes, not the full cell", () => {
  const world = new World("fence-mob", "meadow");
  const fx = 40, fy = 55, fz = 40;
  for (let x = fx - 2; x <= fx + 2; x++) for (let z = fz - 3; z <= fz + 3; z++) { world.set(x, fy - 1, z, 1, false); for (let y = fy; y < fy + 3; y++) world.set(x, y, z, 0, false); }
  world.set(fx, fy, fz, FENCE, false);
  // A 0.6-wide mob whose box clears the 0.375-0.625 post walks through the fence cell's west half.
  const e = { x: fx, y: fy, z: fz - 1, vx: 0, vy: 0, vz: 0, onGround: true, fallDistance: 0 };
  moveEntity(world, e, 0.6, 0.9, 0, 0, 1.5);
  assert.ok(Math.abs(e.z - (fz + 0.5)) < 1e-9, `passed the post at z ${e.z}`);
  // Centred on the post, it stops at the post's face.
  const g = { x: fx + 0.5, y: fy, z: fz - 1, vx: 0, vy: 0, vz: 0, onGround: true, fallDistance: 0 };
  moveEntity(world, g, 0.6, 0.9, 0, 0, 1.5);
  assert.ok(Math.abs(g.z + 0.3 - (fz + 0.375)) < 1e-6, `stopped at ${g.z}`);
});
