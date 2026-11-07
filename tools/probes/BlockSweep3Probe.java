import java.lang.reflect.*;
import java.util.*;

// Block sweep, round 3 (batch 19). Unchanged original block classes on the BlockSweepProbe/NetherBlocksProbe World double.
//   lp     BlockBush family light survival: canBlockStay (.j) and canPlaceBlockAt (aji.c) per ground block over a light grid
//          (saved sky light, saved block light, skylightSubtracted 0/6/11, canBlockSeeTheSky). The double follows World exactly:
//          getBlockLightValue (ahb.k, = b(x,y,z,true)) = max(sky - skylightSubtracted, block), getFullBlockLightValue (ahb.j) = max(sky, block).
//   ltick  updateTick histograms of the resulting cell map over seeded Randoms on the same light grid
//   drop   dropBlockAsItemWithChance under Random(seed) for fortune 0-3: spawned stacks/xp and the next two nextInt(1000) draws
//   tebox  tile-entity block boxes (BlockSweep3Tile)
public class BlockSweep3Probe {
  static int SUB = 0; static boolean SEE = true;
  public static class SW3 extends BlockSweepProbe.SW {
    int mx(int a, int b) { return a > b ? a : b; }
    public int j(int x, int y, int z) { return mx(BlockSweepProbe.SKY, BlockSweepProbe.BLK); } // getFullBlockLightValue: skylightSubtracted 0
    public int k(int x, int y, int z) { return mx(BlockSweepProbe.SKY - SUB, BlockSweepProbe.BLK); } // getBlockLightValue = b(x,y,z,true)
    public int b(int x, int y, int z, boolean b) { return mx(BlockSweepProbe.SKY - SUB, BlockSweepProbe.BLK); }
    public boolean i(int x, int y, int z) { return SEE; }
    public aor o(int x, int y, int z) { return BlockSweep3Tile.get(x, y, z); } // getTileEntity
  }
  static String q(String s) { return NetherBlocksProbe.q(s); }
  static void put(int x, int y, int z, int id, int m) { NetherBlocksProbe.put(x, y, z, id, m); }
  static void reset() { BlockSweepProbe.reset(); SUB = 0; SEE = true; }

