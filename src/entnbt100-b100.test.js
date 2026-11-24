import test from "node:test";
import assert from "node:assert/strict";
import { Experience, xpBarCap, levelCost } from "./experience.js";
import { xpLevelHtml } from "./bitmap-text.js";

const lv = (level, progress = 0) => new Experience({ total: 0, level, progress });

test("a wrapped level gives the int-wrapping bar cap, nonpositive caps hide the bar", () => {
  assert.equal(xpBarCap(30), 62);
  assert.equal(xpBarCap(1000000000), (62 + Math.imul(1000000000 - 30, 7)) | 0);
  assert.ok(xpBarCap(1000000000) < 0);
  assert.equal(levelCost(1000000000), xpBarCap(1000000000));
  assert.equal(xpBarCap(-5), 17);
});

test("the level number is drawn only above 0 (GuiIngame bjk.bF > 0)", () => {
  assert.equal(xpLevelHtml(-5), "");
  assert.equal(xpLevelHtml(0), "");
  assert.notEqual(xpLevelHtml(7), "");
});

test("death drop is int level * 7 capped at 100: negative and wrapped levels drop a nonpositive count", () => {
  assert.equal(lv(5).death(), 35);
  assert.equal(lv(50).death(), 100);
  assert.equal(lv(-3).death(), -21);
  assert.equal(lv(2147483647).death(), 100);
  assert.equal(lv(400000000).death(), -1494967296);
});

test("score adds wrap as ints and the total clamps to MAX_INT", () => {
  const e = new Experience({ total: 2147483640, score: 2147483640 });
  e.add(100);
  assert.equal(e.score, (2147483640 + 100) | 0);
  assert.equal(e.total, 2147483647);
});

test("a level step at MAX_INT wraps below 0 and resets level, bar and total", () => {
  const e = lv(2147483647, 1);
  e.total = 5;
  e.add(1000);
  assert.equal(e.level, 0);
  assert.equal(e.progress, 0);
  assert.equal(e.total, 0);
  const g = lv(2147483647);
  g.addLevels(1);
  assert.equal(g.level, 0);
});

test("foodTickTimer is an int: MAX_INT + 1 wraps negative and does not heal", async () => {
  const { Survival } = await import("./survival.js");
  const s = new Survival({ difficulty: 2 });
  s.health = 10; s.food = 20; s.timer = 2147483647;
  s.foodTick();
  assert.equal(s.timer, -2147483648);
  assert.equal(s.health, 10);
  s.timer = 79; s.foodTick();
  assert.equal(s.health, 11);
});
