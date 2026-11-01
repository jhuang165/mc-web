// Minecraft 1.7.10 awj/awk/awl/awo, transcribed from the pinned client bytecode.
// Array order differs: Improved is x,z,y; Simplex is z,x. Keep operation order (no fused interpolation).
const GX = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, 0, -1, 0];
const GY = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1];
const GZ = [0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 1, 0, -1];
const grad = (h, x, y, z) => GX[h & 15] * x + GY[h & 15] * y + GZ[h & 15] * z;
const grad2 = (h, x, z) => GX[h & 15] * x + GZ[h & 15] * z;
const lerp = (t, a, b) => a + t * (b - a);
const fade = (x) => x * x * x * (x * (x * 6 - 15) + 10);
function init(random) {
  const offsets = [
    random.nextDouble() * 256,
    random.nextDouble() * 256,
    random.nextDouble() * 256,
  ];
  const p = new Int32Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 0; i < 256; i++) {
    const j = random.nextInt(256 - i) + i,
      v = p[i];
    p[i] = p[j];
    p[j] = v;
    p[i + 256] = p[i];
  }
  return [offsets, p];
}
export class NoiseGeneratorImproved {
  constructor(random) {
    [this.offsets, this.p] = init(random);
  }
  add(out, x, y, z, nx, ny, nz, sx, sy, sz, amplitude) {
    const p = this.p,
      [ox, oy, oz] = this.offsets,
      inv = 1 / amplitude;
    let index = 0,
      lastY = -1,
      a = 0,
      b = 0,
      c = 0,
      d = 0;
    for (let ix = 0; ix < nx; ix++) {
      let xx = x + ix * sx + ox;
      const fx = Math.floor(xx),
        X = fx & 255;
      xx -= fx;
      const u = fade(xx);
      for (let iz = 0; iz < nz; iz++) {
        let zz = z + iz * sz + oz;
        const fz = Math.floor(zz),
          Z = fz & 255;
        zz -= fz;
        const w = fade(zz);
        if (ny === 1) {
          const A = p[X],
            B = p[X + 1],
            AA = p[A] + Z,
            BA = p[B] + Z;
          a = lerp(u, grad2(p[AA], xx, zz), grad(p[BA], xx - 1, 0, zz));
          b = lerp(
            u,
            grad(p[AA + 1], xx, 0, zz - 1),
            grad(p[BA + 1], xx - 1, 0, zz - 1),
          );
          out[index++] += lerp(w, a, b) * inv;
          continue;
        }
        for (let iy = 0; iy < ny; iy++) {
          let yy = y + iy * sy + oy;
          const fy = Math.floor(yy),
            Y = fy & 255;
          yy -= fy;
          const v = fade(yy);
          // The original caches gradients until the integer y changes, including their fractional y!
          if (iy === 0 || Y !== lastY) {
            lastY = Y;
            const A = p[X] + Y,
              AA = p[A] + Z,
              AB = p[A + 1] + Z,
              B = p[X + 1] + Y,
              BA = p[B] + Z,
              BB = p[B + 1] + Z;
            a = lerp(u, grad(p[AA], xx, yy, zz), grad(p[BA], xx - 1, yy, zz));
            b = lerp(
              u,
              grad(p[AB], xx, yy - 1, zz),
              grad(p[BB], xx - 1, yy - 1, zz),
            );
            c = lerp(
              u,
              grad(p[AA + 1], xx, yy, zz - 1),
              grad(p[BA + 1], xx - 1, yy, zz - 1),
            );
            d = lerp(
              u,
              grad(p[AB + 1], xx, yy - 1, zz - 1),
              grad(p[BB + 1], xx - 1, yy - 1, zz - 1),
            );
          }
          out[index++] += lerp(w, lerp(v, a, b), lerp(v, c, d)) * inv;
        }
      }
    }
    return out;
  }
}
export class NoiseGeneratorOctaves {
  constructor(random, count) {
    this.generators = Array.from(
      { length: count },
      () => new NoiseGeneratorImproved(random),
    );
  }
  generate(
    x,
    y,
    z,
    nx,
    ny,
    nz,
    sx,
    sy,
    sz,
    out = new Float64Array(nx * ny * nz),
  ) {
    out.fill(0);
    let scale = 1;
    for (const g of this.generators) {
      let xx = x * scale * sx,
        yy = y * scale * sy,
        zz = z * scale * sz;
      const fx = Math.floor(xx),
        fz = Math.floor(zz);
      xx -= fx;
      zz -= fz;
      xx += fx % 16777216;
      zz += fz % 16777216;
      g.add(
        out,
        xx,
        yy,
        zz,
        nx,
        ny,
        nz,
        sx * scale,
        sy * scale,
        sz * scale,
        scale,
      );
      scale /= 2;
    }
    return out;
  }
  generate2D(x, z, nx, nz, sx, sz, _unused, out) {
    return this.generate(x, 10, z, nx, 1, nz, sx, 1, sz, out);
  }
}
const SG = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0, 1],
  [0, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1),
  G2 = (3 - Math.sqrt(3)) / 6;
