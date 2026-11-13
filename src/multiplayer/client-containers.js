// Batch 59 (mpcontainers): the client half of the container windows (see server-containers.js for the wire). The singleplayer container classes and
// slotClick run locally as the prediction; each top-level click goes to the server as C0E with the stack the local click returned, and the server's
// S30 / S2F / S32 / S31 bring the authoritative contents back.
import { makeStack } from '../inventory.js';
import { DispenserContainer, newDispenser } from '../dispenser-container.js';
import { HopperContainer, newHopperTile } from '../hopper.js';
import { BrewingContainer } from '../brewing-container.js';
import { brewingView, newBrewingTile } from '../brewing.js';
import { newChest } from '../chest.js';
import { newEnderTile } from '../chest-blocks.js';

const same = (a, b) => (!a && !b) || (!!a && !!b && a.id === b.id && a.count === b.count && (a.damage ?? 0) === (b.damage ?? 0));
const fromWire = s => (s ? makeStack(s.id, s.count, s.damage ?? 0, undefined, s) : null);
// The 36 inventory slots as the server wants them (tag fields dropped if the message would pass the 8 KiB frame limit).
export function inventoryWire(inv) {
  const full = inv.main.map(s => (s ? JSON.parse(JSON.stringify(s)) : null));
  if (JSON.stringify(full).length < 6000) return full;
  return inv.main.map(s => (s ? { id: s.id, count: s.count, damage: s.damage ?? 0 } : null));
}
// The local container for an S2D message, or null when this client cannot build it.
export function buildWindow(m, { survival, world }) {
  const key = `${m.x},${m.y},${m.z}`, inv = survival.inventory;
  let container, kind = m.kind;
  if (kind === 'chest') container = m.ender ? survival.openEnderChest(world, m.x, m.y, m.z) : survival.openChest(world, m.x, m.y, m.z);
  else if (kind === 'furnace') container = survival.openFurnace(key, () => {});
  else if (kind === 'dispenser') container = new DispenserContainer(inv, (survival.dispensers[key] ??= newDispenser()), null);
  else if (kind === 'hopper') container = new HopperContainer(inv, (survival.hoppers[key] ??= newHopperTile()), null);
  else if (kind === 'brewing') container = new BrewingContainer(inv, brewingView((survival.brewing[key] ??= newBrewingTile())), null);
  if (!container || container.slots.length !== m.size) return null;
  container.title = m.title;
  return { container, kind, key };
}
// Makes the container's clicks go to the server; nested clicks (shift-click repeats) and local drops stay local.
export function wireClicks(container, client, windowId) {
  const click = container.click.bind(container);
  let depth = 0, action = 0;
  container.click = (slot, button, mode) => {
    depth++;
    let result;
    try { result = click(slot, button, mode); } finally { depth--; }
    if (depth === 0) { container.drops.length = 0; client.clickWindow(windowId, slot, button, mode, ++action, result ? JSON.parse(JSON.stringify(result)) : null); }
    return result;
  };
}
// S30 / S2F / S31 / S32 for the open window: tile slots take the server's stacks, player slots keep the client's own stack when it is equal (tags survive).
export function applyWindow(m, { container, windowId, survival, key, client }) {
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
    if (container.stand && m.id === 0) container.stand.brewTime = m.value;
    else if (container.furnace) { const f = survival.furnace(key); if (m.id === 0) f.cook = m.value; else if (m.id === 1) f.burn = m.value; else if (m.id === 2) f.burnTotal = m.value; }
  }
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
