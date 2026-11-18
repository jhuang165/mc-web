// Batch 79 mplanes79: the server's command block tile store (TileEntityCommandBlock data only).
// The dedicated server did not keep command block tiles, so a falling command block's TileEntityData (b78 falling78) was dropped. This is the smallest store that takes it: a map of
// cell -> { command, successCount, customName, trackOutput, lastOutput } (command-block.js newCommandBlock), saved with the dimension's tileEntities.
// Batch 80 mpcmd80: the server runs them. `installServerCommandBlocks` registers BlockCommandBlock (akb, bytecode-read) on a dimension's LiveRedstone: a rising power edge sets
// metadata bit 0 and schedules a one-tick update; updateTick runs CommandBlockLogic.func_145755_a (agp.a(ahb): successCount = ServerCommandManager.executeCommand, 0 when
// MinecraftServer.isCommandBlockEnabled is false) and then World.func_147453_f (comparators read agp.g(), the success count). The run goes through the command cart's host
// (server-cart-commands.js runCommandLogic: level 2 sender, only SERVER_COMMANDS, the commandBlockOutput rule), installed by ServerSocial as `sim.commandBlockRun`.
// The tile is described to clients as S35 action 2 (tile-sync.js): TileEntityCommandBlock.getDescriptionPacket (aox.m) writes the whole agp.a(dh) compound (Command, SuccessCount,
// CustomName, LastOutput when not null, TrackOutput). It is resent when the tracked output changes (agp.a(fj) -> aoy.e() -> World.markBlockForUpdate) and after MC|AdvCdm
// (nh: agp.a(String) then agp.e()); a run that only changes the success count sends nothing.
// Batch 81 mpcmd81: SuccessCount is the run count (z.a: one per player an @a selector matched) and the run needs no player in the dimension (server-cart-commands.js runCommandLogic).
import { newCommandBlock, normalizeLastOutput, COMMAND_BLOCK, COMMAND_BLOCK_ID } from '../command-block.js';
import { LastOutputError, translation } from '../chat-component.js';

export class CommandBlockTiles {
  constructor() { this.tiles = new Map(); }
  // The tile of a cell (created empty when missing), as installCommandBlocks' `tile`.
  tile(x, y, z) {
    const k = `${x},${y},${z}`;
    if (!this.tiles.has(k)) this.tiles.set(k, newCommandBlock());
    return this.tiles.get(k);
  }
  get(x, y, z) { return this.tiles.get(`${x},${y},${z}`) ?? null; }
  // b80 mpcmd80: BlockContainer.breakBlock removes the tile, so a new command block at the cell starts empty (DedicatedSimulation.dropTiles).
  remove(x, y, z) { this.tiles.delete(`${x},${y},${z}`); }
  values() { return [...this.tiles].map(([k, t]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, tile: t }; }); }
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

// b80 mpcmd80: BlockCommandBlock on a server dimension's LiveRedstone. `lane` is the DedicatedSimulation (Overworld) or the Nether / End state object: its tileEntities.commandBlocks
// and dirtyTiles are read at call time (the Overworld's engine never ticks inside a dimension swap). `dim` is the dimension the command runs in.
export function installServerCommandBlocks(sim, redstone, lane, dim = 0) {
  const store = () => lane.tileEntities.commandBlocks;
  redstone.registerBehaviour(COMMAND_BLOCK_ID, {
    // akb.a(ahb, III, aji): only a change of the power state writes the metadata (flag 4, no client update); the rising edge schedules tickRate 1.
    onNeighborBlockChange(w, x, y, z) {
      const powered = w.isBlockIndirectlyGettingPowered(x, y, z), meta = w.getBlockMetadata(x, y, z), was = !!(meta & 1);
      if (powered && !was) { w.setBlockMetadataWithNotify(x, y, z, meta | 1, 4); w.scheduleBlockUpdate(x, y, z, COMMAND_BLOCK_ID, 1); }
      else if (!powered && was) w.setBlockMetadataWithNotify(x, y, z, meta & ~1, 4);
    },
    // akb.a(ahb, III, Random): the tile's logic runs (a pending tick runs even after the power fell), then the comparators are told.
    updateTick(w, x, y, z) {
      const t = store().tile(x, y, z);
      if (sim.commandBlocks && sim.commandBlockRun) {
        t.outputChanged = () => lane.dirtyTiles?.add(`${x},${y},${z}`); // aoy.e(): markBlockForUpdate, the S35 goes out with this tick's cells
        try { sim.commandBlockRun(t, { x, y, z }, dim); } finally { delete t.outputChanged; }
      } else t.successCount = 0; // agp.a(ahb): enable-command-block off (the dedicated default), or no ServerSocial attached
      w.updateNeighbourForOutputSignal(x, y, z, COMMAND_BLOCK_ID);
    },
    comparator: (w, x, y, z) => store().get(x, y, z)?.successCount ?? 0, // akb.g: agp.g()
  });
}

// b80 mpcmd80: MC|AdvCdm type 0 (nh.a(iz), bytecode-read). Order: enable-command-block off -> advMode.notEnabled; the sender needs canCommandSenderUseCommand(2, "") (an op whose
// level is at least 2) and Creative, else advMode.notAllowed; the tile is looked up in the sender's own world (mw.o) and must be a TileEntityCommandBlock; then setCommand,
// func_145756_e (the S35 resend) and advMode.setCommand.success with the text. No distance check. Returns the chat component sent to the player (null when the cell is not a
// command block: nothing is said). `social` is the ServerSocial (isOp / opLevel).
export function setBlockCommand(social, id, x, y, z, command) {
  const sim = social.simulation, p = sim.players.get(id);
  if (!p || ![x, y, z].every(Number.isInteger) || typeof command !== 'string') return null;
  if (!sim.commandBlocks) return translation('advMode.notEnabled');
  if (!social.isOp(p.name) || social.opLevel(p.name) < 2 || !p.survival.creative) return translation('advMode.notAllowed');
  const dim = p.dimension | 0, state = dim ? sim.dimensions?.state(dim) : null, lane = state ? state.n ?? state : sim;
  if (!lane?.world || lane.world.get(x, y, z) !== COMMAND_BLOCK) return null;
  const t = lane.tileEntities.commandBlocks.tile(x, y, z);
  t.command = command.slice(0, 32767);
  lane.dirtyTiles?.add(`${x},${y},${z}`);
  return translation('advMode.setCommand.success', t.command);
}
