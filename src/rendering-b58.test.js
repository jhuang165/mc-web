// Batch 58 rendering: the hopper is its item sprite in every path, and the held item reads the player's tick cell.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { flatBlockItem, HOPPER_BLOCK, HOPPER_ITEM_URL } from "./flat-block-items.js";
import { itemTexture } from "./first-person.js";
import { heldLightCell } from "./held-light.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/display-pixel-reference.json", import.meta.url), "utf8"));

test("executed table: only the hopper (and skull) have an icon name, so the hopper block item is an icon sprite", () => {
  const rec = ref.records.find((r) => r.kind === "itemBlock" && r.id === 154);
  assert.equal(rec.itemIconName, "hopper");
  assert.equal(rec.in3d, false);
  assert.equal(rec.renderType, 38);
});

test("the hopper block item (133) and Items.hopper (1133) resolves to the item sprite and the sprite file exists", () => {
  assert.equal(flatBlockItem(1133), HOPPER_BLOCK);
  assert.equal(flatBlockItem(133), HOPPER_BLOCK, "the block item that picking a placed hopper gives");
  assert.equal(itemTexture(133, 0), HOPPER_ITEM_URL);
  assert.equal(itemTexture(1133, 0), HOPPER_ITEM_URL);
  assert.equal(HOPPER_ITEM_URL, "/media/1.7.10/items/hopper.png");
  assert.ok(readFileSync(new URL("../public" + HOPPER_ITEM_URL, import.meta.url)).length > 0);
});

test("the inventory icon resolver (block-textures iconRaw) returns the sprite before any cube is built", () => {
  const src = readFileSync(new URL("./block-textures.js", import.meta.url), "utf8");
  const at = src.indexOf("function iconRaw(");
  assert.ok(at > 0);
  const head = src.slice(at, at + 700);
  assert.ok(head.indexOf("flatBlockItem(id)===HOPPER_BLOCK)return HOPPER_ITEM_URL") > 0);
  assert.ok(head.indexOf("HOPPER_ITEM_URL") < head.indexOf("itemBlockId(id)"));
});

test("held light cell is the floor of the tick posX/posY (eye)/posZ, not the interpolated camera", () => {
  assert.deepEqual(heldLightCell({ x: 3.9, y: 64, z: -0.1 }, 1.62, 0), [3, 65, -1]);
  // eye 65.99 stays in cell 65; a camera interpolated up by 0.02 would be cell 66
  assert.deepEqual(heldLightCell({ x: 0, y: 64.37, z: 0 }, 1.62, 0), [0, 65, 0]);
  assert.deepEqual(heldLightCell({ x: 0, y: 64.37, z: 0 }, 1.62, 0.08), [0, 65, 0]);
  assert.deepEqual(heldLightCell({ x: 0, y: 64.45, z: 0 }, 1.62, 0.08), [0, 65, 0]);
  assert.deepEqual(heldLightCell({ x: 0, y: 64.45, z: 0 }, 1.62, 0), [0, 66, 0]);
});

test("main.js feeds the first-person item from the tick cell", () => {
  const m = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.ok(m.includes("scene.brightness(...heldLightCell(position, PHYSICS.eye, motion.drop(1)))"));
});
