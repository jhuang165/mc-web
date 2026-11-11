// EntityPainting (tb), EntityItemFrame (st) and ItemHangingEntity (acz) from the Minecraft Java 1.7.10
// JAR, through their superclass EntityHanging (ss): the direction and bounding-box maths
// (setDirection [ss.a(int)]), onValidSurface [ss.e] and its 100-tick re-check [ss.h], the painting's
// art choice (EnumArt [tc] fitting the wall, one pick from Entity.rand), attackEntityFrom [ss.a(ro,F),
// st.a(ro,F)], onBroken [tb.b(sa), st.b(sa,Z)], the frame's interactFirst [st.c(yz)] and NBT.
// Replayed against the unchanged classes in src/hanging.test.js (tools/probes/HangingProbe.java,
// public/research/hanging-reference.json).
//
// Facings are Direction indices: 0 south (+z), 1 west (-x), 2 north (-z), 3 east (+x). A tag can carry any byte (summon-reference.json:
// CommandSummon accepts Direction 4, 5, 127, -1; setDirection only sets yaw = dir * 90 and the box, and onValidSurface has no table lookup, so such
// an entity is kept and behaves like the z-axis case); the renderers draw it with no wall offset. `tx,ty,tz` is the
// wall block the entity hangs on (the clicked block); the entity itself sits 0.5625 in front of it.
// Native quirk kept: setDirection shrinks the box by 0.03125 on every axis (`-0.03125f` is subtracted
// from the minimum), which inverts the thickness axis (min > max). Every consumer therefore behaves as
// Java does: only a block cell that contains the whole thickness blocks placement, and two hanging
// entities never see each other as overlapping.
import { bindIds } from "./entity-ids.js";
import { JavaRandom } from "./java-random.js";
import { collisionBoxes } from "./world.js";
import { materialSolid } from "./plants.js";

const f = Math.fround;
// Browser item ids (the original ids are 321 and 389).
export const PAINTING_ITEM = 1700, FRAME_ITEM = 1701;
export const ORIGINAL_PAINTING = 321, ORIGINAL_FRAME = 389;
// EnumArt.values(): [title, sizeX, sizeY, offsetX, offsetY] in pixels.
export const ARTS = [
  ["Kebab", 16, 16, 0, 0], ["Aztec", 16, 16, 16, 0], ["Alban", 16, 16, 32, 0], ["Aztec2", 16, 16, 48, 0], ["Bomb", 16, 16, 64, 0],
  ["Plant", 16, 16, 80, 0], ["Wasteland", 16, 16, 96, 0], ["Pool", 32, 16, 0, 32], ["Courbet", 32, 16, 32, 32], ["Sea", 32, 16, 64, 32],
  ["Sunset", 32, 16, 96, 32], ["Creebet", 32, 16, 128, 32], ["Wanderer", 16, 32, 0, 64], ["Graham", 16, 32, 16, 64], ["Match", 32, 32, 0, 128],
  ["Bust", 32, 32, 32, 128], ["Stage", 32, 32, 64, 128], ["Void", 32, 32, 96, 128], ["SkullAndRoses", 32, 32, 128, 128], ["Wither", 32, 32, 160, 128],
  ["Fighters", 64, 32, 0, 96], ["Pointer", 64, 64, 0, 192], ["Pigscene", 64, 64, 64, 192], ["BurningSkull", 64, 64, 128, 192],
  ["Skeleton", 64, 48, 192, 64], ["DonkeyKong", 64, 48, 192, 112],
];
export const FRAME_PIXELS = 9;
// Direction.offsetX / offsetZ / facingToDirection / rotateOpposite.
export const DIR_X = [0, -1, 0, 1], DIR_Z = [1, 0, -1, 0];
export const FACING_TO_DIRECTION = [-1, -1, 2, 0, 1, 3], ROTATE_OPPOSITE = [2, 3, 0, 1];
const SLACK = f(-0.03125), DEPTH = f(0.5625);
// EntityHanging.func_70517_b: the even-size offset (32 and 64 pixel sides centre on a block edge).
const evenOffset = (px) => (px === 32 || px === 64 ? f(0.5) : 0);
const artIndex = (name) => ARTS.findIndex((a) => a[0] === name);

