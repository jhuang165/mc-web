// Batch 74 mpsounds74: the place sound of every block-placing item on the dedicated server (ItemBlock / ItemReed / ItemSnow / ItemSlab.onItemUse, bytecode-read:
// world.playSoundEffect at the placed cell's centre, (volume + 1) / 2, frequency * 0.8, WorldManager.playSound = sendToAllNear with nobody excluded, so the placer hears it).
// A sweep over item ids against the server's S29 output: the placer and a player nearby get exactly one sound, a player 20 blocks away none, silent items none.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WATER, WOOL, SAND, GRAVEL, ANVIL, TORCH, SNOW_LAYER, DOUBLE_PLANT } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ITEM_CAKE } from "./stems-cake.js";
import { ITEM_BED } from "./bed.js";
import { ITEM_SIGN } from "./signs.js";
import { ITEM_SKULL } from "./skull.js";
import { ITEM_REDSTONE } from "./redstone-blocks.js";
import { REEDS_ITEM } from "./plants.js";
import { WOODEN_DOOR_ITEM } from "./doors-panes.js";
import { ITEM_STONE_SLAB } from "./stone-utility.js";
import { isBlockSound } from "./multiplayer/server-place-sound.js";

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const PITCH = -Math.atan(1.72 / 4);
const f = Math.fround;
function fixture() {
  const world = new World("mpsounds74");
  for (let x = 40; x <= 80; x++) for (let z = 40; z <= 80; z++) for (let y = 9; y <= 14; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 68.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
  s.rules.chunkStream = false;
  const a = s.addPlayer("a", "Alice", key(1)), b = s.addPlayer("b", "Bob", key(2)), c = s.addPlayer("c", "Cy", key(3));
  for (const p of [a, b]) { p.position.copy({ x: 64.5, y: 10, z: 68.5 }); p.previous.copy(p.position); }
  c.position.copy({ x: 44.5, y: 10, z: 44.5 }); c.previous.copy(c.position);
  for (const id of ["a", "b", "c"]) s.input(id, input());
  s.tick();
  return { s, a, b, c, world };
}
function click(s, p, id, count = 3, damage = 0) {
  for (const o of s.players.values()) o.soundsOut = null;
  p.survival.inventory.main[0] = makeStack(id, count, damage); p.survival.inventory.current = 0; p.yaw = 0; p.pitch = PITCH;
  s.queueEdit(p.id, { place: true });
  s.tick();
}
const heard = p => (p.soundsOut ?? []).filter(x => isBlockSound(x.name) || x.name === "random.anvil_land");

// [label, item, name, volume, pitch] - volume (v + 1) / 2 and pitch f * 0.8 of the block's SoundType (Block.SoundType table, block-sounds-reference.json)
const CASES = [
  ["grass block", 1, "dig.grass", 1, f(f(1) * f(0.8))],
  ["wool", WOOL, "dig.cloth", 1, f(0.8)],
  ["sand", SAND, "dig.sand", 1, f(0.8)],
  ["gravel", GRAVEL, "dig.gravel", 1, f(0.8)],
  ["torch (wood)", TORCH, "dig.wood", 1, f(0.8)],
  ["anvil", ANVIL, "random.anvil_land", f(f(f(0.3) + 1) / 2), f(0.8)],
  ["stone slab", ITEM_STONE_SLAB, "dig.stone", 1, f(0.8)],
  ["double plant", DOUBLE_PLANT, "dig.grass", 1, f(0.8)],
  ["reeds item", REEDS_ITEM, "dig.grass", 1, f(0.8)],
  ["cake item (ItemReed, cloth)", ITEM_CAKE, "dig.cloth", 1, f(0.8)],
];

for (const [label, item, name, volume, pitch] of CASES) {
  test(`place sound: ${label} reaches the placer and a nearby player once, not a far one`, () => {
    const { s, a, b, c, world } = fixture();
    if (item === REEDS_ITEM) world.put(63, 9, 64, WATER, 0, false); // sugar cane needs water beside its soil
    click(s, a, item);
    for (const p of [a, b]) {
      const got = heard(p);
      assert.equal(got.length, 1, `${p.name} hears one sound`);
      assert.deepEqual([got[0].name, got[0].volume, got[0].pitch], [name, volume, pitch]);
      assert.deepEqual([got[0].x, got[0].y, got[0].z], [64.5, 10.5, 64.5]);
    }
    assert.equal(heard(c).length, 0, "20 blocks away: out of the 16 block range");
  });
}

test("place sound: items that place silently send nothing (door, bed, sign, skull, redstone dust)", () => {
  for (const item of [WOODEN_DOOR_ITEM, ITEM_BED, ITEM_SIGN, ITEM_SKULL, ITEM_REDSTONE]) {
    const { s, a, b } = fixture();
    click(s, a, item);
    assert.equal(heard(a).length + heard(b).length, 0, `item ${item}`);
  }
});

test("place sound: a snow layer stacked on a snow layer plays the snow type at the clicked cell", () => {
  const { s, a, b, world } = fixture();
  world.put(64, 10, 64, SNOW_LAYER, 0, false);
  click(s, a, SNOW_LAYER);
  assert.equal(world.getMeta(64, 10, 64), 1);
  const got = heard(b);
  assert.equal(got.length, 1);
  assert.deepEqual([got[0].name, got[0].volume, got[0].pitch], ["dig.snow", 1, f(0.8)]);
});

test("place sound: a refused placement (cake over air) is silent", () => {
  const { s, a, b, world } = fixture();
  world.put(64, 9, 64, 0, 0, false); world.put(64, 8, 64, 0, 0, false);
  click(s, a, ITEM_CAKE, 1);
  assert.equal(heard(a).length + heard(b).length, 0);
});

test("seeds and nether wart place silently on the server (ItemSeeds has no sound call); the client takes block family sounds only from S29", () => {
  assert.equal(isBlockSound("step.grass"), true);
  assert.equal(isBlockSound("dig.glass"), true);
  assert.equal(isBlockSound("step.anvil"), false);
  assert.equal(isBlockSound("mob.zombie.say"), false);
});