  static final String[] GN = {"grass", "dirt", "podzol", "mycelium", "sand", "farmland", "soulsand", "stone", "water"};
  static void ground(int g) {
    switch (g) {
      case 0: put(0, 0, 0, 2, 0); break; case 1: put(0, 0, 0, 3, 0); break; case 2: put(0, 0, 0, 3, 2); break;
      case 3: put(0, 0, 0, 110, 0); break; case 4: put(0, 0, 0, 12, 0); break; case 5: put(0, 0, 0, 60, 7); break;
      case 6: put(0, 0, 0, 88, 0); break; case 7: put(0, 0, 0, 1, 0); break; case 8: put(0, 0, 0, 9, 0); break;
    }
  }
  static String rle(String s) {
    StringBuilder o = new StringBuilder();
    for (int i = 0; i < s.length();) { int j = i; while (j < s.length() && s.charAt(j) == s.charAt(i)) j++; o.append(o.length() > 0 ? "," : "").append(s.charAt(i)).append(":").append(j - i); i = j; }
    return o.toString();
  }
  static final int[] SKYS = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}, BLKS = {0, 7, 8, 9, 12, 13, 15}, SUBS = {0, 6, 11};
  static void lp(List<String> out, int id, int meta) throws Exception {
    aji b = aji.e(id);
    Method place = MobMoveProbe.method(aji.class, "c", ahb.class, int.class, int.class, int.class);
    Method stay = null;
    for (Class<?> c = b.getClass(); c != null && stay == null; c = c.getSuperclass()) {
      try { stay = c.getDeclaredMethod("j", ahb.class, int.class, int.class, int.class); } catch (NoSuchMethodException e) { }
    }
    stay.setAccessible(true); place.setAccessible(true);
    for (int g = 0; g < GN.length; g++) {
      StringBuilder s = new StringBuilder();
      for (int sky : SKYS) for (int blk : BLKS) for (int sub : SUBS) for (int see = 0; see < 2; see++) {
        int v = 0;
        for (int mode = 0; mode < 2; mode++) {
          reset(); ground(g); BlockSweepProbe.SKY = sky; BlockSweepProbe.BLK = blk; SUB = sub; SEE = see == 1;
          if (id == 175 && mode == 0) put(0, 2, 0, 175, 8);
          if (mode == 0) put(0, 1, 0, id, meta);
          boolean r;
          try { r = (Boolean) (mode == 0 ? stay : place).invoke(b, BlockSweepProbe.w, 0, 1, 0); }
          catch (Throwable t) { r = false; BlockSweepProbe.ex(t); v |= 4; }
          if (r) v |= 1 << mode;
        }
        s.append((char) ('0' + v));
      }
      out.add("{\"c\":\"lp\",\"id\":" + id + ",\"meta\":" + meta + ",\"ground\":" + q(GN[g]) + ",\"v\":" + q(rle(s.toString())) + "}");
    }
  }

  static String cellMap() throws Exception {
    List<String> cs = new ArrayList<>();
    for (Map.Entry<Long, int[]> e : new TreeMap<>(NetherBlocksProbe.cells).entrySet()) { long kk = e.getKey(); int z = (int) (kk % 4096) - 1000, y = (int) ((kk / 4096) % 4096) - 1000, x = (int) (kk / 4096 / 4096) - 1000; cs.add(x + "," + y + "," + z + "=" + e.getValue()[0] + ":" + e.getValue()[1]); }
    return String.join(" ", cs) + " sp" + BlockSweepProbe.spawns();
  }
  static void ltick(List<String> out, String name, int id, int meta, int g, int sky, int blk, int sub, boolean see, int seeds) throws Exception {
    aji b = aji.e(id);
    Map<String, Integer> counts = new TreeMap<>();
    for (int seed = 0; seed < seeds; seed++) {
      reset(); ground(g); BlockSweepProbe.SKY = sky; BlockSweepProbe.BLK = blk; SUB = sub; SEE = see;
      put(0, 1, 0, id, meta);
      MobMoveProbe.set(BlockSweepProbe.w, "s", new Random(seed));
      String what;
      try { b.a(BlockSweepProbe.w, 0, 1, 0, new Random(seed)); what = cellMap(); } catch (Throwable t) { what = BlockSweepProbe.ex(t); }
      counts.merge(what, 1, Integer::sum);
    }
    out.add("{\"c\":\"ltick\",\"name\":" + q(name) + ",\"id\":" + id + ",\"meta\":" + meta + ",\"ground\":" + q(GN[g]) + ",\"sky\":" + sky + ",\"blk\":" + blk + ",\"sub\":" + sub + ",\"see\":" + see + ",\"seeds\":" + seeds + ",\"o\":" + BlockSweepProbe.mapJson(counts) + "}");
  }

  // BlockMushroom.updateTick spread: a floor of `floorId` (radius 6), the mushroom at (0,1,0), optionally `extra` more mushrooms nearby; per seed the
  // list of mushrooms present afterwards (the ticked one included) is the outcome.
  static void mspread(List<String> out, int id, int floorId, int floorMeta, int sky, int blk, int extra, int seeds) throws Exception {
    aji b = aji.e(id);
    List<String> rows = new ArrayList<>();
    for (int seed = 0; seed < seeds; seed++) {
      reset(); BlockSweepProbe.SKY = sky; BlockSweepProbe.BLK = blk;
      for (int x = -6; x <= 6; x++) for (int z = -6; z <= 6; z++) put(x, 0, z, floorId, floorMeta);
      put(0, 1, 0, id, 0);
      for (int i = 0; i < extra; i++) put(-3 + i, 1, 3, id, 0);
      MobMoveProbe.set(BlockSweepProbe.w, "s", new Random(seed));
      String what;
      try {
        b.a(BlockSweepProbe.w, 0, 1, 0, new Random(seed));
        List<String> cs = new ArrayList<>();
        for (Map.Entry<Long, int[]> e : new TreeMap<>(NetherBlocksProbe.cells).entrySet()) { if (e.getValue()[0] != id) continue; long kk = e.getKey(); int z = (int) (kk % 4096) - 1000, y = (int) ((kk / 4096) % 4096) - 1000, x = (int) (kk / 4096 / 4096) - 1000; cs.add(x + "," + y + "," + z); }
        what = String.join(" ", cs);
      } catch (Throwable t) { what = BlockSweepProbe.ex(t); }
      if (!what.equals("0,1,0")) rows.add("\"" + seed + "\":" + q(what));
    }
    out.add("{\"c\":\"mspread\",\"id\":" + id + ",\"floor\":" + floorId + ",\"floorMeta\":" + floorMeta + ",\"sky\":" + sky + ",\"blk\":" + blk + ",\"extra\":" + extra + ",\"seeds\":" + seeds + ",\"rows\":{" + String.join(",", rows) + "}}");
  }

  static void drop(List<String> out, int id, int meta, int fortune, int seeds) throws Exception {
    aji b = aji.e(id);
    List<String> rows = new ArrayList<>();
    for (int seed = 0; seed < seeds; seed++) {
      reset(); put(0, 0, 0, id, meta);
      Random r = new Random(seed);
      MobMoveProbe.set(BlockSweepProbe.w, "s", r);
      String what;
      try {
        b.a(BlockSweepProbe.w, 0, 0, 0, meta, 1.0F, fortune);
        what = BlockSweepProbe.spawns() + " n" + r.nextInt(1000) + "," + r.nextInt(1000);
      } catch (Throwable t) { what = BlockSweepProbe.ex(t); }
      rows.add(q(what.replace("\"", "'")));
    }
    out.add("{\"c\":\"drop\",\"id\":" + id + ",\"meta\":" + meta + ",\"fortune\":" + fortune + ",\"rows\":[" + String.join(",", rows) + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    for (Method m : xk.class.getDeclaredMethods()) if (m.getParameterCount() == 0 && m.getReturnType() == add.class) BlockSweepProbe.stackOf = m;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    { List<String> names = new ArrayList<>(); for (int i = 1; i < 256; i++) { aji bb = aji.e(i); if (bb != null && aji.b(bb) == i) bb.a(NetherBlocksProbe.namer(names)); } }
    BlockSweepProbe.w = (BlockSweepProbe.SW) u.allocateInstance(SW3.class);
    MobMoveProbe.set(BlockSweepProbe.w, "s", new Random(2));
    MobMoveProbe.set(BlockSweepProbe.w, "C", new qi());
    MobMoveProbe.set(BlockSweepProbe.w, "t", u.allocateInstance(NetherBlocksProbe.Provider.class));
    for (int id = 1; id < 176; id++) { aji b = aji.e(id); if (b != null && aji.b(b) == id) BlockSweepProbe.snapshot(b); }
    List<String> out = new ArrayList<>();
    int[][] plants = {{6, 0}, {31, 0}, {31, 1}, {31, 2}, {32, 0}, {37, 0}, {38, 0}, {39, 0}, {40, 0}, {59, 0}, {141, 0}, {142, 0}, {104, 0}, {105, 0}, {175, 0}, {175, 2}, {83, 0}, {81, 0}, {111, 0}, {115, 0}, {127, 0}};
    for (int[] p : plants) lp(out, p[0], p[1]);
    for (int id : new int[] {6, 31, 32, 37, 38, 39, 40})
      for (int g : new int[] {0, 2, 3, 4})
        for (int[] c : new int[][] {{15, 0, 0, 1}, {15, 0, 11, 1}, {0, 0, 0, 0}, {0, 7, 0, 0}, {0, 8, 0, 0}, {8, 0, 0, 0}, {9, 0, 0, 0}, {9, 0, 4, 0}, {13, 0, 0, 0}, {0, 13, 0, 0}, {0, 14, 0, 0}, {14, 0, 6, 1}})
          ltick(out, "plant", id, 0, g, c[0], c[1], c[2], c[3] == 1, id == 39 || id == 40 ? 120 : 30);
    for (int id : new int[] {59, 141, 142}) for (int[] c : new int[][] {{15, 0, 0}, {15, 0, 11}, {15, 0, 6}, {9, 0, 0}, {10, 0, 2}, {13, 0, 4}, {0, 8, 0}, {0, 9, 0}, {0, 15, 0}})
      ltick(out, "crop", id, 0, 5, c[0], c[1], c[2], c[0] >= 15, 100);
    for (int id : new int[] {39, 40}) for (int[] f : new int[][] {{2, 0}, {110, 0}, {3, 2}, {1, 0}}) for (int[] l : new int[][] {{0, 0}, {15, 0}, {0, 12}, {0, 13}, {12, 0}, {13, 0}}) mspread(out, id, f[0], f[1], l[0], l[1], 0, 3000);
    mspread(out, 39, 110, 0, 15, 0, 4, 3000); mspread(out, 39, 110, 0, 15, 0, 3, 3000);
    int[][] drops = {{13, 0}, {18, 0}, {18, 1}, {18, 2}, {18, 3}, {18, 4}, {18, 8}, {161, 0}, {161, 1}, {89, 0}, {103, 0}, {73, 0}, {74, 0}, {21, 0}, {16, 0}, {56, 0}, {129, 0}, {153, 0},
      {59, 0}, {59, 3}, {59, 7}, {141, 0}, {141, 7}, {142, 0}, {142, 7}, {115, 0}, {115, 3}, {31, 0}, {31, 1}, {31, 2}, {32, 0}, {127, 0}, {127, 4}, {127, 8}, {127, 11},
      {78, 0}, {78, 3}, {78, 7}, {80, 0}, {82, 0}, {47, 0}, {79, 0}, {104, 0}, {104, 7}, {105, 0}, {105, 7}, {6, 0}, {6, 3}, {175, 2}, {175, 3}, {2, 0}, {1, 0}, {110, 0}, {83, 0}, {60, 7}};
    for (int[] d : drops) for (int f = 0; f < 4; f++) drop(out, d[0], d[1], f, 40);
    BlockSweep3Tile.run(out);
    for (String l : out) System.out.println(l);
  }
}
