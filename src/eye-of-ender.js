// Eye of ender (ItemEnderEye acn, EntityEnderEye zd) and the end portal block (BlockEndPortal akt), Minecraft Java 1.7.10.
// Pure rules; the live list is eye-of-ender-live.js. Evidence: public/research/eye-of-ender-reference.json
// (tools/probes/EyeOfEnderProbe.java) and public/research/eye-of-ender.md.
const f = Math.fround, PI_F = f(Math.PI); // the bytecode divides by (double) (float) pi, 3.1415927410125732

export const ITEM_EYE_OF_ENDER = 1960; // original item 381
export const END_PORTAL = 149; // original block 119 (BlockEndPortal akt); the reserved BLOCKS slot
export const END_PORTAL_FRAME = 104; // original block 120
export const EYE_FRAME_BIT = 4; // BlockEndPortalFrame.isEnderEyeInserted (aku.b): meta & 4

// Direction (p): offsetX / offsetZ / rotateRight per facing index (probe record "direction").
export const DIRECTION = { offsetX: [0, -1, 0, 1], offsetZ: [1, 0, -1, 0], rotateRight: [1, 2, 3, 0] };

export const hasEye = (meta) => (meta & EYE_FRAME_BIT) !== 0;

// BlockEndPortal bounds (0, 0, 0)-(1, 0.0625, 1) (setBlockBoundsBasedOnState, bytecode-derived); the reference
// "facts" record only holds the default box set by the constructor.
export const END_PORTAL_BOUNDS = [0, 0, 0, 1, 1 / 16, 1];
export const END_PORTAL_LIGHT = 15;

// EntityEnderEye.moveTowards (zd.a(double, int, double)): beyond 12 blocks horizontally the eye heads for the point
// 12 blocks along the line and 8 blocks up; otherwise exactly for the target. Entity.rand draws nextInt(5): 0 shatters.
export function createEye(x, y, z) {
  return { x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0,
    tx: 0, ty: 0, tz: 0, age: 0, drops: false, dead: false };
}
export function moveTowards(eye, x, y, z, random) {
  const dx = x - eye.x, dz = z - eye.z, d = f(Math.sqrt(dx * dx + dz * dz));
  if (d > 12) {
    eye.tx = eye.x + dx / d * 12;
    eye.tz = eye.z + dz / d * 12;
    eye.ty = eye.y + 8;
  } else {
    eye.tx = x; eye.ty = y; eye.tz = z;
  }
  eye.age = 0;
  eye.drops = random.nextInt(5) > 0;
  return eye;
}

