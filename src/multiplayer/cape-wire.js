// Batch 71 mpcapes: the cape on the multiplayer wire.
// Bytecode-read (b70 playerrender70 note): EntityPlayerMP sets the hide-cape flag (data watcher 16 bit 1) from `!C15PacketClientSettings.showCape`;
// RenderPlayer skips the cape when EntityPlayer.getHideCape is set. Other clients therefore see `hideCape` for that player.
// Wire: a player row carries `cape` (content hash of the account's cape PNG, served at /api/capes/<hash>.png) and `hideCape: true`
// only while set. The client sends `capeSettings {show}` after joining and whenever Show Cape changes.

// The extra fields of a presence row.
export const capeFields = (p) => ({ cape: p.cape ?? null, ...(p.hideCape ? { hideCape: true } : {}) });

// C15 ClientSettings.showCape on the server player: show === false hides the cape from other players.
export function setCapeShow(player, show) {
  if (!player || typeof show !== 'boolean') return false;
  player.hideCape = !show;
  return true;
}
