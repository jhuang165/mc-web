// b93 portals93: the in-memory mob state that EntityLiving.writeToNBT does not write. Native copyDataFrom (sa.a(sa, boolean), bytecode-read: `old.e(nbt); this.f(nbt); am = old.am; aq = old.aq`)
// moves only NBT (plus the portal cooldown and teleport direction), so a copy starts these over: the despawn / age counters, the revenge target's stamp, the jump and walk intents, the
// living-sound timer, the home area, and the wolf shake, enderman stare, spider climb, slime hop and ocelot pose flags. Dropping them lets ServerMobs.restore supply the created defaults.
export const TRANSIENT_MOB = ['age', 'idle', 'revenge', 'burn', 'mateTicks', 'collidedH', 'inLava', 'moveForward', 'jumping', 'jumpTicks', 'livingSoundTime', 'home', 'homeRadius', 'leashHome', 'lastDamage', 'attack', 'flee',
  'shakeTime', 'prevShakeTime', 'wet', 'shaking', 'stareCount', 'chaseTimer', 'climbing', 'wasOnGround', 'sneaking', 'sprinting', 'limbSwing', 'limbSwingAmount', 'prevLimbSwingAmount', 'bodyTicks', 'stepDistance'];
// b94 portals94: EntityWorld.restore (a world load, /summon, a portal arrival) drops them too, so a reload starts them over as a native chunk load does (a mob is built from NBT only).
export const withoutTransient = (e) => { let o = e; for (const k of TRANSIENT_MOB) if (k in e) { if (o === e) o = { ...e }; delete o[k]; } return o; };
