import java.lang.reflect.*;
import java.util.*;

// Block sweep, round 2 (batch 18): every registered 1.7.10 block that BlockAuditProbe (batch 16, 38 ids) did not cover. Unchanged original
// Block classes run on the NetherBlocksProbe World double (cell map, recorded EntityItem spawns), subclassed here to supply fixed light.
// Records (one JSON object per line, compact):
//   sbox   per id, metadata 0-15 (deduplicated through "u"/"ix"): setBlockBoundsBasedOnState bounds "b", getSelectedBoundingBoxFromPool "s",
//          getCollisionBoundingBoxFromPool "k" and every addCollisionBoxesToList box "l" (mask box -2..3), in an empty neighbourhood
//   ctx    neighbour-dependent shapes: fences/panes/walls (four stone neighbours, 16 masks), stairs (meta x side x neighbour stair meta),
//          doors (lower meta x upper hinge, queried at either half), chests (same-block neighbours)
//   nb     per id and support layout: with stone on all six sides (plants: grass or farmland below, partners placed), remove side k and call
//          onNeighborBlockChange under Random(3): survival code per meta and side, plus the spawned drops
//   tick   updateTick histograms over seeded Randoms at fixed light for the deterministic random-tick blocks
public class BlockSweepProbe {
  static final Set<Integer> DONE = new HashSet<>(Arrays.asList(19, 22, 25, 62, 84, 87, 88, 90, 91, 92, 94, 95, 96, 104, 105, 107, 112, 113, 114, 115, 119, 121, 122, 125, 126, 130, 133, 138, 139, 144, 146, 153, 155, 156, 160, 170, 171, 173));
  static final Map<Long, int[]> cells = NetherBlocksProbe.cells;
  static int SKY = 15, BLK = 0;

  public static class SW extends NetherBlocksProbe.World {
    public int j(int x, int y, int z) { return BLK > SKY ? BLK : SKY; } // getBlockLightValue
    public int k(int x, int y, int z) { return BLK > SKY ? BLK : SKY; } // getFullBlockLightValue
    public int b(int x, int y, int z, boolean b) { return BLK > SKY ? BLK : SKY; }
    public int a(ahn t, int x, int y, int z) { return t == ahn.a ? SKY : BLK; } // getSkyBlockTypeBrightness
    public int b(ahn t, int x, int y, int z) { return t == ahn.a ? SKY : BLK; } // getSavedLightValue
    public void a(yz p, int e, int x, int y, int z, int d) {} // playAuxSFXAtEntity (destroyBlock's 2001 event)
    public boolean i(int x, int y, int z) { return SKY >= 15; } // canBlockSeeTheSky
  }
  static SW w;
  static Method stackOf;
  static String q(String s) { return NetherBlocksProbe.q(s); }
  static String ex(Throwable t) { Throwable c = t instanceof InvocationTargetException ? t.getCause() : t; if (System.getenv("SWEEP_DEBUG") != null) { StackTraceElement[] st = c.getStackTrace(); System.err.println("exc " + c + " at " + (st.length > 0 ? st[0] : "") + " <- " + (st.length > 1 ? st[1] : "") + " <- " + (st.length > 2 ? st[2] : "")); } return "EXC:" + c.getClass().getSimpleName(); }
  static String stackStr(Object o) throws Exception {
    if (o instanceof xk) { stackOf.setAccessible(true); add st = (add) stackOf.invoke(o); return adb.b(st.b()) + ":" + st.k() + "x" + st.b; }
    if (o instanceof sq) return "xp" + ((sq) o).e();
    return o.getClass().getSimpleName();
  }
  static void reset() { cells.clear(); NetherBlocksProbe.spawned.clear(); NetherBlocksProbe.floor = false; SKY = 15; BLK = 0; }
  static String spawns() throws Exception {
    List<String> l = new ArrayList<>();
    for (Object o : NetherBlocksProbe.spawned) l.add(q(stackStr(o)));
    return "[" + String.join(",", l) + "]";
  }
  static String d6(double a, double b, double c, double d, double e, double f) { return "[" + a + "," + b + "," + c + "," + d + "," + e + "," + f + "]"; }
  // Block bounds fields B..G as the constructor left them: Block.setBlockBounds writes shared per-class state, so a collision call that
  // resizes it (brewing stand, cauldron, hopper, stairs, fence gate) would leak into the next block's selection read.
  static final Map<aji, double[]> CTOR = new HashMap<>();
  static final String[] BF = {"B", "C", "D", "E", "F", "G"};
  static void snapshot(aji b) throws Exception { double[] v = new double[6]; for (int i = 0; i < 6; i++) v[i] = MobMoveProbe.field(aji.class, BF[i]).getDouble(b); CTOR.put(b, v); }
  static void restore(aji b) throws Exception { double[] v = CTOR.get(b); for (int i = 0; i < 6; i++) MobMoveProbe.field(aji.class, BF[i]).setDouble(b, v[i]); }
  static String entry(aji b, int x, int y, int z) throws Exception {
    String bo, sel, k, l;
    restore(b);
    try { b.a((ahl) w, x, y, z); bo = NetherBlocksProbe.bounds(b); } catch (Throwable t) { bo = q(ex(t)); }
    try { sel = NetherBlocksProbe.box(b.g(w, x, y, z)); } catch (Throwable t) { sel = q(ex(t)); }
    try { k = NetherBlocksProbe.box(b.a(w, x, y, z)); } catch (Throwable t) { k = q(ex(t)); }
    try {
      List<azt> list = new ArrayList<>();
      b.a(w, x, y, z, azt.a(x - 2, y - 2, z - 2, x + 3, y + 3, z + 3), list, null);
      List<String> s = new ArrayList<>(); for (azt a : list) s.add(NetherBlocksProbe.box(a));
      l = "[" + String.join(",", s) + "]";
    } catch (Throwable t) { l = q(ex(t)); }
    restore(b);
    return "{\"b\":" + bo + ",\"s\":" + sel + ",\"k\":" + k + ",\"l\":" + l + "}";
  }
  static String dedupe(List<String> es) {
    List<String> u = new ArrayList<>(); StringBuilder ix = new StringBuilder();
    for (String e : es) { int i = u.indexOf(e); if (i < 0) { i = u.size(); u.add(e); } ix.append(ix.length() > 0 ? "," : "").append(i); }
    return "\"u\":[" + String.join(",", u) + "],\"ix\":[" + ix + "]";
  }

