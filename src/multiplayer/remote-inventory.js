// The browser half of the gun server's inventory windows (server-play.js). Like PlayerControllerMP.windowClick, a click runs on
// this tab's copy at once (the prediction) and goes to the server as [slot, button, mode]; the server's answer (you.inv: the
// inventory, the held stack and the window's own slots) replaces the copy, and the clicks it has not acknowledged yet are
// replayed on top. Creative players set slots directly (C10PacketCreativeInventoryAction). Not 1.7.10 networking.
import { StackArray, ChestContainer, copyStack } from '../inventory.js';
import { DispenserContainer } from '../dispenser-container.js';
import { HopperContainer } from '../hopper.js';

export const MAX_CLICKS = 64;
const noop = () => {};
// Window 0 slot numbers (ContainerPlayer) for an InventoryPlayer index: 9-35 main, 36-44 hotbar, 5-8 armour (helmet first).
export const creativeSlot = i => i < 9 ? 36 + i : i < 36 ? i : 8 - (i - 36);

export class RemoteInventory {
  constructor(send) {
    Object.assign(this, { send, seq: 0, pending: [], queue: null, window: null, snapshot: null });
  }
  reset() { this.pending.length = 0; this.queue = null; this.window = null; this.snapshot = null; }
  // A container this tab shows for server window `id` (0: the player's own inventory); its clicks are forwarded.
  attach(container, id) {
    const click = container.click.bind(container);
    container.localClick = click;
    container.click = (slot, button, mode) => { this.queueClick(id, [slot, button, mode]); return click(slot, button, mode); };
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
        for (const [i, stack] of state.slots ?? []) if (slots[i] && i !== 0) slots[i].inventory.setStack(slots[i].index, inv.read(stack, true));
        // The crafting result last: setting the grid recomputes it, and the server's word wins.
        const first = (state.slots ?? []).find(([i]) => i === 0);
        if (first && slots[0]) slots[0].inventory.setStack(slots[0].index, inv.read(first[1], true));
      }
    }
    for (const op of this.pending) {
      if (op.kind === 'creative') inv.setStack(op.index, copyStack(op.stack));
      else if (!creative && w && op.window === w.id) for (const c of op.clicks) w.container.localClick(...c);
    }
    if (this.queue && w) for (const c of this.queue.clicks) if (this.queue.window === w.id) w.container.localClick(...c);
    if (w) w.container.drops.length = 0; // the server throws the items; this tab only sees them land
    if (creative) this.snapshot = [...inv.main, ...inv.armor].map(s => JSON.stringify(s ?? null));
  }
}

// The container this tab builds around its copy for a window the server opened (ServerPlay.open): the same slots, empty
// until the server's slots arrive. `survival` supplies the player's own inventory and the workbench/furnace containers.
export function remoteContainer(survival, open) {
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
  if (open.kind === 'hopper') return new HopperContainer(inv, { items: Array(5).fill(null) }, noop);
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
