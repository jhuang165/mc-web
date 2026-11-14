// Batch 68 mpworldcmds: /setblock, /testforblock, /testfor, /setworldspawn, /playsound, /spreadplayers and /debug on the dedicated server.
//
// The single-player handlers (commands.js, commands-extra.js) run unchanged; this file gives them the server's state through host properties, as server-summon.js does for /summon.
// Native facts (bytecode-read, javap of the 1.7.10 jar, see .shared-memory/notes/mpworldcmds-b68-track.md): every one of these commands is permission level 2 except /debug (3); the
// server's operators are all level 4 here, so a plain player gets the permission message for each. CommandSetBlock bm, CommandTestForBlock bx, CommandTestFor by (only a command block
// may run it: sender instanceof CommandBlockLogic agp, else commands.testfor.failed, and a success prints nothing), CommandSetDefaultSpawnpoint bn (integer arguments, the player's
// own block when none; it sends no packet: S05 is only sent at login and respawn, oi.initializeConnectionToPlayer / respawnPlayer), CommandPlaySound bf (S29 straight to the named
// player, the 16 block / volume * 16 range of the command, the minimum volume argument), CommandSpreadPlayers br, CommandDebug ak.
// Every world access runs inside the sender's dimension (ServerDimensions.within: Overworld 0, Nether -1, End 1), so the block change, its tile entity and its drops are that world's, and
// the change reaches the clients through the world's own change map (the tick message of that dimension).
import { createCommandHost } from '../command-host.js';
import { Survival } from '../survival.js';
import { breakPlayerBlock } from '../block-break-simulation.js';
import { Profiler } from '../profiler.js';
import { profilerTick } from '../commands-extra.js';
import { collides } from '../world.js';
import { playerSpawnPoint, topSolidOrLiquidBlock } from '../world-spawn.js';

export const WORLD_COMMANDS = ['setblock', 'testforblock', 'testfor', 'setworldspawn', 'playsound', 'spreadplayers', 'debug'];

const LEAVES2 = 18;
const isTopOf = (world) => (x, y, z) => { const b = world.get(x, y, z); return b !== 5 && b !== LEAVES2 && world.solid(x, y, z); };

/**
 * WorldInfo.setSpawnPosition on the Overworld, and what reads it: a new or respawning player without a bed (EntityPlayerMP's placement around the spawn: up to 10 blocks off, onto
 * the top solid block, up while the box collides), natural spawning's 24 block exclusion, and the compass (`worldSpawn` rides in the Overworld snapshot, as S05 does at login).
 */
export function setWorldSpawn(sim, [x, y, z]) {
  const world = sim.dimensions?.overworld ?? sim.world;
  sim.worldSpawn = [x, y, z];
  const spawn = () => {
    const at = playerSpawnPoint({ spawn: [x, y, z], topSolid: (px, pz) => { const top = topSolidOrLiquidBlock(px, pz, isTopOf(world), world.height); return top < 0 ? y : top; }, collides: (cx, cy, cz) => collides(world, cx, cy, cz) });
    return world.inside(Math.floor(at.x), Math.floor(at.y), Math.floor(at.z)) ? at : { x: x + 0.5, y, z: z + 0.5 }; // the 10 block spread may leave a small finite world
  };
  world.spawn = spawn;
  for (const m of [sim.mobs?.mobs, sim.dimensions?.nether?.mobs?.mobs, sim.dimensions?.end?.n?.mobs?.mobs]) if (m) m.cachedSpawnPoint = { x, y, z }; // SpawnerAnimals reads the raw spawn
}

// One profiler per simulation (CommandDebug: MinecraftServer.enableProfiling at the next tick), fed by the tick, and the debug files a stop wrote.
function ensureDebug(sim) {
  if (sim.worldCmds) return sim.worldCmds;
  const state = sim.worldCmds = { profiler: new Profiler(), files: new Map(), debugState: { startMs: 0, startTicks: 0 } };
  const tick = sim.tick.bind(sim);
  sim.tick = () => {
    profilerTick(state.profiler);
    if (!state.profiler.enabled) return tick();
    state.profiler.start('root');
    try { return tick(); } finally { state.profiler.end(); }
  };
  return state;
}

