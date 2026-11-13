// What the gun server's players and mobs do to the blocks they touch, and what the others hear and see of it (not 1.7.10
// networking). In 1.7.10 NetHandlerPlayServer.processPlayer runs the player's Entity.moveEntity on the server too: the step
// sound (EntityPlayer.playSound -> World.playSoundToNearExcept), Block.onEntityWalking, the water splash and the landing
// (EntityLivingBase.fall: BlockFarmland.onFallenUpon, the fall sounds, the 2006 landing dust). A gun-server tab does not
// predict its own movement, so the mover hears and sees its own steps from here as well.
//
// Redstone ore (redstone-ore.js) lights when a player clicks or uses it and when a player or mob walks on it; the reddust
// sparkle goes to the players near it as particles. The lit ore's fade is the world's random tick (simulation.js).
import { footstepSound } from '../block-sounds.js';
import { countsVertical } from '../ladders.js';
import { enterWater } from '../fx.js';
import { LADDER, PHYSICS } from '../world.js';

const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
export const STEP_DISTANCE = 1.667; // main.js movementTick: Entity.nextStepDistance over distanceWalkedOnStepModified's 0.6
const HEARING = 16; // World.playSoundEffect: 16 blocks, times the volume above 1
const PARTICLE_RANGE = 16; // RenderGlobal.doSpawnParticle draws nothing further away
const AUX_RANGE = 64; // World.playAuxSFX: ServerConfigurationManager.sendToAllNear 64

const far = (a, b, range) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 > range * range;
function sendNear(sim, at, range, event) { for (const o of sim.players.values()) if (!far(o.position, at, range)) sim.send(o, event); }
// World.rand's nextFloat over the server's random.
const floats = sim => ({ nextFloat: () => sim.random() });

// A positioned sound for every player in earshot, the one who made it included.
export function soundAt(sim, sound, at, volume = 1, pitch = 1) {
  if (!sound) return;
  sendNear(sim, at, HEARING * Math.max(1, volume), { type: 'sound', sound, x: r2(at.x), y: r2(at.y), z: r2(at.z), volume: r2(volume), pitch: r2(pitch) });
}
// [name, x, y, z, vx, vy, vz] particles for the players near `at` (main.js draws the 'particles' fx list).
export function particlesAt(sim, at, list) {
  if (list.length) sendNear(sim, at, PARTICLE_RANGE, { type: 'fx', kind: 'particles', list: list.map(([name, ...n]) => [name, ...n.map(r3)]) });
}

// BlockRedstoneOre.func_150185_e at a cell (redstone-ore.js touchRedstoneOre): the sparkle, then the unlit ore lights.
export function touchOre(sim, x, y, z) {
  const list = [];
  const lit = !!sim.populationBlocks?.touch(x, y, z, { rand: floats(sim), spawn: (...q) => list.push(q) });
  particlesAt(sim, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, list);
  return lit;
}

// BlockFarmland.onFallenUpon for a landing of `distance` blocks at `e` (the cell 0.2 below the feet): a mob tramples only with
// mobGriefing (the gun server's rules have no such entry unless an operator sets one, so it stays on).
export function trampleAt(sim, e, distance, player) {
  const grief = player || sim.rules?.mobGriefing !== false;
  return !!sim.farming?.trample(Math.floor(e.x), Math.floor(e.y - 0.2), Math.floor(e.z), distance, sim.random, grief);
}

// player-environment.js landPlayer's hooks for player p: farmland, the 2006 landing dust and the fall sounds.
export function landingHooks(sim, p) {
  return {
    trample: (at, distance) => trampleAt(sim, at, distance, true),
    landingDust: (x, y, z, data) => sendNear(sim, p.position, AUX_RANGE, { type: 'fx', kind: 'landingDust', x, y, z, data }),
    fallSound: s => soundAt(sim, s.name, p.position, s.volume, s.pitch),
  };
}

// After player p's own move (not a ride): the splash on entering water, then main.js movementTick's step: every 1.667 blocks
// walked (the vertical part only on a ladder) on the ground, in water or on a ladder and not flying, the swim or step sound
// and Block.onEntityWalking 0.2 below the feet. `wasInWater`: p was in water before this move.
export function stepPlayer(sim, p, from, moved, wasInWater) {
  const w = sim.world, at = p.position, flying = !!p.flying;
  const ladder = !flying && countsVertical(w, at.x, at.y, at.z);
  if (!moved.sneakOnGround) p.stepDistance = (p.stepDistance ?? 0) + Math.hypot(at.x - from.x, ladder ? at.y - from.y : 0, at.z - from.z);
  if (moved.inWater && !wasInWater) { // Entity.handleWaterMovement: the splash volume follows the entry speed
    const list = [], v = p.velocity;
    const s = enterWater({ spawn: (...q) => list.push(q) }, { x: at.x, z: at.z, minY: at.y, width: PHYSICS.width, mx: v.x, my: v.y, mz: v.z }, floats(sim));
    soundAt(sim, 'game.player.swim.splash', at, s.volume, s.pitch);
    particlesAt(sim, at, list);
  }
  if (!(p.stepDistance > STEP_DISTANCE && (p.grounded || moved.inWater || ladder) && !flying)) return false;
  p.stepDistance = 0;
  const sx = Math.floor(at.x), sy = Math.floor(at.y - 0.05), sz = Math.floor(at.z);
  if (moved.inWater) soundAt(sim, 'game.player.swim', at, 0.3, 1);
  else {
    const s = footstepSound(ladder ? LADDER : w.get(sx, sy, sz), ladder ? 0 : w.get(sx, sy + 1, sz));
    if (s) soundAt(sim, s.name, at, s.volume, s.pitch);
  }
  touchOre(sim, Math.floor(at.x), Math.floor(at.y - 0.2), Math.floor(at.z));
  return true;
}

// The server mobs' Block.onEntityWalking (redstone ore) and EntityLivingBase.fall (farmland), as main.js wires its own mobs.
export function watchMobContacts(sim, ew) {
  ew.onEntityWalking = (x, y, z) => { touchOre(sim, x, y, z); };
  const land = ew.onLand;
  ew.onLand = function (e, distance) { land?.call(this, e, distance); trampleAt(sim, e, distance, false); };
}
