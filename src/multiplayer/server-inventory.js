// Batch 60 (mpinventory): the player's own inventory window (window id 0) on a Survival dedicated server.
//
// The server keeps one ContainerPlayer per player (`p.invWin`, the port's PlayerContainer over `p.survival.inventory`): 2x2 grid, craft result, 4 armour slots, the
// 36 main slots and the cursor stack. C0E with window 0 (`invClick`) runs Container.click here, as NetHandlerPlayServer.processClickWindow does: a click whose
// result equals the client's claim is confirmed (`invConfirm`, S32 accepted) and nothing else is sent (the client already drew it); a different result is S32
// refused plus the whole window (`invItems`, S30), after which further clicks are ignored until the client acks (`invAck`, C0F) or 100 ticks pass.
// Server-made changes (armour wear from a hit, anything else) are diffed at the end of each tick and sent as `invSet` (S2F). C0D (`invClose`) runs
// ContainerPlayer.onContainerClosed: the cursor and the crafting grid are thrown as items.
// Wire names (all prefixed inv): out `invItems`, `invSet`, `invConfirm`, `invBroke`; in `invClick`, `invAck`, `invClose`, `invCreative` (b61, C10).
import { ITEMS } from '../survival.js';
import { copyStack, OUTSIDE } from '../inventory.js';
import { cleanStack, wireStack } from './server-containers.js';
import { SpamCounter, creativeDrop } from '../server-handlers.js';

const f = Math.fround;
const PENDING_TICKS = 100, SLOTS = 45;
const same = (a, b) => (!a && !b) || (!!a && !!b && a.id === b.id && a.count === b.count && (a.damage ?? 0) === (b.damage ?? 0));
const sig = s => (s ? JSON.stringify(s) : '');
// Container slot -> InventoryPlayer.armorInventory index (ContainerPlayer slots 5..8 are armorInventory[3..0]: helmet first).
export const armorIndexOf = slot => 8 - slot;

export class ServerInventory {
  constructor(sim) { this.sim = sim; }
  get enabled() { return this.sim.serverItems.survival; }
  win(p) {
    if (!p.invWin) { const container = p.survival.openInventory(); container.onCraft = (stack) => this.sim.achievements?.onCrafted(p, stack); /* b60 lead: SlotCrafting.onCrafting (server-achievements.js) */ p.invWin = { container, last: null, pending: 0 }; p.invWin.last = this.snapshot(p); }
    return p.invWin;
  }
  // What the client was last told about the slots this module owns: armour, grid and the cursor.
  snapshot(p) {
    const inv = p.survival.inventory, c = p.invWin.container;
    return { armor: inv.armor.map(sig), grid: c.grid.stacks.map(sig), cursor: sig(inv.cursor) };
  }
  state(p, seq) {
    const inv = p.survival.inventory, c = p.invWin.container;
    return { type: 'invItems', seq, main: inv.main.map(wireStack), armor: inv.armor.map(wireStack), grid: c.grid.stacks.map(wireStack), cursor: wireStack(inv.cursor) };
  }
  out(p, m) { (p.itemsOut ??= []).push(m); }
  drain(p) { for (const s of p.invWin.container.drops.splice(0)) this.sim.items.dropPlayer(copyStack(s), p.position, p.yaw, p.pitch); }

  // C0E, window 0. True when the message was well formed (accepted or refused).
  click(p, m) {
    if (!p || !this.enabled || p.survival.creative || p.dead || p.window) return false;
    const win = this.win(p), c = win.container;
    if (win.pending && this.sim.ticks <= win.pending) return false;
    win.pending = 0;
    if (![m?.slot, m?.button, m?.mode, m?.action].every(Number.isInteger) || m.slot < OUTSIDE || m.slot >= SLOTS || m.slot < 0 && m.slot !== OUTSIDE
      || m.mode < 0 || m.mode > 6 || m.button < 0 || m.button > 1023) return false;
    const claimed = cleanStack(m.item);
    if (claimed === undefined) return false;
    const result = c.click(m.slot, m.button, m.mode);
    this.drain(p);
    if (same(claimed, result ? copyStack(result) : null)) {
      // b61: detectAndSendChanges after an accepted click: the slots, armour, grid and cursor the click changed go out as S2F-like corrections
      // (`slot` for main slots through ServerItems.settle, `invSet` for the rest) at the end of this tick, even when the client predicted the same, so a divergence is overwritten at once.
      this.out(p, { type: 'invConfirm', action: m.action, accepted: true });
    } else {
      win.pending = this.sim.ticks + PENDING_TICKS;
      this.out(p, { type: 'invConfirm', action: m.action, accepted: false });
      this.resend(p);
    }
    return true;
  }
  // S30: the whole window. Every main slot counts as corrected at this seq, so an input still in flight cannot undo it.
  resend(p) {
    const seq = ++p.seq, main = p.survival.inventory.main;
    main.forEach((s, i) => { p.slotSeq[i] = seq; p.seen[i] = s ? copyStack(s) : null; });
    p.invWin.last = this.snapshot(p);
    this.out(p, this.state(p, seq));
  }
  ack(p) { if (p?.invWin) p.invWin.pending = 0; } // C0F
  // C0D: ContainerPlayer.onContainerClosed throws the cursor and the grid; the result slot is emptied.
  close(p) {
    if (!p?.invWin) return false;
    const c = p.invWin.container;
    c.close();
    this.drain(p);
    p.invWin.pending = 0;
    p.invWin.last = this.snapshot(p);
    return true;
  }
  // The player leaves: what the window holds is thrown at the feet (recalled: the original closes the container on logout).
  leave(p) { if (p?.invWin) this.close(p); }

