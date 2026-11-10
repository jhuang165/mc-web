// Beds on the gun server (bed.js over each player's EntityPlayer sleep state): BlockBed.onBlockActivated lays a player down at night,
// EntityPlayer.onUpdate's sleep timer wakes them when the bed goes or the day comes, WorldServer.tick skips to the next morning
// once every player is fully asleep (wakeAllPlayers, resetRainAndThunder), and ServerConfigurationManager.respawnPlayer puts a dead
// player back by their bed (verifyRespawnCoordinates) or tells them it was missing or obstructed.
import { BedSleep, activateBed, nextMorning, verifyRespawn, wakeSavedSleeper, BED_TEXT, BED_DIR } from '../bed.js';
import { HOSTILE, ENTITY_TYPES } from '../entities.js';
import { dismount } from './server-riding.js';
import { bedExplosion } from '../dimension-live.js';

// World.isDaytime: skylightSubtracted < 4 (the rain and thunder darken it too).
export const daytime = sim => sim.darkness < 4;

// A joining player's sleep state: the bed spawn point; a record saved while asleep wakes at once (wakeUpPlayer(true, true, false)
// on load), standing beside the bed.
export function restoreBed(sim, p, saved) {
  p.bed = new BedSleep().restore(saved);
  p.bedHealth = p.survival.health;
  if (Array.isArray(saved?.bed) && saved.bed.length === 3 && saved.bed.every(Number.isInteger)) {
    const feet = wakeSavedSleeper(sim.world, saved.bed);
    if (feet) { p.position.copy(feet); p.previous.copy(feet); }
  }
}
export const saveBed = p => p.bed?.save() ?? null;

// EntityMob in the 8 x 5 x 8 box around the head cell (strict intersection), as main.js useBed asks.
function monsterIn(sim, b) {
  return !!sim.mobs?.ew.entities.some(e => {
    if (!HOSTILE.has(e.type) || e.health <= 0 || e.dead) return false;
    const size = ENTITY_TYPES[e.type], hw = size.width / 2;
    return e.x + hw > b[0] && e.x - hw < b[3] && e.y + size.height > b[1] && e.y < b[4] && e.z + hw > b[2] && e.z - hw < b[5];
  });
}

// BlockBed.onBlockActivated for player p on either half of the bed at (x, y, z). The status lines go to p alone.
export function useBed(sim, p, x, y, z) {
  if (p.dead || !p.bed || p.bed.sleeping) return;
  // WorldProvider.canRespawnHere false (the Nether, the End): the bed goes and explodes at its head, power 5, flaming.
  const boom = bedExplosion(sim.world, x, y, z);
  if (boom) {
    if (boom.cells.length) sim.mobs?.explode([...sim.players.values()].filter(q => !q.dead), boom.x, boom.y, boom.z, boom.size, { smoking: true, flaming: true });
    return;
  }
  const out = activateBed(sim.world, x, y, z, p.bed, {
    player: { x: p.position.x, y: p.position.y, z: p.position.z, alive: !p.dead && p.survival.health > 0 },
    daytime: daytime(sim),
    monsterNear: b => monsterIn(sim, b),
    otherSleeperAt: (hx, hy, hz) => [...sim.players.values()].some(q => q !== p && q.bed?.sleeping && q.bed.bed[0] === hx && q.bed.bed[1] === hy && q.bed.bed[2] === hz),
  });
  if (out.message) sim.tell(p, out.message);
  if (!p.bed.sleeping) return;
  // EntityPlayer.sleepInBedAt: off any vehicle, motion stopped, lying on the mattress (main.js enterSleep's position).
  dismount(sim, p);
  sim.play.closeWindow(p); sim.play.close(p, 0);
  p.eating = null; p.mining = null; p.mineHeld = false;
  const { pos, bed } = p.bed;
  p.position.copy({ x: pos.x, y: bed[1] + 0.5625, z: pos.z }); p.previous.copy(p.position);
  Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
  p.fallDistance = 0; p.landedFall = 0;
  p.bedHealth = p.survival.health;
}

