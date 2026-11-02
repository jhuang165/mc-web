import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Records the unchanged EntityMinecartChest [xm] / EntityMinecartContainer [xp] / EntityMinecart [xl]:
// onUpdate [xl.h] off rails (func_94088_b) and on plain and golden rails (func_145821_a), the
// cart-cart applyEntityCollision [xl.g] and moveEntity's entity boxes, player pushes, attackEntityFrom
// [xl.a(ro,F)] damage sequences through killMinecart [xm.a(ro)] / setDead [xp.B] with the content
// spill (fixed entity Random), the void kill, and writeToNBT [sa.e(dh)]. MW is the
// XpOrbProbe map-backed World [ahb] double, plus World.getCollidingBoundingBoxes' entity part
// (copied from ahb.a(sa,azt)), an entity list and a spawnEntityInWorld [ahb.d(sa)] that only
// records. Before each onUpdate the probe does what World.updateEntityWithOptionalForce does first:
// lastTickPos and prevRotationYaw/Pitch. Rec only logs attackEntityFrom, then calls the original.
// tools/verify-minecarts.mjs writes public/research/minecart-reference.json; src/minecarts.test.js
// replays it.
public class MinecartProbe {
  static StringBuilder log = new StringBuilder();

  public static class MW extends ahb {
    MW() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    Map<Long, int[]> cells = new HashMap<>();
    List<sa> entities = new ArrayList<>();
    List<sa> spawned = new ArrayList<>();
    boolean voidBelow;
    public List b(sa except, azt box) {
      List<sa> out = new ArrayList<>();
      for (sa e : entities) if (e != except && !e.K && e.C.b(box)) out.add(e);
      return out;
    }
    int[] cell(int x, int y, int z) { int[] c = cells.get(PlantProbe.W.key(x, y, z)); return c != null ? c : new int[] {y < 0 && !voidBelow ? 1 : 0, 0}; }
    void put(int x, int y, int z, int id, int meta) { cells.put(PlantProbe.W.key(x, y, z), new int[] {id, meta}); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { return y > 255 ? aji.e(0) : aji.e(cell(x, y, z)[0]); }
    public int e(int x, int y, int z) { return y > 255 ? 0 : cell(x, y, z)[1]; }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public void a(sa entity, String sound, float volume, float pitch) {}
    public boolean d(sa e) { spawned.add(e); return true; }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            a(x, y, z).a(this, x, y, z, box, out, entity);
      // ahb.a(sa, azt): entity boxes within 0.25.
      List list = b(entity, box.b(0.25, 0.25, 0.25));
      for (Object o : list) {
        azt bb = ((sa) o).J();
        if (bb != null && bb.b(box)) out.add(bb);
        bb = entity.h((sa) o);
        if (bb != null && bb.b(box)) out.add(bb);
      }
      return out;
    }
  }

  static class Rec extends xm {
    Rec(ahb w, double x, double y, double z) { super(w, x, y, z); }
    public boolean a(ro source, float amount) { log.append(source.o).append(':').append(amount).append(' '); return super.a(source, amount); }
  }

  static class Target extends blk {
    Target() { super(null, null, null, 0); }
  }

