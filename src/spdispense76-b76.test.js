// Batch 76 (spdispense76): the single-player dispenser's bucket rules and level events. The 240 executed records of tools/probes/SpDispense76Probe.java
// (the unchanged filled-bucket dispense behaviour in front of 15 blocks, Overworld and Nether) are replayed through createRedstoneRuntime with the hooks main.js gives it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WATER, LAVA } from "./world.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { fromOriginal } from "./block-registry.js";
import { JavaRandom } from "./java-random.js";
import { DISPENSER } from "./dispenser-piston.js";
import { ITEM } from "./dispense.js";
import { replaceableCell, netherFizz, equipArmor } from "./sp-dispense76.js";
import { dispenserAux } from "./multiplayer/client-containers.js";
import { ITEMS } from "./survival.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/sp-dispense76-reference.json", import.meta.url)));
const X = 20, Y = 20, Z = 20, PX = 10, PY = 64, PZ = 10, // the probe's dispenser stood at (10, 64, 10); this 64-high World is replayed at (20, 20, 20)
   FACE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const ORIGINAL = { 325: ITEM.BUCKET, 326: ITEM.WATER_BUCKET, 327: ITEM.LAVA_BUCKET };

function run(r, extra = {}) {
  const world = new World("spdispense76", "meadow");
  for (let x = 16; x <= 24; x++) for (let y = 16; y <= 24; y++) for (let z = 16; z <= 24; z++) world.put(x, y, z, 0, 0, false);
  const [fx, fy, fz] = FACE[r.facing], tx = X + fx, ty = Y + fy, tz = Z + fz;
  const sounds = [], aux = [], thrown = [], broke = [], rand = new JavaRandom(9n);
  const game = {
    dispensers: () => tiles, sound: (...a) => sounds.push(a), markUnsaved() {}, maxStack: () => 64,
    auxEffect: (e) => aux.push(e),
    dispense: {
      rng: () => new JavaRandom(1n),
      spawnItem: (stack) => thrown.push(stack),
      setLiquid: (x, y, z, id) => world.set(x, y, z, id === 10 ? LAVA : WATER, true, 0),
      setAir: (x, y, z) => world.set(x, y, z, 0, true, 0),
      breakBlock: (x, y, z) => { broke.push([x, y, z]); world.set(x, y, z, 0, true, 0); },
      isReplaceable: (id, w, x, y, z) => replaceableCell(world, x, y, z),
      nether: () => r.nether, fizz: (x, y, z) => netherFizz((...a) => sounds.push(a), x, y, z, () => rand.nextFloat()),
      ...extra,
    },
  };
  const tiles = {};
  const rt = createRedstoneRuntime({ world, game });
  world.put(X, Y, Z, DISPENSER, r.facing, false);
  const [id, count, damage] = r.item.split(":").map(Number);
  tiles[`${X},${Y},${Z}`] = { items: [{ id: ORIGINAL[id], count, damage }, null, null, null, null, null, null, null, null] };
  if (r.cell > 0) { const c = fromOriginal(r.cell, r.meta); assert.ok(c, `original ${r.cell}`); world.put(tx, ty, tz, c.id, c.meta ?? 0, false); }
  rt.redstone.behaviours[23].updateTick(rt.redstone, X, Y, Z);
  return { world, tiles, sounds, aux, thrown, broke, tx, ty, tz };
}

test("the reference was recorded from the unchanged 1.7.10 client", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(ref.rows.length, 240);
});

