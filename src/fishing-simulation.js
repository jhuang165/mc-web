// Runtime for the fishing rod: one live EntityFishHook per player (fishing.js), cast and reeled in by the
// rod's right click (ItemFishingRod.onItemRightClick, acv.a), ticked with the entity simulation, saved with
// the world. main.js supplies `host` (world, position, sounds, particles, mobs, orbs, item drops); see
// public/research/fishing.md.
import { FishHook, mcAngles } from './fishing.js';
import { FISHING_ROD, rodState } from './fishing-content.js';
import { GaussianRandom } from './projectiles.js';
import { getLuckOfTheSeaModifier, getLureModifier } from './enchantments.js';

const f = Math.fround;
const newRand = () => new GaussianRandom(Math.floor(Math.random() * 2 ** 48));

export class Fishing {
  constructor() {
    this.hook = null;
    this.ids = null; // the shared EntityIds (main.js): the hook takes its entity id when it is cast or loaded (Entity.<init>)
    this.events = [];
    this.particleRand = newRand();
  }
  get active() { return !!this.hook && !this.hook.dead; }
  sync() { rodState.cast = this.active; }
  clear() { this.hook = null; this.events = []; this.sync(); }
  // The EntityPlayer side of the hook's env: position (feet), whether it still holds the rod, enchantments.
  playerOf(host) {
    const held = host.survival.held;
    const rod = held?.id === FISHING_ROD;
    return {
      x: host.position.x, y: host.position.y, z: host.position.z,
      valid: host.survival.health > 0 && rod,
      luck: rod ? getLuckOfTheSeaModifier(held) : 0, lure: rod ? getLureModifier(held) : 0,
    };
  }
  // WorldServer.func_147487_a (S2APacketParticles on the client): count 0 is one particle moving at
  // speed * offset, otherwise `count` particles with gaussian offsets and velocities. "wake" has no
  // browser particle (EntityFishWakeFX) and is skipped.
  particle(host, name, x, y, z, count, dx, dy, dz, speed) {
    if (name === 'wake') return;
    const g = () => this.particleRand.nextGaussian();
    if (count === 0) { host.fx.spawn(name, x, y, z, speed * dx, speed * dy, speed * dz); return; }
    for (let i = 0; i < count; i++) host.fx.spawn(name, x + g() * dx, y + g() * dy, z + g() * dz, g() * speed, g() * speed, g() * speed);
  }
  env(host) {
    const mobs = host.mobs, targets = () => host.targets();
    return {
      world: host.world,
      player: this.playerOf(host),
      canLightningStrike: host.canLightningStrike,
      canSeeSky: host.canSeeSky,
      sound: (name, volume, pitch) => host.sound(name, volume, pitch, this.hook),
      particle: (...a) => this.particle(host, ...a),
      entities: (area) => targets().filter((t) => t.box[0] < area[3] && t.box[3] > area[0] && t.box[1] < area[4] && t.box[4] > area[1] && t.box[2] < area[5] && t.box[5] > area[2])
        .map((t) => ({ ref: t.ref, box: t.box, angler: !!t.thrower })),
      // The angler is never hooked here (the build has no self-pull); mobs take a zero-damage thrown hit.
      hitEntity: (ref) => ref?.playerTarget ? (host.hitPlayer?.(ref.playerTarget) ?? false) : !!mobs && mobs.entities?.includes(ref) && host.hit(ref), // b66 mpsleep: another player (server only)
      entityState: (ref) => {
        if (!mobs?.entities?.includes(ref)) return null;
        const t = targets().find((e) => e.ref === ref);
        return t ? { x: ref.x, z: ref.z, minY: t.box[1], height: t.box[4] - t.box[1] } : null;
      },
      worldRand: host.worldRand,
    };
  }
  // ItemFishingRod.onItemRightClick. Returns 'reel', 'cast' or null (nothing held).
  use(host) {
    const held = host.survival.held;
    if (held?.id !== FISHING_ROD) return null;
    if (this.active) {
      const out = this.hook.retrieve(this.env(host));
      this.reelOut(host, out);
      this.hook = null;
      this.sync();
      return 'reel';
    }
    this.hook = null;
    // World.playSoundAtEntity "random.bow" 0.5, 0.4 / (itemRand * 0.4 + 0.8); the hook spawns server side.
    host.sound('random.bow', 0.5, f(0.4 / f(f(host.itemRand.nextFloat() * f(0.4)) + f(0.8))), null);
    const a = mcAngles(host.yaw, host.pitch);
    this.hook = FishHook.cast(newRand(), { x: host.position.x, y: host.position.y, z: host.position.z, yaw: a.yaw, pitch: a.pitch });
    if (this.ids) this.hook.entityId = this.ids.take();
    this.sync();
    return 'cast';
  }
  reelOut(host, out) {
    if (out.pull) host.pull(out.pull.ref, out.pull.add);
    if (out.drop) {
      const d = out.drop;
      host.drop(d.stack, d.x, d.y, d.z, [d.vx, d.vy, d.vz]);
      host.orb(out.orb);
      this.events.push({ stat: out.stat, kind: out.kind });
    }
    if (out.cost > 0) host.wear(out.cost);
  }
  tick(host) {
    if (!this.hook) return;
    if (!this.hook.tick(this.env(host))) this.hook = null;
    this.sync();
  }
  serialize() { return this.hook && !this.hook.dead ? this.hook.serialize() : null; }
  load(data) {
    this.clear();
    if (data) { this.hook = FishHook.load(data, newRand()); if (this.ids) this.hook.entityId = this.ids.take(); }
    this.sync();
  }
}
