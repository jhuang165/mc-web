import { JavaRandom } from "./java-random.js";

// Arrows stuck in a living entity. EntityLivingBase keeps the count in DataWatcher slot 9 (sv.aZ() / sv.p(int), a byte,
// not written to NBT) and arrowHitTimer (sv.av). Only RenderPlayer draws them (boh.e(sv, F), renderArrowsStuckInEntity:
// no other renderer calls it). Constants come from the unchanged classes via tools/verify-stuck-arrows.mjs and
// public/research/stuck-arrows-reference.json.
const f = Math.fround;

// EntityArrow.onUpdate (zc.h): attackEntityFrom returned true on an EntityLivingBase and the world is not remote:
// setArrowCountInEntity(getArrowCountInEntity() + 1) (the byte wraps at 128).
export const addStuckArrow = (count) => (((count | 0) + 1) << 24) >> 24;

// EntityLivingBase.onUpdate (sv.h), server side, once per tick: with a positive count, a timer that has run out is reset
// to 20 * (30 - count), then it is decremented, and at zero one arrow falls out.
export function stepStuckArrows(count, timer) {
  count |= 0; timer |= 0;
  if (count > 0) {
    if (timer <= 0) timer = 20 * (30 - count);
    timer--;
    if (timer <= 0) count = (((count - 1) << 24) >> 24);
  }
  return { count, timer };
}

// ModelBiped (bhm)'s boxList in order, each with its single ModelBox's (posX1, posY1, posZ1, posX2, posY2, posZ2) and the
// ModelRenderer rotation point. The cape and ears are in the list although the port draws neither.
export const STUCK_ARROW_PARTS = [
  { name: "cloak", point: [0, 0, 0], box: [-5, 0, -1, 5, 16, 0] },
  { name: "ears", point: [0, 0, 0], box: [-3, -6, -1, 3, 0, 0] },
  { name: "head", point: [0, 0, 0], box: [-4, -8, -4, 4, 0, 4] },
  { name: "hat", point: [0, 0, 0], box: [-4, -8, -4, 4, 0, 4] },
  { name: "body", point: [0, 0, 0], box: [-4, 0, -2, 4, 12, 2] },
  { name: "rightArm", point: [-5, 2, 0], box: [-3, -2, -2, 1, 10, 2] },
  { name: "leftArm", point: [5, 2, 0], box: [-1, -2, -2, 3, 10, 2] },
  { name: "rightLeg", point: [-1.9, 12, 0], box: [-2, 0, -2, 2, 12, 2] },
  { name: "leftLeg", point: [1.9, 12, 0], box: [-2, 0, -2, 2, 12, 2] },
];

// RendererLivingEntity.func_85093_e: Random(entityId); per arrow ModelBase.getRandomModelBox (nextInt(parts), then
// nextInt(cubes)), three nextFloat for the point in the box (/16), then the floats are mapped to (2r - 1) * -1 and the arrow
// entity gets yaw = atan2(x, z) * 180 / pi and pitch = atan2(y, sqrt(x^2 + z^2)) * 180 / pi (pi being the float constant).
export function stuckArrowPlacements(entityId, count) {
  const rand = new JavaRandom(BigInt.asIntN(64, BigInt(entityId | 0))), out = [], PI = 3.1415927410125732;
  for (let i = 0; i < Math.max(0, count | 0); i++) {
    const partIndex = rand.nextInt(STUCK_ARROW_PARTS.length), part = STUCK_ARROW_PARTS[partIndex];
    rand.nextInt(1);
    const r = [rand.nextFloat(), rand.nextFloat(), rand.nextFloat()], b = part.box;
    const pos = [0, 1, 2].map((k) => f(f(b[k] + f(f(b[k + 3] - b[k]) * r[k])) / 16));
    const [x, y, z] = r.map((v) => f(f(f(v * 2) - 1) * -1)), flat = f(Math.sqrt(f(f(x * x) + f(z * z))));
    out.push({ part: partIndex, name: part.name, pos, yaw: f((Math.atan2(x, z) * 180) / PI), pitch: f((Math.atan2(y, flat) * 180) / PI) });
  }
  return out;
}
