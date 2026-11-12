import java.util.*;

// Batch 49: the iteration order of EntityTracker's trackedEntities. `mn` (EntityTracker) holds `Set c = new HashSet()` (bytecode-read: trackEntity adds a new `my`, untrackEntity removes,
// updateTrackedEntities walks `c.iterator()`), and `my` (EntityTrackerEntry) overrides hashCode to `entity.getEntityId()` (sa.y()) and equals to compare ids (bytecode-read). This probe
// runs the REAL class `my` (one per entity, the entities are real boats `xi` given their ids through Entity.setEntityId, sa.d(int)) in a real java.util.HashSet with add / remove
// histories and records the iteration order after every operation. The order is the JDK's HashMap order: the probe records java.version because Java 7 and Java 8+ differ.
public class TrackerOrderProbe {
  static sun.misc.Unsafe U;
  static final Map<Integer, my> ENTRIES = new HashMap<>();
  static my entry(int id) throws Exception {
    // a fresh entry each time an id is added, as trackEntity makes one per spawn
    xi e = (xi) U.allocateInstance(xi.class);
    e.d(id);
    return new my(e, 80, 3, true);
  }
  static String order(Set<my> set) {
    StringBuilder b = new StringBuilder("[");
    boolean first = true;
    for (my m : set) { if (!first) b.append(','); first = false; b.append(MobMoveProbe_id(m)); }
    return b.append(']').toString();
  }
  static int MobMoveProbe_id(my m) { return m.a.y(); }
  // ops: {kind, id} with kind 1 = add, 0 = remove
  static String run(String name, int[][] ops) throws Exception {
    Set<my> set = new HashSet<>();
    Map<Integer, my> live = new HashMap<>();
    StringBuilder opsJson = new StringBuilder("["), orders = new StringBuilder("[");
    for (int i = 0; i < ops.length; i++) {
      int id = ops[i][1];
      if (ops[i][0] == 1) { my m = entry(id); live.put(id, m); set.add(m); }
      else { my m = live.remove(id); if (m != null) set.remove(m); }
      if (i > 0) { opsJson.append(','); orders.append(','); }
      opsJson.append("[\"").append(ops[i][0] == 1 ? "add" : "remove").append("\",").append(id).append(']');
      orders.append(order(set));
    }
    return "{\"case\":\"" + name + "\",\"javaVersion\":\"" + System.getProperty("java.version") + "\",\"ops\":" + opsJson + "],\"orders\":" + orders + "]}";
  }
  static int[][] adds(int... ids) { int[][] o = new int[ids.length][]; for (int i = 0; i < ids.length; i++) o[i] = new int[]{1, ids[i]}; return o; }
  static int[][] cat(int[][]... parts) { List<int[]> l = new ArrayList<>(); for (int[][] p : parts) l.addAll(Arrays.asList(p)); return l.toArray(new int[0][]); }
  static int[][] removes(int... ids) { int[][] o = new int[ids.length][]; for (int i = 0; i < ids.length; i++) o[i] = new int[]{0, ids[i]}; return o; }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    U = MobMoveProbe.unsafe();
    // spawn order against id order: later ids that land in earlier buckets walk first
    System.out.println(run("small", adds(3, 2, 20, 1, 17, 33, 5)));
    // sequential ids across the 12 -> 24 -> 48 resize thresholds
    int[] seq = new int[60]; for (int i = 0; i < 60; i++) seq[i] = i + 1;
    System.out.println(run("sequential", adds(seq)));
    // ids that share buckets (agree modulo 16 / 32 / 64): chain order and its change over resizes
    System.out.println(run("collide", adds(1, 17, 33, 49, 65, 81, 97, 113, 129, 145, 5, 21, 37, 2)));
    // ids past 65536 (spread folds the high half in) and the object tracker's 1 << 24 range
    System.out.println(run("high", adds(65537, 65538, 131072, 70000, 16777217, 16777218, 16777219, 4, 100000, 1 << 24, (1 << 24) + 16)));
    // removal does not shrink: 30 ids (capacity 64), 22 removed, 3 more added
    int[] thirty = new int[30]; for (int i = 0; i < 30; i++) thirty[i] = 100 + i * 3;
    int[] gone = new int[22]; for (int i = 0; i < 22; i++) gone[i] = 100 + i * 3;
    System.out.println(run("noShrink", cat(adds(thirty), removes(gone), adds(7, 8, 71))));
    // the same id removed and added again goes to the end of its chain
    System.out.println(run("readd", cat(adds(1, 17, 33, 2), removes(17), adds(17))));
    // seeded random histories: 140 ops over ids 1..200 (a spawn / despawn mix with resizes)
    for (int seed = 1; seed <= 4; seed++) {
      Random r = new Random(seed);
      List<Integer> inSet = new ArrayList<>();
      List<int[]> ops = new ArrayList<>();
      for (int i = 0; i < 140; i++) {
        if (!inSet.isEmpty() && r.nextInt(100) < 35) { int id = inSet.remove(r.nextInt(inSet.size())); ops.add(new int[]{0, id}); }
        else { int id; do { id = 1 + r.nextInt(seed < 3 ? 200 : 4000); } while (inSet.contains(id)); inSet.add(id); ops.add(new int[]{1, id}); }
      }
      System.out.println(run("random" + seed, ops.toArray(new int[0][])));
    }
  }
}
