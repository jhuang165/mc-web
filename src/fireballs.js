// EntityLargeFireball (zg), EntitySmallFireball (zi) and EntityFireball (ze) inside EntityWorld: the flight, the block and entity sweep, the
// impact and the player's deflecting punch. The rules are in blaze-ghast.js (replayed against blaze-ghast-reference.json); this file wires
// them to the engine's mobs, player and event queue. EntityWorld.tick calls `_fireballs.tick()`; main.js draws `balls` with the other
// projectiles (projectile-renderer.js draws kind "fireball" / "smallFireball" as the fire charge item at scale 2 and 0.5, fullbright).
import { JavaRandom } from "./java-random.js";
import { intercept, rayTraceBlocks } from "./projectiles.js";
import { pushBox } from "./entities.js";
import { sweepBox } from "./mpperf79-fast.js"; // b79 mpperf79
import { dragonPartTargets, aimPart, sweepArea } from "./dragon-parts.js";
import { FIREBALL, fireballAcceleration, fireballStep, fireballBurn, deflect, faceCell, lookVector } from "./blaze-ghast.js";
import { fireballTurn } from "./fireball-turn.js"; // b82 mpball82
import { waterAcceleration, entityWaterBox } from "./fluids.js";
import { serverBallSplash } from "./fireball-splash.js";
import { mhSin, mhCos } from "./lighting.js";
import { gameRule } from "./game-rules.js";
import { setMobFire } from "./armor-enchantments.js";
import { orderTargets, stampEntity } from "./candidate-order.js"; // b72
const isServerPlayer = (e) => !!e && typeof e === "object" && !!e.survival && !!e.position && Number.isFinite(e.yaw); // b87 blast87: a dedicated server player record

const f = Math.fround;
// Entity.isImmuneToFire of the mobs that exist or will exist in this build.
export const FIRE_IMMUNE = new Set(["blaze", "ghast", "magma_cube", "pigman", "zombie_pigman", "wither_skeleton", "wither"]);
// ze.h: the sweep grows each candidate box by this (getCollisionBorderSize 0.3 for the mob; the player's pick uses 1.0 for the fireball).
const SWEEP = 0.3, PICK_BORDER = 1;
const turnToMotion = (b) => fireballTurn(b, b.vx, b.vy, b.vz);
const seedOf = (mobs) => Math.floor(mobs.random() * 2 ** 48);
// b82 fireext82 (render81's skull rule, now for every fireball): Entity.readFromNBT (sa.f(dh), bytecode-read) sets prevRotationYaw/Pitch to the saved Rotation floats and
// setRotation the current ones to them mod 360 (frem). A record without one (older saves) gives 0, 0.
export function savedRotation(r) {
  const [yaw, pitch] = Array.isArray(r?.rotation) && r.rotation.length >= 2 && r.rotation.slice(0, 2).every(Number.isFinite) ? r.rotation.slice(0, 2).map(Math.fround) : [0, 0];
  return { yaw: Math.fround(yaw % 360), pitch: Math.fround(pitch % 360), prevYaw: yaw, prevPitch: pitch };
}

