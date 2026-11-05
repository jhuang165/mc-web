import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Records the unchanged EntityMinecartFurnace [xq], EntityMinecartTNT [xv] and EntityMinecartHopper [xr] (all on EntityMinecart [xl].h /
// func_145821_a, applyDrag [xl.i], killMinecart [xl.a(ro)], activator rails, Entity.fall) on the MinecartProbe map-backed World double.
// CW adds what these carts call: createExplosion [ahb.a(sa,DDDFZ)] and spawnParticle [ahb.a(String,DDDDDD)] only record, and
// the entity queries [ahb.a(Class,azt,sj), ahb.a(sa,azt,sj)] read the probe's entity list (the hopper cart's item pickup). Each cart has
// rand = new Random(1000), entityId 1. Per tick: the MinecartProbe.state fields, the type's own fields, the explosions
// (x, y, z, power), the particles, the spawned items (drops and spill) and the live item entities. tools/verify-carts.mjs writes
// public/research/carts-reference.json; src/carts.test.js replays it.
public class CartsProbe {
  public static class CW extends MinecartProbe.MW {
    List<double[]> explosions = new ArrayList<>();
    List<String> particles = new ArrayList<>();
    public agw a(sa e, double x, double y, double z, float power, boolean smoke) {
      explosions.add(new double[] {x, y, z, power});
      return null;
    }
    public void a(String name, double x, double y, double z, double mx, double my, double mz) {
      particles.add("[\"" + name + "\"," + MinecartProbe.num(x) + "," + MinecartProbe.num(y) + "," + MinecartProbe.num(z) + "]");
    }
    public List a(Class c, azt box, sj selector) {
      List<sa> out = new ArrayList<>();
      for (sa e : entities) if (c.isInstance(e) && !e.K && e.C.b(box)) out.add(e);
      return out;
    }
    public List a(sa except, azt box, sj selector) { return new ArrayList(); }
    public aor o(int x, int y, int z) { return null; }
  }

  static CW world(int[][] cells) throws Exception {
    CW w = (CW) PlantProbe.unsafe.allocateInstance(CW.class);
    MobMoveProbe.set(w, "t", PlantProbe.unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    w.cells = new HashMap<>();
    w.entities = new ArrayList<>();
    w.spawned = new ArrayList<>();
    w.explosions = new ArrayList<>();
    w.particles = new ArrayList<>();
    for (int[] c : cells) w.put(c[0], c[1], c[2], c[3], c.length > 4 ? c[4] : 0);
    return w;
  }

  static Field f(Class<?> c, String n) throws Exception { Field x = c.getDeclaredField(n); x.setAccessible(true); return x; }

  static xl make(String kind, CW w, double x, double y, double z) throws Exception {
    xl c = kind.equals("furnace") ? new xq(w, x, y, z) : kind.equals("tnt") ? new xv(w, x, y, z) : new xr(w, x, y, z);
    f(sa.class, "Z").set(c, new Random(1000));
    f(sa.class, "c").setInt(c, 1);
    return c;
  }

  static String extra(xl c) throws Exception {
    if (c instanceof xq) {
      Method lit = xq.class.getDeclaredMethod("e");
      lit.setAccessible(true);
      xq q = (xq) c;
      return "[" + f(xq.class, "c").getInt(c) + "," + MinecartProbe.num(q.a) + "," + MinecartProbe.num(q.b) + "," + ((Boolean) lit.invoke(c) ? 1 : 0) + "]";
    }
    if (c instanceof xv) return "[" + f(xv.class, "a").getInt(c) + "]";
    xr h = (xr) c;
    StringBuilder s = new StringBuilder("[" + (f(xr.class, "a").getBoolean(c) ? 1 : 0) + "," + f(xr.class, "b").getInt(c));
    for (int i = 0; i < 5; i++) { add a = h.a(i); s.append(a == null ? ",null" : ",[" + adb.b(a.b()) + "," + a.b + "," + a.k() + "]"); }
    return s.append("]").toString();
  }

  static String itemEnts(CW w) throws Exception {
    StringBuilder s = new StringBuilder();
    for (sa e : w.entities) if (e instanceof xk) {
      xk i = (xk) e;
      s.append(s.length() > 0 ? "," : "").append("[").append(i.K ? 0 : 1).append(",").append(i.f().b).append(",").append(MinecartProbe.num(i.s)).append(",").append(MinecartProbe.num(i.t)).append(",").append(MinecartProbe.num(i.u)).append("]");
    }
    return s.toString();
  }

  interface Setup { void apply(CW w, xl cart) throws Exception; }

  // name, kind, cells, cart {x, y, z, vx, vy, vz}, ticks, hits (tick -> {source, amount}), uses (tick -> {item, damage, count}), setup, items [{x, y, z, id, count}].
  static void run(String name, String kind, int[][] cells, double[] c, int ticks, Map<Integer, Object[]> hits, Map<Integer, int[]> uses, Setup setup, double[][] items, double[] playerAt, boolean creative) throws Exception {
    CW w = world(cells);
    xl cart = make(kind, w, c[0], c[1], c[2]);
    cart.v = c[3]; cart.w = c[4]; cart.x = c[5];
    w.entities.add(cart);
    if (setup != null) setup.apply(w, cart);
    for (double[] it : items) {
      xk e = new xk(w, it[0], it[1], it[2], new add(adb.d((int) it[3]), (int) it[4], 0));
      e.v = 0; e.w = 0; e.x = 0;
      w.entities.add(e);
    }
    MinecartProbe.Target p = null;
    if (playerAt != null) {
      p = MinecartProbe.player(w, playerAt[0], playerAt[1], playerAt[2], creative);
      PlayerStepProbe.field(yz.class, "bm").set(p, new yx(p));
    }
    dh tag = new dh();
    cart.e(tag); tag.o("UUIDMost"); tag.o("UUIDLeast");
    String nbtStart = NbtProbe.tag(tag);
    StringBuilder out = new StringBuilder();
    for (int t = 0; t < ticks; t++) {
      w.spawned.clear(); w.explosions.clear(); w.particles.clear();
      StringBuilder useOut = new StringBuilder();
      int[] use = uses.get(t);
      if (use != null) {
        p.bm.a[0] = use[0] == 0 ? null : new add(adb.d(use[0]), use[2], use[1]);
        p.bm.c = 0;
        boolean r = cart.c(p);
        add held = p.bm.a[0];
        useOut.append(",[").append(r ? 1 : 0).append(",").append(held == null ? 0 : held.b).append("]");
      }
      Object[] hit = hits.get(t);
      if (hit != null) cart.a("explosion".equals(hit[0]) ? ro.a((agw) null) : MinecartProbe.source((String) hit[0]), ((Number) hit[1]).floatValue());
      if (!cart.K) {
        cart.S = cart.s; cart.T = cart.t; cart.U = cart.u;
        cart.A = cart.y; cart.B = cart.z;
        cart.h();
      }
      StringBuilder ex = new StringBuilder(), sp = new StringBuilder();
      for (double[] e : w.explosions) ex.append(ex.length() > 0 ? "," : "").append("[").append(MinecartProbe.num(e[0])).append(",").append(MinecartProbe.num(e[1])).append(",").append(MinecartProbe.num(e[2])).append(",").append(MinecartProbe.num(e[3])).append("]");
      for (sa e : w.spawned) if (e instanceof xk) sp.append(sp.length() > 0 ? "," : "").append(MinecartProbe.item(e));
      out.append(t > 0 ? "," : "").append("[").append(MinecartProbe.state(cart)).append(",").append(extra(cart)).append(",[").append(ex).append("],[").append(String.join(",", w.particles)).append("],[").append(sp).append("],[").append(itemEnts(w)).append("]").append(useOut).append("]");
    }
    dh end = new dh();
    cart.e(end); end.o("UUIDMost"); end.o("UUIDLeast");
    StringBuilder cs = new StringBuilder(), hs = new StringBuilder(), us = new StringBuilder(), is = new StringBuilder();
    for (int[] cell : cells) {
      cs.append(cs.length() == 0 ? "" : ",").append('[');
      for (int k = 0; k < cell.length; k++) cs.append(k == 0 ? "" : ",").append(cell[k]);
      cs.append(']');
    }
    for (Map.Entry<Integer, Object[]> e : hits.entrySet()) hs.append(hs.length() == 0 ? "" : ",").append("[").append(e.getKey()).append(",\"").append(e.getValue()[0]).append("\",").append(e.getValue()[1]).append("]");
    for (Map.Entry<Integer, int[]> e : uses.entrySet()) us.append(us.length() == 0 ? "" : ",").append("[").append(e.getKey()).append(",").append(e.getValue()[0]).append(",").append(e.getValue()[1]).append(",").append(e.getValue()[2]).append("]");
    for (double[] it : items) is.append(is.length() == 0 ? "" : ",").append("[").append(MinecartProbe.num(it[0])).append(",").append(MinecartProbe.num(it[1])).append(",").append(MinecartProbe.num(it[2])).append(",").append((int) it[3]).append(",").append((int) it[4]).append("]");
    System.out.println("{\"name\":\"" + name + "\",\"kind\":\"" + kind + "\",\"cells\":[" + cs + "],\"cart\":[" + MinecartProbe.num(c[0]) + "," + MinecartProbe.num(c[1]) + "," + MinecartProbe.num(c[2]) + "," + MinecartProbe.num(c[3]) + "," + MinecartProbe.num(c[4]) + "," + MinecartProbe.num(c[5])
      + "],\"hits\":[" + hs + "],\"uses\":[" + us + "],\"items\":[" + is + "],\"player\":" + (playerAt == null ? "null" : "[" + playerAt[0] + "," + playerAt[1] + "," + playerAt[2] + "]") + ",\"creative\":" + creative
      + ",\"nbt\":" + nbtStart + ",\"nbtEnd\":" + NbtProbe.tag(end) + ",\"ticks\":[" + out + "]}");
  }

  static Map<Integer, Object[]> hits(Object... kv) { return MinecartProbe.hits(kv); }
  static Map<Integer, int[]> uses(int... kv) {
    Map<Integer, int[]> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 4) m.put(kv[i], new int[] {kv[i + 1], kv[i + 2], kv[i + 3]});
    return m;
  }
  static final Map<Integer, Object[]> NOHITS = new LinkedHashMap<>();
  static final Map<Integer, int[]> NOUSES = new LinkedHashMap<>();
  static final double[][] NOITEMS = {};
  static void go(String name, String kind, int[][] cells, double[] c, int ticks) throws Exception { run(name, kind, cells, c, ticks, NOHITS, NOUSES, null, NOITEMS, null, false); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[][] railX = MinecartProbe.row(66, 1, -2, 20, 0, 0);
    // Furnace: push/fuel set through the public pushX/pushZ and the private fuel field.
    go("furnace-idle", "furnace", railX, new double[] {0.5, 0.5, 0.5, 0.25, 0, 0}, 50);
    run("furnace-fuel", "furnace", railX, new double[] {0.5, 0.5, 0.5, 0.05, 0, 0}, 70, NOHITS, NOUSES, (w, c) -> { f(xq.class, "c").setInt(c, 40); ((xq) c).a = 1; ((xq) c).b = 0; }, NOITEMS, null, false);
    run("furnace-fuel-reverse", "furnace", railX, new double[] {0.5, 0.5, 0.5, 0.2, 0, 0}, 30, NOHITS, NOUSES, (w, c) -> { f(xq.class, "c").setInt(c, 40); ((xq) c).a = -1; ((xq) c).b = 0; }, NOITEMS, null, false);
    run("furnace-fuel-still", "furnace", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 40, NOHITS, NOUSES, (w, c) -> { f(xq.class, "c").setInt(c, 40); ((xq) c).a = 1; ((xq) c).b = 0; }, NOITEMS, null, false);
    run("furnace-fuel-z", "furnace", MinecartProbe.col(66, 0, -4, 20, 0, 0), new double[] {0.5, 0.5, 0.5, 0, 0, 0.02}, 40, NOHITS, NOUSES, (w, c) -> { f(xq.class, "c").setInt(c, 30); ((xq) c).a = 0; ((xq) c).b = 1; }, NOITEMS, null, false);
    run("furnace-offrail", "furnace", new int[][] {}, new double[] {0.5, 0.35, 0.5, 0.2, 0, 0}, 30, NOHITS, NOUSES, (w, c) -> { f(xq.class, "c").setInt(c, 20); ((xq) c).a = 1; ((xq) c).b = 0; }, NOITEMS, null, false);
    run("furnace-coal", "furnace", railX, new double[] {2.5, 0.5, 0.5, 0, 0, 0}, 40, NOHITS, uses(0, 263, 0, 3, 1, 263, 1, 2, 2, 280, 0, 1, 3, 0, 0, 0), null, NOITEMS, new double[] {1.5, 0, 0.5}, false);
    run("furnace-coal-creative", "furnace", railX, new double[] {2.5, 0.5, 0.5, 0, 0, 0}, 10, NOHITS, uses(0, 263, 0, 3), null, NOITEMS, new double[] {2.5, 0, 1.5}, true);
    run("furnace-kill", "furnace", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 8, hits(0, "generic", 1, 1, "generic", 1, 2, "generic", 1, 3, "generic", 1, 4, "generic", 1), NOUSES, null, NOITEMS, null, false);
    run("furnace-kill-explosion", "furnace", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 3, hits(0, "explosion", 5), NOUSES, null, NOITEMS, null, false);
    // TNT cart.
    int[][] activator = MinecartProbe.join(MinecartProbe.row(66, 1, -2, 1, 0, 0), MinecartProbe.row(157, 9, 2, 3, 0, 0), MinecartProbe.row(66, 1, 4, 30, 0, 0));
    int[][] unpowered = MinecartProbe.join(MinecartProbe.row(66, 1, -2, 1, 0, 0), MinecartProbe.row(157, 1, 2, 3, 0, 0), MinecartProbe.row(66, 1, 4, 30, 0, 0));
    go("tnt-activator", "tnt", activator, new double[] {0.5, 0.5, 0.5, 0.2, 0, 0}, 100);
    go("tnt-activator-off", "tnt", unpowered, new double[] {0.5, 0.5, 0.5, 0.2, 0, 0}, 30);
    int[][] wall = MinecartProbe.join(MinecartProbe.row(66, 1, -2, 5, 0, 0), new int[][] {{6, 0, 0, 1}, {6, 1, 0, 1}});
    go("tnt-wall-fast", "tnt", wall, new double[] {0.5, 0.5, 0.5, 0.35, 0, 0}, 30);
    go("tnt-wall-slow", "tnt", wall, new double[] {0.5, 0.5, 0.5, 0.06, 0, 0}, 80);
    go("tnt-wall-mid", "tnt", wall, new double[] {3.5, 0.5, 0.5, 0.2, 0, 0}, 30);
    go("tnt-fall-high", "tnt", new int[][] {}, new double[] {0.5, 8.0, 0.5, 0, 0, 0}, 40);
    go("tnt-fall-low", "tnt", new int[][] {}, new double[] {0.5, 2.0, 0.5, 0, 0, 0}, 20);
    run("tnt-kill-slow", "tnt", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 8, hits(0, "generic", 1, 1, "generic", 1, 2, "generic", 1, 3, "generic", 1, 4, "generic", 1), NOUSES, null, NOITEMS, null, false);
    run("tnt-kill-fast", "tnt", railX, new double[] {0.5, 0.5, 0.5, 0.3, 0, 0}, 5, hits(1, "generic", 5), NOUSES, null, NOITEMS, null, false);
    run("tnt-kill-fire", "tnt", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 4, hits(1, "inFire", 5), NOUSES, null, NOITEMS, null, false);
    run("tnt-kill-lava", "tnt", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 4, hits(1, "lava", 5), NOUSES, null, NOITEMS, null, false);
    run("tnt-kill-explosion", "tnt", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 4, hits(1, "explosion", 5), NOUSES, null, NOITEMS, null, false);
    run("tnt-fuse-set", "tnt", railX, new double[] {0.5, 0.5, 0.5, 0.1, 0, 0}, 14, NOHITS, NOUSES, (w, c) -> f(xv.class, "a").setInt(c, 12), NOITEMS, null, false);
    // Hopper cart (item pickup; an inventory above is the shared hopper code, verified by hopper-reference.json).
    run("hopper-above", "hopper", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 30, NOHITS, NOUSES, null, new double[][] {{0.5, 1.9, 0.5, 4, 5}, {0.7, 2.1, 0.4, 4, 3}, {0.4, 1.7, 0.6, 1, 7}}, null, false);
    run("hopper-beside", "hopper", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 30, NOHITS, NOUSES, null, new double[][] {{1.1, 0.6, 0.5, 4, 5}, {0.5, 0.6, -0.2, 1, 2}, {3.0, 0.6, 0.5, 1, 9}}, null, false);
    int[][] activatorH = MinecartProbe.join(MinecartProbe.row(66, 1, -2, 0, 0, 0), MinecartProbe.row(157, 9, 1, 3, 0, 0), MinecartProbe.row(66, 1, 4, 20, 0, 0));
    run("hopper-activator", "hopper", activatorH, new double[] {0.5, 0.5, 0.5, 0.1, 0, 0}, 40, NOHITS, NOUSES, null, new double[][] {{1.5, 1.9, 0.5, 4, 5}, {2.5, 1.9, 0.5, 4, 5}, {5.5, 1.9, 0.5, 4, 5}}, null, false);
    run("hopper-partial", "hopper", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 20, NOHITS, NOUSES, (w, c) -> { ((xr) c).a(0, new add(adb.d(4), 62, 0)); ((xr) c).a(1, new add(adb.d(5), 64, 0)); ((xr) c).a(2, new add(adb.d(5), 64, 0)); ((xr) c).a(3, new add(adb.d(5), 64, 0)); ((xr) c).a(4, new add(adb.d(5), 64, 0)); }, new double[][] {{0.5, 1.9, 0.5, 4, 5}}, null, false);
    run("hopper-full", "hopper", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 12, NOHITS, NOUSES, (w, c) -> { for (int i = 0; i < 5; i++) ((xr) c).a(i, new add(adb.d(5), 64, 0)); }, new double[][] {{0.5, 1.9, 0.5, 4, 5}}, null, false);
    run("hopper-nbt", "hopper", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 14, NOHITS, NOUSES, (w, c) -> { ((xr) c).a(2, new add(adb.d(4), 17, 0)); f(xr.class, "b").setInt(c, 3); }, new double[][] {{0.5, 1.9, 0.5, 1, 1}}, null, false);
    run("hopper-kill", "hopper", railX, new double[] {0.5, 0.5, 0.5, 0, 0, 0}, 8, hits(0, "generic", 1, 1, "generic", 1, 2, "generic", 1, 3, "generic", 1, 4, "generic", 1), NOUSES, (w, c) -> { ((xr) c).a(0, new add(adb.d(4), 40, 0)); ((xr) c).a(3, new add(adb.d(265), 3, 0)); }, NOITEMS, null, false);
  }
}
