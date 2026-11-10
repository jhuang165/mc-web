// The browser half of the gun server's inventory windows (server-play.js). Like PlayerControllerMP.windowClick, a click runs on
// this tab's copy at once (the prediction) and goes to the server as [slot, button, mode]; the server's answer (you.inv: the
// inventory, the held stack and the window's own slots) replaces the copy, and the clicks it has not acknowledged yet are
// replayed on top. Creative players set slots directly (C10PacketCreativeInventoryAction). Not 1.7.10 networking.
import { StackArray, ChestContainer, copyStack } from '../inventory.js';
import { DispenserContainer } from '../dispenser-container.js';
import { HopperContainer } from '../hopper.js';
import { MerchantContainer } from '../merchant-ui.js';
import { HorseContainer } from '../horse-gear.js';
import { BrewingContainer } from '../brewing-container.js';
import { brewingView, newBrewingTile } from '../brewing.js';
import { EnchantingContainer } from '../enchanting-container.js';
import { AnvilContainer } from '../anvil-container.js';
import { BeaconContainer } from '../pyramid-container.js';

export const MAX_CLICKS = 64;
const noop = () => {};
// Window 0 slot numbers (ContainerPlayer) for an InventoryPlayer index: 9-35 main, 36-44 hotbar, 5-8 armour (helmet first).
export const creativeSlot = i => i < 9 ? 36 + i : i < 36 ? i : 8 - (i - 36);

