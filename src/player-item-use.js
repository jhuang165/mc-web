// EntityPlayer.updateItemUse, with browser effects supplied by the live caller.
// The caller owns animation/presentation; this function owns only the per-tick
// held-item use counter and invokes each synchronous effect at its original point.
export function tickPlayerItemUse(use, heldId, survival, {
  foodEffects = () => {},
  finishDrinking = () => false,
  sound = () => {},
  renderHotbar = () => {},
  markUnsaved = () => {},
  random = Math.random,
} = {}) {
  if (!use) return { use: null, cancelled: false, completed: false };
  if (heldId !== use.id) return { use: null, cancelled: true, completed: false };

  if (use.bow) {
    // EntityPlayer counts item use upward; the release path consumes this draw length.
    return { use: { ...use, ticks: use.ticks + 1 }, cancelled: false, completed: false };
  }

  const before = use.ticks;
  if (!use.drink && before <= 25 && before % 4 === 0) foodEffects(use.id, 5);
  const remaining = before - 1;
  let next = { ...use, ticks: remaining };

  if (!use.drink) {
    if (remaining <= 0) {
      // updateItemUse(16) precedes ItemFood.onEaten, including its chance roll.
      foodEffects(use.id, 16);
      if (survival.eat(use.id, random)) {
        sound("random.burp", { volume: 0.5 });
        renderHotbar();
      }
      next = null;
    }
    return { use: next, cancelled: false, completed: next === null };
  }

  // Drink's cadence is based on the pre-decrement count (32 through 1).
  if (before <= 25 && before % 4 === 0)
    sound("random.drink", { volume: 0.5, pitch: random() * 0.1 + 0.9 });
  if (remaining <= 0) {
    sound("random.drink", { volume: 0.5, pitch: random() * 0.1 + 0.9 });
    if (finishDrinking(survival)) {
      renderHotbar();
      markUnsaved();
    }
    next = null;
  }
  return { use: next, cancelled: false, completed: next === null };
}
