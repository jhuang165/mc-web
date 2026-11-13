// Batch 60 (mpinventory): the client half of the player's inventory window (window 0; wire and rules in server-inventory.js).
// The local PlayerContainer predicts each click; the click goes out as `invClick` with the stack the local click returned. The server's S2F / S30 / S32 style
// messages (`invSet`, `invItems`, `invConfirm`) bring corrections back; armour is the server's (it arrives in the join record and in `invSet`).
import { makeStack } from '../inventory.js';

const same = (a, b) => (!a && !b) || (!!a && !!b && a.id === b.id && a.count === b.count && (a.damage ?? 0) === (b.damage ?? 0));
const fromWire = s => (s ? makeStack(s.id, s.count, s.damage ?? 0, undefined, s) : null);
// Top-level clicks go to the server; nested clicks (shift-click repeats) and local drops stay local (the server throws what it holds).
export function wireInvClicks(container, client) {
  const click = container.click.bind(container);
  let depth = 0, action = 0;
  container.click = (slot, button, mode) => {
    depth++;
    let result;
    try { result = click(slot, button, mode); } finally { depth--; }
    if (depth === 0) { container.drops.length = 0; client.invClick(slot, button, mode, ++action, result ? JSON.parse(JSON.stringify(result)) : null); }
    return result;
  };
}
const put = (arr, i, s) => { if (!same(arr[i], s)) arr[i] = fromWire(s); };
// `container` is the open PlayerContainer or null. Returns what changed on screen: { hotbar, container }.
export function applyInv(m, { inventory, container, client, mpInv }) {
  const out = { hotbar: false, container: false };
  if (m.type === 'invBroke') return out;
  if (m.type === 'invConfirm') { if (m.accepted === false) client.invAck(); return out; }
  const grid = container?.grid;
  const setGrid = list => { if (!grid) return; for (const e of list) if (e.i >= 0 && e.i < grid.stacks.length) grid.stacks[e.i] = fromWire(e.stack); container.updateResult(); out.container = true; };
  if (m.type === 'invItems') {
    if (Array.isArray(m.main)) m.main.forEach((s, i) => { if (i < 36) put(inventory.main, i, s); });
    (m.armor ?? []).forEach((s, i) => { if (i < 4) put(inventory.armor, i, s); });
    inventory.cursor = fromWire(m.cursor);
    setGrid((m.grid ?? []).map((stack, i) => ({ i, stack })));
    if (container && 'result' in m) container.result.stack = fromWire(m.result);
    out.hotbar = out.container = true;
  } else if (m.type === 'invSet') {
    for (const e of m.armor ?? []) if (e.i >= 0 && e.i < 4) { inventory.armor[e.i] = fromWire(e.stack); out.container = true; }
    if (m.grid) setGrid(m.grid);
    if ('cursor' in m) { inventory.cursor = fromWire(m.cursor); out.container = true; }
    if (container && 'result' in m) { container.result.stack = fromWire(m.result); out.container = true; } // b62: slot 0 correction (after the grid, which re-derives it)
  }
  if (Number.isInteger(m.seq)) mpInv.ack = Math.max(mpInv.ack ?? 0, m.seq);
  return out;
}
// b61: Creative's own screen (GuiContainerCreative) on a server. Native sends C10 for each inventory slot the screen changed and for each stack thrown
// (slot -1); the server checks and applies them (server-inventory.js `creative`). `gui.send` is the screen's handleMouseClick; nested calls count once.
// Slots: main 0..8 is container slot 36..44, main 9..35 is 9..35, armour index a is slot 8 - a. Returns the C10 list the call produced (for tests).
const sig = s => (s ? JSON.stringify(s) : '');
const wire = s => (s ? JSON.parse(JSON.stringify(s)) : null);
export function creativeSlots(inventory) {
  const out = new Map();
  inventory.main.slice(0, 36).forEach((s, i) => out.set(i < 9 ? 36 + i : i, sig(s)));
  inventory.armor.slice(0, 4).forEach((s, a) => out.set(8 - a, sig(s)));
  return out;
}
// Runs `run` and sends C10 for every main / armour slot it changed. Returns what `run` returned.
export function creativeDiff(inventory, client, run) {
  const before = creativeSlots(inventory);
  let result;
  try { result = run(); } finally {
    for (const [slot, g] of creativeSlots(inventory)) if (g !== before.get(slot)) client.invCreative(slot, wire(slot >= 36 ? inventory.main[slot - 36] : slot >= 9 ? inventory.main[slot] : inventory.armor[8 - slot]));
  }
  return result;
}
export function wireCreative(gui, inventory, client) {
  const send = gui.send.bind(gui);
  let depth = 0;
  gui.send = (...args) => {
    if (depth++) { try { return send(...args); } finally { depth--; } }
    let result;
    try { result = creativeDiff(inventory, client, () => send(...args)); } finally { depth--; }
    for (const d of gui.container.drops.splice(0)) client.invCreative(-1, wire(d)); // thrown by the server; no local item entity
    return result;
  };
}
// b62: Minecraft.func_147112_ai (middleClickMouse) in Creative: after InventoryPlayer.setCurrentItem it sends C10 for the hotbar slot 36 + currentItem
// (bytecode-read: PlayerControllerMP.sendSlotPacket). The diff sends that slot (and any other slot the pick changed), so `current` and the stack agree on the server.
export function creativePick(inventory, client, pick) {
  const sent = [], spy = { invCreative: (slot, item) => { sent.push(slot); client.invCreative(slot, item); } };
  creativeDiff(inventory, spy, pick);
  if (!sent.includes(36 + inventory.current)) client.invCreative(36 + inventory.current, wire(inventory.main[inventory.current])); // native sends it even when nothing changed
}
