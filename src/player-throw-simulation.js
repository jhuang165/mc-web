// Browser-independent thrown-item use and bow release (see public/research/simulation.md).
// `state` carries the live mutable player state; scene/audio/UI effects are synchronous
// hooks run at the original main.js call sites, so live ordering is unchanged.
import { BOW, releaseBow } from "./bow.js";

export const SNOWBALL = 312, EGG = 316;
// The thrown items this build implements (ItemSnowball, ItemEgg).
export const isThrowable = (id) => id === SNOWBALL || id === EGG;

// ItemSnowball.onItemRightClick (aed.a): take one unless Creative, play random.bow at 0.5
// volume and pitch 0.4 / (rand * 0.4 + 0.8), spawn the ball. ItemEgg.onItemRightClick
// (ack.a) is identical with an EntityEgg. Minecraft.rightClickMouse swings only for blocks
// that consume the click, and resets the equip animation (resetEquippedProgress2) only
// when the stack changed, so Creative throws neither swing nor dip the hand.
// The pitch draw precedes the projectile's Entity.rand seed draw from `projectiles.random`.
export function throwHeldItem(state, id, hooks = {}) {
  const random = hooks.random ?? Math.random, hook = (name, ...args) => hooks[name]?.(...args);
  const pitch = 0.4 / (random() * 0.4 + 0.8);
  hook("playSound", "random.bow", { volume: 0.5, pitch });
  const ball = id === EGG
    ? state.projectiles.throwEgg(state.position, state.yaw, state.pitch)
    : state.projectiles.throwSnowball(state.position, state.yaw, state.pitch);
  if (!state.survival.creative) {
    state.survival.take(id);
    hook("resetEquipped");
    hook("renderHotbar");
    hook("markUnsaved");
  }
  return { kind: ball.kind, ball };
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
