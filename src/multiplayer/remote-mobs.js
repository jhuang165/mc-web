// The client half of the dedicated world's mobs (batch 59 mpmobs). The server (server-mobs.js) sends the packets of its MobTracker for this player as JSON;
// each mob here is a ClientEntity (the client's EntityLiving copy: it applies S0F spawn, S14..S18 moves, S19 head, S12 velocity and S13 destroy, interpolates over
// three ticks and moves like moveEntityWithHeading(0, 0) on this world) plus a stand-in mob record the existing MobRenderer reads (limbs, hurt flash, baby, sheep colour,
// creeper swell). Positions and angles drawn are the copy's, as RenderManager draws them. The stand-ins come from EntityWorld.create, so every field the renderer reads exists.
import { EntityWorld, entityHit, hurtOf, deathOf, ENTITY_TYPES } from '../entities.js';
import { soundVolume } from '../combat.js';
import { statusPitchRandom } from '../damage-fx.js';
import { burst } from '../fx.js';
import { JavaRandom } from '../java-random.js';
import { ClientEntity } from '../entity-tracker.js';
import { EntityIds } from '../entity-ids.js';
import { slimeFields, slimeSquishStart, slimeSquishEnd } from '../slime.js';

// The sound names the server's S29 may carry for the mobs (WorldServer.playSoundAtEntity: living, hurt, death, step, the creeper's fuse and blast, the skeleton's bow, the egg's plop).
export const isMobSound = name => typeof name === 'string' && /^(mob\.[a-z.]+|creeper\.primed|random\.(explode|bow|pop|eat|burp)|step\.[a-z]+)$/.test(name);
const HURT_TICKS = 10, DEATH_TICKS = 20;

