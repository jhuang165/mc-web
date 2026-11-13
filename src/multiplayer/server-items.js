import { ITEMS } from '../survival.js';
import { PlayerInventory, copyStack, makeStack, sameStackItem } from '../inventory.js';
import { ExperienceOrbs, Experience } from '../experience.js';
import { PHYSICS } from '../world.js';

// Items, experience and inventory authority of a Survival dedicated server (batch 59).
//
// Inventory: 1.7.10's server owns the inventory and corrects the client with S2F set slot. Here the client still arranges its inventory (container clicks are not
// connected yet) and sends its 36 main slots with each input (`hotbar` always, `rest` when it changed); the server adopts them. What the server itself changes
// (a placed block spends the stack, a break wears the tool, a /give) is sent back as `slot` corrections numbered by `seq`. The client answers with `ack`, the last
// seq it applied; the server ignores the client's copy of a slot it corrected after that seq, so a slow input cannot undo the correction.
const f = Math.fround;
const MAIN = 36, AUX_RANGE_SQ = 64 * 64, SOUND_RANGE = 16;
const reader = new PlayerInventory(ITEMS);

export const sameSlot = (a, b) => (!a && !b) || (!!a && !!b && a.count === b.count && sameStackItem(a, b));

// Client side: the fields an input message carries. `state` is a plain object kept by the caller ({ ack, lastRest, sentAt }).
export function inventoryFields(inventory, state, tick = 0) {
  const wire = s => (s ? copyStack(s) : null), out = { hotbar: inventory.main.slice(0, 9).map(wire), ack: state.ack ?? 0 };
  const rest = JSON.stringify(inventory.main.slice(9, MAIN).map(wire));
  if (rest !== state.lastRest || tick - (state.sentAt ?? -1e9) >= 200) { out.rest = JSON.parse(rest); state.lastRest = rest; state.sentAt = tick; }
  return out;
}
// Client side: apply an S2F-like `slot` message; returns the seq to acknowledge.
export function applySlots(inventory, message, state) {
  for (const { slot, stack } of message.slots ?? []) if (Number.isInteger(slot) && slot >= 0 && slot < MAIN) inventory.main[slot] = stack ? reader.read(stack) : null;
  if (Number.isInteger(message.seq)) state.ack = Math.max(state.ack ?? 0, message.seq);
  return state.ack;
}
// Client side: how many of `stack` the inventory would take (InventoryPlayer.addItemStackToInventory on a copy), for a partial pickup.
export function pickupFit(inventory, stack) {
  const probe = new PlayerInventory(inventory.items, inventory.main), left = copyStack(stack);
  probe.add(left);
  return stack.count - left.count;
}

export class ServerItems {
  constructor(sim, saved = {}) {
    this.sim = sim;
    this.survival = sim.gameMode === 'survival';
    this.xp = new ExperienceOrbs(saved.xpOrbs);
    this.taken = []; // S0D collect item of this tick: { i, by }
    this.orbsSent = 0;
    sim.items.load(saved.items, s => reader.read(s), 0);
  }
  save() { return { items: this.sim.items.serialize(), xpOrbs: this.xp.serialize() }; }

  // ---- world-system drops (leaf decay, plants, rails, torches, doors, beds, falling blocks) ----
  // A Survival world drops them as entities; a Creative one keeps the earlier no-op (its players cannot pick items up through a packet).
  get stacksDrop() { return this.survival ? (stacks, x, y, z) => this.sim.items.dropBlock(stacks.map(d => makeStack(d.id, d.count, d.damage || 0)), x, y, z) : () => {}; }
  get fallingDrop() { return this.survival ? (stack, x, posY, z) => this.sim.items.spawn(makeStack(stack.id, stack.count, stack.damage || 0), x, posY, z, { delay: 10 }) : () => {}; }

  // ---- inventory authority ----
  join(p, saved) {
    p.experience = new Experience(saved?.experience);
    p.xpCooldown = 0; p.seq = 0; p.slotSeq = Array(MAIN).fill(0); p.slotsOut = [];
    p.seen = p.survival.inventory.main.map(s => (s ? copyStack(s) : null));
  }
  savedFields(p) { return { experience: p.experience.serialize() }; }
  // The client's slot list -> stacks (full tags through the inventory reader). null: malformed.
  parse(list, size, kept) {
    if (!Array.isArray(list) || list.length !== size) return null;
    const out = [];
    for (let i = 0; i < size; i++) {
      const s = list[i];
      if (s === null) { out.push(null); continue; }
      if (!s || typeof s !== 'object' || !Number.isInteger(s.id) || !ITEMS[s.id] || !Number.isInteger(s.damage ?? 0) || (s.damage ?? 0) < 0 || (s.damage ?? 0) > 32767) return null;
      // No count (an older client): the server's own count of the same item, else a full stack.
      const k = kept[i], count = Number.isInteger(s.count) ? s.count : k && k.id === s.id && (k.damage ?? 0) === (s.damage ?? 0) ? k.count : 64;
      out.push(reader.read({ ...s, count }));
    }
    return out;
  }
  // `input`: false when the hotbar is malformed. Slots the server corrected after the client's ack keep the server's value.
  adopt(p, message) {
    const inv = p.survival.inventory, main = inv.main;
    const hot = this.parse(message.hotbar, 9, main.slice(0, 9));
    if (!hot) return false;
    let rest = null;
    if (message.rest !== undefined) { rest = this.parse(message.rest, MAIN - 9, main.slice(9)); if (!rest) return false; }
    const ack = Number.isInteger(message.ack) ? message.ack : 0, all = rest ? [...hot, ...rest] : hot;
    all.forEach((s, i) => { if (p.slotSeq[i] > ack) return; main[i] = s; p.seen[i] = s ? copyStack(s) : null; });
    return true;
  }
  // End of a tick: every slot the server changed since the client last saw it becomes a correction.
  settle(p) {
    const main = p.survival.inventory.main, changed = [];
    for (let i = 0; i < MAIN; i++) if (!sameSlot(main[i], p.seen[i])) { p.seen[i] = main[i] ? copyStack(main[i]) : null; p.slotSeq[i] = p.seq + 1; changed.push({ slot: i, stack: main[i] ? copyStack(main[i]) : null }); }
    p.survival.broken = 0;
    if (changed.length) (p.itemsOut ??= []).push({ type: 'slot', seq: ++p.seq, slots: changed });
  }

