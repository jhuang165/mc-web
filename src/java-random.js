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
    const multiplier = Math.sqrt((-2 * strictLog(s)) / s); // StrictMath.sqrt (exact) and StrictMath.log (fdlibm: Math.log differs by an ulp for 0.6 % of nextGaussian values)
    this.nextGaussianValue = v2 * multiplier;
    this.haveNextGaussian = true;
    return v1 * multiplier;
  }
}

// StrictMath.log: fdlibm's __ieee754_log (java.lang.FdLibm.Log), for x in (0, 1) as nextGaussian uses it. Plain doubles, no fused multiply-add.
const LOG_BUF = new DataView(new ArrayBuffer(8));
export function strictLog(x) {
  const ln2Hi = 6.93147180369123816490e-01, ln2Lo = 1.90821492927058770002e-10, two54 = 1.80143985094819840000e+16,
    Lg1 = 6.666666666666735130e-01, Lg2 = 3.999999999940941908e-01, Lg3 = 2.857142874366239149e-01, Lg4 = 2.222219843214978396e-01,
    Lg5 = 1.818357216161805012e-01, Lg6 = 1.531383769920937332e-01, Lg7 = 1.479819860511658591e-01;
  LOG_BUF.setFloat64(0, x);
  let hx = LOG_BUF.getInt32(0), lx = LOG_BUF.getInt32(4), k = 0;
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54; x *= two54; LOG_BUF.setFloat64(0, x); hx = LOG_BUF.getInt32(0);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  let i = (hx + 0x95f64) & 0x100000;
  LOG_BUF.setFloat64(0, x); LOG_BUF.setInt32(0, hx | (i ^ 0x3ff00000)); x = LOG_BUF.getFloat64(0);
  k += i >> 20;
  const f = x - 1.0;
  let dk;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) { if (k === 0) return 0; dk = k; return dk * ln2Hi + dk * ln2Lo; }
    const R = f * f * (0.5 - 0.33333333333333333 * f);
    if (k === 0) return f - R;
    dk = k; return dk * ln2Hi - ((R - dk * ln2Lo) - f);
  }
  const s = f / (2.0 + f);
  dk = k;
  const z = s * s, w = z * z;
  i = hx - 0x6147a;
  const j = 0x6b851 - hx,
    t1 = w * (Lg2 + w * (Lg4 + w * Lg6)), t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * ln2Hi - ((hfsq - (s * (hfsq + R) + dk * ln2Lo)) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * ln2Hi - ((s * (f - R) - dk * ln2Lo) - f);
}

/**
 * A fresh Entity.rand: every native entity constructs its own java.util.Random, seeded from the system clock. Returns the `() => float` the item and orb code draws from.
 * (The constructors' own motion draws are Math.random, a different generator; entity-spawn sites keep using the host's `random` for those.)
 */
export function freshEntityRandom() {
  const r = new JavaRandom(Math.floor(Math.random() * 2 ** 48));
  return () => r.nextFloat();
}