// `fx` (batch 60): { sound(name, x, y, z, volume, pitch), particle(name, x, y, z, vx, vy, vz) }, what the copies make that the game draws and plays (main.js).
export class RemoteMobs {
  constructor(world, fx = {}) {
    this.world = world;
    this.fx = fx;
    this.rand = new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48))); // the copies' Entity.rand for the heart and smoke bursts
    this.factory = new EntityWorld(world, [], Math.random, new EntityIds()); // stand-in records and the client movement code; it never ticks mobs
    const f = this.factory;
    this.physics = Object.assign((c, m) => f.moveClient(c, m), { turn: (c, m) => f.clientAfterMove(c, m), pre: (c, m) => f.clientEnvironment(c, m), living: (c, m) => f.clientLiving(c, m) }); // b61 lead: the living roll moved out of clientEnvironment (mobcopies2)
    this.copies = new Map(); // wire id -> { client, mob }
    this.ctx = { clientOf: id => this.copies.get(id)?.client ?? null, holderOf: () => null }; // S1B(0): the vehicle named by wire id (a spider jockey's skeleton)
  }
  // The `mobs` message of one server tick: packets in the order the server queued them.
  apply(packets) {
    for (const p of packets) {
      if (p.type === 'spawn') {
        if (!p.mob) continue;
        const mob = this.factory.create(p.mob, p.x / 32, p.y / 32, p.z / 32), client = new ClientEntity(p.mob);
        mob.id = 'mob-' + p.i;
        this.state(mob, p); // first: a slime's size and a horse's type decide the box
        client.apply(p, this.ctx);
        if (client.dragon) mob.dragon = client.dragon; // b64 mpdragon: the copy's own state (ring, wings, seven part boxes) is what the renderer and the aim read
        client.height = this.factory.size(mob)[1];
        this.copies.set(p.i, { client, mob });
        continue;
      }
      const c = this.copies.get(p.i);
      if (!c) continue;
      if (p.type === 'mobStatus') this.status(c, p.status);
      else if (p.type === 'state') this.state(c.mob, p);
      else if (p.type === 'attach') this.attach(c, p);
      else {
        c.client.apply(p, this.ctx);
        if (!c.client.present) this.copies.delete(p.i);
      }
    }
  }
  // S1B(0) from the server (batch 61, mob on mob): the copy mounts the vehicle's copy (or gets off); the stand-in follows for the riding legs.
  attach(c, p) {
    if (p.mode === 1) { c.mob.leadWire = p.holder ?? null; return; } // b62: S1B(1), the lead (remote-leads.js draws it)
    c.client.apply({ type: 'attach', mode: 0, vehicle: p.vehicle }, this.ctx);
    c.mob.ridingEntity = p.vehicle === null || p.vehicle === undefined ? null : this.copies.get(p.vehicle)?.mob ?? null;
  }
  // S19 entity status on the copy (EntityLivingBase.handleHealthUpdate): 2 hurt and 3 death play their sound at the copy, pitch (r - r) * 0.2 + 1, volume getSoundVolume;
  // 6 smoke, 7 and 18 hearts are 7 particles on the copy's own Random (EntityAnimal / EntityTameable.func_70908_e).
  status({ client, mob }, status) {
    const at = { x: client.x, y: client.y, z: client.z };
    if (status === 2 || status === 3) {
      if (status === 2) mob.hurt = HURT_TICKS;
      const name = (status === 2 ? hurtOf : deathOf)(mob);
      if (name) this.fx.sound?.(name, at.x, at.y, at.z, soundVolume(mob.type), statusPitchRandom());
    } else if (status === 10) { if (mob.type === 'sheep') mob.eatTimer = 40; // EntitySheep.handleHealthUpdate(10): sheepTimer = 40, the head graze
    } else if (status === 6 || status === 7 || status === 18) {
      if (status === 18) mob.love = 600; // the copy knows it is in love (EntityAnimal.inLove is not watched; the client only hears status 18)
      const t = ENTITY_TYPES[mob.type] ?? { width: 0.6, height: 1.8 };
      burst({ spawn: (...a) => this.fx.particle?.(...a) }, status === 6 ? 'smoke' : 'heart', 7, { ...at, width: t.width, height: t.height }, this.rand, 0.5);
    }
  }
  // The data watcher values the copy shows (mobState on the server).
  state(mob, s) {
    const wasHurt = mob._hurt, dead = !!s.dead;
    mob._hurt = !!s.hurt;
    if (mob._hurt && !wasHurt) mob.hurt = HURT_TICKS;
    if (dead && mob.health > 0) { mob.health = 0; mob.death = 0; }
    mob.growingAge = s.baby ? -24000 : 0;
    mob.burn = s.burn ? 1 : 0;
    // batch 61: the other kinds' watched objects (server-mobs.js mobState)
    if (mob.type === 'zombie') mob.villager = !!s.villager;
    else if (mob.type === 'enderman') { mob.carried = s.carried ?? 0; mob.carriedData = s.carriedData ?? 0; mob.screaming = !!s.screaming; }
    else if (mob.type === 'slime' || mob.type === 'magma_cube') { if ((s.size ?? 1) !== mob.size) Object.assign(mob, slimeFields(s.size ?? 1, () => 0)); }
    else if (mob.type === 'witch') mob.held = s.held ? { ...s.held, count: 1 } : null;
    else if (mob.type === 'wolf') { mob.owner = s.tamed ? 'owner' : ''; mob.angry = !!s.angry; mob.sitting = !!s.sitting; mob.collar = s.collar ?? 14; if (!dead && s.hp) mob.health = s.hp; }
    else if (mob.type === 'ocelot') { mob.catType = s.cat ?? 0; mob.owner = s.tamed ? 'owner' : ''; mob.sitting = !!s.sitting; mob.sneaking = !!s.sneaking; mob.sprinting = !!s.sprinting; }
    else if (mob.type === 'horse' && s.horse) mob.horse = { ...(mob.horse ?? {}), type: s.horse.type, variant: s.horse.variant, armor: s.horse.armor, saddled: !!s.horse.saddled, chested: !!s.horse.chested };
    else if (mob.type === 'bat') mob.batHanging = !!s.hang;
    if (mob.type === 'sheep') { mob.color = s.color ?? 0; mob.sheared = !!s.sheared; }
    if (mob.type === 'pig') mob.saddled = !!s.saddled;
    if (mob.type === 'wither') { if (s.hy) { mob.prevHeadYaw = [...(mob.headYaw ?? s.hy)]; mob.headYaw = [...s.hy]; } if (s.hpi) { mob.prevHeadPitch = [...(mob.headPitch ?? s.hpi)]; mob.headPitch = [...s.hpi]; } } // b63: the side heads' angles (wither-boss-renderer.js reads headYaw / headPitch)
    if (mob.type === 'creeper') { mob.fuseTime = s.fuse ?? 0; mob.lastActive = s.last ?? 0; mob.powered = !!s.powered; }
  }
  // One client tick (the game's 20 per second): every copy steps, then its stand-in follows it.
  tick() {
    for (const { client, mob } of this.copies.values()) {
      client.dead = mob.health <= 0;
      if (mob.type === 'wither') { mob.invul = client.invul ?? 0; mob.renderYawOffset = client.renderYawOffset; if (client.health !== undefined && mob.health > 0) mob.health = client.health; } // b63: watchers 20 (Invul) and 6 (health) arrive in S0F / S1C (copy-meta.js); the boss bar reads the health; the model turns by the body yaw of the copy (animateWither reads e.renderYawOffset)
      if (mob.type === 'ender_dragon') { if (client.health !== undefined && mob.health > 0) mob.health = client.health; } // b64 mpdragon: watcher 6 (S0F / S1C) feeds the boss bar and the death branch
      else if (mob.type === 'ender_crystal') mob.innerRotation = client.innerRotation; // the copy's spin
      const slime = mob.type === 'slime' || mob.type === 'magma_cube';
      if (slime) slimeSquishStart(mob); // EntitySlime.onUpdate runs on the client copy too: the squish and the landing particles (the sounds come from the server's S29)
      client.step((c) => this.physics(c, mob), (c) => this.physics.turn(c, mob), (c) => this.physics.pre(c, mob), (c) => this.physics.living?.(c, mob)); // batch 61: the potion swirl and the living roll follow the death update (entities.js clientLiving)
      mob.px = mob.x; mob.py = mob.y; mob.pz = mob.z;
      if (slime) { mob.onGround = client.onGround; slimeSquishEnd(mob, this.rand, (dx, dz) => this.fx.particle?.('slime', client.x + dx, client.y, client.z + dz, 0, 0, 0), () => {}); }
      mob.x = client.x; mob.y = client.y; mob.z = client.z;
      for (const x of client.fx.splice(0)) if (x.particle) this.fx.particle?.(x.particle, x.x, x.y, x.z, x.vx ?? 0, x.vy ?? 0, x.vz ?? 0); // the death poof (death-fx.js)
      mob.age++;
      if (mob.love > 0) mob.love--; // EntityAnimal.onLivingUpdate counts inLove down (adults only: a baby has none)
      if (mob.eatTimer > 0) mob.eatTimer--; // EntitySheep.sheepTimer
      if (mob.hurt > 0) mob.hurt--;
      if (mob.health <= 0 && mob.death < DEATH_TICKS && mob.type !== 'ender_dragon') mob.death++; // the dragon dies by its own 200 tick sequence (dragon.js), it never lies down
      this.factory.swingLimbs(mob);
    }
  }
  // The stand-ins to draw, with the client copy's position for RenderManager's partial tick.
  list() { return [...this.copies.values()].map(c => c.mob); }
  clientOf(mob) { for (const c of this.copies.values()) if (c.mob === mob) return c.client; return null; }
  // EntityRenderer.getMouseOver on the client world's mob boxes: the nearest copy the ray reaches. Returns { id, entity, distance } or null.
  pick(origin, dir, reach) {
    let best = null;
    for (const [id, { mob }] of this.copies) {
      if (mob.health <= 0) continue;
      const distance = entityHit(origin, dir, mob, reach);
      if (distance !== null && (!best || distance < best.distance)) best = { id, entity: mob, distance };
    }
    return best;
  }
}
