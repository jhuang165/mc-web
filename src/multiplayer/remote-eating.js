import { ITEMS } from '../survival.js';

// EntityOtherPlayerMP.onUpdate + EntityPlayer.onUpdate for the item in use of a remote player (bytecode-read).
// The server's watcher 0 bit 4 ("using") makes the client set itemInUse to the held stack for getMaxItemUseDuration (32 for food and drink, 72000 for
// a sword or bow); every tick the count then falls, and while it is 25 or below and a multiple of 4 updateItemUse(stack, 5) runs first. For food that
// is 5 "iconcrack_<id>" crumbs from Entity.rand; the sound is NOT played here: Entity.playSound of a player goes to World.playSoundToNearExcept, which
// RenderGlobal ignores, so the eat and drink sounds of another player arrive as S29 packets (see simulation.js useSound).
export const USE_DURATION = 32;
export const isEatable = held => !!held && !!ITEMS[held.id]?.food;
const MILK_BUCKET = 343; // the build's own id (vanilla 335)
export const useAction = held => (isEatable(held) ? 'eat' : held?.id === MILK_BUCKET ? 'drink' : null);
const same = (a, b) => !!a && !!b && a.id === b.id && (a.damage ?? 0) === (b.damage ?? 0);

export const createRemoteUse = () => ({ flag: false, stack: null, count: 0 });

// One client tick of a remote player: `using` is the synced flag, `held` its held stack. `crumbs(id)` spawns the 5 crumbs.
export function tickRemoteUse(state, { using, held }, crumbs) {
  // EntityPlayer.onUpdate: an item in use that is still the held stack counts down (and the count keeps falling below zero while the flag stays set);
  // a changed held stack clears it.
  if (state.stack) {
    if (same(state.stack, held)) {
      if (state.count <= 25 && state.count % 4 === 0 && useAction(state.stack) === 'eat') crumbs(state.stack.id);
      state.count--;
    } else { state.stack = null; state.count = 0; }
  }
  // EntityOtherPlayerMP.onUpdate: the flag starts the use (the held stack, a full duration), its release clears it.
  if (!state.flag && using && held) { state.stack = { id: held.id, damage: held.damage ?? 0 }; state.count = useAction(held) ? USE_DURATION : 72000; state.flag = true; }
  else if (state.flag && !using) { state.stack = null; state.count = 0; state.flag = false; }
}

// The crumbs' eye: x, posY + 1.82 (EntityOtherPlayerMP.getEyeHeight), z and the Java yaw/pitch in degrees (main.js playerEye's conversion).
export const remoteEye = p => ({ x: p.x, y: p.y + Math.fround(1.82), z: p.z, yaw: Math.fround(180 - (p.yaw * 180) / Math.PI), pitch: Math.fround((-p.pitch * 180) / Math.PI) });
