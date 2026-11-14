// Batch 66 mppistons, client half (server-pistons.js): the moving piston blocks of a dedicated server.
//
// The native client replays BlockPistonBase.onBlockEventReceived on S24 and builds its own TileEntityPiston; here the server sends the new tiles' fields
// (`pistonTiles` message, `tiles`) and the client steps them the way TileEntityPiston.updateEntity does (progress + 0.5 per tick, the tick after
// progress 1 removes it), then draws them with piston-live.js movingParts through scene.setMovingBlocks. The block cells themselves arrive as ordinary cell
// changes; a cell that changes to anything but the moving block ends its tile at once (TileEntityPiston.clearPistonTileEntity).
// The player's own push arrives in the server's position stream, so nothing is pushed here.
import { movingParts } from '../piston-live.js';
import { pistonTile } from '../redstone.js';
import { fromOriginal } from '../block-registry.js';
import { PISTON_MOVING } from '../world.js';

const f32 = Math.fround;
const num = (...v) => v.every(Number.isFinite);

export class ClientPistons {
  constructor({ scene = null, world = null, sound = null } = {}) {
    this.scene = scene; this.world = world; this.sound = sound;
    this.tiles = new Map(); // "x,y,z" -> pistonTile
    this.events = []; // the S24 events seen (x, y, z, block, event, facing), newest last, for diagnostics
  }
  // The `pistonTiles` message.
  apply(m) {
    for (const e of m?.events ?? []) if (Array.isArray(e) && num(...e.slice(0, 6))) { this.events.push(e); if (this.events.length > 64) this.events.shift(); }
    for (const t of m?.tiles ?? []) {
      if (!Array.isArray(t) || !num(...t.slice(0, 6)) || t[5] < 0 || t[5] > 5) continue;
      const tile = pistonTile(t[3], t[4], t[5], !!t[6], !!t[7]);
      Object.assign(tile, { x: t[0], y: t[1], z: t[2], world: true, progress: f32(t[8]), lastProgress: f32(t[9]) });
      this.tiles.set(`${t[0]},${t[1]},${t[2]}`, tile);
    }
  }
  // Once per tick message, before the tick's own `pistonTiles`: the cells that changed, then TileEntityPiston.updateEntity for every tile.
  tick(changes = []) {
    for (const c of changes ?? []) if (Array.isArray(c) && c[3] !== PISTON_MOVING) this.tiles.delete(`${c[0]},${c[1]},${c[2]}`);
    for (const [key, t] of this.tiles) {
      t.lastProgress = t.progress;
      if (t.lastProgress >= 1) { this.tiles.delete(key); continue; }
      t.progress = Math.min(1, t.progress + 0.5);
    }
  }
  // The parts for this frame; hands them to the scene. Called every frame while connected.
  frame(partial = 0) {
    const list = [];
    for (const t of this.tiles.values()) {
      const parts = movingParts(t, partial, fromOriginal);
      if (parts.length) list.push({ x: t.x, y: t.y, z: t.z, parts });
    }
    this.scene?.setMovingBlocks?.(list);
    return list;
  }
  clear() { this.tiles.clear(); this.scene?.setMovingBlocks?.([]); }
}