  // ---- break effects ----
  // ItemInWorldManager.tryHarvestBlock plays World.playAuxSFXAtEntity(breaker, 2001, x, y, z, id + (meta << 12)): S28 to every player but the breaker under 64 blocks.
  afterBreak(p, cell, run) {
    const block = this.sim.world.get(...cell), meta = this.sim.world.getMeta(...cell), done = run();
    if (done && block) for (const o of this.sim.players.values()) {
      if (o === p) continue;
      const dx = cell[0] - o.position.x, dy = cell[1] - o.position.y, dz = cell[2] - o.position.z;
      if (dx * dx + dy * dy + dz * dz < AUX_RANGE_SQ) (o.itemsOut ??= []).push({ type: 'aux', events: [{ id: 2001, x: cell[0], y: cell[1], z: cell[2], data: block + (meta << 12) }] });
    }
    return done;
  }

  // ---- pickup ----
  // `fits[i]`: how many of item eids[i] the client's inventory takes (EntityItem.onCollideWithPlayer keeps the rest on the ground). Without it the whole stack goes.
  pickup(p, eids, fits) {
    const sim = this.sim;
    if (!p || p.survival.creative || !Array.isArray(eids) || eids.length > 16) return false;
    const room = new Map(), byStack = new Map();
    for (const e of sim.items.items) { const at = eids.indexOf(e.eid); if (at >= 0) { byStack.set(e.stack, e); room.set(e.eid, Number.isInteger(fits?.[at]) ? fits[at] : Infinity); } }
    if (!byStack.size) return false;
    sim.items.collect(p.position, PHYSICS.width, PHYSICS.height, stack => {
      const e = byStack.get(stack), n = e ? Math.min(stack.count, room.get(e.eid)) : 0;
      if (!(n > 0)) return false;
      (p.collectedOut ??= []).push(copyStack({ ...stack, count: n }));
      (sim.events ??= []).push({ type: 'pickup', id: p.id, item: stack.id }); // the achievement triggers (server-broadcast.js pickedAchievement)
      sim.achievements.diamondsToYou(p, stack, e); // xk.b_: a diamond thrown by another online player awards the thrower (b60)
      stack.count -= n;
      if (stack.count <= 0) this.taken.push({ i: e.eid, by: p.id });
      // EntityItem.onCollideWithPlayer: random.pop 0.2, pitch ((r - r) * 0.7 + 1) * 2, for everyone in range (the collector's client plays its own).
      sim.soundsOut.push({ name: 'random.pop', x: p.position.x, y: p.position.y, z: p.position.z, volume: f(0.2), pitch: f(f(f(f(sim.soundRand.nextFloat() - sim.soundRand.nextFloat()) * f(0.7)) + 1) * 2), except: p.id });
      return true;
    });
    return true;
  }

  // ---- experience orbs ----
  tickOrbs() {
    const sim = this.sim, players = [...sim.players.values()];
    for (const o of this.xp.orbs) {
      let near = null, best = Infinity;
      for (const p of players) { const d = (o.x - p.position.x) ** 2 + (o.posY - p.position.y) ** 2 + (o.z - p.position.z) ** 2; if (d < best) { best = d; near = p.position; } }
      this.xp.tickOne(sim.world, o, near);
    }
    this.xp.reap();
    for (const p of players) {
      this.xp.cooldown = p.xpCooldown;
      const v = this.xp.collect(p.position, PHYSICS.width, PHYSICS.height);
      p.xpCooldown = this.xp.cooldown;
      if (v > 0) { p.experience.add(v); (p.itemsOut ??= []).push({ type: 'playerOp', op: 'addExperience', args: [v] }); }
    }
    for (const s of this.xp.sounds.splice(0)) if (s.name === 'random.orb') sim.soundsOut.push({ ...s, except: null });
    sim.items.sounds.length = 0;
  }
  // `xp` rides in a tick while orbs exist, once more (empty) after; `taken` while a pickup happened this tick.
  tickFields() {
    const out = {}, orbs = this.xp.orbs;
    if (orbs.length || this.orbsSent) { this.orbsSent = orbs.length; out.xp = orbs.map(o => ({ i: o.id, x: o.x, y: o.y, z: o.z, v: o.value, c: o.color })); }
    if (this.taken.length) out.taken = this.taken.splice(0);
    return out;
  }
}
