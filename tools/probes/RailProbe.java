import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged BlockRailPowered [amt] (powered rail 27 and activator rail 157), BlockRailDetector [aki] (28) and
// BlockRail [amy] (66) with BlockRailBase [aje] / BlockRailBase$Rail [ajf], real EntityMinecartEmpty [xs] and
// EntityMinecartChest [xm] [xl.h onUpdate], inside the RedstoneProbe World double (a real World over real Chunk objects with
// the native setBlock / setBlockMetadataWithNotify / notify / power code and a copy of the WorldServer pending-tick code).
// Only these differ from RedstoneProbe.W: RW answers getEntitiesWithinAABB(Class, box) and the entity-excluding query from
// the live carts' boundingBox (excluding the asking entity, as World.getEntitiesWithinAABBExcludingEntity does).
// Each tick (World.tick order): scripted setBlock / setBlockToAir events, total world time + 1, tickUpdates, then
// lastTickPos / prevRotation and onUpdate [xl.h] for each live cart. Per tick the probe records every cart's state, the packed
// (id << 4 | metadata) state of the watched cells, the detector rail outputs (weak b, strong c on sides 1 and 0, and
// getComparatorInputOverride g), the TileEntityComparator signal of the listed comparators and the dropped items.
// tools/verify-powered-rails.mjs writes public/research/powered-rails-reference.json; src/powered-rails.test.js replays it.
public class RailProbe {
  static final int O = 20; // origin of the relative coordinates in x, y and z (both sides use the same absolute doubles)

  public static class RW extends RedstoneProbe.W {
    List<xl> carts = new ArrayList<>();
    List scripted(Class c, azt box, sa except, sj sel) {
      List r = new ArrayList();
      for (xl e : carts) {
        azt b = e.C;
        if (e == except || e.K || (c != null && !c.isInstance(e)) || (sel != null && !sel.a(e))) continue;
        if (b.d > box.a && b.a < box.d && b.e > box.b && b.b < box.e && b.f > box.c && b.c < box.f) r.add(e);
      }
      return r;
    }
    public List a(Class c, azt box) { return scripted(c, box, null, null); }
    public List a(Class c, azt box, sj sel) { return scripted(c, box, null, sel); }
    public List b(sa e, azt box) { return scripted(null, box, e, null); }
  }

