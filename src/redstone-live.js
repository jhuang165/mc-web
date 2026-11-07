// The live redstone network: LiveRedstone is the native-verified RedstoneWorld (src/redstone.js) with the
// running game's World as its storage. Evidence and limits: public/research/redstone-live.md.
//
//   new LiveRedstone(world, hooks)
//   hooks (all optional): changed(x,y,z,oldInternalId,newInternalId) (the ids are omitted for a metadata-only change), sound(name,x,y,z,volume,pitch), drop(x,y,z,{id,count,damage}),
//     primeTnt(x,y,z), entitiesIn([x0,y0,z0,x1,y1,z1], mode) -> array ("living": player and mobs; "all" adds items,
//     arrows and xp orbs; the boxes are tested with strict AABB intersection by the hook),
//     containerSlots(x,y,z,originalBlockId) -> array of {count,max}|null per slot (comparator readings),
//     environment() -> {sky, skylightSubtracted, celestialAngle (radians), noSky} and skyLight(x,y,z) (daylight sensors).
//   tick() once per 20 TPS game tick; placed / removed / use; save() / restore(data); registerBehaviour (inherited).
//
// Storage: the World holds internal ids with 4-bit metadata, the engine works in original 1.7.10 ids, so every read
// and write converts through block-registry (toOriginal / fromOriginal). The repeater's powered state has no
// metadata room, so a side set of lit repeater cells is kept (and saved here). Cells outside the loaded or resident
// area read as air and never write. By default the constructor also wraps world.set, so every place, break and
// explosion that uses it runs the native setBlock tail (old block's breakBlock seeing the old metadata,
// onBlockAdded, neighbour notification with the old block as source); pass {funnel: false} in hooks to disable.
import { RedstoneWorld, pistonTile, refreshDaylightSensor, hasComparatorOverride, PISTON_MOVING, AIR } from "./redstone.js";
import { toOriginal, fromOriginal, internalIdsFor } from "./block-registry.js";
import { doorSound } from "./doors-panes.js";
import { hashSeed, WATER, LAVA } from "./world.js";

const REPEATER = 112, FURNACE = 14;
const PLATES = [70, 72, 147, 148], SENSOR = 151, TRIPWIRE = 132; // plates and tripwire strings are re-sensed every tick while idle
const COMPARATORS = [149, 150];
const SIZES = { 54: 27, 146: 27, 61: 3, 62: 3, 23: 9, 158: 9, 154: 5, 117: 4 };
// Original drop item id -> internal item id (block items are 1000 + internal id from 100 up).
const DROP_ITEMS = { 331: 360, 356: 356, 404: 381, 324: 470, 330: 471, 287: 321 };
const dropItemId = (item) => {
  if (DROP_ITEMS[item] !== undefined) return DROP_ITEMS[item];
  const m = fromOriginal(item, 0);
  return m ? (m.id >= 100 ? 1000 + m.id : m.id) : null;
};
const INFO = new Map();
function info(id) {
  let c = INFO.get(id);
  if (!c) {
    const a = toOriginal(id, 0, {});
    let fixed = a ? a[1] : null;
    for (let m = 1; a && m < 16; m++) if (toOriginal(id, m, {})[1] !== fixed) fixed = null;
    c = { orig: a ? a[0] : 0, fixed };
    INFO.set(id, c);
  }
  return c;
}
const cellKey = (x, y, z) => `${x},${y},${z}`;

export class LiveRedstone extends RedstoneWorld {
  constructor(world, hooks = {}) {
    super({ seed: hashSeed(String(world.seed ?? "redstone")), log: false });
    this.world = world;
    this.hooks = hooks;
    this.lit = new Set(); // lit repeater cells (internal id 112 with a powered state)
    this.override = null; // {x, y, z, meta}: the old metadata that breakBlock still sees
    this.deferred = []; // due pending ticks whose cell is not loaded
    this.watched = new Map(); // pressure plates and daylight sensors by cell
    this.watchIds = new Map();
    for (const o of [...PLATES, SENSOR, TRIPWIRE]) for (const id of internalIdsFor(o)) this.watchIds.set(id, o);
    this.lastScan = -1e9;
    this.clock = 0;
    if (hooks.funnel !== false) this.installFunnel();
    this.scan();
  }

