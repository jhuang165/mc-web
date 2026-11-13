// Batch 59 (mpcontainers): chests, furnaces, dispensers/droppers, hoppers, brewing stands and ender chests as server windows.
// The wire is JSON named after the 1.7.10 packets: openWindow (S2D), windowItems (S30), setSlot (S2F), confirmTransaction (S32), windowProperty (S31),
// windowClose (S2E) and blockActions (S24 lid counts) go out; clickWindow (C0E), confirmTransaction (C0F), windowInventory and closeWindow (C0D) come in.
// The server runs the authoritative Container.click (the singleplayer port's slotClick) over the player's server inventory (`p.survival.inventory`).
// The server only mirrors the client's hotbar (counts are not sent), so on open the client reports its 36 slots (`windowInventory`), and while a
// window is open the hotbar mirror in DedicatedSimulation.input is ignored. Wire shapes and rules: recalled from NetHandlerPlayServer.processClickWindow.
import { ITEMS } from '../survival.js';
import { makeStack, copyStack, OUTSIDE } from '../inventory.js';
import { isChestBlock, ENDER_CHEST } from '../chest-blocks.js';
import { DISPENSER, DROPPER } from '../dispenser-piston.js';
import { DispenserContainer, DISPENSER_TITLE, DROPPER_TITLE, newDispenser } from '../dispenser-container.js';
import { HOPPER, HopperContainer, newHopperTile } from '../hopper.js';
import { BREWING_STAND, brewingView, newBrewingTile } from '../brewing.js';
import { BrewingContainer } from '../brewing-container.js';
import { ServerStations, STATION_BLOCKS } from './server-stations.js'; // b60: crafting table, enchanting table, anvil
import { smeltExperience } from '../experience.js';
import { settleFacing } from '../chest.js';
import { newEnderTile } from '../chest-blocks.js';

export const FURNACE = 14;
const EXTRAS = ['enchantments', 'storedEnchantments', 'stored', 'displayName', 'repairCost', 'unbreakable', 'lore', 'color'];
const REACH_SQ = 64, PENDING_TICKS = 100;
// A stack from the wire: id, count and damage are checked, the tag fields are kept from a short whitelist.
export function cleanStack(s) {
  if (s === null || s === undefined) return null;
  if (!s || typeof s !== 'object' || !Number.isInteger(s.id) || !ITEMS[s.id] || !Number.isInteger(s.count) || s.count < 1 || s.count > 64) return undefined;
  const damage = s.damage ?? 0;
  if (!Number.isInteger(damage) || damage < 0 || damage > 32767) return undefined;
  const extra = {};
  for (const k of EXTRAS) if (s[k] !== undefined) extra[k] = s[k];
  if (JSON.stringify(extra).length > 1500) return undefined;
  return makeStack(s.id, s.count, damage, undefined, extra);
}
export const wireStack = s => (s ? JSON.parse(JSON.stringify(s)) : null);
const same = (a, b) => (!a && !b) || (!!a && !!b && a.id === b.id && a.count === b.count && (a.damage ?? 0) === (b.damage ?? 0));
const sig = s => (s ? JSON.stringify(s) : '');

