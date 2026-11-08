// Replays a recorded hopper scenario (tools/probes/HopperProbe.java, public/research/hopper-reference.json) through the
// browser port: a real World, the redstone runtime (hopper power behaviour, comparators) and the Hoppers system over the
// shared inventory-transfer.js helper. Used by tools/verify-hopper.mjs and src/hopper.test.js.
//
// Scenario: { name, ticks, set: [[x, y, z, id, meta]], slots: [[x, y, z, slot, item, count, damage]],
//   entities: [[x, y, z, item, count, damage]], events: [[tick, kind, ...args]] } with original block ids.
// Frames: per tick, the cells whose state string changed: [key, state]; see the probe for the strings.
import { World } from "./world.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { newChest } from "./chest.js";
import { makeStack } from "./inventory.js";
import { itemFromOriginal } from "./region-import.js";
import { burnTime, ITEMS } from "./survival.js";
import { Hoppers, newHopperTile } from "./hopper.js";
import { containerAt, inventorySignal } from "./inventory-transfer.js";

const O = [20, 20, 20];
const TILE_IDS = new Set([23, 54, 61, 62, 154, 158]), TRACKED = new Set([...TILE_IDS, 149, 150]);
// Scenarios and frames use original item ids; the port stores internal ids.
const TO_ORIGINAL = new Map();
for (let id = 1; id < 500; id++) { const m = itemFromOriginal(id, 0); if (m && !TO_ORIGINAL.has(m.id)) TO_ORIGINAL.set(m.id, id); }
const stackOf = (item, count, damage) => { const m = itemFromOriginal(item, damage); if (!m) throw new Error(`no item ${item}:${damage}`); return makeStack(m.id, count, m.damage); };
export const maxStackOf = (s) => ITEMS[s.id]?.stack ?? 64;