// EntityEnderEye.onUpdate (zd.h). Returns the particle spawned this tick and, on the last tick (age > 80), what ends
// the flight: { drop: {x, y, z} } (EntityItem holding one eye) or { shatter: {x, y, z} } (World.playAuxSFX 2003 at
// the rounded position). The base Entity.onEntityUpdate call (water flag, fire) is not modelled; `inWater` selects
// the 4 bubble particles (bytecode-derived).
export function tickEye(eye, random, { inWater = false } = {}) {
  const speed = flyEye(eye);
  return endEye(eye, random, speed, inWater);
}
// The part of EntityEnderEye.onUpdate both sides run: the previous position and rotation, the motion applied to the position and the
// smoothed rotation. Returns the horizontal speed. A client copy (the entity the tracker made from S0E and S12) stops here: the homing and
// the 80 tick end are under !isRemote (public/research/tracker-extras-reference.json eyeFlight).
export function flyEye(eye) {
  eye.px = eye.x; eye.py = eye.y; eye.pz = eye.z;
  // Entity.onEntityUpdate (sa.h) also stores the previous rotation.
  eye.prevPitch = eye.pitch; eye.prevYaw = eye.yaw;
  eye.x += eye.vx; eye.y += eye.vy; eye.z += eye.vz;
  const speed = f(Math.sqrt(eye.vx * eye.vx + eye.vz * eye.vz));
  eye.pitch = f(Math.atan2(eye.vy, speed) * 180 / PI_F);
  eye.yaw = f(Math.atan2(eye.vx, eye.vz) * 180 / PI_F);
  while (f(eye.pitch - eye.prevPitch) < -180) eye.prevPitch = f(eye.prevPitch - 360);
  while (f(eye.pitch - eye.prevPitch) >= 180) eye.prevPitch = f(eye.prevPitch + 360);
  while (f(eye.yaw - eye.prevYaw) < -180) eye.prevYaw = f(eye.prevYaw - 360);
  while (f(eye.yaw - eye.prevYaw) >= 180) eye.prevYaw = f(eye.prevYaw + 360);
  eye.pitch = f(eye.prevPitch + f(f(eye.pitch - eye.prevPitch) * f(0.2)));
  eye.yaw = f(eye.prevYaw + f(f(eye.yaw - eye.prevYaw) * f(0.2)));
  return speed;
}
function endEye(eye, random, speed, inWater) {
  const dx = eye.tx - eye.x, dz = eye.tz - eye.z, dist = f(Math.sqrt(dx * dx + dz * dz)), angle = f(Math.atan2(dz, dx));
  let d8 = speed + f(dist - speed) * 0.0025;
  if (dist < 1) { d8 *= 0.8; eye.vy *= 0.8; }
  eye.vx = Math.cos(angle) * d8;
  eye.vz = Math.sin(angle) * d8;
  eye.vy += ((eye.y < eye.ty ? 1 : -1) - eye.vy) * 0.014999999664723873;
  const particles = [];
  if (inWater) {
    for (let i = 0; i < 4; i++) particles.push({ name: "bubble", x: eye.x - eye.vx * 0.25, y: eye.y - eye.vy * 0.25, z: eye.z - eye.vz * 0.25, vx: eye.vx, vy: eye.vy, vz: eye.vz });
  } else {
    const r1 = random.nextDouble(), r2 = random.nextDouble();
    particles.push({ name: "portal", x: eye.x - eye.vx * 0.25 + r1 * 0.6 - 0.3, y: eye.y - eye.vy * 0.25 - 0.5, z: eye.z - eye.vz * 0.25 + r2 * 0.6 - 0.3, vx: eye.vx, vy: eye.vy, vz: eye.vz });
  }
  eye.age++;
  let end = null;
  if (eye.age > 80) {
    eye.dead = true;
    end = eye.drops ? { drop: { x: eye.x, y: eye.y, z: eye.z } }
      : { shatter: { x: Math.floor(eye.x + 0.5), y: Math.floor(eye.y + 0.5), z: Math.floor(eye.z + 0.5) } };
  }
  return { particles, end };
}

// World.playAuxSFX 2003 (RenderGlobal bma, bytecode-derived): 8 eye-item breaking particles around (x + 0.5, y, z + 0.5),
// then two rings of 80 portal particles pulled inward from radius 5.
export function shatterEffects(x, y, z, random, itemId = ITEM_EYE_OF_ENDER) {
  const out = [], cx = x + 0.5, cz = z + 0.5;
  for (let i = 0; i < 8; i++) out.push({ name: `iconcrack_${itemId}`, x: cx, y, z: cz, vx: random.nextGaussian() * 0.15, vy: random.nextDouble() * 0.2, vz: random.nextGaussian() * 0.15 });
  for (let d = 0; d < Math.PI * 2; d += 0.15707963267948966) {
    out.push({ name: "portal", x: cx + Math.cos(d) * 5, y: y - 0.4, z: cz + Math.sin(d) * 5, vx: Math.cos(d) * -5, vy: 0, vz: Math.sin(d) * -5 });
    out.push({ name: "portal", x: cx + Math.cos(d) * 5, y: y - 0.4, z: cz + Math.sin(d) * 5, vx: Math.cos(d) * -7, vy: 0, vz: Math.sin(d) * -7 });
  }
  return out;
}

