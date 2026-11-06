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
    doorUpdate = () => {},
    blockEdit = () => {},
    push = () => {},
    knock = () => {},
  } = hooks;
  const events = mobs.drain();
  for (const e of mobs.drainClientSounds?.() ?? []) sound({ sound: e.sound, position: e.position, volume: e.volume ?? 0.6, pitch: e.pitch }, e);
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
      { exploder: event.explode.source, attacker: event.explode.source, smoking: event.explode.smoking ?? true, flaming: event.explode.flaming ?? false, blue: !!event.explode.blue }, event,
    );
    if (event.drop) items.dropMob(event.drop, event.count, event.position, event.damage, event);
    if (event.eatGrass) eatGrass(event.eatGrass, event);
    // A villager's EntityAIOpenDoor swung a door: its two cells need redrawing.
    if (event.doorUpdate) doorUpdate(event.doorUpdate, event);
    // A silverfish hid in or woke a monster egg: its cells need redrawing (blockBreak: break sound and particles).
    if (event.blockEdit) blockEdit(event.blockEdit, event);
    // EntityDragon.collideWithEntities: the wing sweep's addVelocity on the player (dragon-mobs.js).
    if (event.dragonPush) push(event.dragonPush, event);
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
    doorUpdate = () => {},
    blockEdit = () => {},
    push = () => {},
    knock = () => {},
  } = hooks;

  inhabited.tick(survival.time);
  if (mobs.ai?.player) mobs.ai.player.sneaking = !!state.sneaking; // World.getClosestVulnerablePlayer shrinks the range of a sneaking player
  mobs.lootItems = items; // equipment mobs with canPickUpLoot pick items up (mob-equipment.md)
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
  drainMobEvents({ mobs, xpOrbs, items }, { sound, explode, eatGrass, doorUpdate, blockEdit, push });
  // Player knockback queued by this tick's hits (survival.damage with a source entity; arrows and fireballs tick earlier or later).
  knock(survival);
  return state.playerTicks;
}