// EntityHanging.setDirection: the position, yaw and bounding box [minX, minY, minZ, maxX, maxY, maxZ]
// of a width x height pixel entity on facing `dir` of tile (tx, ty, tz).
export function hangingGeometry(dir, tx, ty, tz, widthPx, heightPx) {
  let yaw = f(dir * 90), w = f(widthPx), h = f(heightPx), d = f(widthPx);
  if (dir !== 2 && dir !== 0) w = f(0.5);
  else { d = f(0.5); yaw = f(ROTATE_OPPOSITE[dir] * 90); }
  w = f(w / 32); h = f(h / 32); d = f(d / 32);
  let x = f(f(tx) + f(0.5)), y = f(f(ty) + f(0.5)), z = f(f(tz) + f(0.5));
  if (dir === 2) z = f(z - DEPTH);
  if (dir === 1) x = f(x - DEPTH);
  if (dir === 0) z = f(z + DEPTH);
  if (dir === 3) x = f(x + DEPTH);
  if (dir === 2) x = f(x - evenOffset(widthPx));
  if (dir === 1) z = f(z + evenOffset(widthPx));
  if (dir === 0) x = f(x + evenOffset(widthPx));
  if (dir === 3) z = f(z - evenOffset(widthPx));
  y = f(y + evenOffset(heightPx));
  const half = (v) => v; // the native box spans the whole w/32 either side of the centre
  return {
    x, y, z, yaw,
    bb: [f(f(x - half(w)) - SLACK), f(f(y - half(h)) - SLACK), f(f(z - half(d)) - SLACK), f(f(x + half(w)) + SLACK), f(f(y + half(h)) + SLACK), f(f(z + half(d)) + SLACK)],
  };
}

// AxisAlignedBB.intersectsWith (strict, on each axis, whatever the order of min and max).
const intersects = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5];

export class Hanging {
  // `random(entity)` returns the entity's Entity.rand (a JavaRandom).
  constructor({ random = () => new JavaRandom(Math.floor(Math.random() * 2 ** 48)), ids } = {}) {
    Object.assign(this, { makeRandom: random, entities: [] });
    bindIds(this, ids); // entity-ids.js
    // Item drops ({ stack, x, posY, z, delay }) for the caller to spawn as item entities.
    this.drops = [];
  }
  get list() { return this.entities; }
  drain() { const d = this.drops; this.drops = []; return d; }
  pickable() { return this.entities.filter((e) => !e.dead); }

  size(e) { return e.kind === "painting" ? [ARTS[e.art][1], ARTS[e.art][2]] : [FRAME_PIXELS, FRAME_PIXELS]; }
  // EntityHanging.setDirection for the entity's current art and facing.
  place(e) {
    const [w, h] = this.size(e);
    Object.assign(e, hangingGeometry(e.dir, e.tx, e.ty, e.tz, w, h));
    e.prevYaw = e.yaw;
    return e;
  }
  make(kind, dir, tx, ty, tz, extra = {}) {
    const e = { id: this.nextId++, kind, dir, tx, ty, tz, art: 0, item: null, rotation: 0, dropChance: 1, ticks: 0, dead: false, x: 0, y: 0, z: 0, yaw: 0, prevYaw: 0, bb: null, ...extra };
    e.random = this.makeRandom(e);
    return this.place(e);
  }

  // /summon Painting | ItemFrame. EntityList.createEntityFromNBT runs readEntityFromNBT (setDirection puts the entity on its tile), then
  // CommandSummon.setLocationAndAngles(x, y, z, yaw, pitch) moves it to the command position keeping the yaw setDirection set. Entity.setPosition
  // then rebuilds the box from the constructor's 0.5 x 0.5 size (setDirection's own box is gone), so a summoned entity is a small cube standing on
  // (x, y, z) that onValidSurface, picking and arrows see; the tile, the art and the wall test keep the tag's TileX/Y/Z. A save and reload runs
  // setDirection again, which snaps it back to its tile.
  summon(kind, dir, tx, ty, tz, x, y, z, extra = {}) {
    const e = this.make(kind, dir, tx, ty, tz, extra);
    Object.assign(e, { x, y, z, bb: [x - 0.25, y, z - 0.25, x + 0.25, y + 0.5, z + 0.25], summoned: true });
    this.entities.push(e);
    this.joined?.(e); // entity-simulation.js (entityWalkers): the entity's place in World.loadedEntityList
    return e;
  }

