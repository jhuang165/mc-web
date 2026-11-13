// Player Survival state on the dedicated server (batch 59). Each server player already owns a real `Survival` (health, food, saturation, exhaustion);
// this module runs it the way the single-player tick does, so nothing is re-derived: tickPlayerEnvironment (Survival.tick: regeneration, starvation by
// difficulty, void, drowning, suffocation, fire) and finishPlayerMovement (walk/sprint exhaustion, landing: Entity.fallDistance -> EntityLivingBase.fall damage).
// Bytecode-read (javap, 1.7.10 jar, EntityPlayerMP = mw): onUpdateEntity (mw.i) sends S06 (ib: health, food, saturation) whenever getHealth, the food
// level or "saturation == 0" differs from the last values it sent, then stores them; this module does the same (`status`).
import { ITEMS } from '../survival.js';
import { Effects } from '../status-effects.js';
import { makeStack } from '../inventory.js';
import { tickPlayerEnvironment, finishPlayerMovement } from '../player-environment.js';
import { CombatTracker } from '../combat-tracker.js';
import { deathComponent } from '../team-names.js';
import { NORMAL } from '../difficulty.js';

const finite = Number.isFinite;

/** The vitals a saved player record carries (the Survival constructor reads them back on join). */
export const vitalsOf = (s) => ({ health: s.health, food: s.food, saturation: s.saturation, exhaustion: s.exhaustion, timer: s.timer });

export class ServerSurvival {
  constructor(simulation) { this.sim = simulation; }
  /** Survival and Adventure players take part; Creative keeps the old server behaviour (immune, no hunger). */
  managed(p) { return !p.survival.creative; }
  attach(p) {
    const s = p.survival;
    p.vitals = { sent: null, ready: true };
    s.furnaceActive = () => false; // the furnaces of the shared tile set are not ticked once per player
    if (s.health <= 0) p.dead = true; else s.protection = 60; // EntityPlayerMP.field_147101_bU after a join
  }
  /** After movePlayer in the simulation tick. `moved` is its return value. Returns true while the player is dead. */
  tick(p, moved) {
    if (!this.managed(p)) return false;
    if (!p.vitals) this.attach(p);
    const s = p.survival;
    s.difficulty = this.sim.difficulty ?? NORMAL;
    if (!p.dead) {
      tickPlayerEnvironment({ world: p.world, weather: this.sim.weather, position: p.position, survival: s, motion: p.motion, flying: p.flying }, moved, { tickWeather() {} });
      finishPlayerMovement(p, moved);
      if (s.health <= 0) this.die(p);
    }
    s.hurtSounds.length = 0; s.died = false; s.broken = 0; s.drowned = false; // client-only flags the dedicated server never plays
    return !!p.dead;
  }
  /** EntityPlayerMP.onDeath: the CombatTracker message goes to every player (ServerSocial.drain). */
  die(p) {
    p.dead = true; p.itemInUse = null; p.dig?.abort?.();
    const component = deathComponent(p.survival.combat, p.name, { rawName: p.name });
    (this.sim.events ??= []).push({ type: 'death', id: p.id, component });
  }
  /** ItemFood.onEaten through ItemInWorldManager: the food and saturation the single-player rules give (Survival.eat), and the bowl/bottle containers. */
  finishEating(p, itemId) {
    const s = p.survival, item = ITEMS[itemId];
    if (!item?.food || s.creative || p.dead) return false;
    if (!s.eat(itemId, () => p.rand.nextFloat())) return false;
    return true;
  }
  /** C16 client status 0 (perform respawn): a dead player starts again at the world spawn with full vitals. */
  respawn(p) {
    if (!p?.dead) return false;
    const s = p.survival, spawn = p.spawnpoint ? { x: p.spawnpoint[0] + 0.5, y: p.spawnpoint[1], z: p.spawnpoint[2] + 0.5 } : this.sim.world.spawn(); // /spawnpoint (servercommands-b59)
    Object.assign(s, { health: 20, food: 20, saturation: 5, exhaustion: 0, timer: 0, air: 300, fire: 0, absorption: 0, hurtTicks: 0, hurtAmount: 0, protection: 60, combat: new CombatTracker(), lastDamage: '', lastSource: null, lastAttacker: null });
    s.effects = new Effects(); s.effects.player = s;
    p.position.copy(spawn);
    p.previous.copy(p.position);
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    Object.assign(p, { dead: false, fallDistance: 0, landedFall: 0, flying: false, grounded: false });
    return true;
  }
  /** The S06 message when health, food or "saturation is 0" changed since the last one (always on the first call), else null. */
  status(p) {
    if (!this.managed(p)) return null;
    const s = p.survival, v = (p.vitals ??= { sent: null }), now = { health: s.health, food: s.food, zero: s.saturation === 0 };
    const last = v.sent;
    if (last && last.health === now.health && last.food === now.food && last.zero === now.zero) return null;
    v.sent = now;
    const message = { type: 'health', health: s.health, food: s.food, saturation: s.saturation };
    return message;
  }
}

/**
 * The client half: apply an S06-style message to the local Survival. Values are validated; health and food are clamped like the Survival
 * constructor. The eaten stack is not in this message: the server's own inventory spends it and sends an S2F slot correction (server-items.js).
 * Returns { died, hotbar } so the caller can open the death screen and redraw.
 */
export function applyHealthMessage(survival, m) {
  if (!m || ![m.health, m.food, m.saturation].every(finite)) return { died: false, hotbar: false };
  survival.health = Math.max(0, Math.min(survival.maxHealth, m.health));
  survival.food = Math.max(0, Math.min(20, Math.floor(m.food)));
  survival.saturation = Math.max(0, Math.min(survival.food, m.saturation));
  survival.syncedHealth = survival.health;
  return { died: survival.health <= 0, hotbar: false }; // the eaten stack comes back as an S2F slot correction (server-items.js)
}