  static void sbox(List<String> out, int id) throws Exception {
    aji b = aji.e(id);
    List<String> es = new ArrayList<>();
    for (int m = 0; m < 16; m++) { reset(); NetherBlocksProbe.put(0, 1, 0, id, m); es.add(entry(b, 0, 1, 0)); }
    out.add("{\"c\":\"sbox\",\"id\":" + id + "," + dedupe(es) + "}");
  }
  static final int[][] N4 = {{0, -1}, {0, 1}, {-1, 0}, {1, 0}};
  static void maskCtx(List<String> out, int id, int nid, int meta) throws Exception {
    aji b = aji.e(id);
    List<String> es = new ArrayList<>();
    for (int mask = 0; mask < 16; mask++) {
      reset(); NetherBlocksProbe.put(0, 1, 0, id, meta);
      for (int i = 0; i < 4; i++) if ((mask & (1 << i)) != 0) NetherBlocksProbe.put(N4[i][0], 1, N4[i][1], nid, 0);
      es.add(entry(b, 0, 1, 0));
    }
    out.add("{\"c\":\"mask\",\"id\":" + id + ",\"nid\":" + nid + ",\"meta\":" + meta + "," + dedupe(es) + "}");
  }
  static void stairCtx(List<String> out, int id) throws Exception {
    aji b = aji.e(id);
    for (int m = 0; m < 8; m++) {
      List<String> es = new ArrayList<>();
      for (int side = 0; side < 4; side++) for (int nm = 0; nm < 8; nm++) for (int cy : new int[] {1}) {
        reset(); NetherBlocksProbe.put(0, 1, 0, id, m); NetherBlocksProbe.put(N4[side][0], 1, N4[side][1], id, nm);
        es.add(entry(b, 0, 1, 0));
      }
      out.add("{\"c\":\"stair\",\"id\":" + id + ",\"meta\":" + m + "," + dedupe(es) + "}");
    }
  }
  static void doorCtx(List<String> out, int id) throws Exception {
    aji b = aji.e(id);
    List<String> lo = new ArrayList<>(), up = new ArrayList<>();
    for (int upper : new int[] {8, 9}) for (int m = 0; m < 8; m++) {
      reset(); NetherBlocksProbe.put(0, 1, 0, id, m); NetherBlocksProbe.put(0, 2, 0, id, upper);
      lo.add(entry(b, 0, 1, 0)); up.add(entry(b, 0, 2, 0));
    }
    out.add("{\"c\":\"door\",\"id\":" + id + ",\"atLower\":{" + dedupe(lo) + "},\"atUpper\":{" + dedupe(up) + "}}");
  }
  static void chestCtx(List<String> out, int id) throws Exception {
    aji b = aji.e(id);
    List<String> es = new ArrayList<>();
    for (int mask = 0; mask < 16; mask++) {
      reset(); NetherBlocksProbe.put(0, 1, 0, id, 2);
      for (int i = 0; i < 4; i++) if ((mask & (1 << i)) != 0) NetherBlocksProbe.put(N4[i][0], 1, N4[i][1], id, 2);
      es.add(entry(b, 0, 1, 0));
    }
    out.add("{\"c\":\"mask\",\"id\":" + id + ",\"nid\":" + id + ",\"meta\":2," + dedupe(es) + "}");
  }

