import java.lang.reflect.*;
import java.util.*;

// Block behaviour audit (batch 16): the 38 blocks that the batch-11 block parity catalogue first listed as unmapped.
// Unchanged original Block classes run on the NetherBlocksProbe World double (a cell map; spawnEntityInWorld records
// EntityItem stacks and XP orbs). Records:
//   facts      hardness, explosion resistance, material, requiresTool, light, opacity, canSilkHarvest, bounds (NetherBlocksProbe.facts)
//   harvest    dropBlockAsItemWithChance(fortune 0 / 3) histogram over 48 seeds per metadata
//   place      canPlaceBlockAt over 14 support layouts (below), plus a one-neighbour-wall layout
//   neighbour  per metadata 0-15: with stone on all six sides, remove side k and call onNeighborBlockChange; does the block survive,
//              and what does it drop
//   tick       updateTick histogram for the random/scheduled-tick blocks
//   box        collision and selection boxes per metadata 0-15
public class BlockAuditProbe {
  static final int[] IDS = {19, 22, 25, 62, 84, 87, 88, 90, 91, 92, 94, 95, 96, 104, 105, 107, 112, 113, 114, 115, 119, 121, 122, 125, 126, 130, 133, 138, 139, 144, 146, 153, 155, 156, 160, 170, 171, 173};
  static final Map<Long, int[]> cells = NetherBlocksProbe.cells;
  static NetherBlocksProbe.World w;
  static Method stackOf;

  static String q(String s) { return NetherBlocksProbe.q(s); }
  static String ex(Throwable t) { Throwable c = t instanceof InvocationTargetException ? t.getCause() : t; return "EXC:" + c.getClass().getSimpleName(); }
  static String stackStr(Object o) throws Exception {
    if (o instanceof xk) { stackOf.setAccessible(true); add st = (add) stackOf.invoke(o); return adb.b(st.b()) + ":" + st.k() + "x" + st.b; }
    if (o instanceof sq) return "xp" + ((sq) o).e();
    return o.getClass().getSimpleName();
  }
  static void reset() { cells.clear(); NetherBlocksProbe.spawned.clear(); NetherBlocksProbe.floor = false; }
  static String spawns() throws Exception {
    List<String> l = new ArrayList<>();
    for (Object o : NetherBlocksProbe.spawned) l.add(q(stackStr(o)));
    return "[" + String.join(",", l) + "]";
  }
  static int[] metas(int id) {
    if (id == 104 || id == 105) return new int[] {0, 3, 7};
    if (id == 115) return new int[] {0, 1, 2, 3};
    if (id == 95 || id == 160 || id == 171) return new int[] {0, 5, 15};
    if (id == 92) return new int[] {0, 3, 6};
    if (id == 125 || id == 126) return new int[] {0, 3, 5};
    if (id == 155) return new int[] {0, 1, 2};
    return new int[] {0};
  }
  static String mapJson(Map<String, Integer> m) {
    List<String> l = new ArrayList<>(); for (Map.Entry<String, Integer> e : m.entrySet()) l.add(q(e.getKey()) + ":" + e.getValue()); return "{" + String.join(",", l) + "}";
  }

  static void harvest(List<String> out, int id, int meta, int fortune) throws Exception {
    aji b = aji.e(id);
    Map<String, Integer> counts = new TreeMap<>();
    for (int seed = 0; seed < 48; seed++) {
      reset(); NetherBlocksProbe.put(0, 0, 0, id, meta);
      MobMoveProbe.set(w, "s", new Random(seed));
      String what;
      try {
        b.a(w, 0, 0, 0, meta, 1.0F, fortune);
        Map<String, Integer> tally = new TreeMap<>();
        for (Object o : NetherBlocksProbe.spawned) tally.merge(stackStr(o), 1, Integer::sum);
        what = tally.toString();
      } catch (Throwable t) { what = ex(t); }
      counts.merge(what, 1, Integer::sum);
    }
    out.add("{\"case\":\"harvest\",\"id\":" + id + ",\"meta\":" + meta + ",\"fortune\":" + fortune + ",\"drops\":" + mapJson(counts) + "}");
  }

