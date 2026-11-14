// Batch 66 (mptrade): villager trading over a connection. The single-player modules do the work (merchant-ui.js MerchantContainer, villager.js, villager-trading.js);
// this file is the server glue. Wire (named after the 1.7.10 packets):
//   S2D openWindow { kind: 'merchant', title (custom name or 'Villager'), x, y, z (the villager), size } then `tradeList` { windowId, offers: [{ buy, sell, buyB?, disabled }] }
//   (the MC|TrList payload: the window id, a byte count, then per recipe buy, sell, hasSecond, second, disabled; uses and maxUses are NOT sent);
//   C17 MC|TrSel -> `tradeSelect` { windowId, index } (an int, not range-checked natively: aat.e -> aas.c sets the index and recalculates).
// The window itself is an ordinary ServerContainers window (click, slots, close, S32 confirm), so clicks go through ServerContainers.click.
// Bytecode-read (1.7.10): EntityVillager.a(yz) interact refuses a spawn egg in hand, a dead, a trading or a child villager, otherwise sets the customer and calls
// EntityPlayerMP.a(agm, String) (displayGUIMerchant): S2D type 6 first, then getRecipes and MC|TrList. No sneak or name tag test exists in that method.
// ContainerMerchant.a(yz) (canInteractWith) is "the merchant's customer is this player"; EntityAITradePlayer (vl) clears the customer when its conditions fail, which closes the window.
// SlotMerchantResult.onPickupFromSlot calls ItemStack.onCrafting: the item's craft statistic goes up by the amount taken (no achievement; ServerStats.crafted).
import { MerchantContainer } from '../merchant-ui.js';
import { villagerInteract, villagerClearCustomer, villagerOffers, villagerUseRecipe, villagerHover } from '../villager.js';
import { isOfferDisabled } from '../villager-trading.js';
import { SUPPORTED } from './server-mobs.js';
import { wireStack } from './server-containers.js';

SUPPORTED.add('villager'); // idempotent: mpvillage adds the same kind
export const SPAWN_EGG = 383;
const INT_MAX = 2147483647;

// The tradeList payload (ago.a(et)) for a recipe list.
export const offerWire = offers => offers.map(r => ({ buy: wireStack(r.buy), sell: wireStack(r.sell), ...(r.buyB ? { buyB: wireStack(r.buyB) } : {}), disabled: isOfferDisabled(r) }));

export class ServerTrade {
  constructor(sim) { this.sim = sim; }
  // EntityVillager.interact for player `p` on `mob` of the EntityWorld `mobs`. True when the click was the villager's (window opened).
  interact(p, mob, mobs) {
    const brain = mobs.ai.brain(mob);
    if (!brain || p.survival.held?.id === SPAWN_EGG || !villagerInteract(brain, false, p.name)) return false;
    mob.customerId = p.id;
    this.open(p, mob, brain);
    return true;
  }
  open(p, mob, brain) {
    const sim = this.sim, c = sim.containers, s = p.survival;
    sim.serverItems.inv.close(p);
    c.close(p);
    s.inventory.cursor = null;
    const merchant = { offers: () => villagerOffers(brain), hover: has => villagerHover(brain, has), close: () => { if (mob.customerId === p.id) { villagerClearCustomer(mob); mob.customerId = undefined; } },
      useRecipe: r => villagerUseRecipe(brain, r) };
    const container = new MerchantContainer(s.inventory, merchant, { title: mob.customName ?? 'Villager' });
    container.slots[2].onCraft = (stack, n) => this.crafted(p, stack, n);
    const id = (c.nextWindow % 100) + 1; c.nextWindow++;
    const key = [Math.floor(mob.x), Math.floor(mob.y), Math.floor(mob.z)];
    p.window = { id, kind: 'merchant', container, key, block: null, merchant: { usable: () => !!mob.customer && mob.customerId === p.id }, last: [], cursor: '', props: [], pending: 0, ready: false, stationProps: null };
    c.out(p, { type: 'openWindow', windowId: id, kind: 'merchant', title: container.title, x: key[0], y: key[1], z: key[2], size: container.slots.length, rows: 0 });
    c.out(p, { type: 'tradeList', windowId: id, offers: offerWire(villagerOffers(brain)) }); // displayGUIMerchant: getRecipes after the open packet
  }
  crafted(p, stack, n) {
    if (!stack || !(n > 0)) return;
    (this.sim.events ??= []).push({ type: 'crafted', id: p.id, item: stack.id, count: n });
    this.sim.stats?.crafted(p, stack, n);
  }
  // MC|TrSel: only while the player's open window is a merchant's.
  select(p, m) {
    const win = p.window;
    if (win?.kind !== 'merchant' || !Number.isInteger(m?.index) || Math.abs(m.index) > INT_MAX) return false;
    win.container.select(m.index);
    return true;
  }
  // A player who leaves: the villager is released and the payment stacks go back (Container.onContainerClosed).
  leave(p) { if (p.window?.kind === 'merchant') this.sim.containers.close(p); }
  // The view a trading villager reads as its player (EntityVillager.getCustomer), for ServerMobs.target.
  customerView(e, views) { return e.type === 'villager' && e.customer && e.customerId !== undefined ? views.get(e.customerId) ?? null : null; }
}

// The one-line join for the villager click (mpvillage's `sim.mobs.villagerUse = (player, mob) => boolean`, true = handled): `sim.mobs.villagerUse = installTrade(sim)`.
export const openTrade = (sim, p, mob, mobs = sim.mobs?.mobs) => sim.trade.interact(p, mob, mobs);
export const installTrade = sim => (p, mob) => openTrade(sim, p, mob);
