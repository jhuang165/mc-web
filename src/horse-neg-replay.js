// Replays the leads3 `horseNeg` records (tools/probes/Leads3Probe.java, native ContainerHorseInventory clicks with size <= 0 stacks)
// against HorseContainer. Shared by src/leads3.test.js and tools/verify-leads3.mjs.
import * as G from "./horse-gear.js";
import { PlayerInventory } from "./inventory.js";

const ORIG = { saddle: 329, ironArmor: 417, goldArmor: 418, stick: 280 };
const SINGLE = new Set([329, 417, 418, 419]);
const items = new Proxy({}, { get: (t, id) => ({ id: +id, stack: SINGLE.has(Object.entries(ORIG).find(([, v]) => G.liveOf(v) === +id)?.[1]) ? 1 : 64, durability: 0 }) });
const stack = (kind, count) => ({ id: G.liveOf(ORIG[kind]), count, damage: 0 });
const view = (s) => (s ? { id: G.originalId(s), damage: s.damage ?? 0, count: s.count } : null);
const drop = (s) => `${G.originalId(s)}x${s.count}`;

export function replayHorseNeg(r) {
  const chested = r.type === 1 && /Chest/.test(r.action) || r.action === "cursorChest2";
  const h = { type: r.type, chested, saddled: false, armor: 0, items: Array(chested ? 17 : 2).fill(null) };
  const inv = new PlayerInventory(items);
  const c = new G.HorseContainer(inv, h, () => {});
  const made = stack(r.kind, r.count);
  let slot = 0, button = 0, mode = 0;
  const m = /^(cursor|pick|shiftOut|drop|dropAll)(Slot)?(\d)?(Right)?$/.exec(r.action);
  switch (r.action) {
    case "cursorSlot0": case "cursorSlot0Right": inv.cursor = made; slot = 0; button = r.action.endsWith("Right") ? 1 : 0; break;
    case "cursorSlot1": case "cursorSlot1Right": inv.cursor = made; slot = 1; button = r.action.endsWith("Right") ? 1 : 0; break;
    case "cursorChest2": inv.cursor = made; slot = 2; break;
    case "shiftIn": case "shiftInChest": inv.main[0] = made; slot = c.size + 27; mode = 1; break;
    case "pickSlot0": case "pickSlot0Right": h.items[0] = made; slot = 0; button = r.action.endsWith("Right") ? 1 : 0; break;
    case "pickSlot1": case "pickSlot1Right": h.items[1] = made; slot = 1; button = r.action.endsWith("Right") ? 1 : 0; break;
    case "shiftOut0": h.items[0] = made; mode = 1; break;
    case "shiftOut1": h.items[1] = made; slot = 1; mode = 1; break;
    case "drop0": h.items[0] = made; mode = 4; break;
    case "dropAll0": h.items[0] = made; mode = 4; button = 1; break;
    case "drop1": h.items[1] = made; slot = 1; mode = 4; break;
    case "dropAll1": h.items[1] = made; slot = 1; mode = 4; button = 1; break;
    case "cursorOverSlot0": h.items[0] = stack("saddle", 1); inv.cursor = made; break;
    case "cursorOverSlot1": h.items[1] = stack("goldArmor", 1); inv.cursor = made; slot = 1; break;
    default: throw new Error(r.action);
  }
  void m;
  G.syncGear(h);
  const result = c.click(slot, button, mode);
  G.syncGear(h);
  const player = [];
  inv.main.forEach((s, i) => { if (s) player.push({ slot: i, stack: view(s) }); });
  return { result: view(result), cursor: view(inv.cursor), horse: h.items.map(view), player, saddled: h.saddled, armor: h.armor, drops: c.drops.map(drop) };
}
