// Live eye of ender: the in-flight EntityEnderEye list and the ItemEnderEye use (right click in air or on a frame).
// Rules and evidence live in eye-of-ender.js and public/research/eye-of-ender.md.
import { JavaRandom } from "./java-random.js";
import { ITEM_EYE_OF_ENDER, END_PORTAL_FRAME, createEye, moveTowards, tickEye, shatterEffects, useEyeOnFrame, nearestStronghold, hasEye } from "./eye-of-ender.js";

const f = Math.fround;

// Stronghold coordList of the world in LOCAL block coordinates (the population keeps native chunk coordinates),
// or [] when the world has no structure manager (legacy and flat worlds).
export function localStrongholds(world) {
  const cache = world.population?.structureCache;
  if (!cache?.strongholdPositions) return [];
  return cache.strongholdPositions();
}
// World.findClosestStructure("Stronghold", x, y, z) in local coordinates, or null.
export function findStronghold(world, x, y, z) {
  const ox = world.originX ?? 0, oz = world.originZ ?? 0, hit = nearestStronghold(localStrongholds(world), x + ox, y, z + oz);
  return hit ? [hit[0] - ox, hit[1], hit[2] - oz] : null;
}

export class EyesOfEnder {
  constructor(random = new JavaRandom(Math.floor(Math.random() * 2 ** 48))) {
    this.random = random;
    this.eyes = [];
  }
  // ItemEnderEye.onItemRightClick: spawn at the player's feet (posY + 1.62 - yOffset 1.62) heading for `target`.
  launch(x, y, z, target) {
    const eye = createEye(x, y, z);
    moveTowards(eye, target[0], target[1], target[2], this.random);
    this.eyes.push(eye);
    return eye;
  }
  // 20 Hz. hooks: particle(name,x,y,z,vx,vy,vz), drop(stack,x,y,z), inWater(x,y,z).
  tick(hooks = {}) {
    for (const eye of this.eyes) {
      const { particles, end } = tickEye(eye, this.random, { inWater: !!hooks.inWater?.(eye.x, eye.y, eye.z) });
      for (const p of particles) hooks.particle?.(p.name, p.x, p.y, p.z, p.vx, p.vy, p.vz);
      if (end?.drop) hooks.drop?.({ id: ITEM_EYE_OF_ENDER, count: 1, damage: 0 }, end.drop.x, end.drop.y, end.drop.z);
      if (end?.shatter) for (const p of shatterEffects(end.shatter.x, end.shatter.y, end.shatter.z, this.random)) hooks.particle?.(p.name, p.x, p.y, p.z, p.vx, p.vy, p.vz);
    }
    this.eyes = this.eyes.filter((e) => !e.dead);
  }
  // Renderer rows ({kind, x, y, z, px, py, pz}) shared with the snowball billboards.
  get balls() { return this.eyes.map((e) => (e.ball ??= { kind: "eyeOfEnder" }, Object.assign(e.ball, { x: e.x, y: e.y, z: e.z, px: e.px, py: e.py, pz: e.pz }))); }
  serialize() { return { random: this.random.save(), eyes: this.eyes.map(({ ball, ...e }) => e) }; }
  load(record) {
    this.eyes = [];
    if (!record || typeof record !== "object") return;
    if (record.random) this.random.restore(record.random);
    const keys = ["x", "y", "z", "px", "py", "pz", "vx", "vy", "vz", "yaw", "pitch", "prevYaw", "prevPitch", "tx", "ty", "tz", "age"];
    for (const e of Array.isArray(record.eyes) ? record.eyes : []) {
      if (!e || !keys.every((k) => Number.isFinite(e[k]))) continue;
      this.eyes.push({ ...Object.fromEntries(keys.map((k) => [k, e[k]])), drops: !!e.drops, dead: false });
    }
  }
}

// Called from applyPlayerEdit for a right click holding an eye of ender. Returns null when a clicked block takes the
// click first (station blocks), else { branch, ... }.
//   ItemEnderEye.onItemUse: a frame without an eye takes it (stack -1 outside Creative; Creative keeps the stack because
//   ItemInWorldManager restores it - bytecode-derived), smoke particles and the ring check follow.
//   ItemEnderEye.onItemRightClick: not aimed at a frame -> nearest stronghold, spawn the eye, random.bow, aux 1002,
//   stack -1 outside Creative. No stronghold: nothing happens and nothing is consumed.
export function useEyeOfEnder(state, { target, usesBlock }, hooks = {}) {
  const hook = (name, ...args) => hooks[name]?.(...args), world = state.world, creative = state.survival.creative;
  const rand = state.itemRand ?? new JavaRandom(Math.floor(Math.random() * 2 ** 48));
  if (usesBlock) return null;
  const block = target ? world.get(...target.block) : 0;
  if (block === END_PORTAL_FRAME) {
    const [x, y, z] = target.block;
    if (hasEye(world.getMeta(x, y, z))) return { branch: "frame-has-eye" };
    const used = useEyeOnFrame(world, x, y, z, {
      setMeta: (px, py, pz, meta) => { world.set(px, py, pz, END_PORTAL_FRAME, true, meta); hook("updateBlock", px, pz, py); },
      set: (px, py, pz, id) => { world.set(px, py, pz, id, true, 0); hook("updateBlock", px, pz, py); },
      particle: (name, px, py, pz, vx, vy, vz) => hook("particle", name, px, py, pz, vx, vy, vz),
    }, rand);
    hook("swing");
    if (!creative) state.survival.take(ITEM_EYE_OF_ENDER);
    hook("renderHotbar"); hook("markUnsaved");
    return { branch: "eye-on-frame", portal: !!used?.portal };
  }
  const p = state.position, goal = findStronghold(world, Math.trunc(p.x), Math.trunc(p.y), Math.trunc(p.z));
  if (!goal) return { branch: "no-stronghold" };
  state.eyes.launch(p.x, p.y, p.z, goal);
  hook("playSound", "random.bow", { volume: 0.5, pitch: f(f(0.4) / f(f(f(rand.nextFloat()) * f(0.4)) + f(0.8))) });
  if (!creative) state.survival.take(ITEM_EYE_OF_ENDER);
  hook("renderHotbar"); hook("markUnsaved");
  return { branch: "launch-eye", target: goal };
}
