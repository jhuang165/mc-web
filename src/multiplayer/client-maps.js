// Batch 69 mpmaps, the client half of server-maps.js: MapData.updateMPMapData (ayi.a(byte[]), bytecode-read) for each payload of an S34 `mapData` message.
//   [0, x, y0, colours...]            the colours of column x from row y0 down (index (y0 + i) * 128 + x)
//   [1, (type << 4 | rot & 15, x, z)...]   the whole icon list replaces the decorations ("icon-<i>")
//   [2, scale]                        the map's scale
// The client store is the page's `mapStore` (what the held-map and item-frame renderers read); a map the client has not seen is created empty, as getMapData does on the client.
import { mapStore, createMapData, MAP_SIZE, MAP_BYTES } from '../maps.js';

const int = v => Number.isInteger(v) && v >= -128 && v <= 127;
export function applyMapPayload(store, id, b) {
  if (!Number.isInteger(id) || id < 0 || !Array.isArray(b) || b.length < 1 || b.length > 4 + MAP_BYTES || !b.every(int)) return false;
  let data = store.get(id);
  if (!data) { data = createMapData(id); store.set(data); }
  if (b[0] === 0) {
    if (b.length < 3) return false;
    const x = b[1] & 255, y0 = b[2] & 255;
    if (x >= MAP_SIZE) return false;
    for (let i = 0; i < b.length - 3 && (i + y0) < MAP_SIZE; i++) data.colors[(i + y0) * MAP_SIZE + x] = b[i + 3];
    if (b.length > 3) data.revision++;
    return true;
  }
  if (b[0] === 1) {
    data.decorations.clear();
    for (let i = 0; i < Math.floor((b.length - 1) / 3); i++) data.decorations.set('icon-' + i, [b[i * 3 + 1] >> 4, b[i * 3 + 2], b[i * 3 + 3], b[i * 3 + 1] & 15]);
    data.revision++;
    return true;
  }
  if (b[0] === 2) { if (b.length < 2) return false; data.scale = b[1]; return true; }
  return false;
}
// The message the server sends: every payload in order. Returns the number applied.
export function applyMapMessage(message, store = mapStore) {
  let n = 0;
  for (const m of Array.isArray(message?.maps) ? message.maps : []) if (applyMapPayload(store, m?.id, m?.b)) n++;
  return n;
}
// Joining or leaving a server: the page's store holds only what that server sent (a connected client never takes ids: mapOnCreated skips a remote store).
export function connectMaps(store = mapStore) { store.load(null); store.remote = true; }
export function disconnectMaps(store = mapStore) { store.remote = false; store.load(null); }