  // ---- storage over the live World ----
  loaded(x, y, z) {
    return this.world.inside(x, y, z) && this.world.isLoaded(x, z);
  }
  getBlock(x, y, z) {
    const id = this.world.get(x, y, z);
    if (id === 0) return AIR;
    if (id === REPEATER) return this.lit.has(cellKey(x, y, z)) ? 94 : 93;
    return info(id).orig;
  }
  getBlockMetadata(x, y, z) {
    const o = this.override;
    if (o && o.x === x && o.y === y && o.z === z) return o.meta;
    const id = this.world.get(x, y, z);
    if (id === 0) return 0;
    const c = info(id);
    if (c.fixed !== null) return c.fixed;
    return toOriginal(id, this.world.getMeta(x, y, z), {})[1];
  }
  // Writes an original (id, meta) into the cell; false (nothing written) when unloaded or the port has no such block.
  store(x, y, z, id, meta) {
    if (!this.loaded(x, y, z)) return false;
    const m = id === AIR ? { id: 0, meta: 0 } : fromOriginal(id, meta);
    if (!m) return false;
    const key = cellKey(x, y, z), before = this.world.get(x, y, z);
    if (!this.world.put(x, y, z, m.id, m.meta)) return false;
    if (m.id === REPEATER && m.state?.powered) this.lit.add(key);
    else this.lit.delete(key);
    if (before !== m.id) this.watch(x, y, z, m.id);
    return true;
  }
  watch(x, y, z, internal) {
    const key = cellKey(x, y, z);
    if (this.watchIds.has(internal)) this.watched.set(key, { x, y, z, orig: this.watchIds.get(internal) });
    else this.watched.delete(key);
  }
  setRaw(x, y, z, id, meta = 0) {
    this.store(x, y, z, id, meta);
  }
  // World.setBlock(x, y, z, block, meta, flags): the engine's order with the old metadata visible to breakBlock.
  setBlock(x, y, z, id, meta, flags) {
    this.record(`s,${x},${y},${z},${id},${meta},${flags}`);
    if (!this.loaded(x, y, z)) return false;
    const old = this.getBlock(x, y, z), oldMeta = this.getBlockMetadata(x, y, z);
    if (old === id && oldMeta === meta) return false;
    const m = id === AIR ? { id: 0 } : fromOriginal(id, meta);
    if (!m) return false;
    const oldInternal = this.world.get(x, y, z);
    this.override = { x, y, z, meta: oldMeta };
    try {
      if (!this.store(x, y, z, id, meta)) return false;
      if ((old === 62 || old === 61 || old === 54 || old === 146 || old === 23 || old === 158 || old === 154) && old !== id) this.tiles.delete(cellKey(x, y, z));
      this.behaviours[old]?.breakBlock?.(this, x, y, z, old, oldMeta);
    } finally {
      this.override = null;
    }
    if (this.getBlock(x, y, z) !== id) return true;
    if (old === PISTON_MOVING) this.chunkTile(x, y, z);
    this.behaviours[id]?.onBlockAdded?.(this, x, y, z);
    if (id === PISTON_MOVING && !this.chunkTile(x, y, z)) this.setTileEntity(x, y, z, null);
    this.hooks.changed?.(x, y, z, oldInternal, this.world.get(x, y, z));
    if (oldInternal !== this.world.get(x, y, z) && (flags & 1) !== 0) this.world.onChange?.(x, y, z, oldInternal, this.world.get(x, y, z));
    if ((flags & 1) !== 0) {
      this.notifyBlocksOfNeighborChange(x, y, z, old);
      if (hasComparatorOverride(id)) this.updateNeighbourForOutputSignal(x, y, z, id);
    }
    return true;
  }
  setBlockMetadataWithNotify(x, y, z, meta, flags) {
    this.record(`m,${x},${y},${z},${meta},${flags}`);
    if (!this.loaded(x, y, z)) return false;
    const id = this.getBlock(x, y, z), internal = this.world.get(x, y, z);
    if (internal === 0 || this.getBlockMetadata(x, y, z) === meta) return false;
    const m = fromOriginal(id, meta);
    this.world.put(x, y, z, internal, m && m.id === internal ? m.meta : meta & 15);
    this.hooks.changed?.(x, y, z, internal, internal);
    if ((flags & 1) !== 0) {
      this.notifyBlocksOfNeighborChange(x, y, z, id);
      if (hasComparatorOverride(id)) this.updateNeighbourForOutputSignal(x, y, z, id);
    }
    return true;
  }

