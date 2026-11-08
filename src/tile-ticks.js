// Saved TileTicks (Anvil chunk "TileTicks": i block id, x, y, z, t ticks from the world time, p priority) and the port's scheduled-tick lists.
//
// Native evidence (bytecode-read of mt = WorldServer, ahs = NextTickListEntry, and the unchanged private AnvilChunkLoader payload writer and
// reader run by tools/probes/ChunkNbtProbe.java -> public/research/chunk-nbt-reference.json):
//   write  AnvilChunkLoader.func_75820_a: WorldServer.getPendingBlockUpdates(chunk, false) lists every entry of pendingTickListEntriesTreeSet
//          (time, priority, id order), then of pendingTickListEntriesThisTick, whose x and z lie in [chunkX * 16 - 2, chunkX * 16 + 18) and
//          the same for z (a chunk keeps the entries up to 2 blocks outside it, so one near a border is saved in two chunks); each is
//          written as {i: block id, x, y, z, t: (int)(entry.scheduledTime - worldTime), p: priority}.
//   read   AnvilChunkLoader.func_75823_a: for each entry World.func_147446_b(x, y, z, Block.getBlockById(i), t, p), WorldServer's
//          scheduleBlockUpdateFromLoad (mt.b): no chunk-exists test, priority always set, scheduledTime = worldTime + t only for a
//          non-air block, added to the hash set + tree set only when no entry with the same x, y, z and block is there (NextTickListEntry.equals).
// The port keeps four lists with their own clocks: fluidTicks, fireTicks, fallingTicks (scheduled-ticks.js envelopes, `delay` ticks from
// the envelope time) and the live redstone engine's pending list (redstone.js scheduleBlockUpdateWithPriority, with priority). `t` is a
// delay in every one of them, so an import is an envelope of time 0 with delay = t; an export writes delay as t.
import { fromOriginal } from './block-registry.js';
import { RedstoneWorld } from './redstone.js';

const FLUIDS = [8, 9, 10, 11], FIRE = 51, FALLING = [12, 13, 122, 145]; // sand, gravel, dragon egg, anvil (BlockFalling subclasses)
// Blocks the live redstone engine schedules and runs through registered behaviours that are installed outside redstone.js: dispensers and
// droppers (redstone-runtime dispense.js), command blocks and detector rails (BlockRailDetector ticks every 20 ticks while powered).
const INSTALLED_REDSTONE = [23, 158, 137, 28];

let table = null;
function tables() {
  if (table) return table;
  const internal = new Map(); // original id -> {kind, block (internal id)}
  const add = (kind, ids) => { for (const id of ids) { const m = fromOriginal(id, 0); if (m) internal.set(id, { kind, block: m.id }); } };
  add('fluid', FLUIDS); add('fire', [FIRE]); add('falling', FALLING);
  const redstone = new Set(INSTALLED_REDSTONE);
  const w = new RedstoneWorld();
  for (const id in w.behaviours) if (typeof w.behaviours[id]?.updateTick === 'function') redstone.add(Number(id));
  return (table = { internal, redstone });
}

/** Original block ids whose scheduled ticks the port keeps: {fluid, fire, falling, redstone} (arrays of original ids). */
export function tickBlockIds() {
  const { internal, redstone } = tables();
  const of = (kind) => [...internal].filter(([, v]) => v.kind === kind).map(([id]) => id).sort((a, b) => a - b);
  return { fluid: of('fluid'), fire: of('fire'), falling: of('falling'), redstone: [...redstone].sort((a, b) => a - b) };
}

const intOf = (tag) => (tag && Number.isInteger(tag.value) ? tag.value : 0); // NBTTagCompound.getInteger: absent or other types read 0

/**
 * One chunk's TileTicks list (Maps with i, x, y, z, t, p) as the port's lists. x and z are shifted into the world's frame;
 * `inside(x, y, z)` (default always) drops ticks outside the imported area. `seen` (a Set shared across calls) is the native hash set:
 * a tick already seen for the same x, y, z and block id is skipped (a border tick is saved in two chunks).
 * Returns {fluid, fire, falling: [{x, y, z, block, delay, orig}], redstone: [[x, y, z, id, time, priority]], counts, dropped: Map id -> n}.
 */
