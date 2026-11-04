import java.lang.reflect.Method;
import java.util.*;

// Unchanged blocks and items added by 0.39.0 to the redstone family, Minecraft Java 1.7.10: BlockRedstoneTorch (anc, 75 unlit /
// 76 lit), BlockRedstoneLight (anb, 123 / 124), BlockCompressedPowered (ams, 152), BlockButtonWood (aon, 143), BlockPressurePlateWeighted
// (aol, 147 light / 148 heavy), BlockRedstoneComparator (akc, 149 / 150), BlockDaylightDetector (akg, 151), BlockPistonMoving (apr, 36) and
// BlockGlowstone (alg, 89), plus the ItemBlock / ItemReed placement of their items (comparator item 404). Same sparse-cell world double as
// RedstoneBlocksProbe: setBlock stores the cell and runs onBlockAdded, notifications, block events and scheduled updates are recorded
// (no power network is run: public/research/redstone-blocks-2.md), tile entities are not created, doTileDrops is off.
// Records: facts, bounds, drops (seeded, by fortune), silk, place, below, sides, recipe, creative.
public class RedstoneBlocks2Probe {
  static final Map<Long, int[]> cells = new HashMap<>();
  static boolean floor = false;
  static int removed = 0;
  static final List<String> ev = new ArrayList<>();
  static final int[] IDS = {75, 76, 123, 124, 152, 143, 147, 148, 149, 150, 151, 36, 89};
  static final String[] NAMES = {"unlit_redstone_torch", "redstone_torch", "redstone_lamp", "lit_redstone_lamp", "redstone_block", "wooden_button",
    "light_weighted_pressure_plate", "heavy_weighted_pressure_plate", "unpowered_comparator", "powered_comparator", "daylight_detector", "piston_extension", "glowstone"};

