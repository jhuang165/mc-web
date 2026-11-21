// Entity boxes in World.getCollidingBoundingBoxes (ahb.a(sa, azt)), Minecraft Java 1.7.10. After the block boxes the original adds, for every
// other entity within the grown box, that entity's getBoundingBox (sa.J) when it has one, and this mover's getCollisionBox(other)
// (sa.h(sa)). EntityBoat.J returns its box, so players and mobs stand on and bump into boats; EntityMinecart.J returns null, so
// they walk through carts (a cart's own h(other) only matters to the cart's movement, minecarts.js). Verified by BoatProbe's
// collide records (public/research/boat-reference.json), replayed in boats.test.js.
const intersects = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5];

// `boats`: the Boats list. The provider returns the boxes of the live boats the mover `e` overlaps, except the boat it rides.
export function boatBoxProvider(boats) {
  return (box, e) => {
    const out = [];
    for (const boat of boats?.carts ?? []) {
      if (boat.dead || !boat.bb || e === boat || boat.rider === e || e.vehicle === boat || e.ridingEntity === boat) continue;
      if (intersects(box, boat.bb)) out.push(boat.bb);
    }
    return out;
  };
}

// b88 boatray88: the single-player client player (movePlayer's body, `clientPlayer`) collides with the boats of its own client world: the copies the tracker last moved
// (object-tracker.js, executed against EntityTrackerEntry and the client EntityBoat in batch 47), not the live boats. A floating boat's bob (about 0.04) never reaches
// the tracker's 4/32 move threshold, so natively the client stands on a still boat while the server copy is checked against the live one under processPlayer's 1/16
// shrink (spcopy88, executed). Every other mover (mobs, the server's copy of the player) keeps the live boxes. `copies()`: the client boat boxes.
export function clientBoatBoxProvider(copies, live) {
  return (box, e) => {
    if (!e?.clientPlayer) return live(box, e);
    const out = [];
    for (const b of copies() ?? []) if (intersects(box, b)) out.push(b);
    return out;
  };
}

// b67 boatstand: the dedicated server's boats, found by the world the mover walks in (the Overworld, the Nether and the End each have their own Boats).
// `registerBoatWorld(world, boats)` is called by ServerVehicles; `worldBoatBoxes` is installed once through entities.js setWorldEntityBoxes.
const boatWorlds = new WeakMap();
export const registerBoatWorld = (world, boats) => { if (world && boats) boatWorlds.set(world, boatBoxProvider(boats)); };
export const worldBoatBoxes = (box, e, world) => boatWorlds.get(world)?.(box, e) ?? [];
