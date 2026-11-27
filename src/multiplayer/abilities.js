// b100 abilities100: S39PacketPlayerAbilities on the dedicated server.
//
// Natively (bytecode-read, tools/research/minecraft-1.7.10.jar): hk (S39) is id 57 and writes one flags byte (bit 1 invulnerable, 2 flying, 4 allowFlying, 8 creative: yw.a/b/c/d),
// then flySpeed and walkSpeed floats = 10 bytes with the VarInt id. It is sent (1) by ServerConfigurationManager.a(ej, mw) at join, right after S05 and before S09, from the
// player's capabilities, which oi.a(mw, mw, ahb) had already set for the game type; (2) by EntityPlayerMP.q() (updateCapabilities), called from ItemInWorldManager.a(ahk) (setGameType:
// ahk.a(yw) sets allowFlying/creative/invulnerable for creative, clears them and flying otherwise) whenever the connection exists, which covers /gamemode and the respawn
// (oi.a(mw, int, boolean): the new player's connection is set before oi.a(mw, mw, ahb), so S39 precedes that respawn's S07). transferPlayerToDimension (oi.a(mw, int)) sends no S39.
// The client (bjb.a(hk)) copies flying, creative, invulnerable, allowFlying, flySpeed and walkSpeed into its capabilities.
import { normalAbilitySpeeds } from '../player-movement.js';
import { GAME_MODE_IDS } from '../survival.js';
import { setAbilityFlags } from '../ability-flags.js'; // b101 abilities101

/** The `abilities` message of a server player: creative players may fly and are invulnerable, everyone else gets none of them (ahk.a(yw)). walk is the raw walkSpeed float. */
export function abilitiesMessage(p) {
  const creative = !!p?.survival?.creative, sp = normalAbilitySpeeds(p?.abilitySpeeds ? { fly: p.abilitySpeeds.fly, walk: p.abilitySpeeds.shownWalk } : undefined);
  return { type: 'abilities', invulnerable: creative, flying: creative && p?.flying === true, allowFlying: creative, creative, fly: sp.fly, walk: sp.shownWalk };
}
/** The speed pair a client predicts with, or undefined (defaults) when the message has none. */
export function abilitySpeedsOf(m) {
  return m && typeof m === 'object' && typeof m.fly === 'number' && typeof m.walk === 'number' ? { fly: m.fly, walk: m.walk } : undefined;
}
/** Record fields for the client's launch: the speeds of a welcome / dimRespawn `abilities` (nothing keeps the defaults). */
export function abilityRecordFields(m) { setAbilityFlags(m); /* b101 abilities101: the welcome / dimRespawn S39's flags are the client's capabilities (no S39: the game-mode rule) */ const s = abilitySpeedsOf(m); return s ? { abilitySpeeds: s } : {}; }
/** The game mode the client starts in: the player's own (a loaded creative or adventure player), else the server's default (the old snapshot rule). */
export function clientModeOf(snapshot, self) {
  const own = self?.player?.gameMode;
  return Object.hasOwn(GAME_MODE_IDS, own) ? own : (snapshot?.gameMode === 'survival' ? 'survival' : 'creative');
}
