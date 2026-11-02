// A bounded lighting volume over the resident chunk square. Coordinates exposed
// to gameplay stay absolute, including negative x/z. The existing fixed-point
// light solver is reused without changing legacy worlds' light arrays.
import { LightVolume } from './lighting.js';

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
}
