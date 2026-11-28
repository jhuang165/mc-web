// b101 console101: EntityLivingBase.swingItem (sv.ba, bytecode-read) runs its body, and so sends S0B(0) to the trackers, only when
//   !isSwingInProgress || swingProgressInt >= getArmSwingAnimationEnd() / 2 || swingProgressInt < 0
// and sv.bb (updateArmSwingProgress) adds one per update, ending the swing at progress >= end. The end (sv.j) is 6, 6 - (amp + 1) with Haste, 6 + (amp + 1) * 2 with Mining Fatigue.
// The client sends a C0A for every click, so a fast clicker is answered only every 4th tick (end 6: progress 3 is reached on the 4th tick after the accepted one).
// The port's `p.swing` is 6 on the tick a swing was accepted and counts down once a tick (progress = 5 - swing, -1 right after the accept), so `p.swing = 6` is the accept
// and is only taken when the native condition holds. The count stays at 0 once down, so a swing at 0 is accepted (exact up to an end of 11, i.e. Mining Fatigue III and beyond differ).
export const swingEnd = (p) => {
  const list = p.survival?.effects?.ordered ? [...p.survival.effects.ordered()] : [], haste = list.find((e) => e.id === 3), slow = list.find((e) => e.id === 4);
  return haste ? 6 - (1 + haste.amplifier) : slow ? 6 + (1 + slow.amplifier) * 2 : 6;
};
/** b102 console102: sv.ba's test on the explicit native counters (`state.progress` = swingProgressInt, `state.on` = isSwingInProgress). */
export const swingTakes = (p, state) => !state.on || state.progress < 0 || state.progress >= Math.trunc(swingEnd(p) / 2);
/** sv.bb (updateArmSwingProgress), once per entity update: ++swingProgressInt while swinging, ending the swing at progress >= end; 0 when idle. */
export const swingAdvance = (p, state) => { if (state.on) { if (++state.progress >= swingEnd(p)) { state.progress = 0; state.on = false; } } else state.progress = 0; };
/**
 * Replaces `p.swing` with a property whose assignment of 6 (a C0A) is ignored while the native condition fails; every other assignment (the per-tick countdown) is taken.
 * b102 console102: the condition reads an explicit swingProgressInt counter (`p.swingState`), advanced by `p.swingTick()` (one line in the player tick, before the countdown), so
 * it is exact for every end (Mining Fatigue III and above included) instead of the countdown that rests at 0.
 */
export function gateSwing(p) {
  let value = p.swing | 0;
  const state = { on: false, progress: 0 };
  Object.defineProperty(p, 'swingState', { enumerable: false, configurable: true, value: state });
  Object.defineProperty(p, 'swingTick', { enumerable: false, configurable: true, value: () => swingAdvance(p, state) });
  Object.defineProperty(p, 'swing', { enumerable: true, configurable: true, get: () => value, set: (v) => { if (v === 6) { if (!swingTakes(p, state)) return; state.on = true; state.progress = -1; } value = v; } });
  return p;
}
