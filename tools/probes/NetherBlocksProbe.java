import java.lang.reflect.*;
import java.lang.reflect.Proxy;
import java.util.*;

// Unchanged 1.7.10 netherrack (amg), soul sand (ano), BlockOre quartz ore (amn), BlockQuartz (amx), BlockFence (akz) for the
// nether brick fence, BlockStairs (ans), BlockStoneSlab and the End stone block (aji base) with CraftingManager (afe),
// FurnaceRecipes (afa) and ItemStack (add), on a map-backed World double. Entities are Unsafe-allocated (no constructor
// world calls beyond those MobMoveProbe.spawn already runs); spawnEntityInWorld is a sink that records EntityItem
// stacks and EntityXPOrb values, so dropBlockAsItemWithChance and dropXpOnBlockBreak run unchanged.
public class NetherBlocksProbe {
  static final Map<Long, int[]> cells = new HashMap<>();
  static boolean floor = false;
  static final List<Object> spawned = new ArrayList<>();

  static long key(int x, int y, int z) { return ((long) (x + 1000) * 4096 + (y + 1000)) * 4096 + (z + 1000); }
  static void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }
  static int[] cell(int x, int y, int z) { return cells.get(key(x, y, z)); }

  public static class World extends MobMoveProbe.ProbeWorld {
    public aji a(int x, int y, int z) { int[] c = cell(x, y, z); if (c != null) return aji.e(c[0]); return floor && y < 0 ? aji.e(1) : aji.e(0); }
    public int e(int x, int y, int z) { int[] c = cell(x, y, z); return c == null ? 0 : c[1]; }
    public boolean a(int x, int y, int z, int meta, int flags) { int[] c = cell(x, y, z); if (c == null) return false; c[1] = meta; return true; }
    public boolean f(int x, int y, int z) { cells.remove(key(x, y, z)); return true; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { put(x, y, z, aji.b(b), meta); return true; }
    public boolean v(int x, int y, int z) { return false; }
    public boolean c(int x, int y, int z, boolean def) { return a(x, y, z).r(); }
    public void d(int x, int y, int z, aji b) {}
    public boolean d(sa e) { spawned.add(e); return true; }
    public agy O() { agy g = new agy(); g.b("doTileDrops", "true"); return g; }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++) {
            aji b = a(x, y, z);
            if (b != null && b.o() != awt.a) b.a(this, x, y, z, box, out, entity);
          }
      return out;
    }
  }

  public static class Provider extends aqo { public String l() { return "Overworld"; } }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String box(azt b) { return b == null ? "null" : "[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }
  static String list(List<String> l) { return "[" + String.join(",", l) + "]"; }
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static String bounds(aji b) throws Exception {
    String[] f = {"B", "C", "D", "E", "F", "G"};
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < 6; i++) s.append(i > 0 ? "," : "").append(MobMoveProbe.field(aji.class, f[i]).getDouble(b));
    return s.append("]").toString();
  }
  static rg namer(List<String> names) {
    return (rg) Proxy.newProxyInstance(rg.class.getClassLoader(), new Class[] {rg.class}, (p, m, a) -> {
      String n = (String) a[0]; names.add(n);
      return Proxy.newProxyInstance(rf.class.getClassLoader(), new Class[] {rf.class}, (p2, m2, a2) -> {
        if (m2.getName().equals("g")) return n;
        Class<?> r = m2.getReturnType(); return r == int.class ? 0 : r == float.class ? 0F : r == double.class ? 0D : null; });
    });
  }
  static String material(awt m) {
    return m == awt.e ? "rock" : m == awt.d ? "wood" : m == awt.n ? "sand" : m == awt.b ? "ground" : m == awt.a ? "air" : "other";
  }
  static String icon(rf i) throws Exception { return i == null ? "null" : q((String) MobMoveProbe.method(i.getClass(), "g").invoke(i)); }

  static aji blk(int id) { return aji.e(id); }
  static adb item(int id) { return adb.d(id); }

  static void facts(World w, List<String> out, int id) throws Exception {
    aji b = blk(id);
    out.add("{\"case\":\"facts\",\"id\":" + id + ",\"render\":" + b.b() + ",\"opaque\":" + b.c() + ",\"renderNormal\":" + b.d() + ",\"normalCube\":" + b.r()
      + ",\"hardness\":" + num(b.f(w, 0, 0, 0)) + ",\"explosionResistance\":" + num(b.a((sa) null)) + ",\"resistanceField\":" + num(MobMoveProbe.fl(b, "w"))
      + ",\"lightOpacity\":" + MobMoveProbe.field(aji.class, "r").getInt(b) + ",\"lightValue\":" + MobMoveProbe.field(aji.class, "t").getInt(b)
      + ",\"useNeighborBrightness\":" + MobMoveProbe.b(b, "u") + ",\"material\":" + q(material(b.o())) + ",\"requiresTool\":" + !b.o().l()
      + ",\"stepSound\":" + q(b.H.b()) + ",\"slipperiness\":" + num(MobMoveProbe.fl(b, "K")) + ",\"bounds\":" + bounds(b) + "}");
  }

  static void drops(World w, List<String> out, int id, int meta) throws Exception {
    aji b = blk(id);
    adb d = b.a(meta, new Random(5), 0);
    Method dmg = MobMoveProbe.method(aji.class, "a", int.class);
    List<String> q = new ArrayList<>();
    for (int f = 0; f < 4; f++) { StringBuilder s = new StringBuilder(); for (int seed = 0; seed < 8; seed++) s.append(seed > 0 ? "," : "").append(b.a(f, new Random(seed))); q.add("[" + s + "]"); }
    out.add("{\"case\":\"drop\",\"id\":" + id + ",\"meta\":" + meta + ",\"item\":" + (d == null ? "null" : adb.b(d)) + ",\"damage\":" + dmg.invoke(b, meta) + ",\"quantity\":" + b.a(new Random(1)) + ",\"quantityFortune\":" + list(q) + "}");
  }

  static void mining(World w, List<String> out, int id) throws Exception {
    aji b = blk(id);
    StringBuilder s = new StringBuilder("{\"case\":\"mining\",\"id\":" + id + ",\"tools\":{");
    int[] tools = {270, 274, 257, 285, 278, 269, 273, 271, 268, 359};
    for (int i = 0; i < tools.length; i++) {
      add st = new add(item(tools[i]));
      s.append(i > 0 ? "," : "").append("\"" + tools[i] + "\":[" + num(st.a(b)) + "," + st.b(b) + "]");
    }
    out.add(s.append("}}").toString());
  }

  static void harvest(World w, List<String> out, int id, int meta, int fortune, int samples) throws Exception {
    aji b = blk(id);
    Map<String, Integer> counts = new TreeMap<>(), xps = new TreeMap<>();
    Method stack = null;
    for (Method m : xk.class.getDeclaredMethods()) if (m.getParameterCount() == 0 && m.getReturnType() == add.class) stack = m;
    for (int seed = 0; seed < samples; seed++) {
      cells.clear(); spawned.clear(); put(0, 0, 0, id, meta);
      MobMoveProbe.set(w, "s", new Random(seed));
      b.a(w, 0, 0, 0, meta, 1.0F, fortune);
      int items = 0, xp = 0; String what = "none";
      for (Object o : spawned) {
        if (o instanceof xk) { stack.setAccessible(true); add st = (add) stack.invoke(o); items += st.b; what = adb.b(st.b()) + ":" + st.k(); }
        if (o instanceof sq) xp += ((sq) o).e();
      }
      counts.merge(what + "x" + items, 1, Integer::sum); xps.merge(String.valueOf(xp), 1, Integer::sum);
    }
    out.add("{\"case\":\"harvest\",\"id\":" + id + ",\"meta\":" + meta + ",\"fortune\":" + fortune + ",\"samples\":" + samples + ",\"drops\":" + mapJson(counts) + ",\"xp\":" + mapJson(xps) + "}");
  }
  static String mapJson(Map<String, Integer> m) {
    List<String> l = new ArrayList<>(); for (Map.Entry<String, Integer> e : m.entrySet()) l.add("\"" + e.getKey() + "\":" + e.getValue()); return "{" + String.join(",", l) + "}";
  }

  static void icons(World w, List<String> out, int id, int metas) throws Exception {
    aji b = blk(id);
    for (int meta = 0; meta < metas; meta++) {
      List<String> sides = new ArrayList<>();
      for (int s = 0; s < 6; s++) sides.add(icon(b.a(s, meta)));
      out.add("{\"case\":\"icons\",\"id\":" + id + ",\"meta\":" + meta + ",\"sides\":" + list(sides) + "}");
    }
  }

  static void soulSand(World w, List<String> out) throws Exception {
    aji b = blk(88);
    cells.clear(); put(0, 0, 0, 88, 0);
    out.add("{\"case\":\"soulSandBoxes\",\"collision\":" + box(b.a(w, 0, 0, 0)) + ",\"selection\":" + box(b.g(w, 0, 0, 0)) + "}");
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    double[] ys = {0.0, 0.5, 0.874, 0.875, 0.9, 0.999, 1.0, 1.2};
    for (double y : ys) {
      cells.clear(); put(0, 0, 0, 88, 0);
      sv e = MobMoveProbe.spawn(u, w, "zombie", 0.5, y, 0.5, 0);
      MobMoveProbe.set(e, "v", 1.0); MobMoveProbe.set(e, "w", -0.5); MobMoveProbe.set(e, "x", -2.0);
      MobMoveProbe.method(sa.class, "I").invoke(e);
      out.add("{\"case\":\"soulSandSlow\",\"entity\":\"zombie\",\"y\":" + y + ",\"before\":[1.0,-0.5,-2.0],\"after\":[" + num(MobMoveProbe.d(e, "v")) + "," + num(MobMoveProbe.d(e, "w")) + "," + num(MobMoveProbe.d(e, "x")) + "]}");
    }
    // Two soul sand cells under one entity box (spanning x = 0 and x = 1): onEntityCollidedWithBlock runs once per cell.
    cells.clear(); put(0, 0, 0, 88, 0); put(1, 0, 0, 88, 0);
    sv e = MobMoveProbe.spawn(u, w, "zombie", 1.0, 0.5, 0.5, 0);
    MobMoveProbe.set(e, "v", 1.0); MobMoveProbe.set(e, "w", 0.0); MobMoveProbe.set(e, "x", 1.0);
    MobMoveProbe.method(sa.class, "I").invoke(e);
    out.add("{\"case\":\"soulSandSlow\",\"entity\":\"zombie-two-cells\",\"y\":0.5,\"before\":[1.0,0.0,1.0],\"after\":[" + num(MobMoveProbe.d(e, "v")) + "," + num(MobMoveProbe.d(e, "w")) + "," + num(MobMoveProbe.d(e, "x")) + "]}");
    // A dropped item: onEntityCollidedWithBlock directly (EntityItem motion is the same Entity.motionX/Z).
    xk it = (xk) u.allocateInstance(xk.class);
    MobMoveProbe.set(it, "v", 0.3); MobMoveProbe.set(it, "w", -0.2); MobMoveProbe.set(it, "x", -0.1);
    b.a(w, 0, 0, 0, (sa) it);
    out.add("{\"case\":\"soulSandSlow\",\"entity\":\"item\",\"y\":0,\"before\":[0.3,-0.2,-0.1],\"after\":[" + num(MobMoveProbe.d(it, "v")) + "," + num(MobMoveProbe.d(it, "w")) + "," + num(MobMoveProbe.d(it, "x")) + "]}");
  }

  static void quartzPlacement(World w, List<String> out) throws Exception {
    aji b = blk(155);
    Method dd = MobMoveProbe.method(aji.class, "a", int.class), stacked = MobMoveProbe.method(aji.class, "j", int.class);
    for (int meta = 0; meta < 5; meta++) {
      List<String> placed = new ArrayList<>();
      for (int side = 0; side < 6; side++) placed.add(String.valueOf(b.a(w, 0, 0, 0, side, 0.5F, 0.5F, 0.5F, meta)));
      add st = (add) stacked.invoke(b, meta);
      out.add("{\"case\":\"quartzPlace\",\"meta\":" + meta + ",\"placedBySide\":" + list(placed) + ",\"damageDropped\":" + dd.invoke(b, meta) + ",\"stacked\":[" + adb.b(st.b()) + "," + st.k() + "]}");
    }
    for (int id : new int[] {114, 156}) {
      aji s = blk(id);
      List<String> placed = new ArrayList<>();
      for (int side = 0; side < 6; side++) placed.add(String.valueOf(s.a(w, 0, 0, 0, side, 0.5F, side == 0 ? 0.9F : 0.1F, 0.5F, 0)));
      out.add("{\"case\":\"stairPlace\",\"id\":" + id + ",\"placedBySide\":" + list(placed) + "}");
    }
  }

  static void fences(World w, List<String> out) throws Exception {
    akz nether = (akz) blk(113), oak = (akz) blk(85);
    for (int id = 0; id < 176; id++) {
      if (id >= 165 && id <= 169) continue;
      int n = 0, o = 0;
      for (int meta = 0; meta < 16; meta++) {
        cells.clear(); put(1, 0, 0, id, meta);
        if (nether.e(w, 1, 0, 0)) n |= 1 << meta;
        if (oak.e(w, 1, 0, 0)) o |= 1 << meta;
      }
      out.add("{\"case\":\"fenceConnect\",\"id\":" + id + ",\"nether\":" + n + ",\"oak\":" + o + "}");
    }
    for (int mask = 0; mask < 16; mask++) {
      for (int nid : new int[] {1, 113, 85}) {
        cells.clear(); put(0, 0, 0, 113, 0);
        if ((mask & 1) != 0) put(0, 0, -1, nid, 0);
        if ((mask & 2) != 0) put(0, 0, 1, nid, 0);
        if ((mask & 4) != 0) put(-1, 0, 0, nid, 0);
        if ((mask & 8) != 0) put(1, 0, 0, nid, 0);
        List<azt> boxes = new ArrayList<>();
        nether.a(w, 0, 0, 0, azt.a(-1, -1, -1, 2, 3, 2), boxes, null);
        List<String> bs = new ArrayList<>(); for (azt a : boxes) bs.add(box(a));
        nether.a((ahl) w, 0, 0, 0);
        out.add("{\"case\":\"netherFenceShape\",\"neighbour\":" + nid + ",\"mask\":" + mask + ",\"collision\":" + list(bs) + ",\"bounds\":" + bounds(nether) + ",\"selection\":" + box(nether.g(w, 0, 0, 0)) + "}");
      }
    }
  }

  static void recipes(List<String> out) throws Exception {
    for (Object r : afe.a().b()) {
      add o = ((afg) r).b();
      if (o == null || o.b() == null) continue;
      int id = adb.b(o.b());
      boolean slab = id == 44 && (o.k() == 6 || o.k() == 7);
      if (!(id == 112 || id == 113 || id == 114 || id == 155 || id == 156 || slab)) continue;
      StringBuilder s = new StringBuilder("{\"case\":\"recipe\",\"output\":[" + id + "," + o.k() + "," + o.b + "]");
      if (r instanceof afh) {
        Object[] ing = (Object[]) MobMoveProbe.field(afh.class, "c").get(r);
        s.append(",\"shape\":[" + MobMoveProbe.field(afh.class, "a").getInt(r) + "," + MobMoveProbe.field(afh.class, "b").getInt(r) + "],\"ingredients\":" + stacks(ing));
      } else {
        List l = (List) MobMoveProbe.field(r.getClass(), "b").get(r);
        s.append(",\"shapeless\":" + stacks(l.toArray()));
      }
      out.add(s.append("}").toString());
    }
    // Every recipe that consumes one of the new items/blocks, by its output.
    for (Object r : afe.a().b()) {
      Object[] ing = null;
      if (r instanceof afh) ing = (Object[]) MobMoveProbe.field(afh.class, "c").get(r);
      else if (r instanceof afi) ing = ((List) MobMoveProbe.field(r.getClass(), "b").get(r)).toArray();
      if (ing == null) continue;
      for (Object i : ing) if (i instanceof add) {
        int id = adb.b(((add) i).b());
        if (id == 405 || id == 406 || id == 87 || id == 88 || id == 121 || id == 112 || id == 155 || id == 153) {
          add o = ((afg) r).b();
          out.add("{\"case\":\"consumer\",\"ingredient\":" + id + ",\"output\":[" + adb.b(o.b()) + "," + o.k() + "," + o.b + "]}");
          break;
        }
      }
    }
    for (Object e : afa.a().b().entrySet()) {
      Map.Entry en = (Map.Entry) e; add k = (add) en.getKey(), v = (add) en.getValue();
      int id = adb.b(v.b());
      if (id == 405 || id == 406) out.add("{\"case\":\"smelt\",\"input\":[" + adb.b(k.b()) + "," + k.k() + "],\"output\":[" + id + "," + v.k() + "," + v.b + "],\"xp\":" + num(afa.a().b(v)) + "}");
    }
  }
  static String stacks(Object[] a) {
    List<String> l = new ArrayList<>();
    for (Object o : a) l.add(o == null ? "null" : "[" + adb.b(((add) o).b()) + "," + ((add) o).k() + "]");
    return list(l);
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    { List<String> names = new ArrayList<>(); for (int i = 1; i < 256; i++) { aji bb = aji.e(i); if (bb != null && aji.b(bb) == i) bb.a(namer(names)); } }
    World w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "t", u.allocateInstance(Provider.class));
    List<String> out = new ArrayList<>();
    for (int id : new int[] {87, 88, 112, 113, 114, 121, 153, 155, 156, 43, 44}) facts(w, out, id);
    for (int id : new int[] {87, 88, 112, 113, 114, 121, 153, 155, 156}) mining(w, out, id);
    for (int id : new int[] {87, 88, 112, 113, 114, 121, 153, 156}) drops(w, out, id, 0);
    for (int m = 0; m < 5; m++) drops(w, out, 155, m);
    for (int m = 6; m < 8; m++) drops(w, out, 44, m);
    for (int id : new int[] {87, 88, 112, 121, 153, 113, 114, 156}) icons(w, out, id, 1);
    icons(w, out, 155, 5);
    icons(w, out, 44, 8);
    for (int f = 0; f < 4; f++) harvest(w, out, 153, 0, f, 400);
    for (int id : new int[] {87, 88, 121}) harvest(w, out, id, 0, 0, 4);
    soulSand(w, out);
    quartzPlacement(w, out);
    fences(w, out);
    recipes(out);
    for (String s : out) System.out.println(s);
  }
}