  // End of a tick: armour, grid and cursor changes the server made since the client last saw them.
  settle(p) {
    if (!p.invWin) return;
    const inv = p.survival.inventory, c = p.invWin.container, last = p.invWin.last, now = this.snapshot(p);
    const armor = [], grid = [], msg = { type: 'invSet', seq: 0 };
    now.armor.forEach((g, i) => { if (g !== last.armor[i]) armor.push({ i, stack: wireStack(inv.armor[i]) }); });
    now.grid.forEach((g, i) => { if (g !== last.grid[i]) grid.push({ i, stack: wireStack(c.grid.stacks[i]) }); });
    if (armor.length) msg.armor = armor;
    if (grid.length) msg.grid = grid;
    if (now.cursor !== last.cursor) msg.cursor = wireStack(inv.cursor);
    p.invWin.last = now;
    if (armor.length || grid.length || 'cursor' in msg) { msg.seq = p.seq; this.out(p, msg); }
  }

  // ---- Creative inventory (C10 CPacketCreativeInventoryAction, `invCreative`) ----
  // NetHandlerPlayServer.processCreativeInventoryAction (bytecode-read, nh.a(jm)): only for a Creative player. The stack is valid when null, or its item exists,
  // damage >= 0 and 0 < size <= 64. Slot 1..44 (grid 1-4, armour 5-8, main 9-35, hotbar 36-44; not the result slot 0) with a valid stack: ContainerPlayer.putStackInSlot
  // (null clears), then the container is told to send the change. Slot < 0 with a valid stack and the spam counter (field m) under 200: m += 20, then the stack is thrown
  // (EntityPlayer.dropPlayerItemWithRandomChoice(stack, true); a null stack throws nothing) and the entity age is set to 4800 (xk.e, creative despawn time).
  // Anything else is ignored. Returns true when the stack and slot were well formed.
  creative(p, m) {
    if (!p || p.dead || !p.survival.creative || !Number.isInteger(m?.slot)) return false;
    const stack = cleanStack(m.item);
    if (stack === undefined) return false; // not a valid stack: ignored
    if (m.slot >= 1 && m.slot < SLOTS) {
      const win = this.win(p);
      win.container.slots[m.slot].put(stack);
      // Creative's own client drew it: the echo of this slot is suppressed (the main slots are also mirrored beside this message).
      if (m.slot >= 9) { const i = m.slot >= 36 ? m.slot - 36 : m.slot; p.seen[i] = stack ? copyStack(stack) : null; }
      win.last = this.snapshot(p);
      return true;
    }
    if (m.slot < 0) {
      const counter = (p.dropSpam ??= new SpamCounter());
      if (!creativeDrop(counter, this.sim.ticks, stack)) return true;
      if (stack) { const e = this.sim.items.dropPlayer(copyStack(stack), p.position, p.yaw, p.pitch, true); if (e) e.age = 4800; } // scatter: dropPlayerItemWithRandomChoice(stack, true)
      return true;
    }
    return true; // slot 0 or above 44: well formed, ignored
  }

  // ---- a broken tool ----
  // ItemStack.damageItem -> EntityLivingBase.renderBrokenItemStack: random.break 0.8 / (0.8 + World.rand * 0.4) through EntityPlayer.playSound =
  // World.playSoundToNearExcept(player) (everyone near but the breaker); the 5 crumbs are client-side particles only. The breaker's own client runs the
  // damage itself in PlayerControllerMP / attackEntity / onPlayerRightClick (tools), so `invBroke` tells it the item to draw. A worn piece breaks only on the server.
  broke(p, id) {
    const sim = this.sim, pitch = f(f(0.8) + f(sim.soundRand.nextFloat() * f(0.4)));
    sim.soundsOut.push({ name: 'random.break', x: p.position.x, y: p.position.y, z: p.position.z, volume: f(0.8), pitch, except: p.id });
    if (ITEMS[id]?.armor === undefined) this.out(p, { type: 'invBroke', item: id, pitch });
  }
}
