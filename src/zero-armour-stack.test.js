import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Survival, ITEMS } from "./survival.js";
import { makeStack, PlayerInventory } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { levelNbt } from "./region-export.js";
import { itemStackFromNbt } from "./region-import.js";
import { javaPlayerFromNbt } from "./level-dat.js";

// public/research/zero-armour-stack-reference.json: tools/probes/ZeroArmourStackProbe.java (tools/verify-zero-armour-stack.mjs) put an iron chestplate
// at stack size 0 into a real EntityPlayer's armour slot, the state ItemStack.damageItem leaves when Thorns wear breaks a piece (probed).
const reference = JSON.parse(await readFile(new URL("../public/research/zero-armour-stack-reference.json", import.meta.url)));
const IRON_CHESTPLATE = 409, IRON_BOOTS = 408;
const chest = (count, damage = 0, extra = {}) => makeStack(IRON_CHESTPLATE, count, damage, undefined, extra);
const wearer = (armor) => { const s = new Survival({}, "survival"); armor.forEach((a, i) => { s.inventory.armor[i] = a; }); return s; };

test("the reference is the unchanged 1.7.10 client and the port ids are iron armour", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(ITEMS[IRON_CHESTPLATE].defense, 6);
  assert.equal(ITEMS[IRON_BOOTS].defense, 2);
  const n = Object.values(reference.records).reduce((t, r) => t + r.length, 0);
  assert.equal(n, 30);
});

test("a size-0 armour piece still counts for armour value (probed)", () => {
  for (const [size, boots, value] of reference.records.armorValue) {
    const s = wearer([boots ? makeStack(IRON_BOOTS) : null, null, chest(size), null]);
    assert.equal(s.armorValue, value, JSON.stringify([size, boots]));
  }
});

test("a Thorns-broken piece stays at size 0 and keeps its slot, as natively (probed, thorns-wear-reference ghosts)", () => {
  const s = wearer([null, null, chest(1, 239, { enchantments: [{ id: 7, lvl: 3 }] }), null]);
  s.inventory.random = new JavaRandom(1n);
  let rolls = 0;
  while (!s.broken && rolls++ < 400) s.thorns({ hurt() {}, sound() {} });
  assert.equal(s.broken, IRON_CHESTPLATE, "the break is reported once");
  const kept = s.inventory.armor[2];
  assert.ok(kept, "the emptied piece stays in the slot");
  assert.deepEqual([kept.count, kept.damage], [0, 0]);
  assert.equal(s.armorValue, 6, "and still counts for armour");
  // It keeps rolling Thorns (the next reaction wears the empty stack again) without becoming a second break.
  s.broken = null;
  for (let i = 0; i < 50; i++) s.thorns({ hurt() {}, sound() {} });
  assert.equal(s.inventory.armor[2].count, 0);
  assert.ok(!s.broken);
});

test("InventoryPlayer.damageArmor replays: a size-0 piece is cleared, normal and last-durability pieces wear or break (probed)", () => {
  const seen = new Set();
  for (const [amount, mode, beforeArr, afterArr, log] of reference.records.damageArmor) {
    const piece = mode === 0 ? chest(0) : chest(1, mode === 2 ? 239 : 0);
    const s = wearer([null, null, piece, null]);
    s.inventory.armor[3] = makeStack(410, 1, 0); // iron helmet: the probe's slot 3 is [1, 0]
    s.broken = null;
    s.applyArmor(amount);
    const got = s.inventory.armor.map((a) => (a ? [a.count, a.damage] : null));
    assert.deepEqual(got[2], afterArr[2], JSON.stringify([amount, mode]));
    assert.deepEqual(got[3], afterArr[3], JSON.stringify([amount, mode, "helmet"]));
    assert.equal(!!s.broken, log.includes("broken"), JSON.stringify([amount, mode]));
    seen.add(mode);
  }
  assert.equal(seen.size, 3);
});

const exported = (armor, slots = []) => {
  const report = { unmappedItems: 0 };
  const player = levelNbt({ player: { armor, slots, health: 20 }, position: { x: 0, y: 64, z: 0 }, mode: "survival", id: "p" }, { javaSeed: 1n, originX: 0, originZ: 0, spawn: () => ({ x: 0, y: 64, z: 0 }) }, report).tag.value.get("Data").value.get("Player").value;
  return player;
};

test("a size-0 armour or main stack is written Count:0b and read back by javaPlayerFromNbt and a fresh PlayerInventory (probed nbt rows)", () => {
  const zero = chest(0, 0, { enchantments: [{ id: 7, lvl: 3 }] });
  const player = exported([null, null, zero, null], [null, null, null, null, null, zero]);
  const inventory = player.get("Inventory").value.items;
  const armourEntry = inventory.find((e) => e.get("Slot").value === 102), mainEntry = inventory.find((e) => e.get("Slot").value === 5);
  assert.equal(armourEntry.get("Count").value, 0, "Count:0b as the probe's string form: " + reference.records.nbt[0][2]);
  assert.equal(armourEntry.get("id").value, 307);
  assert.match(reference.records.nbt[0][2], /Slot:102b,id:307s,Count:0b/);
  assert.equal(mainEntry.get("Count").value, 0);
  const back = javaPlayerFromNbt(player);
  assert.equal(back.player.armor[2].count, 0, "armour keeps the size-0 stack like InventoryPlayer.readFromNBT");
  assert.equal(back.player.armor[2].id, IRON_CHESTPLATE);
  assert.equal(back.player.slots[5].count, 0, "native keeps a size-0 stack in a main slot too (probed nbt row 2: [0,0])");
  assert.deepEqual(reference.records.nbt.map((r) => r[3]), [[0, 0], [0, 0]]);
  assert.equal(itemStackFromNbt(armourEntry), null, "a plain stack read (hoppers, dropped items, /give) still rejects Count 0");
  // A browser save: PlayerInventory keeps both.
  const inv = new PlayerInventory(ITEMS, [null, null, null, null, null, chest(0)], [null, null, chest(0), null]);
  assert.equal(inv.armor[2].count, 0);
  assert.equal(inv.main[5].count, 0);
  // The armour round trip survives a second export.
  const again = exported(back.player.armor);
  assert.equal(again.get("Inventory").value.items.find((e) => e.get("Slot").value === 102).get("Count").value, 0);
});

test("a size-0 armour piece is cleared on death but never dropped (func_146097_a returns null for stackSize 0, bytecode-read)", () => {
  const s = wearer([makeStack(IRON_BOOTS), null, chest(0), null]);
  const dropped = s.inventory.takeAll();
  assert.deepEqual(dropped.map((d) => d.id), [IRON_BOOTS]);
  assert.deepEqual(s.inventory.armor, [null, null, null, null]);
});
