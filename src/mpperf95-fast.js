// Batch 95 mpperf95: server tick speed (results unchanged). MC_MPPERF95=on (default) | off (reference path) | verify (both, throws on the first difference); tests set `fast95.mode`.
//   1. explosion.js explosionBlocks: PositionSet allocated a {h,x,y,z} object and a bin array per cell (about 1000-3000 per explosion). FlatPositionSet95 keeps the same
//      java.util.HashMap model (table size, 0.75 resize, bins in insertion order, a bin reaching 9 resizes below 64 / marks treeified) in reused typed arrays: entries are rows of
//      the arrays, bins are linked lists with a tail, a resize re-links each old bin in order into its low and high bin (the same split as the reference).

export const fast95 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF95) || "on", flat: 0 }; // flat: explosions answered by the flat set (tests)
export const fail95 = (what) => { throw new Error(`mpperf95 ${what} mismatch`); };

let cap = 4096, ex = new Int32Array(cap), ey = new Int32Array(cap), ez = new Int32Array(cap), eh = new Int32Array(cap), en = new Int32Array(cap);
let head = new Int32Array(16), tail = new Int32Array(16), busy = false;

export class FlatPositionSet95 {
  constructor() {
    this.count = 0; this.size = 0; this.threshold = 0; this.treeified = false; this.tcap = 0;
  }
  static acquire() { if (busy) return null; busy = true; return new FlatPositionSet95(); }
  release() { busy = false; }
  grow() {
    cap *= 2;
    const g = (a) => { const b = new Int32Array(cap); b.set(a); return b; };
    ex = g(ex); ey = g(ey); ez = g(ez); eh = g(eh); en = g(en);
  }
  resize() {
    const oldCap = this.tcap, ncap = oldCap ? oldCap * 2 : 16;
    this.threshold = oldCap ? this.threshold * 2 : 12;
    if (head.length < ncap) { const h2 = new Int32Array(ncap), t2 = new Int32Array(ncap); h2.set(head); t2.set(tail); head = h2; tail = t2; }
    if (!oldCap) { head.fill(-1, 0, ncap); tail.fill(-1, 0, ncap); }
    else {
      // bins j < oldCap keep their entries in order, split into j (hash bit clear) and j + oldCap (set); the high half is empty until filled.
      head.fill(-1, oldCap, ncap); tail.fill(-1, oldCap, ncap);
      for (let j = 0; j < oldCap; j++) {
        let k = head[j], lh = -1, lt = -1, hh = -1, ht = -1;
        while (k !== -1) {
          const nx = en[k];
          en[k] = -1;
          if (eh[k] & oldCap) { if (ht === -1) hh = k; else en[ht] = k; ht = k; }
          else { if (lt === -1) lh = k; else en[lt] = k; lt = k; }
          k = nx;
        }
        head[j] = lh; tail[j] = lt; head[j + oldCap] = hh; tail[j + oldCap] = ht;
      }
    }
    this.tcap = ncap;
  }
  add(x, y, z) {
    if (!this.tcap) this.resize();
    const hh = (Math.imul(x, 8976890) + Math.imul(y, 981131) + z) | 0, h = hh ^ (hh >>> 16), i = h & (this.tcap - 1);
    let k = head[i], binLen = 0;
    while (k !== -1) { if (eh[k] === h && ex[k] === x && ey[k] === y && ez[k] === z) return false; k = en[k]; binLen++; }
    if (this.count === cap) this.grow();
    const n = this.count++;
    ex[n] = x; ey[n] = y; ez[n] = z; eh[n] = h; en[n] = -1;
    if (tail[i] === -1) head[i] = n; else en[tail[i]] = n;
    tail[i] = n;
    if (binLen >= 8) { // the bin now holds 9 or more
      if (this.tcap < 64) this.resize();
      else this.treeified = true;
    }
    if (++this.size > this.threshold) this.resize();
    return true;
  }
  list() {
    const out = [];
    for (let i = 0; i < this.tcap; i++) for (let k = head[i]; k !== -1; k = en[k]) out.push([ex[k], ey[k], ez[k]]);
    return out;
  }
}
