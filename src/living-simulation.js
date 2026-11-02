// Browser-independent ordering for the living mob/player-XP part of the live
// movement tick. Simulation mutations are synchronous; callers own presentation.

/**
 * Route queued mob events in their live order. Each event is consumed in the
 * order sound, death XP spawn, explosion, item drop, then eat-grass observer.
 * XP created here is intentionally spawned after the XP-orb update/pickup when
 * called by tickLivingSimulation, so newly created death orbs wait until the
 * next player tick before moving or being collected.
 *
 * @param {{mobs: object, xpOrbs: object, items: object}} systems
 * @param {{sound?: Function, explode?: Function, eatGrass?: Function}} hooks
 */
export function drainMobEvents({ mobs, xpOrbs, items }, hooks = {}) {
  const {
    sound = () => {},
    explode = () => {},
    eatGrass = () => {},
  } = hooks;
  const events = mobs.drain();
  for (const event of events) {
    if (event.sound) sound({
      sound: event.sound,
      position: event.position,
      volume: event.volume ?? 0.6,
      pitch: event.pitch,
    }, event);
    if (event.xp) xpOrbs.spawn(event.xp, event.position);
    if (event.explode) explode(
      event.explode.x, event.explode.y, event.explode.z, event.explode.size,
      { exploder: event.explode.source, attacker: event.explode.source }, event,
    );
    if (event.drop) items.dropMob(event.drop, event.count, event.position, event.damage, event);
    if (event.eatGrass) eatGrass(event.eatGrass, event);
  }
  return events;
}

/**
 * Run the authoritative inhabited-time, mob, and XP portion of a player tick.
 *
 * `state` contains `{world, position, survival, inhabited, mobs, xpOrbs,
 * experience, items, playerTicks, width, height}`. `playerTicks` is updated in
 * place and also returned. Hooks are synchronous: `heldItem`, `levelUpSound`,
 * `experienceCollected`, `orbSound`, and the `drainMobEvents` hooks
 * `sound`, `explode`, `eatGrass`.
 */
export function tickLivingSimulation(state, hooks = {}) {
  const {
    world, position, survival, inhabited, mobs, xpOrbs, experience, items,
    width, height,
  } = state;
  const {
    heldItem = () => null,
    levelUpSound = () => {},
    experienceCollected = () => {},
    orbSound = () => {},
    sound = () => {},
    explode = () => {},
    eatGrass = () => {},
  } = hooks;

  inhabited.tick(survival.time);
  mobs.tick(position, survival, heldItem());
  state.playerTicks++;
  xpOrbs.tick(world, position);
  if (survival.health > 0) {
    const oldLevel = experience.level;
    const amount = xpOrbs.collect(position, width, height);
    if (amount) {
      experience.add(amount);
      const volume = experience.levelUp(oldLevel, state.playerTicks);
      if (volume) levelUpSound(volume);
      experienceCollected(amount, volume);
    }
  }
  for (const event of xpOrbs.sounds.splice(0)) orbSound(event);
  drainMobEvents({ mobs, xpOrbs, items }, { sound, explode, eatGrass });
  return state.playerTicks;
}