export class ServerContainers {
  constructor(sim) { this.sim = sim; this.nextWindow = 0; this.lids = new Map(); this.actions = []; this.litFurnaces = new Set(); this.litSent = false; this.ticks = null; this.onFurnaceTake = (pl, stack) => sim.achievements?.onSmelted(pl, stack); /* b60 lead: SlotFurnace.onCrafting awards (server-achievements.js) */ this.stations = new ServerStations(sim); }
  // b60: SlotFurnace.onCrafting for a stack taken from a furnace output slot: the crafted-item hook (`onFurnaceTake(p, stack, amount)`, for the smelting
  // achievement; this module does not award it) and the experience, rounded up by chance, spawned at the player (posY + 0.5, posZ + 0.5).
  smelted(p, stack, amount) {
    this.onFurnaceTake?.(p, stack, amount);
    if (p.survival.creative) return;
    const f = smeltExperience(stack); let n = amount;
    if (f === 0) n = 0;
    else if (f < 1) { const raw = Math.fround(amount * f); n = Math.floor(raw); if (n < Math.ceil(raw) && Math.random() < raw - n) n++; }
    this.sim.serverItems.xp.spawn(n, { x: p.position.x, y: p.position.y + 0.5, z: p.position.z + 0.5 });
  }
  get tiles() { return this.sim.tiles; }
  // Called from DedicatedSimulation.edit for a right click on `block` (activates: not sneaking with an item in hand). True when the click was handled.
  use(p, x, y, z, block, activates) {
    if (!activates) return false;
    const key = `${x},${y},${z}`, s = p.survival, w = this.sim.world;
    let container, kind, title, extra = {}, stationProps = null;
    if (block === FURNACE) { container = s.openFurnace(key, (st, n) => this.smelted(p, st, n)); kind = 'furnace'; title = 'Furnace'; }
    else if (block === ENDER_CHEST) { container = s.openEnderChest(w, x, y, z); kind = 'chest'; title = 'Ender Chest'; extra = { ender: true }; if (!container) return true; }
    else if (isChestBlock(block)) { container = s.openChest(w, x, y, z); kind = 'chest'; if (!container) return true; title = container.title; }
    else if (block === DISPENSER || block === DROPPER) {
      const tile = (s.dispensers[key] ??= newDispenser());
      container = new DispenserContainer(s.inventory, tile, null); kind = 'dispenser'; title = block === DROPPER ? DROPPER_TITLE : DISPENSER_TITLE;
    } else if (block === HOPPER) {
      const tile = (s.hoppers[key] ??= newHopperTile());
      container = new HopperContainer(s.inventory, tile, null); kind = 'hopper'; title = container.title;
    } else if (block === BREWING_STAND) {
      const tile = (s.brewing[key] ??= newBrewingTile());
      container = new BrewingContainer(s.inventory, brewingView(tile), null); kind = 'brewing'; title = container.title;
    } else if (STATION_BLOCKS.has(block)) {
      const st = this.stations.open(p, block, x, y, z); // b60 (server-stations.js)
      ({ container, kind, title } = st); stationProps = st.props;
    } else return false;
    this.sim.serverItems.inv.close(p); // b60: the inventory window's grid and cursor are thrown first
    this.close(p);
    s.inventory.cursor = null;
    const id = (this.nextWindow % 100) + 1; this.nextWindow++;
    p.window = { id, kind, container, key: [x, y, z], block, last: [], cursor: '', props: [], pending: 0, ready: false, stationProps };
    container.title = title;
    this.syncLids();
    this.out(p, { type: 'openWindow', windowId: id, kind, title, x, y, z, size: container.slots.length, rows: container.rows, ...(kind === 'chest' ? { keys: container.keys } : {}), ...extra });
    return true;
  }
  out(p, m) { (p.windowOut ??= []).push(m); }
  slotsOf(win) { return win.container.slots.map(s => wireStack(s.stack)); }
  sendAll(p) {
    const win = p.window, slots = this.slotsOf(win), inv = p.survival.inventory;
    win.last = slots.map(sig); win.cursor = sig(inv.cursor);
    this.out(p, { type: 'windowItems', windowId: win.id, slots, cursor: wireStack(inv.cursor) });
  }
  // The client's 36 slots after it opened the window (the server only knows the hotbar, without counts).
  inventory(p, m) {
    const win = p.window;
    if (!win || m?.windowId !== win.id || win.ready || !Array.isArray(m.slots) || m.slots.length !== 36) return false;
    const stacks = m.slots.map(cleanStack);
    if (stacks.some(s => s === undefined)) return false;
    for (let i = 0; i < 36; i++) p.survival.inventory.main[i] = stacks[i];
    win.ready = true;
    this.sendAll(p); this.sendProps(p, true);
    return true;
  }
  // C0E: run the click here; equal to what the client predicted -> S32 accepted and the changed slots, else S32 refused and the whole window.
  click(p, m) {
    const win = p.window;
    if (!win || !win.ready || m?.windowId !== win.id || win.pending) return false;
    const c = win.container;
    if (![m.slot, m.button, m.mode, m.action].every(Number.isInteger) || m.slot < OUTSIDE || m.slot >= c.slots.length || m.slot < 0 && m.slot !== OUTSIDE && m.slot !== -1
      || m.mode < 0 || m.mode > 6 || m.button < 0 || m.button > 1023) return false;
    const claimed = cleanStack(m.item);
    if (claimed === undefined) return false;
    const result = c.click(m.slot, m.button, m.mode);
    this.drain(p);
    this.ticks?.changed(c.keys ?? [win.key.join(',')]); // World.func_147453_f: comparators read the new contents
    if (same(claimed, result ? copyStack(result) : null)) {
      this.out(p, { type: 'confirmTransaction', windowId: win.id, action: m.action, accepted: true });
      this.changes(p); this.sendProps(p, false); // b60: a station's costs change with the click (detectAndSendChanges sends S31 with the slots)
    } else {
      win.pending = this.sim.ticks + PENDING_TICKS;
      this.out(p, { type: 'confirmTransaction', windowId: win.id, action: m.action, accepted: false });
      this.sendAll(p);
    }
    return true;
  }
  confirm(p, m) { if (p.window && m?.windowId === p.window.id && m.accepted !== false) p.window.pending = 0; }
  drain(p) {
    const c = p.window.container;
    for (const s of c.drops.splice(0)) this.sim.items.dropPlayer(copyStack(s), p.position, p.yaw, p.pitch);
  }
  // detectAndSendChanges: slots and the held stack that differ from what the client was last told.
  changes(p) {
    const win = p.window, slots = this.slotsOf(win), inv = p.survival.inventory;
    slots.forEach((s, i) => { const g = sig(s); if (g !== win.last[i]) { win.last[i] = g; this.out(p, { type: 'setSlot', windowId: win.id, slot: i, item: s }); } });
    const cur = sig(inv.cursor);
    if (cur !== win.cursor) { win.cursor = cur; this.out(p, { type: 'setSlot', windowId: win.id, slot: -1, item: wireStack(inv.cursor) }); }
  }
  // S31: furnace cook time / burn time / item burn time (0, 1, 2), brewing stand brew time (0).
  props(win, s) {
    if (win.kind === 'furnace') { const f = s.furnace(win.key.join(',')); return [f.cook | 0, f.burn | 0, f.burnTotal | 0]; }
    if (win.kind === 'brewing') return [s.brewing[win.key.join(',')]?.brewTime | 0];
    if (win.stationProps) return win.stationProps(); // enchanting costs (S31 0..2), anvil maximumCost (S31 0)
    return [];
  }
  sendProps(p, all) {
    const win = p.window, now = this.props(win, p.survival);
    now.forEach((v, i) => { if (all || win.props[i] !== v) this.out(p, { type: 'windowProperty', windowId: win.id, id: i, value: v }); });
    win.props = now;
  }
  // After the server changed the open window itself (C11, MC|ItemName): the dropped stacks, then the changed slots and properties.
  afterServerChange(p) { if (!p.window?.ready) return; this.drain(p); this.changes(p); this.sendProps(p, false); }
  canInteract(p) {
    const win = p.window, [x, y, z] = win.key, b = this.sim.world.get(x, y, z), ok = win.kind === 'chest' ? (win.container.keys ?? []).every(k => {
      const [a, c, d] = k.split(',').map(Number), bb = this.sim.world.get(a, c, d); return isChestBlock(bb) || bb === ENDER_CHEST;
    }) : b === win.block;
    return ok && (p.position.x - x - .5) ** 2 + (p.position.y - y - .5) ** 2 + (p.position.z - z - .5) ** 2 <= REACH_SQ;
  }
  // C0D (or the server closing): the held stack is thrown, the lid users drop.
  close(p, notify = false) {
    const win = p.window;
    if (!win) return;
    p.window = null;
    win.container.close();
    this.ticks?.changed(win.container.keys ?? [win.key.join(',')]);
    this.syncLids();
    for (const s of win.container.drops.splice(0)) this.sim.items.dropPlayer(copyStack(s), p.position, p.yaw, p.pitch);
    if (notify) this.out(p, { type: 'windowClose', windowId: win.id });
  }
  // Once per tick: window validity and changes, smelting and brewing, lid counts.
  tick() {
    const sim = this.sim;
    this.tiles.tickFurnaces();
    this.lightFurnaces();
    for (const [key, data] of Object.entries(this.tiles.brewing)) {
      const [x, y, z] = key.split(',').map(Number);
      if (sim.world.get(x, y, z) !== BREWING_STAND) continue;
      const view = brewingView(data), bits = view.tick();
      if (bits !== null || sim.world.getMeta(x, y, z) !== view.bottleBits()) sim.world.put(x, y, z, BREWING_STAND, view.bottleBits(), true);
    }
    for (const p of sim.players.values()) {
      if (!p.window) continue;
      if (!this.canInteract(p)) { this.close(p, true); continue; }
      if (p.window.pending && sim.ticks > p.window.pending) p.window.pending = 0;
      if (!p.window.ready) continue;
      this.changes(p); this.sendProps(p, false);
    }
    this.syncLids();
  }
  syncLids() {
    for (const [key, c] of Object.entries(this.tiles.chests)) this.lid(key, c.users | 0, 'c', c.facing);
    for (const [key, t] of Object.entries(this.tiles.enderTiles)) this.lid(key, t.users | 0, 'e', 0);
  }
  // b60: BlockFurnace.func_149931_a swaps block 61 and 62 (and its light 13) when TileEntityFurnace's burn state flips. The port keeps one block id and a
  // lit set: a flip rewrites the cell (the tick's change list relights it and sends the cell) and `contFurnaceLit` tells clients which furnaces burn.
  lightFurnaces() {
    const sim = this.sim, now = new Set();
    for (const [key, f] of Object.entries(this.tiles.furnaces)) { const [x, y, z] = key.split(',').map(Number); if (f.burn > 0 && sim.world.get(x, y, z) === FURNACE) now.add(key); }
    for (const key of new Set([...now, ...this.litFurnaces])) if (now.has(key) !== this.litFurnaces.has(key)) {
      const [x, y, z] = key.split(',').map(Number);
      sim.changes.set(key, [x, y, z, sim.world.get(x, y, z), sim.world.getMeta(x, y, z)]);
    }
    this.litFurnaces = now;
  }
  // The lit furnaces ride in every tick while any burn (and once empty after the last), like `items`.
  furnaceField() {
    if (!this.litFurnaces.size && !this.litSent) return {};
    this.litSent = this.litFurnaces.size > 0;
    return { contFurnaceLit: [...this.litFurnaces] };
  }
  lid(key, users, kind, facing) {
    const k = kind + key, old = this.lids.get(k) ?? 0;
    if (users === old) return;
    this.lids.set(k, users);
    if (kind === 'c') this.ticks?.viewersChanged(key); // trapped chest: neighbours and the block beneath hear the new power
    this.actions.push({ key, ender: kind === 'e', users: Math.max(0, users), facing }); // S24 block action 1: the number of viewers
  }
  actionsField() { const a = this.actions.splice(0); return { ...(a.length ? { blockActions: a } : {}), ...this.furnaceField() }; }
  // A container block that is gone: its contents leave as items and any window on it closes (BlockContainer.breakBlock).
  reap(x, y, z, block) {
    this.ensureChest(x, y, z, block);
    const key = `${x},${y},${z}`, t = this.tiles, spill = items => this.sim.items.spill(items.filter(Boolean).map(copyStack), x, y, z);
    const gone = (store, ok) => { const e = store[key]; if (e && !ok) { delete store[key]; spill(e.items); this.closeAt(key); } };
    gone(t.chests, isChestBlock(block)); gone(t.furnaces, block === FURNACE); gone(t.dispensers, block === DISPENSER || block === DROPPER);
    gone(t.hoppers, block === HOPPER); gone(t.brewing, block === BREWING_STAND);
    if (t.enderTiles[key] && block !== ENDER_CHEST) { delete t.enderTiles[key]; this.closeAt(key); }
  }
  // b60: a chest block with no tile record (a saved world's, or placed by a command) gets the facing onBlockAdded settles; the cell and its chest neighbours
  // are described to the clients (`contChest`, tile-sync.js) so a never-opened chest is drawn with its closed lid.
  ensureChest(x, y, z, block) {
    const key = `${x},${y},${z}`, t = this.tiles;
    if (block === ENDER_CHEST) { if (!t.enderTiles[key]) t.enderTiles[key] = newEnderTile(); }
    else if (isChestBlock(block)) { if (!t.chests[key]) settleFacing(this.sim.world, t.chests, x, y, z); }
    else return;
    this.sim.tileChanged(x, y, z);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (this.sim.world.get(x + dx, y, z + dz) === block) this.sim.tileChanged(x + dx, y, z + dz);
  }
  // Saved chest blocks without a record (edits are `block | meta << 8`).
  adopt() { for (const [key, v] of this.sim.world.edits) { const b = v & 255; if (b === ENDER_CHEST || isChestBlock(b)) this.ensureChest(...key.split(',').map(Number), b); } }
  // Every chest and ender chest of the world as `contChest` descriptions, for the join snapshot.
  describeAll() {
    const w = this.sim.world, t = this.tiles, list = [];
    for (const key of Object.keys(t.chests)) { const [x, y, z] = key.split(',').map(Number); if (isChestBlock(w.get(x, y, z))) list.push({ kind: 'contChest', x, y, z, facing: t.chests[key].facing }); }
    for (const key of Object.keys(t.enderTiles)) { const [x, y, z] = key.split(',').map(Number); if (w.get(x, y, z) === ENDER_CHEST) list.push({ kind: 'contChest', x, y, z, ender: true }); }
    return list;
  }
  closeAt(key) { for (const p of this.sim.players.values()) if (p.window && (p.window.key.join(',') === key || p.window.container.keys?.includes(key))) this.close(p, true); }
}
