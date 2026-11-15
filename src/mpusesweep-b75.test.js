// Batch 75 mpusesweep75: right clicks on mobs and in the air on the dedicated server (sweep: tools/sweep-use75.mjs, server against single player on identical fixtures).
import test from "node:test";
import assert from "node:assert/strict";
import { makeSide, spawn, stock, serverClick } from "../tools/sweep-use75.mjs";
import { ITEMS } from "./survival.js";
import { WATER } from "./world.js";

const given = (side, id, damage = 0, count = 3) => { stock(side, id, damage, count); return side.p.survival.inventory.main[0]; };
const held = side => side.p.survival.inventory.main[0];

test("name tag with a display name names any mob and is used up", () => {
  const side = makeSide();
  for (const kind of ["cow", "creeper", "zombie", "iron_golem", "wolf"]) {
    const e = spawn(side, kind); given(side, 375, 0, 2); side.p.survival.inventory.main[0].displayName = "Rex";
    serverClick(side, e);
    assert.equal(e.customName, "Rex", kind); assert.equal(e.persistent, true, kind);
    assert.equal(held(side).count, 1, kind);
  }
});

test("spawn egg on an adult cow: a calf spawns, the egg is spent, no mob without the matching egg", () => {
  const side = makeSide(), cow = spawn(side, "cow");
  given(side, 1950, 92, 2); serverClick(side, cow);
  const mobs = side.s.mobs.mobs.entities;
  assert.equal(mobs.length, 2); assert.ok(mobs[1].growingAge < 0); assert.equal(held(side).count, 1);
  given(side, 1950, 91, 2); serverClick(side, cow);
  assert.equal(mobs.length, 2, "a sheep egg does nothing to a cow"); assert.equal(held(side).count, 2, "the click is consumed, the egg kept");
});

test("spawn egg on a villager makes a baby and opens no trade window", () => {
  const side = makeSide(), v = spawn(side, "villager"); let trades = 0;
  side.s.mobs.villagerUse = () => (trades++, true);
  given(side, 1950, 120, 1); serverClick(side, v);
  assert.equal(trades, 0); assert.equal(side.s.mobs.mobs.entities.length, 2);
});

test("flint and steel lights a creeper, wears the tool; Creative keeps it", () => {
  const side = makeSide(), c = spawn(side, "creeper");
  given(side, 126, 0, 1); serverClick(side, c);
  assert.equal(c.ignited, true); assert.equal(held(side).damage, 1);
  assert.ok(side.s.soundsOut.some(x => x.name === "fire.ignite"));
  const cr = makeSide("creative"), c2 = spawn(cr, "creeper"); given(cr, 126, 0, 1); serverClick(cr, c2);
  assert.equal(c2.ignited, true); assert.equal(held(cr).damage ?? 0, 0);
});

test("horses, donkeys and mules: wheat heals, a chest goes on a donkey, a saddle goes on a tamed horse", () => {
  const side = makeSide();
  const h = spawn(side, "horse"); h.health = 5; given(side, 305, 0, 2); serverClick(side, h);
  assert.ok(h.health > 5); assert.equal(held(side).count, 1);
  const d = spawn(side, "donkey"); d.horse.tame = true; given(side, 1941 - 1941 + 54, 0, 1); // a chest block item (id 54 is not the item id here)
  for (const [id, it] of Object.entries(ITEMS)) if (it.name === "Chest") { given(side, Number(id), 0, 1); break; }
  serverClick(side, d);
  assert.equal(d.horse.chested, true, "chest on a tame donkey");
  const t = spawn(side, "horse"); t.horse.tame = true; given(side, 363, 0, 1); serverClick(side, t);
  assert.equal(t.horse.saddled, true); assert.equal(held(side), null);
});

test("armour right click in the air or on a block equips it into the empty slot", () => {
  const side = makeSide(); given(side, 408, 0, 1); // iron helmet
  side.s.edit(side.p, true);
  assert.equal(side.p.survival.inventory.armor[3]?.id ?? side.p.survival.inventory.getStack(39)?.id, 408);
  assert.equal(held(side), null);
  given(side, 408, 0, 1); side.s.edit(side.p, true);
  assert.equal(held(side)?.id, 408, "an occupied slot keeps the piece in hand");
});

test("glass bottle aimed at water fills; an egg aimed at water spawns a mob", () => {
  const side = makeSide(); const w = side.s.world;
  for (let x = 62; x <= 66; x++) for (let z = 56; z <= 63; z++) for (const y of [10, 11]) w.put(x, y, z, WATER, 0, false);
  side.p.pitch = -0.2; side.p.yaw = 0; side.p.position.y = 10.5;
  given(side, 384, 0, 2); side.s.edit(side.p, true);
  assert.equal(held(side).count, 1);
  assert.ok(side.p.survival.inventory.main.some(s => s?.id === 385), "a water bottle");
  given(side, 1950, 90, 2); side.s.edit(side.p, true);
  assert.equal(side.s.mobs.mobs.entities.length, 1); assert.equal(held(side).count, 1);
});

test("firework rocket on the top of a block launches a rocket and is spent", () => {
  const side = makeSide(); side.p.yaw = 0; side.p.pitch = -Math.atan(1.72 / 4);
  given(side, 2071, 0, 2); side.s.edit(side.p, true);
  assert.equal(side.s.dispense.rockets.rockets.length, 1);
  assert.equal(held(side).count, 1);
});