export class RemoteInventory {
  constructor(send) {
    Object.assign(this, { send, seq: 0, pending: [], queue: null, window: null, snapshot: null, replaying: false });
  }
  reset() { this.pending.length = 0; this.queue = null; this.window = null; this.snapshot = null; }
  // A container this tab shows for server window `id` (0: the player's own inventory); its clicks are forwarded.
  attach(container, id) {
    const click = container.click.bind(container);
    container.localClick = click;
    container.click = (slot, button, mode) => { this.queueClick(id, [slot, button, mode]); return click(slot, button, mode); };
    // A villager's arrows (MC|TrSel) go in order with the clicks; the payment slots are matched to the offer on both sides.
    if (container instanceof MerchantContainer) {
      const select = container.select.bind(container);
      container.select = index => { this.flush(); this.send({ type: 'trade', window: id, index }); return select(index); };
    }
    // The station buttons (server-stations.js message): the enchantment is rolled on the server only (this tab's table is remote and
    // keeps the server's levels); a typed anvil name and a beacon's picks apply here too, as predictions.
    if (container instanceof EnchantingContainer)
      container.enchant = option => { if (!container.canEnchant(option)) return false; this.flush(); this.send({ type: 'enchant', window: id, option }); return true; };
    if (container instanceof AnvilContainer) {
      const setName = container.setName.bind(container);
      container.setName = name => { if (!this.replaying) { this.flush(); this.send({ type: 'anvil', window: id, name: name == null ? '' : String(name) }); } return setName(name); };
    }
    if (container instanceof BeaconContainer) {
      const confirm = container.confirm.bind(container);
      container.confirm = (primary, secondary) => { this.flush(); this.send({ type: 'beacon', window: id, primary, secondary }); return confirm(primary, secondary); };
    }
    this.window = { id, container };
    return container;
  }
  queueClick(window, click) {
    if (this.queue && this.queue.window !== window) this.flush();
    if (!this.queue) { this.queue = { kind: 'click', window, clicks: [] }; queueMicrotask(() => this.flush()); }
    this.queue.clicks.push(click);
    if (this.queue.clicks.length >= MAX_CLICKS) this.flush();
  }
  // One message per gesture: a drag's start, slots and end arrive together, in order.
  flush() {
    const q = this.queue;
    if (!q) return;
    this.queue = null;
    q.seq = ++this.seq;
    this.pending.push(q);
    this.send({ type: 'click', window: q.window, clicks: q.clicks, seq: q.seq });
  }
  // Closing a window here (GuiContainer.onGuiClosed -> C0DPacketCloseWindow); the server throws the held stack and the grid.
  close(container) {
    this.flush();
    if (this.window?.container !== container) return;
    this.send({ type: 'close', window: this.window.id });
    this.window = null;
  }
  // The server closed the window (the block went, the player walked away or died): no close message goes back.
  forget() { this.flush(); this.window = null; }
  // Creative: every main/armour slot that changed since the last look goes to the server, and stacks thrown out of the screen.
  creative(inv, drops = []) {
    const now = [...inv.main, ...inv.armor].map(s => JSON.stringify(s ?? null));
    if (this.snapshot) now.forEach((s, i) => {
      if (s === this.snapshot[i]) return;
      const op = { kind: 'creative', index: i, stack: copyStack(inv.getStack(i)), seq: ++this.seq };
      this.pending.push(op);
      this.send({ type: 'creative', slot: creativeSlot(i), stack: op.stack, seq: op.seq });
    });
    for (const stack of drops) if (stack?.count) this.send({ type: 'creative', slot: -1, stack: copyStack(stack), seq: this.seq });
    this.snapshot = now;
  }
  // A guns-mod action on the inventory (gun-simulation.js gun: fit, smith, box): `apply(inv)` runs it on this tab's copy now and
  // again over every server inventory until the server has seen it.
  gun(message, apply, inv) {
    this.flush();
    const op = { kind: 'gun', apply, seq: ++this.seq };
    this.pending.push(op);
    this.send({ ...message, type: 'gun', seq: op.seq });
    return apply(inv);
  }
  // The server's acknowledgement: predictions it has seen are now part of its own state.
  acked(ack) {
    const before = this.pending.length;
    while (this.pending.length && this.pending[0].seq <= ack) this.pending.shift();
    return this.pending.length !== before;
  }
  // After the inventory was rebuilt from the server: the open window's own slots and the held stack, then the clicks still in flight.
  restore(inv, state, { creative = false } = {}) {
    const w = this.window;
    if (!creative && state) {
      inv.cursor = inv.read(state.cursor ?? null, true);
      if (w && state.id === w.id) {
        const slots = w.container.slots;
        if (Array.isArray(state.offers) && w.container.remote) {
          w.container.remote.offers = state.offers;
          if (!w.container.remote.seen) { w.container.remote.seen = true; if (Number.isInteger(state.recipe)) w.container.currentRecipeIndex = state.recipe; }
        }
        for (const [i, stack] of state.slots ?? []) if (slots[i] && i !== 0) slots[i].inventory.setStack(slots[i].index, inv.read(stack, true));
        // The crafting result last: setting the grid recomputes it, and the server's word wins.
        const first = (state.slots ?? []).find(([i]) => i === 0);
        if (first && slots[0]) slots[0].inventory.setStack(slots[0].index, inv.read(first[1], true));
        stationState(w.container, state);
      }
    }
    this.replaying = true;
    for (const op of this.pending) {
      if (op.kind === 'creative') inv.setStack(op.index, copyStack(op.stack));
      else if (op.kind === 'gun') op.apply(inv);
      else if (!creative && w && op.window === w.id) for (const c of op.clicks) w.container.localClick(...c);
    }
    if (this.queue && w) for (const c of this.queue.clicks) if (this.queue.window === w.id) w.container.localClick(...c);
    this.replaying = false;
    if (w) w.container.drops.length = 0; // the server throws the items; this tab only sees them land
    if (creative) this.snapshot = [...inv.main, ...inv.armor].map(s => JSON.stringify(s ?? null));
  }
}

// What a station window shows besides its slots (ServerStations.state): the brew's progress, the enchanting levels, the anvil's
// cost (the result is worked out here from the inputs and the typed name) and the beacon's pyramid and picks.
function stationState(c, state) {
  if (c instanceof BrewingContainer && Number.isInteger(state.brew)) c.stand.brewTime = state.brew;
  if (c instanceof EnchantingContainer && Array.isArray(state.levels)) c.table.enchantLevels = [0, 1, 2].map(i => Number.isInteger(state.levels[i]) ? state.levels[i] : 0);
  if (c instanceof AnvilContainer) { c.updateRepairOutput(); if (Number.isInteger(state.cost)) c.maximumCost = state.cost; }
  if (c instanceof BeaconContainer && state.beacon) for (const k of ['levels', 'primary', 'secondary']) if (Number.isInteger(state.beacon[k])) c.tile[k] = state.beacon[k];
}

