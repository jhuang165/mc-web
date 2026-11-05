// Original item ID (or "id:damage" subtype) -> browser item id. Lives here (not in region-import.js) so item-names.js and
// survival.js can read the table without importing the region importer, which imports survival.js.
import { SAPLING, WEB, LADDER, YELLOW_FLOWER, RED_FLOWER, DYE, SNOW_LAYER, ICE, CACTUS, TNT, FENCE, RAIL } from './world.js';
import { POPULATION_ITEMS } from './population-content.js';
import { COLORED_ORIGINAL_ITEMS } from './colored-blocks.js';
import { FISHING_ITEMS } from './fishing-content.js';
import { NETHER_ITEMS } from './nether-blocks.js';
import { NOTE_JUKEBOX_ITEMS } from './note-jukebox-content.js';
import { SIGN_ITEMS } from './signs.js';
import { SKULL_ITEMS } from './skull.js';
import { CHEST_ITEMS } from './chest-blocks.js';
import { STEM_CAKE_ITEMS } from './stems-cake.js';
import { SPAWN_EGG_ITEMS } from './spawn-eggs.js';
import { EYE_ITEMS } from './eye-of-ender.js';
import { CART_ORIGINAL_ITEMS } from './cart-variants.js';
import { MAPS_CLOCK_ITEMS } from './maps.js';

// Original item ID (or "id:damage" subtype) -> browser item. The same table as tools/inventory-replay.mjs
// MC_IDS (the item catalogue's mapping); region-import.test.js keeps the two identical.
export const ORIGINAL_ITEMS = Object.freeze({
  137: 1139,
  1: 3, 2: 1, 3: 2, 4: 12, 54: 41, 5: 7, 6: SAPLING, 7: 11, 12: 6, 13: 25, 14: 18, 15: 16, 16: 15, 17: 4, 18: 5, 20: 9, 30: WEB, 65: LADDER,
  '31:1': 39, 35: 19, 49: 22, 41: 27, 42: 26, 45: 8, 47: 21, 50: 20, 56: 17, 57: 28, 58: 13, 61: 14, 78: SNOW_LAYER, 79: ICE, 80: 23, 82: 24, 172: 40,
  256: 110, 257: 102, 258: 106, 259: 126, 260: 200, 263: 301, 264: 303, 265: 302, 266: 304, 267: 114, 268: 112, 269: 108, 270: 100, 271: 104,
  272: 113, 273: 109, 274: 101, 275: 105, 276: 115, 277: 111, 278: 103, 279: 107,
  280: 300, 283: 119, 284: 118, 285: 116, 286: 117, 290: 120, 291: 121, 292: 122, 293: 123, 294: 124, 295: 309, 296: 305, 297: 201, 318: 313,
  319: 202, 320: 203, 332: 312, 344: 316, 288: 317, 365: 318, 366: 319, 336: 306, 337: 307, 340: 314, 352: 311, 359: 125, 261: 127, 262: 320,
  287: 321, 363: 204, 364: 205, 367: 206, 334: 315, '263:1': 308, 351: DYE, 37: YELLOW_FLOWER, 38: RED_FLOWER,
  375: 326, 391: 322, 392: 323, 393: 324, 394: 325, 325: 340, 326: 341, 327: 342, 335: 343,
  46: TNT, 289: 330,
  81: CACTUS, 338: 327, 339: 328, 353: 329,
  298: 400, 299: 401, 300: 402, 301: 403, 302: 404, 303: 405, 304: 406, 305: 407, 306: 408, 307: 409, 308: 410, 309: 411, 310: 416, 311: 417,
  312: 418, 313: 419, 314: 412, 315: 413, 316: 414, 317: 415,
  // Mineshaft blocks and loot: fence, rail, redstone, pumpkin/melon seeds, saddle, iron horse armor
  // and the enchanted book (whose StoredEnchantments are retained).
  85: FENCE, 66: RAIL, 331: 360, 361: 361, 362: 362, 329: 363, 417: 364, 403: 365,
  // Empty and chest cart items (internal 342 is the lava bucket).
  328: 366, 342: 450, 333: 495,
  ...CART_ORIGINAL_ITEMS, // furnace, TNT, hopper and command block carts (cart-variants.js)
  // Painting and item frame items (src/hanging.js).
  321: 1700, 389: 1701,
  ...POPULATION_ITEMS,
  ...COLORED_ORIGINAL_ITEMS, // 95, 160, 171, 170, 173, 22, 133, 19, 91 -> 1140-1148
  ...FISHING_ITEMS,
  ...NETHER_ITEMS, // netherrack, soul sand, End stone, nether brick (block, fence, stairs and item), quartz ore, block of quartz, quartz stairs
  // Note block 25, jukebox 84 and the music discs 2256-2267 (the discs replace the older inert 373/374 mapping).
  ...NOTE_JUKEBOX_ITEMS,
  ...SIGN_ITEMS,
  ...SKULL_ITEMS,
  ...CHEST_ITEMS, // trapped chest 146 and ender chest 130 -> 1940, 1941
  ...STEM_CAKE_ITEMS, // cake 354 -> 1930
  ...SPAWN_EGG_ITEMS, // spawn egg 383, Bottle o' Enchanting 384, fire charge 385 -> 1950-1952
  ...EYE_ITEMS, // eye of ender 381 -> 1960
  122: 171, // dragon egg block item
  ...MAPS_CLOCK_ITEMS, // clock 347 -> 2080, filled map 358 -> 2081
});
