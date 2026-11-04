// Standalone 1.7.10 EntityVillager.t(int) initial offer generation.
// JavaRandom drives profession recipes and enchantments. Collections.shuffle uses a separate
// process-wide Random; callers can inject one for replay while production shares this module one.
import { JavaRandom } from "./java-random.js";
import { ENCHANTMENT_LIST, addRandomEnchantment, addStoredEnchantment } from "./enchantments.js";
import { addOrReplaceOffer } from "./villager-trading.js";

const EMERALD = 388, ENCHANTED_BOOK = 403;
const defaultShuffleRandom = new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48)));
const f = Math.fround;

// EntityVillager's bB table: [minimum, maximum-exclusive] item quantities.
const BUY_QUANTITY = {
  35:[14,22], 263:[16,24], 264:[4,6], 265:[8,10], 266:[8,10], 295:[34,48],
  296:[18,22], 319:[14,18], 339:[24,36], 340:[11,13], 350:[9,13], 361:[30,38],
  362:[30,38], 363:[14,18], 365:[14,18], 367:[36,64], 368:[3,4], 381:[2,3], 387:[1,1],
};
// EntityVillager's bC table: negative quantities mean the villager sells that many for one
// emerald; positive quantities mean the player pays that many emeralds for one item.
const EMERALD_PRICE = {
  20:[-5,-3], 47:[3,4], 89:[-3,-1], 256:[4,6], 257:[7,9], 258:[6,8], 259:[3,4],
  260:[-8,-4], 262:[-12,-8], 267:[7,11], 276:[12,14], 277:[7,8], 278:[10,12],
  279:[9,12], 292:[4,6], 293:[7,8], 297:[-4,-2], 298:[2,4], 299:[4,5], 300:[2,4],
  301:[2,4], 302:[5,7], 303:[11,15], 304:[9,11], 305:[5,7], 306:[4,6], 307:[10,14],
  308:[8,10], 309:[4,6], 310:[7,8], 311:[16,19], 312:[11,14], 313:[7,8], 320:[-7,-5],
  329:[6,8], 331:[-4,-1], 345:[10,12], 347:[10,12], 357:[-10,-7], 359:[3,4], 360:[-8,-4],
  364:[-7,-5], 366:[-8,-6], 381:[7,11], 384:[-4,-1],
};

