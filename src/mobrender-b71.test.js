import test from "node:test";
import assert from "node:assert/strict";
import { SHADOWS, shadowQuads } from "./shadows.js";
import { FLEECE_COLORS, jebFleece, sheepFurTint, sheepEntityId } from "./sheep.js";
import { SkinBook, stackSkin, stackSkinKey } from "./skull-skins.js";
import { readGear, saveGear } from "./mob-equipment.js";
import { toLiveStack, fromLiveStack } from "./mob-equipment-live.js";
import { mobGearNbtFields } from "./java-mobs.js";
import { NBT } from "./nbt.js";

const f = Math.fround;
const floor = { get: (x, y, z) => (y === 0 ? 3 : 0), light: () => 15 };

test("batch 71 shadows: slime, magma cube and falling block (bytecode-read constructors)", () => {
  assert.deepEqual(SHADOWS.slime, { size: f(0.25), opaque: 1 });
  assert.deepEqual(SHADOWS.magma_cube, { size: f(0.25), opaque: 1 });
  assert.deepEqual(SHADOWS.falling_block, { size: f(0.5), opaque: 1 });
  // A size-2 slime (height 1.2) over a floor: the centre is raised by height / 2, one quad under it.
  const quads = shadowQuads({ ...SHADOWS.slime, x: 0.5, y: 1, z: 0.5, height: f(f(0.6) * 2) }, { x: 0.5, y: 2.6, z: 0.5 }, floor);
  assert.equal(quads.length, 1);
  // A falling block casts from its posY with height 0.
  const fall = shadowQuads({ ...SHADOWS.falling_block, x: 0.5, y: 1.49, z: 0.5, height: 0 }, { x: 0.5, y: 2.6, z: 0.5 }, floor);
  assert.equal(fall.length, 4); // 0.5 either side of x = 0.5 reaches the four floor cells
  assert.ok(fall.every((q) => q.y === 1.015625));
});

test("jeb_ sheep blends two consecutive fleece colours (RenderSheep.shouldRenderPass)", () => {
  assert.deepEqual(jebFleece(0, 0, 0), FLEECE_COLORS[0]);
  // ticks 12, partial 0.5: t = 12.5 / 25 = 0.5 between colours 0 and 1.
  const mid = jebFleece(12, 0, 0.5);
  for (let k = 0; k < 3; k++) assert.equal(mid[k], f(f(FLEECE_COLORS[0][k] * f(0.5)) + f(FLEECE_COLORS[1][k] * f(0.5))));
  // ticks / 25 + entityId picks the pair and wraps after 16 (15 blends into 0).
  assert.deepEqual(jebFleece(0, 15, 0), FLEECE_COLORS[15]);
  const wrap = jebFleece(24, 15, 0.9999);
  assert.ok(wrap.every((v, k) => Math.abs(v - FLEECE_COLORS[0][k]) < 0.01));
  assert.deepEqual(jebFleece(50, 3, 0), FLEECE_COLORS[5]);
});

test("the jeb_ tint needs the exact custom name; others keep their fleece colour", () => {
  assert.deepEqual(sheepFurTint({ color: 14, age: 0, id: "mob-0" }, 0), FLEECE_COLORS[14]);
  assert.deepEqual(sheepFurTint({ color: 14, customName: "Jeb_", age: 0, id: "mob-0" }, 0), FLEECE_COLORS[14]);
  assert.deepEqual(sheepFurTint({ color: 14, customName: "jeb_", age: 50, id: "mob-3" }, 0), FLEECE_COLORS[5]);
  assert.equal(sheepEntityId("mob-12"), 12);
});

test("skin book: SkullOwner heads take a known player's skin, else Steve (null)", () => {
  const book = new SkinBook(), tex = { uuid: "t1" };
  book.add({ skinOf: (n) => (n === "alex" ? tex : null) });
  assert.equal(book.lookup({ name: "ALEX" }), tex);
  assert.equal(book.lookup("alex"), tex);
  assert.equal(book.lookup({ name: "bob" }), null);
  assert.equal(book.lookup({ name: null }), null);
  const head = { id: 2050, damage: 3, count: 1, skullOwner: "Alex" };
  assert.equal(stackSkin(head, book), tex);
  assert.equal(stackSkinKey(head, book), "t1");
  assert.equal(stackSkin({ ...head, damage: 0 }, book), null); // only a player head (type 3) carries a profile
  assert.equal(stackSkin({ id: 2050, damage: 3, count: 1 }, book), null);
});

test("a mob's helmet keeps its SkullOwner through gear read, save and the live/native id maps", () => {
  const gear = readGear({ equipment: [null, null, null, null, { id: 397, count: 1, damage: 3, skullOwner: "Alex" }] });
  assert.equal(gear.equipment[4].skullOwner, "Alex");
  assert.equal(saveGear(gear).equipment[4].skullOwner, "Alex");
  assert.equal(toLiveStack(gear.equipment[4]).skullOwner, "Alex");
  assert.equal(fromLiveStack({ id: 2050, damage: 3, count: 1, skullOwner: "Alex" }).skullOwner, "Alex");
  assert.equal(readGear({ equipment: [null, null, null, null, { id: 397, count: 1, damage: 3 }] }).equipment[4].skullOwner, undefined);
});

test("mobGearNbtFields carries the head's SkullOwner from the converted stack", () => {
  const compound = (entries) => new Map(Object.entries(entries));
  const helmet = compound({ id: { type: NBT.SHORT, value: 397 }, Count: { type: NBT.BYTE, value: 1 }, Damage: { type: NBT.SHORT, value: 3 } });
  const tag = new Map([["Equipment", { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: [new Map(), new Map(), new Map(), new Map(), helmet] } }]]);
  const gear = mobGearNbtFields(tag, "zombie", () => ({ id: 2050, damage: 3, skullOwner: "Alex" }));
  assert.equal(gear.equipment[4].skullOwner, "Alex");
});
