import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HORSE_PREVIEW_LAYOUT, horsePreviewPose } from "./horse-preview.js";
import { paperdollPose } from "./inventory-player.js";

// bft.a(FII)V calls bfu.a(guiLeft + 51, guiTop + 60, 17, guiLeft + 51 - mouseX, guiTop + 75 - 50 - mouseY, horse) (javap -c).
test("the horse preview uses the bft.a anchor (51, 60), scale 17 and look point (51, 25) on the 176 x 166 screen", () => {
  assert.deepEqual(HORSE_PREVIEW_LAYOUT, { x: 51, y: 60, scale: 17, lookX: 51, lookY: 25, width: 176, height: 166 });
});

test("the horse looks at the mouse with the func_147046_a pose", () => {
  assert.deepEqual(horsePreviewPose(51, 25), paperdollPose(0, 0));
  assert.deepEqual(horsePreviewPose(100, 10), paperdollPose(51 - 100, 25 - 10));
  const p = horsePreviewPose(0, 25);
  assert.ok(p.renderYawOffset > 0 && p.rotationYawHead === 2 * p.renderYawOffset);
});

test("main.js shows the preview for the horse screen and tears it down on close", () => {
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /attachHorsePreview\(kind === "horse" \? container\.horse : null\)/);
  assert.match(src, /horsePreviewFrame\(\)/);
  assert.match(src, /function closeContainer\(\) \{\n  paperdoll\?\.detach\(\);\n  horsePreview\?\.detach\(\);/);
});
