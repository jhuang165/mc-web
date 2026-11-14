// Batch 66 mppistons: pistons on the dedicated server.
//
// The block rules (BlockPistonBase, the 12 block limit, immovable blocks and tile entities, sticky pull, TileEntityPiston progress of 0.5 per tick) are
// the shared redstone engine's (src/redstone.js, run by LiveRedstone on the server world); this module adds what the server lacked:
//   * entity pushes: src/piston-live.js installPistons gives the TileEntityPiston.func_145863_a loop its entities, here the dimension's players
//     (pushed with the single-player player push, piston-push.js pushPlayer, on the server's own position; the position stream carries the result to
//     the client, as every other server-side move of a player), mobs (EntityWorld.pushMove), dropped items, experience orbs, primed TNT, falling blocks;
//   * S24 block action for the piston event (bytecode-read WorldServer.sendQueuedBlockEvents: sent only when onBlockEventReceived returned true, to the players
//     within 64.0 of the block, raw integer coordinates) as the `pistonTiles` message's `events`;
//   * the moving block: the client builds its TileEntityPiston from the server's description (`tiles`: the NBT fields plus renderHead and the progress at the
//     end of the tick); see client-pistons.js;
//   * tile.piston.out / tile.piston.in through the S29 sound queue (range 16).
// Wire message: `pistonTiles` { events: [[x, y, z, originalBlockId, event, facing]], tiles: [[x, y, z, block, meta, facing, extending, renderHead, progress, lastProgress]] }.
import { installPistons, ORIGINAL_PISTON, ORIGINAL_STICKY } from '../piston-live.js';
import { pistonPushExtras, pushPlayer } from '../piston-push.js';
import { PHYSICS } from '../world.js';

const RANGE = 64; // PlayerManager range of S24 (sendToAllNear 64.0)
const isPistonSound = name => name === 'tile.piston.out' || name === 'tile.piston.in';

// `ctx`: { redstone, world, dim, sim, mobs(), items(), xp(), dispense(), falling() } (getters: the Nether's systems are swapped in while it ticks).
export class ServerPistons {
  constructor(ctx) {
    this.ctx = ctx;
    const { redstone, world, sim } = ctx;
    this.events = []; this.fresh = [];
    const here = () => [...sim.players.values()].filter(p => (p.dimension | 0) === ctx.dim && !p.dead && !sim.vehicles?.riding?.(p));
    const game = {
      items: () => ctx.items()?.items, itemSystem: () => ctx.items(), orbs: () => ctx.xp()?.orbs, orbSystem: () => ctx.xp(),
      primed: () => ctx.dispense()?.primed, falling: () => ctx.falling()?.entities, player: () => null, mobs: () => null,
    };
    const players = () => here().map(p => {
      const adapter = {
        position: p.position, velocity: p.velocity, motion: p.motion, flying: p.flying, width: PHYSICS.width, height: PHYSICS.height,
        get onGround() { return p.grounded; }, set onGround(v) { p.grounded = v; },
        get collidedH() { return p.collidedH; }, set collidedH(v) { p.collidedH = v; },
        get fallDistance() { return p.fallDistance; }, set fallDistance(v) { p.fallDistance = v; },
      };
      const x = p.position.x, y = p.position.y, z = p.position.z, w = PHYSICS.width / 2;
      return { box: [x - w, y, z - w, x + w, y + PHYSICS.height, z + w], entity: p, move: (dx, dy, dz) => { pushPlayer(world, adapter, dx, dy, dz); } };
    });
    this.pistons = installPistons({
      redstone, world,
      entities: { mobs: () => ctx.mobs()?.mobs, extra: () => [...players(), ...pistonPushExtras(world, game)] },
    });
    // S24: BlockPistonBase.onBlockEventReceived answered true.
    for (const id of [ORIGINAL_PISTON, ORIGINAL_STICKY]) {
      const b = redstone.behaviours[id], original = b?.onBlockEventReceived;
      if (!original) continue;
      redstone.behaviours[id] = { ...b, onBlockEventReceived: (w, x, y, z, event, facing) => {
        const r = original.call(b, w, x, y, z, event, facing);
        if (r) this.events.push([x, y, z, id, event, facing]);
        return r;
      } };
    }
    // TileEntityPiston creation (BlockPistonBase makes them, BlockPistonMoving.func_149962_a).
    const setTile = redstone.setTileEntity.bind(redstone);
    redstone.setTileEntity = (x, y, z, te) => { const r = setTile(x, y, z, te); if (te?.kind === 'piston') this.fresh.push(te); return r; };
    // tile.piston.out / tile.piston.in to the S29 queue (volume 0.5, range 16); the engine's other sounds stay as they were.
    const sound = redstone.hooks.sound;
    redstone.hooks.sound = (name, x, y, z, volume, pitch) => {
      if (isPistonSound(name)) sim.soundsOut.push({ name, x, y, z, volume, pitch, except: null, dim: ctx.dim });
      else sound?.(name, x, y, z, volume, pitch);
    };
  }
  // End of the dimension's tick: each player in range gets the events and the new moving blocks.
  flush() {
    const events = this.events.splice(0), fresh = this.fresh.splice(0).filter(t => !t.invalid && t.world);
    if (!events.length && !fresh.length) return;
    const tiles = fresh.map(t => [t.x, t.y, t.z, t.block, t.meta, t.facing, t.extending ? 1 : 0, t.renderHead ? 1 : 0, t.progress, t.lastProgress]);
    const near = (p, x, y, z) => { const dx = x - p.position.x, dy = y - p.position.y, dz = z - p.position.z; return dx * dx + dy * dy + dz * dz < RANGE * RANGE; };
    for (const p of this.ctx.sim.players.values()) {
      if ((p.dimension | 0) !== this.ctx.dim) continue;
      const e = events.filter(v => near(p, v[0], v[1], v[2])), t = tiles.filter(v => near(p, v[0], v[1], v[2]));
      if (e.length || t.length) (p.pistonOut ??= []).push({ type: 'pistonTiles', events: e, tiles: t });
    }
  }
}
