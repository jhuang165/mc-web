// java.util.Random; shared leaf module for terrain and live simulation.
const MASK = (1n << 48n) - 1n;
export class JavaRandom {
  constructor(seed) {
    this.setSeed(seed);
  }
  setSeed(seed) {
    this.seed = (BigInt(seed) ^ 0x5deece66dn) & MASK;
    this.haveNextGaussian = false;
  }
  // Browser snapshot of the internal state; feeding this through setSeed would
  // scramble it a second time. Keep the cached Gaussian as well as the LCG.
  save() {
    return {
      version: 1,
      seed: this.seed.toString(),
      gaussian: this.haveNextGaussian ? this.nextGaussianValue : null,
    };
  }
  restore(data) {
    if (
      !data ||
      data.version !== 1 ||
      typeof data.seed !== "string" ||
      !/^(0|[1-9]\d{0,14})$/.test(data.seed) ||
      BigInt(data.seed) > MASK ||
      (data.gaussian !== null && !Number.isFinite(data.gaussian))
    )
      return false;
    this.seed = BigInt(data.seed);
    this.haveNextGaussian = data.gaussian !== null;
    this.nextGaussianValue = this.haveNextGaussian ? data.gaussian : 0;
    return true;
  }
  next(bits) {
    this.seed = (this.seed * 0x5deece66dn + 0xbn) & MASK;
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }
  nextFloat() {
    return this.next(24) / (1 << 24);
  }
  // Random.nextInt(bound), including its rejection loop for non powers of two.
  nextInt(bound) {
    if (bound === undefined) return this.next(32);
    if (!(bound > 0)) throw new RangeError("bound must be positive");
    let r = this.next(31);
    const m = bound - 1;
    if ((bound & m) === 0) return Math.floor((bound * r) / 2147483648);
    for (let u = r; u - (r = u % bound) + m >= 2147483648; u = this.next(31));
    return r;
  }
  nextBoolean() {
    return this.next(1) !== 0;
  }
  nextDouble() {
    return (this.next(26) * 134217728 + this.next(27)) / 2 ** 53;
  }
  // Random.nextGaussian: the polar method, caching the second value of each pair.
  nextGaussian() {
    if (this.haveNextGaussian) {
      this.haveNextGaussian = false;
      return this.nextGaussianValue;
    }
    let v1, v2, s;
    do {
      v1 = 2 * this.nextDouble() - 1;
      v2 = 2 * this.nextDouble() - 1;
      s = v1 * v1 + v2 * v2;
    } while (s >= 1 || s === 0);
    const multiplier = Math.sqrt((-2 * Math.log(s)) / s); // StrictMath.sqrt/log: close enough in doubles
    this.nextGaussianValue = v2 * multiplier;
    this.haveNextGaussian = true;
    return v1 * multiplier;
  }
}