export class Fireballs {
  constructor(mobs) {
    this.mobs = mobs;
    this.list = [];
    this.next = 1;
  }
  // Draw rows for the projectile renderer: the live balls.
  get balls() { return this.list; }
  find(id) { return this.list.find((b) => b.id === id && !b.dead) ?? null; }
  // EntityFireball(world, shooter, dx, dy, dz) at (x, y, z): the aim gets 0.4 * gaussian per axis (x, y, z) on the ball's own Random, then
  // acceleration = aim / |aim| * 0.1. `exact` is the (world, x, y, z, ax, ay, az) form of the dispenser: the aim as given, normalised the same way.
  launch({ large, owner = null, x, y, z, dx = 0, dy = 0, dz = 0, power = FIREBALL.defaultPower, exact = null }) {
    const rand = new JavaRandom(this.mobs.fireballSeed?.(owner, large) ?? seedOf(this.mobs)); // fireballSeed: the replays' recorded Entity.rand seed
    const [ax, ay, az] = exact ? fireballAcceleration(...exact) : fireballAcceleration(dx, dy, dz, rand); // the dispenser form normalises too, without the noise
    // b82 fireext82: ze(world, shooter, ...) calls setLocationAndAngles with the shooter's rotationYaw / rotationPitch; the (world, x, y, z, ax, ay, az) form with its own (0, 0)
    const look = exact || !owner || owner === "player" ? null : owner, yaw = Math.fround(look?.rotationYaw ?? 0), pitch = Math.fround(look?.rotationPitch ?? 0);
    const ball = {
      id: "fb-" + this.next++, type: "fireball", kind: large ? "fireball" : "smallFireball", large: !!large, owner, health: 1,
      x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, ax, ay, az, power, ticks: 0, dead: false,
      scale: large ? 2 : 0.5, fullbright: true, width: large ? FIREBALL.largeSize : FIREBALL.smallSize,
      // The constructor puts the box at the shooter (or at the given position); EntityGhast and EntityBlaze then assign posX/posY/posZ without setPosition, so the
      // box (the water test, the entity query of the first update) stays there until the end of the first update.
      rand, inGround: false, tile: null, ticksAlive: 0, // inGround: EntityFireball.e/f/g (tile), h (block id), i, and the ticksAlive counter; see stick()
      boxPos: exact || !owner || owner === "player" ? [x, y, z] : [owner.x, owner.y, owner.z],
      yaw, pitch, prevYaw: yaw, prevPitch: pitch,
    };
    this.list.push(ball);
    const w = this.mobs, seq = w.orderStamp?.(); // World.spawnEntityInWorld: the end of loadedEntityList, walked by index, so a ball launched in the pass updates in it
    if (seq !== undefined) w.orderSeqs.set(ball, seq);
    w.tickOrder?.push(ball);
    return ball;
  }
  // The shooter is "dead" (setDead) when it is gone from the world: ze.h removes the ball then.
  ownerGone(b) {
    const o = b.owner;
    return !!o && o !== "player" && (!this.mobs.entities.includes(o) || (o.health <= 0 && (o.death ?? 0) >= 20));
  }
  // ze.h: setDead when !World.blockExists((int) posX, (int) posY, (int) posZ): y outside 0..255 (ahb.d tests 256 in every
  // dimension) or the chunk not loaded (resident or held by the ring). Finite worlds keep their solid-border rule instead.
  blockExists(b) {
    const x = Math.trunc(b.x), y = Math.trunc(b.y), z = Math.trunc(b.z), w = this.mobs.world;
    if (y < 0 || y >= 256) return false;
    return !w.streaming || w.isLoaded(x, z) || !!this.mobs.ring?.holds(x, z);
  }
  // The box ze.h leaves behind (setPosition at the end of the update): the ball's own feet position, or the constructor's on the first update.
  boxOf(b) {
    const [x, y, z] = b.ticks === 0 && b.boxPos ? b.boxPos : [b.x, b.y, b.z], r = b.width / 2;
    return [x - r, y, z - r, x + r, y + b.width, z + r];
  }
  tick() {
    for (const b of this.list) this.tickOne(b);
    this.reap();
  }
  reap() { this.list = this.list.filter((b) => !b.dead); }
  // EntityFireball.onUpdate for one ball.
  tickOne(b) { this.tickBall(b); if (!b.dead) stampEntity(b, b.x, b.y, b.z); } // b72: the re-slice after the update
  tickBall(b) {
    const mobs = this.mobs;
    if (b.dead || !mobs.isActive(b)) return; // World.updateEntityWithOptionalForce: +-32 blocks loaded (natural-spawning.md "Round 7")
    b.px = b.x; b.py = b.y; b.pz = b.z;
    if (this.ownerGone(b) || !this.blockExists(b)) { b.dead = true; return; }
    b.prevYaw = b.yaw ?? 0; b.prevPitch = b.pitch ?? 0; // Entity.onEntityUpdate (super.onUpdate, before the stuck test)
    const box = this.boxOf(b); // before ticksInAir counts: the first update still has the constructor's box
    // Entity.handleWaterMovement (sa.h, before the sweep): the box shrunk 0.4 vertically and 0.001 all round; water also pushes the ball 0.014 along its flow.
    const water = waterAcceleration(mobs.world, entityWaterBox(box));
    b.vx += water.push[0]; b.vy += water.push[1]; b.vz += water.push[2];
    serverBallSplash(mobs, b, water.wet, box[1], b.width); // b83 tracker83: sa.N's splash on entering water (not on the first update): S29 sound, the particle draws
    fireballBurn(b, water.wet, b.large); // b82 mpball82: the fire counter, the watched burning flag and (large ball) setBeenAttacked; then setFire(1)
    const was = b.inGround;
    if (was && this.stick(b)) return;
    if (!was) b.ticks++; // the let-go update resets ticksInAir to 0 and does not count it
    const start = [b.x, b.y, b.z], end = [b.x + b.vx, b.y + b.vy, b.z + b.vz];
    let hit = rayTraceBlocks(mobs.world, start, end), stop = hit ? hit.vec : end;
    const entity = this.sweep(b, start, stop, box);
    if (entity) { hit = { entity: entity.target }; aimPart(entity); }
    if (hit) this.impact(b, hit); // the update goes on: the ball still moves (it is only marked dead)
    // ze.h after the move: in water four bubbles at the new position minus a quarter of the old motion (moving with it), then the motion update, then the smoke at
    // (x, y + 0.5, z) of the NEW position (executed: spexec79 fire79; b79 moved the smoke here from before the move and added the bubbles).
    const [ovx, ovy, ovz] = [b.vx, b.vy, b.vz];
    fireballStep(b, water.wet, turnToMotion); // b82 mpball82: with ze.h's turn after the move, before the motion update (fireball-turn.js; render81 did the skulls; fireext82 had the same turn)
    if (water.wet) for (let i = 0; i < 4; i++) mobs.fx?.spawn("bubble", b.x - ovx * 0.25, b.y - ovy * 0.25, b.z - ovz * 0.25, ovx, ovy, ovz);
    mobs.fx?.spawn("smoke", b.x, b.y + 0.5, b.z, 0, 0, 0);
  }
  // ze.h's entity pass: every collidable entity box grown by 0.3 against the swept segment, the shooter skipped for 25 ticks; nearest wins.
  sweep(b, a, z, own = this.boxOf(b)) {
    const mobs = this.mobs, boxes = [];
    // World.getEntitiesWithinAABBExcludingEntity: the ball's box grown by its motion and by 1 each way (a stale box on the first update).
    const q = [own[0] + Math.min(b.vx, 0) - 1, own[1] + Math.min(b.vy, 0) - 1, own[2] + Math.min(b.vz, 0) - 1, own[3] + Math.max(b.vx, 0) + 1, own[4] + Math.max(b.vy, 0) + 1, own[5] + Math.max(b.vz, 0) + 1];
    const near = (c) => c[3] > q[0] && c[0] < q[3] && c[4] > q[1] && c[1] < q[4] && c[5] > q[2] && c[2] < q[5];
    for (const e of mobs.entities) {
      if (e === b.owner && b.ticks < FIREBALL.ownerGrace) continue; // ticksInAir < 25, the ball's own counter (a punch does not reset it)
      if (e.type === "ender_dragon") boxes.push(...dragonPartTargets(e)); // the parts are the collidable entities, not the 16 x 8 box
      else { const box = sweepBox(mobs, e, q, pushBox); if (box) boxes.push({ target: e, key: e, box }); } // a corpse still counts until it is removed (canBeCollidedWith = !isDead)
    }
    // b64: the dedicated server lists every player of the dimension (`mobs.sweepPlayers`, World.getEntitiesWithinAABBExcludingEntity sees them all); `view` names the one hit so the impact can hurt that player.
    for (const p of mobs.sweepPlayers ? mobs.sweepPlayers() : [mobs.ai?.player]) {
      if (p?.alive && !(b.owner === "player" && b.ticks < FIREBALL.ownerGrace)) { const box = pushBox(p, p.width, p.height); if (near(box)) boxes.push({ target: mobs.sweepPlayers ? { player: true, view: p } : { player: true }, key: p, player: true, box }); }
    }
    for (const o of this.list) { // EntityLargeFireball.canBeCollidedWith (the small one is not)
      if (o === b || o.dead || !o.large) continue;
      const box = this.boxOf(o);
      if (near(box)) boxes.push({ target: { ball: o }, key: o, box });
    }
    let best = null, bd = 0;
    const area = sweepArea(b);
    for (const c of orderTargets(boxes.filter((c) => !c.reach || c.reach(area)))) { // b72: chunk list order decides equal distances (candidate-order.js)
      if (c.reach && !c.reach(area)) continue; // a dragon part: the world lists it only for the dragon's own box and chunk (ze.h's query box)
      const g = SWEEP, box = [c.box[0] - g, c.box[1] - g, c.box[2] - g, c.box[3] + g, c.box[4] + g, c.box[5] + g], r = intercept(box, a, z);
      if (!r) continue;
      const d = Math.hypot(r.vec[0] - a[0], r.vec[1] - a[1], r.vec[2] - a[2]);
      if (d < bd || bd === 0) { bd = d; best = c; } // ze.h's own test: a distance of exactly 0 is replaced by the next hit
    }
    return best;
  }
  // zg.a(azu) / zi.a(azu), then setDead.
  impact(b, hit) {
    const mobs = this.mobs, owner = b.owner, byPlayer = owner === "player", from = byPlayer ? mobs.ai?.player : owner;
    const damage = (n) => {
      const t = hit.entity;
      if (t?.player) {
        const s = mobs.ai?.survival;
        return !!s && s.damage(n, "fireball", true, "fireball", owner && owner !== "player" ? owner : undefined); // the source entity is the shooter
      }
      if (t?.ball) return this.hitBall(t.ball, owner); // EntityFireball.attackEntityFrom from the other ball's DamageSource
      // DamageSource.causeFireballDamage(ball, shooter): the shooter is the source entity; without one (a dispenser's ball) it is the ball itself, which knocks back from its own
      // position and, for an EntityMob on the legacy action state, becomes the dead entityToAttack that the next update clears.
      return mobs.attackEntityFrom(t, n, { from: from ? { x: from.x, z: from.z } : { x: b.x, z: b.z }, player: byPlayer, attacker: owner && owner !== "player" ? owner : null, name: "fireball", fireball: true, ...(from ? {} : { entity: { x: b.x, y: b.y, z: b.z } }) });
    };
    if (b.large) {
      if (hit.entity) damage(FIREBALL.largeDamage);
      // The explosion is the world's (no exploder): the fireball's own position, `flaming`, and `smoking` while mobGriefing is on.
      mobs.events.push({ explode: { x: b.x, y: b.y, z: b.z, size: b.power, source: null, smoking: gameRule("mobGriefing"), flaming: true }, position: { x: b.x, y: b.y, z: b.z } });
    } else if (hit.entity) {
      const t = hit.entity;
      if (t.player) {
        if (damage(FIREBALL.smallDamage)) mobs.ai?.survival?.setFire(FIREBALL.smallFireSeconds);
      } else if (!FIRE_IMMUNE.has(t.type) && damage(FIREBALL.smallDamage)) setMobFire(t, FIREBALL.smallFireSeconds);
    } else {
      const [x, y, z] = faceCell(...hit.block, hit.side);
      if (mobs.world.get(x, y, z) === 0) mobs.ignite?.(x, y, z);
    }
    b.dead = true;
  }
  // ze.a(ro, F) for a damage source whose entity is `shooter`: the ball takes the shooter's look vector (motion and acceleration) and the shooter as its own.
  // b87 blast87: `shooter` may be a dedicated server's player record (a TNT he placed): the ball is then his as after a punch (owner "player", `punchedBy` him, ServerMobs.fireballWatch).
  hitBall(target, shooter) {
    if (!shooter || target.dead) return false;
    const look = this.lookOf(shooter);
    if (!look) return false;
    deflect(target, look);
    if (isServerPlayer(shooter)) { target.owner = "player"; target.punchedBy = shooter; } else target.owner = shooter;
    return true;
  }
  lookOf(e) {
    // b87 blast87: a server player's yaw and pitch are radians in the port's frame; rotationYaw = 180 - yaw in degrees, rotationPitch = -pitch (server-player-tracker.js).
    if (isServerPlayer(e)) return lookVector(Math.fround(180 - (e.yaw * 180) / Math.PI), Math.fround((-e.pitch * 180) / Math.PI), mhSin, mhCos);
    // b86 blastcover86: main.js playerLook gives rotationYaw / rotationPitch in degrees (playerEye), not a vector, so a player's TNT blast deflected a large ball to NaN; a replay
    // that hands a vector keeps it. getLookVec is EntityLivingBase.getLook(1.0F), the formula lookVector reproduces.
    if (e === "player") { const l = this.mobs.playerLook?.(); return !l ? null : Array.isArray(l) ? l : lookVector(l.yaw, l.pitch, mhSin, mhCos); }
    return lookVector(e.rotationYaw ?? 0, e.rotationPitch ?? 0, mhSin, mhCos);
  }
  // The ball EntityRenderer.getMouseOver picks (blt.a(F), composed over the real objects in FireballPickProbe, fireball-pick-reference.json): the ray is `reach` long
  // (3, or 6 in Creative), each large ball (EntityFireball.canBeCollidedWith; the small ball answers false) is grown by its collision border 1.0 (ze.af), and a hit
  // counts when Vec3.distanceTo (a float: MathHelper.sqrt_double) is below `wallDistance`, the block hit's distance. Candidates come from the viewer box grown by the
  // ray and (1, 1, 1) when `viewerBox` is given. A box that contains the eye answers at once with distance 0 and, as natively, any later ball the ray touches replaces it.
  pick(origin, dir, reach, wallDistance = reach, viewerBox = null) {
    const o = [origin.x ?? origin[0], origin.y ?? origin[1], origin.z ?? origin[2]], d = [dir.x ?? dir[0], dir.y ?? dir[1], dir.z ?? dir[2]];
    const end = [o[0] + d[0] * reach, o[1] + d[1] * reach, o[2] + d[2] * reach];
    const search = viewerBox && [
      Math.min(viewerBox[0], viewerBox[0] + d[0] * reach) - 1, Math.min(viewerBox[1], viewerBox[1] + d[1] * reach) - 1, Math.min(viewerBox[2], viewerBox[2] + d[2] * reach) - 1,
      Math.max(viewerBox[3], viewerBox[3] + d[0] * reach) + 1, Math.max(viewerBox[4], viewerBox[4] + d[1] * reach) + 1, Math.max(viewerBox[5], viewerBox[5] + d[2] * reach) + 1,
    ];
    const far = (v) => Math.fround(Math.sqrt((v[0] - o[0]) ** 2 + (v[1] - o[1]) ** 2 + (v[2] - o[2]) ** 2));
    let best = null, pickDist = 0, d2 = wallDistance;
    const cands = [];
    for (const b of this.list) if (!b.dead && b.large) cands.push({ key: b, ball: b, box: this.boxOf(b) });
    for (const { ball: b, box: raw } of orderTargets(cands)) { // b72: chunk list order decides equal distances (candidate-order.js)
      if (search && !(raw[3] > search[0] && raw[0] < search[3] && raw[4] > search[1] && raw[1] < search[4] && raw[5] > search[2] && raw[2] < search[5])) continue;
      const box = [raw[0] - PICK_BORDER, raw[1] - PICK_BORDER, raw[2] - PICK_BORDER, raw[3] + PICK_BORDER, raw[4] + PICK_BORDER, raw[5] + PICK_BORDER];
      const r = intercept(box, o, end);
      if (o[0] > box[0] && o[0] < box[3] && o[1] > box[1] && o[1] < box[4] && o[2] > box[2] && o[2] < box[5]) { // AxisAlignedBB.isVecInside
        if (d2 >= 0) { best = b; pickDist = r ? far(r.vec) : 0; d2 = 0; }
      } else if (r) {
        const dist = far(r.vec);
        if (dist < d2 || d2 === 0) { best = b; pickDist = dist; d2 = dist; }
      }
    }
    return best && d2 < wallDistance ? { entity: best, distance: pickDist } : null;
  }
  // The inGround branch of EntityFireball.onUpdate (executed in FireballProbe, fireballs-b41-reference.json), after super.onUpdate: while the block at the
  // stored tile is still the stored block the ball only counts ticksAlive (setDead on the 600th) and does nothing else; otherwise it lets go: inGround off,
  // each motion axis times the float nextFloat() * 0.2F on the ball's own Random, ticksAlive and ticksInAir reset, and the flight below goes on in the same update.
  // No 1.7.10 path sets inGround (the fields are only read), so nothing in the game calls `stickIn`; it is the tested rule for the day something does.
  stick(b) {
    const t = b.tile;
    if (t && this.mobs.world.get(t.x, t.y, t.z) === t.id) {
      if (++b.ticksAlive >= 600) b.dead = true;
      return true;
    }
    b.inGround = false;
    b.vx *= f(b.rand.nextFloat() * f(0.2)); b.vy *= f(b.rand.nextFloat() * f(0.2)); b.vz *= f(b.rand.nextFloat() * f(0.2));
    b.ticksAlive = 0; b.ticks = 0;
    return false;
  }
  stickIn(b, x, y, z) { b.inGround = true; b.tile = { x, y, z, id: this.mobs.world.get(x, y, z) }; }
  // ze.a(ro, F): a player's hit takes the ball: its motion becomes the look vector, the acceleration look * 0.1 and the player the shooter.
  punch(b, look) {
    if (b.dead || !b.large) return false; // EntityFireball.attackEntityFrom (ze.a) deflects; the small ball's override (zi.a) refuses
    deflect(b, look);
    b.owner = "player"; // ticksInAir goes on counting: the player is only skipped while the ball is under 25 ticks old
    return true;
  }
  // The browser save (main.js `active.fireballs`): the flight state of every live ball. The shooter is a mob id, "player" or absent. A ball
  // saved without its acceleration (an imported Java fireball: EntityFireball does not save it) keeps flying on its motion and slows.
  serialize(dimension = 0) {
    return this.list.filter((b) => !b.dead).map((b) => ({
      kind: b.kind, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, ax: b.ax, ay: b.ay, az: b.az, ticks: b.ticks, dimension,
      ...(b.large ? { power: b.power } : {}), ...(b.blue ? { blue: true } : {}),
      ...(b.owner === "player" ? { owner: "player" } : b.owner?.id ? { owner: b.owner.id } : {}),
      ...(Number.isInteger(b.fire) && b.fire !== 0 ? { fire: b.fire } : {}), // b84 cmdfix84: Entity.writeToNBT's Fire (20 after the first update: ze.h setFire(1))
      rotation: [b.yaw ?? 0, b.pitch ?? 0], // b82 fireext82: Entity.writeToNBT's Rotation, which every entity writes (render81 had it for the skulls only)
    }));
  }
  accepts(kind) { return kind === "fireball" || kind === "smallFireball"; }
  // The ball launch() would make, without its aim draw on the world's random.
  build(r) {
    const large = r.kind === "fireball";
    return {
      id: "fb-" + this.next++, type: "fireball", kind: r.kind, large, owner: null, health: 1,
      x: r.x, y: r.y, z: r.z, px: r.x, py: r.y, pz: r.z, vx: r.vx, vy: r.vy, vz: r.vz, ax: r.ax, ay: r.ay, az: r.az,
      power: large && Number.isInteger(r.power) ? r.power : FIREBALL.defaultPower, ticks: 0, dead: false,
      scale: large ? 2 : 0.5, fullbright: true, width: large ? FIREBALL.largeSize : FIREBALL.smallSize, ...savedRotation(r),
    };
  }
  // Restores the records of `dimension`; bad records are skipped. Call after the world's mobs exist (owners are looked up by id).
  load(list, dimension = 0) {
    this.list = [];
    const ok = Number.isFinite;
    for (const r of (Array.isArray(list) ? list : []).slice(0, 128)) {
      if (!r || !this.accepts(r.kind) || (r.dimension ?? 0) !== dimension || ![r.x, r.y, r.z, r.vx, r.vy, r.vz].every(ok)) continue;
      const ball = this.build({ ...r, ax: ok(r.ax) ? r.ax : 0, ay: ok(r.ay) ? r.ay : 0, az: ok(r.az) ? r.az : 0 });
      if (ok(r.ticks)) ball.ticks = Math.max(0, r.ticks | 0);
      if (r.blue === true) ball.blue = true;
      if (Number.isInteger(r.fire) && r.fire !== 0) ball.fire = Math.max(-32768, Math.min(32767, r.fire)); // b84 cmdfix84
      ball.owner = r.owner === "player" ? "player" : typeof r.owner === "string" ? this.mobs.entities.find((e) => e.id === r.owner) ?? null : null;
      this.list.push(ball);
    }
  }
}
