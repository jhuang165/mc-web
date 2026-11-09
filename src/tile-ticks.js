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
// Load-time details probed in tile-ticks-reference.json (read scenarios 2..13 carry air, id 200/999 and y -5/256/300):
//   Block.getBlockById(unregistered id) is air, so an unknown id is stored as air (id 0, scheduledTime 0, saved again as i 0, t -worldTime); an entry on
//   air, an unknown id or y outside 0..255 is kept in the sets like any other (no chunk or height test on load).
// Due time (bytecode-read, WorldServer.tickUpdates mt.a(boolean) and World.checkChunksExist ahb.b): at most 1000 entries with scheduledTime <= worldTime
//   leave the set per tick; each is ticked only if its own cell is in a loaded chunk with 0 <= y < 256 (checkChunksExist with radius 0 is false for y < 0
//   or y >= 256) and the block there is non-air and still the entry's block; otherwise it is dropped (the else branch calls scheduleBlockUpdate with
//   delay 0, whose own checkChunksExist test fails the same way, so nothing is re-added). So air, unknown ids and out-of-range y are only ever
//   observable in a save written before the first tick that reaches their time: they wait in the set until the world has run `t` ticks.
// ThisTick: the list tickUpdates moves due entries into (pendingTickListEntriesThisTick) only exists during a tick; a save taken then writes the tree
//   set first and these entries after it (t <= 0), and the reader puts them all back in the TreeSet, so they are plain due entries (t <= 0) on load.
// The port keeps what it cannot run in `foreignTicks` (see importTileTicks) and ages it against the record's world time on export.
// The port keeps four lists with their own clocks: fluidTicks, fireTicks, fallingTicks (scheduled-ticks.js envelopes, `delay` ticks from
// the envelope time) and the live redstone engine's pending list (redstone.js scheduleBlockUpdateWithPriority, with priority). `t` is a
// delay in every one of them, so an import is an envelope of time 0 with delay = t; an export writes delay as t.
import { fromOriginal, toOriginal, isRegistered } from './block-registry.js';
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
// func_150287_d: byte/short/int as is, long cast (int), float and double floored (MathHelper.floor_double: the (int) cast saturates, below -2^31 the result wraps to MAX_VALUE).
const I32 = [-2147483648, 2147483647];
export function intOf(tag) {
  if (!tag) return 0;
  const v = tag.value;
  switch (tag.type) {
    case undefined: case NBT.BYTE: case NBT.SHORT: case NBT.INT: return Number.isInteger(v) ? v : 0;
    case NBT.LONG: return typeof v === 'bigint' ? Number(BigInt.asIntN(32, v)) : Number.isSafeInteger(v) ? Number(BigInt.asIntN(32, BigInt(v))) : 0;
    // MathHelper.floor_double / floor_float (bytecode-read, qh.c and qh.d): i = (int)v (saturating, NaN 0), then v < (double)i ? i - 1 : i. For v below -2^31 that is
    // MIN_VALUE - 1, which wraps to MAX_VALUE (not clamped to MIN_VALUE).
    case NBT.FLOAT: case NBT.DOUBLE: {
      if (typeof v !== 'number' || Number.isNaN(v)) return 0;
      const f = tag.type === NBT.FLOAT ? Math.fround(v) : v, i = Math.max(I32[0], Math.min(I32[1], Math.trunc(f)));
      return f < i ? (i - 1) | 0 : i;
    }
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
export function importTileTicks(list, { shiftX = 0, shiftZ = 0, inside = () => true, reach = () => false, seen = new Set() } = {}) {
  const { internal, redstone } = tables();
  const out = { fluid: [], fire: [], falling: [], redstone: [], foreign: [], dropped: new Map(), duplicates: 0, outside: 0, outsideKept: 0 };
  for (const tick of list ?? []) {
    if (!(tick instanceof Map)) continue;
    const raw = intOf(tick.get('i')), x = intOf(tick.get('x')) + shiftX, y = intOf(tick.get('y')), z = intOf(tick.get('z')) + shiftZ;
    const t = intOf(tick.get('t')), p = intOf(tick.get('p'));
    const id = isRegistered(raw) ? raw : 0; // Block.getBlockById: an unregistered id is air
    const area = inside(x, y, z);
    if (!area && !reach(x, y, z)) { out.outside++; continue; }
    const k = `${x},${y},${z},${id}`;
    if (seen.has(k)) { out.duplicates++; continue; }
    seen.add(k);
    const portable = area && y >= 0 && y <= 255 && id !== 0, kind = portable ? internal.get(id) : undefined;
    if (kind) out[kind.kind].push({ x, y, z, block: kind.block, delay: t, orig: id, p });
    else if (portable && redstone.has(id)) out.redstone.push([x, y, z, id, t, p]);
    else {
      // Nothing in the port runs it: kept raw for the export until its due time (air keeps scheduledTime 0, so it has no t).
      if (portable) out.dropped.set(id, (out.dropped.get(id) ?? 0) + 1);
      if (!area) out.outsideKept++;
      out.foreign.push(id === 0 ? { i: 0, x, y, z, p, air: true } : { i: id, x, y, z, t, p });
    }
  }
  // The saved list is the native tree order; the port's lists run in array order, so a tick due earlier (or of lower priority at the same time) goes first.
  for (const kind of ['fluid', 'fire', 'falling']) out[kind] = treeOrder(out[kind]);
  out.redstone = treeOrder(out.redstone, (e) => e[4], (e) => e[5]);
  out.foreign = treeOrder(out.foreign, (e) => (e.air ? -1e15 : e.t), (e) => e.p);
  return out;
}

/**
 * The foreign ticks of a record at its world time `now` (record.totalTime, default the envelope's own time): after `elapsed` >= 1 ticks every entry
 * with t <= elapsed has been processed (tickUpdates runs entries with scheduledTime <= worldTime, and air at scheduledTime 0 always), so it is gone;
 * the others keep t - elapsed. Air has no due time and is written as t = -now (native (int)(0 - worldTime)).
 * Returns [{i, x, y, z, delay, p}] in the envelope's order.
 */
export function ageForeignTicks(env, now) {
  const base = Number.isInteger(env?.time) ? env.time : 0, at = Number.isInteger(now) ? now : base, elapsed = Math.max(0, at - base);
  const out = [];
  for (const e of Array.isArray(env?.entries) ? env.entries : []) {
    if (![e?.i, e?.x, e?.y, e?.z].every(Number.isInteger)) continue;
    if (e.air) { if (elapsed < 1) out.push({ i: 0, x: e.x, y: e.y, z: e.z, delay: Math.max(-2147483648, Math.min(2147483647, -at)), p: e.p | 0 }); continue; }
    const t = Number.isInteger(e.t) ? e.t : 0;
    if (elapsed >= 1 && t <= elapsed) continue;
    out.push({ i: e.i, x: e.x, y: e.y, z: e.z, delay: t - elapsed, p: e.p | 0 });
  }
  return out;
}

/** Record fields for an import result: {fluidTicks, fireTicks, fallingTicks} envelopes and a `redstone` save carrying pending ticks, lit repeaters and comparator output signals (["x,y,z", OutputSignal]). */
export function tickRecordFields(ticks, lit = [], comparators = [], time = 0) {
  // `p` (always 0 for these blocks in a vanilla world: only the repeater and comparator pass a priority) only orders the import, it is not stored.
  const env = (entries) => ({ version: 1, time: 0, entries: entries.map(({ p, ...e }) => e) });
  const fields = {};
  if (ticks.foreign?.length) fields.foreignTicks = { version: 1, time, entries: ticks.foreign };
  if (ticks.fluid.length) fields.fluidTicks = env(ticks.fluid);
  if (ticks.fire.length) fields.fireTicks = env(ticks.fire);
  if (ticks.falling.length) fields.fallingTicks = env(ticks.falling);
  if (ticks.redstone.length || lit.length || comparators.length) fields.redstone = { version: 1, clock: 0, time: 0, pending: ticks.redstone.map((e, serial) => [...e, serial]), lit: [...lit], ...(comparators.length ? { comparators: comparators.map(([k, v]) => [k, v]) } : {}) };
  return fields;
}

const ENVELOPES = ['fluidTicks', 'fireTicks', 'fallingTicks', 'foreignTicks'];
/**
 * Merge one converter record's tick state (whole-save import: one chunk at a time) into `acc` (the dimension's state object). `seen` is
 * shared for the dimension, so a border tick saved in two chunks is kept once. Returns true when `name` was a tick field.
 */
export function mergeTickState(acc, seen, name, value) {
  if (ENVELOPES.includes(name)) {
    const env = (acc[name] ??= { version: 1, time: Number.isInteger(value?.time) ? value.time : 0, entries: [] });
    for (const e of value?.entries ?? []) {
      const k = `${name}|${e.x},${e.y},${e.z},${e.orig ?? e.block ?? e.i}`;
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
    for (const [key, signal] of value?.comparators ?? []) if (!seen.has(`cmp|${key}`)) { seen.add(`cmp|${key}`); (r.comparators ??= []).push([key, signal]); }
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
 * Put the record's foreign ticks (aged to `now`) into the runtime state of every owned chunk whose native save box [c*16-2, c*16+16) holds them.
 * A tick no owned chunk holds is not written (nothing could save it). Returns the number of entries placed.
 */
export function placeForeignTicks(runtime, owned, env, now) {
  let placed = 0;
  ageForeignTicks(env, now).forEach((e, order) => {
    let any = false;
    for (const nx of new Set([Math.floor(e.x / 16), Math.floor((e.x + 2) / 16)])) for (const nz of new Set([Math.floor(e.z / 16), Math.floor((e.z + 2) / 16)])) {
      const k = `${nx},${nz}`;
      if (!owned.has(k) || e.x < nx * 16 - 2 || e.x >= nx * 16 + 16 || e.z < nz * 16 - 2 || e.z >= nz * 16 + 16) continue;
      let state = runtime.get(k);
      if (!state) runtime.set(k, (state = {}));
      (state.foreignTicks ??= []).push({ order, value: e, copy: true });
      any = true;
    }
    if (any) placed++;
  });
  return placed;
}

/**
 * One chunk's saved TileTicks rows {i, x, y, z, t, p} (x, z shifted by ox, oz into the save's frame) from its runtime state (lists of {order, value}):
 * the native writer lists the TreeSet in (time, priority, creation) order, so rows sort by t, p, then the list and its order. A fluid keeps the original
 * id it was imported with (still lava 11 is not flowing lava 10); redstone ticks keep their original id and priority; t is the delay cast to int
 * (clamped, a long difference overflows natively but the port's delays are small).
 */
export function tileTickRows(state, toOriginalId = toOriginal, ox = 0, oz = 0) {
  const rows = [], clamp = (v) => Math.max(-2147483648, Math.min(2147483647, v));
  ['fluidTicks', 'fireTicks', 'fallingTicks', 'redstoneTicks', 'foreignTicks'].forEach((name, sys) => {
    for (const { value: e, order } of state[name] ?? []) {
      const red = name === 'redstoneTicks';
      const o = name === 'foreignTicks' ? [e.i, 0] : red ? [e.id, 0] : e.orig !== undefined ? [e.orig, 0] : toOriginalId(e.block, 0, { flowing: name === 'fluidTicks' });
      if (!o) continue;
      rows.push({ t: clamp(e.delay), p: red ? (e.priority | 0) : name === 'foreignTicks' ? (e.p | 0) : 0, sys, order: order ?? 0, i: o[0], x: e.x + ox, y: e.y, z: e.z + oz });
    }
  });
  rows.sort((a, b) => a.t - b.t || a.p - b.p || a.sys - b.sys || a.order - b.order);
  return rows.map(({ t, p, i, x, y, z }) => ({ i, x, y, z, t, p }));
}
