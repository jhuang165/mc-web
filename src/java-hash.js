// java.util.HashMap / HashSet iteration order for String keys (Java 8+ HashMap, the JVM the 1.7.10 launcher ships), so that
// command output, scoreboard.dat and the sidebar's tie order list entries in the order a native server would. Only the order is
// modelled: String.hashCode, the spread hash h ^ (h >>> 16), a power-of-two table that doubles past a 0.75 load factor (or when a
// bin reaches 9 entries while the table is under 64), insertion order inside a bin, updates keeping their place and removals never
// shrinking the table. Bins that native Java would turn into trees (9+ colliding keys in a table of 64+) keep list order here.

export function javaStringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
const spread = (h) => h ^ (h >>> 16);

export class JavaHashMap {
  constructor(entries) {
    this.table = Array.from({ length: 16 }, () => []);
    this.count = 0;
    if (entries) for (const [k, v] of entries) this.set(k, v);
  }
  get size() { return this.count; }
  bin(key) { return this.table[spread(javaStringHash(key)) & (this.table.length - 1)]; }
  has(key) { return this.bin(key).some((e) => e[0] === key); }
  get(key) { return this.bin(key).find((e) => e[0] === key)?.[1]; }
  set(key, value) {
    const bin = this.bin(key), hit = bin.find((e) => e[0] === key);
    if (hit) { hit[1] = value; return this; }
    bin.push([key, value]);
    // HashMap.putVal: treeifyBin resizes instead of treeifying while the table is under 64; then ++size > threshold resizes.
    if (bin.length > 8 && this.table.length < 64) this.resize();
    if (++this.count > this.table.length * 0.75) this.resize();
    return this;
  }
  delete(key) {
    const bin = this.bin(key), i = bin.findIndex((e) => e[0] === key);
    if (i < 0) return false;
    bin.splice(i, 1);
    this.count--;
    return true;
  }
  clear() { for (const b of this.table) b.length = 0; this.count = 0; } // HashMap.clear keeps the table size
  resize() {
    const old = this.table;
    this.table = Array.from({ length: old.length * 2 }, () => []);
    for (const bin of old) for (const e of bin) this.bin(e[0]).push(e); // the lo/hi split keeps relative order
  }
  *entries() { for (const bin of this.table) for (const e of bin) yield [e[0], e[1]]; }
  *keys() { for (const [k] of this.entries()) yield k; }
  *values() { for (const [, v] of this.entries()) yield v; }
  [Symbol.iterator]() { return this.entries(); }
}

export class JavaHashSet {
  constructor(values) { this.map = new JavaHashMap(); if (values) for (const v of values) this.add(v); }
  get size() { return this.map.size; }
  has(v) { return this.map.has(v); }
  add(v) { this.map.set(v, true); return this; }
  delete(v) { return this.map.delete(v); }
  clear() { this.map.clear(); }
  *values() { yield* this.map.keys(); }
  [Symbol.iterator]() { return this.values(); }
}
