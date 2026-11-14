// Batch 73 streamfix73: the client's tile entities go with their column.
// Bytecode-read (javap on the unchanged jar): NetHandlerPlayClient S21 -> WorldClient.doPreChunk(x, z, false) -> ChunkProviderClient.unloadChunk -> Chunk.onChunkUnload (apx.d()), which calls
// World.func_147457_a-style removal (`World.a(aor)`, markTileEntityForRemoval) for every tile entity of the column and unloadEntities for its entity lists. A later S26 for the same column
// builds a new chunk and the S35 / S33 descriptions (describeTiles, riding in `chunkBulk.tiles`) re-create the tile entities that send one; a chest has no description natively, the port's
// `contChest` row stands in for the block-made chest tile (tile-sync.js).
// `columns`: Set of "cx,cz" local column keys. `stores`: { signs, skulls, beacons, spawners, chests, enders, pistons } (the replica's maps; any may be absent). Returns the number of tiles removed.
const inColumns = (columns, x, z) => columns.has(`${x >> 4},${z >> 4}`);
export function dropTilesIn(columns, stores = {}) {
  let n = 0;
  const sweep = (map, pos) => { if (map?.delete) for (const [k, t] of [...map]) { const p = pos(k, t); if (p && inColumns(columns, p[0], p[2])) { map.delete(k); n++; } } };
  const keyPos = k => k.split(',').map(Number);
  for (const store of [stores.signs, stores.skulls, stores.beacons]) sweep(store?.tiles, (k, t) => [t.x, t.y, t.z]);
  sweep(stores.spawners?.spawners, (k, t) => [t.x, t.y, t.z]);
  sweepObject(stores.chests, keyPos, columns, () => n++);
  sweepObject(stores.enders, keyPos, columns, () => n++);
  sweep(stores.pistons?.tiles, (k, t) => [t.x, t.y, t.z]);
  return n;
}
function sweepObject(obj, keyPos, columns, hit) {
  if (!obj) return;
  for (const k of Object.keys(obj)) { const [x, , z] = keyPos(k); if (inColumns(columns, x, z)) { delete obj[k]; hit(); } }
}
