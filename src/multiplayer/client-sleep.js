// The connected client's half of sleeping (batch 66 mpsleep). Wire messages from the server, all `sleep` prefixed:
//   sleepIn {x, y, z, facing}   S0A use bed (to the sleeper): lie down, show the sleep screen
//   sleepWake {}                S0B animation 2 (to the sleeper): leave the bed, the overlay fades out over 10 ticks
//   sleepMsg {key}              ChatComponentTranslation tile.bed.* / S2B state 0 (tile.bed.notValid): `key` is a BED_TEXT key
// and to the server `sleepLeave` (C0B action 3). Other players' pose arrives as the presence field `sleep: [x, y, z, facing]`.
import { BedSleep, BED_TEXT } from '../bed.js';

export const SLEEP_TYPES = new Set(['sleepIn', 'sleepWake', 'sleepMsg']);

/** The text of a `sleepMsg` (an unknown key gives null). */
export const sleepText = (key) => (Object.hasOwn(BED_TEXT, key) ? BED_TEXT[key] : null);

/** The renderer's `sleeping` option ({pos, offset, facing}) for a remote player's presence field, or null. Cached per field value. */
const poses = new Map();
export function remoteSleepPose(field) {
  if (!Array.isArray(field) || field.length !== 4 || !field.every(Number.isFinite)) return null;
  const key = field.join(',');
  let pose = poses.get(key);
  if (!pose) {
    const [x, y, z, facing] = field, s = new BedSleep();
    s.begin({ getMeta: () => facing & 3 }, x, y, z, { player: { x, y, z, alive: true }, daytime: false });
    pose = { pos: s.pos, offset: s.offset, facing: s.facing };
    if (poses.size > 64) poses.clear();
    poses.set(key, pose);
  }
  return pose;
}

/** EntityPlayer.onUpdate's sleep counter on the client: up to 100 while lying, then 10 more ticks of fade after the wake. */
export function clientSleepTick(sleep) {
  if (sleep.sleeping) sleep.timer = Math.min(sleep.timer + 1, 100);
  else if (sleep.timer > 0) { sleep.timer++; if (sleep.timer >= 110) sleep.timer = 0; }
  return sleep.timer;
}

/** The sleeper wakes (S0B animation 2): EntityPlayerSP.wakeUpPlayer(false, ...) keeps the counter at 100 so the fade-out runs. */
export function clientWake(sleep) {
  if (!sleep.sleeping) return false;
  sleep.sleeping = false; sleep.timer = 100;
  return true;
}