// The container this tab builds around its copy for a window the server opened (ServerPlay.open): the same slots, empty
// until the server's slots arrive. `survival` supplies the player's own inventory and the workbench/furnace containers; `env` the
// station windows' world, beacon tiles, experience level and anvil hooks (main.js).
export function remoteContainer(survival, open, env = {}) {
  const inv = survival.inventory;
  if (open.kind === 'workbench') return survival.openWorkbench();
  if (open.kind === 'furnace') {
    survival.furnaces[open.key] ??= { items: [null, null, null], burn: 0, burnTotal: 0, cook: 0 };
    return survival.openFurnace(open.key);
  }
  if (open.kind === 'chest') {
    const rows = Number.isInteger(open.rows) && open.rows >= 1 && open.rows <= 6 ? open.rows : 3;
    return Object.assign(new ChestContainer(inv, new StackArray(Array(rows * 9).fill(null))), { title: open.title ?? undefined });
  }
  if (open.kind === 'dispenser') return Object.assign(new DispenserContainer(inv, { items: Array(9).fill(null) }, noop), open.title ? { title: open.title } : {});
  if (open.kind === 'hopper') return new HopperContainer(inv, { items: Array(5).fill(null), name: open.title ?? undefined }, noop);
  if (open.kind === 'merchant') {
    // The villager's offers come with the window's slots (ServerPlay.windowState); trades and their sounds happen on the server.
    const remote = { offers: [], seen: false };
    const c = new MerchantContainer(inv, { offers: () => remote.offers, useRecipe: noop, hover: noop, close: noop }, open.title ? { title: open.title } : {});
    return Object.assign(c, { remote });
  }
  if (open.kind === 'horse') {
    const h = { chested: !!open.horse?.chested, type: Number.isInteger(open.horse?.type) ? open.horse.type : 0, items: [] };
    return new HorseContainer(inv, h, noop, open.title ?? '');
  }
  const at = typeof open.key === 'string' ? open.key.split(',').map(Number) : null, level = env.experienceLevel ?? (() => 0);
  if (!at || at.length !== 3 || !at.every(Number.isInteger)) return null;
  if (open.kind === 'brewing') return new BrewingContainer(inv, brewingView(newBrewingTile()), noop, open.title ?? undefined);
  if (open.kind === 'enchanting' && env.world)
    return new EnchantingContainer({ inventory: inv, world: env.world, x: at[0], y: at[1], z: at[2], creative: () => survival.creative, experienceLevel: level, remote: true });
  if (open.kind === 'anvil') {
    let c;
    c = new AnvilContainer({ inventory: inv, creative: () => survival.creative, experienceLevel: level, itemName: env.itemName ?? (() => ''),
      onInputChanged: change => env.anvilInput?.(c, change) });
    return c;
  }
  if (open.kind === 'beacon' && env.beacons) return new BeaconContainer({ inventory: inv, tile: env.beacons.ensure(...at) });
  return null;
}

// Dropped items the server reports near this player ([entity, x, y, z, id, damage, count]), as ItemEntities-shaped records the
// drop renderer draws and interpolates.
export class RemoteItems {
  constructor() { this.byId = new Map(); }
  get items() { return [...this.byId.values()]; }
  sync(list) {
    const seen = new Set();
    for (const row of Array.isArray(list) ? list : []) {
      const [eid, x, y, z, id, damage, count] = row;
      if (![eid, x, y, z, id, damage, count].every(Number.isFinite)) continue;
      seen.add(eid);
      let e = this.byId.get(eid);
      if (!e) this.byId.set(eid, e = { eid, x, y, z, px: x, py: y, pz: z, hover: Math.random() * Math.PI * 2, age: 0, stack: null });
      else { e.px = e.x; e.py = e.y; e.pz = e.z; e.x = x; e.y = y; e.z = z; e.age++; }
      if (!e.stack || e.stack.id !== id || e.stack.damage !== damage || e.stack.count !== count) e.stack = { id, damage, count };
    }
    for (const eid of this.byId.keys()) if (!seen.has(eid)) this.byId.delete(eid);
  }
  take(eid) { const e = this.byId.get(eid); this.byId.delete(eid); return e ?? null; }
  clear() { this.byId.clear(); }
}