  // EntityHanging.onValidSurface [ss.e]. World.getCollidingBoundingBoxes only finds blocks here (the
  // entity part of that call matches boxes and other hanging entities never intersect, see above).
  valid(world, e) {
    const bb = e.bb;
    const x0 = Math.floor(bb[0]), x1 = Math.floor(bb[3] + 1), z0 = Math.floor(bb[2]), z1 = Math.floor(bb[5] + 1);
    for (let x = x0; x < x1; x++)
      for (let y = Math.floor(bb[1]) - 1; y < Math.floor(bb[4] + 1); y++)
        for (let z = z0; z < z1; z++)
          for (const b of collisionBoxes(world, x, y, z))
            if (intersects(bb, [x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]])) return false;
    const [wpx, hpx] = this.size(e);
    const across = Math.max(1, Math.trunc(wpx / 16)), up = Math.max(1, Math.trunc(hpx / 16));
    let bx = e.tx, bz = e.tz;
    const half = (px) => f(f(px) / 32);
    if (e.dir === 2) bx = Math.floor(e.x - half(wpx));
    if (e.dir === 1) bz = Math.floor(e.z - half(wpx));
    if (e.dir === 0) bx = Math.floor(e.x - half(wpx));
    if (e.dir === 3) bz = Math.floor(e.z - half(wpx));
    const by = Math.floor(e.y - half(hpx));
    for (let i = 0; i < across; i++)
      for (let j = 0; j < up; j++) {
        const id = e.dir === 2 || e.dir === 0 ? world.get(bx + i, by + j, e.tz) : world.get(e.tx, by + j, bz + i);
        if (!materialSolid(id)) return false;
      }
    return true;
  }

  // EntityPainting(world, x, y, z, dir): every art that fits, one chosen with Entity.rand. When none
  // fits the last art stays selected (and onValidSurface is then false).
  createPainting(world, tx, ty, tz, dir, { art = null } = {}) {
    const e = this.make("painting", dir, tx, ty, tz);
    if (art !== null) { e.art = typeof art === "string" ? artIndex(art) : art; return this.place(e); }
    const fits = [];
    for (let i = 0; i < ARTS.length; i++) {
      e.art = i;
      this.place(e);
      if (this.valid(world, e)) fits.push(i);
    }
    if (fits.length) e.art = fits[e.random.nextInt(fits.length)];
    return this.place(e);
  }
  createFrame(tx, ty, tz, dir) { return this.make("frame", dir, tx, ty, tz); }

  // ItemHangingEntity.onItemUse: no top or bottom faces; the entity is created on the clicked block's
  // side and only added when it fits, and this returns true either way (the hand swings).
  // Returns { used, entity }; the caller takes one item from the stack when `entity` is set.
  use(kind, world, x, y, z, side) {
    if (side === 0 || side === 1) return { used: false, entity: null };
    const dir = FACING_TO_DIRECTION[side];
    const e = kind === "painting" ? this.createPainting(world, x, y, z, dir) : this.createFrame(x, y, z, dir);
    if (!this.valid(world, e)) return { used: true, entity: null };
    this.entities.push(e);
    this.joined?.(e);
    return { used: true, entity: e };
  }

  // Entity.entityDropItem(stack, 0): a pickup delay of 10 at the entity position.
  dropItem(e, stack) { this.drops.push({ stack, x: e.x, posY: e.y, z: e.z, delay: 10 }); }
  stackOf(id) { return { id, count: 1, damage: 0 }; }

  // EntityPainting.onBroken / EntityItemFrame.onBroken (func_146065_b with the frame item).
  // `by` is the breaking entity: { player: true, creative } or null.
  broken(e, by, withFrame = true) {
    const creative = !!(by?.player && by.creative);
    if (e.kind === "painting") {
      if (!creative) this.dropItem(e, this.stackOf(PAINTING_ITEM));
      return;
    }
    const item = e.item;
    if (creative) { e.item = null; return; }
    if (withFrame) this.dropItem(e, this.stackOf(FRAME_ITEM));
    if (item && e.random.nextFloat() < e.dropChance) { this.dropItem(e, { ...item }); }
  }

  // attackEntityFrom(source, amount): a frame holding an item drops it and stays (any source);
  // otherwise the entity dies and onBroken(source.getEntity()) runs. Always true.
  attack(e, by = null) {
    if (e.dead) return true;
    if (e.kind === "frame" && e.item) {
      const creative = !!(by?.player && by.creative);
      if (!creative) this.broken(e, by, false);
      e.item = null;
      return true;
    }
    this.kill(e, by);
    return true;
  }
  // EntityHanging.setDead then onBroken (attackEntityFrom, the 100-tick check and movement).
  kill(e, by = null) {
    if (e.dead) return;
    e.dead = true;
    this.broken(e, by);
    this.entities = this.entities.filter((x) => x !== e);
  }

  // EntityItemFrame.interactFirst: an empty frame takes one of the held item; a full one turns a
  // quarter. `held` is the held stack; returns { action: "insert"|"rotate"|null, item }.
  // The caller removes the held item (not in Creative) when action is "insert".
  interact(e, held) {
    if (e.kind !== "frame" || e.dead) return { action: null };
    if (!e.item) {
      if (!held?.count) return { action: null };
      e.item = { ...held, count: 1 };
      e.rotation = e.rotation % 4;
      return { action: "insert", item: e.item };
    }
    e.rotation = (e.rotation + 1) % 4;
    return { action: "rotate" };
  }

  // EntityHanging.onUpdate (server side): every 100th tick re-check the surface.
  tick(world, { active = () => true } = {}) {
    for (const e of [...this.entities]) this.tickOne(world, e, active);
  }
  // One entity's update where the loaded-entity walk reaches it (entity-simulation.js entityWalkers). A killed entity leaves `entities` at once.
  tickOne(world, e, active = () => true) {
    if (e.dead || !active(e)) return;
    // Native `tickCounter1++ == 100`: the check runs on the 101st update, then the counter restarts.
    if (e.ticks++ === 100) {
      e.ticks = 0;
      if (!this.valid(world, e)) this.kill(e, null);
    }
  }

  // Explosion.doExplosionA: entities whose box meets the 2 x size cube and whose position is within 2 x size
  // of the centre take attackEntityFrom(explosion source); the explosion source is never a player.
  explode(x, y, z, size) {
    const r = f(size) * 2, cube = [x - r - 1, y - r - 1, z - r - 1, x + r + 1, y + r + 1, z + r + 1];
    for (const e of [...this.entities]) {
      if (e.dead || !intersects(cube, e.bb)) continue;
      const dist = Math.hypot(e.x - x, e.y - y, e.z - z);
      if (dist > r || dist === 0) continue;
      this.attack(e, null);
    }
  }

  // EntityHanging.moveEntity/addVelocity: any movement breaks it (pistons, explosion pushes).
  push(e, dx, dy, dz) { if (!e.dead && dx * dx + dy * dy + dz * dz > 0) this.kill(e, null); }

  toJSON() {
    return this.entities.map((e) => ({
      kind: e.kind, dir: e.dir, tx: e.tx, ty: e.ty, tz: e.tz, x: e.x, y: e.y, z: e.z, art: e.kind === "painting" ? ARTS[e.art][0] : undefined,
      item: e.item ? structuredClone(e.item) : undefined, rotation: e.kind === "frame" ? e.rotation : undefined,
      dropChance: e.kind === "frame" && e.dropChance !== 1 ? e.dropChance : undefined,
    }));
  }
  // Rebuild entities from saved records (old saves have none). Unknown arts become Kebab (readEntityFromNBT).
  load(records) {
    this.entities = [];
    for (const r of Array.isArray(records) ? records : []) {
      if (!r || !Number.isInteger(r.dir) || r.dir < -128 || r.dir > 127 || ![r.tx, r.ty, r.tz].every(Number.isInteger)) continue;
      if (r.kind === "painting") {
        const art = artIndex(r.art);
        this.entities.push(this.make("painting", r.dir, r.tx, r.ty, r.tz, { art: art < 0 ? 0 : art }));
      } else if (r.kind === "frame") {
        this.entities.push(this.make("frame", r.dir, r.tx, r.ty, r.tz, {
          item: r.item?.count ? structuredClone(r.item) : null, rotation: ((Number(r.rotation) || 0) % 4 + 4) % 4,
          dropChance: Number.isFinite(r.dropChance) ? r.dropChance : 1,
        }));
      }
    }
    return this;
  }
  static fromJSON(records, options) { return new Hanging(options).load(records); }
}