  // Support layouts for the cell below the block (and one wall layout).
  static final String[] SUP = {"air", "stone", "glass", "leaves", "water", "lava", "soulsand", "farmland", "slabBottom", "slabTop", "fence", "wood", "ice", "same", "snowLayer", "stairsUp"};
  static void support(String s, int id) {
    switch (s) {
      case "air": break;
      case "stone": NetherBlocksProbe.put(0, 0, 0, 1, 0); break;
      case "glass": NetherBlocksProbe.put(0, 0, 0, 20, 0); break;
      case "leaves": NetherBlocksProbe.put(0, 0, 0, 18, 0); break;
      case "water": NetherBlocksProbe.put(0, 0, 0, 9, 0); break;
      case "lava": NetherBlocksProbe.put(0, 0, 0, 11, 0); break;
      case "soulsand": NetherBlocksProbe.put(0, 0, 0, 88, 0); break;
      case "farmland": NetherBlocksProbe.put(0, 0, 0, 60, 7); break;
      case "slabBottom": NetherBlocksProbe.put(0, 0, 0, 44, 0); break;
      case "slabTop": NetherBlocksProbe.put(0, 0, 0, 44, 8); break;
      case "fence": NetherBlocksProbe.put(0, 0, 0, 85, 0); break;
      case "wood": NetherBlocksProbe.put(0, 0, 0, 5, 0); break;
      case "ice": NetherBlocksProbe.put(0, 0, 0, 79, 0); break;
      case "same": NetherBlocksProbe.put(0, 0, 0, id, 0); break;
      case "snowLayer": NetherBlocksProbe.put(0, 0, 0, 78, 0); break;
      case "stairsUp": NetherBlocksProbe.put(0, 0, 0, 53, 0); break;
    }
  }
  static void place(List<String> out, int id) throws Exception {
    aji b = aji.e(id);
    Method canPlace = MobMoveProbe.method(aji.class, "c", ahb.class, int.class, int.class, int.class);
    List<String> r = new ArrayList<>();
    for (String s : SUP) {
      reset(); support(s, id);
      String v; try { v = String.valueOf(canPlace.invoke(b, w, 0, 1, 0)); } catch (Throwable t) { v = ex(t); }
      r.add(q(s + "=" + v));
    }
    // replacing an occupied cell (grass tall, same block) and a wall-only layout (stone on +x, nothing below)
    reset(); NetherBlocksProbe.put(1, 1, 0, 1, 0);
    String wall; try { wall = String.valueOf(canPlace.invoke(b, w, 0, 1, 0)); } catch (Throwable t) { wall = ex(t); }
    r.add(q("wallPlusX=" + wall));
    reset(); NetherBlocksProbe.put(0, 0, 0, 1, 0); NetherBlocksProbe.put(0, 1, 0, id, 0);
    String occ; try { occ = String.valueOf(canPlace.invoke(b, w, 0, 1, 0)); } catch (Throwable t) { occ = ex(t); }
    r.add(q("occupiedBySelf=" + occ));
    out.add("{\"case\":\"place\",\"id\":" + id + ",\"results\":[" + String.join(",", r) + "]}");
  }

  static final int[][] D = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
  static void neighbour(List<String> out, int id, int meta) throws Exception {
    aji b = aji.e(id);
    StringBuilder surv = new StringBuilder(), drops = new StringBuilder();
    for (int k = 0; k < 6; k++) {
      reset();
      for (int[] d : D) NetherBlocksProbe.put(d[0], 1 + d[1], d[2], 1, 0);
      NetherBlocksProbe.put(0, 1, 0, id, meta);
      NetherBlocksProbe.cells.remove(NetherBlocksProbe.key(D[k][0], 1 + D[k][1], D[k][2]));
      MobMoveProbe.set(w, "s", new Random(3));
      String res;
      try {
        b.a(w, 0, 1, 0, aji.e(0));
        int[] c = NetherBlocksProbe.cell(0, 1, 0);
        res = c != null && c[0] == id ? "stays" : "breaks";
        if (c != null && c[0] == id && c[1] != meta) res = "meta" + c[1];
      } catch (Throwable t) { res = ex(t); }
      surv.append(k > 0 ? "," : "").append(q(res));
      drops.append(k > 0 ? "," : "").append(spawns());
    }
    out.add("{\"case\":\"neighbour\",\"id\":" + id + ",\"meta\":" + meta + ",\"removedSide\":[" + surv + "],\"drops\":[" + drops + "]}");
  }

