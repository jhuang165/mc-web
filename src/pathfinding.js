// Minecraft Java 1.7.10 path finding, ported from the decoded classes PathPoint
// (aye), Path (ayd, the binary heap), PathEntity (ayf), PathFinder (ayg) and
// PathNavigate (vv). See public/research/pathfinding.md for the obfuscated names,
// what is ported and the deliberate deviations (a node cap and a search budget).
import { isPlant, WEB, LADDER } from "./world.js";
const f = Math.fround;
const WATER = 10, LAVA = 42;
const floor = Math.floor;
// MathHelper.floor_float (qh.d) / ceiling_float (qh.f).
const floorFloat = (v) => { const i = Math.trunc(v); return v < i ? i - 1 : i; };
const ceilFloat = (v) => { const i = Math.trunc(v); return v > i ? i + 1 : i; };

// PathPoint.makeHash (aye.a(III)I).
export function makeHash(x, y, z) {
  return (((y & 255) | ((x & 32767) << 8) | ((z & 32767) << 24) | (x < 0 ? 0x80000000 : 0) | (z < 0 ? 0x8000 : 0)) | 0);
}
// PathPoint (aye): `cost` is e (distance from the start), `heuristic` f, `total` g,
// `index` d (heap slot, -1 when not queued), `previous` h, `visited` i.
export class PathPoint {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.hash = makeHash(x, y, z);
    this.index = -1;
    this.cost = 0;
    this.heuristic = 0;
    this.total = 0;
    this.previous = null;
    this.visited = false;
  }
  // aye.a(aye): the float euclidean distance.
  distanceTo(o) {
    const a = f(o.x - this.x), b = f(o.y - this.y), c = f(o.z - this.z);
    return f(Math.sqrt(f(f(f(a * a) + f(b * b)) + f(c * c))));
  }
  // aye.b(aye): the float squared distance. PathFinder's cost and heuristic use this one.
  distanceToSquared(o) {
    const a = f(o.x - this.x), b = f(o.y - this.y), c = f(o.z - this.z);
    return f(f(f(a * a) + f(b * b)) + f(c * c));
  }
  equals(o) {
    return o instanceof PathPoint && this.hash === o.hash && this.x === o.x && this.y === o.y && this.z === o.z;
  }
  isAssigned() {
    return this.index >= 0;
  }
  toString() {
    return this.x + ", " + this.y + ", " + this.z;
  }
}
// Path (ayd): a zero-based binary min-heap on PathPoint.total, growing by doubling
// from 1024 slots; adding a point that is already queued throws "OW KNOWS!".
export class Path {
  constructor() {
    this.points = new Array(1024).fill(null);
    this.count = 0;
  }
  addPoint(p) {
    if (p.index >= 0) throw new Error("OW KNOWS!");
    if (this.count === this.points.length) {
      const bigger = new Array(this.count << 1).fill(null);
      for (let i = 0; i < this.count; i++) bigger[i] = this.points[i];
      this.points = bigger;
    }
    this.points[this.count] = p;
    p.index = this.count;
    this.sortBack(this.count++);
    return p;
  }
  clearPath() {
    this.count = 0;
  }
  dequeue() {
    const top = this.points[0];
    this.points[0] = this.points[--this.count];
    this.points[this.count] = null;
    if (this.count > 0) this.sortForward(0);
    top.index = -1;
    return top;
  }
  changeDistance(p, total) {
    const old = p.total;
    p.total = total;
    if (total < old) this.sortBack(p.index);
    else this.sortForward(p.index);
  }
  sortBack(i) {
    const p = this.points[i], t = p.total;
    while (i > 0) {
      const parent = (i - 1) >> 1, q = this.points[parent];
      if (!(t < q.total)) break;
      this.points[i] = q;
      q.index = i;
      i = parent;
    }
    this.points[i] = p;
    p.index = i;
  }
  sortForward(i) {
    const p = this.points[i], t = p.total;
    for (;;) {
      const l = 1 + (i << 1), r = l + 1;
      if (l >= this.count) break;
      const lp = this.points[l], lt = lp.total;
      let rp = null, rt = Infinity;
      if (r < this.count) {
        rp = this.points[r];
        rt = rp.total;
      }
      if (lt < rt) {
        if (!(lt < t)) break;
        this.points[i] = lp;
        lp.index = i;
        i = l;
      } else {
        if (!(rt < t)) break;
        this.points[i] = rp;
        rp.index = i;
        i = r;
      }
    }
    this.points[i] = p;
    p.index = i;
  }
  isPathEmpty() {
    return this.count === 0;
  }
}
// PathEntity (ayf). `width` is the float width of the entity the path was found for
// at use time (getVectorFromIndex reads the entity).
export class PathEntity {
  constructor(points) {
    this.points = points;
    this.index = 0;
    this.length = points.length;
  }
  incrementPathIndex() {
    this.index++;
  }
  isFinished() {
    return this.index >= this.length;
  }
  getFinalPathPoint() {
    return this.length > 0 ? this.points[this.length - 1] : null;
  }
  getPathPointFromIndex(i) {
    return this.points[i];
  }
  // ayf.a(sa, int): the point's block corner moved by half the (int)(width + 1) footprint.
  getVectorFromIndex(entity, i) {
    const p = this.points[i], half = Math.trunc(f(entity.width + 1)) * 0.5;
    return { x: p.x + half, y: p.y, z: p.z + half };
  }
  getPosition(entity) {
    return this.getVectorFromIndex(entity, this.index);
  }
  isSamePath(other) {
    if (!other || other.points.length !== this.points.length) return false;
    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i], b = other.points[i];
      if (a.x !== b.x || a.y !== b.y || a.z !== b.z) return false;
    }
    return true;
  }
  isDestinationSame(v) {
    const p = this.getFinalPathPoint();
    return p ? p.x === floor(v.x) && p.z === floor(v.z) : false;
  }
}
// Block descriptions for the PathFinder: the Material and the Block properties it
// reads. `passable` is Block.getBlocksMovement (aji.b(Lahl;III)Z); BlockLiquid
// overrides it to `material != lava`. The game has no doors, fences, trapdoors or
// rails yet; the flags exist so those branches are ported and testable.
export function defaultClassify(id) {
  if (id === 0) return { air: true, passable: true };
  if (id === WATER) return { water: true, passable: true };
  if (id === LAVA) return { lava: true, passable: false };
  // Material.circuits (torch, ladder) and webs do not block movement.
  if (id === 20 || id === WEB || id === LADDER || isPlant(id)) return { passable: true };
  return { passable: false };
}
const classifyCache = new Map();
const cachedClassify = (id) => {
  let c = classifyCache.get(id);
  if (!c) classifyCache.set(id, (c = defaultClassify(id)));
  return c;
};
// PathFinder.func_82565_a (ayg.a static, 8 arguments): how an entity of `size` (a
// PathPoint of the (int)(width+1) footprint) fares standing at the corner x, y, z.
// 1 clear, 2 clear with water or a trapdoor in the way, 0 blocked, -1 water to avoid,
// -2 lava, -3 fence/wall/rail, -4 trapdoor.
export function getVerticalOffset(entity, x, y, z, size, avoidWater, breakDoors, openDoors, world, classify = cachedClassify) {
  let flag = false;
  for (let i = x; i < x + size.x; i++)
    for (let j = y; j < y + size.y; j++)
      for (let k = z; k < z + size.z; k++) {
        const id = world.get(i, j, k), b = classify(id);
        if (b.air) continue;
        if (b.trapdoor) flag = true;
        else if (b.water) {
          if (avoidWater) return -1;
          flag = true;
        } else if (!openDoors && b.door) return 0;
        const renderType = b.renderType | 0;
        if (renderType === 9) {
          const here = classify(world.get(floor(entity.x), floor(entity.y), floor(entity.z))).renderType;
          if (here === 9) continue;
          if (classify(world.get(floor(entity.x), floor(entity.y) - 1, floor(entity.z))).renderType === 9) continue;
          return -3;
        }
        if (b.passable) continue;
        if (breakDoors && b.door) continue;
        if (renderType === 11 || b.fenceGate || renderType === 32) return -3;
        if (b.trapdoor) return -4;
        if (b.lava) {
          if (entity.inLava) continue;
          return -2;
        }
        return 0;
      }
  return flag ? 2 : 1;
}
// PathFinder (ayg). The constructor takes (world, openDoors e, breakDoors f,
// avoidsWater g, canSwim h) like the original; `entity` supplies x/y/z (minX, minY and
// minZ are x - width/2, y and z - width/2), width, height, inWater, inLava and
// maxSafePointTries() (sw.ax).
// Deviations from the original: `maxNodes` stops a search that has expanded that many
// points (the original has no cap and a wall-less 40 block range expands about 70000).
export class PathFinder {
  constructor(world, openDoors, breakDoors, avoidsWater, canSwim, options = {}) {
    this.world = world;
    this.openDoors = openDoors;
    this.breakDoors = breakDoors;
    this.avoidsWater = avoidsWater;
    this.canSwim = canSwim;
    this.classify = options.classify || cachedClassify;
    this.maxNodes = options.maxNodes ?? Infinity;
    this.path = new Path();
    this.pointMap = new Map();
    this.pathOptions = new Array(32).fill(null);
    this.expanded = 0;
  }
  // ahb.getEntityPathToXYZ / getPathEntityToEntity are the world-level entry points.
  createEntityPathToEntity(entity, target, range) {
    return this.createEntityPathTo(entity, target.x, target.minY ?? target.y, target.z, range);
  }
  createEntityPathToBlock(entity, x, y, z, range) {
    return this.createEntityPathTo(entity, f(f(x) + f(0.5)), f(f(y) + f(0.5)), f(f(z) + f(0.5)), range);
  }
  createEntityPathTo(entity, tx, ty, tz, range) {
    this.path.clearPath();
    this.pointMap.clear();
    let avoids = this.avoidsWater, y;
    const feet = entity.y, half = f(entity.width / 2);
    if (this.canSwim && entity.inWater) {
      y = Math.trunc(feet);
      for (let id = this.world.get(floor(entity.x), y, floor(entity.z)); id === WATER; id = this.world.get(floor(entity.x), y, floor(entity.z))) y++;
      avoids = this.avoidsWater;
      this.avoidsWater = false;
    } else y = floor(feet + 0.5);
    const start = this.openPoint(floor(entity.x - half), y, floor(entity.z - half));
    const end = this.openPoint(floor(tx - half), floor(ty), floor(tz - half));
    const size = new PathPoint(floorFloat(f(entity.width + 1)), floorFloat(f(entity.height + 1)), floorFloat(f(entity.width + 1)));
    const result = this.addToPath(entity, start, end, size, range);
    this.avoidsWater = avoids;
    return result;
  }
  addToPath(entity, start, end, size, range) {
    start.cost = 0;
    start.heuristic = start.distanceToSquared(end);
    start.total = start.heuristic;
    this.path.clearPath();
    this.path.addPoint(start);
    let closest = start;
    this.expanded = 0;
    while (!this.path.isPathEmpty()) {
      const cur = this.path.dequeue();
      if (cur.equals(end)) return this.createEntityPath(start, end);
      if (cur.distanceToSquared(end) < closest.distanceToSquared(end)) closest = cur;
      cur.visited = true;
      if (++this.expanded > this.maxNodes) break;
      const n = this.findPathOptions(entity, cur, size, end, range);
      for (let i = 0; i < n; i++) {
        const next = this.pathOptions[i], g = f(cur.cost + cur.distanceToSquared(next));
        if (!next.isAssigned() || g < next.cost) {
          next.previous = cur;
          next.cost = g;
          next.heuristic = next.distanceToSquared(end);
          if (next.isAssigned()) this.path.changeDistance(next, f(next.cost + next.heuristic));
          else {
            next.total = f(next.cost + next.heuristic);
            this.path.addPoint(next);
          }
        }
      }
    }
    return closest === start ? null : this.createEntityPath(start, closest);
  }
  // ayg.b: the four horizontal neighbours (+z, -x, +x, -z), a one block jump allowed
  // only when the cell above can be entered; kept when unvisited and within range.
  findPathOptions(entity, cur, size, end, range) {
    let jump = 0;
    if (this.verticalOffset(entity, cur.x, cur.y + 1, cur.z, size) === 1) jump = 1;
    const a = this.safePoint(entity, cur.x, cur.y, cur.z + 1, size, jump),
      b = this.safePoint(entity, cur.x - 1, cur.y, cur.z, size, jump),
      c = this.safePoint(entity, cur.x + 1, cur.y, cur.z, size, jump),
      d = this.safePoint(entity, cur.x, cur.y, cur.z - 1, size, jump);
    let n = 0;
    for (const p of [a, b, c, d]) if (p && !p.visited && p.distanceTo(end) < range) this.pathOptions[n++] = p;
    return n;
  }
  // ayg.a(sa, III aye, int): getSafePoint.
  safePoint(entity, x, y, z, size, jump) {
    let point = null;
    const v = this.verticalOffset(entity, x, y, z, size);
    if (v === 2) return this.openPoint(x, y, z);
    if (v === 1) point = this.openPoint(x, y, z);
    if (point === null && jump > 0 && v !== -3 && v !== -4 && this.verticalOffset(entity, x, y + jump, z, size) === 1) {
      point = this.openPoint(x, y + jump, z);
      y += jump;
    }
    if (point !== null) {
      let fall = 0, below = 0;
      while (y > 0) {
        below = this.verticalOffset(entity, x, y - 1, z, size);
        if (this.avoidsWater && below === -1) return null;
        if (below !== 1) break;
        if (fall++ >= entity.maxSafePointTries()) return null;
        y--;
        if (y > 0) point = this.openPoint(x, y, z);
      }
      if (below === -2) return null;
    }
    return point;
  }
  verticalOffset(entity, x, y, z, size) {
    return getVerticalOffset(entity, x, y, z, size, this.avoidsWater, this.breakDoors, this.openDoors, this.world, this.classify);
  }
  openPoint(x, y, z) {
    const hash = makeHash(x, y, z);
    let p = this.pointMap.get(hash);
    if (!p) this.pointMap.set(hash, (p = new PathPoint(x, y, z)));
    return p;
  }
  // ayg.a(aye, aye): the previous links from `end` back to `start` as a PathEntity.
  createEntityPath(start, end) {
    let n = 1;
    for (let p = end; p.previous; p = p.previous) n++;
    const points = new Array(n);
    let p = end;
    points[--n] = p;
    while (p.previous) {
      p = p.previous;
      points[--n] = p;
    }
    return new PathEntity(points);
  }
}

