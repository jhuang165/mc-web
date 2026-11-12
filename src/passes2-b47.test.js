// Batch 47 passes2: multi-pass held items, sword blocking pose, witch nose reference, use state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { firstPersonMatrix } from "./first-person-pose.js";
import { tickPlayerItemUse } from "./player-item-use.js";
import { itemPasses, ITEM_POTION } from "./item-passes.js";
import { WITCH_MODEL } from "./witch.js";
import { followChildHeld } from "./mob-equipment-renderer.js";
import { swingPose, bobPose } from "./animation.js";

const pose = () => ({ progress: 0, item: 1, equip: 1, swing: swingPose(0), bob: bobPose(0, 0) });
const origin = (m) => new Vector3().applyMatrix4(m);

test("first-person sword blocking moves the item origin off the plain hold pose (ItemRenderer EnumAction.block, bytecode-read)", () => {
  const plain = origin(firstPersonMatrix(pose())), block = origin(firstPersonMatrix(pose(), { blocking: true }));
  assert.ok(plain.distanceTo(block) > 0.05);
  assert.deepEqual(firstPersonMatrix(pose(), { blocking: false }).elements, firstPersonMatrix(pose()).elements);
});

test("a blocking use state never completes or cancels in tickPlayerItemUse", () => {
  const use = { id: 267, ticks: 72000, block: true };
  const r = tickPlayerItemUse(use, 267, {});
  assert.equal(r.use, use);
  assert.equal(r.completed, false);
  assert.equal(r.cancelled, false);
});

test("thrown potion passes: overlay tinted by the liquid colour, then the white bottle (bytecode-read RenderSnowball)", () => {
  const p = itemPasses(ITEM_POTION, 8193), s = itemPasses(ITEM_POTION, 16384 | 8193);
  assert.match(p.base, /potion_overlay/);
  assert.match(p.overlay, /potion_bottle_drinkable/);
  assert.match(s.overlay, /potion_bottle_splash/);
  assert.notEqual(p.tint, undefined);
});

test("witch nose pivot matches the executed bik.f record", () => {
  assert.deepEqual(WITCH_MODEL.nose.point, [0, -2, 0]);
});

test("followChildHeld ignores rigs without a baby held item", () => {
  assert.doesNotThrow(() => followChildHeld({}));
});
