// Minecraft Java 1.7.10 MapGenBase (aqx), MapGenCaves (aqw), MapGenRavine (aqs).
// Original numeric block IDs, x,z,y array order. Metadata is deliberately untouched by the native carvers.
import { JavaRandom, mhSin, mhCos } from "./lighting.js";
import { WorldChunkManager } from "./biome-layers.js";
const f = Math.fround,
  PI = f(Math.PI),
  HALF_PI = f(Math.PI / 2);
export const randomLong = (r) =>
  BigInt.asIntN(64, (BigInt(r.nextInt()) << 32n) + BigInt(r.nextInt()));
export class MapGenBase {
  constructor(seed, manager = new WorldChunkManager(seed), topAt = null) {
    this.seed = BigInt(seed);
    this.range = 8;
    this.random = new JavaRandom(0);
    this.manager = manager;
    this.topAt = topAt || ((x, z) => manager.biomeAt(x, z).topBlock);
  }
  generate(cx, cz, blocks) {
    const r = this.random;
    r.setSeed(this.seed);
    const a = randomLong(r),
      b = randomLong(r);
    for (let x = cx - this.range; x <= cx + this.range; x++)
      for (let z = cz - this.range; z <= cz + this.range; z++) {
        r.setSeed(
          BigInt.asIntN(64, BigInt(x) * a) ^
            BigInt.asIntN(64, BigInt(z) * b) ^
            this.seed,
        );
        this.recursiveGenerate(x, z, cx, cz, blocks);
      }
    return blocks;
  }
  recursiveGenerate() {}
  carve(blocks, cx, cz, x, y, z, rx, ry, shape = null) {
    const minX = Math.max(0, Math.floor(x - rx) - cx * 16 - 1),
      maxX = Math.min(16, Math.floor(x + rx) - cx * 16 + 1);
    const minY = Math.max(1, Math.floor(y - ry) - 1),
      maxY = Math.min(248, Math.floor(y + ry) + 1);
    const minZ = Math.max(0, Math.floor(z - rx) - cz * 16 - 1),
      maxZ = Math.min(16, Math.floor(z + rx) - cz * 16 + 1);
    // Check the walls plus top and bottom, skipping the interior vertical span. Both water IDs veto carving.
    for (let ix = minX; ix < maxX; ix++)
      for (let iz = minZ; iz < maxZ; iz++)
        for (let iy = maxY + 1; iy >= minY - 1; iy--) {
          if (iy >= 0 && iy < 256) {
            const b = blocks[(ix * 16 + iz) * 256 + iy];
            if (b === 8 || b === 9) return false;
          }
          if (
            iy !== minY - 1 &&
            ix !== minX &&
            ix !== maxX - 1 &&
            iz !== minZ &&
            iz !== maxZ - 1
          )
            iy = minY;
        }
    for (let ix = minX; ix < maxX; ix++) {
      const dx = (ix + cx * 16 + 0.5 - x) / rx;
      for (let iz = minZ; iz < maxZ; iz++) {
        const dz = (iz + cz * 16 + 0.5 - z) / rx;
        let index = (ix * 16 + iz) * 256 + maxY,
          grass = false;
        if (dx * dx + dz * dz >= 1) continue;
        // The native index starts at maxY while the geometric Y starts at maxY-1. Keep that offset.
        for (let iy = maxY - 1; iy >= minY; iy--, index--) {
          const dy = (iy + 0.5 - y) / ry;
          const inside = shape
            ? (dx * dx + dz * dz) * shape[iy] + (dy * dy) / 6 < 1
            : dy > -0.7 && dx * dx + dy * dy + dz * dz < 1;
          if (!inside) continue;
          const b = blocks[index];
          if (b === 2) grass = true;
          if (b !== 1 && b !== 2 && b !== 3) continue;
          if (iy < 10) blocks[index] = shape ? 10 : 11;
          else {
            blocks[index] = 0;
            if (grass && blocks[index - 1] === 3)
              blocks[index - 1] = this.topAt(ix + cx * 16, iz + cz * 16);
          }
        }
      }
    }
    return true;
  }
}
export class MapGenCaves extends MapGenBase {
  room(seed, cx, cz, blocks, x, y, z) {
    this.tunnel(
      seed,
      cx,
      cz,
      blocks,
      x,
      y,
      z,
      f(1 + f(this.random.nextFloat() * 6)),
      0,
      0,
      -1,
      -1,
      0.5,
    );
  }
  tunnel(
    seed,
    cx,
    cz,
    blocks,
    x,
    y,
    z,
    width,
    yaw,
    pitch,
    start,
    end,
    verticalScale,
  ) {
    const r = new JavaRandom(seed),
      centreX = cx * 16 + 8,
      centreZ = cz * 16 + 8;
    let yawDrift = 0,
      pitchDrift = 0;
    if (end <= 0) {
      const n = this.range * 16 - 16;
      end = n - r.nextInt(Math.trunc(n / 4));
    }
    let room = false;
    if (start === -1) {
      start = Math.trunc(end / 2);
      room = true;
    }
    const branch = r.nextInt(Math.trunc(end / 2)) + Math.trunc(end / 4),
      gentle = r.nextInt(6) === 0;
    for (let i = start; i < end; i++) {
      const radius = 1.5 + f(f(mhSin(f(f(i * PI) / end)) * width) * 1),
        vertical = radius * verticalScale;
      const cosPitch = mhCos(pitch);
      x += f(mhCos(yaw) * cosPitch);
      y += mhSin(pitch);
      z += f(mhSin(yaw) * cosPitch);
      pitch = f(pitch * f(gentle ? 0.92 : 0.7));
      pitch = f(pitch + f(pitchDrift * f(0.1)));
      yaw = f(yaw + f(yawDrift * f(0.1)));
      pitchDrift = f(pitchDrift * f(0.9));
      yawDrift = f(yawDrift * f(0.75));
      pitchDrift = f(
        pitchDrift + f(f(f(r.nextFloat() - r.nextFloat()) * r.nextFloat()) * 2),
      );
      yawDrift = f(
        yawDrift + f(f(f(r.nextFloat() - r.nextFloat()) * r.nextFloat()) * 4),
      );
      if (!room && i === branch && width > 1 && end > 0) {
        this.tunnel(
          randomLong(r),
          cx,
          cz,
          blocks,
          x,
          y,
          z,
          f(f(r.nextFloat() * f(0.5)) + f(0.5)),
          f(yaw - HALF_PI),
          f(pitch / 3),
          i,
          end,
          1,
        );
        this.tunnel(
          randomLong(r),
          cx,
          cz,
          blocks,
          x,
          y,
          z,
          f(f(r.nextFloat() * f(0.5)) + f(0.5)),
          f(yaw + HALF_PI),
          f(pitch / 3),
          i,
          end,
          1,
        );
        return;
      }
      if (!room && r.nextInt(4) === 0) continue;
      const dx = x - centreX,
        dz = z - centreZ,
        left = end - i,
        reach = f(f(width + 2) + 16);
      if (dx * dx + dz * dz - left * left > reach * reach) return;
      if (
        x < centreX - 16 - radius * 2 ||
        z < centreZ - 16 - radius * 2 ||
        x > centreX + 16 + radius * 2 ||
        z > centreZ + 16 + radius * 2
      )
        continue;
      const carved = this.carve(blocks, cx, cz, x, y, z, radius, vertical);
      if (room && carved) break;
    }
  }
  recursiveGenerate(x, z, cx, cz, blocks) {
    const r = this.random;
    let n = r.nextInt(r.nextInt(r.nextInt(15) + 1) + 1);
    if (r.nextInt(7) !== 0) n = 0;
    for (let i = 0; i < n; i++) {
      const px = x * 16 + r.nextInt(16),
        py = r.nextInt(r.nextInt(120) + 8),
        pz = z * 16 + r.nextInt(16);
      let count = 1;
      if (r.nextInt(4) === 0) {
        this.room(randomLong(r), cx, cz, blocks, px, py, pz);
        count += r.nextInt(4);
      }
      for (let j = 0; j < count; j++) {
        const yaw = f(f(r.nextFloat() * PI) * 2),
          pitch = f(f(f(r.nextFloat() - f(0.5)) * 2) / 8);
        let width = f(f(r.nextFloat() * 2) + r.nextFloat());
        if (r.nextInt(10) === 0)
          width = f(width * f(f(f(r.nextFloat() * r.nextFloat()) * 3) + 1));
        this.tunnel(
          randomLong(r),
          cx,
          cz,
          blocks,
          px,
          py,
          pz,
          width,
          yaw,
          pitch,
          0,
          0,
          1,
        );
      }
    }
  }
}
export class MapGenRavine extends MapGenBase {
  constructor(...args) {
    super(...args);
    this.shape = new Float32Array(1024);
  }
  tunnel(
    seed,
    cx,
    cz,
    blocks,
    x,
    y,
    z,
    width,
    yaw,
    pitch,
    start,
    end,
    verticalScale,
  ) {
    const r = new JavaRandom(seed),
      centreX = cx * 16 + 8,
      centreZ = cz * 16 + 8;
    let yawDrift = 0,
      pitchDrift = 0;
    if (end <= 0) {
      const n = this.range * 16 - 16;
      end = n - r.nextInt(Math.trunc(n / 4));
    }
    let room = false;
    if (start === -1) {
      start = Math.trunc(end / 2);
      room = true;
    }
    let value = 1;
    for (let i = 0; i < 256; i++) {
      if (i === 0 || r.nextInt(3) === 0)
        value = f(1 + f(f(r.nextFloat() * r.nextFloat()) * 1));
      this.shape[i] = f(value * value);
    }
    for (let i = start; i < end; i++) {
      let radius = 1.5 + f(f(mhSin(f(f(i * PI) / end)) * width) * 1),
        vertical = radius * verticalScale;
      radius *= r.nextFloat() * 0.25 + 0.75;
      vertical *= r.nextFloat() * 0.25 + 0.75;
      const cosPitch = mhCos(pitch);
      x += f(mhCos(yaw) * cosPitch);
      y += mhSin(pitch);
      z += f(mhSin(yaw) * cosPitch);
      pitch = f(pitch * f(0.7));
      pitch = f(pitch + f(pitchDrift * f(0.05)));
      yaw = f(yaw + f(yawDrift * f(0.05)));
      pitchDrift = f(pitchDrift * f(0.8));
      yawDrift = f(yawDrift * f(0.5));
      pitchDrift = f(
        pitchDrift + f(f(f(r.nextFloat() - r.nextFloat()) * r.nextFloat()) * 2),
      );
      yawDrift = f(
        yawDrift + f(f(f(r.nextFloat() - r.nextFloat()) * r.nextFloat()) * 4),
      );
      if (!room && r.nextInt(4) === 0) continue;
      const dx = x - centreX,
        dz = z - centreZ,
        left = end - i,
        reach = f(f(width + 2) + 16);
      if (dx * dx + dz * dz - left * left > reach * reach) return;
      if (
        x < centreX - 16 - radius * 2 ||
        z < centreZ - 16 - radius * 2 ||
        x > centreX + 16 + radius * 2 ||
        z > centreZ + 16 + radius * 2
      )
        continue;
      const carved = this.carve(
        blocks,
        cx,
        cz,
        x,
        y,
        z,
        radius,
        vertical,
        this.shape,
      );
      if (room && carved) break;
    }
  }
  recursiveGenerate(x, z, cx, cz, blocks) {
    const r = this.random;
    if (r.nextInt(50) !== 0) return;
    const px = x * 16 + r.nextInt(16),
      py = r.nextInt(r.nextInt(40) + 8) + 20,
      pz = z * 16 + r.nextInt(16);
    const yaw = f(f(r.nextFloat() * PI) * 2),
      pitch = f(f(f(r.nextFloat() - f(0.5)) * 2) / 8),
      width = f(f(f(r.nextFloat() * 2) + r.nextFloat()) * 2);
    this.tunnel(
      randomLong(r),
      cx,
      cz,
      blocks,
      px,
      py,
      pz,
      width,
      yaw,
      pitch,
      0,
      0,
      3,
    );
  }
}
