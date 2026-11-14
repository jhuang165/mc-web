// Batch 71 mpchunks: the client half of the server's view distance (server-chunk-view.js).
// Native client (bytecode-read, S01 `hd`): the join packet carries entity id, game type, dimension, difficulty, max players and level type, NOT the view distance, so the 1.7.10
// client never learns it: it simply loads the chunks it is sent (S26) and drops the ones the server unloads (S21 with ground-up true and mask 0). The welcome `viewDistance` field of
// this port is not native and nothing reads it. This module does the same on the finite replica: a column the server has not sent (or has unloaded) is blank air
// (`world.absentColumns` holds their keys), a `chunkBulk` fills columns, a `chunkUnload` blanks them, and the scene's light volume and meshes around them are refreshed.
// Wire: `chunkBulk` { columns: [{ x, z, runs }], tiles? } and `chunkUnload` { columns: [[x, z]] }; x / z are the replica's column coordinates. Block changes for an absent column are dropped
// (PlayerInstance only sends to the players watching the chunk); the column itself carries the current state when it arrives.
import { decodeColumn } from './protocol.js';

const keyOf = (x, z) => `${x},${z}`;
const blank = column => { column.blocks.fill(0); column.meta.fill(0); column.tickCounts = null; };

// Restores the columns of a snapshot into a fresh replica world; every column the snapshot does not hold is blanked and recorded as absent.
export function restoreColumns(world, snapshot, blockCount) {
  const subset = snapshot.chunkView === true;
  if (!subset && snapshot.columns.length !== world.chunks.size) throw new Error('Unsupported multiplayer world');
  const seen = new Set();
  for (const packet of snapshot.columns) {
    const key = keyOf(packet.x, packet.z), column = world.chunks.get(key);
    if (!column || seen.has(key)) throw new Error('Invalid multiplayer column');
    decodeColumn(packet, column, blockCount); seen.add(key);
  }
  if (seen.size !== world.chunks.size) {
    world.absentColumns = new Set();
    for (const [key, column] of world.chunks) if (!seen.has(key)) { blank(column); world.absentColumns.add(key); }
  }
  return world;
}

// A tick's cells that fall into an absent column are dropped.
export const presentCells = (world, changes) => world.absentColumns?.size ? changes.filter(c => !world.absentColumns.has(keyOf(c[0] >> 4, c[2] >> 4))) : changes;

// Light and meshes of the 3 x 3 columns around (x, z) after the column changed.
function refresh(scene, world, x, z) {
  if (!scene) return;
  const light = scene.light;
  if (light?.column && light.relight && !light.native) {
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) light.column(x * 16 + a, z * 16 + b);
    const size = light.size ?? 128, box = light.relight(Math.max(0, x * 16 - 15), Math.min(size - 1, x * 16 + 30), Math.max(0, z * 16 - 15), Math.min(size - 1, z * 16 + 30));
    if (box) for (let a = Math.floor((box.x0 - 1) / 16); a <= Math.floor((box.x1 + 1) / 16); a++) for (let b = Math.floor((box.z0 - 1) / 16); b <= Math.floor((box.z1 + 1) / 16); b++) scene.dirty?.add(keyOf(a * 16, b * 16));
  }
  for (let a = x - 1; a <= x + 1; a++) for (let b = z - 1; b <= z + 1; b++) if (world.chunks.has(keyOf(a, b))) scene.dirty?.add(keyOf(a * 16, b * 16));
}

// `host`: { world, scene, tiles(list) }. S26 fills columns, S21 (empty) blanks them.
export function applyChunkMessage(message, host) {
  const { world } = host;
  if (message.type === 'chunkUnload') {
    const gone = new Set();
    for (const [x, z] of message.columns ?? []) {
      const column = world.chunks.get(keyOf(x, z));
      if (!column) continue;
      blank(column); (world.absentColumns ??= new Set()).add(keyOf(x, z)); gone.add(keyOf(x, z));
      refresh(host.scene, world, x, z);
    }
    // b72 mpstream72: Chunk.onChunkUnload (bytecode-read, bjd.b(II) -> apx.d()) hands the column's entities to World.unloadEntities: the client copies in it are gone, the server's tracker
    // entry is not told (it ends by range). `host.entities` removes the mob and vehicle copies; items and orbs ride the per-tick list the server cuts to sent columns.
    if (gone.size) { host.entities?.(gone); host.dropTiles?.(gone); } // b73 streamfix73: tile entities too (client-tiles.js)
  } else if (message.type === 'chunkBulk') {
    for (const packet of message.columns ?? []) {
      const key = keyOf(packet.x, packet.z), column = world.chunks.get(key);
      if (!column) continue;
      decodeColumn(packet, column, host.blockCount ?? 256); world.absentColumns?.delete(key);
      refresh(host.scene, world, packet.x, packet.z);
    }
    if (message.tiles?.length) host.tiles?.(message.tiles);
  }
}
