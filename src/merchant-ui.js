// Minecraft Java 1.7.10 ContainerMerchant (aat), InventoryMerchant (aas) and SlotMerchantResult (aau) over the
// villager's MerchantRecipeList, plus the data model of GuiMerchant (bfv, textures/gui/container/villager.png).
// Slots: payment 0 (36, 53) and 1 (62, 53), result 2 (120, 53), then the 27 main and 9 hotbar slots at
// (8 + 18c, 84 + 18r) / y 142. Replayed against the unchanged classes by villager-trading-live.test.js.
//
// Recipes keep original 1.7.10 item ids (villager-trading.js). Matching and consuming compare the original
// item id of the browser stack (anvil-container.js liveStackToNative); a browser item with no original id
// never matches. An offer whose result has no browser item is shown but cannot be taken (see
// villager-trading-live.md); native would still call it a result for the villager's yes sound, so that
// decision is kept separately.
import { Container, Slot, copyStack } from "./inventory.js";
import { containerTitle } from "./container-names.js";
import { liveStackToNative, nativeStackToLive } from "./anvil-container.js";
import { findMatchingOffer, isOfferDisabled } from "./villager-trading.js";

export const MERCHANT_TITLE = "Villager";
// GuiMerchant geometry (bfv): items at (36, 24), (62, 24), (120, 24); next button (147, 23), previous (17, 23),
// 12 x 19, texture u 176 / 188 (hover) / 200 (disabled), v 0 next / 19 previous; spent-offer crosses at
// (83, 21) and (83, 51), 28 x 21 from (212, 0).
export const MERCHANT_LAYOUT = Object.freeze({
  buy: [36, 24], buyB: [62, 24], sell: [120, 24], next: [147, 23], previous: [17, 23], button: [12, 19], cross: [[83, 21], [83, 51]], crossSize: [28, 21], crossUV: [212, 0],
});

// A recipe stack as a browser stack, or null when the build has no such item. The kernel's empty
// enchantment arrays mean "no tag" and are dropped.
export function offerStackToLive(stack) {
  if (!stack) return null;
  const native = { ...stack };
  if (Array.isArray(native.enchantments) && native.enchantments.length === 0) delete native.enchantments;
  return nativeStackToLive(native);
}
// Original id a payment stack counts as (Item identity); unmapped browser items get ids no recipe uses.
export const paymentId = (stack) => (stack ? liveStackToNative(stack)?.id ?? -1 - stack.id : null);

// InventoryMerchant: three stacks; changing a payment slot recalculates the result (resetRecipeAndSlots).
class MerchantInventory {
  constructor(container) {
    this.container = container;
    this.stacks = [null, null, null];
  }
  get size() {
    return 3;
  }
  get limit() {
    return 64;
  }
  getStack(i) {
    return this.stacks[i] ?? null;
  }
  // setInventorySlotContents
  setStack(i, s) {
    this.stacks[i] = s;
    if (s && s.count > 64) s.count = 64;
    if (i === 0 || i === 1) this.container.reset();
  }
  // decrStackSize: the result slot gives up the whole stack; a payment slot recalculates afterwards.
  decr(i, n) {
    const s = this.stacks[i];
    if (!s) return null;
    if (i === 2) {
      this.stacks[2] = null;
      return s;
    }
    if (s.count <= n) {
      this.stacks[i] = null;
      this.container.reset();
      return s;
    }
    const out = copyStack({ ...s, count: n });
    s.count -= n;
    if (s.count === 0) this.stacks[i] = null;
    this.container.reset();
    return out;
  }
  // getStackInSlotOnClosing
  takeOnClose(i) {
    const s = this.stacks[i] ?? null;
    this.stacks[i] = null;
    return s;
  }
}
// aay: onSlotChanged asks the inventory to recalculate (aas.e -> h).
class PaymentSlot extends Slot {
  changed() {
    this.inventory.container.reset();
  }
}
// SlotMerchantResult (aau): nothing may be put in; taking it trades.
class ResultSlot extends PaymentSlot {
  constructor(inventory, x, y) {
    super(inventory, 2, x, y);
    this.amount = 0;
  }
  valid() {
    return false;
  }
  decr(n) {
    if (this.has) this.amount += Math.min(n, this.stack.count);
    return super.decr(n);
  }
  // SlotMerchantResult.onCrafting(stack, n) / onCrafting(stack): ItemStack.onCrafting adds the taken amount to the item's craft statistic (aau.b -> add.a(world, player, amount)); no achievement.
  crafted(s, n) {
    this.amount += n;
    this.finish(s);
  }
  finish(s) {
    const n = this.amount;
    this.amount = 0;
    if (s && n > 0) this.onCraft?.(s, n);
  }
  // onPickupFromSlot: onCrafting first, then the recipe consumes its inputs from either slot order and the villager uses it.
  onPickup(s) {
    this.finish(s);
    this.inventory.container.trade();
  }
}

