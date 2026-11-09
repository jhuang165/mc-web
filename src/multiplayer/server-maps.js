// Maps on the gun server (not 1.7.10 networking): the world's one MapStorage (maps.js mapStore, saved with the server) holds every
// map; an empty map used here becomes a filled one (ItemEmptyMap.onItemRightClick), and each tick every filled map a player
// carries runs ItemMap.onUpdate: MapData.updateVisiblePlayers for its markers and, in the selected slot, updateMapData for the
// terrain around that player. A tab gets the maps in its own inventory as the columns that changed since it last saw them and
// the current markers (S34PacketMaps carries one column range at a time in 1.7.10).
import { ITEM_FILLED_MAP, ITEM_EMPTY_MAP, MAP_SIZE, mapStore, createEmptyMapData, updateMapData, updateVisiblePlayers } from '../maps.js';
import { worldContext } from '../maps-clock-live.js';

const MAX_FULL = 2; // whole maps sent to one tab in a tick; the rest follow on the next ticks
const mcYaw = yaw => ((Math.PI - yaw) * 180) / Math.PI; // dimension-live.js mcYaw: the tab's radians as Entity.rotationYaw
const encode = bytes => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');

export class ServerMaps {
  constructor(sim, saved = null) {
    this.sim = sim;
    mapStore.load(saved); // one gun world per server process
    const s = sim.worldSpawn?.() ?? { x: 0, z: 0 };
    mapStore.spawn = { x: Math.floor(s.x), z: Math.floor(s.z) };
    mapStore.dimension = 0;
  }
  // ItemEmptyMap.onItemRightClick (player-edit-simulation.js state.maps): a scale 0 map centred near the player.
  useEmptyMap(state) {
    const s = state.survival, p = state.position;
    const data = createEmptyMapData(mapStore, { x: p.x, z: p.z, dimension: 0 });
    if (!s.creative) s.take(ITEM_EMPTY_MAP);
    const left = s.add(ITEM_FILLED_MAP, 1, data.id);
    return { data, stored: left };
  }
  // Every carried filled map's markers, and the terrain around each player for the map in its selected slot. A player marker is
  // dropped from a map that its player no longer carries (MapData.updateVisiblePlayers walks every MapInfo).
  tick() {
    const sim = this.sim, ctx = worldContext(sim.world, 0), holders = new Map();
    for (const p of sim.players.values()) {
      if (p.dead || sim.frozen?.(p)) continue;
      const s = p.survival, held = s.held, player = { name: p.name, x: p.position.x, z: p.position.z, yaw: mcYaw(p.yaw), dimension: 0 };
      for (const stack of s.inventory.main) {
        if (stack?.id !== ITEM_FILLED_MAP) continue;
        const data = mapStore.ensure(stack); // a map with no data (a /give) is made around the spawn, as ItemMap.getMapData does
        if (!holders.has(data)) holders.set(data, new Set());
        holders.get(data).add(p.name);
        updateVisiblePlayers(data, player, true, sim.time);
        if (stack === held) updateMapData(data, ctx, player);
      }
    }
    // EntityTrackerEntry.sendLocationToAllClients: every 10 ticks a frame holding a map runs MapData.updateVisiblePlayers for each
    // player tracking it. The stack is on a frame: a player not carrying that map loses its marker; the "frame-<id>" marker is added.
    if (sim.hanging && sim.ticks % 10 === 0) {
      for (const p of sim.players.values()) {
        if (p.dead) continue;
        const player = { name: p.name, x: p.position.x, z: p.position.z, yaw: mcYaw(p.yaw), dimension: 0 };
        for (const e of sim.hanging.framesNear(p, ITEM_FILLED_MAP)) {
          const data = mapStore.get(e.item.damage | 0);
          if (!data) continue;
          if (!holders.get(data)?.has(p.name)) updateVisiblePlayers(data, player, false, sim.time);
          updateVisiblePlayers(data, player, true, sim.time, { id: e.id, x: e.tx, z: e.tz, direction: e.dir });
        }
      }
    }
    for (const data of mapStore.maps.values()) {
      if (!data.decorations.size) continue;
      const names = holders.get(data);
      for (const key of [...data.decorations.keys()]) if (!key.startsWith("frame-") && !names?.has(key)) data.decorations.delete(key);
    }
  }
  // The maps player p carries, and those in the frames near it, that changed since its tab last got them:
  // { id, scale, x, z, dim, cols: [[x, lo, base64]], deco }.
  // `cols` holds each changed column's range of colour bytes (the rows lo..lo + n - 1); `deco` all current markers.
  rows(p) {
    const sent = p.sentMaps ??= new Map(), out = [], ids = new Set();
    let full = 0;
    const framed = this.sim.hanging?.framesNear(p, ITEM_FILLED_MAP).map(e => e.item) ?? [];
    for (const stack of [...p.survival.inventory.main, p.survival.inventory.cursor, ...framed]) {
      if (stack?.id !== ITEM_FILLED_MAP) continue;
      const data = mapStore.get(stack.damage | 0);
      if (!data || ids.has(data.id)) continue;
      ids.add(data.id);
      let last = sent.get(data.id);
      if (!last || last.scale !== data.scale || last.xCenter !== data.xCenter || last.zCenter !== data.zCenter) {
        if (full >= MAX_FULL) continue;
        full++;
        last = { colors: new Int8Array(MAP_SIZE * MAP_SIZE), scale: data.scale, xCenter: data.xCenter, zCenter: data.zCenter, deco: '', revision: -1, fresh: true };
        sent.set(data.id, last);
      }
      // The colours are compared only after a change (MapData.setColumnDirty bumps the revision); the markers every tick, since
      // they move without one.
      const cols = [];
      if (last.revision !== data.revision) for (let x = 0; x < MAP_SIZE; x++) {
        let lo = -1, hi = -1;
        for (let z = 0; z < MAP_SIZE; z++) if (data.colors[x + z * MAP_SIZE] !== last.colors[x + z * MAP_SIZE]) { if (lo < 0) lo = z; hi = z; }
        if (lo < 0) continue;
        const bytes = new Int8Array(hi - lo + 1);
        for (let z = lo; z <= hi; z++) bytes[z - lo] = last.colors[x + z * MAP_SIZE] = data.colors[x + z * MAP_SIZE];
        cols.push([x, lo, encode(bytes)]);
      }
      const deco = [...data.decorations.values()].map(d => [...d]), key = JSON.stringify(deco);
      last.revision = data.revision;
      if (!cols.length && key === last.deco && !last.fresh) continue;
      last.deco = key; last.fresh = false;
      out.push({ id: data.id, scale: data.scale, x: data.xCenter, z: data.zCenter, dim: data.dimension, cols, deco });
    }
    for (const id of sent.keys()) if (!ids.has(id)) sent.delete(id); // a map put away is sent whole again when it comes back
    return out;
  }
  save() { return mapStore.toJSON(); }
}
