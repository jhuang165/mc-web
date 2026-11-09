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

/** WorldServer.tickUpdates' per-call cap on entries leaving the pending set (mt.a: `if (n > 1000) n = 1000`, probed in tile-ticks-reference.json "tick" scenarios). */
export const TICK_UPDATES_CAP = 1000;

/**
 * Which pending entries one WorldServer.tickUpdates(all) call takes: `entries` are {t, p} (t = scheduledTime - worldTime) in creation order.
 * It takes the first min(size, 1000) in tree order (time, priority, creation) while their time is due (t <= 0; `all` ignores the time and takes them all),
 * and it stops at the first entry not due, so what is left is the tail of the tree. Returns {taken, left} (both in tree order).
 */
export function tickUpdatesTake(entries, all = false, cap = TICK_UPDATES_CAP) {
  const tree = entries.map((e, i) => [e, i]).sort(([a, i], [b, j]) => a.t - b.t || (a.p | 0) - (b.p | 0) || i - j).map(([e]) => e);
  let n = 0;
  while (n < Math.min(tree.length, cap) && (all || tree[n].t <= 0)) n++;
  return { taken: tree.slice(0, n), left: tree.slice(n) };
}

/**
 * Runs a record's foreign ticks (importTileTicks `foreign`, envelope {time, entries}) in the live world. Natively every entry stays in the pending set until
 * the world has run its `t` ticks (air at scheduledTime 0 goes on the first), then WorldServer.tickUpdates takes it (at most 1000 per tick, in tree order) and
 * ticks its block only if the cell is in a loaded chunk, 0 <= y < 256, non-air and still the entry's block; otherwise the entry is dropped. Here a taken entry
 * whose cell now holds the block of a list the port runs (fluid, fire, falling, redstone, see tickBlockIds) is handed to `schedule[kind](x, y, z, entry)`
 * at delay 0 (the tick runs with the next list tick); every other taken entry is removed, so a save written after it came due no longer has it
 * (ageForeignTicks removes the same entries on export, which is why this changes nothing for a world that never reaches their time).
 * `blockAt(x, y, z)` is the live internal block id or -1 outside the loaded world. The envelope is edited in place; `tick(now)` takes the world's total time.
 */
export class ForeignTicks {
  constructor(env, blockAt, schedule) {
    this.env = env && Array.isArray(env.entries) ? env : null;
    this.blockAt = blockAt;
    this.schedule = schedule;
    this.minDue = null; // smallest elapsed at which something is due (air: 1); null = recompute
  }
  get size() { return this.env?.entries.length ?? 0; }
  // The pieces of tick(now) the shared TickTree drives (it takes due foreign entries in one tree with the other kinds, under one 1000 cap): `beginTick`
  // lists the due entries in tree order, `take` removes the head, `run` is the cell check and hand-over, `endTick` drops the taken ones from the envelope.
  beginTick(now) {
    const env = this.env;
    this.dueList = [];
    this.di = 0;
    this.gone = new Set();
    this.elapsed = Number.isInteger(now) && env ? now - (Number.isInteger(env.time) ? env.time : 0) : 0;
    if (!env || !env.entries.length || this.elapsed < 1) return;
    const dueAt = (e) => (e.air ? 1 : e.t);
    if (this.minDue === null) { let m = Infinity; for (const e of env.entries) { const d = dueAt(e); if (d < m) m = d; } this.minDue = m; }
    if (this.elapsed < this.minDue) return;
    this.dueList = env.entries.filter((e) => dueAt(e) <= this.elapsed);
    this.dueList.sort((a, b) => this.delay(a) - this.delay(b) || (a.p | 0) - (b.p | 0));
  }
  head() { return this.dueList?.[this.di]; }
  delay(e) { return e.air ? -1e15 : e.t - this.elapsed; }
  take() {
    const e = this.dueList[this.di++];
    this.gone.add(e);
    return e;
  }
  run(e) {
    if (e.air || e.y < 0 || e.y > 255) return 0;
    const { internal, redstone } = tables();
    const kind = internal.get(e.i)?.kind ?? (redstone.has(e.i) ? 'redstone' : null), want = fromOriginal(e.i, 0)?.id;
    if (!kind || want === undefined || this.blockAt(e.x, e.y, e.z) !== want) return 0;
    this.schedule[kind]?.(e.x, e.y, e.z, e);
    return 1;
  }
  endTick() {
    if (this.gone?.size && this.env) { this.env.entries = this.env.entries.filter((e) => !this.gone.has(e)); this.minDue = null; }
    this.gone = null;
  }
  tick(now) {
    if (this.tree) return 0; // the TickTree takes the foreign entries
    const env = this.env;
    if (!env || !env.entries.length || !Number.isInteger(now)) return 0;
    const elapsed = now - (Number.isInteger(env.time) ? env.time : 0);
    if (elapsed < 1) return 0;
    const dueAt = (e) => (e.air ? 1 : e.t);
    if (this.minDue === null) { let m = Infinity; for (const e of env.entries) { const d = dueAt(e); if (d < m) m = d; } this.minDue = m; } // a loop: a whole-save list can exceed the argument limit of Math.min(...)
    if (elapsed < this.minDue) return 0;
    const due = env.entries.filter((e) => dueAt(e) <= elapsed);
    const { taken } = tickUpdatesTake(due.map((e) => ({ e, t: e.air ? -1e15 : e.t - elapsed, p: e.p })), false);
    const gone = new Set(taken.map((v) => v.e));
    if (gone.size) env.entries = env.entries.filter((e) => !gone.has(e));
    this.minDue = null;
    const { internal, redstone } = tables();
    let ran = 0;
    for (const { e } of taken) {
      if (e.air || e.y < 0 || e.y > 255) continue;
      const kind = internal.get(e.i)?.kind ?? (redstone.has(e.i) ? 'redstone' : null), want = fromOriginal(e.i, 0)?.id;
      if (!kind || want === undefined || this.blockAt(e.x, e.y, e.z) !== want) continue;
      this.schedule[kind]?.(e.x, e.y, e.z, e);
      ran++;
    }
    return ran;
  }
}