  // ---- tile entities and entities ----
  containerTile(x, y, z, id = this.getBlock(x, y, z)) {
    if (!this.hooks.containerSlots) return super.containerTile(x, y, z, id);
    const given = this.hooks.containerSlots?.(x, y, z, id), size = given?.length || (SIZES[id] ?? 3), slots = [];
    for (let i = 0; i < size; i++) {
      const s = given?.[i];
      slots.push(s && s.count > 0 ? { item: 0, count: s.count, max: s.max ?? 64, meta: 0 } : null);
    }
    return { slots, id, record: null };
  }
  // The engine calls this after a container's contents change; so does main.js.
  containerChanged(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (hasComparatorOverride(id)) this.updateNeighbourForOutputSignal(x, y, z, id);
  }
  getEntities(mode, box) {
    return this.hooks.entitiesIn ? this.hooks.entitiesIn(box, mode) : super.getEntities(mode, box);
  }
  playSoundEffect(x, y, z, name, volume, pitch) {
    super.playSoundEffect(x, y, z, name, volume, pitch);
    this.sounds.length = 0;
    this.hooks.sound?.(name, x, y, z, volume, pitch);
  }
  playAuxSFX(id, x, y, z) {
    super.playAuxSFX(id, x, y, z);
    if (id !== 1003) return;
    const s = doorSound();
    this.hooks.sound?.(s.event, x + 0.5, y + 0.5, z + 0.5, s.volume, s.pitch);
  }
  primeTnt(x, y, z) {
    super.primeTnt(x, y, z);
    this.primed.length = 0;
    this.hooks.primeTnt?.(x, y, z);
  }
  dropBlockAsItem(x, y, z, id, meta) {
    const before = this.drops.length;
    super.dropBlockAsItem(x, y, z, id, meta);
    for (const d of this.drops.splice(before)) {
      const item = dropItemId(d.item);
      if (item !== null) this.hooks.drop?.(d.x, d.y, d.z, { id: item, count: d.count, damage: d.damage });
    }
  }

  // ---- pending ticks: due entries on unloaded cells wait until the cell loads ----
  tickUpdates() {
    const n = Math.min(this.tree.length, 1000);
    for (let i = 0; i < n; i++) {
      const e = this.tree[0];
      if (e.time > this.time) break;
      this.tree.shift();
      this.pending.delete(`${e.x},${e.y},${e.z},${this.groupOf(e.id)}`);
      if (this.loaded(e.x, e.y, e.z)) this.thisTick.push(e);
      else this.deferred.push(e);
    }
    if (this.deferred.length) {
      const wait = [];
      for (const e of this.deferred) (this.loaded(e.x, e.y, e.z) ? this.thisTick : wait).push(e);
      this.deferred = wait;
    }
    while (this.thisTick.length) {
      const e = this.thisTick.shift(), id = this.getBlock(e.x, e.y, e.z);
      if (id === AIR || this.groupOf(id) !== this.groupOf(e.id)) continue;
      this.record(`u,${e.x},${e.y},${e.z},${id}`);
      this.behaviours[id]?.updateTick?.(this, e.x, e.y, e.z);
    }
  }
  groupOf(id) {
    return id === 75 ? 76 : id === 94 ? 93 : id === 150 ? 149 : id;
  }

