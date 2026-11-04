// Standalone Minecraft 1.7.10 MerchantRecipe / MerchantRecipeList trade kernel.
// Offer generation and the live trading UI remain outside this kernel.
const integer = (n, name, min = 0) => {
  if (!Number.isSafeInteger(n) || n < min) throw new RangeError(`${name} must be an integer >= ${min}`);
  return n;
};
const clone = (v) => structuredClone(v);
const sameItem = (a, b) => Boolean(a && b && a.id === b.id);
const usable = (s) => s && Number.isSafeInteger(s.id) && s.id >= 0 && Number.isSafeInteger(s.count) && s.count > 0;

// MerchantRecipeList.a(first, second, index): a positive index checks only that slot;
// zero/negative scans in list order. Vanilla compares item identity and stack size, not damage.
export function findMatchingOffer(offers, first, second = null, preferredIndex = 0) {
  if (!Array.isArray(offers) || !usable(first) || (second !== null && !usable(second))) return null;
  const matches = (recipe) => {
    if (!recipe || !recipe.buy || !sameItem(first, recipe.buy) || first.count < recipe.buy.count) return false;
    if (recipe.buyB) return usable(second) && sameItem(second, recipe.buyB) && second.count >= recipe.buyB.count;
    return second === null;
  };
  if (preferredIndex > 0) return preferredIndex < offers.length && matches(offers[preferredIndex]) ? preferredIndex : -1;
  return offers.findIndex(matches);
}

// MerchantRecipe.a(other) compares the first input, optional second input, and output item IDs.
export function sameTrade(a, b) {
  if (!a || !b || !sameItem(a.buy, b.buy) || !sameItem(a.sell, b.sell)) return false;
  if (Boolean(a.buyB) !== Boolean(b.buyB) || (a.buyB && !sameItem(a.buyB, b.buyB))) return false;
  return true;
}

// MerchantRecipe.b(other), called by list replacement after sameTrade succeeds.
export function prefersReplacement(candidate, old) {
  return Boolean(sameTrade(candidate, old) && (candidate.buy.count < old.buy.count ||
    (candidate.buyB && old.buyB && candidate.buyB.count < old.buyB.count)));
}

// MerchantRecipeList.add: a matching item recipe is replaced when the first cost is lower
// or its second cost is lower. Otherwise the old recipe remains.
// Recipes with different identities append in order.
export function addOrReplaceOffer(offers, candidate) {
  for (let i = 0; i < offers.length; i++) {
    if (!sameTrade(candidate, offers[i])) continue;
    if (prefersReplacement(candidate, offers[i]))
      offers[i] = candidate;
    return i;
  }
  offers.push(candidate);
  return offers.length - 1;
}

export function increaseMaxUses(recipe, amount) {
  if (!Number.isSafeInteger(amount)) throw new RangeError("amount must be an integer");
  recipe.maxUses += amount;
  return recipe.maxUses;
}

export function forceDisableOffer(recipe) {
  recipe.uses = recipe.maxUses;
  return recipe;
}

export function isOfferDisabled(recipe) {
  return !recipe || recipe.uses >= recipe.maxUses;
}

// One successful trade consumes both required inputs, returns a copied result, and increments
// uses exactly once. Failure has no side effects and returns null.
export function executeTrade(recipe, first, second = null) {
  if (!recipe || isOfferDisabled(recipe) || !usable(first) || (second !== null && !usable(second))) return null;
  if (!sameItem(first, recipe.buy) || first.count < recipe.buy.count) return null;
  if (recipe.buyB ? (!sameItem(second, recipe.buyB) || second.count < recipe.buyB.count) : second !== null) return null;
  first.count -= recipe.buy.count;
  if (recipe.buyB) second.count -= recipe.buyB.count;
  recipe.uses++;
  return clone(recipe.sell);
}

// Native recipe NBT stores uses/maxUses and the two input/output ItemStacks. Reopening a
// villager's Offers therefore restores exhaustion. There is no timed restock policy in this kernel.
export function persistOffer(recipe) {
  return { buy: clone(recipe.buy), buyB: recipe.buyB ? clone(recipe.buyB) : null, sell: clone(recipe.sell), uses: recipe.uses, maxUses: recipe.maxUses };
}
export function restoreOffer(saved) {
  if (!saved || !usable(saved.buy) || !usable(saved.sell) || (saved.buyB != null && !usable(saved.buyB))) throw new TypeError("invalid saved villager offer");
  const uses = integer(saved.uses ?? 0, "uses"), maxUses = integer(saved.maxUses ?? 7, "maxUses");
  return { buy: clone(saved.buy), buyB: saved.buyB ? clone(saved.buyB) : null, sell: clone(saved.sell), uses, maxUses };
}
