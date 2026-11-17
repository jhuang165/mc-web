// Batch 78 (loot78): floor pickup for every EntityLiving that carries canPickUpLoot, the server's mobs sharing that code and being dressed by server dispensers, and the armour
// renderers. Evidence: bytecode-read sw.e (EntityLiving.onLivingUpdate), sw.b(add), yq / yl onSpawnWithEgg, bpf (RenderZombie) and bnw (RenderBiped) from the 1.7.10 jar.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { toLiveStack } from "./mob-equipment-live.js";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { mobCandidate, dressMob } from "./sp-dispense76.js";

globalThis.WebSocket ??= { OPEN: 1 };
const flat = { get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, solid: (x, y) => y < 0, isSolid: (x, y) => y < 0 };
const itemBox = (i) => [i.x - 0.125, i.y, i.z - 0.125, i.x + 0.125, i.y + 0.25, i.z + 0.125];
const lying = (id, count = 1) => ({ stack: { id: toLiveStack({ id, count: 1, damage: 0 }).id, count, damage: 0 }, x: 8, y: 0, z: 8, dead: false });

test("pickup is not limited to zombie / skeleton / pigman: any living mob with canPickUpLoot takes an item (bytecode-read sw.e tests only bJ, alive and mobGriefing)", () => {
  for (const type of ["creeper", "cow", "villager", "wolf", "zombie"]) {
    const world = new EntityWorld(flat, [{ id: "m", type, x: 8, y: 0, z: 8, health: 10 }], () => 0.5);
    const [m] = world.entities, item = lying(267);
    world.lootItems = { items: [item], box: itemBox };
    world.lootPickup();
    assert.equal(item.dead, false, `${type}: without the flag nothing happens`);
    m.canPickUpLoot = true;
    world.lootPickup();
    assert.equal(m.equipment[0]?.id, 267, `${type} holds the sword`);
    assert.equal(m.dropChances[0], 2);
    assert.equal(m.persistent, true);
    assert.equal(item.dead, true);
  }
});

test("a dead mob picks nothing up; a size 0 stack is still taken (xk.f() is only null-checked)", () => {
  const world = new EntityWorld(flat, [{ id: "m", type: "cow", x: 8, y: 0, z: 8, health: 10 }], () => 0.5);
  const [m] = world.entities, item = lying(267, 0);
  m.canPickUpLoot = true;
  world.lootItems = { items: [item], box: itemBox };
  m.health = 0; world.lootPickup();
  assert.equal(item.dead, false);
  m.health = 10; world.lootPickup();
  assert.equal(item.dead, true, "count 0 is picked up");
  assert.equal(m.equipment[0].count, 0);
});

test("the server's EntityWorld sees the server's item entities", () => {
  const world = new World("loot78-b78");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  assert.equal(s.mobs.mobs.lootItems, s.items, "the pickup loop reads host.items");
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("a", "ax", "00000000-0000-0000-0000-000000000001"); p.position.copy({ x: 70.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  const z = s.mobs.mobs.create("zombie", 64.5, 10, 64.5); s.mobs.mobs.entities.push(z);
  z.canPickUpLoot = true; z.equipment = [null, null, null, null, null];
  const sword = toLiveStack({ id: 267, count: 1, damage: 0 }).id;
  s.items.spawn({ id: sword, count: 1, damage: 0 }, 64.5, 10.3, 64.5);
  for (let i = 0; i < 4; i++) s.tick();
  assert.equal(z.equipment[0]?.id, 267, "the server zombie picked the sword up");
  assert.equal(s.items.items.filter((e) => !e.dead).length, 0);
  assert.equal(z.persistent, true);
});

test("a server dispenser dresses a canPickUpLoot mob in front, any type, and ignores one without the flag", () => {
  const world = new World("loot78-b78-disp");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  s.containers.ticks.rand = new JavaRandom(7);
  const p = s.addPlayer("a", "ax", "00000000-0000-0000-0000-000000000001"); p.position.copy({ x: 100.5, y: 10, z: 100.5 }); p.previous.copy(p.position);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  const cow = s.mobs.mobs.create("cow", 64.5, 10, 63.5); cow.canPickUpLoot = true; s.mobs.mobs.entities.push(cow);
  const pig = s.mobs.mobs.create("pig", 64.5, 10, 63.5); s.mobs.mobs.entities.push(pig);
  s.world.set(64, 10, 62, 115, true, 3);
  s.tiles.dispensers["64,10,62"] = { items: [makeStack(400, 2), ...Array(8).fill(null)] };
  s.world.set(65, 10, 62, 123);
  for (let i = 0; i < 6; i++) s.tick();
  assert.equal(cow.equipment?.[4]?.id, 298, "leather cap on the cow's helmet slot (native id 298)");
  assert.equal(cow.dropChances[4], 2);
  assert.ok(!pig.equipment, "no flag, no cap");
  assert.equal(s.tiles.dispensers["64,10,62"].items[0].count, 1);
});

test("mobCandidate / dressMob (shared selector): the slot must be empty and the box in the cell", () => {
  const size = () => [0.6, 1.8];
  const e = { x: 5.5, y: 3, z: 5.5, health: 5, canPickUpLoot: true, equipment: [null, null, null, null, { id: 298, count: 1, damage: 0 }] };
  assert.equal(mobCandidate(e, [5, 3, 5], 4, size), null, "helmet slot taken");
  assert.ok(mobCandidate(e, [5, 3, 5], 3, size));
  assert.equal(mobCandidate(e, [9, 3, 5], 3, size), null, "outside the cell");
  assert.equal(mobCandidate({ ...e, canPickUpLoot: false }, [5, 3, 5], 3, size), null);
  assert.equal(dressMob(e, { id: toLiveStack({ id: 299, count: 1, damage: 0 }).id, count: 4, damage: 0 }, 3), true);
  assert.deepEqual([e.equipment[3].id, e.equipment[3].count, e.dropChances[3]], [299, 1, 2]);
});

test("spawn flag (bytecode-read): only the zombie family and skeletons roll canPickUpLoot at spawn (yq.a, yl.a at 0.55 x local difficulty); everything else only through NBT", () => {
  const world = new EntityWorld(flat, [], () => 0.5);
  world.localDifficulty = () => 1; world.difficulty = 3;
  for (const type of ["cow", "creeper", "spider", "villager"]) { const e = world.spawnNatural(type, 8, 0, 8); assert.ok(!e.canPickUpLoot, type); }
});

test("armour renderers (bytecode-read): RenderBiped's only subclasses are RenderSkeleton and RenderZombie (zombie, pigman, zombie villager); the villager uses ModelZombieVillager armour with an 8x6x8 head", () => {
  const src = readFileSync(new URL("./mob-equipment-renderer.js", import.meta.url), "utf8");
  assert.ok(!/r\.villager\) return/.test(src), "villager zombies are no longer skipped");
  assert.ok(src.includes("[-4, -10, -4, 8, 6, 8]"));
  assert.ok(/!GEAR_TYPES\.has\(e\.type\)/.test(src), "other mob types draw no armour, as natively");
});