test("every executed filled-bucket record: replaceable blocks are replaced, solid ones refuse (the bucket is thrown), the Nether fizzes instead of placing (replayed)", () => {
  let replaced = 0, refused = 0, fizzed = 0;
  for (const r of ref.rows) {
    const label = `${r.name} nether=${r.nether} cell=${r.cell} f${r.facing}`;
    const o = run(r);
    const slot = o.tiles[`${X},${Y},${Z}`].items[0];
    const placedFizz = r.log.some((l) => l.startsWith("sound,"));
    const placed = r.log.some((l) => l.startsWith("set,"));
    if (!r.after[0]) { // the native stack is gone: the bucket was thrown as an item (a refused cell), the dispenser keeps nothing
      assert.equal(o.thrown.length, 1, label); assert.equal(slot, null, label); refused++; continue;
    }
    assert.equal(o.thrown.length, 0, label);
    assert.equal(slot.id, ITEM.BUCKET, label); assert.equal(slot.count, 1, label);
    assert.equal(r.log.some((l) => l.startsWith("break,")), o.broke.length > 0, label + " break");
    if (placedFizz) {
      fizzed++;
      assert.equal(placed, false, label); assert.equal(o.broke.length, 0, label + " the Nether branch breaks nothing");
      assert.equal(o.sounds.length, 1, label);
      const [name, x, y, z, volume] = o.sounds[0], want = r.log.find((l) => l.startsWith("sound,")).split(",");
      assert.equal(name, "random.fizz", label); assert.equal(volume, 0.5, label);
      assert.deepEqual([x, y, z], [Number(want[1]) - PX + X, Number(want[2]) - PY + Y, Number(want[3]) - PZ + Z], label);
      assert.equal(Math.fround(o.sounds[0][5]), Math.fround(Number(want[6])), label + " pitch");
    } else {
      replaced++;
      assert.equal(o.sounds.length, 0, label);
      assert.equal(o.world.get(o.tx, o.ty, o.tz), r.name === "lava" ? LAVA : WATER, label);
      const wantSet = r.log.find((l) => l.startsWith("set,")).split(",");
      assert.equal(Number(wantSet[4]), r.name === "lava" ? 10 : 8, label);
    }
    // the level events: the click then the smoke with the facing's direction word
    const [auxClick, auxSmoke] = r.log.filter((l) => l.startsWith("aux,")).map((l) => l.split(",").map(Number));
    assert.deepEqual(o.aux.map((e) => [e.id, e.x, e.y, e.z, e.data]), [[auxClick[1], auxClick[2] - PX + X, auxClick[3] - PY + Y, auxClick[4] - PZ + Z, auxClick[5]], [auxSmoke[1], auxSmoke[2] - PX + X, auxSmoke[3] - PY + Y, auxSmoke[4] - PZ + Z, auxSmoke[5]]], label + " aux");
  }
  assert.ok(replaced === 132 && refused === 64 && fizzed === 44, `${replaced} replaced, ${refused} refused, ${fizzed} fizzed`);
});

test("replaceableCell agrees with Material.isSolid on the probed blocks (torch, ladder, snow layer, grass, flower, fire, carpet, wheat replaced; stone, web, glass, sign refused)", () => {
  for (const [id, want] of [[0, true], [50, true], [65, true], [78, true], [31, true], [37, true], [51, true], [171, true], [59, true], [1, false], [30, false], [20, false], [63, false]]) {
    const world = new World("spdispense76-cell", "meadow");
    world.put(5, 5, 5, 0, 0, false);
    if (id) { const c = fromOriginal(id, 0); world.put(5, 5, 5, c.id, c.meta ?? 0, false); }
    assert.equal(replaceableCell(world, 5, 5, 5), want, `original ${id}`);
  }
});

test("a spawn egg, a boat, a worn piece and a replaceable cell reach the game's hooks (they were never forwarded)", () => {
  const calls = [];
  const world = new World("spdispense76-fwd", "meadow");
  for (let x = 16; x <= 24; x++) for (let y = 16; y <= 24; y++) for (let z = 16; z <= 24; z++) world.put(x, y, z, 0, 0, false);
  const tiles = {};
  const game = { dispensers: () => tiles, sound() {}, markUnsaved() {}, maxStack: () => 64, dispense: {
    rng: () => new JavaRandom(1n), spawnItem: () => calls.push("item"),
    spawnEgg: () => calls.push("egg"), boat: () => calls.push("boat"), armorType: (s) => ITEMS[s.id]?.armor, equip: () => { calls.push("equip"); return true; },
  } };
  const rt = createRedstoneRuntime({ world, game });
  const fire = (stack, cell) => {
    world.put(X, Y, Z, DISPENSER, 3, false); world.put(X, Y, Z + 1, 0, 0, false); world.put(X, Y - 1, Z + 1, 0, 0, false);
    if (cell) world.put(X, Y, Z + 1, cell, 0, false);
    tiles[`${X},${Y},${Z}`] = { items: [stack, null, null, null, null, null, null, null, null] };
    rt.redstone.behaviours[23].updateTick(rt.redstone, X, Y, Z);
  };
  fire({ id: ITEM.SPAWN_EGG, count: 1, damage: 90 });
  fire({ id: ITEM.BOAT, count: 1, damage: 0 }, WATER);
  const helmet = Object.values(ITEMS).find((i) => i.armor === 0);
  fire({ id: helmet.id, count: 1, damage: 0 });
  assert.deepEqual(calls, ["egg", "boat", "equip"]);
  // a game with no boat hook still throws the boat as an item
  const bare = { dispensers: () => tiles, sound() {}, markUnsaved() {}, maxStack: () => 64, dispense: { rng: () => new JavaRandom(1n), spawnItem: () => calls.push("thrown") } };
  const rt2 = createRedstoneRuntime({ world, game: bare });
  world.put(X, Y, Z + 1, WATER, 0, false);
  tiles[`${X},${Y},${Z}`] = { items: [{ id: ITEM.BOAT, count: 1, damage: 0 }, null, null, null, null, null, null, null, null] };
  rt2.redstone.behaviours[23].updateTick(rt2.redstone, X, Y, Z);
  assert.equal(calls.at(-1), "thrown");
});

