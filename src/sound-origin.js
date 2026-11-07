// Where a sound comes from in 1.7.10, for the S29 range filter (sound-channels.js broadcastRange / receivesBroadcast).
// Read from the bytecode of the unchanged client and server classes:
//  - RenderGlobal (bma) implements IWorldAccess.playSound and playSoundToNearExcept as empty methods, so World.playSoundEffect /
//    playSoundAtEntity / playSoundToNearExcept on the client world play nothing. A sound the world makes is heard only through
//    the server's WorldManager (mp), which sends S29 to the players within 16 blocks (16 * volume above volume 1) of the sound,
//    measured from each player's server position (the feet), with playSoundToNearExcept skipping its player. That player plays
//    its own sounds itself (EntityPlayerSP.playSound -> World.playSound at the feet), so each action sounds once: the port has
//    one play call per action and no mirrored server copy to suppress.
//  - A few sounds never travel as S29 because the client makes them: GUI clicks, music and records, moving sounds, the client
//    lightning bolt's thunder, the fireworks rocket's status-17 effect, the cave mood (EntityPlayerSP.updateEntityActionState),
//    and the dig / break sounds of PlayerControllerMP. They are not range-filtered.
import { receivesBroadcast } from "./sound-channels.js";

const CLIENT_MADE = /^(?:gui\.|music\.|records\.|minecart\.|fireworks\.|ambient\.weather\.thunder$|ambient\.cave\.cave$)/;
export const isClientMade = (event) => CLIENT_MADE.test(event);

// listener.feet: the player's server position { x, y, z } (null before a world exists: no filtering).
export function reachesPlayer(event, position, volume, feet, { local = false } = {}) {
  if (!position || !feet || local || isClientMade(event)) return true;
  return receivesBroadcast({ volume, x: position.x, y: position.y ?? 0, z: position.z }, feet);
}
