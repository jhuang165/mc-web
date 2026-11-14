// randomDisplayTick of three more 1.7.10 blocks (bytecode-read: BlockMycelium amd.b, BlockBrewingStand ajq.b, BlockEndPortal akt.b;
// the scan of the block classes with func_149734_b found exactly these missing from display-ticks.js). `random` is the tick's Random.
const f = Math.fround;
export const MYCELIUM = 57, BREWING_STAND = 134, END_PORTAL = 149; // this build's ids

export function extraDisplayTick(b, x, y, z, random, fx) {
  if (b === MYCELIUM) {
    // Block.randomDisplayTick (empty), then one time in 10 a "townaura" at y + 1.1F with zero velocity.
    if (random.nextInt(10) === 0) {
      const px = f(x + random.nextFloat()), pz = f(z + random.nextFloat());
      fx.spawn("townaura", px, f(y + f(1.1)), pz, 0, 0, 0);
    }
    return true;
  }
  if (b === BREWING_STAND) {
    const px = f(f(x + f(0.4)) + f(random.nextFloat() * f(0.2))), py = f(f(y + f(0.7)) + f(random.nextFloat() * f(0.3))), pz = f(f(z + f(0.4)) + f(random.nextFloat() * f(0.2)));
    fx.spawn("smoke", px, py, pz, 0, 0, 0);
    return true;
  }
  if (b === END_PORTAL) {
    const px = f(x + random.nextFloat()), pz = f(z + random.nextFloat());
    fx.spawn("smoke", px, f(y + f(0.8)), pz, 0, 0, 0);
    return true;
  }
  return false;
}