test("without an auxEffect hook the clicks sound at the block corner with the 1000 / 1001 / 1002 pitches (RenderGlobal.playAuxSFX, bytecode-read)", () => {
  const sounds = [], world = new World("spdispense76-aux", "meadow");
  const tiles = { [`${X},${Y},${Z}`]: { items: Array(9).fill(null) } };
  const rt = createRedstoneRuntime({ world, game: { dispensers: () => tiles, sound: (...a) => sounds.push(a), markUnsaved() {}, maxStack: () => 64, dispense: {} } });
  world.put(X, Y, Z, DISPENSER, 3, false);
  rt.redstone.behaviours[23].updateTick(rt.redstone, X, Y, Z); // empty: the failed click 1001
  assert.deepEqual(sounds, [["random.click", X, Y, Z, 1, 1.2]]);
});

test("dispenserAux draws 1000, 1001, 1002 at the corner, 1009 at the centre with volume 2, and 2000 as ten smoke puffs", () => {
  const played = [], puffs = [];
  const host = { play: (...a) => played.push(a), smoke: (...a) => puffs.push(a) };
  for (const id of [1000, 1001, 1002]) assert.equal(dispenserAux({ id, x: 3, y: 4, z: 5, data: 0 }, host), true);
  assert.deepEqual(played, [["random.click", 3, 4, 5, 1, 1], ["random.click", 3, 4, 5, 1, 1.2], ["random.bow", 3, 4, 5, 1, 1.2]]);
  played.length = 0;
  assert.equal(dispenserAux({ id: 1009, x: 3, y: 4, z: 5, data: 0 }, { ...host, random: () => 0.75 }), true);
  assert.deepEqual(played, [["mob.ghast.fireball", 3.5, 4.5, 5.5, 2, 1]]);
  assert.equal(dispenserAux({ id: 2000, x: 3, y: 4, z: 5, data: 7 }, host), true);
  assert.equal(puffs.length, 10);
});

test("armour worn: a player in the front cell without that piece gets one, one wearing it is skipped; a mob needs canPickUpLoot", () => {
  const survival = { health: 20, inventory: { armor: [null, null, null, null] } };
  const player = { position: { x: 10.5, y: 64, z: 11.5 }, width: 0.6, height: 1.8 };
  const piece = { id: 400, count: 3, damage: 0 };
  const args = { player, survival, mobs: { entities: [] }, size: () => [0.6, 1.95] };
  assert.equal(equipArmor(args, [10, 64, 11], piece, 4), true);
  assert.equal(survival.inventory.armor[3].count, 1);
  assert.equal(equipArmor(args, [10, 64, 11], piece, 4), false, "the helmet slot is full");
  assert.equal(equipArmor(args, [10, 64, 12], piece, 3), false, "nobody in that cell");
  const zombie = { type: "zombie", x: 12.5, y: 64, z: 11.5, health: 20, equipment: [null, null, null, null, null], dropChances: [0.085, 0.085, 0.085, 0.085, 0.085], canPickUpLoot: false };
  const mobArgs = { player: null, survival, mobs: { entities: [zombie] }, size: () => [0.6, 1.95] };
  assert.equal(equipArmor(mobArgs, [12, 64, 11], piece, 4), false, "a mob that cannot pick up loot is skipped");
  zombie.canPickUpLoot = true;
  assert.equal(equipArmor(mobArgs, [12, 64, 11], piece, 4), true);
  assert.equal(zombie.equipment[4].count, 1); assert.equal(zombie.dropChances[4], 2);
});

test("netherFizz: volume 0.5 at the cell centre, pitch 2.6 + (r - r) * 0.8", () => {
  const got = [];
  netherFizz((...a) => got.push(a), 1, 2, 3, () => 0.5);
  assert.deepEqual(got, [["random.fizz", 1.5, 2.5, 3.5, 0.5, Math.fround(2.6)]]);
});