// EntityPlayer.wakeUpPlayer(resetTimer, update, setSpawn) on the server: the occupied bit goes, the player stands beside the bed.
export function wake(sim, p, resetTimer, setSpawn) {
  const feet = p.bed?.wake(sim.world, resetTimer, setSpawn);
  if (!feet) return false;
  p.position.copy(feet); p.previous.copy(feet);
  Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
  p.fallDistance = 0; p.landedFall = 0;
  return true;
}

// Each tick before the players move: WorldServer.tick's night skip once every player is in bed and fully asleep, then each
// sleeper's timer (EntityPlayer.onUpdate: the bed gone, or day) and the hurt wake-up (EntityPlayer.attackEntityFrom).
export function tickBeds(sim) {
  const players = [...sim.players.values()];
  if (players.length && players.every(p => p.bed?.fullyAsleep)) {
    sim.time = nextMorning(sim.time);
    const w = sim.weather;
    w.rainTime = 0; w.raining = false; w.thunderTime = 0; w.thundering = false;
    for (const p of players) wake(sim, p, false, true);
  }
  const day = daytime(sim);
  for (const p of players) {
    const b = p.bed;
    if (!b || (!b.sleeping && b.timer === 0)) continue;
    if (b.sleeping && (p.dead || p.survival.health < p.bedHealth)) { wake(sim, p, true, false); continue; }
    p.bedHealth = p.survival.health;
    const call = b.tick(sim.world, day);
    if (call) wake(sim, p, call[0], call[2]);
  }
}

// ServerConfigurationManager.respawnPlayer: by the bed when it is still there with room beside it, else the world spawn and
// tile.bed.notValid. A bed in a column the server does not hold yet is checked once it arrives (bedCheck, frozen until then).
export function bedRespawn(sim, p) {
  const spawn = p.bed?.spawn;
  if (!spawn) return null;
  if (!sim.world.isLoaded(spawn[0], spawn[2])) { p.bedCheck = true; return { x: spawn[0] + 0.5, y: spawn[1] + 0.1, z: spawn[2] + 0.5 }; }
  return checkBed(sim, p);
}
function checkBed(sim, p) {
  p.bedCheck = false;
  const cell = verifyRespawn(sim.world, p.bed.spawn, false);
  if (cell) return { x: cell[0] + 0.5, y: Math.fround(cell[1] + 0.1), z: cell[2] + 0.5 };
  p.bed.spawn = null;
  sim.tell(p, BED_TEXT.notValid);
  return null;
}
// A respawn waiting for its bed's column: once it is there, stand by the bed or go to the world spawn.
export function settleBedRespawn(sim, p) {
  if (!p.bedCheck || !p.bed?.spawn || !sim.world.isLoaded(p.bed.spawn[0], p.bed.spawn[2])) return;
  const at = checkBed(sim, p) ?? sim.spawnPoint();
  p.position.copy(at); p.previous.copy(at);
  Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
}

// The tab's sleep state: the head cell and facing while lying, and the timer for GuiIngame's fade (also over the ten ticks after).
export function sleepRow(p) {
  const b = p.bed;
  if (!b || (!b.sleeping && b.timer === 0)) return null;
  return b.sleeping ? { bed: b.bed, facing: b.facing, timer: b.timer } : { timer: b.timer };
}
// The others see a sleeper lying in the bed (S0APacketUseBed): EntityPlayer's lying position and the bed's facing.
export function sleeperPresence(p) {
  const b = p.bed;
  if (!b?.sleeping) return null;
  const [dx, dz] = BED_DIR[b.facing];
  return { x: b.pos.x, y: b.pos.y, z: b.pos.z, facing: b.facing, offset: [-1.8 * dx, 0, -1.8 * dz] };
}
