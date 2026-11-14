// Batch 69 mpmaps: maps on the dedicated server.
//
// The single-player rules are called, not copied (src/maps.js: ItemEmptyMap.onItemRightClick, ItemMap.updateMapData, MapData.updateVisiblePlayers, the id counter, RecipesMapCloning and
// RecipesMapExtending; maps-clock-live.js: the world context). One MapStore (`mapStore`, World.mapStorage) belongs to the server world and every dimension: the Nether and the End
// share the Overworld's storage natively (WorldServerMulti), and the ids come from the one "map" counter of data/idcounts.dat. Saved under `maps` (counter and run-length colours).
// This module adds what the server owns: MapInfo's dirty columns and the S34PacketMaps cadence.
//   * ItemMap.onUpdate for each map in a player's main slots (every tick): updateVisiblePlayers(player, true), and updateMapData for the held slot (the native per-tick column pass).
//   * EntityPlayerMP.onUpdateEntity (bytecode-read, mw.i): after that, for every inventory slot holding a map, ItemMap.func_150911_c -> MapData.getUpdatePacket -> MapInfo.getPacket (ayj.a).
//     At most one S34 payload per map and tick: first the scale record [2, scale], then every fifth call the icon list [1, (type << 4 | rot & 15, x, z)...] (skipped when equal to the
//     last one sent, except for a stack on an item frame), otherwise one dirty column [0, x, y0, colours...] at x = (f++ * 11) % 128. Executed in map-packet-reference.json.
//   * EntityTrackerEntry (bytecode-read, my.a(List)): an item frame holding a map, every 10th tick of its entry counter, runs updateVisiblePlayers(player, stack) for EVERY player of
//     the world (the argument is WorldServer.playerEntities, not the tracking set) and sends each the packet above with the frame stack (isOnItemFrame true).
//   * S34 arrives as `{ type: 'mapData', maps: [{ id, b: [signed bytes] }] }` in the player's `itemsOut` (client-maps.js applies it).
// Coordinates are native: the End window's local = native - origin (originX / originZ), as `toNative` of server-summon.js. Nether and End maps use the dimension's own rules (the
// Nether and End are noSky: half radius and the fixed dirt / stone dither, updateMapData).
import { mapStore, createEmptyMapData, updateMapData, updateVisiblePlayers, ITEM_FILLED_MAP, ITEM_EMPTY_MAP, MAP_SIZE } from '../maps.js';
import { worldContext } from '../maps-clock-live.js';
import { makeStack } from '../inventory.js';

const byte = v => (v << 24) >> 24;
const origin = w => [w?.originX ?? 0, w?.originZ ?? 0];
// The game's yaw (radians, 0 looks toward -z) as Minecraft degrees (mcYaw of server-dimensions.js).
const mcYaw = yaw => (Math.PI - yaw) * 180 / Math.PI;

// MapInfo (ayj) fields beyond maps.js's d / lo / hi: f the column counter, g the icon countdown, h the last icon packet, i the scale record sent.
export function packetInfo(data, name) {
  let info = data.infos.get(name);
  if (!info) { info = { d: 0, lo: new Int32Array(MAP_SIZE), hi: new Int32Array(MAP_SIZE).fill(MAP_SIZE - 1) }; data.infos.set(name, info); }
  if (info.f === undefined) Object.assign(info, { f: 0, g: 0, h: null, i: false });
  return info;
}
// MapData.func_76194_a (ayi.a(x, lo, hi)) for every MapInfo, from the ranges updateMapData marked on the data: b = min of the lows, c = max of the highs.
export function drainDirty(data) {
  const columns = data.dirtyColumns;
  if (!columns) return;
  for (const [x, [lo, hi]] of columns) for (const info of data.infos.values()) {
    if (info.lo[x] < 0 || info.lo[x] > lo) info.lo[x] = lo;
    if (info.hi[x] < 0 || info.hi[x] < hi) info.hi[x] = hi;
  }
  data.dirtyColumns = null;
}
// MapData.MapInfo.getPacket (ayj.a(add)): the bytes of one S34 payload, or null. `onFrame` is ItemStack.isOnItemFrame.
export function mapPacket(data, info, onFrame) {
  if (info.f === undefined) Object.assign(info, { f: 0, g: 0, h: null, i: false });
  if (!info.i) { info.i = true; return [2, byte(data.scale)]; }
  if (--info.g < 0) {
    info.g = 4;
    const bytes = [1];
    for (const [type, x, z, rotation] of data.decorations.values()) bytes.push(byte((type << 4) | (rotation & 15)), x, z);
    let send = !onFrame;
    if (!info.h || info.h.length !== bytes.length) send = false;
    else for (let i = 0; i < bytes.length; i++) if (bytes[i] !== info.h[i]) { send = false; break; }
    if (!send) { info.h = bytes; return bytes; }
  }
  const x = (info.f++ * 11) % MAP_SIZE;
  if (info.lo[x] < 0) return null;
  const y0 = info.lo[x], n = info.hi[x] - y0 + 1, out = [0, byte(x), byte(y0)];
  for (let i = 0; i < n; i++) out.push(data.colors[(i + y0) * MAP_SIZE + x]);
  info.hi[x] = -1; info.lo[x] = -1;
  return out;
}

