// b82 mpplace82: the multiplayer client's World.checkNoEntityCollision for block placement. Natively ItemBlock.onItemUse runs on the client too
// (bytecode-read: abh.a(add, yz, ahb, IIIIFFF) calls ahb.a(Block, x, y, z, false, side, null, stack) = canPlaceEntityOnSide, which tests the placed
// block's collision box against every entity in the client world with preventEntitySpawning). A refused placement there keeps the stack and the
// block, so the client copies decide it: the other players (EntityOtherPlayerMP is an EntityLivingBase), the mob copies, the cart and boat copies and
// the primed TNT copies. The placing player is the caller's `collides`; items, orbs, arrows and thrown items never block (placement-entities.js).
import { placementEntityBlocker } from '../placement-entities.js';
import { boxesIntersect } from '../mob-spawner.js';
import { TNT_SIZE } from '../explosion.js';

const f = Math.fround;
const PLAYER_HALF = f(0.6) / 2, PLAYER_HEIGHT = f(1.8), SLEEP_HALF = f(0.2) / 2, SLEEP_HEIGHT = f(0.2);

// b83 attack83: the box of another player's copy. A lying one (the presence row's `sleep` field, the same test as client-sleep.js remoteSleepPose) is the 0.2 x 0.2
// box of EntityPlayer.sleepInBedAt (setSize(0.2F, 0.2F), bytecode-read b67), whose minY is the wire y (bed y + 0.7375, server-sleep.js); EntityOtherPlayerMP gets it
// from S0A Use Bed. A standing one is 0.6 x 1.8 from y - ySize.
export const remoteLying = (sleep) => Array.isArray(sleep) && sleep.length === 4 && sleep.every(Number.isFinite);
export function remotePlayerBox(p) {
  const y = p.y - (p.ySize ?? 0), lying = remoteLying(p.sleep), half = lying ? SLEEP_HALF : PLAYER_HALF;
  return [p.x - half, y, p.z - half, p.x + half, y + (lying ? SLEEP_HEIGHT : PLAYER_HEIGHT), p.z + half];
}

// The other players' copies: RemotePlayers.entries (wire id -> entry). A player whose death animation ended (entry.hidden, remote-death.js: the
// copy is setDead at deathTime 20) no longer blocks; a dying one still does (isDead stays false until then).
function playerBlocks(entries, box) {
  for (const entry of entries?.values?.() ?? []) {
    const p = entry.state ?? entry.last;
    if (!p || entry.hidden) continue;
    if (boxesIntersect(box, remotePlayerBox(p))) return true;
  }
  return false;
}

// The primed TNT copies (client-dispense.js rows; the wire y is the box bottom, explosion.js primeTnt): a 0.98 box round the row.
const tntBox = (t) => { const half = TNT_SIZE / 2; return [t.x - half, t.y, t.z - half, t.x + half, t.y + TNT_SIZE, t.z + half]; };

/**
 * `sources()` returns { players: RemotePlayers.entries, mobs: RemoteMobs, vehicles: RemoteVehicles, primed: RemoteDispense.primed }, each optional
 * and read when the test runs. Returns (box) => true when one of the client's entity copies blocks the box.
 */
export function clientPlacementBlocker(sources) {
  const others = placementEntityBlocker(() => {
    const { mobs, vehicles, primed } = sources();
    return {
      mobs: mobs ? { entities: mobs.list(), size: (o) => mobs.factory.size(o) } : null,
      vehicles: vehicles ? [vehicles.carts?.carts, vehicles.boats?.carts] : [],
      primed: (primed ?? []).map((t) => ({ bb: tntBox(t) })),
    };
  });
  return (box) => playerBlocks(sources().players, box) || others(box);
}