export function importTileTicks(list, { shiftX = 0, shiftZ = 0, inside = () => true, seen = new Set() } = {}) {
  const { internal, redstone } = tables();
  const out = { fluid: [], fire: [], falling: [], redstone: [], dropped: new Map(), duplicates: 0, outside: 0 };
  for (const tick of list ?? []) {
    if (!(tick instanceof Map)) continue;
    const id = intOf(tick.get('i')), x = intOf(tick.get('x')) + shiftX, y = intOf(tick.get('y')), z = intOf(tick.get('z')) + shiftZ;
    const t = intOf(tick.get('t')), p = intOf(tick.get('p'));
    if (!inside(x, y, z) || y < 0 || y > 255) { out.outside++; continue; }
    const k = `${x},${y},${z},${id}`;
    if (seen.has(k)) { out.duplicates++; continue; }
    const kind = internal.get(id);
    if (kind) { seen.add(k); out[kind.kind].push({ x, y, z, block: kind.block, delay: t, orig: id }); }
    else if (redstone.has(id)) { seen.add(k); out.redstone.push([x, y, z, id, t, p]); }
    else out.dropped.set(id, (out.dropped.get(id) ?? 0) + 1);
  }
  return out;
}

/** Record fields for an import result: {fluidTicks, fireTicks, fallingTicks} envelopes and a `redstone` save carrying pending ticks and lit repeaters. */
export function tickRecordFields(ticks, lit = []) {
  const env = (entries) => ({ version: 1, time: 0, entries });
  const fields = {};
  if (ticks.fluid.length) fields.fluidTicks = env(ticks.fluid);
  if (ticks.fire.length) fields.fireTicks = env(ticks.fire);
  if (ticks.falling.length) fields.fallingTicks = env(ticks.falling);
  if (ticks.redstone.length || lit.length) fields.redstone = { version: 1, clock: 0, time: 0, pending: ticks.redstone.map((e, serial) => [...e, serial]), lit: [...lit] };
  return fields;
}

const ENVELOPES = ['fluidTicks', 'fireTicks', 'fallingTicks'];
/**
 * Merge one converter record's tick state (whole-save import: one chunk at a time) into `acc` (the dimension's state object). `seen` is
 * shared for the dimension, so a border tick saved in two chunks is kept once. Returns true when `name` was a tick field.
 */
export function mergeTickState(acc, seen, name, value) {
  if (ENVELOPES.includes(name)) {
    const env = (acc[name] ??= { version: 1, time: 0, entries: [] });
    for (const e of value?.entries ?? []) {
      const k = `${name}|${e.x},${e.y},${e.z},${e.orig ?? e.block}`;
      if (!seen.has(k)) { seen.add(k); env.entries.push(e); }
    }
    return true;
  }
  if (name === 'redstone') {
    const r = (acc.redstone ??= { version: 1, clock: 0, time: 0, pending: [], lit: [] });
    for (const e of value?.pending ?? []) {
      const k = `redstone|${e[0]},${e[1]},${e[2]},${e[3]}`;
      if (!seen.has(k)) { seen.add(k); r.pending.push([...e.slice(0, 6), r.pending.length]); }
    }
    for (const key of value?.lit ?? []) if (!seen.has(`lit|${key}`)) { seen.add(`lit|${key}`); r.lit.push(key); }
    return true;
  }
  return false;
}

/**
 * Copy every tick into the other owned columns whose native save box holds it: AnvilChunkLoader writes the entries with
 * x, z in [chunkX * 16 - 2, chunkX * 16 + 18) (WorldServer.getPendingBlockUpdates), so a tick within 2 blocks of a border is saved in the
 * neighbour as well. `runtime` is Map "cx,cz" -> state with lists of {order, value}; x and z of each value are in the world's frame.
 */
export function spreadTicks(runtime, owned, names) {
  const adds = [];
  for (const [k, state] of runtime) for (const name of names) for (const item of state[name] ?? []) {
    if (item.copy) continue;
    const e = item.value, cx = Math.floor(e.x / 16), cz = Math.floor(e.z / 16);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz, nk = `${nx},${nz}`;
      if (!owned.has(nk) || nk === k) continue;
      if (e.x >= nx * 16 - 2 && e.x < nx * 16 + 18 && e.z >= nz * 16 - 2 && e.z < nz * 16 + 18) adds.push([nk, name, { ...item, copy: true }]);
    }
  }
  for (const [nk, name, item] of adds) {
    let state = runtime.get(nk);
    if (!state) runtime.set(nk, (state = {}));
    (state[name] ??= []).push(item);
  }
}
