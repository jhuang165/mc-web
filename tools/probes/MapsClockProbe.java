import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged MapColor (awv), Block.getMapColor (aji.f), ItemEmptyMap (acl), ItemMap (adh), MapData (ayi, ayj, ayk),
// MapStorage (azq), RecipesMapCloning (afb), RecipesMapExtending (afc) and TextureClock (bql) of the 1.7.10 JAR on the
// ChickenProbe/DifficultyProbe World double, extended with a deterministic closed-form terrain (integer maths only), a chunk
// double that serves it, a real MapStorage and a real player inventory. Nothing is patched. The only stub is the texture
// upload at the end of TextureClock.updateAnimation (it needs OpenGL): its exception is caught after the frame index, the
// angle and the velocity have been stored.
// Prints one JSON object per line: mapColor, blockColor, empty, scaling, autoCreate, update, decor, recipe, clock.
public class MapsClockProbe {
  // ---- the fixed terrain (mirrored by src/maps-clock.test.js) ----
  static int fm(int a, int m) { int r = a % m; return r < 0 ? r + m : r; }
  static int tri(int n, int p) { return Math.abs(fm(n, 2 * p) - p); }
  static int height(int x, int z) { return 56 + tri(x, 20) / 3 + tri(z, 26) / 4 + tri(x + z, 14) / 5; }
  static int hash(int a, int b) { int h = a * 73856093 ^ b * 19349663; h ^= h >>> 13; h *= 0x5bd1e995; h ^= h >>> 15; return h; }
  static int kind(int x, int z) { return fm(hash(Math.floorDiv(x, 8), Math.floorDiv(z, 8)), 16); }
  static int surfaceId(int k) { return new int[] { 2, 2, 2, 2, 2, 12, 1, 3, 35, 13, 82, 80, 24, 79, 87, 5 }[k]; }
  static int surfaceMeta(int k, int x, int z) {
    if (k == 8) return fm(hash(Math.floorDiv(x, 8), Math.floorDiv(z, 8)) >> 4, 16);
    if (k == 15) return fm(Math.floorDiv(x, 8) + Math.floorDiv(z, 8), 4);
    return 0;
  }
  static boolean treeCentre(int cx, int cz) { return fm(cx, 9) == 0 && fm(cz, 11) == 0 && height(cx, cz) >= 62 && kind(cx, cz) <= 4; }
  static int[] column(int x, int z) {
    int[] c = new int[256];
    int h = height(x, z), k = kind(x, z);
    c[0] = 7 << 4;
    for (int y = 1; y < h - 3; y++) c[y] = 1 << 4;
    for (int y = Math.max(1, h - 3); y < h; y++) c[y] = (k == 5 || h < 62 ? 12 : k == 12 ? 24 : k == 6 ? 1 : 3) << 4;
    if (h < 62) {
      c[h] = (k % 2 == 0 ? 12 : k % 3 == 0 ? 82 : 13) << 4;
      for (int y = h + 1; y <= 62; y++) c[y] = 9 << 4;
    } else {
      c[h] = surfaceId(k) << 4 | surfaceMeta(k, x, z);
      if (k == 11) c[h + 1] = 78 << 4;
      if (k == 5 && fm(x, 7) == 0 && fm(z, 5) == 0) c[h + 1] = 81 << 4;
    }
    for (int dx = -1; dx <= 1; dx++)
      for (int dz = -1; dz <= 1; dz++) {
        int cx = x + dx, cz = z + dz;
        if (!treeCentre(cx, cz)) continue;
        int hc = height(cx, cz), lm = fm(cx + cz, 4);
        if (dx == 0 && dz == 0) { for (int y = hc + 1; y <= hc + 3; y++) c[y] = 17 << 4 | fm(cx, 4); }
        if (!(dx == 0 && dz == 0)) c[hc + 3] = 18 << 4 | lm;
        c[hc + 4] = 18 << 4 | lm;
      }
    return c;
  }
  static Map<Long, int[]> columns = new HashMap<>();
  static int[] col(int x, int z) { return columns.computeIfAbsent(((long) x << 32) ^ (z & 0xffffffffL), k -> column(x, z)); }
  static int cell(int x, int y, int z) { return y < 0 || y > 255 ? 0 : col(x, z)[y]; }
  static int heightValue(int x, int z) {
    int[] c = col(x, z);
    for (int y = 255; y >= 0; y--) if (c[y] != 0 && aji.e(c[y] >> 4).k() > 0) return y + 1;
    return 0;
  }
  static boolean emptyChunks = false; // chunk column cx == 2 reads as empty (Chunk.isEmpty)

