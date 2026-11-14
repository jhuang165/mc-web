// Batch 63 mpend: the End on the dedicated multiplayer server.
//
// ServerDimensions (server-dimensions.js) owns the player's dimension, the world swap (`within` / `swap`), the trip (`arrive`) and the per-dimension tick message; it asks this module for
// everything that is only the End's. What is here, and the evidence behind it:
//   * The End world, built on first use: a finite 128 x 128 world (client-dimensions.js FiniteDimensionWorld, dimension 1) filled from the single-player End generator
//     (DimensionWorld.endChunk: ChunkProviderEnd density, ores, spikes; end-reference.json evidence). The light volume of this port is a 128 x 128 grid, so the replica holds the window
//     x -25..102, z -96..31 of the End, stored shifted by END_OFFSET: the native spawn platform (100, 49, 0) lies inside it.
//   * Its systems are the Nether's (server-nether.js builds them for any dimension through `n.dim`): fluids, fire, falling blocks, random ticks, redstone, containers, light, projectiles and
//     a second ServerMobs. The End's natural spawn list (BiomeGenEnd: enderman only, spawn-lists.js biome 9) comes from EntityWorld because the world's dimension is 1. Saved like the Nether.
//   * Travel (ServerConfigurationManager.transferEntityToWorld, EntityPlayerMP.travelToDimension, bytecode-read in the earlier tracks and in dimensions.js):
//       - ItemEnderEye.onItemUse on a frame without an eye sets the eye bit (flag 2), takes the eye outside Creative and runs the ring check; a complete ring of twelve eyed frames turns the
//         nine interior cells into end portal (eye-of-ender.js useEyeOnFrame, executed against the original in eye-of-ender-reference.json).
//       - BlockEndPortal.onEntityCollidedWithBlock sends a player that rides nothing to dimension 1 (or back to 0 from the End) at once: no portal timer and no creative shortcut.
//       - To the End the Teleporter builds the 5 x 5 obsidian platform under three layers of air at the End's entrance (100, 50, 0) and the player stands on it, facing yaw 90.
//       - From the End the player is respawned in the Overworld at their spawn point (bed or /spawnpoint) or the world spawn. Achievements (pc.C theEnd on entering, pc.D theEnd2 on the way
//         back through the exit portal) follow the single-player trips (main.js: transit.exit gives theEnd2).
//   * The exit portal is the dying dragon's (server-dragon.js, dragon-mobs.js host.portal); the dragon and crystals are made with the End (b64 mpdragon). Leaving through it shows the credits.
//   * Not here: a flying eye of ender, End projectiles in the save. (XP orbs: since the b63 merge the End has its own, as the Nether.)
import { DimensionWorld } from '../dimension-world.js';
import { Rails } from '../rails.js';
import { Torches } from '../torches.js';
import { Doors } from '../doors-panes.js';
import { Beds } from '../bed.js';
import { ItemEntities } from '../item-entities.js';
import { ExperienceOrbs } from '../experience.js'; // b63 lead: the End's own orbs (mpnether3's per-dimension orbs)
import { fromOriginal } from '../block-registry.js';
import { createExitPortal } from '../exit-portal.js';
import { ITEM_EYE_OF_ENDER, END_PORTAL_FRAME, useEyeOnFrame, hasEye } from '../eye-of-ender.js';
import { GAME_IDS, transferTarget } from '../dimensions.js';
import { FiniteDimensionWorld, END } from './client-dimensions.js';
import { buildNetherSystems, buildNetherInside, saveNether } from './server-nether.js';
import { setupEnd, dragonState } from './server-dragon.js'; // b64 mpdragon: the dragon, the crystals, the fight's state

const OVERWORLD = 0, END_PORTAL = GAME_IDS.endPortal, noop = () => {};
// b65 mpendwindow: the replica's own origin says where it lies in the End (native = local + origin), for the 256 window and for a 0.93.0 save's 128 window alike.
const toLocalIn = (world, x, z) => [x - world.originX, z - world.originZ];

