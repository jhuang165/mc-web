// Where a mob passenger sits in a boat or minecart, Minecraft Java 1.7.10. Entity.updateRiderPosition (sa.ac) puts the rider at
// (x, posY + mount.getMountedYOffset() + rider.getYOffset(), z); EntityBoat.updateRiderPosition (xi.ac) moves it 0.4 along the boat's
// yaw first (x + cos(yaw) * 0.4, z + sin(yaw) * 0.4); both mounted offsets are height * 0.0 - 0.3 (xi.ae, xl.ae). The boat's and
// the cart's `posY` is the entity centre (box bottom + yOffset), so a rider's feet sit at posY - 0.3 + getYOffset.
// Verified for the player seat by BoatProbe's mount record (public/research/boat-reference.json).
const f = Math.fround;

// Vehicles are plain objects: boats carry `boat: true`, every cart a `slots` array (minecarts.js).
export const isVehicle = (m) => !!m && (m.boat === true || Array.isArray(m.slots));
// EntityBoat setSize(1.5F, 0.6F); EntityMinecart setSize(0.98F, 0.7F).
export const vehicleSize = (m) => (m.boat ? [f(1.5), f(0.6)] : [f(0.98), f(0.7)]);

export function vehicleSeat(v, riderYOffset) {
  const y = v.posY - f(0.3) + riderYOffset;
  if (v.boat) {
    const a = (v.yaw * Math.PI) / 180;
    return { x: v.x + Math.cos(a) * 0.4, y, z: v.z + Math.sin(a) * 0.4 };
  }
  return { x: v.x, y, z: v.z };
}