  // ---- the 20 TPS loop ----
  tick() {
    this.clock++;
    this.time++;
    this.tickUpdates();
    this.sendQueuedBlockEvents();
    this.updateTileEntities();
    if (this.clock - this.lastScan >= 100) this.scan();
    for (const [key, p] of this.watched) {
      if (!this.loaded(p.x, p.y, p.z)) continue;
      const orig = this.getBlock(p.x, p.y, p.z), o = this.watchIds.get(this.world.get(p.x, p.y, p.z));
      if (o !== p.orig || orig !== p.orig) {
        if (o === undefined) this.watched.delete(key);
        else p.orig = o;
        continue;
      }
      if (o === SENSOR) {
        if (this.time % 20 === 0) this.refreshSensor(p.x, p.y, p.z);
      } else if (o === TRIPWIRE) {
        // Only an entity that calls Entity.func_145775_I touches the string (a stuck arrow or a thrown snowball does not).
        if ((this.getBlockMetadata(p.x, p.y, p.z) & 1) === 0 && this.getEntities("collider", [p.x, p.y, p.z, p.x + 1, p.y + 1, p.z + 1]).length) this.collide(p.x, p.y, p.z);
      } else if (this.getBlockMetadata(p.x, p.y, p.z) === 0) this.collide(p.x, p.y, p.z);
    }
  }
  refreshSensor(x, y, z) {
    const env = this.hooks.environment?.() ?? {};
    this.sky = this.hooks.skyLight?.(x, y, z) ?? env.sky ?? 15;
    this.skylightSubtracted = env.skylightSubtracted ?? 0;
    this.celestialAngle = env.celestialAngle ?? 0;
    this.noSky = Boolean(env.noSky);
    refreshDaylightSensor(this, x, y, z);
  }
  // Finds plates and sensors in every resident column (placed ones are registered by store()).
  scan() {
    this.lastScan = this.clock;
    const ids = [...this.watchIds.keys()], found = new Map(), h = this.world.height;
    for (const c of this.world.chunks.values()) {
      for (const id of ids) {
        for (let i = c.blocks.indexOf(id); i >= 0; i = c.blocks.indexOf(id, i + 1)) {
          const col = Math.floor(i / h), x = c.x * 16 + (col >> 4), z = c.z * 16 + (col & 15), y = i % h;
          found.set(cellKey(x, y, z), { x, y, z, orig: this.watchIds.get(id) });
        }
      }
    }
    for (const [key, p] of this.watched) if (!found.has(key) && this.loaded(p.x, p.y, p.z)) this.watched.delete(key);
    for (const [key, p] of found) if (!this.watched.has(key)) this.watched.set(key, p);
  }

  // ---- placement, removal and use ----
  // The block now at (x, y, z) was just placed by something that did not go through world.set.
  placed(x, y, z) {
    const id = this.getBlock(x, y, z);
    this.watch(x, y, z, this.world.get(x, y, z));
    this.behaviours[id]?.onBlockAdded?.(this, x, y, z);
    this.hooks.changed?.(x, y, z, 0, this.world.get(x, y, z));
    this.notifyBlocksOfNeighborChange(x, y, z, AIR);
    if (hasComparatorOverride(id)) this.updateNeighbourForOutputSignal(x, y, z, id);
  }
  // The block (oldId, oldMeta) was just removed from (x, y, z) without world.set.
  removed(x, y, z, oldId, oldMeta, oldInternal = 0) {
    this.override = { x, y, z, meta: oldMeta };
    try {
      if (this.getBlock(x, y, z) !== oldId) this.behaviours[oldId]?.breakBlock?.(this, x, y, z, oldId, oldMeta);
    } finally {
      this.override = null;
    }
    this.lit.delete(cellKey(x, y, z));
    this.watch(x, y, z, this.world.get(x, y, z));
    this.hooks.changed?.(x, y, z, oldInternal, this.world.get(x, y, z));
    this.notifyBlocksOfNeighborChange(x, y, z, oldId);
  }
  use(x, y, z) {
    if (!this.loaded(x, y, z)) return false;
    return this.activate(x, y, z);
  }
  // world.set wrapper: the native setBlock tail around the World's own edit.
  installFunnel() {
    const world = this.world, raw = world.liveRawSet ?? world.set.bind(world);
    world.liveRawSet = raw;
    this.rawSet = raw;
    world.set = (x, y, z, b, track = true, meta = 0) => {
      const oldInternal = world.get(x, y, z), oldMetaInternal = world.getMeta(x, y, z);
      const oldId = this.getBlock(x, y, z), oldMeta = this.getBlockMetadata(x, y, z), key = cellKey(x, y, z);
      if (!raw(x, y, z, b, track, meta)) return false;
      if (!track || (oldInternal === b && oldMetaInternal === meta)) return true;
      if (b !== REPEATER || oldInternal !== REPEATER) this.lit.delete(key);
      this.watch(x, y, z, b);
      const id = this.getBlock(x, y, z);
      this.override = { x, y, z, meta: oldMeta };
      try {
        this.behaviours[oldId]?.breakBlock?.(this, x, y, z, oldId, oldMeta);
      } finally {
        this.override = null;
      }
      if ((oldId === 61 || oldId === 62 || oldId === 54 || oldId === 146 || oldId === 23 || oldId === 158 || oldId === 154) && oldId !== id) this.tiles.delete(key);
      if (this.world.get(x, y, z) !== b) return true;
      this.touched?.add(key);
      this.behaviours[id]?.onBlockAdded?.(this, x, y, z);
      this.hooks.changed?.(x, y, z, oldInternal, b);
      this.notifyBlocksOfNeighborChange(x, y, z, oldId);
      if (hasComparatorOverride(id)) this.updateNeighbourForOutputSignal(x, y, z, id);
      return true;
    };
  }
  // Puts the world's own set back (a new LiveRedstone on the same World installs a fresh funnel).
  dispose() {
    if (this.world.liveRawSet) this.world.set = this.world.liveRawSet;
    delete this.world.liveRawSet;
  }
  // An edit that bypassed world.set (fluids write with world.put): the cell held `oldInternal` and now holds
  // whatever the World says. Runs the removal and placement tails; liquid-to-liquid level changes are ignored.
  external(x, y, z, oldInternal) {
    const now = this.world.get(x, y, z);
    if (oldInternal === now || !this.loaded(x, y, z)) return;
    const liquid = (id) => id === WATER || id === LAVA;
    if (oldInternal !== 0 && liquid(oldInternal) && (now === 0 || liquid(now))) return;
    if (oldInternal !== 0) {
      const c = info(oldInternal);
      this.removed(x, y, z, c.orig, c.fixed ?? 0, oldInternal);
    }
    if (now !== 0) this.placed(x, y, z);
  }