  static final int[][] D = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
  static final int[][] BED = {{0, 1}, {-1, 0}, {0, -1}, {1, 0}};
  // Partner cells the block needs (beds, doors, tall plants): {dx, dy, dz, id, meta}
  static int[] partner(int id, int meta) {
    if (id == 64 || id == 71) return meta < 8 ? new int[] {0, 1, 0, id, 8} : new int[] {0, -1, 0, id, 0};
    if (id == 175) return meta < 8 ? new int[] {0, 1, 0, id, 8} : new int[] {0, -1, 0, id, 0};
    if (id == 26) { int[] o = BED[meta & 3]; return (meta & 8) == 0 ? new int[] {o[0], 0, o[1], 26, meta | 8} : new int[] {-o[0], 0, -o[1], 26, meta & 7}; }
    return null;
  }
  static String nbCode(int id, int meta, int k, int below) throws Exception {
    aji b = aji.e(id);
    reset();
    for (int[] d : D) NetherBlocksProbe.put(d[0], 1 + d[1], d[2], 1, 0);
    if (below != 1) NetherBlocksProbe.put(0, 0, 0, below, below == 60 ? 7 : 0);
    int[] p = partner(id, meta);
    if (p != null) NetherBlocksProbe.put(p[0], 1 + p[1], p[2], p[3], p[4]);
    NetherBlocksProbe.put(0, 1, 0, id, meta);
    int rx = D[k][0], ry = 1 + D[k][1], rz = D[k][2];
    NetherBlocksProbe.cells.remove(NetherBlocksProbe.key(rx, ry, rz));
    MobMoveProbe.set(w, "s", new Random(3));
    String res;
    try {
      b.a(w, 0, 1, 0, aji.e(0));
      int[] c = NetherBlocksProbe.cell(0, 1, 0);
      res = c != null && c[0] == id ? "s" : "b";
      if (c != null && c[0] == id && c[1] != meta) res = "m" + c[1];
    } catch (Throwable t) { res = "x"; ex(t); }
    return res;
  }
  static void nb(List<String> out, int id, String name, int below) throws Exception {
    StringBuilder codes = new StringBuilder(), drops = new StringBuilder();
    for (int m = 0; m < 16; m++) {
      StringBuilder row = new StringBuilder();
      for (int k = 0; k < 6; k++) {
        String c = nbCode(id, m, k, below);
        row.append(k > 0 ? "," : "").append(c);
        String sp = spawns();
        if (!sp.equals("[]")) drops.append(drops.length() > 0 ? "," : "").append("\"").append(m).append(".").append(k).append("\":").append(sp);
      }
      codes.append(m > 0 ? "|" : "").append(row);
    }
    out.add("{\"c\":\"nb\",\"id\":" + id + ",\"layout\":" + q(name) + ",\"codes\":" + q(codes.toString()) + ",\"drops\":{" + drops + "}}");
  }