/** The host properties of these commands for the player `p` (the sender); `forPlayer(name)` gives another player's state operations. Merge them into the command host. */
export function worldCommandsHost(sim, p, forPlayer) {
  const dim = p.dimension | 0, dims = sim.dimensions;
  const run = (fn) => (dim && dims ? dims.within(p, fn) : fn());
  const debug = ensureDebug(sim);
  // The command host over this server's live systems (command-host.js: block cells, tile entity records, the data tags), inside `run`.
  const env = () => {
    const scratch = Object.assign(new Survival({}, 'survival'), { chests: sim.tiles.chests, furnaces: sim.tiles.furnaces, dispensers: sim.tiles.dispensers, hoppers: sim.tiles.hoppers, brewing: sim.tiles.brewing, enderTiles: sim.tiles.enderTiles });
    return {
      world: () => sim.world, survival: () => sim.tiles, changed() {}, updateBlock() {},
      skulls: () => sim.tileEntities.skulls, beaconTile: (x, y, z) => sim.tileEntities.beacons.ensure(x, y, z), spawners: () => sim.tileEntities.spawners,
      // World.func_147480_a(x, y, z, true): the block breaks with its drops and the 2001 effect for everyone (no breaker). The harvest rule is the hand's (breakPlayerBlock).
      destroyBlock: (x, y, z) => {
        const state = { world: sim.world, survival: scratch, farming: sim.farming, trees: sim.trees, items: sim.itemHost, xpOrbs: sim.serverItems.xp, heldTool: 0 };
        sim.serverItems.afterBreak({ dimension: dim }, [x, y, z], () => breakPlayerBlock(state, [x, y, z], { creative: false, releaseSilverfish: (sx, sy, sz) => sim.golems.release(sx, sy, sz) }));
      },
    };
  };
  const host = (fn) => run(() => fn(createCommandHost(env())));
  return {
    setBlock(x, y, z, original, meta, mode, tag) {
      return run(() => {
        const base = createCommandHost(env()), out = base.setBlock(x, y, z, original, meta, mode, tag);
        this.ignoredTagKeys = base.ignoredTagKeys; // the handler reads the notice from the host
        if (out === true) sim.tileChanged(x, y, z); // the tile entity's description (S35 / S33) rides with the cell change
        return out;
      });
    },
    blockAt: (x, y, z) => host((h) => h.blockAt(x, y, z)),
    tileAt: (x, y, z) => host((h) => h.tileAt(x, y, z)),
    // Position.func_111092_a over the sender's dimension: the first non-air block from y 255 down, plus one; 257 over an empty column.
    topY: (x, z) => run(() => { const w = sim.world, xi = Math.floor(x), zi = Math.floor(z); if (!w.inside(xi, 0, zi)) return 257; for (let y = 255; y > 0; y--) if (w.get(xi, y, zi)) return y + 1; return 257; }),
    teamOf: (name) => sim.scoreboard?.teamOf?.(name) ?? null,
    teleportPlayer: (name, x, y, z) => forPlayer(name).teleport(x, y, z),
    setWorldSpawn: (x, y, z) => setWorldSpawn(sim, [x, y, z]),
    // S29 to the named player alone, whatever the distance (the command did the range check).
    playSound(name, x, y, z, volume, pitch, target) {
      const o = [...sim.players.values()].find((q) => q.name.toLowerCase() === String(target).toLowerCase());
      if (o) (o.soundsOut ??= []).push({ name, x, y, z, volume, pitch });
    },
    get profiler() { return debug.profiler; },
    get debugState() { return debug.debugState; },
    tickCounter: () => sim.ticks,
    saveFile: (name, text) => { debug.files.set(name, text); sim.saveDebugFile?.(name, text); },
  };
}
