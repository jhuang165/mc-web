// Batch 59 (mpcontainers): the client half of the container windows (see server-containers.js for the wire). The singleplayer container classes and
// slotClick run locally as the prediction; each top-level click goes to the server as C0E with the stack the local click returned, and the server's
// S30 / S2F / S32 / S31 bring the authoritative contents back.
import { makeStack, ChestContainer, StackArray } from '../inventory.js';
import { DispenserContainer, newDispenser } from '../dispenser-container.js';
import { HopperContainer, newHopperTile } from '../hopper.js';
import { BrewingContainer } from '../brewing-container.js';
import { brewingView, newBrewingTile } from '../brewing.js';
import { newChest } from '../chest.js';
import { newEnderTile } from '../chest-blocks.js';
import { AnvilContainer } from '../anvil-container.js';
import { EnchantingContainer } from '../enchanting-container.js';

const same = (a, b) => (!a && !b) || (!!a && !!b && a.id === b.id && a.count === b.count && (a.damage ?? 0) === (b.damage ?? 0));
const fromWire = s => (s ? makeStack(s.id, s.count, s.damage ?? 0, undefined, s) : null);
// The 36 inventory slots as the server wants them (tag fields dropped if the message would pass the 8 KiB frame limit).
export function inventoryWire(inv) {
  const full = inv.main.map(s => (s ? JSON.parse(JSON.stringify(s)) : null));
  if (JSON.stringify(full).length < 6000) return full;
  return inv.main.map(s => (s ? { id: s.id, count: s.count, damage: s.damage ?? 0 } : null));
}
// The local container for an S2D message, or null when this client cannot build it.
// `crafted(stack, count)`: the client's own statistics (StatList.objectCraftStats; the server keeps no statistics) for a crafting or furnace output take (b61).
export function buildWindow(m, { survival, world, station = {}, crafted = null }) {
  const key = `${m.x},${m.y},${m.z}`, inv = survival.inventory;
  let container, kind = m.kind;
  if (m.cart) { // b62: a chest or hopper minecart's window; the stacks come from the server (S30), the slots here start blank
    const n = kind === 'hopper' ? 5 : 27;
    container = kind === 'hopper' ? new HopperContainer(inv, { items: Array(n).fill(null), name: m.title }, null) : new ChestContainer(inv, new StackArray(Array(n).fill(null), null));
  } else if (kind === 'chest') container = m.ender ? survival.openEnderChest(world, m.x, m.y, m.z) : survival.openChest(world, m.x, m.y, m.z);
  else if (kind === 'furnace') container = survival.openFurnace(key, () => {});
  else if (kind === 'dispenser') container = new DispenserContainer(inv, (survival.dispensers[key] ??= newDispenser()), null);
  else if (kind === 'hopper') container = new HopperContainer(inv, (survival.hoppers[key] ??= newHopperTile()), null);
  else if (kind === 'brewing') container = new BrewingContainer(inv, brewingView((survival.brewing[key] ??= newBrewingTile())), null);
  else if (kind === 'workbench') container = survival.openWorkbench();
  else if (kind === 'enchanting' || kind === 'anvil') container = buildStation(kind, m, { survival, world, station });
  if (!container || container.slots.length !== m.size) return null;
  container.title = m.title;
  if (crafted && kind === 'workbench') container.onCraft = crafted;
  if (crafted && kind === 'furnace') container.slots[2].onSmelt = crafted; // SlotFurnace.onCrafting
  return { container, kind, key };
}
// Makes the container's clicks go to the server; nested clicks (shift-click repeats) and local drops stay local.
export function wireClicks(container, client, windowId) {
  const click = container.click.bind(container);
  let depth = 0, action = 0;
  container.click = (slot, button, mode) => {
    depth++; container.clicking = true;
    let result;
    try { result = click(slot, button, mode); } finally { depth--; }
    if (depth === 0) { container.clicking = false; container.drops.length = 0; client.clickWindow(windowId, slot, button, mode, ++action, result ? JSON.parse(JSON.stringify(result)) : null); container.afterClick?.(); }
    return result;
  };
}
// S30 / S2F / S31 / S32 for the open window: tile slots take the server's stacks, player slots keep the client's own stack when it is equal (tags survive).
export function applyWindow(m, { container, windowId, survival, key, client, kind }) {
  if (m.windowId !== windowId) return false;
  const inv = survival.inventory, put = (i, s) => {
    const slot = container.slots[i];
    if (!slot) return;
    const mine = slot.inventory === inv, here = slot.stack;
    if (mine && same(here, s)) return;
    slot.inventory.setStack(slot.index, fromWire(s));
  };
  if (m.type === 'windowItems') { m.slots.forEach((s, i) => put(i, s)); if (!same(inv.cursor, m.cursor)) inv.cursor = fromWire(m.cursor); }
  else if (m.type === 'setSlot') { if (m.slot === -1) { if (!same(inv.cursor, m.item)) inv.cursor = fromWire(m.item); } else put(m.slot, m.item); }
  else if (m.type === 'confirmTransaction') { if (!m.accepted) client.confirmTransaction(windowId, m.action, true); }
  else if (m.type === 'windowProperty') {
    if (kind === 'enchanting' && m.id >= 0 && m.id <= 2) container.table.enchantLevels[m.id] = m.value; // ContainerEnchantment.updateProgressBar
    else if (kind === 'anvil' && m.id === 0) container.maximumCost = m.value; // ContainerRepair.updateProgressBar
    else if (container.stand && m.id === 0) container.stand.brewTime = m.value;
    else if (container.furnace) { const f = survival.furnace(key); if (m.id === 0) f.cook = m.value; else if (m.id === 1) f.burn = m.value; else if (m.id === 2) f.burnTotal = m.value; }
  }
  if (m.type === 'windowItems' || m.type === 'setSlot') refreshStation(container, kind);
  return true;
}
// S24 lid counts: the client's chest records drive the lid animation.
export function applyBlockActions(list, survival) {
  for (const a of list ?? []) {
    if (typeof a?.key !== 'string' || !Number.isInteger(a.users)) continue;
    const rec = a.ender ? (survival.enderTiles[a.key] ??= newEnderTile()) : (survival.chests[a.key] ??= newChest(a.facing ?? 3));
    rec.users = a.users;
  }
}

