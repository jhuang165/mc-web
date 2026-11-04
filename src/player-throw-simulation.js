// Browser-independent thrown-item use and bow release (see public/research/simulation.md).
// `state` carries the live mutable player state; scene/audio/UI effects are synchronous
// hooks run at the original main.js call sites, so live ordering is unchanged.
import { BOW, releaseBow } from "./bow.js";

export const SNOWBALL = 312, EGG = 316, ENDER_PEARL = 378;
// The thrown items this build implements (ItemSnowball, ItemEgg, ItemEnderPearl).
export const isThrowable = (id) => id === SNOWBALL || id === EGG || id === ENDER_PEARL;

// ItemSnowball.onItemRightClick (aed.a) and ItemEgg.onItemRightClick (ack.a): play
// random.bow at 0.5 volume/pitch 0.4 / (rand * 0.4 + 0.8), spawn, then consume one
// unless Creative. ItemEnderPearl (aco.a) differs: Creative returns before sound,
// spawn or consumption; Survival decrements before its sound and only the native
// server side spawns the entity. The browser app is single-sided and creates its
// local projectile. The sound-pitch draw precedes the projectile Entity.rand seed.
export function throwHeldItem(state, id, hooks = {}) {
  if (!isThrowable(id)) throw new TypeError(`Unsupported thrown item id: ${id}`);
  const random = hooks.random ?? Math.random, hook = (name, ...args) => hooks[name]?.(...args);
  const pearl = id === ENDER_PEARL;
  // ItemEnderPearl returns immediately in Creative: no stack decrement, sound
  // or entity spawn. Snowball/egg Creative use deliberately stays unchanged.
  if (pearl && state.survival.creative) return { kind: "enderPearl", ball: null, consumed: false, blocked: true };
  // aco.a decrements the survival stack before its sound and spawn calls.
  if (pearl) state.survival.take(id);
  const roll = random(), f = Math.fround;
  const pitch = pearl ? f(f(0.4) / f(f(f(roll) * f(0.4)) + f(0.8))) : 0.4 / (roll * 0.4 + 0.8);
  hook("playSound", "random.bow", { volume: 0.5, pitch });
  const ball = pearl
    ? state.projectiles.throwEnderPearl(state.position, state.yaw, state.pitch, "player")
    : id === EGG
    ? state.projectiles.throwEgg(state.position, state.yaw, state.pitch)
    : state.projectiles.throwSnowball(state.position, state.yaw, state.pitch);
  if (!pearl && !state.survival.creative) {
    state.survival.take(id);
  }
  if (!state.survival.creative) {
    hook("resetEquipped");
    hook("renderHotbar");
    hook("markUnsaved");
  }
  return { kind: ball.kind, ball, ...(pearl ? { consumed: true } : {}) };
}

// ItemBow.onPlayerStoppedUsing: the use button was let go after `eating.ticks` ticks of
// draw. The draw always ends; a shot needs the playing screen and the bow still held.
// releaseBow owns power, velocity, crit, durability, arrow consumption and Creative rules;
// flushArrows then plays its queued random.bow and redraws the arrows.
export function releaseHeldBow(state, hooks = {}) {
  const hook = (name, ...args) => hooks[name]?.(...args);
  const draw = state.eating;
  if (!draw?.bow) return { released: false, branch: "not-drawing" };
  state.eating = null;
  if (state.screen !== "playing" || (state.survival.held?.id || 0) !== BOW) return { released: false, branch: "draw-cancelled" };
  const arrow = releaseBow({ survival: state.survival, arrows: state.arrows, ticks: draw.ticks,
    feet: state.position, yaw: state.yaw, pitch: state.pitch });
  if (!arrow) return { released: false, branch: "no-shot", ticks: draw.ticks };
  hook("flushArrows");
  hook("renderHotbar");
  hook("markUnsaved");
  return { released: true, branch: "release-arrow", ticks: draw.ticks, arrow };
}