  static void tick(List<String> out, int id, int meta, boolean farm) throws Exception {
    aji b = aji.e(id);
    Map<String, Integer> counts = new TreeMap<>();
    for (int seed = 0; seed < 200; seed++) {
      reset(); NetherBlocksProbe.floor = false;
      if (id == 115) NetherBlocksProbe.put(0, 0, 0, 88, 0);
      else if (farm) NetherBlocksProbe.put(0, 0, 0, 60, 7);
      else if (id == 122) { }
      NetherBlocksProbe.put(0, 1, 0, id, meta);
      MobMoveProbe.set(w, "s", new Random(seed));
      String what;
      try {
        b.a(w, 0, 1, 0, new Random(seed));
        int[] c = NetherBlocksProbe.cell(0, 1, 0);
        what = (c == null ? "gone" : c[0] + ":" + c[1]) + " spawn" + NetherBlocksProbe.spawned.size();
        List<String> others = new ArrayList<>();
        for (Map.Entry<Long, int[]> e : cells.entrySet()) if (!e.getValue().equals(c) && e.getValue()[0] != 88 && e.getValue()[0] != 60) others.add(e.getValue()[0] + ":" + e.getValue()[1]);
        if (!others.isEmpty()) what += " +" + others;
      } catch (Throwable t) { what = ex(t); }
      counts.merge(what, 1, Integer::sum);
    }
    out.add("{\"case\":\"tick\",\"id\":" + id + ",\"meta\":" + meta + ",\"seeds\":200,\"outcomes\":" + mapJson(counts) + "}");
  }

  static void boxes(List<String> out, int id) throws Exception {
    aji b = aji.e(id);
    List<String> r = new ArrayList<>();
    for (int m = 0; m < 16; m++) {
      reset(); NetherBlocksProbe.put(0, 1, 0, id, m);
      String sel, col;
      try { b.a((ahl) w, 0, 1, 0); sel = NetherBlocksProbe.bounds(b); } catch (Throwable t) { sel = q(ex(t)); }
      try { col = NetherBlocksProbe.box(b.a(w, 0, 1, 0)); } catch (Throwable t) { col = q(ex(t)); }
      r.add("{\"meta\":" + m + ",\"bounds\":" + sel + ",\"collision\":" + col + "}");
    }
    out.add("{\"case\":\"box\",\"id\":" + id + ",\"metas\":[" + String.join(",", r) + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    for (Method m : xk.class.getDeclaredMethods()) if (m.getParameterCount() == 0 && m.getReturnType() == add.class) stackOf = m;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    { List<String> names = new ArrayList<>(); for (int i = 1; i < 256; i++) { aji bb = aji.e(i); if (bb != null && aji.b(bb) == i) bb.a(NetherBlocksProbe.namer(names)); } }
    w = (NetherBlocksProbe.World) u.allocateInstance(NetherBlocksProbe.World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "t", u.allocateInstance(NetherBlocksProbe.Provider.class));
    List<String> out = new ArrayList<>();
    for (int id : IDS) {
      reset();
      NetherBlocksProbe.facts(w, out, id);
      aji b = aji.e(id);
      out.add("{\"case\":\"silk\",\"id\":" + id + ",\"canSilkHarvest\":" + b.E() + "}");
      for (int m : metas(id)) for (int f : new int[] {0, 3}) harvest(out, id, m, f);
      place(out, id);
      for (int m = 0; m < 16; m++) neighbour(out, id, m);
      boxes(out, id);
    }
    for (int m = 0; m < 4; m++) tick(out, 115, m, false);
    for (int id : new int[] {104, 105}) for (int m = 0; m < 8; m++) tick(out, id, m, true);
    tick(out, 122, 0, false);
    for (String l : out) System.out.println(l);
  }
}