export function replayHopperScenario(s, { origin = O } = {}) {
  const world = new World("hopper-replay", "meadow");
  for (let x = -1; x < 14; x++) for (let y = -1; y < 10; y++) for (let z = -1; z < 14; z++) world.put(origin[0] + x, origin[1] + y, origin[2] + z, 0, 0, false);
  const stores = { chests: {}, furnaces: {}, dispensers: {}, hoppers: {} }, entities = [], order = [];
  const abs = (x, y, z) => [x + origin[0], y + origin[1], z + origin[2]], keyOf = (x, y, z) => abs(x, y, z).join(",");
  const rel = (key) => key.split(",").map((v, i) => Number(v) - origin[i]).join(",");
  const runtime = createRedstoneRuntime({ world, game: {
    chests: () => stores.chests, furnaces: () => stores.furnaces, dispensers: () => stores.dispensers, hoppers: () => stores.hoppers,
    maxStack: maxStackOf, items: () => entities,
  } });
  const host = {
    world, ...Object.fromEntries(Object.keys(stores).map((n) => [n, () => stores[n]])), maxStack: maxStackOf, burnTime,
    items: () => entities, changed: (keys) => runtime.containerClosed(keys),
  };
  const hoppers = new Hoppers(host);
  const tile = (x, y, z, id) => {
    const key = keyOf(x, y, z);
    if (id === 54) return (stores.chests[key] ??= newChest());
    if (id === 61 || id === 62) return (stores.furnaces[key] ??= { items: [null, null, null], burn: 0, burnTotal: 0, cook: 0 });
    if (id === 23 || id === 158) return (stores.dispensers[key] ??= { items: Array(9).fill(null) });
    return (stores.hoppers[key] ??= newHopperTile());
  };
  const setBlock = (x, y, z, id, meta) => {
    const m = id ? fromOriginal(id, meta) : { id: 0, meta: 0 };
    if (id === 54 || id === 61 || id === 62) m.meta = 0;
    world.put(...abs(x, y, z), m.id, m.meta, false);
    if (TILE_IDS.has(id)) { const t = tile(x, y, z, id); if (id === 54 || id === 61 || id === 62) t.facing = meta; }
    if (TRACKED.has(id)) order.push([x, y, z]);
  };
  const give = (x, y, z, slot, item, count, damage) => {
    const id = world.get(...abs(x, y, z)), orig = toOriginal(id, world.getMeta(...abs(x, y, z)))[0];
    tile(x, y, z, orig).items[slot] = count === 0 ? null : stackOf(item, count === -999 ? 0 : count, damage);
    runtime.containerClosed([keyOf(x, y, z)]);
  };
  const spawn = (x, y, z, item, count, damage) => entities.push({ x, y: y - 0.125, z, stack: stackOf(item, count, damage), dead: false });
  for (const [x, y, z, id, meta] of s.set) setBlock(x, y, z, id, meta);
  for (const sl of s.slots) give(...sl);
  for (const e of s.entities) spawn(...e);
  const stateOf = (x, y, z) => {
    const [x0, y0, z0] = abs(x, y, z), id = world.get(x0, y0, z0), o = toOriginal(id, world.getMeta(x0, y0, z0), { facing: (stores.chests[keyOf(x, y, z)] ?? stores.furnaces[keyOf(x, y, z)])?.facing }) ?? [0, 0];
    return { orig: o[0], meta: o[1] };
  };
  const stackString = (st) => (st ? `${TO_ORIGINAL.get(st.id) ?? st.id}:${st.count}:${st.damage ?? 0}` : "0");
  const snapshot = () => {
    const now = new Map();
    for (const [x, y, z] of order) {
      const { orig, meta } = stateOf(x, y, z), key = `${x},${y},${z}`;
      let st = `${orig}:${meta}`;
      if (TILE_IDS.has(orig)) {
        const inv = containerAt(host, ...abs(x, y, z)), own = orig === 54 ? stores.chests[keyOf(x, y, z)].items : orig === 61 || orig === 62 ? stores.furnaces[keyOf(x, y, z)].items
          : orig === 154 ? stores.hoppers[keyOf(x, y, z)].items : stores.dispensers[keyOf(x, y, z)].items;
        st += `|${own.map(stackString).join(",")}`;
        if (orig === 154) st += `|cd${stores.hoppers[keyOf(x, y, z)].cooldown}`;
        now.set(`${key}#sig`, String(inventorySignal(inv, maxStackOf)));
      }
      if (orig === 149 || orig === 150) now.set(`${key}#cmp`, String(runtime.redstone.comparatorTile(...abs(x, y, z)).signal));
      now.set(key, st);
    }
    let n = 0;
    for (const e of entities) if (!e.dead) now.set(`e${n++}`, stackString(e.stack));
    return now;
  };
  let prev = new Map();
  const frames = [];
  for (let t = 1; t <= s.ticks; t++) {
    for (const e of s.events.filter((v) => v[0] === t)) {
      const [, kind, ...a] = e;
      if (kind === "place") {
        const [x, y, z, id, meta] = a;
        if (TILE_IDS.has(id)) { const t = tile(x, y, z, id); if (id === 54 || id === 61 || id === 62) t.facing = meta; }
        if (TRACKED.has(id) && !order.some((o) => o[0] === x && o[1] === y && o[2] === z)) order.push([x, y, z]);
        runtime.redstone.setBlock(...abs(x, y, z), id, meta, 3);
        runtime.flush();
      } else if (kind === "air") {
        runtime.redstone.setBlock(...abs(a[0], a[1], a[2]), 0, 0, 3);
        runtime.flush();
      } else if (kind === "slot") give(...a);
      else if (kind === "entity") spawn(...a);
      else if (kind === "notify") runtime.redstone.notifyBlockOfNeighborChange(...abs(a[0], a[1], a[2]), a[3]);
    }
    hoppers.tick();
    runtime.tick();
    for (let i = entities.length - 1; i >= 0; i--) if (entities[i].dead) entities.splice(i, 1);
    const now = snapshot(), diff = [];
    for (const [k, v] of now) if (prev.get(k) !== v) diff.push([k, v]);
    for (const k of prev.keys()) if (!now.has(k)) diff.push([k, "-"]);
    prev = now;
    frames.push(diff);
  }
  return { frames };
}
