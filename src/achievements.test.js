import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACHIEVEMENTS, BY_ID, BOUNDS, EXPLORE_BIOMES, Achievements } from "./achievements.js";
import { toastState, backgroundTile, AchievementView, nodeStyle, tooltipFor, iconItem } from "./achievements-ui.js";
import { craftedAchievement, smeltedAchievement, pickedAchievement, IMOB } from "./achievements-live.js";
import { javaHash } from "./menu-screens.js";
import { ITEMS } from "./survival.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/achievements-reference.json", import.meta.url), "utf8"));
const records = ref.records.filter((r) => r.case === "achievement");

test("table matches the 1.7.10 AchievementList probe", () => {
  assert.equal(ACHIEVEMENTS.length, 33);
  assert.equal(records.length, 33);
  for (const r of records) {
    const a = BY_ID[r.id.replace("achievement.", "")];
    assert.ok(a, r.id);
    assert.deepEqual([a.column, a.row, a.item, a.damage, a.special], [r.column, r.row, r.item, r.meta, r.special], r.id);
    assert.equal(a.parent ? `achievement.${a.parent}` : null, r.parent, r.id);
  }
  const bounds = ref.records.find((r) => r.case === "bounds");
  assert.deepEqual({ ...BOUNDS }, { minColumn: bounds.minColumn, minRow: bounds.minRow, maxColumn: bounds.maxColumn, maxRow: bounds.maxRow });
  const biomes = ref.records.find((r) => r.case === "biomes").names;
  assert.deepEqual([...EXPLORE_BIOMES].sort(), [...biomes].sort());
});

test("names and descriptions are the en_US strings", () => {
  for (const a of ACHIEVEMENTS) {
    assert.equal(a.name, ref.lang[`achievement.${a.id}`], a.id);
    assert.equal(a.description, ref.lang[`achievement.${a.id}.desc`], a.id);
  }
});

test("unlock rules: a locked parent ignores the trigger; depth counts locked ancestors", () => {
  const got = [];
  const ach = new Achievements({ onUnlock: (a) => got.push(a.id) });
  assert.equal(ach.trigger("mineWood"), false);
  assert.equal(ach.depth("mineWood"), 1);
  assert.equal(ach.depth("buildPickaxe"), 3);
  assert.equal(ach.trigger("openInventory"), true);
  assert.equal(ach.trigger("openInventory"), false);
  assert.equal(ach.trigger("mineWood"), true);
  assert.deepEqual(got, ["openInventory", "mineWood"]);
  assert.equal(ach.depth("mineWood"), 0);
  assert.throws(() => ach.trigger("nope"), RangeError);
});

test("persistence round trip keeps unlocks and the visited biomes", () => {
  const ach = new Achievements();
  ach.trigger("openInventory");
  ach.visit("Plains", 0);
  const copy = new Achievements().load(JSON.parse(JSON.stringify(ach.save())));
  assert.equal(copy.has("openInventory"), true);
  assert.deepEqual(copy.save(), ach.save());
  assert.equal(new Achievements().load(null).has("openInventory"), false);
});

test("exploreAllBiomes needs all 36 biomes and its parent", () => {
  const ach = new Achievements();
  for (const b of EXPLORE_BIOMES) ach.visit(b, 0);
  assert.equal(ach.has("exploreAllBiomes"), false);
  for (const id of ["openInventory", "mineWood", "buildWorkBench", "buildPickaxe", "buildFurnace", "acquireIron", "diamonds", "portal", "blazeRod", "theEnd"]) ach.trigger(id);
  ach.visit(EXPLORE_BIOMES[0], 0);
  assert.equal(ach.has("exploreAllBiomes"), true);
});

test("onARail needs 1000 blocks from the first minecart cell; fullBeacon a level 4 pyramid nearby", () => {
  const ach = new Achievements();
  for (const id of ["openInventory", "mineWood", "buildWorkBench", "buildPickaxe", "buildFurnace", "acquireIron"]) ach.trigger(id);
  ach.rideMinecart(0, 64, 0);
  assert.equal(ach.rideMinecart(999, 64, 0), false);
  assert.equal(ach.rideMinecart(1000, 64, 0), true);
  const b = new Achievements();
  for (const id of ["openInventory", "mineWood", "buildWorkBench", "buildSword", "killEnemy"]) b.trigger(id);
  assert.equal(b.beacon("0,64,0", 4, true), false); // killWither chain still locked
});