  public static class FC extends apx {
    FC() { super(null, 0, 0); }
    int cx() { try { return MobMoveProbe.field(apx.class, "g").getInt(this); } catch (Exception e) { throw new RuntimeException(e); } }
    int cz() { try { return MobMoveProbe.field(apx.class, "h").getInt(this); } catch (Exception e) { throw new RuntimeException(e); } }
    public boolean g() { return emptyChunks && cx() == 2; }
    public int b(int x, int z) { return heightValue(cx() * 16 + x, cz() * 16 + z); }
    public aji a(int x, int y, int z) { return aji.e(cell(cx() * 16 + x, y, cz() * 16 + z) >> 4); }
    public int c(int x, int y, int z) { return cell(cx() * 16 + x, y, cz() * 16 + z) & 15; }
  }
  static Map<Long, FC> chunks = new HashMap<>();
  static FC chunk(int cx, int cz) throws Exception {
    long key = ((long) cx << 32) ^ (cz & 0xffffffffL);
    FC c = chunks.get(key);
    if (c == null) {
      c = (FC) WitchProbe.u.allocateInstance(FC.class);
      MobMoveProbe.field(apx.class, "g").setInt(c, cx);
      MobMoveProbe.field(apx.class, "h").setInt(c, cz);
      chunks.put(key, c);
    }
    return c;
  }
  public static class MW extends DifficultyProbe.World {
    public apx d(int x, int z) { try { return chunk(x >> 4, z >> 4); } catch (Exception e) { throw new RuntimeException(e); } }
  }
  public static class MP extends DifficultyProbe.Player {
    public String b_() { return "Steve"; }
  }
  public static class Craft extends zs { public boolean a(yz p) { return true; } }