// awo.a(double) deliberately subtracts one at zero and negative exact integers.
const simplexFloor = (x) => (x > 0 ? Math.trunc(x) : Math.trunc(x) - 1);
export class NoiseGeneratorSimplex {
  constructor(random) {
    [this.offsets, this.p] = init(random);
  }
  value(x, z) {
    const s = (x + z) * F2,
      i = simplexFloor(x + s),
      j = simplexFloor(z + s),
      t = (i + j) * G2;
    const x0 = x - (i - t),
      z0 = z - (j - t),
      ix = x0 > z0 ? 1 : 0,
      iz = 1 - ix;
    const x1 = x0 - ix + G2,
      z1 = z0 - iz + G2,
      x2 = x0 - 1 + 2 * G2,
      z2 = z0 - 1 + 2 * G2,
      p = this.p,
      I = i & 255,
      J = j & 255;
    const corner = (h, a, b) => {
      let q = 0.5 - a * a - b * b;
      if (q < 0) return 0;
      q *= q;
      return q * q * (SG[h][0] * a + SG[h][1] * b);
    };
    return (
      70 *
      (corner(p[I + p[J]] % 12, x0, z0) +
        corner(p[I + ix + p[J + iz]] % 12, x1, z1) +
        corner(p[I + 1 + p[J + 1]] % 12, x2, z2))
    );
  }
  add(out, x, z, nx, nz, sx, sz, amplitude) {
    let i = 0;
    for (let iz = 0; iz < nz; iz++) {
      const zz = (z + iz) * sz + this.offsets[1];
      for (let ix = 0; ix < nx; ix++)
        out[i++] += this.value((x + ix) * sx + this.offsets[0], zz) * amplitude;
    }
    return out;
  }
}
export class NoiseGeneratorPerlin {
  constructor(random, count) {
    this.generators = Array.from(
      { length: count },
      () => new NoiseGeneratorSimplex(random),
    );
  }
  value(x, z) {
    let sum = 0,
      scale = 1;
    for (const g of this.generators) {
      sum += g.value(x * scale, z * scale) / scale;
      scale /= 2;
    }
    return sum;
  }
  generate(
    x,
    z,
    nx,
    nz,
    sx,
    sz,
    lacunarity,
    persistence = 0.5,
    out = new Float64Array(nx * nz),
  ) {
    out.fill(0);
    let amplitude = 1,
      frequency = 1;
    for (const g of this.generators) {
      g.add(
        out,
        x,
        z,
        nx,
        nz,
        sx * frequency * amplitude,
        sz * frequency * amplitude,
        0.55 / amplitude,
      );
      frequency *= lacunarity;
      amplitude *= persistence;
    }
    return out;
  }
}