test("toast slide follows GuiAchievement", () => {
  const t = { start: 0, hint: false };
  assert.equal(toastState(t, -1, 400), null);
  assert.equal(toastState(t, 3001, 400), null);
  assert.deepEqual(toastState(t, 0, 400), { x: 240, y: -36 });
  assert.deepEqual(toastState(t, 1500, 400), { x: 240, y: 0 });
  const hint = { start: 2500, hint: true };
  assert.equal(toastState(hint, 2000, 400), null);
  assert.deepEqual(toastState(hint, 600000, 400), { x: 240, y: 0 });
});

test("background tiles are deterministic and bedrock fills row 35", () => {
  const h = javaHash("Player");
  assert.equal(backgroundTile(h, 3, 35), "bedrock");
  assert.equal(backgroundTile(h, 3, 12), backgroundTile(h, 3, 12));
  const seen = new Set();
  for (let a = 0; a < 40; a++) for (let b = 0; b < 60; b++) seen.add(backgroundTile(h, a, b));
  for (const name of ["sand", "dirt", "stone", "bedrock"]) assert.ok(seen.has(name), name);
});

test("scroll view: initial offset, clamping, zoom and easing", () => {
  const v = new AchievementView();
  assert.deepEqual([v.u, v.v, v.r], [-82, -70, 1]);
  assert.deepEqual(v.min, { x: -208, y: -232 });
  assert.deepEqual(v.max, { x: 139, y: 235 });
  v.drag(10, 10, true);
  v.drag(-1000, -1000, true);
  assert.equal(v.u, 138);
  assert.equal(v.v, 234);
  v.wheel(1);
  assert.equal(v.r, 1.25);
  v.wheel(-1); v.wheel(-1);
  assert.equal(v.r, 1);
  v.w = 0; v.x = 0; v.u = 100; v.v = 100; v.s = v.u; v.t = v.v;
  v.tick();
  assert.equal(v.u, 15);
});

test("node brightness, links and tooltips", () => {
  const ach = new Achievements();
  assert.equal(nodeStyle(false, true, 0).brightness, 1);
  assert.equal(nodeStyle(false, false, 4).brightness, 0.1);
  assert.equal(nodeStyle(false, false, 5), null);
  assert.equal(tooltipFor(BY_ID.mineWood, ach).lines[0].text, "Getting Wood");
  assert.equal(tooltipFor(BY_ID.buildPickaxe, ach).lines[0].text, "???");
  assert.equal(tooltipFor(BY_ID.buildFurnace, ach), null);
  assert.match(tooltipFor(BY_ID.openInventory, ach, "E").lines[1].text, /Press 'E'/);
  ach.trigger("openInventory");
  assert.equal(tooltipFor(BY_ID.openInventory, ach).lines.at(-1).text, "Taken!");
});

test("game events map to achievements in this build's item ids", () => {
  assert.equal(craftedAchievement(100), "buildPickaxe");
  assert.equal(craftedAchievement(116), "buildBetterPickaxe");
  assert.equal(craftedAchievement(13), "buildWorkBench");
  assert.equal(craftedAchievement(1930), "bakeCake");
  assert.equal(craftedAchievement(1), null);
  assert.equal(smeltedAchievement(302), "acquireIron");
  assert.equal(smeltedAchievement(705), "cookFish");
  assert.equal(pickedAchievement(70), "mineWood");
  assert.equal(pickedAchievement(315), "killCow");
  assert.equal(pickedAchievement(303), "diamonds");
  assert.equal(pickedAchievement(387), "blazeRod");
  assert.ok(IMOB.has("zombie") && !IMOB.has("cow"));
  for (const a of ACHIEVEMENTS) assert.ok(ITEMS[iconItem(a)], `${a.id} icon ${iconItem(a)}`);
});