// ItemEnderEye.onItemUse ring check (acn.a, after the eye is set): `world` offers get(x,y,z) and getMeta(x,y,z).
// Returns the 9 interior cells to turn into end portal, or null. Mirrors the bytecode loops exactly, including that the
// scan accepts any frames whose first and last offsets are 2 apart (the middle one is only checked on the far side).
export function portalInterior(world, x, y, z, meta) {
  const dir = meta & 3, line = DIRECTION.rotateRight[dir], ax = DIRECTION.offsetX[line], az = DIRECTION.offsetZ[line];
  const fx = DIRECTION.offsetX[dir], fz = DIRECTION.offsetZ[dir];
  const eyed = (px, pz) => world.get(px, y, pz) === END_PORTAL_FRAME && hasEye(world.getMeta(px, y, pz));
  let first = 0, last = 0, found = false, valid = true;
  for (let i = -2; i <= 2; i++) {
    const px = x + ax * i, pz = z + az * i;
    if (world.get(px, y, pz) !== END_PORTAL_FRAME) continue;
    if (!hasEye(world.getMeta(px, y, pz))) { valid = false; break; }
    last = i;
    if (!found) { first = i; found = true; }
  }
  if (!valid || last !== first + 2) return null;
  for (let i = first; i <= last; i++) if (!eyed(x + ax * i + fx * 4, z + az * i + fz * 4)) return null;
  for (let i = first - 1; i <= last + 1; i += 4)
    for (let j = 1; j <= 3; j++) if (!eyed(x + ax * i + fx * j, z + az * i + fz * j)) return null;
  const cells = [];
  for (let i = first; i <= last; i++) for (let j = 1; j <= 3; j++) cells.push([x + ax * i + fx * j, y, z + az * i + fz * j]);
  return cells;
}

// ItemEnderEye.onItemUse on a frame without an eye (acn.a): sets meta | 4 (flag 2), notifies comparators, consumes the
// stack outside Creative (ItemInWorldManager restores a Creative stack), spawns 16 smoke particles on the frame top and
// runs the ring check. `hooks`: setMeta(x,y,z,meta), set(x,y,z,id), particle(name,x,y,z,vx,vy,vz), itemRand (JavaRandom,
// Item.itemRand adb.g). Returns null when the use does not apply.
export function useEyeOnFrame(world, x, y, z, hooks, itemRand) {
  if (world.get(x, y, z) !== END_PORTAL_FRAME) return null;
  const meta = world.getMeta(x, y, z);
  if (hasEye(meta)) return null;
  // World.isRemote: the client only reports success; the server side does everything below.
  if (hooks.remote) return { portal: false, cells: [], remote: true };
  hooks.setMeta(x, y, z, meta + EYE_FRAME_BIT);
  for (let i = 0; i < 16; i++) {
    const px = f(f(x) + f(f(5 + f(itemRand.nextFloat() * 6)) / 16)), pz = f(f(z) + f(f(5 + f(itemRand.nextFloat() * 6)) / 16));
    hooks.particle("smoke", px, f(f(y) + f(0.8125)), pz, 0, 0, 0);
  }
  const cells = portalInterior(world, x, y, z, meta);
  if (cells) for (const [cx, cy, cz] of cells) hooks.set(cx, cy, cz, END_PORTAL);
  return { portal: !!cells, cells: cells ?? [] };
}

// ItemEnderEye.onItemRightClick target (World.findClosestStructure -> MapGenStructure.func_151545_a, bytecode-derived):
// the stronghold position nearest by squared integer distance (strict <). Only getCoordList() is consulted
// (((chunkX << 4) + 8, 64, (chunkZ << 4) + 8)); generated starts are not (see Gaps).
export function nearestStronghold(positions, x, y, z) {
  let best = null, bestDistance = Infinity;
  for (const [cx, cz] of positions) {
    const px = (cx << 4) + 8, pz = (cz << 4) + 8, dx = x - px, dy = y - 64, dz = z - pz, d = dx * dx + dy * dy + dz * dz;
    if (d < bestDistance) { bestDistance = d; best = [px, 64, pz]; }
  }
  return best;
}

// Content installs (population-content.js hooks). The end portal block has no item (BlockEndPortal.getItem returns
// Item.getItemById(0)); BlockEndPortal is unbreakable (hardness -1, resistance 6000000: probe record "facts").
export const EYE_ITEMS = Object.freeze({ 381: ITEM_EYE_OF_ENDER });
export const EYE_MATERIALS = Object.freeze({ [END_PORTAL]: { hardness: Infinity, drop: 0 } });
export function installEyeItems(items) {
  if (items[END_PORTAL]) items[END_PORTAL].hidden = true;
  items[ITEM_EYE_OF_ENDER] = { id: ITEM_EYE_OF_ENDER, name: "Eye of Ender", texture: "ender_eye", stack: 64, color: "#2f7a5d" };
}