// The End's terrain into the finite world, shifted by the world's origin. A generated chunk holds (lx * 16 + lz) * 256 + y; a column of 256 cells moves as one run.
export function fillEnd(world, seed) { // returns the generator (its spikes' crystals are collected from it)
  const source = new DimensionWorld(seed, END), size = world.size;
  for (let cx = Math.floor(world.originX / 16); cx <= Math.floor((size - 1 + world.originX) / 16); cx++) {
    for (let cz = Math.floor(world.originZ / 16); cz <= Math.floor((size - 1 + world.originZ) / 16); cz++) {
      const made = source.generateTerrainChunk(cx, cz);
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
        const [tx, tz] = toLocalIn(world, cx * 16 + lx, cz * 16 + lz);
        if (tx < 0 || tx >= size || tz < 0 || tz >= size) continue;
        const column = world.chunks.get(`${tx >> 4},${tz >> 4}`), from = (lx * 16 + lz) * 256, to = ((tx & 15) * 16 + (tz & 15)) * 256;
        column.blocks.set(made.blocks.subarray(from, from + 256), to); column.meta.set(made.metadata.subarray(from, from + 256), to);
      }
    }
  }
  return source;
}

// EntityDragon.createEnderPortal on the End's world (original ids mapped to this port's blocks); the cells are edits of the world like any other.
export function buildExitPortal(world, centerX = 0, centerZ = 0) {
  const [cx, cz] = toLocalIn(world, centerX, centerZ);
  createExitPortal({ setBlock(x, y, z, id) { const m = id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, 0); if (m) world.set(x, y, z, m.id, true, m.meta); } }, cx, cz);
}

export class ServerEnd {
  constructor(dims) { this.dims = dims; this.n = null; }
  get active() { return !!this.n; }
  // The End, built on first use (about a second once; the tick that needs it waits).
  ensure() {
    if (this.n) return this.n;
    const dims = this.dims, sim = dims.sim, saved = dims.saved.end ?? {};
    // b65 mpendwindow: a new End is the 256 x 256 window; an End saved by 0.93.0 (no `window` field) is read as the 128 x 128 window it was stored in.
    const window = !dims.saved.end || saved.window === 'full' ? 'full' : 'legacy', world = new FiniteDimensionWorld(sim.world.seed, END, window);
    const source = fillEnd(world, sim.world.seed);
    // b64 mpdragon: the exit portal is the dying dragon's (server-dragon.js); b63's stand-in built at the origin is gone. An End saved by b63 keeps that portal in its edits and has no
    // `dragon` field: its fight counts as over.
    const fresh = !dims.saved.end;
    const edits = Array.isArray(saved.edits) ? saved.edits : [];
    for (let i = 0; i < edits.length; i += 100000) world.restore(edits.slice(i, i + 100000));
    const n = { dim: END, world, changes: new Map(), items: new ItemEntities(), itemsSent: 0, dirtyTiles: new Set(), xp: new ExperienceOrbs(saved.xpOrbs), taken: [], overMobs: dims.mobsOf(OVERWORLD) };
    n.items.joined = e => { e.eid = ++sim.nextItemId; };
    buildNetherSystems(sim, n, {}, saved); // the generic part of the Nether's systems (no fortress list: no `source.provider`)
    const put = world.put.bind(world);
    world.put = (x, y, z, b, m = 0, track = true) => {
      const old = world.get(x, y, z), meta = world.getMeta(x, y, z), result = put(x, y, z, b, m, track);
      if (result && (old !== b || meta !== m)) n.changes.set(`${x},${y},${z}`, [x, y, z, b, m]);
      return result;
    };
    const drop = (...a) => sim.serverItems.stacksDrop(...a);
    for (const System of [Rails, Torches, Doors, Beds]) new System(world, { drop, apply: noop }).watch();
    this.n = n;
    dims.swap(n, () => buildNetherInside(sim, n, saved));
    setupEnd(n, source, fresh); // b64 mpdragon: crystals and the dragon of a new End; the fight's centre and portal clamp for every End
    dims.sim.dispense?.adopt?.(n.dispense); // b64 mpend2: saved End arrows, balls and potions (the Overworld's stand-in lane for dimension 1) move to the End's own instance
    return n;
  }
  // A player saved in the End comes back to it (ServerDimensions.adopt).
  adopt(p) { const n = this.ensure(); p.world = n.world; p.dimension = END; n.overMobs.removePlayer(p.id); n.mobs.addPlayer(p); return n; }
  // What the End adds to the save.
  saveField() { const n = this.n; return n ? { window: n.world.endWindow, edits: [...n.world.edits], ...saveNether(n), dragon: dragonState(n) } : (this.dims.saved.end ?? null); }

