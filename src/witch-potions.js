// The witch's splash potions in flight: EntityWitch.attackEntityWithRangedAttack (witch.js chooses the potion and aims) spawns an
// EntityPotion that flies with the throwable flight of projectiles.js (gravity 0.05) and breaks on EntityPotion.onImpact (witch.js
// splashImpact). Held apart from the player's own Projectiles so saves are unaffected: potions in the air are not saved. main.js
// creates one per world (`mobs.potions`), EntityWorld.tick calls tick(), the scene draws `balls`. See public/research/witch.md.
import { Projectiles, heading, mobTargets } from "./projectiles.js";
import { entityRandom, ENTITY_TYPES } from "./entities.js";
import { addMobEffect } from "./mob-effects.js";
import { chooseThrownPotion, throwSpawn, splashImpact, WITCH } from "./witch.js";
const f = Math.fround, UNDEAD = new Set(["zombie", "skeleton"]);

export class WitchPotions {
  constructor(mobs, random = Math.random) {
    this.mobs = mobs;
    this.projectiles = new Projectiles(random);
  }
  get balls() {
    return this.projectiles.balls;
  }
  // The ranged attack of one witch at the player (the ArrowAttack task calls it every 60 ticks within range 10 and in sight).
  // The player's motion is taken as 0 (the original adds target.motionX/Z).
  throwAt(e, target) {
    const survival = target.survival, rand = entityRandom(e);
    const choice = chooseThrownPotion(rand, e, {
      x: target.x, y: target.y, z: target.z, eyeHeight: target.eyeHeight, motionX: 0, motionZ: 0,
      health: survival?.health ?? 20, hasEffect: (id) => !!survival?.effects?.has?.(id),
    }, !!e.drinking);
    if (!choice) return null;
    const at = throwSpawn(e, f((-e.yaw * 180) / Math.PI), WITCH.eyeHeight), rng = this.projectiles.rng(),
      h = heading(rng, choice.dx, choice.dy, choice.dz, choice.velocity, choice.inaccuracy),
      ball = { ...h, ...at, kind: "potion", damage: choice.damage, owner: e, px: at.x, py: at.y, pz: at.z, prevYaw: h.yaw, prevPitch: h.pitch, ticks: 0, rand: rng, random: rng, dead: false };
    this.projectiles.balls.push(ball);
    return ball;
  }
  tick(player, survival) {
    const mobs = this.mobs, p = this.projectiles;
    if (!p.balls.length) return;
    const targets = mobTargets(mobs.entities.filter((e) => e.health > 0), null);
    for (const t of targets) if (t.ref.type === "witch") t.thrower = true; // the thrower is skipped for the first 5 ticks (every witch here)
    if (player && survival && survival.health > 0) {
      const hw = f(f(0.6) / 2);
      targets.push({ ref: "player", box: [player.x - hw, player.y, player.z - hw, player.x + hw, player.y + f(1.8), player.z + hw] });
    }
    p.tick(mobs.world, targets);
    for (const ev of p.drain()) if (ev.potion) this.impact(ev.potion, player, survival);
  }
  // EntityPotion.onImpact: effects on everything around, the glass sound (world event 2002).
  impact({ x, y, z, damage, owner, hit }, player, survival) {
    const mobs = this.mobs, victims = [];
    for (const e of mobs.entities) {
      if (e.health <= 0) continue;
      const t = ENTITY_TYPES[e.type], s = e.growingAge < 0 ? 0.5 : 1;
      victims.push({ x: e.x, y: e.y, z: e.z, width: t.width * s, height: t.height * s, undead: UNDEAD.has(e.type), ref: e, direct: hit === e });
    }
    if (player && survival && survival.health > 0) victims.push({ x: player.x, y: player.y, z: player.z, width: 0.6, height: 1.8, undead: false, ref: "player", direct: hit === "player" });
    for (const r of splashImpact(damage, { x, y, z }, victims, owner)) {
      if (r.ref === "player") {
        // EntityPlayer: magic damage ignores armour; slowness and weakness are not modelled for the player (witch.md).
        if (r.hurt > 0) survival.damage(r.hurt, "magic", false);
        for (const e of r.effects) survival.effects?.add({ id: e.id, duration: e.duration, amplifier: e.amplifier });
        continue;
      }
      const e = r.ref;
      if (r.hurt > 0) mobs.attackEntityFrom(e, r.hurt, { name: "indirectMagic", from: owner && { x: owner.x, z: owner.z }, attacker: owner });
      if (r.heal > 0) e.health = Math.min(ENTITY_TYPES[e.type].health, f(e.health + r.heal));
      for (const effect of r.effects) addMobEffect(e, effect.id, effect.duration, effect.amplifier);
    }
    mobs.events.push({ sound: "game.potion.smash", volume: 1, pitch: f(f(this.projectiles.rng().nextFloat() * f(0.1)) + f(0.9)), position: { x, y, z } });
  }
}
