// Live firework rockets: ItemFirework.onItemUse, the dispenser behaviour (ky), /summon FireworksRocketEntity and the
// 20 Hz tick that turns a finished rocket into an EntityFireworkStarterFX (status 17, World.makeFireworks).
// Rules: firework-rocket.js, particles: firework-particles.js. Evidence: public/research/fireworks.md.
import { JavaRandom } from './java-random.js';
import { createRocket, tickRocket } from './firework-rocket.js';
import { ITEM_FIREWORK_ROCKET, normalizeFireworks } from './fireworks.js';
const f = Math.fround;

const ROWS = new WeakMap(); // one renderer row per entity (or view)
export class FireworkRockets {
  constructor(random = new JavaRandom(Math.floor(Math.random() * 2 ** 48))) {
    this.random = random;
    this.rockets = [];
  }
  // new EntityFireworkRocket(world, x, y, z, stack).
  launch(x, y, z, stack) {
    const r = createRocket(x, y, z, stack, this.random);
    this.rockets.push(r);
    this.joined?.(r); // entity-simulation.js (the away run's walk): the rocket's place in World.loadedEntityList
    return r;
  }
  // hooks: world (collisions), sound(name,x,y,z,volume,pitch,delay), spark(x,y,z,vx,vy,vz), explode(x,y,z,vx,vy,vz,fireworks).
  // The integrated game is server and client at once: one tick draws the spark trail and makes the death.
  // `ringActive(rocket)` (EntityFireworkRocket updates only where World.updateEntityWithOptionalForce's 32-block test holds) and
  // `tracked(rocket)` (status 17 reaches only a tracking client, 64 blocks; ring-events.js) are optional hooks.
  // With `hooks.clientCopies` the trail and the explosion belong to the client's copy (object-tracker.js: the rocket's client onUpdate and the S1A 17):
  // the server rocket draws no sparks and hooks.explode is not called.
  tick(world, hooks = {}) {
    for (const r of this.rockets) this.tickOne(world, r, hooks);
    this.reap();
  }
  // One rocket's update, where a walk that holds every kind in one list reaches it (away-entities.js).
  tickOne(world, r, hooks = {}) {
    if (r.dead || (hooks.ringActive && !hooks.ringActive(r))) return;
    const out = tickRocket(r, world, this.random, { remote: !hooks.clientCopies, server: true });
    if (out.launch) hooks.sound?.('fireworks.launch', r.x, r.y, r.z, 3, 1, false);
    if (out.spark) hooks.spark?.(...out.spark);
    if (out.explode && !hooks.clientCopies && (!hooks.tracked || hooks.tracked(r))) hooks.explode?.(out.explode.x, out.explode.y, out.explode.z, out.explode.vx, out.explode.vy, out.explode.vz, out.explode.fireworks);
  }
  reap() { this.rockets = this.rockets.filter((r) => !r.dead); }
  // Renderer rows ({kind, x, y, z, px, py, pz}) shared with the snowball billboards (RenderSnowball(Items.fireworks)).
  get balls() { return this.rows(this.rockets); }
  // The rows of rockets or of their client views (object-tracker.js objectView)
  rows(list) { return list.map((r) => { const row = ROWS.get(r) ?? ROWS.set(r, { kind: 'firework' }).get(r); return Object.assign(row, { x: r.x, y: r.y, z: r.z, px: r.px, py: r.py, pz: r.pz }); }); }
  serialize() { return { random: this.random.save(), rockets: this.rockets.map(({ ball, box, ...r }) => r) }; }
  load(record) {
    this.rockets = [];
    if (!record || typeof record !== 'object') return;
    if (record.random) this.random.restore(record.random);
    const keys = ['x', 'y', 'z', 'px', 'py', 'pz', 'mx', 'my', 'mz', 'yaw', 'pitch', 'prevYaw', 'prevPitch', 'life', 'lifetime'];
    for (const e of Array.isArray(record.rockets) ? record.rockets : []) {
      if (!e || !keys.every((k) => Number.isFinite(e[k]))) continue;
      const r = createRocket(e.x, e.y, e.z, e.stack ? { id: ITEM_FIREWORK_ROCKET, fireworks: normalizeFireworks(e.stack.fireworks) ?? undefined } : null, new JavaRandom(0));
      Object.assign(r, Object.fromEntries(keys.map((k) => [k, e[k]])));
      this.rockets.push(r);
    }
  }
}

// ItemFirework.onItemUse (acs.a): server side only; the rocket appears at the click point and one rocket is used up
// outside Creative. `target.hit` is the absolute hit point; the original adds the float hit offsets to the block.
export function useFirework(state, { target, usesBlock }, hooks = {}) {
  if (usesBlock || !target || !state.rockets) return null;
  const stack = state.survival.held, creative = state.survival.creative;
  const [bx, by, bz] = target.block, hit = target.hit ?? [bx + 0.5, by + 0.5, bz + 0.5];
  state.rockets.launch(bx + f(hit[0] - bx), by + f(hit[1] - by), bz + f(hit[2] - bz), stack);
  hooks.swing?.();
  if (!creative) state.survival.take(ITEM_FIREWORK_ROCKET);
  hooks.renderHotbar?.(); hooks.markUnsaved?.();
  return { branch: 'launch-firework' };
}

// BehaviorDispenseFirework (ky): at the front face centre, y = (float) block y + 0.2, one rocket taken from the stack.
export function dispenseFirework(rockets, x, y, z, frontX, frontZ, stack) {
  return rockets.launch(x + 0.5 + frontX, f(y + f(0.2)), z + 0.5 + frontZ, stack);
}

// /summon FireworksRocketEntity {FireworksItem:{id:401,Count:1,tag:{Fireworks:{...}}}}: `item` is a browser stack record.
export function summonFirework(rockets, x, y, z, item) {
  return rockets.launch(x, y, z, item ?? { id: ITEM_FIREWORK_ROCKET, count: 1, damage: 0 });
}
