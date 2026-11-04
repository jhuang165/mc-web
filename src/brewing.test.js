import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BrewingStand, INGREDIENT_ORIGINAL, POTION_INGREDIENTS, isItemValidForSlot, accessibleSlots, canInsertItem, BREW_TIME, bubbleHeight } from "./brewing.js";
import { ITEM_POTION, ITEM_GLASS_BOTTLE } from "./potions.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/potions-reference.json", import.meta.url), "utf8"));
const rec = (c) => ref.records.find((r) => r.case === c);

// Original ids of the non-ingredient items in a brew line: 374 glass bottle, 373 potion.
test("canBrew and brewPotions replay 780 native seeded bottle layouts", () => {
  const brew = rec("brew");
  assert.equal(brew.cases, 780);
  assert.equal(brew.samples.length, 780);
  let replayed = 0;
  for (const line of brew.samples) {
    const [ing, ins, can, bits, outs] = line.split("|");
    const [ingOrig, ingDamage] = ing.split(":").map(Number);
    if (ingOrig === 349) continue; // pufferfish: no item in this build
    const id = INGREDIENT_ORIGINAL[ingOrig];
    assert.ok(id, `ingredient ${ingOrig}`);
    const stand = new BrewingStand();
    ins.split(";").forEach((s, k) => {
      if (s === "b") stand.slots[k] = { id: ITEM_GLASS_BOTTLE, count: 1, damage: 0 };
      else if (s !== "-") stand.slots[k] = { id: ITEM_POTION, count: 1, damage: +s };
    });
    // the ingredient count is not part of the line's input; it appears in the output as "xN" after brewing (N = count - 1 when brewed)
    const after = outs.split(";");
    const last = after[3];
    const m = /^i\d+:\d+x(\d+)$/.exec(last);
    let count = 1;
    if (m) count = can === "true" ? +m[1] + 1 : +m[1];
    else assert.equal(last, "-");
    if (!m) count = 1;
    stand.slots[3] = { id, count, damage: ingDamage };
    assert.equal(stand.canBrew(), can === "true", line);
    assert.equal(stand.bottleBits(), +bits, line);
    stand.brewPotions();
    const got = stand.slots.map((s) => (!s ? "-" : s.id === ITEM_POTION ? `p${s.damage}` : s.id === ITEM_GLASS_BOTTLE ? `i374:0x${s.count}` : `i${Object.entries(INGREDIENT_ORIGINAL).find(([, v]) => v === s.id)[0]}:${s.damage}x${s.count}`));
    assert.equal(got.join(";"), outs, line);
    replayed++;
  }
  assert.ok(replayed > 700);
});

test("slot rules, sided access, limits and ingredient list match the native tile", () => {
  const tile = rec("tile");
  assert.deepEqual(tile.sides.map((s) => s), [[0, 1, 2], [3], [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2]]);
  for (let side = 0; side < 6; side++) assert.deepEqual(accessibleSlots(side), tile.sides[side]);
  assert.equal(tile.limit, 64);
  assert.equal(tile.potionMaxStack, 1);
  const byOrig = { 373: ITEM_POTION, 374: ITEM_GLASS_BOTTLE, 331: 360, 348: 383, 289: 330, 372: 386, 1: 1, 276: 276 };
  for (const [slot, orig, valid, sided1, sided0, extract] of tile.valid) {
    const stack = { id: byOrig[orig], count: 1, damage: 0 };
    assert.equal(isItemValidForSlot(slot, stack), valid, `${slot}/${orig}`);
    assert.equal(canInsertItem(slot, stack, 1), sided1);
    assert.equal(canInsertItem(slot, stack, 0), sided0);
  }
  assert.equal(Object.keys(POTION_INGREDIENTS).length, rec("ingredients").items.length - 1); // minus pufferfish
});

test("tick: a 400 tick brew starts, finishes, resets when the ingredient changes and sets bottle bits", () => {
  const s = new BrewingStand();
  s.slots[0] = { id: ITEM_POTION, count: 1, damage: 0 };
  s.slots[1] = { id: ITEM_GLASS_BOTTLE, count: 1, damage: 0 };
  s.slots[3] = { id: 386, count: 2, damage: 0 };
  assert.equal(s.tick(), 3); // first tick: brew starts, metadata becomes slots 0 and 1
  assert.equal(s.brewTime, BREW_TIME);
  for (let i = 0; i < BREW_TIME - 1; i++) s.tick();
  assert.equal(s.brewTime, 1);
  s.tick();
  assert.equal(s.brewTime, 0);
  assert.equal(s.slots[0].damage, 16);
  assert.equal(s.slots[3].count, 1);
  const t = new BrewingStand();
  t.slots[0] = { id: ITEM_POTION, count: 1, damage: 0 };
  t.slots[3] = { id: 386, count: 1, damage: 0 };
  t.tick();
  for (let i = 0; i < 50; i++) t.tick();
  t.slots[3] = { id: 329, count: 1, damage: 0 }; // another ingredient: the brew restarts (item identity check)
  t.tick();
  assert.equal(t.brewTime, 0);
  const saved = JSON.parse(JSON.stringify(t.save()));
  assert.equal(new BrewingStand(saved).brewTime, 0);
  assert.equal(bubbleHeight(0), 0);
});

test("comparator signal follows Container.calcRedstoneFromInventory", () => {
  const s = new BrewingStand();
  assert.equal(s.comparatorSignal(), 0);
  s.slots[0] = { id: ITEM_POTION, count: 1, damage: 0 };
  assert.equal(s.comparatorSignal(), Math.floor((1 / 4) * 14) + 1);
  s.slots[3] = { id: 386, count: 64, damage: 0 };
  assert.equal(s.comparatorSignal(), Math.floor((2 / 4) * 14) + 1);
});
