import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Random;

// Records 1.7.10 fire from the unchanged original classes:
//   table     BlockFire (alb) chanceToEncourageFire and abilityToCatchFire for every block id, plus the
//             Material flags the fire code reads: getCanBurn (awt.h), isReplaceable (awt.j),
//             blocksMovement (awt.c), isLiquid (awt.d), Block.lightOpacity (k) and light value (m), and
//             World.doesBlockHaveSolidTopSurface (ahb.a(ahl, x, y, z)) for meta 0.
//   ticks     BlockFire.updateTick (alb.a(ahb, x, y, z, Random)) on a World whose block, metadata, rain, biome
//             and difficulty are fixtures: the setBlock / setBlockToAir / setBlockMetadataWithNotify /
//             scheduleBlockUpdate calls it makes and the next value of its Random after each call.
//   place     BlockFire.canPlaceBlockAt (c), onNeighborBlockChange (a) and onBlockAdded (b).
//   lava      BlockStaticLiquid.updateTick (ant.a) for still lava: the fire it sets.
//   bolts     EntityLightningBolt (xh) construction and re-strike fire placement (server side), by
//             difficulty and the doFireTick game rule.
//   burning   World.isBoundingBoxBurning (ahb.e(azt)) over boxes and blocks.
//   render    RenderBlocks.renderBlockFire (blm.a(alb, x, y, z)) with the real Tessellator: the vertex
//             stream for fixture neighbourhoods.
// The World subclass keeps blocks in a map (World's constructor is bypassed with sun.misc.Unsafe); the
// fire block's own code, Block.registerBlocks and the static helpers are the original bytecode.
public class FireProbe {
  static sun.misc.Unsafe unsafe;

  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
      } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static Object get(Object o, String name) throws Exception { return field(o.getClass(), name).get(o); }

  static int key(int x, int y, int z) { return ((x + 64) & 0xff) << 16 | ((y + 64) & 0xff) << 8 | ((z + 64) & 0xff); }

  public static class W extends ahb {
    HashMap<Integer, int[]> cells; // fields are assigned in world(): initialisers do not run
    List<String> ops;
    int biome = 1;
    agy rules;
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); } // never run: allocated without a constructor

    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }

    int id(int x, int y, int z) { int[] c = cells.get(key(x, y, z)); return c == null ? 0 : c[0]; }
    void put(int x, int y, int z, int id, int meta) {
      if (id == 0) cells.remove(key(x, y, z)); else cells.put(key(x, y, z), new int[] {id, meta});
    }
    void rain(boolean on) { m = on ? 1f : 0f; n = on ? 1f : 0f; }
    List<int[]> fires() {
      List<int[]> out = new ArrayList<>();
      for (var e : cells.entrySet()) if (e.getValue()[0] == 51) {
        int k = e.getKey();
        out.add(new int[] {((k >> 16) & 0xff) - 64, ((k >> 8) & 0xff) - 64, (k & 0xff) - 64});
      }
      out.sort((a, b) -> a[0] != b[0] ? a[0] - b[0] : a[1] != b[1] ? a[1] - b[1] : a[2] - b[2]);
      return out;
    }

    public aji a(int x, int y, int z) { return aji.e(id(x, y, z)); }
    public int e(int x, int y, int z) { int[] c = cells.get(key(x, y, z)); return c == null ? 0 : c[1]; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      ops.add("s," + x + "," + y + "," + z + "," + aji.b(b) + "," + meta);
      put(x, y, z, aji.b(b), meta);
      return true;
    }
    public boolean b(int x, int y, int z, aji b) { return d(x, y, z, b, 0, 3); }
    public boolean f(int x, int y, int z) {
      ops.add("a," + x + "," + y + "," + z);
      cells.remove(key(x, y, z));
      return true;
    }
    public boolean a(int x, int y, int z, int meta, int flags) {
      ops.add("m," + x + "," + y + "," + z + "," + meta);
      int[] c = cells.get(key(x, y, z));
      if (c != null) c[1] = meta;
      return true;
    }
    public void a(int x, int y, int z, aji b, int delay) { ops.add("t," + x + "," + y + "," + z + "," + delay); }
    public boolean a(int x, int y, int z, int r) { return true; } // doChunksNearChunkExist
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; } // checkChunksExist
    // Chunk.canBlockSeeTheSky: no light-opaque block at or above y; Chunk.getPrecipitationHeight: one
    // above the topmost block that blocks movement or is a liquid.
    public boolean i(int x, int y, int z) {
      for (int yy = Math.max(y, 0); yy < 24; yy++) if (aji.e(id(x, yy, z)).k() != 0) return false;
      return true;
    }
    public int h(int x, int z) {
      for (int yy = 23; yy >= 0; yy--) {
        awt mat = aji.e(id(x, yy, z)).o();
        if (mat.c() || mat.d()) return yy + 1;
      }
      return -1;
    }
    public ahu a(int x, int z) { return ahu.d(biome); }
    public agy O() { return rules; }
    public int c(int x, int y, int z, int light) { return 0x00a000b0 + (light << 4); }
    public void a(double x, double y, double z, String sound, float volume, float pitch) {}
    public List a(Class c, azt box) { return new ArrayList(); }
    public List b(sa e, azt box) { return new ArrayList(); } // getEntitiesWithinAABBExcludingEntity
  }

  public static class ProbeBolt extends xh {
    static Random seeded;
    ProbeBolt(ahb w, double x, double y, double z) { super(w, x, y, z); }
    public void b(double x, double y, double z, float yaw, float pitch) { // first call in xh's constructor, before any draw
      try { if (seeded != null) set(this, "Z", seeded); } catch (Exception e) { throw new RuntimeException(e); }
      super.b(x, y, z, yaw, pitch);
    }
    public void C() {} // Entity.onEntityUpdate needs a populated world
  }

  static class Icon implements rf {
    final float u0, u1, v0, v1;
    Icon(float u0, float u1, float v0, float v1) { this.u0 = u0; this.u1 = u1; this.v0 = v0; this.v1 = v1; }
    public int a() { return 16; }
    public int b() { return 16; }
    public float c() { return u0; }
    public float d() { return u1; }
    public float a(double d) { return u0 + (u1 - u0) * (float) d / 16f; }
    public float e() { return v0; }
    public float f() { return v1; }
    public float b(double d) { return v0 + (v1 - v0) * (float) d / 16f; }
    public String g() { return "stub"; }
  }

  static W world(Random rand, int biome, boolean doFire, int difficulty, boolean raining) throws Exception {
    W w = (W) unsafe.allocateInstance(W.class);
    set(w, "t", unsafe.allocateInstance(aqq.class)); // WorldProviderSurface: dimensionId 0
    set(w, "s", rand);
    set(w, "r", rd.values()[difficulty]);
    w.cells = new HashMap<>();
    w.ops = new ArrayList<>();
    w.biome = biome;
    w.rules = new agy();
    w.rules.b("doFireTick", doFire ? "true" : "false");
    w.rain(raining);
    return w;
  }

  static final int[] PALETTE = {1, 3, 2, 5, 17, 18, 35, 47, 31, 37, 38, 20, 50, 58, 54, 45, 12, 13, 9, 11};
  static final int[] GROUND = {1, 3, 5, 35, 13, 18, 12, 2};

  // Random fixture around (4, 4, 4): a ground layer at y 3 with holes, scattered blocks in y 4..6.
  static int[] fixture(Random g, double density, boolean ground) {
    List<Integer> out = new ArrayList<>();
    for (int x = 1; x <= 7; x++)
      for (int z = 1; z <= 7; z++) {
        if (ground && g.nextInt(10) != 0) { out.add(x); out.add(3); out.add(z); out.add(GROUND[g.nextInt(GROUND.length)]); out.add(0); }
        for (int y = 4; y <= 6; y++)
          if (g.nextDouble() < density) { out.add(x); out.add(y); out.add(z); out.add(PALETTE[g.nextInt(PALETTE.length)]); out.add(0); }
      }
    return out.stream().mapToInt(i -> i).toArray();
  }
  static void load(W w, int[] flat) {
    for (int i = 0; i < flat.length; i += 5) w.put(flat[i], flat[i + 1], flat[i + 2], flat[i + 3], flat[i + 4]);
  }
  static String arr(int[] a) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < a.length; i++) s.append(i > 0 ? "," : "").append(a[i]);
    return s.append("]").toString();
  }
  static String strs(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append("\"").append(l.get(i)).append("\"");
    return s.append("]").toString();
  }
  static String num(float v) { return Float.toString(v); }

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    unsafe = (sun.misc.Unsafe) f.get(null);
    aji.p();
    alb.e(); // BlockFire.initFire: the setFireInfo table (Bootstrap calls it after registering blocks)
    alb fire = (alb) aji.e(51);
    aji lava = aji.e(11);
    StringBuilder out = new StringBuilder("{");

    // ---- table
    int[] enc = (int[]) get(fire, "a"), flam = (int[]) get(fire, "b");
    out.append("\"table\":[");
    W tw = world(new Random(1), 1, true, 2, false);
    boolean first = true;
    for (int id = 0; id < 256; id++) {
      aji b = aji.e(id);
      if (b == null || (id != 0 && b == aji.e(0))) continue;
      awt m = b.o();
      tw.cells.clear();
      tw.put(0, 5, 0, id, 0);
      int solid;
      try { solid = ahb.a((ahl) tw, 0, 5, 0) ? 1 : 0; } catch (Throwable t) { solid = -1; }
      out.append(first ? "" : ",").append("[").append(id).append(",").append(enc[id]).append(",").append(flam[id]).append(",").append(m.h() ? 1 : 0).append(",").append(m.j() ? 1 : 0)
        .append(",").append(m.c() ? 1 : 0).append(",").append(m.d() ? 1 : 0).append(",").append(b.k()).append(",").append(b.m()).append(",").append(solid).append("]");
      first = false;
    }
    out.append("]");

    // ---- ticks: BlockFire.updateTick on seeded fixtures; fires tick round-robin in (x, y, z) order
    out.append(",\"ticks\":[");
    int scenarios = 56;
    for (int sc = 0; sc < scenarios; sc++) {
      Random g = new Random(7000 + sc);
      Random rand = new Random(100 + sc);
      int difficulty = sc % 4, biome = sc % 5 == 0 ? 21 : 1;
      boolean raining = sc % 3 == 0, doFire = sc % 11 != 10;
      int[] cells = fixture(g, sc % 2 == 0 ? 0.18 : 0.35, sc % 7 != 6);
      W w = world(rand, biome, doFire, difficulty, raining);
      load(w, cells);
      List<Integer> fires = new ArrayList<>();
      int n = 1 + g.nextInt(3);
      for (int i = 0; i < n; i++) {
        int x = 2 + g.nextInt(5), z = 2 + g.nextInt(5), y = 4;
        int meta = g.nextBoolean() ? 0 : g.nextInt(16);
        w.put(x, y, z, 51, meta);
        fires.add(x); fires.add(y); fires.add(z); fires.add(51); fires.add(meta);
      }
      int[] start = new int[cells.length + fires.size()];
      System.arraycopy(cells, 0, start, 0, cells.length);
      for (int i = 0; i < fires.size(); i++) start[cells.length + i] = fires.get(i);
      // The fires overwrite cells of the fixture; the flat list is replayed in order, so later entries win.
      StringBuilder steps = new StringBuilder();
      for (int t = 0; t < 90; t++) {
        List<int[]> live = w.fires();
        if (live.isEmpty()) break;
        int[] at = live.get(t % live.size());
        w.ops.clear();
        fire.a(w, at[0], at[1], at[2], rand);
        steps.append(t > 0 ? "," : "").append("[").append(at[0]).append(",").append(at[1]).append(",").append(at[2]).append(",").append(strs(w.ops)).append(",").append(rand.nextInt(1000000)).append("]");
      }
      out.append(sc > 0 ? "," : "").append("{\"seed\":").append(100 + sc).append(",\"difficulty\":").append(difficulty).append(",\"biome\":").append(biome)
        .append(",\"raining\":").append(raining ? 1 : 0).append(",\"doFireTick\":").append(doFire ? 1 : 0).append(",\"cells\":").append(arr(start)).append(",\"steps\":[").append(steps).append("]}");
    }
    out.append("]");

    // ---- place: canPlaceBlockAt, onNeighborBlockChange, onBlockAdded
    out.append(",\"place\":[");
    for (int sc = 0; sc < 160; sc++) {
      Random g = new Random(9000 + sc);
      int[] cells = new int[0];
      List<Integer> l = new ArrayList<>();
      int[] around = {0, 1, 5, 35, 18, 31, 9, 20, 17, 3};
      int[][] d6 = {{1, 0, 0}, {-1, 0, 0}, {0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}};
      for (int[] d : d6) {
        int id = around[g.nextInt(around.length)];
        // every other fixture has nothing flammable around it and often no solid floor: the support and burn-out cases
        if (sc % 2 == 0) id = new int[] {0, 0, 3, 9, 20, 1}[g.nextInt(6)];
        if (id != 0) { l.add(4 + d[0]); l.add(4 + d[1]); l.add(4 + d[2]); l.add(id); l.add(0); }
      }
      l.add(4); l.add(4); l.add(4); l.add(51); l.add(0);
      cells = l.stream().mapToInt(i -> i).toArray();
      boolean raining = sc % 2 == 0;
      W w = world(new Random(50 + sc), 1, true, 2, raining);
      load(w, cells);
      boolean can = fire.c(w, 4, 4, 4);
      w.ops.clear();
      fire.a(w, 4, 4, 4, aji.e(1));
      List<String> neighbour = new ArrayList<>(w.ops);
      W w2 = world(new Random(50 + sc), 1, true, 2, raining);
      load(w2, cells);
      fire.b(w2, 4, 4, 4);
      out.append(sc > 0 ? "," : "").append("{\"seed\":").append(50 + sc).append(",\"cells\":").append(arr(cells)).append(",\"can\":").append(can ? 1 : 0)
        .append(",\"neighbour\":").append(strs(neighbour)).append(",\"added\":").append(strs(w2.ops)).append(",\"next\":").append(w2.s.nextInt(1000000)).append("}");
    }
    out.append("]");

    // ---- lava: BlockStaticLiquid.updateTick (still lava), 24 ticks per fixture
    out.append(",\"lava\":[");
    for (int sc = 0; sc < 72; sc++) {
      Random g = new Random(11000 + sc);
      Random rand = new Random(300 + sc);
      int[] cells = fixture(g, 0.3, true);
      List<Integer> l = new ArrayList<>();
      for (int v : cells) l.add(v);
      int ly = 4, lx = 4, lz = 4;
      l.add(lx); l.add(ly); l.add(lz); l.add(11); l.add(0);
      int[] all = l.stream().mapToInt(i -> i).toArray();
      W w = world(rand, 1, true, 2, false);
      load(w, all);
      StringBuilder steps = new StringBuilder();
      for (int t = 0; t < 24; t++) {
        w.ops.clear();
        lava.a(w, lx, ly, lz, rand);
        steps.append(t > 0 ? "," : "").append("[").append(strs(w.ops)).append(",").append(rand.nextInt(1000000)).append("]");
      }
      out.append(sc > 0 ? "," : "").append("{\"seed\":").append(300 + sc).append(",\"cells\":").append(arr(all)).append(",\"steps\":[").append(steps).append("]}");
    }
    out.append("]");

    // ---- bolts: construction and re-strike fire placement
    out.append(",\"bolts\":[");
    for (int sc = 0; sc < 96; sc++) {
      Random g = new Random(13000 + sc);
      int difficulty = sc % 4;
      boolean doFire = sc % 7 != 3;
      int[] cells = fixture(g, 0.12, true);
      W w = world(new Random(1), 1, doFire, difficulty, true);
      load(w, cells);
      double bx = 3 + g.nextInt(3) + g.nextDouble(), by = 4 + g.nextDouble(), bz = 3 + g.nextInt(3) + g.nextDouble();
      long seed = 500 + sc;
      ProbeBolt.seeded = new Random(seed);
      ProbeBolt bolt = new ProbeBolt(w, bx, by, bz);
      ProbeBolt.seeded = null;
      StringBuilder ticks = new StringBuilder();
      List<String> ctor = new ArrayList<>(w.ops);
      long vertex = bolt.a;
      int living0 = (Integer) get(bolt, "c");
      w.ops.clear();
      for (int t = 0; t < 40 && !bolt.K; t++) {
        w.ops.clear();
        bolt.h();
        ticks.append(t > 0 ? "," : "").append("{\"state\":").append(get(bolt, "b")).append(",\"living\":").append(get(bolt, "c")).append(",\"vertex\":\"").append(bolt.a).append("\",\"dead\":").append(bolt.K).append(",\"ops\":").append(strs(w.ops)).append("}");
      }
      out.append(sc > 0 ? "," : "").append("{\"seed\":").append(seed).append(",\"difficulty\":").append(difficulty).append(",\"doFireTick\":").append(doFire ? 1 : 0)
        .append(",\"pos\":[").append(bx).append(",").append(by).append(",").append(bz).append("],\"cells\":").append(arr(cells)).append(",\"vertex\":\"").append(vertex).append("\",\"living\":").append(living0)
        .append(",\"ctor\":").append(strs(ctor)).append(",\"ticks\":[").append(ticks).append("]}");
    }
    out.append("]");

    // ---- burning: World.isBoundingBoxBurning
    out.append(",\"burning\":[");
    {
      Random g = new Random(15000);
      W w = world(new Random(1), 1, true, 2, false);
      int[] ids = {0, 0, 0, 1, 51, 51, 10, 11, 5, 9};
      for (int sc = 0; sc < 6; sc++) {
        w.cells.clear();
        List<Integer> l = new ArrayList<>();
        for (int x = 0; x < 9; x++) for (int y = 0; y < 9; y++) for (int z = 0; z < 9; z++) {
          int id = g.nextInt(7) == 0 ? ids[g.nextInt(ids.length)] : 0;
          if (id != 0) { l.add(x); l.add(y); l.add(z); l.add(id); l.add(0); }
        }
        int[] cells = l.stream().mapToInt(i -> i).toArray();
        load(w, cells);
        StringBuilder boxes = new StringBuilder();
        for (int i = 0; i < 160; i++) {
          double x0 = g.nextDouble() * 8, y0 = g.nextDouble() * 8, z0 = g.nextDouble() * 8;
          double dx = 0.1 + g.nextDouble() * 1.5, dy = 0.1 + g.nextDouble() * 2, dz = 0.1 + g.nextDouble() * 1.5;
          if (i % 5 == 0) { x0 = Math.floor(x0); y0 = Math.floor(y0); z0 = Math.floor(z0); dx = 1; dy = 1; dz = 1; }
          azt box = azt.a(x0, y0, z0, x0 + dx, y0 + dy, z0 + dz).e(0.001, 0.001, 0.001);
          boxes.append(i > 0 ? "," : "").append("[").append(x0).append(",").append(y0).append(",").append(z0).append(",").append(x0 + dx).append(",").append(y0 + dy).append(",").append(z0 + dz).append(",").append(w.e(box) ? 1 : 0).append("]");
        }
        out.append(sc > 0 ? "," : "").append("{\"cells\":").append(arr(cells)).append(",\"boxes\":[").append(boxes).append("]}");
      }
    }
    out.append("]");

    // ---- render: renderBlockFire's vertex stream with the real Tessellator
    out.append(",\"render\":{\"icons\":[[0.125,0.25,0.5,0.75],[0.375,0.5,0.0,0.25]],\"fixtures\":[");
    {
      Icon i0 = new Icon(0.125f, 0.25f, 0.5f, 0.75f), i1 = new Icon(0.375f, 0.5f, 0.0f, 0.25f);
      set(fire, "M", new rf[] {i0, i1});
      Random g = new Random(17000);
      bmh t = bmh.a;
      int[] around = {0, 0, 1, 5, 35, 18, 31, 17};
      int[][] d6 = {{-1, 0, 0}, {1, 0, 0}, {0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}};
      for (int sc = 0; sc < 256; sc++) {
        int fx = -6 + g.nextInt(19), fy = 2 + g.nextInt(8), fz = -6 + g.nextInt(19);
        List<Integer> l = new ArrayList<>();
        for (int[] d : d6) {
          int id = around[g.nextInt(around.length)];
          if (d[1] == -1 && sc % 2 == 1) id = 0; // half the fixtures have nothing below: side flames
          if (id != 0) { l.add(fx + d[0]); l.add(fy + d[1]); l.add(fz + d[2]); l.add(id); l.add(0); }
        }
        l.add(fx); l.add(fy); l.add(fz); l.add(51); l.add(0);
        int[] cells = l.stream().mapToInt(i -> i).toArray();
        W w = world(new Random(1), 1, true, 2, false);
        load(w, cells);
        blm rb = (blm) unsafe.allocateInstance(blm.class); // blm's constructor needs LWJGL
        set(rb, "a", w);
        set(t, "x", false);
        t.b(); // startDrawingQuads
        rb.a(fire, fx, fy, fz);
        int[] raw = (int[]) get(t, "f");
        int count = (Integer) get(t, "q");
        StringBuilder vs = new StringBuilder();
        for (int i = 0; i < count; i++) {
          int o = i * 8;
          vs.append(i > 0 ? "," : "").append("[").append(num(Float.intBitsToFloat(raw[o]))).append(",").append(num(Float.intBitsToFloat(raw[o + 1]))).append(",").append(num(Float.intBitsToFloat(raw[o + 2])))
            .append(",").append(num(Float.intBitsToFloat(raw[o + 3]))).append(",").append(num(Float.intBitsToFloat(raw[o + 4]))).append(",").append(raw[o + 7]).append("]");
        }
        Method reset = bmh.class.getDeclaredMethod("d");
        reset.setAccessible(true);
        reset.invoke(t);
        set(t, "x", false);
        out.append(sc > 0 ? "," : "").append("{\"at\":[").append(fx).append(",").append(fy).append(",").append(fz).append("],\"cells\":").append(arr(cells)).append(",\"vertices\":[").append(vs).append("]}");
      }
    }
    out.append("]}");

    System.out.println(out.append("}"));
  }
}