  static String mapJson(Map<String, Integer> m) {
    List<String> l = new ArrayList<>(); for (Map.Entry<String, Integer> e : m.entrySet()) l.add(q(e.getKey().replace("\"", "\\\"")) + ":" + e.getValue()); return "{" + String.join(",", l) + "}";
  }
  interface Setup { void run() throws Exception; }
  // One tick scenario: setup (cells around (0,1,0)), then updateTick under `seeds` Randoms; the outcome is the whole cell map.
  static void tick(List<String> out, String name, int id, int meta, int sky, int blk, int seeds, Setup s) throws Exception {
    aji b = aji.e(id);
    Map<String, Integer> counts = new TreeMap<>();
    for (int seed = 0; seed < seeds; seed++) {
      reset(); SKY = sky; BLK = blk;
      s.run();
      NetherBlocksProbe.put(0, 1, 0, id, meta);
      MobMoveProbe.set(w, "s", new Random(seed));
      String what;
      try {
        b.a(w, 0, 1, 0, new Random(seed));
        List<String> cs = new ArrayList<>();
        TreeMap<Long, int[]> sorted = new TreeMap<>(cells);
        for (Map.Entry<Long, int[]> e : sorted.entrySet()) { long kk = e.getKey(); int z = (int) (kk % 4096) - 1000, y = (int) ((kk / 4096) % 4096) - 1000, x = (int) (kk / 4096 / 4096) - 1000; cs.add(x + "," + y + "," + z + "=" + e.getValue()[0] + ":" + e.getValue()[1]); }
        what = String.join(" ", cs) + " sp" + spawns();
      } catch (Throwable t) { what = ex(t); }
      counts.merge(what, 1, Integer::sum);
    }
    out.add("{\"c\":\"tick\",\"name\":" + q(name) + ",\"id\":" + id + ",\"meta\":" + meta + ",\"sky\":" + sky + ",\"blk\":" + blk + ",\"seeds\":" + seeds + ",\"o\":" + mapJson(counts) + "}");
  }
  static void put(int x, int y, int z, int id, int m) { NetherBlocksProbe.put(x, y, z, id, m); }