/**
 * The one pending-tick tree of WorldServer, over the port's separate lists. Natively every scheduled block update of every kind sits in a single
 * TreeSet (NextTickListEntry order: time, priority, creation id) and WorldServer.tickUpdates takes at most 1000 of them per tick, whatever their
 * block (probed: tile-ticks-reference.json "tick" scenarios mix fluids 8, falling 12, fire 51 and a redstone block 93 in one tree). The port keeps
 * fluids, fire, falling blocks, redstone and the foreign (unported-kind) ticks in their own lists; `attach` gives them one creation counter (`nextId`)
 * and `tick` takes the due entries across all of them in tree order under one cap, as the native first loop does, then runs the taken entries in
 * that order, as the second loop does (an entry taken but not yet run no longer blocks a new request for its cell).
 *
 * A source is {name, begin(), head(), delay(e), p(e), id(e), take(), run(e), flush?(), afterTake?(), end?(clock)}: `head` is its smallest entry in its own
 * order, `delay` the ticks until due (<= 0 is due; each list counts its own clock), `take` removes and returns the head.
 * Lists saved with their creation id (`n` on the envelope entries) keep cross-kind order at equal time and priority across a save and reload; an older
 * save numbers its entries by (due time, priority, kind) when the tree attaches.
 */
export class TickTree {
  constructor(cap = TICK_UPDATES_CAP) {
    this.n = 0;
    this.cap = cap;
    this.sources = [];
    this.lastTaken = 0;
  }
  nextId() { return this.n++; }
  /** Numbers the entries every source holds in tree order and hands each its creation ids from now on. */
  attach(sources, renumber) {
    this.sources = sources.filter(Boolean);
    renumber?.(this);
    return this;
  }
  /** Which entries one tickUpdates call takes: [{s, e}] in tree order, at most `cap`, stopping at the first entry not due (`all` ignores the due time). */
  takeDue(all = false) {
    const out = [], sources = this.sources;
    while (out.length < this.cap) {
      let best = null, bd = 0, bp = 0, bi = 0;
      for (const s of sources) {
        const h = s.head();
        if (!h) continue;
        const d = s.delay(h), p = s.p(h), i = s.id(h);
        if (!best || d < bd || (d === bd && (p < bp || (p === bp && i < bi)))) { best = s; bd = d; bp = p; bi = i; }
      }
      if (!best || (!all && bd > 0)) break;
      out.push({ s: best, e: best.take() });
    }
    this.lastTaken = out.length;
    return out;
  }
  /**
   * One WorldServer.tickUpdates(false): every source advances its clock, the due entries are taken across all kinds, then run in tree order.
   * `observers[name](changes)` gets the cells a fluid or fire run changed whenever the kind of the running entry switches and at the end; each source's
   * `end` (fire's random ticks) runs last.
   */
  tick(clock = {}, observers = {}) {
    for (const s of this.sources) s.begin(clock);
    const taken = this.takeDue();
    for (const s of this.sources) s.afterTake?.();
    let last = null;
    const flush = () => { if (last?.flush) { const changes = last.flush(); if (changes.length) observers[last.name]?.(changes); } };
    for (const { s, e } of taken) {
      if (last && last !== s) flush();
      last = s;
      s.run(e);
    }
    flush();
    for (const s of this.sources) {
      const changes = s.end?.(clock);
      if (changes) observers[s.name]?.(changes);
    }
    return taken.length;
  }
}

const sourceOf = (name, sys, o) => ({ name, sys, p: (e) => e.p | 0, id: (e) => e.id, take: () => sys.take(), run: (e) => sys.run(e), ...o });

/**
 * Builds the TickTree over a live world's systems: `fluids` (fluids.js), `fire` (fire.js), `falling` (falling.js), `redstone` (the runtime of
 * redstone-runtime.js, whose `redstone` is the LiveRedstone) and `foreign` (ForeignTicks) with `now()` its world time. Any of them may be missing.
 * Order of the sources only breaks exact ties (it matches the export's kind order: fluid, fire, falling, redstone, foreign).
 */