export class ServerMaps {
  // `saved` is what saveField() wrote under `maps`.
  constructor(sim, saved = null) {
    this.sim = sim;
    this.store = mapStore; this.store.remote = false; this.store.load(saved);
    this.frameTicks = new WeakMap(); // entity -> its tracker entry's tick counter
  }
  saveField() { return this.store.counter || this.store.maps.size ? { maps: this.store.toJSON() } : {}; }
  // World.getSpawnX / getSpawnZ for a map that has to be created (ItemMap.getMapData of an unknown id); the Overworld's spawn.
  spawn() {
    const s = this.sim.worldSpawn ?? (this.sim.dimensions?.overworld ?? this.sim.world).spawn();
    return { x: Math.floor(Array.isArray(s) ? s[0] : s.x), z: Math.floor(Array.isArray(s) ? s[2] : s.z) };
  }
  // A player leaves: the new EntityPlayerMP of the next login gets a new MapInfo (the scale record and every column again).
  leave(p) { for (const data of this.store.maps.values()) data.infos.delete(p.name); }

  // ItemEmptyMap.onItemRightClick (executed in maps-clock-reference.json): a new map at scale 0 on the player's native position, in the player's dimension. True when the held item was
  // an empty map (the click is used). The empty stack shrinks (a stack of one becomes the map in place); the map goes to the inventory or the ground; Creative keeps its stack.
  useEmpty(p) {
    const s = p.survival, inv = s.inventory, held = inv.held;
    if (held?.id !== ITEM_EMPTY_MAP) return false;
    this.store.spawn = this.spawn(); this.store.dimension = 0;
    const w = p.world, o = origin(w);
    const data = createEmptyMapData(this.store, { x: p.position.x + o[0], z: p.position.z + o[1], dimension: p.dimension | 0 });
    const filled = makeStack(ITEM_FILLED_MAP, 1, data.id), count = held.count;
    p.swing = 6;
    if (--held.count <= 0) { inv.main[inv.current] = filled; return true; }
    if (s.creative) held.count = count; // ItemInWorldManager.tryUseItem restores the size
    inv.add(filled);
    if (filled.count > 0) this.sim.items?.dropPlayer(filled, p.position, p.yaw, p.pitch); // EntityPlayer.dropPlayerItemWithRandomChoice(stack, false)
    return true;
  }

  // The player record the map rules read: native position and Minecraft yaw.
  record(p) {
    const o = origin(p.world);
    return { name: p.name, x: p.position.x + o[0], z: p.position.z + o[1], yaw: mcYaw(p.yaw), dimension: p.dimension | 0 };
  }
  // ItemMap.onUpdate for a player's main slots, then EntityPlayerMP.onUpdateEntity's packets. `out` collects the payloads by player id.
  tickPlayer(p, out) {
    const main = p.survival.inventory.main, rec = this.record(p), time = this.sim.time;
    const ctx = worldContext(p.world, p.dimension | 0, origin(p.world));
    const maps = [];
    for (let i = 0; i < main.length; i++) {
      const stack = main[i];
      if (stack?.id !== ITEM_FILLED_MAP) continue;
      const data = this.store.ensure(stack);
      packetInfo(data, p.name);
      updateVisiblePlayers(data, rec, true, time);
      if (i === p.survival.inventory.current) { updateMapData(data, ctx, rec); drainDirty(data); }
      maps.push(data);
    }
    for (const data of maps) this.send(p, data, false, out);
  }
  send(p, data, onFrame, out) {
    const bytes = mapPacket(data, packetInfo(data, p.name), onFrame);
    if (bytes) { if (!out.has(p.id)) out.set(p.id, []); out.get(p.id).push({ id: data.id, b: bytes }); }
  }
  // EntityTrackerEntry for each item frame holding a map, every 10th tick of its counter.
  tickFrames(out) {
    const d = this.sim.dimensions, lists = [[0, this.sim.vehicles?.hanging], [-1, d?.nether?.vehicles?.hanging], [1, d?.end?.n?.vehicles?.hanging]];
    for (const [dim, hanging] of lists) {
      if (!hanging) continue;
      for (const e of hanging.entities) {
        if (e.kind !== 'frame' || e.dead) continue;
        const n = this.frameTicks.get(e) ?? 0;
        this.frameTicks.set(e, n + 1);
        if (n % 10 !== 0 || e.item?.id !== ITEM_FILLED_MAP) continue;
        this.store.spawn = this.spawn();
        const data = this.store.ensure(e.item), time = this.sim.time;
        const w = dim ? d.worldOf(dim) : (d.overworld ?? this.sim.world), o = origin(w);
        for (const p of this.sim.players.values()) {
          if ((p.dimension | 0) !== dim) continue;
          const rec = this.record(p);
          packetInfo(data, p.name);
          updateVisiblePlayers(data, rec, false, time);
          updateVisiblePlayers(data, rec, true, time, { id: e.id, x: e.tx + o[0], z: e.tz + o[1], direction: e.dir });
          this.send(p, data, true, out);
        }
      }
    }
  }
  // One call per server tick.
  tick() {
    const out = new Map();
    this.store.spawn = this.spawn();
    for (const p of this.sim.players.values()) if (!p.dead) this.tickPlayer(p, out);
    this.tickFrames(out);
    for (const [id, maps] of out) { const p = this.sim.players.get(id); if (p) (p.itemsOut ??= []).push({ type: 'mapData', maps }); }
  }
}