  static RW world(long seed) throws Exception {
    RW w = (RW) RedstoneProbe.unsafe.allocateInstance(RW.class);
    RedstoneProbe.Provider provider = new RedstoneProbe.Provider(); provider.g = false;
    RedstoneProbe.field(ahb.class, "t").set(w, provider);
    RedstoneProbe.field(ahb.class, "j").setInt(w, 0);
    RedstoneProbe.field(ahb.class, "s").set(w, new Random(seed));
    RedstoneProbe.field(ahb.class, "u").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "C").set(w, new qi());
    RedstoneProbe.field(ahb.class, "v").set(w, new RedstoneProbe.Chunks(w));
    RedstoneProbe.field(ahb.class, "a").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "g").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "h").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "L").set(w, new ArrayList());
    w.sky = 15; w.angle = 0f;
    w.rules = new agy(); w.log = new StringBuilder(); w.sounds = new ArrayList<>(); w.drops = new ArrayList<>(); w.ents = new ArrayList<>();
    w.carts = new ArrayList<>(); w.M = new HashSet<>(); w.N = new TreeSet<>(); w.V = new ArrayList<>();
    return w;
  }

  static String num(double v) { return NbtProbe.number(v); }
  static String state(xl c) {
    return "[" + num(c.s) + "," + num(c.t) + "," + num(c.u) + "," + num(c.v) + "," + num(c.w) + "," + num(c.x) + "," + (c.D ? 1 : 0) + "," + (c.K ? 1 : 0) + "," + num(c.y) + "]";
  }
  static String ints(int... v) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < v.length; i++) s.append(i > 0 ? "," : "").append(v[i]); return s.append("]").toString(); }
  static String grid(int[][] g) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < g.length; i++) s.append(i > 0 ? "," : "").append(ints(g[i])); return s.append("]").toString(); }

  // cells {x, y, z, original id, metadata}; carts {type (0 empty, 1 chest), x, y, z, vx, vy, vz, stacks of cobblestone};
  // events {tick, kind (0 setBlock, 1 setBlockToAir), x, y, z, id, metadata}; watch / det / cmp {x, y, z}.
  static void run(String name, int[][] cells, double[][] carts, int[][] events, int[][] watch, int[][] det, int[][] cmp, int ticks) throws Exception {
    RW w = world(7);
    for (int[] c : cells) w.raw(O + c[0], O + c[1], O + c[2], aji.e(c[3]), c[4]);
    List<xl> list = new ArrayList<>();
    for (int i = 0; i < carts.length; i++) {
      double[] c = carts[i];
      xl r = c[0] == 1 ? new xm(w, O + c[1], O + c[2], O + c[3]) : new xs(w, O + c[1], O + c[2], O + c[3]);
      RedstoneProbe.field(sa.class, "Z").set(r, new Random(1000 + i));
      RedstoneProbe.field(sa.class, "c").setInt(r, i + 1);
      r.v = c[4]; r.w = c[5]; r.x = c[6];
      for (int s = 0; s < (int) c[7]; s++) ((xm) r).a(s, new add(adb.d(4), 64, 0));
      list.add(r);
      w.carts.add(r);
    }
    StringBuilder ticksJson = new StringBuilder();
    for (int t = 0; t < ticks; t++) {
      w.tick = t + 1; w.log.setLength(0);
      int dropStart = w.drops.size();
      for (int[] e : events) if (e[0] == t) {
        if (e[1] == 0) w.d(O + e[2], O + e[3], O + e[4], aji.e(e[5]), e[6], 3);
        else w.f(O + e[2], O + e[3], O + e[4]);
      }
      w.time++;
      w.tickUpdates();
      for (xl r : list) {
        if (r.K) continue;
        r.S = r.s; r.T = r.t; r.U = r.u;
        r.A = r.y; r.B = r.z;
        r.h();
      }
      StringBuilder states = new StringBuilder();
      for (xl r : list) states.append(states.length() > 0 ? "," : "").append(state(r));
      int[] cellState = new int[watch.length];
      for (int i = 0; i < watch.length; i++) cellState[i] = aji.b(w.a(O + watch[i][0], O + watch[i][1], O + watch[i][2])) << 4 | w.e(O + watch[i][0], O + watch[i][1], O + watch[i][2]);
      int[][] dets = new int[det.length][];
      for (int i = 0; i < det.length; i++) {
        int x = O + det[i][0], y = O + det[i][1], z = O + det[i][2];
        aji b = w.a(x, y, z);
        dets[i] = aji.b(b) != 28 ? new int[] {-1} : new int[] {b.b((ahl) w, x, y, z, 0), b.c((ahl) w, x, y, z, 1), b.c((ahl) w, x, y, z, 0), b.g(w, x, y, z, 0)};
      }
      int[] sig = new int[cmp.length];
      for (int i = 0; i < cmp.length; i++) {
        int x = O + cmp[i][0], y = O + cmp[i][1], z = O + cmp[i][2];
        sig[i] = aji.b(w.a(x, y, z)) == 149 || aji.b(w.a(x, y, z)) == 150 ? ((aoz) w.o(x, y, z)).a() : -1;
      }
      StringBuilder dr = new StringBuilder();
      for (int i = dropStart; i < w.drops.size(); i++) dr.append(dr.length() > 0 ? "," : "").append(w.drops.get(i));
      ticksJson.append(t > 0 ? "," : "").append("[[").append(states).append("],").append(ints(cellState)).append(",").append(grid(dets)).append(",").append(ints(sig)).append(",[").append(dr).append("]]");
    }
    StringBuilder cs = new StringBuilder(), ks = new StringBuilder(), es = new StringBuilder();
    for (int[] c : cells) cs.append(cs.length() == 0 ? "" : ",").append(ints(c));
    for (double[] c : carts) { ks.append(ks.length() == 0 ? "" : ",").append("["); for (int k = 0; k < c.length; k++) ks.append(k == 0 ? "" : ",").append(num(c[k])); ks.append("]"); }
    for (int[] e : events) es.append(es.length() == 0 ? "" : ",").append(ints(e));
    System.out.println("{\"name\":\"" + name + "\",\"cells\":[" + cs + "],\"carts\":[" + ks + "],\"events\":[" + es + "],\"watch\":" + grid(watch) + ",\"det\":" + grid(det) + ",\"cmp\":" + grid(cmp) + ",\"ticks\":[" + ticksJson + "]}");
  }

  static int[][] join(int[][]... parts) { List<int[]> c = new ArrayList<>(); for (int[][] p : parts) for (int[] x : p) c.add(x); return c.toArray(new int[0][]); }
  static int[][] row(int id, int meta, int x0, int x1, int y, int z) { List<int[]> c = new ArrayList<>(); for (int x = x0; x <= x1; x++) c.add(new int[] {x, y, z, id, meta}); return c.toArray(new int[0][]); }
  static int[][] ground(int x0, int x1, int z0, int z1) { List<int[]> c = new ArrayList<>(); for (int x = x0; x <= x1; x++) for (int z = z0; z <= z1; z++) c.add(new int[] {x, -1, z, 1, 0}); return c.toArray(new int[0][]); }
  static int[][] watchRow(int x0, int x1, int y, int z) { List<int[]> c = new ArrayList<>(); for (int x = x0; x <= x1; x++) c.add(new int[] {x, y, z}); return c.toArray(new int[0][]); }
  static final int[][] NONE = {};
  static int[][] ev(int[]... e) { return e; }
  static int[] set(int tick, int x, int y, int z, int id, int meta) { return new int[] {tick, 0, x, y, z, id, meta}; }
  static int[] air(int tick, int x, int y, int z) { return new int[] {tick, 1, x, y, z, 0, 0}; }

  public static void main(String[] args) throws Exception {
    RedstoneProbe.unsafe = MobMoveProbe.unsafe();
    PlantProbe.unsafe = RedstoneProbe.unsafe;
    aji.p();
    adb.l();
    // Original ids: stone 1, powered rail 27, detector rail 28, rail 66, activator rail 157, redstone block 152, comparator 149.
    // A redstone block beside a rail powers it (BlockCompressedPowered, weak power on every side); breaking it unpowers.
    int[][] g = ground(-3, 45, -4, 4);
    // 1. Line propagation: 14 powered rails in x, power at x = 6 from tick 2 until tick 14. Rails more than 8 away stay off.
    run("chain", join(g, row(27, 1, 0, 19, 0, 0)), new double[0][], ev(set(2, 6, 0, 1, 152, 0), air(14, 6, 0, 1)), watchRow(0, 19, 0, 0), NONE, NONE, 22);
    // 2. A powered line into a slope and over the top: shapes 2 and 3 pass power by the func_150058_a slope rules.
    int[][] hill = join(g, row(27, 1, 0, 2, 0, 0), new int[][] {{3, 0, 0, 27, 2}, {4, 1, 0, 27, 1}, {5, 1, 0, 27, 1}, {6, 1, 0, 27, 3}, {7, 0, 0, 27, 1}, {8, 0, 0, 27, 1}, {4, 0, 0, 1, 0}, {5, 0, 0, 1, 0}, {3, 1, 0, 1, 0}, {6, 1, 0, 1, 0}});
    run("hill", hill, new double[0][], ev(set(2, 0, 0, 1, 152, 0), air(16, 0, 0, 1), set(24, 8, 0, 1, 152, 0)), watchRow(0, 8, 0, 0), NONE, NONE, 40);
    // 3. Powered and activator rails side by side in one row do not feed each other (block identity), each line is its own.
    run("mixed", join(g, row(27, 1, 0, 3, 0, 0), row(157, 1, 4, 7, 0, 0)), new double[0][], ev(set(2, 1, 0, 1, 152, 0), air(10, 1, 0, 1), set(14, 6, 0, 1, 152, 0)), watchRow(0, 7, 0, 0), NONE, NONE, 20);
    // 4. A cart rolls onto a powered line; power arrives mid-ride (boost from tick 6) and leaves at tick 30 (brake).
    run("boost-toggle", join(g, row(27, 1, 0, 39, 0, 0)), new double[][] {{0, 0.5, 0.5, 0.5, 0.12, 0, 0, 0}}, ev(set(0, 4, 0, 1, 152, 0), air(24, 4, 0, 1)), watchRow(0, 39, 0, 0), NONE, NONE, 70);
    // 5. A standing cart on an unpowered powered rail in front of a wall, then power: the 0.02 push from the solid block.
    run("push-start", join(g, row(27, 1, 0, 6, 0, 0), new int[][] {{-1, 0, 0, 1, 0}}), new double[][] {{0, 0.5, 0.5, 0.5, 0, 0, 0, 0}}, ev(set(3, 2, 0, 1, 152, 0)), watchRow(0, 6, 0, 0), NONE, NONE, 40);
    // 6. Activator rails: a cart rides over powered and unpowered activator rails; in 1.7.10 nothing happens to it.
    run("activator-ride", join(g, row(157, 1, 0, 11, 0, 0)), new double[][] {{1, 0.5, 0.5, 0.5, 0.3, 0, 0, 3}}, ev(set(0, 6, 0, 1, 152, 0), air(18, 6, 0, 1)), watchRow(0, 11, 0, 0), NONE, NONE, 40);
    // 7. Detector rail: a chest cart rolls over a plain rail row with a detector at x = 6; output, tick rescheduling, comparator reading.
    int[][] detRow = join(g, row(66, 1, 0, 5, 0, 0), new int[][] {{6, 0, 0, 28, 1}}, row(66, 1, 7, 14, 0, 0), new int[][] {{6, 0, -1, 149, 0}, {5, 0, -1, 1, 0}, {7, 0, -1, 1, 0}});
    run("detector-pass", detRow, new double[][] {{1, 0, 0.5, 0.5, 0.3, 0, 0, 9}}, NONE, join(watchRow(5, 7, 0, 0), new int[][] {{6, 0, -1}}), new int[][] {{6, 0, 0}}, new int[][] {{6, 0, -1}}, 60);
    // 8. An empty cart parked on a detector rail: held on by the 20-tick recheck; the detector powers a powered rail beside it.
    int[][] park = join(g, row(66, 1, 0, 3, 0, 0), new int[][] {{4, 0, 0, 28, 1}}, row(66, 1, 5, 8, 0, 0), row(27, 1, 3, 5, 0, 1));
    run("detector-parked", park, new double[][] {{0, 4.5, 0.5, 0.5, 0, 0, 0, 0}}, ev(air(40, 4, 0, 0)), join(watchRow(3, 5, 0, 0), watchRow(3, 5, 0, 1)), new int[][] {{4, 0, 0}}, NONE, 60);
    // 9. Placement: a powered rail placed between rails takes a straight shape (and keeps no curve), a detector next to a column.
    run("place", join(g, row(66, 1, 0, 1, 0, 0), col(66, 0, 0, 2, 3), new int[][] {{3, 0, 3, 1, 0}}), new double[0][], ev(set(2, 2, 0, 0, 27, 0), set(4, 3, 0, 0, 28, 0), set(6, 0, 0, 1, 157, 0), set(8, 6, 0, 0, 27, 0)), join(watchRow(0, 3, 0, 0), new int[][] {{0, 0, 1}, {6, 0, 0}}), new int[][] {{3, 0, 0}}, NONE, 14);
    // 10. Support: removing the block under a powered, a detector and an activator rail drops each with its own item.
    run("break", join(g, row(27, 0, 0, 0, 0, 0), row(28, 0, 2, 2, 0, 0), row(157, 0, 4, 4, 0, 0)), new double[0][], ev(air(2, 0, -1, 0), air(4, 2, -1, 0), air(6, 4, -1, 0)), watchRow(0, 4, 0, 0), NONE, NONE, 10);
    // 11. Plain rail reshape: three rails meeting at a plain rail beside a redstone block switch the curve (BlockRail.func_150048_a).
    run("plain-tee", join(g, new int[][] {{0, 0, 0, 66, 6}, {1, 0, 0, 66, 1}, {0, 0, 1, 66, 0}, {0, 0, -1, 66, 0}}), new double[0][], ev(set(2, -1, 0, 0, 152, 0), air(6, -1, 0, 0), set(8, 0, 1, 1, 152, 0)), watchRow(-1, 1, 0, 0), NONE, NONE, 12);
  }
  static int[][] col(int id, int meta, int x, int z0, int z1) { return col(id, meta, x, z0, z1, 0); }
  static int[][] col(int id, int meta, int x, int z0, int z1, int y) { List<int[]> c = new ArrayList<>(); for (int z = z0; z <= z1; z++) c.add(new int[] {x, y, z, id, meta}); return c.toArray(new int[0][]); }
}