  static MW world(int[][] cells) throws Exception {
    MW w = (MW) PlantProbe.unsafe.allocateInstance(MW.class);
    MobMoveProbe.set(w, "t", PlantProbe.unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    w.cells = new HashMap<>();
    w.entities = new ArrayList<>();
    w.spawned = new ArrayList<>();
    for (int[] c : cells) w.put(c[0], c[1], c[2], c[3], c.length > 4 ? c[4] : 0);
    return w;
  }

  static ro source(String type) throws Exception {
    for (java.lang.reflect.Field f : ro.class.getDeclaredFields())
      if (f.getType() == ro.class && java.lang.reflect.Modifier.isStatic(f.getModifiers())) {
        f.setAccessible(true);
        ro r = (ro) f.get(null);
        if (r != null && type.equals(r.o)) return r;
      }
    throw new IllegalArgumentException(type);
  }

  static Target player(MW w, double x, double y, double z, boolean creative) throws Exception {
    Target p = (Target) PlantProbe.unsafe.allocateInstance(Target.class);
    PlayerStepProbe.field(sa.class, "o").set(p, w);
    PlayerStepProbe.field(sa.class, "s").setDouble(p, x);
    PlayerStepProbe.field(sa.class, "t").setDouble(p, y);
    PlayerStepProbe.field(sa.class, "u").setDouble(p, z);
    PlayerStepProbe.field(sa.class, "C").set(p, azt.a(x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3));
    yw caps = new yw();
    caps.d = creative;
    PlayerStepProbe.field(yz.class, "bE").set(p, caps);
    return p;
  }

  // Slot contents: slot, original id, damage, count, stored enchantment id (-1 none), level.
  static final int[][] LOOT = {
    {0, 265, 0, 5, -1, 0}, {1, 266, 0, 3, -1, 0}, {2, 331, 0, 9, -1, 0}, {3, 351, 4, 9, -1, 0}, {5, 264, 0, 2, -1, 0},
    {6, 263, 0, 10, -1, 0}, {8, 296, 0, 3, -1, 0}, {9, 257, 0, 1, -1, 0}, {11, 66, 0, 16, -1, 0}, {12, 362, 0, 4, -1, 0},
    {13, 361, 0, 3, -1, 0}, {15, 329, 0, 1, -1, 0}, {17, 417, 0, 1, -1, 0}, {20, 403, 0, 1, 16, 2}, {21, 4, 0, 64, -1, 0},
    {26, 1, 0, 47, -1, 0},
  };
  static void fill(xm cart, int[][] loot) {
    for (int[] s : loot) {
      add stack = new add(adb.d(s[1]), s[3], s[2]);
      if (s[4] >= 0) {
        dh tag = new dh(), e = new dh();
        dq list = new dq();
        e.a("id", (short) s[4]);
        e.a("lvl", (short) s[5]);
        list.a(e);
        tag.a("StoredEnchantments", list);
        stack.d(tag);
      }
      cart.a(s[0], stack);
    }
  }

  static String num(double v) { return NbtProbe.number(v); }
  static String state(xl c) throws Exception {
    return "[" + num(c.s) + "," + num(c.t) + "," + num(c.u) + "," + num(c.v) + "," + num(c.w) + "," + num(c.x) + "," + c.D + "," + c.y + "," + c.z + "," + c.K
      + "," + c.j() + "," + c.k() + "," + c.l() + "," + PlayerStepProbe.field(sa.class, "I").getBoolean(c) + "," + num(c.C.b) + "," + PlayerStepProbe.field(sa.class, "e").getInt(c)
      + "," + vec(c.a(c.s, c.t, c.u)) + "," + vec(c.a(c.s, c.t, c.u, 0.3f)) + "," + vec(c.a(c.s, c.t, c.u, -0.3f)) + "]";
  }
  // RenderMinecart's rail lookups at the current position (func_70489_a and func_70495_a with
  // the renderer's (double) 0.3f).
  static String vec(azw v) { return v == null ? "null" : "[" + num(v.a) + "," + num(v.b) + "," + num(v.c) + "]"; }
  static String item(sa e) throws Exception {
    xk i = (xk) e;
    add s = i.f();
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + num(i.s) + "," + num(i.t) + "," + num(i.u) + "," + num(i.v) + "," + num(i.w) + "," + num(i.x) + ","
      + PlayerStepProbe.field(xk.class, "b").getInt(i) + "," + (s.p() ? NbtProbe.tag(s.q()) : "null") + "]";
  }

  // name, cells, carts {x, y, z, vx, vy, vz}, ticks, options.
  static void run(String name, int[][] cells, double[][] carts, int ticks, Map<String, Object> opt) throws Exception {
    MW w = world(cells);
    if (opt.containsKey("void")) w.voidBelow = true;
    List<Rec> list = new ArrayList<>();
    for (int i = 0; i < carts.length; i++) {
      double[] c = carts[i];
      Rec r = new Rec(w, c[0], c[1], c[2]);
      PlayerStepProbe.field(sa.class, "Z").set(r, new Random(1000 + i));
      PlayerStepProbe.field(sa.class, "c").setInt(r, i + 1);
      r.v = c[3]; r.w = c[4]; r.x = c[5];
      if (opt.containsKey("loot") && i == 0) fill(r, LOOT);
      if (opt.containsKey("name") && i == 0) r.a((String) opt.get("name"));
      list.add(r);
      w.entities.add(r);
    }
    double[] pp = (double[]) opt.get("player");
    Target p = pp == null ? null : player(w, pp[0], pp[1], pp[2], opt.containsKey("creative"));
    if (p != null && opt.containsKey("blocker")) w.entities.add(p);
    @SuppressWarnings("unchecked") Map<Integer, Object[]> hits = (Map<Integer, Object[]>) opt.getOrDefault("hits", new HashMap<>());
    String nbt = "null";
    if (opt.containsKey("nbt")) {
      dh tag = new dh();
      list.get(0).e(tag);
      tag.o("UUIDMost");
      tag.o("UUIDLeast");
      nbt = NbtProbe.tag(tag);
    }
    StringBuilder out = new StringBuilder();
    for (int t = 0; t < ticks; t++) {
      log.setLength(0);
      w.spawned.clear();
      Object[] hit = hits.get(t);
      if (hit != null) {
        ro src = "player".equals(hit[0]) ? ro.a((yz) p) : source((String) hit[0]);
        list.get(0).a(src, ((Number) hit[1]).floatValue());
      }
      StringBuilder pushes = new StringBuilder();
      if (p != null && opt.containsKey("push")) {
        for (Rec r : list) if (!r.K) r.g(p);
        pushes.append(num(p.v)).append(',').append(num(p.x));
      }
      for (Rec r : list) {
        if (r.K) continue;
        r.S = r.s; r.T = r.t; r.U = r.u;
        r.A = r.y; r.B = r.z;
        r.h();
      }
      StringBuilder states = new StringBuilder(), items = new StringBuilder();
      for (Rec r : list) states.append(states.length() > 0 ? "," : "").append(state(r));
      for (sa e : w.spawned) items.append(items.length() > 0 ? "," : "").append(item(e));
      out.append(t > 0 ? "," : "").append("[[").append(states).append("],\"").append(log.toString().trim()).append("\",[").append(items).append("]")
        .append(pushes.length() > 0 ? ",[" + pushes + "]" : "").append("]");
      boolean all = true;
      for (Rec r : list) all &= r.K;
      if (all) break;
    }
    StringBuilder cs = new StringBuilder(), ks = new StringBuilder();
    for (int[] cell : cells) {
      cs.append(cs.length() == 0 ? "" : ",").append('[');
      for (int k = 0; k < cell.length; k++) cs.append(k == 0 ? "" : ",").append(cell[k]);
      cs.append(']');
    }
    for (double[] c : carts) ks.append(ks.length() == 0 ? "" : ",").append("[").append(num(c[0])).append(",").append(num(c[1])).append(",").append(num(c[2])).append(",")
      .append(num(c[3])).append(",").append(num(c[4])).append(",").append(num(c[5])).append("]");
    StringBuilder hs = new StringBuilder();
    for (Map.Entry<Integer, Object[]> e : hits.entrySet()) hs.append(hs.length() == 0 ? "" : ",").append("[").append(e.getKey()).append(",\"").append(e.getValue()[0]).append("\",").append(e.getValue()[1]).append("]");
    System.out.println("{\"name\":\"" + name + "\",\"cells\":[" + cs + "],\"carts\":[" + ks + "],\"void\":" + opt.containsKey("void") + ",\"loot\":" + opt.containsKey("loot")
      + ",\"customName\":" + (opt.containsKey("name") ? "\"" + opt.get("name") + "\"" : "null")
      + ",\"player\":" + (pp == null ? "null" : "[" + pp[0] + "," + pp[1] + "," + pp[2] + "]") + ",\"creative\":" + opt.containsKey("creative")
      + ",\"blocker\":" + opt.containsKey("blocker") + ",\"push\":" + opt.containsKey("push") + ",\"hits\":[" + hs + "],\"nbt\":" + nbt + ",\"ticks\":[" + out + "]}");
  }

  static int[][] row(int id, int meta, int x0, int x1, int y, int z) {
    List<int[]> c = new ArrayList<>();
    for (int x = x0; x <= x1; x++) c.add(new int[] {x, y, z, id, meta});
    return c.toArray(new int[0][]);
  }
  static int[][] col(int id, int meta, int z0, int z1, int y, int x) {
    List<int[]> c = new ArrayList<>();
    for (int z = z0; z <= z1; z++) c.add(new int[] {x, y, z, id, meta});
    return c.toArray(new int[0][]);
  }
  static int[][] join(int[][]... parts) {
    List<int[]> c = new ArrayList<>();
    for (int[][] p : parts) for (int[] x : p) c.add(x);
    return c.toArray(new int[0][]);
  }
  static Map<String, Object> o(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }
  static Map<Integer, Object[]> hits(Object... kv) {
    Map<Integer, Object[]> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 3) m.put((Integer) kv[i], new Object[] {kv[i + 1], kv[i + 2]});
    return m;
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    // Original ids: stone 1, golden rail 27, web 30, fire 51, rail 66, cactus 81.
    int[][] none = {};
    int[][] spawnRail = {{0, 0, 0, 66, 0}};
    run("ground-drop", none, new double[][] {{0.5, 2.5, 0.5, 0, 0, 0}}, 40, o());
    run("ground-slide", none, new double[][] {{0.5, 0.35, 0.5, 0.3, 0, 0.1}}, 40, o());
    run("air-clamp", none, new double[][] {{0.5, 6.0, 0.5, 0.7, 0.3, -0.55}}, 60, o());
    run("wall", new int[][] {{3, 0, 0, 1}, {3, 1, 0, 1}}, new double[][] {{0.5, 0.35, 0.5, 0.4, 0, 0}}, 30, o());
    run("mineshaft-spawn", spawnRail, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 20, o("nbt", true, "loot", true));
    run("mineshaft-spawn-x", new int[][] {{0, 0, 0, 66, 1}}, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 20, o());
    run("rail-x", row(66, 1, -1, 8, 0, 0), new double[][] {{0.5, 0.5, 0.5, 0.25, 0, 0.05}}, 80, o());
    run("rail-z", col(66, 0, -6, 1, 0, 0), new double[][] {{0.3, 0.5, 0.5, 0.1, 0, -0.3}}, 60, o());
    run("rail-cross", row(66, 1, -3, 3, 0, 0), new double[][] {{0.5, 0.5, 0.5, 0.0, 0, 0.3}}, 30, o());
    int[][] hill = join(row(66, 1, -4, -1, 0, 0), new int[][] {{0, 0, 0, 66, 2}}, row(1, 0, 1, 5, 0, 0), row(66, 1, 1, 5, 1, 0));
    run("slope-up", hill, new double[][] {{-3.5, 0.5, 0.5, 0.4, 0, 0}}, 100, o());
    run("slope-down", hill, new double[][] {{4.5, 1.5, 0.5, -0.1, 0, 0}}, 80, o());
    run("slope-north", join(new int[][] {{0, 0, 0, 66, 4}}, col(66, 0, 1, 4, 0, 0), new int[][] {{0, 0, -1, 1}, {0, 1, -1, 66, 0}}), new double[][] {{0.5, 0.5, 3.5, 0, 0, -0.3}}, 60, o());
    run("curve", join(row(66, 1, -4, -1, 0, 0), new int[][] {{0, 0, 0, 66, 7}}, col(66, 0, 1, 5, 0, 0)), new double[][] {{-3.5, 0.5, 0.5, 0.3, 0, 0}}, 60, o());
    run("curve-ne", join(row(66, 1, 1, 5, 0, 0), new int[][] {{0, 0, 0, 66, 9}}, col(66, 0, -5, -1, 0, 0)), new double[][] {{0.5, 0.5, -3.5, 0, 0, 0.3}}, 60, o());
    run("golden-brake", row(27, 1, -1, 6, 0, 0), new double[][] {{0.5, 0.5, 0.5, 0.3, 0, 0}}, 30, o());
    run("golden-boost", row(27, 9, -1, 12, 0, 0), new double[][] {{0.5, 0.5, 0.5, 0.05, 0, 0}}, 40, o());
    run("golden-kick", new int[][] {{0, 0, 0, 27, 9}, {-1, 0, 0, 1}}, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 30, o());
    run("golden-kick-z", new int[][] {{0, 0, 0, 27, 8}, {0, 0, 1, 1}}, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 30, o());
    run("web", new int[][] {{1, 0, 0, 30}}, new double[][] {{0.5, 0.35, 0.5, 0.3, 0, 0}}, 40, o());
    run("cactus", new int[][] {{1, 0, 0, 81}}, new double[][] {{0.5, 0.35, 0.5, 0.3, 0, 0}}, 40, o("loot", true));
    run("fire", new int[][] {{1, 0, 0, 51}}, new double[][] {{0.2, 0.35, 0.5, 0.2, 0, 0}}, 40, o());
    run("void", none, new double[][] {{0.5, -62.0, 0.5, 0, 0, 0}}, 20, o("void", true, "loot", true));
    run("two-carts", row(66, 1, -2, 12, 0, 0), new double[][] {{0.5, 0.5, 0.5, 0.3, 0, 0}, {4.5, 0.5, 0.5, 0, 0, 0}}, 60, o());
    run("two-carts-head-on", row(66, 1, -6, 12, 0, 0), new double[][] {{0.5, 0.5, 0.5, 0.25, 0, 0}, {5.5, 0.5, 0.5, -0.2, 0, 0}}, 60, o());
    run("player-push", none, new double[][] {{0.5, 0.35, 0.5, 0, 0, 0}}, 20, o("player", new double[] {1.1, 0, 0.7}, "push", true));
    run("player-block", none, new double[][] {{0.5, 0.35, 0.5, 0.3, 0, 0}}, 20, o("player", new double[] {1.8, 0, 0.5}, "blocker", true));
    run("hits-fist", spawnRail, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 12, o("loot", true, "hits", hits(0, "generic", 1, 1, "generic", 1, 2, "generic", 1, 3, "generic", 1, 4, "generic", 1, 5, "generic", 1)));
    run("hits-spaced", spawnRail, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 40, o("hits", hits(0, "generic", 1, 10, "generic", 1, 20, "generic", 1, 30, "generic", 1)));
    run("hits-player", spawnRail, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 12, o("loot", true, "player", new double[] {2.5, 0, 0.5}, "hits", hits(0, "player", 1, 2, "player", 1, 3, "player", 1, 4, "player", 1, 5, "player", 1, 6, "player", 1)));
    run("hit-sword", spawnRail, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 4, o("loot", true, "player", new double[] {2.5, 0, 0.5}, "hits", hits(1, "player", 7)));
    run("hit-creative", spawnRail, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 4, o("loot", true, "creative", true, "player", new double[] {2.5, 0, 0.5}, "hits", hits(1, "player", 1)));
    run("hit-creative-named", spawnRail, new double[][] {{0.5, 0.5, 0.5, 0, 0, 0}}, 4, o("loot", true, "name", "Loot", "nbt", true, "creative", true, "player", new double[] {2.5, 0, 0.5}, "hits", hits(1, "player", 1)));
    run("hits-moving", row(66, 1, -2, 12, 0, 0), new double[][] {{0.5, 0.5, 0.5, 0.2, 0, 0}}, 20, o("hits", hits(0, "generic", 2, 1, "generic", 2, 3, "generic", 0.5)));
    // A loaded cart on rails: EntityMinecartContainer.applyDrag from the comparator level of the contents.
    run("rail-loaded", row(66, 1, -2, 20, 0, 0), new double[][] {{0.5, 0.5, 0.5, 0.3, 0, 0}}, 60, o("loot", true));
  }
}
