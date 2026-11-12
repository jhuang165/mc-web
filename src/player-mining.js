import { playerMiningState } from './enchantment-effects.js';
// PlayerControllerMP mining progress and PlayerControllerMP click particles from the
// live tick. Inputs are plain tick state; rendering, sound, edit dispatch and block
// removal stay synchronous caller hooks so they keep their original position in order.
export function tickPlayerMining(state, {
  getBlock,
  eyeInWater = () => false,
  edit = () => {},
  swing = () => {},
  digSound = () => {},
  breakBlock = () => {},
  hitParticles = () => {},
  // Minecraft.sendClickBlockToController: the hit particles (and swing) only when isCurrentToolAdventureModeExempt.
  mayHit = () => true,
} = {}) {
  if (state.playing) {
    if (state.cooldown > 0) {
      // PlayerControllerMP's hit delay consumes this tick even when it reaches zero.
      state.cooldown--;
    } else if (state.aimedEntity) {
      state.mining = null;
    } else {
      // A held click on a block the adventure player may not hit: clickBlock returns at once and
      // sendClickBlockToController skips the swing, so the click is not re-dispatched.
      if (!state.mining && state.mineHeld && state.target && mayHit(...state.target.block)) {
        // edit(false) can synchronously start mining, break an instant block, or set a
        // cooldown. A browser adapter may return freshly read closure values here.
        const updated = edit(false, state);
        if (updated && typeof updated === 'object') Object.assign(state, updated);
      }
      const mine = state.mining;
      if (mine) {
        const targetBlock = state.target?.block;
        if (
          !targetBlock ||
          !targetBlock.every((v, i) => v === mine.block[i]) ||
          getBlock(...mine.block) !== mine.type ||
          state.heldTool !== mine.tool ||
          (!mine.auto && !state.mineHeld)
        ) {
          state.mining = null;
        } else {
          const under = eyeInWater();
          swing();
          // PlayerControllerMP.onPlayerDamageBlock: stepSoundTickCounter (reset with each new dig) plays on every 4th continued hit.
          mine.hits = (mine.hits ?? 0) + 1;
          if ((mine.hits - 1) % 4 === 0) digSound(mine.type, mine.block);
          mine.progress = Math.fround(mine.progress + playerMiningState(
            state.survival,
            mine.type,
            state.heldTool,
            under,
            state.grounded,
          ).progress);
          if (mine.progress >= 1) {
            const block = [...mine.block];
            state.mining = null;
            breakBlock(block, false, mine.type); // the server re-checks the block at the cell (ItemInWorldManager.blockRemoving)
            state.cooldown = 5;
          }
        }
      }
    }
  }

  // This check is intentionally outside progress/cooldown handling: particles continue
  // during the hit delay, and read the live block after any progress/break callback.
  const { target } = state;
  if (state.playing && state.mineHeld && target && !state.aimedEntity && getBlock(...target.block) && mayHit(...target.block)) {
    const [bx, by, bz] = target.block, [ax, ay, az] = target.adjacent ?? target.block;
    const side = ay < by ? 0 : ay > by ? 1 : az < bz ? 2 : az > bz ? 3 : ax < bx ? 4 : 5;
    hitParticles(bx, by, bz, side);
  }
  return state;
}