  // ---- save / restore (inside the world record) ----
  save() {
    const tick = (e) => [e.x, e.y, e.z, e.id, e.time, e.priority, e.serial];
    return {
      version: 1,
      clock: this.clock,
      time: this.time,
      rand: this.rand.save(),
      pending: [...this.tree, ...this.thisTick].map(tick),
      deferred: this.deferred.map(tick),
      events: this.blockEvents.map((list) => list.map((d) => [d.x, d.y, d.z, d.id, d.event, d.param])),
      eventIndex: this.blockEventIndex,
      torches: (this.torchToggles ?? []).map((t) => [t.x, t.y, t.z, t.time]),
      lit: [...this.lit],
      comparators: [...this.tiles].filter(([, t]) => !t.slots).map(([key, t]) => [key, t.signal]),
      pistons: this.pistonTiles().map((t) => [t.x, t.y, t.z, t.block, t.meta, t.facing, t.extending ? 1 : 0, t.renderHead ? 1 : 0, t.progress, t.lastProgress]),
    };
  }
  restore(data) {
    if (!data || data.version !== 1) return false;
    this.clock = data.clock | 0;
    this.time = data.time | 0;
    if (data.rand) this.rand.restore(data.rand);
    this.pending.clear();
    this.tree.length = 0;
    this.thisTick.length = 0;
    this.deferred = [];
    for (const [x, y, z, id, time, priority, serial] of data.pending ?? []) this.restorePending({ x, y, z, id, time, priority, serial });
    for (const [x, y, z, id, time, priority, serial] of data.deferred ?? []) this.deferred.push({ x, y, z, id, time, priority, serial });
    this.blockEvents = [0, 1].map((i) => (data.events?.[i] ?? []).map(([x, y, z, id, event, param]) => ({ x, y, z, id, event, param })));
    this.blockEventIndex = data.eventIndex ? 1 : 0;
    this.torchToggles = (data.torches ?? []).map(([x, y, z, time]) => ({ x, y, z, time }));
    this.lit = new Set(data.lit ?? []);
    this.tiles = new Map((data.comparators ?? []).map(([key, signal]) => [key, { signal }]));
    this.loadedTiles = [];
    this.addedTiles = [];
    this.chunkTiles = new Map();
    for (const [x, y, z, block, meta, facing, extending, renderHead, progress, lastProgress] of data.pistons ?? []) {
      const te = pistonTile(block, meta, facing, Boolean(extending), Boolean(renderHead));
      te.progress = progress;
      te.lastProgress = lastProgress;
      this.setTileEntity(x, y, z, te);
    }
    this.scan();
    return true;
  }
}
