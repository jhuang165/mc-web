import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { armorTypeOf, headItemMatrix, showsPumpkinBlur, PUMPKIN_BLOCK, SKULL_SCALE, PUMPKIN_SCALE } from "./wearable-heads.js";
import { PlayerInventory, PlayerContainer } from "./inventory.js";
import { ITEMS } from "./survival.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/polish-reference.json", import.meta.url)));
const rec = (name) => ref.records.filter((r) => r.case === name);

test("head branch constants come from RenderPlayer bytecode", () => {
  const calls = rec("headBranch")[0].calls, by = (c) => calls.filter((x) => x.call === c);
  assert.deepEqual(by("glTranslatef")[0].ops, ["ldc 0.625", "fconst_0", "ldc -0.25", "fconst_0"]);
  assert.deepEqual(by("glRotatef")[0].ops, ["ldc 90.0", "fconst_0", "fconst_1", "fconst_0"]);
  assert.equal(PUMPKIN_SCALE, 0.625);
  assert.deepEqual(by("glScalef")[0].ops, ["fload4", "fload4", "fneg", "fload4", "fneg"]); // (f, -f, -f)
  assert.deepEqual(by("glScalef")[1].ops.slice(0, 1), ["ldc 1.0625"]);
  assert.equal(SKULL_SCALE, 1.0625);
  assert.equal(by("TileEntitySkullRenderer.func_152674_a").length, 1);
});

test("head item matrices", () => {
  const sk = headItemMatrix(2050).elements;
  assert.deepEqual([sk[0], sk[5], sk[10]], [1.0625, 1.0625, 1.0625]); // (1.0625, -1.0625, -1.0625) * (-1, -1, 1) * Ry(180)
  const pm = headItemMatrix(PUMPKIN_BLOCK).elements; // translate(0, -0.25, 0) Ry(90) scale(0.625, -0.625, -0.625)
  assert.ok(Math.abs(pm[13] + 0.25) < 1e-9);
  assert.ok(Math.abs(pm[2] - -0.625 * 1) < 1e-9 || Math.abs(pm[2] + 0.625) < 1e-9);
});

test("the helmet slot accepts a pumpkin and mob heads, other slots do not", () => {
  const inv = new PlayerInventory(ITEMS, [{ id: PUMPKIN_BLOCK, count: 4 }, { id: 2050, count: 1, damage: 3 }, { id: 4, count: 1 }]);
  const c = new PlayerContainer(inv, { craft: () => null }), helmet = c.slots[5], chest = c.slots[6];
  assert.equal(armorTypeOf(ITEMS, PUMPKIN_BLOCK), 0);
  assert.equal(armorTypeOf(ITEMS, 2050), 0);
  assert.equal(armorTypeOf(ITEMS, 4), undefined);
  assert.ok(helmet.valid({ id: PUMPKIN_BLOCK, count: 1 }) && helmet.valid({ id: 2050, count: 1, damage: 1 }));
  assert.ok(!chest.valid({ id: 2050, count: 1 }) && !helmet.valid({ id: 4, count: 1 }));
});

test("shift-click moves a head from the hotbar into the helmet slot, as Container.mergeItemStack does", () => {
  const inv = new PlayerInventory(ITEMS, []);
  inv.main[0] = { id: PUMPKIN_BLOCK, count: 3, damage: 0 };
  const c = new PlayerContainer(inv, { craft: () => null }), idx = c.slots.findIndex((s) => s.inventory === inv && s.index === 0 && s.type === undefined);
  c.transfer(idx);
  assert.equal(inv.armor[3]?.id, PUMPKIN_BLOCK);
  assert.equal(inv.armor[3].count, 3); // mergeItemStack ignores the slot limit for an empty slot (vanilla quirk, already in merge())
  assert.equal(inv.main[0], null);
});

test("the pumpkin blur shows only for a pumpkin in the first-person view", () => {
  assert.ok(showsPumpkinBlur({ id: PUMPKIN_BLOCK }, 0));
  assert.ok(!showsPumpkinBlur({ id: PUMPKIN_BLOCK }, 1));
  assert.ok(!showsPumpkinBlur({ id: 2050 }, 0) && !showsPumpkinBlur(null, 0));
});

test("saved heads reload into the helmet slot", () => {
  const inv = new PlayerInventory(ITEMS, [], [null, null, null, { id: 2050, count: 1, damage: 4 }]);
  assert.equal(inv.armor[3]?.id, 2050);
  assert.equal(inv.armor[3].damage, 4);
});
