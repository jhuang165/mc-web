// Batch 49: the iteration order of a java.util.HashSet whose elements hash to an int, given its insert / remove history.
// Natively EntityTracker keeps its entries in a HashSet<EntityTrackerEntry> and EntityTracker.updateTrackedEntities walks that set (bytecode-read: field `c` of `mn` is
// `new HashSet()`, `a()` iterates it twice, trackEntity adds, untrackEntity removes), and EntityTrackerEntry.hashCode() returns the entity id (`my.hashCode` = `sa.y()`;
// equals compares ids too), so the order entities send their packets in is the HashMap bucket order of their ids, not the order they were spawned in.
//
// Which HashMap? 1.7.10 ran on Java 6, 7 and 8 and the launcher used whatever the user had. The reference models JAVA 8 and later ("java8", the default): it is the algorithm of
// the JDK that executes the probe (tools/probes/TrackerOrderProbe.java records java.version in the reference; JDK 19 here, and the HashMap code is the same from 8 to 19 for int
// hashes). "java7" (later JDK 7 updates) is also available; it is written from the OpenJDK 7 source and NOT executed. The two differ in four ways:
//   - the hash: Java 8 `h ^ (h >>> 16)`; Java 7 `h ^= (h >>> 20) ^ (h >>> 12); h ^ (h >>> 7) ^ (h >>> 4)` (no alternative-hashing seed for int keys);
//   - a new key joins the END of its bucket chain in Java 8 and the FRONT in Java 7;
//   - Java 8 doubles the table after the insert that makes size exceed the threshold (12 at 16 buckets, 0.75 load factor) and keeps the relative order inside a bucket when it
//     splits; Java 7 doubles before the insert that finds size >= threshold and a non-empty bucket, and its transfer REVERSES the chains that land together;
//   - Java 8 only: a chain that reaches 9 nodes in a table smaller than 64 doubles it (treeifyBin). Treeified bins (9+ nodes at 64 buckets or more, which needs ids that agree
//     modulo the table size) are NOT modelled: the bin keeps list order here, natively its tree root moves to the front.
// Removal never shrinks the table (HashMap has no shrink), so a set that was once large keeps its larger capacity and its order.
// Iteration is bucket 0 upward, each chain from its first node.
const spread8 = (h) => (h ^ (h >>> 16)) | 0;
const spread7 = (h) => { h ^= (h >>> 20) ^ (h >>> 12); return (h ^ (h >>> 7) ^ (h >>> 4)) | 0; };

export class JavaHashSetOrder {
  constructor(mode = "java8") {
    if (mode !== "java8" && mode !== "java7") throw new Error(`unknown HashMap model ${mode}`);
    this.mode = mode;
    this.hash = mode === "java8" ? spread8 : spread7;
    this.table = new Array(16).fill(null).map(() => []); // each bin is a chain of { key, hash }, first node first
    this.size = 0;
    this.keys_ = new Map(); // key -> node (membership; a key is added once, as the set holds one entry per object)
  }
  get capacity() { return this.table.length; }
  get threshold() { return this.table.length * 0.75; }
  has(key) { return this.keys_.has(key); }
  // HashSet.add(key) where key.hashCode() == id; returns false when the key is already in
  add(key, id) {
    if (this.keys_.has(key)) return false;
    const node = { key, hash: this.hash(id | 0) };
    this.keys_.set(key, node);
    if (this.mode === "java8") {
      const bin = this.table[node.hash & (this.table.length - 1)];
      bin.push(node);
      if (bin.length >= 9 && this.table.length < 64) this.resize8(); // treeifyBin: a small table doubles instead
      if (++this.size > this.threshold) this.resize8();
    } else {
      if (this.size >= this.threshold && this.table[node.hash & (this.table.length - 1)].length) this.resize7();
      this.table[node.hash & (this.table.length - 1)].unshift(node);
      this.size++;
    }
    return true;
  }
  remove(key) {
    const node = this.keys_.get(key);
    if (!node) return false;
    const bin = this.table[node.hash & (this.table.length - 1)];
    bin.splice(bin.indexOf(node), 1);
    this.keys_.delete(key);
    this.size--;
    return true;
  }
  resize8() { // the lo / hi split keeps each chain's order
    const n = this.table.length, next = new Array(n * 2).fill(null).map(() => []);
    for (let j = 0; j < n; j++) for (const node of this.table[j]) next[node.hash & (n * 2 - 1)].push(node);
    this.table = next;
  }
  resize7() { // transfer(): each node goes to the front of its new bin, so chains landing together reverse
    const n = this.table.length, next = new Array(n * 2).fill(null).map(() => []);
    for (let j = 0; j < n; j++) for (const node of this.table[j]) next[node.hash & (n * 2 - 1)].unshift(node);
    this.table = next;
  }
  // the keys in HashSet iteration order
  keys() { const out = []; for (const bin of this.table) for (const node of bin) out.push(node.key); return out; }
}

// The iteration order of the set after a history of ops: [["add", id] | ["remove", id], ...] (the set holds ids); returns the ids in order.
export function hashSetOrderOf(ops, mode = "java8") {
  const set = new JavaHashSetOrder(mode);
  for (const [op, id] of ops) { if (op === "add") set.add(id, id); else set.remove(id); }
  return set.keys();
}