  static MW w;
  static sun.misc.Unsafe u;
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }

  static MP player(double x, double z, float yaw, int dimension) throws Exception {
    MP p = DifficultyProbe.player(u, MP.class);
    fd(sa.class, "s").setDouble(p, x); fd(sa.class, "t").setDouble(p, 70); fd(sa.class, "u").setDouble(p, z);
    fd(sa.class, "y").setFloat(p, yaw);
    fd(sa.class, "ap").setInt(p, dimension);
    fd(yz.class, "bm").set(p, new yx(p));
    return p;
  }
  static add[] main(yz p) throws Exception {
    for (Field f : yx.class.getDeclaredFields()) if (f.getType() == add[].class) { f.setAccessible(true); return (add[]) f.get(p.bm); }
    return null;
  }
  static void provider(boolean noSky, int dimension) throws Exception {
    aqo t = (aqo) fd(ahb.class, "t").get(w);
    fd(aqo.class, "g").setBoolean(t, noSky);
    fd(aqo.class, "i").setInt(t, dimension);
  }
  static void resetStorage() throws Exception { fd(ahb.class, "z").set(w, new azq(null)); }
  static void time(long t) throws Exception { fd(ays.class, "h").setLong(fd(ahb.class, "x").get(w), t); }
  static void spawn(int x, int z) throws Exception { ((ays) fd(ahb.class, "x").get(w)).a(x, 64, z); }

  static String rle(byte[] a) {
    StringBuilder s = new StringBuilder("[");
    int i = 0;
    while (i < a.length) {
      int j = i;
      while (j < a.length && a[j] == a[i]) j++;
      s.append(i > 0 ? "," : "").append(a[i]).append(",").append(j - i);
      i = j;
    }
    return s.append("]").toString();
  }
  static String dirty(ayj info) throws Exception {
    int[] lo = (int[]) fd(ayj.class, "b").get(info), hi = (int[]) fd(ayj.class, "c").get(info);
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (int x = 0; x < 128; x++) if (lo[x] >= 0 && hi[x] >= 0) { s.append(first ? "" : ",").append("[").append(x).append(",").append(lo[x]).append(",").append(hi[x]).append("]"); first = false; }
    return s.append("]").toString();
  }
  static String decorations(ayi data) {
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (Object o : data.g.entrySet()) {
      Map.Entry e = (Map.Entry) o; ayk d = (ayk) e.getValue();
      s.append(first ? "" : ",").append("[").append(q((String) e.getKey())).append(",").append(d.a).append(",").append(d.b).append(",").append(d.c).append(",").append(d.d).append("]");
      first = false;
    }
    return s.append("]").toString();
  }
  static String dataJson(ayi d) { return "{\"id\":" + q(d.h) + ",\"scale\":" + d.d + ",\"xCenter\":" + d.a + ",\"zCenter\":" + d.b + ",\"dimension\":" + d.c + "}"; }

  static void colors() {
    for (int i = 0; i < 64; i++) {
      awv c = awv.a[i];
      if (c == null) continue;
      System.out.println("{\"case\":\"mapColor\",\"index\":" + c.M + ",\"rgb\":" + c.L + ",\"shades\":[" + c.b(0) + "," + c.b(1) + "," + c.b(2) + "," + c.b(3) + "]}");
    }
    for (int id = 0; id < 256; id++) {
      aji b = aji.e(id);
      if (b == null || aji.b(b) != id) continue;
      StringBuilder m = new StringBuilder();
      for (int meta = 0; meta < 16; meta++) m.append(meta > 0 ? "," : "").append(b.f(meta).M);
      System.out.println("{\"case\":\"blockColor\",\"id\":" + id + ",\"colors\":[" + m + "],\"liquid\":" + b.o().d() + ",\"opacity\":" + b.k() + "}");
    }
  }

  // ItemEmptyMap.onItemRightClick (acl.a) from positions; centres by the Math.round(x / size) * size rule.
  static void emptyMaps() throws Exception {
    resetStorage(); provider(false, 0);
    double[][] at = { { 0, 0 }, { 63.9, 63.9 }, { 64, 64 }, { -64, -64 }, { -64.0001, 63.99 }, { 300, -200 }, { -1000.5, 999.5 }, { 12345.6, -98765.4 }, { 0, 0 } };
    for (int i = 0; i < at.length; i++) {
      MP p = player(at[i][0], at[i][1], 0, 0);
      add stack = new add(ade.bJ, 1, 0);
      add out = ade.bJ.a(stack, w, p);
      ayi d = (ayi) w.a(ayi.class, "map_" + out.k());
      System.out.println("{\"case\":\"empty\",\"at\":[" + num(at[i][0]) + "," + num(at[i][1]) + "],\"result\":[" + "1," + out.k() + "],\"data\":" + dataJson(d) + "}");
    }
    // A stack of 3 keeps 2 and the map goes into the player's inventory (or is dropped).
    MP p = player(10, 10, 0, 0);
    add stack = new add(ade.bJ, 3, 0);
    add out = ade.bJ.a(stack, w, p);
    int inInv = 0; for (add a : main(p)) if (a != null && a.b() == ade.aY) inInv += a.b;
    System.out.println("{\"case\":\"emptyStack\",\"returnedItemIsStack\":" + (out == stack) + ",\"count\":" + out.b + ",\"mapsInInventory\":" + inInv + ",\"nextId\":" + w.b("map") + "}");
    // The nether centre follows the dimension id.
    provider(false, -1);
    p = player(500, 500, 0, -1);
    out = ade.bJ.a(new add(ade.bJ, 1, 0), w, p);
    System.out.println("{\"case\":\"emptyDimension\",\"data\":" + dataJson((ayi) w.a(ayi.class, "map_" + out.k())) + "}");
    provider(false, 0);
  }

  // ItemMap.func_150912_a / getMapData for a stack whose data does not exist (server side): scale 3 around the spawn.
  static void autoCreate() throws Exception {
    resetStorage(); provider(false, 0);
    int[][] spawns = { { 0, 0 }, { 700, -300 }, { 511, 513 }, { -512, -513 }, { 20000, -20000 } };
    for (int[] s : spawns) {
      spawn(s[0], s[1]);
      add stack = new add(ade.aY, 1, 5);
      ayi d = ade.aY.a(stack, w);
      System.out.println("{\"case\":\"autoCreate\",\"spawn\":[" + s[0] + "," + s[1] + "],\"damageAfter\":" + stack.k() + ",\"data\":" + dataJson(d) + ",\"nextId\":" + w.b("map") + "}");
    }
    spawn(0, 0);
  }

  // ItemMap.onCreated of a stack carrying map_is_scaling (the zoom-out recipe's result).
  static void scaling() throws Exception {
    resetStorage(); provider(false, 0);
    MP p = player(300, -200, 0, 0);
    add map = ade.bJ.a(new add(ade.bJ, 1, 0), w, p);
    for (int step = 0; step < 6; step++) {
      ayi old = ade.aY.a(map, w);
      int oldDamage = map.k();
      dh tag = new dh(); tag.a("map_is_scaling", true); map.d(tag);
      ade.aY.d(map, w, p);
      ayi now = ade.aY.a(map, w);
      System.out.println("{\"case\":\"scaling\",\"step\":" + step + ",\"oldDamage\":" + oldDamage + ",\"newDamage\":" + map.k() + ",\"old\":" + dataJson(old) + ",\"data\":" + dataJson(now) + "}");
    }
    // A plain filled map is not scaled by onCreated.
    add plain = new add(ade.aY, 1, 77);
    ade.aY.d(plain, w, p);
    System.out.println("{\"case\":\"scalingPlain\",\"damage\":" + plain.k() + "}");
  }

  static void update(String name, int scale, int xc, int zc, int dim, boolean noSky, double px, double pz, boolean emptyChunk, int calls) throws Exception {
    resetStorage(); provider(noSky, dim); emptyChunks = emptyChunk; time(5000);
    ayi d = new ayi("map_0");
    d.d = (byte) scale; d.a = xc; d.b = zc; d.c = (byte) dim;
    MP p = player(px, pz, 0, dim);
    StringBuilder snaps = new StringBuilder();
    ayj info = d.a(p);
    for (int call = 1; call <= calls; call++) {
      Arrays.fill((int[]) fd(ayj.class, "b").get(info), -1); Arrays.fill((int[]) fd(ayj.class, "c").get(info), -1);
      ade.aY.a(w, p, d);
      if (call == 1 || call == 2 || call == calls) {
        snaps.append(snaps.length() > 0 ? "," : "").append("{\"call\":").append(call).append(",\"rle\":").append(rle(d.e)).append(",\"dirty\":").append(dirty(info)).append(",\"counter\":").append(info.d).append("}");
      }
    }
    System.out.println("{\"case\":\"update\",\"name\":" + q(name) + ",\"scale\":" + scale + ",\"xCenter\":" + xc + ",\"zCenter\":" + zc + ",\"dimension\":" + dim + ",\"noSky\":" + noSky + ",\"player\":[" + num(px) + "," + num(pz) + "],\"emptyChunkColumn2\":" + emptyChunk + ",\"snapshots\":[" + snaps + "]}");
    emptyChunks = false; provider(false, 0);
  }

  // MapData.updateVisiblePlayers (decorations).
  static void decor() throws Exception {
    resetStorage(); provider(false, 0); time(12345);
    Object[][] rows = {
      // scale, dimension of the map, player x, z, yaw, dimension of the player, holds map
      { 1, 0, 0.0, 0.0, 0f, 0, true }, { 1, 0, 30.3, -50.7, 90f, 0, true }, { 1, 0, -100.0, 100.0, -90f, 0, true },
      { 1, 0, 125.9, 0.0, 359f, 0, true }, { 1, 0, 126.5, 0.0, 10f, 0, true }, { 1, 0, 127.0, -127.0, 45f, 0, true }, { 1, 0, 200.0, 200.0, 180f, 0, true },
      { 1, 0, 620.0, 0.0, 0f, 0, true }, { 1, 0, 640.0, 0.0, 0f, 0, true }, { 1, 0, 641.0, 0.0, 0f, 0, true }, { 1, 0, -641.0, -300.0, 0f, 0, true },
      { 0, 0, 63.0, 63.0, 22.5f, 0, true }, { 0, 0, 64.0, 64.0, 22.5f, 0, true }, { 0, 0, -64.5, -64.5, -22.5f, 0, true },
      { 4, 0, 1000.0, -1000.0, 123f, 0, true }, { 2, 0, 5.0, 5.0, 77f, 0, false }, { 1, 0, 5.0, 5.0, 77f, -1, true }, { 1, -1, 5.0, 5.0, 77f, -1, true },
      { 1, -1, 60.0, -60.0, 77f, -1, true }
    };
    int rowIndex = 0;
    for (Object[] r : rows) {
      time(12345 + 997L * rowIndex++);
      ayi d = new ayi("map_1"); d.d = (byte) (int) (Integer) r[0]; d.c = (byte) (int) (Integer) r[1];
      MP p = player((Double) r[2], (Double) r[3], (Float) r[4], (Integer) r[5]);
      add map = new add(ade.aY, 1, 1);
      if ((Boolean) r[6]) main(p)[0] = map;
      d.a(p, map);
      System.out.println("{\"case\":\"decor\",\"time\":" + (12345 + 997L * (rowIndex - 1)) + ",\"scale\":" + r[0] + ",\"mapDimension\":" + r[1] + ",\"player\":[" + r[2] + "," + r[3] + "," + r[4] + "],\"playerDimension\":" + r[5] + ",\"holds\":" + r[6] + ",\"decorations\":" + decorations(d) + "}");
    }
  }

  static add stackOf(Object s) {
    if (s == null) return null;
    int[] a = (int[]) s;
    return new add(a[0] == 0 ? ade.aF : a[0] == 1 ? ade.aY : ade.bJ, a[1], a[2]);
  }
  // RecipesMapCloning (afb) and RecipesMapExtending (afc): 0 paper, 1 filled map (damage), 2 empty map.
  static void recipes() throws Exception {
    resetStorage(); provider(false, 0);
    MP p = player(300, -200, 0, 0);
    ayi seed = ade.aY.a(ade.bJ.a(new add(ade.bJ, 1, 0), w, p), w); // map_0 exists at scale 0
    String[][] grids = {
      { "3x3", "P P P P M P P P P", "M=1:7" }, { "3x3", "P P P P M P P P .", "M=1:7" }, { "3x3", "P P P P M P P P P", "M=1:0" }, { "3x3", "P P P P E P P P P", "" },
      { "3x3", "P P P P M P P P P", "M=1:7+scale4" }, { "3x3", "P P P . M P P P P", "M=1:7" }, { "3x3", "P P P P M M P P P", "M=1:7" },
      { "3x3", "M E . . . . . . .", "M=1:7" }, { "3x3", ". M E . . . . . .", "M=1:7" }, { "3x3", "M E E E E E E E E", "M=1:7" }, { "3x3", "M M E . . . . . .", "M=1:7" },
      { "3x3", "E E E . . . . . .", "" }, { "3x3", "M P E . . . . . .", "M=1:7" }, { "3x3", "M . . . . . . . .", "M=1:7" }, { "2x2", "M E . .", "M=1:7" }, { "2x2", "M P P P", "M=1:7" },
      { "3x3", "M E . . . . . . .", "M=1:7+name" }
    };
    for (String[] g : grids) {
      int size = g[0].equals("2x2") ? 2 : 3;
      Craft c = new Craft();
      aae grid = new aae(c, size, size);
      String[] cells = g[1].split(" ");
      boolean scale4 = g[2].contains("scale4"), named = g[2].contains("name");
      int mapDamage = 7;
      if (scale4) { ayi d = new ayi("map_7"); d.d = 4; w.a("map_7", d); } else { ayi d = new ayi("map_7"); d.d = 0; w.a("map_7", d); }
      for (int i = 0; i < size * size; i++) {
        add s = null;
        switch (cells[i]) {
          case "P": s = new add(ade.aF, 1, 0); break;
          case "M": s = new add(ade.aY, 1, g[2].startsWith("M=1:0") ? 0 : mapDamage); if (named) s.c("Atlas"); break;
          case "E": s = new add(ade.bJ, 1, 0); break;
        }
        grid.a(i, s);
      }
      boolean cloneMatches = new afb().a(grid, w), extendMatches = new afc().a(grid, w);
      add cloneResult = cloneMatches ? new afb().a(grid) : null, extendResult = extendMatches ? new afc().a(grid) : null;
      System.out.println("{\"case\":\"recipe\",\"size\":" + size + ",\"grid\":" + q(g[1]) + ",\"map\":" + q(g[2]) + ",\"clone\":" + resultJson(cloneMatches, cloneResult) + ",\"extend\":" + resultJson(extendMatches, extendResult) + "}");
    }
    System.out.println("{\"case\":\"recipeFacts\",\"cloneSize\":" + new afb().a() + ",\"cloneOutput\":" + (new afb().b() == null ? "null" : "\"stack\"") + ",\"extendOutput\":" + q(new afc().b() == null ? null : new afc().b().b() == ade.bJ ? "emptyMap" : "other") + "}");
  }
  static String resultJson(boolean matches, add r) {
    if (r == null) return "{\"matches\":" + matches + ",\"result\":null}";
    return "{\"matches\":" + matches + ",\"result\":{\"item\":" + q(r.b() == ade.aY ? "map" : r.b() == ade.bJ ? "emptyMap" : "other") + ",\"count\":" + r.b + ",\"damage\":" + r.k() + ",\"scaling\":" + (r.p() && r.q().n("map_is_scaling")) + ",\"name\":" + q(r.u() ? r.s() : null) + "}}";
  }

  // TextureClock.updateAnimation (bql.j) driven through a Minecraft double: the world's real getCelestialAngle(1.0F).
  static void clock() throws Exception {
    provider(false, 0);
    Class<?> bao = Class.forName("bao");
    Object mc = u.allocateInstance(bao);
    Object clientWorld = u.allocateInstance(CW.class);
    for (Field f : ahb.class.getDeclaredFields()) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      f.setAccessible(true);
      f.set(clientWorld, f.get(w));
    }
    fd(bao, "f").set(mc, clientWorld);
    fd(bao, "h").set(mc, u.allocateInstance(bjk.class));
    fd(bao, "M").set(null, mc);
    System.out.println("{\"case\":\"clockFacts\",\"surface\":" + ((aqo) fd(ahb.class, "t").get(w)).d() + "}");
    // 1) the settled frame for fixed world times, each from a fresh texture state; 2) a day at one tick per tick.
    long[] times = { 0, 3000, 6000, 9000, 12000, 15000, 18000, 21000, 23999 };
    for (long t : times) {
      bql clock = newClock();
      time(t);
      StringBuilder seq = new StringBuilder();
      double angle = ((ahb) clientWorld).c(1.0f);
      for (int i = 0; i < 400; i++) {
        tickClock(clock);
        if (i < 40 || i % 40 == 0 || i == 399) seq.append(seq.length() > 0 ? "," : "").append("[").append(i).append(",").append(fd(bqd.class, "g").getInt(clock)).append(",").append(num(fd(bql.class, "i").getDouble(clock))).append(",").append(num(fd(bql.class, "j").getDouble(clock))).append("]");
      }
      System.out.println("{\"case\":\"clockSettle\",\"time\":" + t + ",\"angle\":" + num(angle) + ",\"samples\":[" + seq + "]}");
    }
    bql clock = newClock();
    StringBuilder seq = new StringBuilder();
    for (long t = 0; t < 24000 + 3000; t++) {
      time(t % 24000);
      tickClock(clock);
      if (t % 50 == 0) seq.append(seq.length() > 0 ? "," : "").append("[").append(t).append(",").append(((ahb) clientWorld).c(1.0f)).append(",").append(fd(bqd.class, "g").getInt(clock)).append(",").append(num(fd(bql.class, "i").getDouble(clock))).append("]");
    }
    System.out.println("{\"case\":\"clockDay\",\"samples\":[" + seq + "]}");
    frameCounts(mc, clientWorld);
  }

  // TextureClock and TextureCompass index their frame list by size(): a strip of n frames (TextureAtlasSprite.framesTextureData) is
  // n frame positions. Drives the unchanged bql / bqm with lists of other lengths (what a resource pack's strip supplies).
  static bqm newCompass(int count) throws Exception {
    bqm compass = new bqm("compass");
    List frames = new ArrayList();
    for (int i = 0; i < count; i++) frames.add(new int[1][1]);
    fd(bqd.class, "a").set(compass, frames);
    fd(bqd.class, "g").setInt(compass, 0);
    return compass;
  }
  static void frameCounts(Object mc, Object clientWorld) throws Exception {
    int[] counts = { 1, 2, 5, 32, 64, 128 };
    long[] times = { 0, 4000, 9000, 14000, 20000 };
    for (int n : counts) for (long t : times) {
      bql clock = newClock(n);
      time(t);
      StringBuilder seq = new StringBuilder();
      for (int i = 0; i < 120; i++) {
        tickClock(clock);
        if (i < 12 || i % 20 == 0 || i == 119) seq.append(seq.length() > 0 ? "," : "").append("[").append(i).append(",").append(fd(bqd.class, "g").getInt(clock)).append(",").append(num(fd(bql.class, "i").getDouble(clock))).append("]");
      }
      System.out.println("{\"case\":\"clockFrames\",\"frames\":" + n + ",\"time\":" + t + ",\"samples\":[" + seq + "]}");
    }
    // Compass: spawn (sx, sz), the player at (px, pz) facing yaw; settling from a fresh state, then the direct set the item frame uses.
    Object player = fd(Class.forName("bao"), "h").get(mc);
    int[][] cases = { { 0, 0, 40, -25, 0 }, { 100, -60, -12, 33, 90 }, { -30, 80, 5, 5, 180 }, { 7, 7, 7, 7, 270 }, { 0, 0, 1000, 3, -45 }, { 20, -20, -300, 400, 725 } };
    for (int n : counts) for (int[] c : cases) {
      spawn(c[0], c[1]);
      fd(sa.class, "s").setDouble(player, c[2]); fd(sa.class, "u").setDouble(player, c[3]); fd(sa.class, "y").setFloat(player, c[4]);
      bqm compass = newCompass(n);
      StringBuilder seq = new StringBuilder();
      for (int i = 0; i < 100; i++) {
        try { compass.j(); } catch (Throwable e) { /* the GL upload after the frame index is stored */ }
        if (i < 10 || i % 15 == 0 || i == 99) seq.append(seq.length() > 0 ? "," : "").append("[").append(i).append(",").append(fd(bqd.class, "g").getInt(compass)).append(",").append(num(compass.i)).append(",").append(num(compass.j)).append("]");
      }
      // RenderItemFrame: i = j = 0, then a(world, x, z, wrapAngleTo180(180 + dir * 90), false, true) sets the angle without smoothing.
      StringBuilder direct = new StringBuilder();
      for (int dir = 0; dir < 4; dir++) {
        bqm k = newCompass(n);
        k.i = 0; k.j = 0;
        float yaw = qh.g((float) (180 + dir * 90));
        try { k.a((ahb) clientWorld, c[2], c[3], (double) yaw, false, true); } catch (Throwable e) { }
        direct.append(direct.length() > 0 ? "," : "").append("[").append(dir).append(",").append(fd(bqd.class, "g").getInt(k)).append(",").append(num(k.i)).append("]");
      }
      System.out.println("{\"case\":\"compassFrames\",\"frames\":" + n + ",\"spawn\":[" + c[0] + "," + c[1] + "],\"player\":[" + c[2] + "," + c[3] + "," + c[4] + "],\"samples\":[" + seq + "],\"frame\":[" + direct + "]}");
    }
    spawn(0, 0);
  }
  public static class CW extends bjf { CW() { super(null, null, 0, null, null); } }
  static bql newClock() throws Exception { return newClock(64); }
  static bql newClock(int count) throws Exception {
    bql clock = new bql("clock");
    List frames = new ArrayList();
    for (int i = 0; i < count; i++) frames.add(new int[1][1]);
    fd(bqd.class, "a").set(clock, frames);
    fd(bqd.class, "g").setInt(clock, 0);
    return clock;
  }
  static void tickClock(bql clock) {
    try { clock.j(); } catch (Throwable e) { /* the GL upload after the frame index is stored */ }
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    WitchProbe.u = u;
    w = (MW) u.allocateInstance(MW.class);
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    fd(ays.class, "g").setLong(info, 1);
    fd(ays.class, "x").set(info, new agy());
    fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    fd(ahb.class, "J").set(w, date);
    fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);

    colors();
    emptyMaps();
    autoCreate();
    scaling();
    update("overworld-scale0-offcentre", 0, 256, -256, 0, false, 300, -200, false, 32);
    update("overworld-scale0-origin-emptychunk", 0, 0, 0, 0, false, 3.5, -5.25, true, 32);
    update("overworld-scale1", 1, 0, 0, 0, false, 40.25, -33.5, false, 32);
    update("overworld-scale2", 2, 0, 0, 0, false, -100.5, 200.75, false, 32);
    update("overworld-scale3", 3, 1024, 0, 0, false, 1000, 100, false, 32);
    update("overworld-scale4", 4, 0, 0, 0, false, 500, -700, false, 32);
    update("nether-scale0", 0, 0, 0, -1, true, 3.5, -5.25, false, 32);
    update("nether-scale2", 2, 0, 0, -1, true, 50, 60, false, 32);
    decor();
    recipes();
    clock();
  }
}