export class MerchantContainer extends Container {
  // `merchant`: { offers() -> recipe list, useRecipe(recipe), hover(hasResult), close() }
  // `convert` replaces the browser <-> original item mapping (the replay test feeds original ids directly).
  constructor(inv, merchant, { title = MERCHANT_TITLE, convert = {} } = {}) {
    super(inv);
    this.toId = convert.id ?? paymentId;
    this.toLive = convert.live ?? offerStackToLive;
    this.merchant = merchant;
    this.title = title;
    this.merchantInventory = new MerchantInventory(this);
    this.currentRecipeIndex = 0;
    this.currentRecipe = null;
    this.addSlot(new PaymentSlot(this.merchantInventory, 0, 36, 53));
    this.addSlot(new PaymentSlot(this.merchantInventory, 1, 62, 53));
    this.addSlot(new ResultSlot(this.merchantInventory, 120, 53));
    this.addPlayerSlots(8, 84);
  }
  get offers() {
    return this.merchant.offers() ?? [];
  }
  // InventoryMerchant.resetRecipeAndSlots (aas.h).
  reset() {
    const inv = this.merchantInventory, list = this.merchant.offers(), native = (x) => (x ? { id: this.toId(x), count: x.count, damage: x.damage ?? 0 } : null);
    this.currentRecipe = null;
    let first = inv.stacks[0], second = inv.stacks[1], result = null;
    if (!first) [first, second] = [second, null];
    if (first && list) {
      const pick = (a, b) => {
        const i = findMatchingOffer(list, native(a), native(b), this.currentRecipeIndex);
        const recipe = i >= 0 ? list[i] : null;
        return recipe && !isOfferDisabled(recipe) ? recipe : null;
      };
      this.currentRecipe = pick(first, second) ?? (second ? pick(second, first) : null);
      result = this.currentRecipe;
    }
    inv.stacks[2] = result ? this.toLive(result.sell) : null;
    if (list) this.merchant.hover(!!result);
  }
  // SlotMerchantResult.onPickupFromSlot: doTrade(recipe, a, b) || doTrade(recipe, b, a).
  trade() {
    const inv = this.merchantInventory, recipe = this.currentRecipe;
    if (!recipe) return;
    let a = inv.stacks[0], b = inv.stacks[1];
    const doTrade = (r, x, y) => {
      const buy = r.buy, buyB = r.buyB;
      if (x && this.toId(x) === buy.id) {
        if (buyB && y && this.toId(y) === buyB.id) {
          x.count -= buy.count;
          y.count -= buyB.count;
          return true;
        }
        if (!buyB && !y) {
          x.count -= buy.count;
          return true;
        }
      }
      return false;
    };
    if (doTrade(recipe, a, b) || doTrade(recipe, b, a)) {
      this.merchant.useRecipe(recipe);
      if (a && a.count <= 0) a = null;
      if (b && b.count <= 0) b = null;
      inv.setStack(0, a);
      inv.setStack(1, b);
    }
  }
  // GuiMerchant buttons (MC|TrSel): setCurrentRecipeIndex recalculates.
  select(index) {
    this.currentRecipeIndex = index;
    this.reset();
  }
  canStep(direction) {
    const n = this.offers.length;
    return direction > 0 ? this.currentRecipeIndex < n - 1 : this.currentRecipeIndex > 0;
  }
  step(direction) {
    if (!this.canStep(direction)) return false;
    this.select(this.currentRecipeIndex + direction);
    return true;
  }
  // ContainerMerchant.transferStackInSlot (b(yz, int)): the result goes to the player slots (filled from the end),
  // payment slots to the player slots, main to hotbar, hotbar to main. Payment slots are only filled by hand.
  transfer(index) {
    return this.move(index, (stack, slot, moved) => {
      if (index === 2) {
        if (!this.merge(stack, 3, 39, true)) return false;
        slot.onSlotChange(stack, moved);
        return true;
      }
      if (index === 0 || index === 1) return this.merge(stack, 3, 39, false);
      if (index >= 3 && index < 30) return this.merge(stack, 30, 39, false);
      return this.merge(stack, 3, 30, false);
    });
  }
  // onContainerClosed: the customer is released, then both payment stacks are dropped at the player.
  close() {
    super.close();
    this.merchant.close?.();
    for (let i = 0; i < 2; i++) {
      const s = this.merchantInventory.takeOnClose(i);
      if (s) this.drop(s);
    }
  }
  // GuiMerchant's view: the selected offer's three stacks and whether it is spent.
  view() {
    const list = this.offers, recipe = list[this.currentRecipeIndex];
    const show = (s) => (s ? { live: offerStackToLive(s), count: s.count, original: s.id, damage: s.damage ?? 0 } : null);
    return {
      index: this.currentRecipeIndex,
      count: list.length,
      next: this.canStep(1),
      previous: this.canStep(-1),
      recipe: recipe ? { buy: show(recipe.buy), buyB: show(recipe.buyB), sell: show(recipe.sell), disabled: isOfferDisabled(recipe), uses: recipe.uses, maxUses: recipe.maxUses } : null,
    };
  }
}

// GuiContainer.func_146978_c-style hit test inside the 176 x 166 screen.
export const inRect = (x, y, [rx, ry], [w, h]) => x >= rx && x < rx + w && y >= ry && y < ry + h;
// The item of the selected offer under a pointer at GUI pixel (x, y), for its tooltip.
export function offerItemAt(view, x, y) {
  if (!view.recipe) return null;
  for (const key of ["buy", "buyB", "sell"]) if (view.recipe[key] && inRect(x, y, MERCHANT_LAYOUT[key], [16, 16])) return view.recipe[key];
  return null;
}
// The merchant screen's static decorations; main.js fills the item icons through renderMerchantView.
export const merchantDecorationsHtml = () =>
  `<span class="merchant-bag-label">${containerTitle("Inventory")}</span>` +
  '<i class="merchant-cross" data-merchant-cross="0" hidden></i><i class="merchant-cross" data-merchant-cross="1" hidden></i>' +
  ["buy", "buyB", "sell"].map((k) => `<span class="merchant-offer" data-merchant-offer="${k}"></span>`).join("") +
  '<button class="merchant-step next" data-merchant-step="1" aria-label="Next trade" disabled></button><button class="merchant-step previous" data-merchant-step="-1" aria-label="Previous trade" disabled></button>';