export function attachTickTree({ fluids, fire, falling, redstone, foreign, now = () => 0 }) {
  const tree = new TickTree();
  const live = redstone?.redstone;
  const sources = [
    fluids && sourceOf('fluids', fluids, { begin: () => fluids.beginTick(), head: () => fluids.heap[0], delay: (e) => e.time - fluids.time, flush: () => fluids.drain(), end: () => fluids.drain() }),
    fire && sourceOf('fire', fire, { begin: () => fire.beginTick(), head: () => fire.queue.heap[0], delay: (e) => e.time - fire.time, flush: () => fire.drain(), end: ({ x, z }) => fire.endTick(x, z) }),
    falling && sourceOf('falling', falling, { begin: () => falling.beginTick(), head: () => falling.head(), delay: (e) => e.time - falling.time }),
    live && sourceOf('redstone', live, {
      begin: () => redstone.tickBegin(), head: () => live.tree[0], delay: (e) => e.time - live.time, p: (e) => e.priority | 0, id: (e) => e.serial,
      take: () => { const e = live.tree.shift(); live.accept(e); return e; }, run: (e) => live.runTaken(e), afterTake: () => live.retryDeferred(),
    }),
    foreign?.env && sourceOf('foreign', foreign, {
      begin: () => foreign.beginTick(now()), head: () => foreign.head(), delay: (e) => foreign.delay(e), id: (e) => { if (!foreignIds.has(e)) foreignIds.set(e, tree.nextId()); return foreignIds.get(e); }, end: () => { foreign.endTick(); },
    }),
  ];
  const foreignIds = new WeakMap();
  const present = sources.filter(Boolean);
  return tree.attach(present, () => {
    // One numbering for everything pending now: (due time, priority, saved creation id or the old id, kind). Entries keep their order within a list.
    const rows = [];
    const add = (kind, rank, e, delay, p, own) => rows.push({ kind, rank, e, delay, p, key: Number.isSafeInteger(e.n) ? e.n : own });
    if (fluids) for (const e of fluids.pending.values()) add('fluids', 0, e, e.time - fluids.time, e.p | 0, e.id);
    if (fire) for (const e of fire.queue.pending.values()) add('fire', 1, e, e.time - fire.time, e.p | 0, e.id);
    if (falling) for (const e of falling.pending.values()) add('falling', 2, e, e.time - falling.time, e.p | 0, e.id);
    if (live) for (const e of [...live.tree, ...live.thisTick, ...live.deferred]) add('redstone', 3, e, e.time - live.time, e.priority | 0, e.serial);
    const env = foreign?.env;
    if (env) {
      const elapsed = Math.max(0, now() - (Number.isInteger(env.time) ? env.time : 0));
      env.entries.forEach((e, i) => add('foreign', 4, e, e.air ? -1e15 : e.t - elapsed, e.p | 0, i));
    }
    rows.sort((a, b) => a.delay - b.delay || a.p - b.p || a.key - b.key || a.rank - b.rank);
    for (const r of rows) {
      const id = tree.nextId();
      if (r.kind === 'redstone') r.e.serial = id;
      else if (r.kind === 'foreign') foreignIds.set(r.e, id);
      else r.e.id = id;
    }
    if (fluids) fluids.ids = tree;
    if (fire) fire.ids = tree;
    if (falling) falling.ids = tree;
    if (live) live.ids = tree;
    if (foreign) {
      foreign.tree = tree;
    }
  });
}

/** Record fields for an import result: {fluidTicks, fireTicks, fallingTicks} envelopes and a `redstone` save carrying pending ticks, lit repeaters and comparator output signals (["x,y,z", OutputSignal]). */
export function tickRecordFields(ticks, lit = [], comparators = [], time = 0) {
  // `p` (always 0 for these blocks in a vanilla world: only the repeater and comparator pass a priority) is stored only when it is not 0 (the live lists order by it and write it back).
  const env = (entries) => ({ version: 1, time: 0, entries: entries.map(({ p, ...e }) => (p ? { ...e, p } : e)) });
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
      rows.push({ t: clamp(e.delay), p: red ? (e.priority | 0) : (e.p | 0), n: Number.isSafeInteger(e.n) ? e.n : Infinity, sys, order: order ?? 0, i: o[0], x: e.x + ox, y: e.y, z: e.z + oz });
    }
  });
  // A shared creation id (`n`, saved while the TickTree runs) orders equal time and priority across kinds as the one native TreeSet does; entries without it keep list order.
  rows.sort((a, b) => a.t - b.t || a.p - b.p || (a.n === b.n ? 0 : a.n < b.n ? -1 : 1) || a.sys - b.sys || a.order - b.order);
  return rows.map(({ t, p, i, x, y, z }) => ({ i, x, y, z, t, p }));
}
