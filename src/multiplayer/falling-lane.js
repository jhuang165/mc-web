// Batch 89 mpobjects89: falling blocks in the dedicated server's thrown-entity tracker lane (thrown-tracks.js), so the multiplayer client gets falling-block copies.
//
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   * EntityTracker.addEntityToTracker (mn.a(sa)): `instanceof xj` (EntityFallingBlock) -> sipush 160, bipush 20, iconst_1: range 160, frequency 20, velocity updates true.
//   * EntityTrackerEntry.func_151260_c (my.c): S0E type 70 with data Block.getIdFromBlock(xj.f()) | xj.a << 16 (the block id and its metadata). object-tracker.js OBJECT_KINDS.falling
//     holds those numbers; NetHandlerPlayClient.handleSpawnObject builds the client EntityFallingBlock from the packet and the S12 after the S0E sets its motion.
// The port's falling record keeps y at the box bottom (falling.js spawnFalling); OBJECT_KINDS.falling's read adds the 0.49 yOffset, so the rows carry posY as the native packets do.
//
// `fallingTrackList(dispense)`: [{ e, kind: 'falling' }] for the live falling blocks of that ServerDispense instance's own dimension, for its thrownList. The first call also hooks
// FallingBlocks.joined so a block that starts falling has its join state copied (ThrownTracks.birth), as the use / dispense pass does for the thrown kinds: the S0E carries the
// state World.spawnEntityInWorld had.
const homeFalling = new WeakMap(); // ServerDispense (Overworld) -> its FallingBlocks, read while no other dimension is swapped in
const HOOKED = Symbol('mpobjects89 falling join hook');

// The FallingBlocks of the instance's dimension: the Overworld's is sim.falling outside a dimension swap (server-dimensions.js puts the Nether's or the End's on sim while they run).
export function fallingOf(dispense) {
  const sim = dispense?.sim, dim = dispense?.dim | 0;
  if (!sim) return null;
  if (dim) return dispense.dimState?.(dim)?.falling ?? null;
  if (!(sim.dimensions?.depth > 0) && sim.falling) homeFalling.set(dispense, sim.falling);
  return homeFalling.get(dispense) ?? null;
}

export function hookFallingJoin(falling, tracks) {
  if (!falling || !tracks || falling.joined?.[HOOKED] === tracks) return;
  const before = falling.joined?.[HOOKED] ? falling.joined.before : falling.joined;
  const joined = (e) => { before?.(e); tracks.birth([{ e, kind: 'falling' }]); };
  joined[HOOKED] = tracks; joined.before = before;
  falling.joined = joined;
  // b90 mpobjects90: a summoned (/summon FallingSand, entity-summon.js) or loaded (restoreEntity) block is spawned too: World.spawnEntityInWorld hands its S0E the state it was given
  // (position, motion), whatever tick it joined in. `joined` stays the scheduled-update spawn's hook (the walk list in single player).
  falling.spawned = (e) => tracks.birth([{ e, kind: 'falling' }]);
}

export function fallingTrackList(dispense) {
  const falling = fallingOf(dispense);
  if (!falling) return [];
  hookFallingJoin(falling, dispense.tracksOf?.(dispense) ?? dispense.thrownTracks);
  const out = [];
  for (const e of falling.entities ?? []) if (!e.dead) out.push({ e, kind: 'falling' });
  return out;
}
