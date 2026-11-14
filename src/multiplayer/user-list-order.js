// Batch 70 sptab70: the iteration order of a UserList.
// bytecode-read (1.7.10 client JAR, class om = UserList): the entries live in `Maps.newHashMap()` (a java.util.HashMap, default capacity 16) keyed by the string
// `UserList.func_152681_a(key)`: the profile's UUID string for ops, bans and the whitelist (op/or/oj `b(GameProfile)` = profile.getId().toString()), the address string for the
// IP ban list. The name arrays the tab completion reads (UserListBans/UserListOps/UserListWhitelist `a()`) iterate `values()`; the IP list's `a()` is `keySet().toArray`. So the
// order is that of a HashMap: bucket index (spread hash, power-of-two table that never shrinks) ascending, insertion order inside a bucket (resizes split bins in order).
// recalled: the load/save code (UserList.func_152679_g) is server-only and not in the client JAR; a file is read into the map entry by entry, and written from values().
export function javaStringHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; }
/** Table size of a HashMap that held at most `peak` entries (16, doubled whenever the size exceeds 0.75 * capacity). */
export function hashCapacity(peak) { let c = 16; while (peak > c * 0.75) c *= 2; return c; }
/** Iteration order of a HashMap<String, ?> whose keys were put in `keys` order (distinct); `peak` is the largest size the map ever had (the table does not shrink). */
export function hashKeyOrder(keys, peak = keys.length) {
  const capacity = hashCapacity(Math.max(peak, keys.length));
  const bucket = (k) => { const h = javaStringHash(k); return (h ^ (h >>> 16)) & (capacity - 1); };
  return keys.map((k, i) => ({ k, b: bucket(k), i })).sort((x, y) => x.b - y.b || x.i - y.i).map((e) => e.k);
}
/** A Map that remembers its largest size, for the table capacity of the HashMap it stands for. */
export class UserMap extends Map {
  constructor(entries) { super(); this.peak = 0; for (const [k, v] of entries ?? []) this.set(k, v); }
  set(k, v) { super.set(k, v); if (this.size > this.peak) this.peak = this.size; return this; }
}
/** The values of a UserMap in native (HashMap) order. */
export function userListValues(map) {
  const keys = hashKeyOrder([...map.keys()], map.peak ?? map.size);
  return keys.map((k) => map.get(k));
}
/** The keys of a UserMap in native (HashMap) order. */
export const userListKeys = (map) => hashKeyOrder([...map.keys()], map.peak ?? map.size);