// b60 (server-stations.js): the enchanting table and the anvil. The XP cost is paid by the server (its `playerOp addLevels` follows), so the local
// container pays nothing; the enchanting table is `remote` (the three costs arrive as S31 0..2). `station` = { experienceLevel, itemName, nameField(name) }
// from main.js: the level read, the item name lookup and the anvil's text field.
function buildStation(kind, m, { survival, world, station }) {
  const common = { inventory: survival.inventory, creative: () => survival.creative, experienceLevel: station.experienceLevel ?? (() => 0), payExperienceLevels: () => {} };
  if (kind === 'enchanting') return new EnchantingContainer({ ...common, world, x: m.x, y: m.y, z: m.z, remote: true });
  let container;
  const itemName = station.itemName ?? (() => '');
  container = new AnvilContainer({ ...common, itemName,
    onInputChanged: ({ current, currentNative }) => { // GuiRepair.updateSlot: the field shows the stack's name and renameItem sends it
      const name = current ? (current.displayName ?? itemName(currentNative)) : '';
      station.nameField?.(name);
      container?.setName(current && typeof current.displayName === 'string' ? name : '');
    } });
  return container;
}
// Station clicks that are not slot clicks: C11 for an enchanting option, MC|ItemName whenever the anvil name changes. Slot results the server
// sends are recomputed locally (the anvil output and the enchant costs are derived, not stored).
export function wireStation(container, client, windowId, kind) {
  if (kind === 'enchanting') {
    container.enchant = slot => { if (!container.canEnchant(slot)) return false; client.stationEnchant(windowId, slot); return false; };
  } else if (kind === 'anvil') {
    const setName = container.setName.bind(container);
    const send = () => client.stationItemName(windowId, container.repairedItemName ?? '');
    // A rename caused by the local click itself (the input slot emptied) goes after that click's C0E, as GuiRepair sends it on the later S2F.
    container.setName = name => { setName(name); if (container.clicking) container.nameDirty = true; else send(); };
    container.afterClick = () => { if (container.nameDirty) { container.nameDirty = false; send(); } };
  }
}
export function refreshStation(container, kind) {
  if (!kind) return;
  if (kind === 'anvil') container.inputsChanged();
  else if (kind === 'enchanting') container.markDirty();
  else if (kind === 'workbench') container.updateResult();
}
// b60: the lit furnaces of a server tick (`contFurnaceLit`) as the data scene.setFurnaces reads (the block swap 61 / 62 and its light 13).
export const litFurnaceData = keys => Object.fromEntries((Array.isArray(keys) ? keys : []).filter(k => typeof k === 'string').map(k => [k, { lit: true }]));
// b60: S28 for a dispenser or dropper (RenderGlobal.playAuxSFX, bytecode-read): 1000 click, 1001 click at pitch 1.2, 1002 bow at pitch 1.2, all at volume 1
// and the block's corner (x, y, z as ints, no +0.5); 2000 ten smoke puffs on the face the data names (data = dx + 1 + (dz + 1) * 3).
// `play(name, x, y, z, volume, pitch)`, `smoke(x, y, z, vx, vy, vz)`; `random()` is the client world's Random (unseeded natively).
// b63: 1013 is the wither's spawn (a broadcast S28): RenderGlobal.playAuxSFX plays mob.wither.spawn at volume 1 two blocks from the listener towards the origin (the sound is heard
// everywhere), as wither-boss-mobs.js levelEvent does in single player. `listener()` is the eye { x, y, z }.
export function witherSpawnAt(listener, x, y, z) {
  const dx = x - listener.x, dy = y - listener.y, dz = z - listener.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return d > 0 ? { x: listener.x + dx / d * 2, y: listener.y + dy / d * 2, z: listener.z + dz / d * 2 } : { x: listener.x, y: listener.y, z: listener.z };
}
export function dispenserAux(e, { play, smoke, random = Math.random, listener = null }) {
  if (![e?.id, e?.x, e?.y, e?.z, e?.data].every(Number.isInteger)) return false;
  if (e.id === 1000) play('random.click', e.x, e.y, e.z, 1, 1);
  else if (e.id === 1001) play('random.click', e.x, e.y, e.z, 1, 1.2);
  else if (e.id === 1002) play('random.bow', e.x, e.y, e.z, 1, 1.2);
  else if (e.id === 1013) { if (!listener) return false; const at = witherSpawnAt(listener(), e.x, e.y, e.z); play('mob.wither.spawn', at.x, at.y, at.z, 1, 1); }
  else if (e.id === 2000) {
    const gauss = () => { let a, b, s; do { a = 2 * random() - 1; b = 2 * random() - 1; s = a * a + b * b; } while (s >= 1 || s === 0); return a * Math.sqrt(-2 * Math.log(s) / s); };
    const i = e.data % 3 - 1, k = Math.trunc(e.data / 3) % 3 - 1, cx = e.x + i * 0.6 + 0.5, cy = e.y + 0.5, cz = e.z + k * 0.6 + 0.5;
    for (let n = 0; n < 10; n++) {
      const d = random() * 0.2 + 0.01;
      const px = cx + i * 0.01 + (random() - 0.5) * k * 0.5, py = cy + (random() - 0.5) * 0.5, pz = cz + k * 0.01 + (random() - 0.5) * i * 0.5;
      smoke(px, py, pz, i * d + gauss() * 0.01, -0.03 + gauss() * 0.01, k * d + gauss() * 0.01);
    }
  } else return false;
  return true;
}
