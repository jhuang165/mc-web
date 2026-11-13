// The witch's splash potions in flight: EntityWitch.attackEntityWithRangedAttack (witch.js chooses the potion and aims) spawns an
// EntityPotion that flies with the throwable flight of projectiles.js (gravity 0.05) and breaks on EntityPotion.onImpact (witch.js
// splashImpact). Held apart from the player's own Projectiles; serialize()/load() save the potions in the air. main.js
// creates one per world (`mobs.potions`), EntityWorld.tick calls tick(), the scene draws `balls`. See public/research/witch.md.
import { readItemTags } from "./item-tags.js";
import { Projectiles, heading, launch, mobTargets } from "./projectiles.js";
import { entityRandom, ENTITY_TYPES } from "./entities.js";
import { addMobEffect, isUndeadMob, isPotionApplicable } from "./mob-effects.js";
import { expBottleOrbs } from "./spawn-eggs.js";
import { JavaRandom } from "./java-random.js";
import { chooseThrownPotion, throwSpawn, splashImpact, WITCH } from "./witch.js";
const f = Math.fround;

export class WitchPotions {
  constructor(mobs, random = Math.random) {
    this.mobs = mobs;
    this.projectiles = new Projectiles(random);
  }
  get balls() {
    return this.projectiles.balls;
  }
  // The ranged attack of one witch at the player (the ArrowAttack task calls it every 60 ticks within range 10 and in sight).
  // The aim leads by the target's motion (EntityWitch: target.posX + target.motionX): the server's copy of the player, or the mob's own.
  throwAt(e, target) {
    const survival = target.survival, rand = entityRandom(e), motion = target.isPlayer ? { x: target.motion.x, z: target.motion.z } : { x: target.e?.vx, z: target.e?.vz };
    const choice = chooseThrownPotion(rand, e, {
      x: target.x, y: target.y, z: target.z, eyeHeight: target.eyeHeight, motionX: motion.x ?? 0, motionZ: motion.z ?? 0,
      health: survival?.health ?? 20, hasEffect: (id) => !!survival?.effects?.has?.(id),
    }, !!e.drinking);
    if (!choice) return null;
    const at = throwSpawn(e, f((-e.yaw * 180) / Math.PI), WITCH.eyeHeight), rng = this.projectiles.rng(),
      pre = heading(rng, 0, 1, 0, 0, 0), // EntityThrowable(world, thrower) aims once with inaccuracy 0: three gaussians on the potion's own random before the witch's own aim (creeperwitch-b45 records)
      h = heading(rng, choice.dx, choice.dy, choice.dz, choice.velocity, choice.inaccuracy),
      ball = { ...h, ...at, kind: "potion", damage: choice.damage, owner: e, px: at.x, py: at.y, pz: at.z, prevYaw: h.yaw, prevPitch: h.pitch, ticks: 0, rand: rng, random: rng, dead: false };
    this.projectiles.balls.push(ball);
    this.mobs.joined?.(ball, "potion"); // entity-simulation.js (entityWalkers): the potion's place in World.loadedEntityList
    return ball;
  }
  // ItemPotion.onItemRightClick: EntityPotion(world, player, damage): launched like a thrown snowball from the eye, 0.5 velocity, 1.0
  // inaccuracy, and the pitch offset -20 degrees of func_70183_g (so it flies higher than the view). `feet` is the player's position.
  // `kind` and `velocity` let ItemExpBottle's EntityExpBottle (velocity 0.7, spawn-eggs.js) use the same launch.
  throwFromPlayer(feet, yaw, pitch, damage, kind = "potion", velocity = 0.5, custom = undefined) {
    const rng = this.projectiles.rng(), h = launch(rng, feet, yaw, pitch, velocity, -20), // MathHelper's sine table, as EntityThrowable's constructor uses (executed: throw-launch records)
      ball = { ...h, kind, damage, ...(Array.isArray(custom) ? { custom: custom.map((e) => ({ ...e })) } : {}), owner: "player", px: h.x, py: h.y, pz: h.z, prevYaw: h.yaw, prevPitch: h.pitch, ticks: 0, rand: rng, random: rng, dead: false };
    this.projectiles.balls.push(ball);
    this.mobs.joined?.(ball, "potion");
    return ball;
  }
  // Browser snapshot of the potions in flight (like Projectiles.serialize): Pos, Motion, Rotation, the potion damage value, the flight age and
  // whether the local player threw it (a thrown-by-witch potion loses its owner, as an EntityPotion whose thrower did not load).
  serialize() {
    return this.projectiles.balls.filter((b) => !b.dead).map((b) => ({ x: b.x, y: b.y, z: b.z, mx: b.mx, my: b.my, mz: b.mz, yaw: b.yaw, pitch: b.pitch, damage: b.damage, ...(Array.isArray(b.custom) ? { custom: b.custom.map((e) => ({ ...e })) } : {}), ticks: b.ticks | 0, ...(b.kind === "expBottle" ? { kind: "expBottle" } : {}), ...(b.owner === "player" ? { owner: "player" } : {}) }));
  }
  load(list) {
    this.projectiles.balls.length = 0;
    const ok = Number.isFinite;
    for (const d of Array.isArray(list) ? list : []) {
      if (!d || ![d.x, d.y, d.z, d.mx, d.my, d.mz].every(ok) || !Number.isInteger(d.damage) || d.damage < 0) continue;
      const yaw = ok(d.yaw) ? f(d.yaw) : 0, pitch = ok(d.pitch) ? f(d.pitch) : 0, rng = this.projectiles.rng();
      this.projectiles.balls.push({ kind: d.kind === "expBottle" ? "expBottle" : "potion", damage: d.damage, ...(Array.isArray(d.custom) ? { custom: readItemTags({ customPotionEffects: d.custom }).customPotionEffects } : {}), owner: d.owner === "player" ? "player" : null, x: d.x, y: d.y, z: d.z, px: d.x, py: d.y, pz: d.z, mx: d.mx, my: d.my, mz: d.mz,
        yaw, pitch, prevYaw: yaw, prevPitch: pitch, ticks: Math.max(0, d.ticks | 0), rand: rng, random: rng, dead: false });
    }
  }
  tick(player, survival) {
    const p = this.projectiles;
    if (!p.balls.length) return;
    for (const b of [...p.balls]) this.tickOne(b, player, survival);
    this.reap();
  }
  // One potion's update (EntityThrowable.onUpdate) and its impact, where the loaded-entity walk reaches it (entity-simulation.js entityWalkers).
  tickOne(ball, player, survival, extra = []) {
    const mobs = this.mobs, p = this.projectiles;
    if (ball.dead) return;
    const targets = mobTargets(mobs.entities.filter((e) => e.health > 0), null);
    for (const t of targets) if (t.ref.type === "witch") t.thrower = true; // the thrower is skipped for the first 5 ticks (every witch here)
    if (player && survival && survival.health > 0) {
      const hw = f(f(0.6) / 2);
      targets.push({ ref: "player", playerThrower: true, box: [player.x - hw, player.y, player.z - hw, player.x + hw, player.y + f(1.8), player.z + hw] });
    }
    targets.push(...extra); // the carts and boats: EntityThrowable's sweep hits any collidable entity (entity-simulation.js vehicleTargets)
    p.tickOne(mobs.world, ball, targets);
    for (const ev of p.drain()) { if (ev.potion) this.impact(ev.potion, player, survival); else if (ev.expBottle) this.expImpact(ev.expBottle); }
  }
  reap() { this.projectiles.reap(); }
  // EntityExpBottle.onImpact: 3 + nextInt(5) + nextInt(5) experience in getXPSplit orbs at the bottle (drained as `xp` events), then world
  // event 2002 with colour 0 at the rounded position (the break particles and game.potion.smash) like EntityPotion's.
  expImpact({ x, y, z }) {
    const rng = this.projectiles.rng(), events = this.mobs.events;
    // Batch 48: `3 + world.rand.nextInt(5) + world.rand.nextInt(5)` draws from World.rand (bytecode-read; the replay record uses World.rand = Random(2)), the world's shared generator, not the ball's own.
    for (const n of expBottleOrbs((this.mobs.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48))))) events.push({ xp: n, position: { x, y, z }, bottle: true }); // `bottle`: the walk spawns these orbs in the bottle's own update (entity-simulation.js)
    const rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    events.push({ sound: "game.potion.smash", volume: 1, pitch: f(f(rng.nextFloat() * f(0.1)) + f(0.9)), position: { x: rx + 0.5, y: ry + 0.5, z: rz + 0.5 }, splashBreak: { x: rx, y: ry, z: rz, damage: 0 } });
  }
  // EntityPotion.onImpact: effects on everything around, the glass sound (world event 2002).
  impact({ x, y, z, damage, owner, hit, custom }, player, survival, thrower = null) {
    // b63 (mpprojectiles2): EntityPotion.onImpact -> causeIndirectMagicDamage(potion, getThrower()): a player's potion is a player hit (`player`: recentlyHit 100, so drops and kill XP follow); `thrower` (the server's player) also gives the knockback direction.
    const byPlayer = owner === "player" || !!thrower;
    const mobs = this.mobs, victims = [];
    for (const e of mobs.entities) {
      if (e.health <= 0) continue;
      const t = ENTITY_TYPES[e.type], s = e.growingAge < 0 ? 0.5 : 1;
      victims.push({ x: e.x, y: e.y, z: e.z, width: t.width * s, height: t.height * s, undead: isUndeadMob(e), applicable: (id) => isPotionApplicable(e, id), ref: e, direct: hit === e });
    }
    if (player && survival && survival.health > 0) victims.push({ x: player.x, y: player.y, z: player.z, width: 0.6, height: 1.8, undead: false, ref: "player", direct: hit === "player" });
    for (const r of splashImpact(damage, { x, y, z }, victims, owner, custom)) {
      if (r.ref === "player") {
        // EntityPlayer: magic damage ignores armour; slowness/weakness/speed/strength live in status-effects.js and feed movement, FOV and melee damage (player-knockback.md).
        for (const s of r.steps) { // in effect order (a custom list can heal and harm)
          if (s.hurt > 0) survival.damage(s.hurt, "magic", false, undefined, owner?.x !== undefined ? owner : undefined); // the thrower is the source entity
          if (s.heal > 0) survival.heal?.(s.heal);
        }
        for (const e of r.effects) survival.effects?.add({ id: e.id, duration: e.duration, amplifier: e.amplifier });
        continue;
      }
      const e = r.ref;
      for (const s of r.steps) {
        if (s.hurt > 0) mobs.attackEntityFrom(e, s.hurt, { name: "indirectMagic", from: owner?.x !== undefined ? { x: owner.x, z: owner.z } : thrower ? { x: thrower.x, z: thrower.z } : undefined, attacker: owner?.x !== undefined ? owner : null, ...(byPlayer ? { player: true, ...(thrower?.name ? { playerName: thrower.name } : {}) } : {}) });
        if (s.heal > 0) e.health = Math.min(ENTITY_TYPES[e.type].health, f(e.health + s.heal));
      }
      for (const effect of r.effects) addMobEffect(e, effect.id, effect.duration, effect.amplifier);
    }
    // EntityPotion.onImpact: worldEvent 2002 at (Math.round x, y, z); the client plays the break particles (potion-fx.js splashBreak) and
    // game.potion.smash at the block centre.
    const rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    mobs.events.push({ sound: "game.potion.smash", volume: 1, pitch: f(f(this.projectiles.rng().nextFloat() * f(0.1)) + f(0.9)), position: { x: rx + 0.5, y: ry + 0.5, z: rz + 0.5 }, splashBreak: { x: rx, y: ry, z: rz, damage } });
  }
}