// --- PathNavigate (vv) ---
// The navigator reads its entity through a small interface (all in Java units):
// x, y (feet, minY), z, width, height, inWater, inLava, onGround, moveHelper,
// followRange, world, isRidingChicken, maxSafePointTries().
// Per-tick search budget: the original runs an unbounded A* whenever a task asks; a
// shared counter lets EntityWorld spread the worst case over several ticks.
export class PathNavigate {
  constructor(entity, world, options = {}) {
    this.entity = entity;
    this.world = world;
    this.currentPath = null;
    this.speed = 0;
    this.totalTicks = 0;
    this.ticksAtLastPos = 0;
    this.lastPos = { x: 0, y: 0, z: 0 };
    this.noSunPath = false;
    this.canPassOpenDoors = true;
    this.canPassClosedDoors = false;
    this.avoidsWater = false;
    this.canSwim = false;
    this.followRange = options.followRange ?? 16;
    this.classify = options.classify || cachedClassify;
    this.maxNodes = options.maxNodes ?? 1500;
    this.budget = options.budget || null;
    this.searches = 0;
  }
  setAvoidsWater(v) {
    this.avoidsWater = v;
  }
  getAvoidsWater() {
    return this.avoidsWater;
  }
  setBreakDoors(v) {
    this.canPassClosedDoors = v;
  }
  setEnterDoors(v) {
    this.canPassOpenDoors = v;
  }
  setCanSwim(v) {
    this.canSwim = v;
  }
  getCanSwim() {
    return this.canSwim;
  }
  setAvoidSun(v) {
    this.noSunPath = v;
  }
  // vv.d: the follow-range attribute as a float.
  getPathSearchRange() {
    return f(this.followRange);
  }
  noPath() {
    return !this.currentPath || this.currentPath.isFinished();
  }
  getPath() {
    return this.currentPath;
  }
  clearPathEntity() {
    this.currentPath = null;
  }
  // vv.l: only entities on the ground, swimmers in liquid, or a zombie riding a chicken.
  canNavigate() {
    const e = this.entity;
    return e.onGround || (this.canSwim && (e.inWater || e.inLava)) || !!e.isRidingChicken;
  }
  finder() {
    return new PathFinder(this.world, this.canPassOpenDoors, this.canPassClosedDoors, this.avoidsWater, this.canSwim, { classify: this.classify, maxNodes: this.maxNodes });
  }
  // Spends one unit of the shared search budget; false when exhausted this tick.
  spend() {
    if (!this.budget) return true;
    if (this.budget.left <= 0) {
      this.budget.denied = (this.budget.denied || 0) + 1;
      return false;
    }
    this.budget.left--;
    return true;
  }
  getPathToXYZ(x, y, z) {
    if (!this.canNavigate() || !this.spend()) return null;
    this.searches++;
    return this.finder().createEntityPathToBlock(this.entity, floor(x), Math.trunc(y), floor(z), this.getPathSearchRange());
  }
  tryMoveToXYZ(x, y, z, speed) {
    return this.setPath(this.getPathToXYZ(floor(x), Math.trunc(y), floor(z)), speed);
  }
  getPathToEntityLiving(target) {
    if (!this.canNavigate() || !this.spend()) return null;
    this.searches++;
    return this.finder().createEntityPathToEntity(this.entity, target, this.getPathSearchRange());
  }
  tryMoveToEntityLiving(target, speed) {
    const path = this.getPathToEntityLiving(target);
    return path ? this.setPath(path, speed) : false;
  }
  // vv.a(ayf, D): a path equal to the current one keeps the current object (and its progress).
  setPath(path, speed) {
    if (!path) {
      this.currentPath = null;
      return false;
    }
    if (!path.isSamePath(this.currentPath)) this.currentPath = path;
    if (this.noSunPath) this.removeSunnyPath();
    if (this.currentPath.length === 0) return false;
    this.speed = speed;
    const e = this.entity, v = { x: e.x, y: this.getPathableYPos(), z: e.z };
    this.ticksAtLastPos = this.totalTicks;
    this.lastPos = v;
    return true;
  }
  onUpdateNavigation() {
    this.totalTicks++;
    if (this.noPath()) return;
    if (this.canNavigate()) this.pathFollow();
    if (this.noPath()) return;
    const v = this.currentPath.getPosition(this.entity);
    this.entity.moveHelper.setMoveTo(v.x, v.y, v.z, this.speed);
  }
  // vv.j / k: the entity's y for path purposes; a swimmer rides up through water blocks.
  getPathableYPos() {
    const e = this.entity;
    if (!(e.inWater && this.canSwim)) return floor(e.y + 0.5);
    let y = Math.trunc(e.y), id = this.world.get(floor(e.x), y, floor(e.z)), n = 0;
    while (id === WATER) {
      y++;
      id = this.world.get(floor(e.x), y, floor(e.z));
      if (++n > 16) return Math.trunc(e.y);
    }
    return y;
  }
  pathFollow() {
    const e = this.entity, path = this.currentPath, here = { x: e.x, y: this.getPathableYPos(), z: e.z };
    let n = path.length;
    for (let i = path.index; i < path.length; i++)
      if (path.points[i].y !== Math.trunc(here.y)) {
        n = i;
        break;
      }
    const w = f(e.width * e.width);
    for (let i = path.index; i < n; i++) {
      const v = path.getVectorFromIndex(e, i), dx = here.x - v.x, dy = here.y - v.y, dz = here.z - v.z;
      if (dx * dx + dy * dy + dz * dz < w) path.index = i + 1;
    }
    const sx = ceilFloat(e.width), sy = Math.trunc(e.height) + 1, sz = sx;
    for (let i = n - 1; i >= path.index; i--)
      if (this.isDirectPathBetweenPoints(here, path.getVectorFromIndex(e, i), sx, sy, sz)) {
        path.index = i;
        break;
      }
    if (this.totalTicks - this.ticksAtLastPos > 100) {
      const dx = here.x - this.lastPos.x, dy = here.y - this.lastPos.y, dz = here.z - this.lastPos.z;
      if (dx * dx + dy * dy + dz * dz < 2.25) this.clearPathEntity();
      this.ticksAtLastPos = this.totalTicks;
      this.lastPos = here;
    }
  }
  // vv.a(azw, azw, III): a grid walk from `from` to `to` along the footprint; every
  // cell crossed must be clear and have footing.
  isDirectPathBetweenPoints(from, to, sx, sy, sz) {
    let i = floor(from.x), j = floor(from.z);
    let dx = to.x - from.x, dz = to.z - from.z;
    const sq = dx * dx + dz * dz;
    if (sq < 1e-8) return false;
    const inv = 1 / Math.sqrt(sq);
    dx *= inv;
    dz *= inv;
    sx += 2;
    sz += 2;
    const y = Math.trunc(from.y);
    if (!this.isSafeToStandAt(i, y, j, sx, sy, sz, from, dx, dz)) return false;
    sx -= 2;
    sz -= 2;
    const d1 = 1 / Math.abs(dx), d2 = 1 / Math.abs(dz);
    let d3 = i - from.x, d4 = j - from.z;
    if (dx >= 0) d3 += 1;
    if (dz >= 0) d4 += 1;
    d3 /= dx;
    d4 /= dz;
    const stepX = dx < 0 ? -1 : 1, stepZ = dz < 0 ? -1 : 1, endX = floor(to.x), endZ = floor(to.z);
    let k = endX - i, l = endZ - j;
    while (k * stepX > 0 || l * stepZ > 0) {
      if (d3 < d4) {
        d3 += d1;
        i += stepX;
        k = endX - i;
      } else {
        d4 += d2;
        j += stepZ;
        l = endZ - j;
      }
      if (!this.isSafeToStandAt(i, y, j, sx, sy, sz, from, dx, dz)) return false;
    }
    return true;
  }
  // vv.a(IIIIIILazw;DD): the footprint (x - sx/2, z - sz/2) is clear and the cells below
  // it ahead of `from` are not air, not water (unless already swimming) and not lava.
  isSafeToStandAt(x, y, z, sx, sy, sz, from, dx, dz) {
    const x0 = x - Math.trunc(sx / 2), z0 = z - Math.trunc(sz / 2);
    if (!this.isPositionClear(x0, y, z0, sx, sy, sz, from, dx, dz)) return false;
    for (let xx = x0; xx < x0 + sx; xx++)
      for (let zz = z0; zz < z0 + sz; zz++) {
        const px = xx + 0.5 - from.x, pz = zz + 0.5 - from.z;
        if (px * dx + pz * dz < 0) continue;
        const b = this.classify(this.world.get(xx, y - 1, zz));
        if (b.air) return false;
        if (b.water && !this.entity.inWater) return false;
        if (b.lava) return false;
      }
    return true;
  }
  isPositionClear(x, y, z, sx, sy, sz, from, dx, dz) {
    for (let xx = x; xx < x + sx; xx++)
      for (let yy = y; yy < y + sy; yy++)
        for (let zz = z; zz < z + sz; zz++) {
          const px = xx + 0.5 - from.x, pz = zz + 0.5 - from.z;
          if (px * dx + pz * dz < 0) continue;
          if (!this.classify(this.world.get(xx, yy, zz)).passable) return false;
        }
    return true;
  }
  // vv.n: with noSunPath, trim the path at the first point under open sky.
  removeSunnyPath() {
    const path = this.currentPath, e = this.entity;
    if (!path) return;
    const sees = this.world.canSeeSky || ((x, y, z) => {
      for (let yy = y + 1; yy < 64; yy++) if (this.world.solid?.(x, yy, z)) return false;
      return true;
    });
    if (sees(floor(e.x), Math.trunc(e.y + 0.5), floor(e.z))) return;
    for (let i = 0; i < path.length; i++) {
      const p = path.points[i];
      if (sees(p.x, p.y, p.z)) {
        path.length = i - 1;
        return;
      }
    }
  }
}
