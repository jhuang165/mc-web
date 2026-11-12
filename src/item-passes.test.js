// Multi-pass items: ItemMonsterPlacer, ItemPotion (bytecode-read adp.a(int,int) / adp.a(add,int)) and ItemArmor draw getIconFromDamageForRenderPass tinted by
// getColorFromItemStack per pass; each icon is a cell of the item atlas.
import test from "node:test";
import assert from "node:assert/strict";
import { itemPasses, ITEM_POTION } from "./item-passes.js";
import { ITEM_SPAWN_EGG, eggColor } from "./spawn-eggs.js";
import { itemSpriteName } from "./item-atlas.js";
import { potionColor } from "./potions.js";

const rgb = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

test("spawn egg: base in the primary colour, overlay in the secondary colour, both atlas sprites", () => {
  const p = itemPasses(ITEM_SPAWN_EGG, 50);
  assert.equal(itemSpriteName(p.base), "spawn_egg"); assert.equal(itemSpriteName(p.overlay), "spawn_egg_overlay");
  assert.deepEqual(p.tint, rgb(eggColor(50, 0))); assert.deepEqual(p.overlayTint, rgb(eggColor(50, 1)));
  assert.equal(p.color, 894731);
});

test("potion: pass 0 is the overlay in the liquid colour, pass 1 the white bottle (splash by bit 16384)", () => {
  const drink = itemPasses(ITEM_POTION, 8193), splash = itemPasses(ITEM_POTION, 16385);
  assert.equal(itemSpriteName(drink.base), "potion_overlay"); assert.equal(itemSpriteName(drink.overlay), "potion_bottle_drinkable");
  assert.equal(itemSpriteName(splash.overlay), "potion_bottle_splash");
  assert.deepEqual(drink.tint, rgb(potionColor(8193) & 0xffffff)); assert.equal(drink.overlayTint, null);
});

test("leather keeps its dye pass and a white overlay; ordinary items have one pass", () => {
  const p = itemPasses(400, 0, 0x3366cc);
  assert.deepEqual(p.tint, rgb(0x3366cc)); assert.equal(p.overlayTint, null); assert.equal(itemSpriteName(p.overlay), "leather_helmet_overlay");
  assert.equal(itemPasses(1, 0), null);
});
