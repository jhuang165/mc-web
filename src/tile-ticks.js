// Saved TileTicks (Anvil chunk "TileTicks": i block id, x, y, z, t ticks from the world time, p priority) and the port's scheduled-tick lists.
//
// Native evidence (bytecode-read of mt = WorldServer, ahs = NextTickListEntry, and the unchanged private AnvilChunkLoader payload writer and
// reader run by tools/probes/ChunkNbtProbe.java -> public/research/chunk-nbt-reference.json):
//   write  AnvilChunkLoader.func_75820_a: WorldServer.getPendingBlockUpdates(chunk, false) lists every entry of pendingTickListEntriesTreeSet
//          (time, priority, id order), then of pendingTickListEntriesThisTick, whose x and z lie in [chunkX * 16 - 2, chunkX * 16 + 16)
//          (lo = chunk << 4 - 2, hi = lo + 16 + 2, so the box reaches 2 blocks past the low edge only; batch 29 misread it as +18) and the same
//          for z, so a tick in a chunk's last 2 columns or rows is saved in the next higher chunk too; each is
//          written as {i: block id, x, y, z, t: (int)(entry.scheduledTime - worldTime), p: priority}.
//   read   AnvilChunkLoader.func_75823_a: for each entry World.func_147446_b(x, y, z, Block.getBlockById(i), t, p), WorldServer's
//          scheduleBlockUpdateFromLoad (mt.b): no chunk-exists test, priority always set, scheduledTime = worldTime + t only for a
//          non-air block, added to the hash set + tree set only when no entry with the same x, y, z and block is there (NextTickListEntry.equals).
// The port keeps four lists with their own clocks: fluidTicks, fireTicks, fallingTicks (scheduled-ticks.js envelopes, `delay` ticks from
// the envelope time) and the live redstone engine's pending list (redstone.js scheduleBlockUpdateWithPriority, with priority). `t` is a
// delay in every one of them, so an import is an envelope of time 0 with delay = t; an export writes delay as t.
import { fromOriginal, toOriginal } from './block-registry.js';
import { NBT } from './nbt.js';
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

// NBTTagCompound.getInteger: an absent key reads 0, a string/list/compound/array tag throws ClassCastException (caught, 0), the other numeric tags read
// func_150287_d: byte/short/int as is, long cast (int), float and double floored (MathHelper.floor, the (int) cast saturates).
const I32 = [-2147483648, 2147483647];
export function intOf(tag) {
  if (!tag) return 0;
  const v = tag.value;
  switch (tag.type) {
    case undefined: case NBT.BYTE: case NBT.SHORT: case NBT.INT: return Number.isInteger(v) ? v : 0;
    case NBT.LONG: return typeof v === 'bigint' ? Number(BigInt.asIntN(32, v)) : Number.isSafeInteger(v) ? Number(BigInt.asIntN(32, BigInt(v))) : 0;
    case NBT.FLOAT: case NBT.DOUBLE: return typeof v !== 'number' || Number.isNaN(v) ? 0 : Math.max(I32[0], Math.min(I32[1], Math.floor(v)));
    default: return 0;
  }
}

/**
 * Native TreeSet order of the pending ticks (NextTickListEntry.compareTo): scheduled time, then priority, then creation order (the entry's id counter).
 * `entries` are in load order; the result is a new array. Stable, so equal time and priority keep load order. Only the load order of one chunk is
 * defined natively (the counter grows as AnvilChunkLoader reads the list); across chunks it follows whichever chunk loads first.
 */
export const treeOrder = (entries, time = (e) => e.delay, priority = (e) => e.p ?? 0) => entries.map((e, i) => [e, i]).sort(([a, i], [b, j]) => time(a) - time(b) || priority(a) - priority(b) || i - j).map(([e]) => e);

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
    if (kind) { seen.add(k); out[kind.kind].push({ x, y, z, block: kind.block, delay: t, orig: id, p }); }
    else if (redstone.has(id)) { seen.add(k); out.redstone.push([x, y, z, id, t, p]); }
    else out.dropped.set(id, (out.dropped.get(id) ?? 0) + 1);
  }
  // The saved list is the native tree order; the port's lists run in array order, so a tick due earlier (or of lower priority at the same time) goes first.
  for (const kind of ['fluid', 'fire', 'falling']) out[kind] = treeOrder(out[kind]);
  out.redstone = treeOrder(out.redstone, (e) => e[4], (e) => e[5]);
  return out;
}

/** Record fields for an import result: {fluidTicks, fireTicks, fallingTicks} envelopes and a `redstone` save carrying pending ticks and lit repeaters. */
export function tickRecordFields(ticks, lit = []) {
  // `p` (always 0 for these blocks in a vanilla world: only the repeater and comparator pass a priority) only orders the import, it is not stored.
  const env = (entries) => ({ version: 1, time: 0, entries: entries.map(({ p, ...e }) => e) });
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
 * x, z in [chunkX * 16 - 2, chunkX * 16 + 16) (WorldServer.getPendingBlockUpdates, probed: tile-ticks-reference.json), so a tick in the last 2 columns or rows of a chunk (x or z mod 16 of 14 or 15) is saved in the
 * next higher chunk as well. `runtime` is Map "cx,cz" -> state with lists of {order, value}; x and z of each value are in the world's frame.
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
      if (e.x >= nx * 16 - 2 && e.x < nx * 16 + 16 && e.z >= nz * 16 - 2 && e.z < nz * 16 + 16) adds.push([nk, name, { ...item, copy: true }]);
    }
  }
  for (const [nk, name, item] of adds) {
    let state = runtime.get(nk);
    if (!state) runtime.set(nk, (state = {}));
    (state[name] ??= []).push(item);
  }
}

/**
 * One chunk's saved TileTicks rows {i, x, y, z, t, p} (x, z shifted by ox, oz into the save's frame) from its runtime state (lists of {order, value}):
 * the native writer lists the TreeSet in (time, priority, creation) order, so rows sort by t, p, then the list and its order. A fluid keeps the original
 * id it was imported with (still lava 11 is not flowing lava 10); redstone ticks keep their original id and priority; t is the delay cast to int
 * (clamped, a long difference overflows natively but the port's delays are small).
 */
export function tileTickRows(state, toOriginalId = toOriginal, ox = 0, oz = 0) {
  const rows = [], clamp = (v) => Math.max(-2147483648, Math.min(2147483647, v));
  ['fluidTicks', 'fireTicks', 'fallingTicks', 'redstoneTicks'].forEach((name, sys) => {
    for (const { value: e, order } of state[name] ?? []) {
      const red = name === 'redstoneTicks';
      const o = red ? [e.id, 0] : e.orig !== undefined ? [e.orig, 0] : toOriginalId(e.block, 0, { flowing: name === 'fluidTicks' });
      if (!o) continue;
      rows.push({ t: clamp(e.delay), p: red ? (e.priority | 0) : 0, sys, order: order ?? 0, i: o[0], x: e.x + ox, y: e.y, z: e.z + oz });
    }
  });
  rows.sort((a, b) => a.t - b.t || a.p - b.p || a.sys - b.sys || a.order - b.order);
  return rows.map(({ t, p, i, x, y, z }) => ({ i, x, y, z, t, p }));
}
