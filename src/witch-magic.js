// EntityWitch.handleHealthUpdate(15) [yp.a(byte)], bytecode-read in batch 71: `for (i = 0; i < rand.nextInt(35) + 10; ++i)` (the bound is
// drawn again every pass) spawns "witchMagic" at (posX + g * 0.13, boundingBox.maxY + 0.5 + g * 0.13, posZ + g * 0.13) with zero
// velocity; the three gaussians are drawn in x, y, z order on the copy's Entity.rand. `spawn(name, x, y, z, vx, vy, vz)` may be null
// (the draws still happen). `at` = { x, y (feet), z, height }. Returns the number of particles.
export function witchMagicParticles(spawn, at, rand) {
  const top = at.y + at.height;
  let n = 0;
  for (let i = 0; i < rand.nextInt(35) + 10; i++) {
    const x = at.x + rand.nextGaussian() * 0.12999999523162842, y = top + 0.5 + rand.nextGaussian() * 0.12999999523162842, z = at.z + rand.nextGaussian() * 0.12999999523162842;
    spawn?.("witchMagic", x, y, z, 0, 0, 0);
    n++;
  }
  return n;
}
