// b101 abilities101: the multiplayer client's PlayerCapabilities flags, taken straight from S39PacketPlayerAbilities.
// Natively (bytecode-read bjb.a(hk)): NetHandlerPlayClient.handlePlayerAbilities sets disableDamage (bit 1), isFlying (2), allowFlying (4), isCreativeMode (8), flySpeed and walkSpeed
// on the player's capabilities, whatever the client's own game mode is; flight toggling (EntityPlayerSP.onLivingUpdate: allowFlying) and damage immunity (EntityPlayer.attackEntityFrom:
// disableDamage) read those flags. `null` (single player, or before the first S39) keeps the old rule: the flags follow the creative game mode.
let flags = null;
export function setAbilityFlags(m) {
  flags = m && typeof m === 'object' && typeof m.allowFlying === 'boolean' ? { disableDamage: m.invulnerable === true, flying: m.flying === true, allowFlying: m.allowFlying, creative: m.creative === true } : null;
}
export const abilityFlags = () => flags;
export const allowsFlight = (creativeMode) => (flags ? flags.allowFlying : !!creativeMode);
export const disablesDamage = (creativeMode) => (flags ? flags.disableDamage : !!creativeMode);
export const isCreativeMode = (creativeMode) => (flags ? flags.creative : !!creativeMode); // b102 abilities102: capabilities.isCreativeMode as the client reads it (bao.ao middle-click pick, bao.Y), from S39
