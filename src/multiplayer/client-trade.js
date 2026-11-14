// Batch 66 (mptrade): the client half of villager trading (see server-trade.js for the wire). The single-player MerchantContainer (merchant-ui.js, GuiMerchant) runs
// locally as the prediction; the offers arrive as `tradeList` (the MC|TrList payload: buy, sell, optional second buy, disabled; no uses or maxUses), a selected offer goes
// to the server as `tradeSelect` (MC|TrSel) and slot clicks use the ordinary window messages (client-containers.js wireClicks).
import { MerchantContainer } from '../merchant-ui.js';

// A MerchantRecipe as ago.b(et) builds it: default maxUses 7, disabled -> forceDisable (uses = maxUses).
const MAX_USES = 7;
export const recipeFromWire = o => ({ buy: o.buy, buyB: o.buyB ?? null, sell: o.sell, uses: o.disabled ? MAX_USES : 0, maxUses: MAX_USES });
const usableStack = s => s && Number.isInteger(s.id) && s.id >= 0 && Number.isInteger(s.count) && s.count > 0 && s.count <= 64;

// The local merchant window for an S2D kind 'merchant'. The offer list starts empty; `tradeList` fills it. NpcMerchant.useRecipe (client side) only counts a use.
export function buildMerchant(m, inv, { crafted = null } = {}) {
  const merchant = { list: [], offers() { return this.list; }, useRecipe: r => { r.uses++; }, hover() {}, close() {} };
  const container = new MerchantContainer(inv, merchant, { title: m.title || undefined });
  if (crafted) container.slots[2].onCraft = crafted;
  return container;
}
// S2F-style MC|TrList: replaces the list (bad entries are skipped) and recalculates the result.
export function applyTradeList(container, m) {
  if (!container?.merchant?.list || !Array.isArray(m?.offers)) return false;
  const list = [];
  for (const o of m.offers.slice(0, 255)) if (usableStack(o?.buy) && usableStack(o?.sell) && (o.buyB == null || usableStack(o.buyB))) list.push(recipeFromWire(o));
  container.merchant.list = list;
  container.reset();
  return true;
}
// The arrow buttons select an offer: the local select, then MC|TrSel.
export function wireTrade(container, client, windowId) {
  const select = container.select.bind(container);
  container.select = index => { select(index); client.tradeSelect(windowId, index); };
}