// EntityArrow targets: EntityHanging.canBeCollidedWith is true (the arrow grows the box by 0.3).
export const hangingArrowTargets = (hanging) => (hanging?.pickable() ?? []).map((e) => ({ ref: e, box: e.bb }));

// EntityRenderer.getMouseOver for hanging entities: the nearest one whose box, grown by the 0.1
// collision border (which also un-inverts the thickness axis), the eye ray meets within `reach` and
// before `wallDistance`. `dir` must be a unit vector.
export function pickHanging(hanging, origin, dir, reach, wallDistance = reach) {
  let best = null;
  const limit = Math.min(reach, wallDistance), border = f(0.1);
  for (const entity of hanging?.pickable() ?? []) {
    const b = entity.bb, lo = [b[0] - border, b[1] - border, b[2] - border], hi = [b[3] + border, b[4] + border, b[5] + border];
    const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
    let near = 0, far = limit, inside = true;
    for (let i = 0; i < 3 && inside; i++) {
      if (Math.abs(d[i]) < 1e-8) { if (o[i] < lo[i] || o[i] > hi[i]) inside = false; continue; }
      const a = (lo[i] - o[i]) / d[i], c = (hi[i] - o[i]) / d[i];
      near = Math.max(near, Math.min(a, c));
      far = Math.min(far, Math.max(a, c));
      if (far < near) inside = false;
    }
    if (inside && near <= limit && (!best || near < best.distance)) best = { entity, distance: near };
  }
  return best;
}
