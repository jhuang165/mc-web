// java.util.HashMap of Java 6/7 for small Integer keys, the order 1.7.10 ran its maps in on the JVMs of its day (batch 65 clientreplays; the executed
// Java7Map records in public/research/clientreplays-reference.json "effects7" replay it). The game itself keeps the Java 8 order of batch 60
// (status-effects.js effectsMapOrder, mob-effects.js effectsInMapOrder), the one every other executed probe ran on; this module is the Java 7 alternative.
//   hash: h ^= (h >>> 20) ^ (h >>> 12); h ^ (h >>> 7) ^ (h >>> 4)   (Java 8 folds only h >>> 16, which is the id itself for small ids)
//   a new key goes to the FRONT of its chain; addEntry resizes first when size >= threshold and the bucket is occupied (7u6+); transfer walks the old
//   buckets ascending and pushes each entry to the front of its new chain (chains reverse); iteration: buckets ascending, each chain from its head.
const spread = (key) => { let h = key | 0; h ^= (h >>> 20) ^ (h >>> 12); return (h ^ (h >>> 7) ^ (h >>> 4)) | 0; };

export class Java7IntMap {
  constructor() { this.table = Array.from({ length: 16 }, () => null); this.size = 0; this.threshold = 12; }
  entry(key) { for (let e = this.table[spread(key) & (this.table.length - 1)]; e; e = e.next) if (e.key === key) return e; return null; }
  has(key) { return !!this.entry(key); }
  // Returns true when the key was new (a repeated key keeps its place, as HashMap.put does).
  put(key) {
    if (this.entry(key)) return false;
    const h = spread(key);
    let i = h & (this.table.length - 1);
    if (this.size >= this.threshold && this.table[i]) { this.resize(this.table.length * 2); i = h & (this.table.length - 1); }
    this.table[i] = { key, hash: h, next: this.table[i] };
    this.size++;
    return true;
  }
  resize(n) {
    const next = Array.from({ length: n }, () => null);
    for (const head of this.table) for (let e = head, after; e; e = after) { after = e.next; const i = e.hash & (n - 1); e.next = next[i]; next[i] = e; }
    this.table = next;
    this.threshold = Math.floor(n * 0.75);
  }
  remove(key) {
    const i = spread(key) & (this.table.length - 1);
    for (let e = this.table[i], prev = null; e; prev = e, e = e.next) {
      if (e.key !== key) continue;
      if (prev) prev.next = e.next; else this.table[i] = e.next;
      this.size--;
      return true;
    }
    return false;
  }
  keys() { const out = []; for (const head of this.table) for (let e = head; e; e = e.next) out.push(e.key); return out; }
}

// Keeps a Java 7 map in step with a list of effects ({ id }) kept in insertion order, as mob-effects.js and status-effects.js keep theirs: ids that
// appeared are put (in list order), ids that vanished are removed. Returns the list reordered as the Java 7 map iterates.
export function java7Sync(map, list) {
  const ids = new Set(list.map((x) => x.id));
  for (const k of map.keys()) if (!ids.has(k)) map.remove(k);
  for (const x of list) map.put(x.id);
  const at = new Map(map.keys().map((k, i) => [k, i]));
  return [...list].sort((a, b) => at.get(a.id) - at.get(b.id));
}
