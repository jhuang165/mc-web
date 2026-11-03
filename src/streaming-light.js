// A bounded lighting volume over the resident chunk square. Coordinates exposed
// to gameplay stay absolute, including negative x/z. The existing fixed-point
// light solver is reused without changing legacy worlds' light arrays.
import { LightVolume } from './lighting.js';
import { SIZE } from './world.js';

export class StreamingLight {
  constructor(world, emission) {
    this.world = world;
    this.emission = emission;
    this.x = world.minX; this.z = world.minZ;
    this.inner = new LightVolume({ height: world.height, get: (x,y,z) => world.get(x+this.x,y,z+this.z) },
      emission && ((x,y,z,b) => emission(x+this.x,y,z+this.z,b)));
  }
  skyAt(x,y,z) { return this.inner.skyAt(x-this.x,y,z-this.z); }
  blockAt(x,y,z) { return this.inner.blockAt(x-this.x,y,z-this.z); }
  packed(x,y,z) { return this.inner.packed(x-this.x,y,z-this.z); }
  level(x,y,z,subtracted=0) { return this.inner.level(x-this.x,y,z-this.z,subtracted); }
  column(x,z) { this.inner.column(x-this.x,z-this.z); }
  box(box) { return box && {...box,x0:box.x0+this.x,x1:box.x1+this.x,z0:box.z0+this.z,z1:box.z1+this.z}; }
  update(x,y,z) { return this.box(this.inner.update(x-this.x,y,z-this.z)); }
  relight(x0,x1,z0,z1) { return this.box(this.inner.relight(x0-this.x,x1-this.x,z0-this.z,z1-this.z)); }
  // Follows the world's resident square after World.streamAround. The overlap keeps its light and only
  // the strips that can see a difference are relit: the new columns plus 15 blocks into the kept
  // area, and the 16 blocks along the edge the removed columns leave (outside the volume reads as open
  // sky, as in a fresh build). Light cannot travel 15 blocks, so cells beyond those strips already hold
  // their final values and LightVolume.relight's inflow from them is exact: the result equals a newly
  // built volume. A diagonal or long move relights everything. Returns the changed boxes (absolute
  // coordinates) or null when the whole volume was rebuilt.
  shift() {
    const dx = this.world.minX - this.x, dz = this.world.minZ - this.z;
    if (!dx && !dz) return [];
    const v = this.inner, H = v.height;
    this.x += dx; this.z += dz;
    if ((dx && dz) || Math.abs(dx) + Math.abs(dz) + 47 > SIZE) {
      for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) v.column(x, z);
      v.relight(0, SIZE - 1, 0, SIZE - 1);
      return null;
    }
    // Translate the overlap: new local (x, z) holds old local (x + dx, z + dz).
    const sky = new Uint8Array(v.sky.length), block = new Uint8Array(v.block.length), heights = new v.heights.constructor(v.heights.length);
    const x0 = Math.max(0, -dx), x1 = Math.min(SIZE, SIZE - dx), z0 = Math.max(0, -dz), z1 = Math.min(SIZE, SIZE - dz);
    for (let x = x0; x < x1; x++) {
      const to = x * SIZE + z0, from = (x + dx) * SIZE + z0 + dz;
      sky.set(v.sky.subarray(from * H, (from + z1 - z0) * H), to * H);
      block.set(v.block.subarray(from * H, (from + z1 - z0) * H), to * H);
      heights.set(v.heights.subarray(from, from + z1 - z0), to);
    }
    v.sky = sky; v.block = block; v.heights = heights;
    const boxes = [], d = dx || dz, n = Math.abs(d), strip = (a0, a1) => (dx ? [a0, a1, 0, SIZE - 1] : [0, SIZE - 1, a0, a1]);
    const fresh = d > 0 ? strip(SIZE - n, SIZE - 1) : strip(0, n - 1);
    for (let x = fresh[0]; x <= fresh[1]; x++) for (let z = fresh[2]; z <= fresh[3]; z++) v.column(x, z);
    for (const [a0, a1] of d > 0 ? [[SIZE - n - 15, SIZE - 1], [0, 15]] : [[0, n + 14], [SIZE - 16, SIZE - 1]]) {
      const changed = this.box(v.relight(...strip(a0, a1)));
      if (changed) boxes.push(changed);
    }
    return boxes;
  }
}