const item = (id, count = 1, damage = 0) => ({ id, count, damage, enchantments: [] });
const recipe = (buy, buyB, sell) => ({ buy, buyB: buyB ?? null, sell, uses: 0, maxUses: 7 });
const rangeExclusive = (random, id, table) => {
  const [min, max] = table[id] || [1, 1];
  return min >= max ? min : min + random.nextInt(max - min);
};
const adjustedChance = (chance, oldOfferCount) => {
  // EntityVillager.p(float): a new villager has multiplier 0. Existing-offer pricing is not
  // added by this initial-generation kernel (it belongs to later recipe reuse).
  const multiplier = oldOfferCount ? f(f(Math.sqrt(oldOfferCount)) * f(0.2)) : 0;
  const sum = f(chance + multiplier);
  return sum > f(0.9) ? f(f(0.9) - f(sum - f(0.9))) : sum;
};
function buyForEmerald(offers, itemId, random, chance, old = 0) {
  if (random.nextFloat() >= adjustedChance(chance, old)) return;
  offers.push(recipe(item(itemId, rangeExclusive(random, itemId, BUY_QUANTITY)), null, item(EMERALD)));
}
function sellForEmerald(offers, itemId, random, chance, old = 0) {
  if (random.nextFloat() >= adjustedChance(chance, old)) return;
  const quantity = rangeExclusive(random, itemId, EMERALD_PRICE);
  if (quantity < 0) offers.push(recipe(item(EMERALD), null, item(itemId, -quantity)));
  else offers.push(recipe(item(EMERALD, quantity), null, item(itemId)));
}
// `old` is the size of the villager's existing offer list: EntityVillager.t(int) sets p(float)'s
// bonus to sqrt(size) * 0.2 before it draws, so a restock rolls lower odds than the first call.
function generateCandidates(profession, random, old = 0) {
  const out = [];
  const maybeBuyForEmerald = (o, id, r, c) => buyForEmerald(o, id, r, c, old);
  const maybeSellForEmerald = (o, id, r, c) => sellForEmerald(o, id, r, c, old);
  switch (profession) {
    case 0: // Farmer
      maybeBuyForEmerald(out, 296, random, 0.9);
      maybeBuyForEmerald(out, 35, random, 0.5);
      maybeBuyForEmerald(out, 365, random, 0.5);
      maybeBuyForEmerald(out, 350, random, 0.4);
      maybeSellForEmerald(out, 297, random, 0.9);
      maybeSellForEmerald(out, 360, random, 0.3);
      maybeSellForEmerald(out, 260, random, 0.3);
      maybeSellForEmerald(out, 357, random, 0.3);
      maybeSellForEmerald(out, 359, random, 0.3);
      maybeSellForEmerald(out, 259, random, 0.3);
      maybeSellForEmerald(out, 366, random, 0.3);
      maybeSellForEmerald(out, 262, random, 0.5);
      if (random.nextFloat() < adjustedChance(0.5, old))
        out.push(recipe(item(13, 10), item(EMERALD), item(318, 4 + random.nextInt(2))));
      break;
    case 1: // Librarian
      maybeBuyForEmerald(out, 339, random, 0.8);
      maybeBuyForEmerald(out, 340, random, 0.8);
      maybeBuyForEmerald(out, 387, random, 0.3);
      maybeSellForEmerald(out, 47, random, 0.8);
      maybeSellForEmerald(out, 20, random, 0.2);
      maybeSellForEmerald(out, 345, random, 0.2);
      maybeSellForEmerald(out, 347, random, 0.2);
      if (random.nextFloat() < adjustedChance(0.07, old)) {
        const enchantment = ENCHANTMENT_LIST[random.nextInt(ENCHANTMENT_LIST.length)];
        const level = enchantment.minLevel >= enchantment.maxLevel
          ? enchantment.minLevel
          : enchantment.minLevel + random.nextInt(enchantment.maxLevel - enchantment.minLevel + 1);
        const price = 2 + random.nextInt(5 + level * 10) + 3 * level;
        const book = item(ENCHANTED_BOOK);
        addStoredEnchantment(book, enchantment, level);
        out.push(recipe(item(340), item(EMERALD, price), book));
      }
      break;
    case 2: { // Priest
      maybeSellForEmerald(out, 381, random, 0.3);
      maybeSellForEmerald(out, 384, random, 0.2);
      maybeSellForEmerald(out, 331, random, 0.4);
      maybeSellForEmerald(out, 89, random, 0.3);
      // Preserve EntityVillager's exact native array order (sword, sword, chestplate,
      // chestplate, axe, axe, pickaxe, pickaxe).
      for (const id of [267, 276, 307, 311, 258, 279, 257, 278]) {
        if (random.nextFloat() >= adjustedChance(0.05, old)) continue;
        const emeralds = 2 + random.nextInt(3);
        const gear = item(id);
        addRandomEnchantment(random, gear, 5 + random.nextInt(15));
        out.push(recipe(item(id), item(EMERALD, emeralds), gear));
      }
      break;
    }
    case 3: // Blacksmith
      maybeBuyForEmerald(out, 263, random, 0.7);
      maybeBuyForEmerald(out, 265, random, 0.5);
      maybeBuyForEmerald(out, 266, random, 0.5);
      maybeBuyForEmerald(out, 264, random, 0.5);
      for (const [id, chance] of [
        [267,0.5],[276,0.5],[258,0.3],[279,0.3],[257,0.5],[278,0.5],
        [256,0.2],[277,0.2],[292,0.2],[293,0.2],[309,0.2],[313,0.2],
        [306,0.2],[310,0.2],[307,0.2],[311,0.2],[308,0.2],[312,0.2],
        [305,0.1],[302,0.1],[303,0.1],[304,0.1],
      ]) maybeSellForEmerald(out, id, random, chance);
      break;
    case 4: // Butcher
      maybeBuyForEmerald(out, 263, random, 0.7);
      maybeBuyForEmerald(out, 319, random, 0.5);
      maybeBuyForEmerald(out, 363, random, 0.5);
      maybeSellForEmerald(out, 329, random, 0.1);
      maybeSellForEmerald(out, 299, random, 0.3);
      maybeSellForEmerald(out, 301, random, 0.3);
      maybeSellForEmerald(out, 298, random, 0.3);
      maybeSellForEmerald(out, 300, random, 0.3);
      maybeSellForEmerald(out, 320, random, 0.3);
      maybeSellForEmerald(out, 364, random, 0.3);
      break;
    default: break; // any other profession id has no table: only the gold-ingot fallback below
  }
  if (out.length === 0)
    maybeBuyForEmerald(out, 266, random, 1.0); // native empty-list fallback: gold ingots for an emerald
  return out;
}

function shuffle(list, random) {
  for (let i = list.length; i > 1; i--) {
    const j = random.nextInt(i);
    [list[i - 1], list[j]] = [list[j], list[i - 1]];
  }
}

// Ports the initial EntityVillager.t(maxNewOffers) call. The villager's own JavaRandom is
// required; shuffleRandom defaults to the module's shared equivalent of Collections' static Random.
// `existing` is the villager's current offer list (a restock): its size feeds the chance bonus and the
// new offers are added to it with MerchantRecipeList.addToListWithCheck; the list is returned.
// `anyProfession` lets a registry profession outside 0-4 reach native's empty-table gold fallback.
export function generateVillagerOffers(profession, random, { maxNewOffers = 1, shuffleRandom = defaultShuffleRandom, existing = null, anyProfession = false } = {}) {
  if (!Number.isInteger(profession) || profession < 0 || (profession > 4 && !anyProfession)) throw new RangeError("profession must be between 0 and 4");
  if (!random || typeof random.nextFloat !== "function" || typeof random.nextInt !== "function") throw new TypeError("random must implement JavaRandom nextFloat/nextInt");
  if (!shuffleRandom || typeof shuffleRandom.nextInt !== "function") throw new TypeError("shuffleRandom must implement JavaRandom nextInt");
  if (!Number.isSafeInteger(maxNewOffers) || maxNewOffers < 0) throw new RangeError("maxNewOffers must be a nonnegative integer");
  const candidates = generateCandidates(profession, random, existing ? existing.length : 0);
  shuffle(candidates, shuffleRandom);
  const offers = existing ?? [];
  for (let i = 0; i < maxNewOffers && i < candidates.length; i++) addOrReplaceOffer(offers, candidates[i]);
  return offers;
}
