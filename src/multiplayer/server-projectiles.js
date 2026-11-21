// Batch 62 (mpprojectiles): the shooters of the dedicated server's one projectile system. The system itself (lanes per dimension, flight, hits on mobs and players, pickup, saving,
// the dispEnts / dispFx / projCollect messages) is ServerDispense (server-dispense.js, batch 61's dispenser code generalised); this subclass adds who can fire into it:
//   * skeletons: `mobs.shoot` -> Arrows.skeletonShoot (EntitySkeleton.attackEntityWithRangedAttack), difficulty from the world;
//   * witches: `mobs.potions` -> WitchPotions.throwAt (EntityWitch); the potions fly in this system's lane, so the mobs' own tick of `mobs.potions` is switched off;
//   * players: a released bow (C07 status 5: ItemBow.onPlayerStoppedUsing, bow.js releaseBow) and the thrown items of C08 with no block use (snowball, egg, ender pearl,
//     splash potion, Bottle o' Enchanting), each with the single-player rules and the player recorded as the shooter (the arrow's `owner`, a ball's `thrower`).
// The ghast and blaze fireballs (`mobs.fireballs`) stay with the Nether work; `snapshot` already carries them.
import { ServerDispense } from './server-dispense.js';
import { releaseBow } from '../bow.js';
import { isThrowable, throwHeldItem } from '../player-throw-simulation.js';
import { usePotion, ITEM_POTION } from '../potion-use.js';
import { throwExpBottle } from '../spawn-egg-use.js';
import { ITEM_EXP_BOTTLE } from '../spawn-eggs.js';
import { isSplashDamage } from '../potions.js';
import { ITEM_EYE_OF_ENDER } from '../eye-of-ender.js';

export class ServerProjectiles extends ServerDispense {
  constructor(sim, saved = null) { super(sim, saved); this.hooked = false; }

  // Wires the mobs' ranged attacks into this system. Done on first use: ServerMobs is built after the dispenser host.
  hook() {
    const mobs = this.sim.mobs?.mobs;
    if (this.hooked || !mobs) return;
    this.hooked = true;
    mobs.shoot = (e, target, scale) => this.shot(this.arrows.skeletonShoot(e, target, scale, this.sim.difficulty ?? mobs.difficulty));
    const witch = this.potionsOf(this);
    witch.tick = () => {}; // EntityWorld.tick would advance them against a single player; tickPotions (every lane, every player) does it
    mobs.potions = witch;
  }
  tick() { this.hook(); super.tick(); }

  // b89 mobpackets89: EntitySkeleton.attackEntityWithRangedAttack (yl.a(sv, F), bytecode-read) ends in World.spawnEntityInWorld: the arrow is appended to loadedEntityList, and
  // World.updateEntities walks that list by index, so the arrow has its first update in the same pass, after the entities before it (the precedent: primed TNT, tickJoined). The
  // port's arrows tick before the mobs (tickLane), so a skeleton's arrow waited for the next tick. Its join state is copied for the tracker (ThrownTracks.birth: the entry is made at
  // the spawn, mn.a(sa) from onEntityAdded, so the S0E carries the state before this update), then tickJoined gives it its update.
  shot(arrow) {
    if (!arrow) return arrow;
    this.tracksOf(this).birth([{ e: arrow }]);
    (this.shotNow ??= []).push(arrow);
    return arrow;
  }
  tickJoined() {
    super.tickJoined();
    const shot = this.shotNow;
    if (!shot?.length) return;
    this.shotNow = null;
    const arrows = this.arrows, fresh = shot.filter(a => !a.dead && arrows.list.includes(a));
    if (!fresh.length) return;
    const ctx = this.arrowCtx(this);
    for (const a of fresh) this.tickArrow(this, a, ctx);
    arrows.reap();
    this.collectArrows(this);
    this.drainArrows(this);
  }

  // ItemBow.onPlayerStoppedUsing for the C07 release: `ticks` of draw. Needs the bow still held; releaseBow decides power, damage, the arrow used up, the bow's wear and the sound.
  shootBow(p, ticks) {
    const lane = this.laneFor(p.dimension | 0);
    if (!lane || p.dead || !p.survival || p.survival.health <= 0 || !(ticks >= 0)) return null;
    const arrow = releaseBow({ survival: p.survival, arrows: lane.arrows, ticks, feet: p.position, yaw: p.yaw, pitch: p.pitch });
    if (!arrow) return null;
    arrow.owner = p; arrow.ownerName = p.name; // `shooter` stays "player": the mobs' damage credit and the 100-tick attacker both follow it
    const ev = lane.arrows.events[lane.arrows.events.length - 1];
    if (ev && !ev.position) ev.position = { x: p.position.x, y: p.position.y, z: p.position.z }; // World.playSoundAtEntity: heard at the shooter, by the shooter too
    p.swing = 6;
    return arrow;
  }

  // ItemSnowball / ItemEgg / ItemEnderPearl / ItemPotion (splash) / ItemExpBottle .onItemRightClick, reached when the click used no block. True when the held item is one of those
  // (the click is used up even when a Creative pearl does nothing).
  throwHeld(p) {
    if (p.dead || !p.survival || p.survival.health <= 0) return false;
    const s = p.survival, held = s.held, id = held?.id ?? 0, lane = this.laneFor(p.dimension | 0);
    if (!lane || !id) return false;
    const dim = lane.dim, sound = (name, o) => this.fx.push({ k: 'sound', name, x: p.position.x, y: p.position.y, z: p.position.z, volume: o.volume, pitch: o.pitch, dim });
    if (id === ITEM_EYE_OF_ENDER) return this.eyeSystem.use(p); // b64 mpend2: ItemEnderEye.onItemRightClick (the nearest stronghold)
    if (isThrowable(id)) {
      const r = throwHeldItem({ survival: s, projectiles: lane.balls, position: p.position, yaw: p.yaw, pitch: p.pitch }, id, { random: Math.random, playSound: sound });
      if (r.ball) { r.ball.thrower = p; r.ball.ownerName = p.name; }
      return true;
    }
    const potions = this.potionsOf(lane), before = potions.projectiles.balls.length, pitch = { position: p.position, yaw: p.yaw, pitch: p.pitch };
    if (id === ITEM_POTION && isSplashDamage(held.damage | 0)) {
      usePotion({ survival: s, mobs: { potions }, ...pitch, eating: {} }, { random: Math.random, playSound: sound });
    } else if (id === ITEM_EXP_BOTTLE) {
      throwExpBottle({ survival: s, mobs: { potions }, ...pitch }, { random: Math.random, playSound: sound });
    } else return false;
    const ball = potions.projectiles.balls[potions.projectiles.balls.length - 1];
    if (ball && potions.projectiles.balls.length > before) { ball.thrower = p; ball.ownerName = p.name; }
    p.swing = 6;
    return true;
  }
}