  static long key(int x, int y, int z) { return ((long) (x + 1000) * 4096 + (y + 1000)) * 4096 + (z + 1000); }
  static void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }
  static int[] cell(int x, int y, int z) { return cells.get(key(x, y, z)); }
  static void reset() { cells.clear(); floor = false; removed = 0; ev.clear(); }

  public static class World extends MobMoveProbe.ProbeWorld {
    public aji a(int x, int y, int z) {
      int[] c = cell(x, y, z);
      if (c != null) return aji.e(c[0]);
      return floor && y < 0 ? aji.e(1) : aji.e(0);
    }
    public int e(int x, int y, int z) { int[] c = cell(x, y, z); return c == null ? 0 : c[1]; }
    public boolean a(int x, int y, int z, int meta, int flags) { int[] c = cell(x, y, z); if (c == null) return false; c[1] = meta; return true; }
    public boolean f(int x, int y, int z) { removed++; cells.remove(key(x, y, z)); return true; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { put(x, y, z, aji.b(b), meta); b.b(this, x, y, z); return true; }
    public boolean v(int x, int y, int z) { return false; }
    public boolean c(int x, int y, int z, boolean def) { return a(x, y, z).r(); }
    public void d(int x, int y, int z, aji b) { ev.add("notify:" + x + "," + y + "," + z); }
    public void e(int x, int y, int z, aji b) { ev.add("notifyAll:" + x + "," + y + "," + z); }
    public void f(int x, int y, int z, aji b) { ev.add("notifyStrong:" + x + "," + y + "," + z); }
    public void c(int x, int y, int z, int x2, int y2, int z2) {}
    public void a(double x, double y, double z, String s, float v, float p) { ev.add("sound:" + s + ":" + v + ":" + p); }
    public void a(int x, int y, int z, aji b, int delay) { ev.add("schedule:" + x + "," + y + "," + z + ":" + aji.b(b) + ":" + delay); }
    public void c(int x, int y, int z, aji b, int a, int d) { ev.add("event:" + x + "," + y + "," + z); }
    public void a(int x, int y, int z, aor te) { ev.add("tile:" + x + "," + y + "," + z); }
    public aor o(int x, int y, int z) {
      int[] c = cell(x, y, z);
      if (c == null || (c[0] != 149 && c[0] != 150)) return null;
      try { return (aor) MobMoveProbe.unsafe().allocateInstance(aoz.class); } catch (Exception e) { return null; }
    }
    public List b(sa e, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public agy O() { agy g = new agy(); g.b("doTileDrops", "false"); return g; }
  }

  public static class Player extends yz {
    Player() { super(null, null); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }

  static World w;

  static String box(azt b) { return b == null ? "null" : "[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }
  static String bounds(aji b) throws Exception {
    String[] f = {"B", "C", "D", "E", "F", "G"};
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < 6; i++) s.append(i > 0 ? "," : "").append(MobMoveProbe.field(aji.class, f[i]).getDouble(b));
    return s.append("]").toString();
  }
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "'").replace("\n", " ") + "\""; }
  // Material.<field> by its obfuscated field name: d wood, e rock, f iron, q circuits, s glass, t redstoneLight, H piston, G web, a air.
  static String material(awt m) throws Exception {
    for (java.lang.reflect.Field f : awt.class.getDeclaredFields())
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers()) && f.getType() == awt.class && f.get(null) == m) return f.getName();
    return "?";
  }
  static String list(List<String> l) { return "[" + String.join(",", l) + "]"; }
  static String events() { List<String> o = new ArrayList<>(); for (String e : ev) o.add(q(e)); return list(o); }
  static String mask(boolean[] b) { StringBuilder s = new StringBuilder(); for (boolean x : b) s.append(x ? '1' : '0'); return s.toString(); }
  static String itemId(adb i) { return i == null ? "null" : String.valueOf(adb.b(i)); }

  static String facts(String name, aji b) throws Exception {
    List<String> drops = new ArrayList<>(), damage = new ArrayList<>(), picks = new ArrayList<>();
    for (int meta = 0; meta < 16; meta++) {
      reset();
      put(0, 0, 0, aji.b(b), meta);
      drops.add(itemId(b.a(meta, new Random(1), 0)));
      damage.add(String.valueOf(b.a(meta)));
      String pick;
      try { pick = itemId(b.d(w, 0, 0, 0)); } catch (Throwable t) { pick = "\"error\""; }
      picks.add(pick);
    }
    reset();
    Method silk = aji.class.getDeclaredMethod("E"); silk.setAccessible(true);
    Method stacked = aji.class.getDeclaredMethod("j", int.class); stacked.setAccessible(true);
    List<String> stacks = new ArrayList<>();
    for (int meta = 0; meta < 16; meta += 5) { add s = (add) stacked.invoke(b, meta); stacks.add(s == null ? "null" : "[" + adb.b(s.b()) + "," + s.k() + "," + s.b + "]"); }
    ajm s = b.H;
    return "{\"case\":\"facts\",\"block\":" + q(name) + ",\"id\":" + aji.b(b) + ",\"hardness\":" + b.f(w, 0, 0, 0)
      + ",\"resistance\":" + MobMoveProbe.field(aji.class, "w").getFloat(b) + ",\"opacity\":" + b.k() + ",\"light\":" + b.m()
      + ",\"render\":" + b.b() + ",\"opaque\":" + b.c() + ",\"renderNormal\":" + b.d() + ",\"normalCube\":" + b.r()
      + ",\"material\":" + q(material(b.o())) + ",\"materialOpaque\":" + b.o().k() + ",\"blocksMovement\":" + b.o().c()
      + ",\"requiresTool\":" + !b.o().l() + ",\"canProvidePower\":" + b.f() + ",\"tickRate\":" + b.a((ahb) w)
      + ",\"sound\":{\"break\":" + q(s.a()) + ",\"step\":" + q(s.e()) + ",\"place\":" + q(s.b()) + ",\"volume\":" + s.c() + ",\"pitch\":" + s.d() + "}"
      + ",\"quantity\":" + b.a(new Random(1)) + ",\"drop\":" + list(drops) + ",\"damageDropped\":" + list(damage) + ",\"pick\":" + list(picks)
      + ",\"useNeighborBrightness\":" + MobMoveProbe.field(aji.class, "u").getBoolean(b) + ",\"canSilkHarvest\":" + silk.invoke(b) + ",\"stacked\":" + list(stacks) + "}";
  }

  // Block.dropBlockAsItem order: quantityDroppedWithBonus(fortune, rand), then getItemDropped per stack.
  static String drops(String name, aji b, int meta) throws Exception {
    List<String> byFortune = new ArrayList<>();
    for (int fortune = 0; fortune <= 3; fortune++) {
      List<String> counts = new ArrayList<>();
      String item = null;
      for (int seed = 1; seed <= 24; seed++) {
        Random r = new Random(seed);
        counts.add(String.valueOf(b.a(fortune, r)));
        item = itemId(b.a(meta, r, fortune));
      }
      byFortune.add("{\"fortune\":" + fortune + ",\"counts\":" + counts + ",\"item\":" + item + "}");
    }
    return "{\"case\":\"drops\",\"block\":" + q(name) + ",\"id\":" + aji.b(b) + ",\"meta\":" + meta + ",\"seeds\":24,\"byFortune\":" + list(byFortune) + "}";
  }

  static final double[][] RAY = {{-2, .5, .5, 3, .5, .5}, {3, .5, .5, -2, .5, .5}, {.5, -2, .5, .5, 3, .5}, {.5, 3, .5, .5, -2, .5}, {.5, .5, -2, .5, .5, 3}, {.5, .5, 3, .5, .5, -2}};

  static String boundsRow(aji b, int meta) throws Exception {
    reset(); floor = true;
    put(0, 0, 0, aji.b(b), meta);
    b.a((ahl) w, 0, 0, 0);
    String bnd = bounds(b), col, sel;
    try { col = box(b.a(w, 0, 0, 0)); } catch (Throwable t) { col = "\"error\""; }
    try { sel = box(b.g(w, 0, 0, 0)); } catch (Throwable t) { sel = "\"error\""; }
    List<String> rays = new ArrayList<>();
    for (double[] r : RAY) {
      azu hit;
      try { hit = b.a(w, 0, 0, 0, azw.a(r[0], r[1], r[2]), azw.a(r[3], r[4], r[5])); } catch (Throwable t) { rays.add("\"error\""); continue; }
      rays.add(hit == null ? "null" : "[" + hit.e + "," + hit.f.a + "," + hit.f.b + "," + hit.f.c + "]");
    }
    return "{\"case\":\"bounds\",\"id\":" + aji.b(b) + ",\"meta\":" + meta + ",\"bounds\":" + bnd + ",\"collision\":" + col + ",\"selection\":" + sel + ",\"ray\":" + list(rays) + "}";
  }

  static Player player(float yaw) throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    Player p = (Player) u.allocateInstance(Player.class);
    MobMoveProbe.set(p, "o", w);
    MobMoveProbe.set(p, "Z", new Random(0));
    MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(p, "bE", new yw());
    MobMoveProbe.set(p, "y", Float.valueOf(yaw));
    return p;
  }

  static final int[][] SIDE = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
  static final int[][] NEIGH = {{-1, 0, 0}, {1, 0, 0}, {0, 0, -1}, {0, 0, 1}, {0, -1, 0}, {0, 1, 0}};

  // Click side `side` of the stone block Q so that the item lands in P = (0, 1, 0). mode 0: only Q is solid; mode 1: stone on all six neighbours of P.
  static String place(String name, adb item, aji block, int side, float yaw, int mode) throws Exception {
    reset();
    int px = 0, py = 1, pz = 0, qx = px - SIDE[side][0], qy = py - SIDE[side][1], qz = pz - SIDE[side][2];
    put(qx, qy, qz, 1, 0);
    if (mode == 1) for (int[] n : NEIGH) put(px + n[0], py + n[1], pz + n[2], 1, 0);
    int raw = block.a(w, px, py, pz, side, 0.5f, 0.5f, 0.5f, 0);
    Player pl = player(yaw);
    add stack = new add(item, 1, 0);
    String err = null;
    boolean ok = false;
    try { ok = item.a(stack, pl, w, qx, qy, qz, side, 0.5f, 0.5f, 0.5f); } catch (Throwable t) { err = t.toString(); }
    int[] c = cell(px, py, pz);
    return "{\"case\":\"place\",\"item\":" + name + ",\"mode\":" + mode + ",\"side\":" + side + ",\"yaw\":" + yaw + ",\"onBlockPlaced\":" + raw
      + ",\"used\":" + ok + ",\"cell\":" + (c == null ? "null" : "[" + c[0] + "," + c[1] + "]") + ",\"stack\":" + stack.b + ",\"error\":" + q(err) + ",\"events\":" + events() + "}";
  }

  static String stackJson(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"; }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (int i = 0; i < IDS.length; i++) System.out.println(facts(NAMES[i], aji.e(IDS[i])));
    for (int i = 0; i < IDS.length; i++) System.out.println(drops(NAMES[i], aji.e(IDS[i]), IDS[i] == 36 ? 0 : 0));
    for (int id : IDS) for (int meta = 0; meta < 16; meta++) System.out.println(boundsRow(aji.e(id), meta));

    // Support from the block below (x 0, y 0, z 0, any original id) for the blocks that rest on a floor: canPlaceBlockAt and
    // the removal done by onNeighborBlockChange, per original id (metadata 0), for the placed block at metadata 0.
    int[] floorBlocks = {147, 148, 149, 150, 151};
    for (int id = 0; id < 176; id++) {
      if (id >= 165 && id <= 169) continue;
      StringBuilder row = new StringBuilder("{\"case\":\"below\",\"id\":" + id);
      for (int fid : floorBlocks) {
        aji b = aji.e(fid);
        reset();
        put(0, 0, 0, id, 0);
        boolean can = b.c(w, 0, 1, 0);
        reset();
        put(0, 0, 0, id, 0);
        put(0, 1, 0, fid, 0);
        String err = null;
        try { b.a(w, 0, 1, 0, aji.e(0)); } catch (Throwable t) { err = t.toString(); }
        row.append(",\"can").append(fid).append("\":").append(can).append(",\"gone").append(fid).append("\":").append(removed > 0);
        if (err != null) row.append(",\"err").append(fid).append("\":").append(q(err));
      }
      System.out.println(row + "}");
    }

    // Wall/floor attachment of the torches and the wooden button: stone at x-1 (bit 0), x+1 (1), z-1 (2), z+1 (3), y-1 (4), y+1 (5) of P = (0,1,0).
    for (int id : new int[] {75, 76, 143}) {
      aji b = aji.e(id);
      boolean[] can = new boolean[64];
      boolean[][] on = new boolean[6][64], gone = new boolean[16][64];
      for (int m = 0; m < 64; m++) {
        reset();
        for (int n = 0; n < 6; n++) if ((m >> n & 1) != 0) put(NEIGH[n][0], 1 + NEIGH[n][1], NEIGH[n][2], 1, 0);
        can[m] = b.c(w, 0, 1, 0);
        for (int s = 0; s < 6; s++) on[s][m] = b.d(w, 0, 1, 0, s);
        for (int meta = 0; meta < 16; meta++) {
          reset();
          for (int n = 0; n < 6; n++) if ((m >> n & 1) != 0) put(NEIGH[n][0], 1 + NEIGH[n][1], NEIGH[n][2], 1, 0);
          put(0, 1, 0, id, meta);
          try { b.a(w, 0, 1, 0, aji.e(0)); } catch (Throwable t) {}
          gone[meta][m] = removed > 0;
        }
      }
      List<String> o = new ArrayList<>(), g = new ArrayList<>();
      for (int s = 0; s < 6; s++) o.add(q(mask(on[s])));
      for (int meta = 0; meta < 16; meta++) g.add(q(mask(gone[meta])));
      System.out.println("{\"case\":\"sides\",\"id\":" + id + ",\"can\":" + q(mask(can)) + ",\"onSide\":" + list(o) + ",\"gone\":" + list(g) + "}");
    }

    // Item placement through the unchanged ItemBlock / ItemReed onItemUse.
    Object[][] items = {
      {"76", adb.a(aji.e(76)), aji.e(76)}, {"123", adb.a(aji.e(123)), aji.e(123)}, {"152", adb.a(aji.e(152)), aji.e(152)},
      {"143", adb.a(aji.e(143)), aji.e(143)}, {"147", adb.a(aji.e(147)), aji.e(147)}, {"148", adb.a(aji.e(148)), aji.e(148)},
      {"151", adb.a(aji.e(151)), aji.e(151)}, {"89", adb.a(aji.e(89)), aji.e(89)}, {"404", adb.d(404), aji.e(149)}};
    List<Float> yaws = new ArrayList<>();
    for (int k = -16; k <= 16; k++) yaws.add(k * 22.5f);
    yaws.add(44.9f); yaws.add(45.1f);
    for (Object[] it : items) {
      boolean sweeps = it[0].equals("404");
      for (int side = 0; side < 6; side++) {
        for (float yaw : sweeps ? yaws : Arrays.asList(0f, 90f)) System.out.println(place((String) it[0], (adb) it[1], (aji) it[2], side, yaw, 0));
        System.out.println(place((String) it[0], (adb) it[1], (aji) it[2], side, 0f, 1));
      }
    }

    // Recipes: every unchanged CraftingManager recipe whose result is one of these items.
    Set<Integer> out = new HashSet<>(Arrays.asList(76, 123, 152, 143, 147, 148, 404, 89, 151, 331, 356));
    List<afg> recipes = afe.a().b();
    for (int index = 0; index < recipes.size(); index++) {
      afg r = recipes.get(index);
      add result = r.b();
      if (result == null || !out.contains(adb.b(result.b()))) continue;
      String type = "special", dims = "", ing = "null";
      if (r instanceof afh) {
        afh s = (afh) r;
        type = "shaped";
        dims = ",\"width\":" + MobMoveProbe.field(afh.class, "a").getInt(s) + ",\"height\":" + MobMoveProbe.field(afh.class, "b").getInt(s);
        List<String> l = new ArrayList<>();
        for (add a : (add[]) MobMoveProbe.field(afh.class, "c").get(s)) l.add(stackJson(a));
        ing = list(l);
      } else if (r instanceof afi) {
        type = "shapeless";
        List<String> l = new ArrayList<>();
        for (Object a : (List) MobMoveProbe.field(afi.class, "b").get(r)) l.add(stackJson((add) a));
        ing = list(l);
      }
      System.out.println("{\"case\":\"recipe\",\"index\":" + index + ",\"type\":" + q(type) + dims + ",\"ingredients\":" + ing + ",\"result\":" + stackJson(result) + "}");
    }

    // Creative tabs: the tab each of these items lists in, in native order (the search tab walks the item registry).
    Set<Integer> shown = new HashSet<>(Arrays.asList(76, 123, 152, 143, 147, 148, 404, 89, 151, 406, 348, 36));
    rg register = (rg) java.lang.reflect.Proxy.newProxyInstance(rg.class.getClassLoader(), new Class<?>[] { rg.class }, (proxy, m, a) -> null);
    for (Object o : aji.c) try { ((aji) o).a(register); } catch (Throwable t) {}
    for (Object o : adb.e) try { ((adb) o).a(register); } catch (Throwable t) {}
    for (abt tab : abt.a) {
      if (tab == null) continue;
      List<add> list = new ArrayList<>();
      if (tab == abt.g) {
        for (Object o : adb.e) { adb item = (adb) o; if (item != null && item.n_() != null) item.a(item, null, list); }
      } else tab.a(list);
      List<String> at = new ArrayList<>();
      for (int i = 0; i < list.size(); i++) if (shown.contains(adb.b(list.get(i).b()))) at.add("[" + i + "," + adb.b(list.get(i).b()) + "," + list.get(i).k() + "]");
      System.out.println("{\"case\":\"creative\",\"tab\":" + tab.a() + ",\"label\":" + q(tab.b()) + ",\"size\":" + list.size() + ",\"at\":" + list(at) + "}");
    }
  }
}