  static void ticks(List<String> out) throws Exception {
    for (int cid : new int[] {59, 141, 142}) {
      for (int m = 0; m < 8; m++) {
        for (int light : new int[] {15, 5}) {
          int fm = cid == 59 ? 0 : 0;
          tick(out, "crop-plain", cid, m, light, 0, 120, () -> put(0, 0, 0, 60, 7));
          if (light == 15) tick(out, "crop-dry", cid, m, light, 0, 120, () -> put(0, 0, 0, 60, 0));
          if (light == 15) tick(out, "crop-ring", cid, m, light, 0, 120, () -> { for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) put(dx, 0, dz, 60, 7); });
          if (light == 15) tick(out, "crop-rows", cid, m, light, 0, 120, () -> { for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) put(dx, 0, dz, 60, 7); put(1, 1, 0, cid, 7); put(-1, 1, 0, cid, 7); put(0, 1, 1, cid, 7); });
        }
      }
    }
    for (int m = 0; m < 8; m++) { tick(out, "sapling", 6, m, 15, 0, 200, () -> put(0, 0, 0, 2, 0)); }
    tick(out, "sapling-dark", 6, 0, 5, 0, 60, () -> put(0, 0, 0, 2, 0));
    for (int m : new int[] {0, 7, 14, 15}) {
      tick(out, "cactus", 81, m, 15, 0, 200, () -> put(0, 0, 0, 12, 0));
      tick(out, "cactus-h3", 81, m, 15, 0, 100, () -> { put(0, 0, 0, 12, 0); put(0, 2, 0, 81, 0); put(0, 3, 0, 81, 0); });
      tick(out, "cactus-top3", 81, m, 15, 0, 100, () -> { put(0, 0, 0, 12, 0); put(0, -1, 0, 81, 0); put(0, -2, 0, 81, 0); put(0, -3, 0, 12, 0); put(0, -3 + 0, 0, 12, 0); });
      tick(out, "reeds", 83, m, 15, 0, 200, () -> { put(0, 0, 0, 3, 0); put(1, 0, 0, 9, 0); });
      tick(out, "reeds-h3", 83, m, 15, 0, 100, () -> { put(0, 0, 0, 3, 0); put(1, 0, 0, 9, 0); put(0, 2, 0, 83, 0); put(0, 3, 0, 83, 0); });
    }
    for (int m : new int[] {0, 3, 7}) {
      tick(out, "farm-dry", 60, m, 15, 0, 5, () -> {});
      tick(out, "farm-water", 60, m, 15, 0, 5, () -> put(2, 1, 0, 9, 0));
      tick(out, "farm-water-far", 60, m, 15, 0, 5, () -> put(5, 1, 0, 9, 0));
      tick(out, "farm-crop", 60, m, 15, 0, 5, () -> put(0, 2, 0, 59, 0));
      tick(out, "farm-solid-above", 60, m, 15, 0, 5, () -> put(0, 2, 0, 1, 0));
    }
    for (int blk : new int[] {0, 11, 12, 15}) {
      tick(out, "ice", 79, 0, 15, blk, 10, () -> put(0, 0, 0, 1, 0));
      tick(out, "snowlayer", 78, 0, 15, blk, 10, () -> put(0, 0, 0, 1, 0));
      tick(out, "snowblock", 80, 0, 15, blk, 10, () -> put(0, 0, 0, 1, 0));
    }
    for (int m : new int[] {0, 4, 8, 12, 1, 5}) {
      tick(out, "leaves-nolog", 18, m, 15, 0, 100, () -> put(0, 0, 0, 3, 0));
      tick(out, "leaves-log", 18, m, 15, 0, 100, () -> { put(0, 0, 0, 3, 0); put(0, 1, 1, 17, 0); });
      tick(out, "leaves-log-far", 18, m, 15, 0, 100, () -> { put(0, 0, 0, 3, 0); put(4, 1, 0, 17, 0); put(3, 1, 0, 18, 0); put(2, 1, 0, 18, 0); put(1, 1, 0, 18, 0); });
      tick(out, "leaves2-nolog", 161, m, 15, 0, 100, () -> put(0, 0, 0, 3, 0));
    }
    for (int m : new int[] {0, 8}) {
      tick(out, "grass-bright", 2, m, 15, 0, 100, () -> { for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) if (dx != 0 || dz != 0) put(dx, 1, dz, 3, 0); });
      tick(out, "grass-dark", 2, m, 3, 0, 20, () -> { put(0, 2, 0, 1, 0); });
      tick(out, "grass-dark-open", 2, m, 3, 0, 20, () -> {});
      tick(out, "mycelium", 110, m, 15, 0, 100, () -> { for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) if (dx != 0 || dz != 0) put(dx, 1, dz, 3, 0); });
    }
    tick(out, "redstone-ore-lit", 74, 0, 15, 0, 5, () -> {});
    tick(out, "cocoa", 127, 0, 15, 0, 200, () -> put(0, 1, 1, 17, 3));
    for (int m : new int[] {0, 4, 8}) tick(out, "cocoa-m", 127, m, 15, 0, 200, () -> put(0, 1, 1, 17, 3));
    for (int id : new int[] {37, 38, 39, 40}) tick(out, "plant-ground", id, 0, 15, 0, 100, () -> put(0, 0, 0, 2, 0));
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    for (Method m : xk.class.getDeclaredMethods()) if (m.getParameterCount() == 0 && m.getReturnType() == add.class) stackOf = m;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    { List<String> names = new ArrayList<>(); for (int i = 1; i < 256; i++) { aji bb = aji.e(i); if (bb != null && aji.b(bb) == i) bb.a(NetherBlocksProbe.namer(names)); } }
    w = (SW) u.allocateInstance(SW.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "t", u.allocateInstance(NetherBlocksProbe.Provider.class));
    List<String> out = new ArrayList<>();
    for (int id = 1; id < 176; id++) { aji b = aji.e(id); if (b != null && aji.b(b) == id) snapshot(b); }
    List<Integer> ids = new ArrayList<>();
    for (int id = 1; id < 176; id++) { aji b = aji.e(id); if (b != null && aji.b(b) == id && !DONE.contains(id)) { ids.add(id); System.err.println("class " + id + " " + b.getClass().getName()); } }
    for (int id : ids) {
      sbox(out, id);
      for (int below : new int[] {1, 2, 60}) nb(out, id, below == 1 ? "stone" : below == 2 ? "grass" : "farmland", below);
    }
    for (int id : new int[] {85, 101, 102, 113, 139, 160}) { maskCtx(out, id, 1, 0); maskCtx(out, id, id, 0); }
    chestCtx(out, 54);
    for (int id : new int[] {53, 67, 108, 109, 114, 128, 134, 135, 136, 156, 163, 164}) stairCtx(out, id);
    for (int id : new int[] {64, 71}) doorCtx(out, id);
    // the 38 audited blocks that join neighbours but only had isolated rows
    ticks(out);
    for (String l : out) System.out.println(l);
  }
}
