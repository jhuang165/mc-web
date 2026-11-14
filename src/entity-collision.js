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

// b67 boatstand: the dedicated server's boats, found by the world the mover walks in (the Overworld, the Nether and the End each have their own Boats).
// `registerBoatWorld(world, boats)` is called by ServerVehicles; `worldBoatBoxes` is installed once through entities.js setWorldEntityBoxes.
const boatWorlds = new WeakMap();
export const registerBoatWorld = (world, boats) => { if (world && boats) boatWorlds.set(world, boatBoxProvider(boats)); };
export const worldBoatBoxes = (box, e, world) => boatWorlds.get(world)?.(box, e) ?? [];
