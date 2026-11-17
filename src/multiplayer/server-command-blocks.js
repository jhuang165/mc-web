// Batch 79 mplanes79: the server's command block tile store (TileEntityCommandBlock data only).
// The dedicated server did not keep command block tiles, so a falling command block's TileEntityData (b78 falling78) was dropped. This is the smallest store that takes it: a map of
// cell -> { command, successCount, customName, trackOutput, lastOutput } (command-block.js newCommandBlock), saved with the dimension's tileEntities. The server does not run
// command blocks from it (enable-command-block blocks are the command block carts', server-mobs.js); the data is kept and saved so the block's tile is not lost when it lands.
import { newCommandBlock, normalizeLastOutput, COMMAND_BLOCK } from '../command-block.js';
import { LastOutputError } from '../chat-component.js';

export class CommandBlockTiles {
  constructor() { this.tiles = new Map(); }
  // The tile of a cell (created empty when missing), as installCommandBlocks' `tile`.
  tile(x, y, z) {
    const k = `${x},${y},${z}`;
    if (!this.tiles.has(k)) this.tiles.set(k, newCommandBlock());
    return this.tiles.get(k);
  }
  get(x, y, z) { return this.tiles.get(`${x},${y},${z}`) ?? null; }
  // Only cells that still hold a command block are saved (BlockContainer.breakBlock removes the tile).
  toJSON(world = null) {
    const out = [];
    for (const [k, value] of this.tiles) { const [x, y, z] = k.split(',').map(Number); if (!world || world.get(x, y, z) === COMMAND_BLOCK) out.push({ x, y, z, ...value }); }
    return out;
  }
  static fromJSON(records) {
    const s = new CommandBlockTiles();
    for (const e of Array.isArray(records) ? records : []) {
      if (![e?.x, e?.y, e?.z].every(Number.isInteger)) continue;
      const { x, y, z, ...value } = e;
      try { s.tiles.set(`${x},${y},${z}`, { ...newCommandBlock(), ...value, lastOutput: normalizeLastOutput(value.lastOutput) }); } catch (err) { if (!(err instanceof LastOutputError)) throw err; }
    }
    return s;
  }
}