  // ---- travel ----
  // BlockEndPortal.onEntityCollidedWithBlock: the player's box overlaps an end portal cell (Entity.doBlockCollisions: the box shrunk by 0.001). Returns true when a trip was made.
  checkPortal(p) {
    const w = p.world, at = p.position, hw = 0.3 - 0.001;
    if (p.mount) return false; // ridingEntity == null && riddenByEntity == null
    for (let x = Math.floor(at.x - hw); x <= Math.floor(at.x + hw); x++) for (let z = Math.floor(at.z - hw); z <= Math.floor(at.z + hw); z++) for (let y = Math.floor(at.y + 0.001); y <= Math.floor(at.y + 1.8 - 0.001); y++) {
      if (w.get(x, y, z) !== END_PORTAL) continue;
      if (p.dimension === END) return this.conquer(p);
      return this.dims.arrive(p, END);
    }
    return false;
  }
  // b64 mpdragon: EntityPlayerMP.travelToDimension(1) inside the End (bytecode-read earlier, dimensions.js): theEnd2 (pc.D), S2B game state 4 (the credits) and the player waits in
  // the End until the client's C16 perform respawn (`finishCredits`, through ServerSurvival.respawn). The message is `dragonCredits`; the client answers with its usual `respawn`.
  // Natively every trip through the exit portal shows the credits (recalled: the first-time-only rule is a later version).
  conquer(p) {
    if (p.conquered) return true;
    p.conquered = true;
    this.dims.sim.achievements.award(p, 'theEnd2');
    (p.dimOut ??= []).push({ type: 'dragonCredits', reason: 4 });
    return true;
  }
  finishCredits(p) { p.conquered = false; return this.dims.arrive(p, OVERWORLD, { at: this.exitSpot(p) }); }
  // The respawn after the End: the bed (or /spawnpoint) in the Overworld, else the world spawn.
  exitSpot(p) {
    if (p.spawnpoint) return { x: p.spawnpoint[0] + 0.5, y: p.spawnpoint[1], z: p.spawnpoint[2] + 0.5 };
    return this.dims.overworld.spawn();
  }
  // transferEntityToWorld into the End: the entity goes to the entrance (100, 50, 0) (in the window's coordinates) and the Teleporter builds the platform there, in the End's own context.
  place(e, from, yaw) {
    const tt = transferTarget(from, END, 0, 0, 0, yaw), [x, z] = toLocalIn(this.ensure().world, tt.x, tt.z);
    Object.assign(e, { x, y: tt.y, z, yaw: tt.yaw });
    this.dims.swap(this.ensure(), () => this.dims.teleporterFor(END).placeInPortal(e, e.x, e.y, e.z, e.yaw));
  }
  // EntityPlayerMP.travelToDimension: theEnd (pc.C) on entering the End, theEnd2 (pc.D) when the exit portal takes the player out. True when the trip was one of the End's (no `portal` award).
  award(p, from, to, exit) {
    if (to === END) { this.dims.sim.achievements.award(p, 'theEnd'); return true; }
    if (from === END) { if (exit) this.dims.sim.achievements.award(p, 'theEnd2'); return true; }
    return false;
  }

  // ---- items ----
  // ItemEnderEye.onItemUse on the clicked cell (`target.block`) in the player's world (sim.world, swapped inside `within`): true when the click was an eye on a frame (used up either way).
  useItem(p, target, id) {
    if (id !== ITEM_EYE_OF_ENDER) return false;
    const w = this.dims.sim.world, [x, y, z] = target.block;
    if (w.get(x, y, z) !== END_PORTAL_FRAME) return false; // an eye aimed elsewhere flies to the nearest stronghold natively: not on the server yet
    if (hasEye(w.getMeta(x, y, z))) return true;
    if (!p.survival.creative && !p.survival.usable(id)) return true;
    useEyeOnFrame(w, x, y, z, {
      setMeta: (px, py, pz, meta) => { w.set(px, py, pz, END_PORTAL_FRAME, true, meta); },
      set: (px, py, pz, block) => { w.set(px, py, pz, block, true, 0); },
      particle: noop, // WorldServer drops particle calls (the clients draw their own)
    }, p.rand);
    if (!p.survival.creative) p.survival.take(id); // Creative keeps the stack (ItemInWorldManager restores it)
    return true;
  }
}
