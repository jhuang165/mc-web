import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.math.BigInteger;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

// Block particles from the unchanged 1.7.10 client classes: EntityFX (bkm),
// EntityDiggingFX (bld), EntityBlockDustFX (blc), EffectRenderer (bkn: addEffect,
// updateEffects, addBlockDestroyEffects, addBlockHitEffects), RenderGlobal (bma:
// doSpawnParticle's blockcrack_/blockdust_ branches and playAuxSFX 2006) and
// Entity.onEntityUpdate's sprint particle (sa.C) on a constructor-less Entity
// subclass. The world double (a WorldClient subclass allocated without its
// constructor) holds stone below y 64 plus the cells each case adds; its
// getCollidingBoundingBoxes calls the original Block.addCollisionBoxesToList.
// RenderGlobal, Minecraft and GameSettings are allocated without constructors
// too; only the fields the particle paths read are set (Minecraft.renderViewEntity,
// effectRenderer, gameSettings.particleSetting = 0).
//
// Random streams: Math.random's generator is set to a known internal state
// before each case, EffectRenderer.rand / World.rand / Entity.rand of the
// sprinting entity are new Random(seed), and every particle's own Entity.rand
// (an unseeded new Random()) is read back after construction and rewound the
// four nextFloat calls of the EntityFX constructor, so the browser test can
// replay it. Positions are printed as doubles; float fields widened to double.
public class ParticleProbe {
  static final int[] AIR = {0, 0}, STONE = {1, 0};
  static final Map<Long, int[]> cells = new HashMap<>();
  static bma render;
  static List<String> calls = new ArrayList<>();

  static long key(int x, int y, int z) { return (((long) x + 1024) * 4096 + (z + 1024)) * 1024 + (y + 512); }
  static int[] cell(int x, int y, int z) {
    int[] c = cells.get(key(x, y, z));
    return c != null ? c : y < 64 ? STONE : AIR;
  }
  static void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }

  public static class PWorld extends bjf {
    PWorld() { super((bjb) null, (ahj) null, 0, (rd) null, (qi) null); } // never run: allocated without a constructor
    public aji a(int x, int y, int z) { return aji.e(cell(x, y, z)[0]); }
    public int e(int x, int y, int z) { return cell(x, y, z)[1]; }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public boolean a(azt box, awt material) { return false; }
    public boolean a(azt box, awt material, sa entity) { return false; }
    // World.getCollidingBoundingBoxes without the entity part (no entities here).
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      int x0 = qh.c(box.a), x1 = qh.c(box.d + 1.0), y0 = qh.c(box.b), y1 = qh.c(box.e + 1.0), z0 = qh.c(box.c), z1 = qh.c(box.f + 1.0);
      for (int x = x0; x < x1; x++)
        for (int z = z0; z < z1; z++)
          for (int y = y0 - 1; y < y1; y++) a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
    // World.spawnParticle -> RenderGlobal.spawnParticle (the only world access here).
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {
      calls.add("[\"" + name + "\"," + x + "," + y + "," + z + "," + vx + "," + vy + "," + vz + "]");
      render.b(name, x, y, z, vx, vy, vz);
    }
  }

  // An Entity with the abstract NBT/init hooks stubbed, for onEntityUpdate.
  public static class Runner extends sa {
    Runner() { super((ahb) null); }
    protected void c() {}
    protected void a(dh tag) {}
    protected void b(dh tag) {}
  }

  public static class Icon implements rf {
    final String name;
    Icon(String name) { this.name = name; }
    public int a() { return 16; }
    public int b() { return 16; }
    public float c() { return 0f; }
    public float d() { return 1f; }
    public float a(double d) { return (float) (d / 16.0); }
    public float e() { return 0f; }
    public float f() { return 1f; }
    public float b(double d) { return (float) (d / 16.0); }
    public String g() { return name; }
  }

  static sun.misc.Unsafe U;
  static Field seedField;
  static Random mathRandom;
  static final long MULT = 0x5DEECE66DL, MASK = (1L << 48) - 1;
  static final long INV = BigInteger.valueOf(MULT).modInverse(BigInteger.ONE.shiftLeft(48)).longValue();

  static long raw(Random r) throws Exception { return ((AtomicLong) seedField.get(r)).get(); }
  static void setRaw(Random r, long v) throws Exception { ((AtomicLong) seedField.get(r)).set(v); }
  static long back(long s, int n) { for (int i = 0; i < n; i++) s = ((s - 0xBL) * INV) & MASK; return s; }

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
  static double d(Object o, String name) throws Exception { return field(o.getClass(), name).getDouble(o); }
  static float fl(Object o, String name) throws Exception { return field(o.getClass(), name).getFloat(o); }
  static int i(Object o, String name) throws Exception { return field(o.getClass(), name).getInt(o); }
  static boolean b(Object o, String name) throws Exception { return field(o.getClass(), name).getBoolean(o); }

  static String box(azt b) { return "[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }

  static PWorld world;
  static bkn effects;

  @SuppressWarnings("unchecked")
  static List<bkm> layer() throws Exception { return ((List[]) get(effects, "c"))[1]; }

  static String spawn(bkm p) throws Exception {
    rf icon = (rf) get(p, "ax");
    return "{\"seed\":" + back(raw((Random) get(p, "Z")), 4)
      + ",\"x\":" + d(p, "s") + ",\"y\":" + d(p, "t") + ",\"z\":" + d(p, "u")
      + ",\"vx\":" + d(p, "v") + ",\"vy\":" + d(p, "w") + ",\"vz\":" + d(p, "x")
      + ",\"jx\":" + (double) fl(p, "d") + ",\"jy\":" + (double) fl(p, "e")
      + ",\"scale\":" + (double) fl(p, "h") + ",\"maxAge\":" + i(p, "g") + ",\"gravity\":" + (double) fl(p, "i")
      + ",\"rgb\":[" + (double) fl(p, "at") + "," + (double) fl(p, "au") + "," + (double) fl(p, "av") + "]"
      + ",\"icon\":\"" + (icon == null ? "" : icon.g()) + "\",\"width\":" + (double) fl(p, "M") + ",\"height\":" + (double) fl(p, "N")
      + ",\"yOffset\":" + (double) fl(p, "L") + ",\"box\":" + box((azt) get(p, "C")) + "}";
  }

  // Spawn with `action`, then run EffectRenderer.updateEffects until every new
  // particle is gone; each particle's track is [x, y, z, onGround] per tick.
  static String run(String name, Runnable action, int ticks) throws Exception {
    List<bkm> before = new ArrayList<>(layer());
    calls.clear();
    long math = raw(mathRandom);
    action.run();
    List<bkm> made = new ArrayList<>();
    for (bkm p : layer()) if (!before.contains(p)) made.add(p);
    StringBuilder out = new StringBuilder("{\"case\":\"" + name + "\",\"math\":" + math + ",\"calls\":" + calls + ",\"particles\":[");
    List<StringBuilder> tracks = new ArrayList<>();
    for (int k = 0; k < made.size(); k++) {
      out.append(k > 0 ? "," : "").append(spawn(made.get(k)));
      tracks.add(new StringBuilder());
    }
    out.append("],\"tracks\":[");
    for (int t = 0; t < ticks; t++) {
      boolean any = false;
      List<bkm> alive = layer();
      boolean[] was = new boolean[made.size()];
      for (int k = 0; k < made.size(); k++) was[k] = alive.contains(made.get(k));
      effects.a();
      for (int k = 0; k < made.size(); k++) {
        if (!was[k]) continue;
        bkm p = made.get(k);
        StringBuilder s = tracks.get(k);
        s.append(s.length() > 0 ? "," : "").append("[" + d(p, "s") + "," + d(p, "t") + "," + d(p, "u") + "," + (b(p, "D") ? 1 : 0) + "]");
        any = true;
      }
      if (!any) break;
    }
    for (int k = 0; k < tracks.size(); k++) out.append(k > 0 ? "," : "").append("[").append(tracks.get(k)).append("]");
    for (bkm p : made) layer().remove(p);
    return out.append("]}").toString();
  }

  interface Step { void run() throws Exception; }
  static Runnable wrap(Step s) { return () -> { try { s.run(); } catch (Exception e) { throw new RuntimeException(e); } }; }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    U = (sun.misc.Unsafe) uf.get(null);
    seedField = Random.class.getDeclaredField("seed");
    seedField.setAccessible(true);
    Math.random();
    Field holder = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
    holder.setAccessible(true);
    mathRandom = (Random) holder.get(null);

    aji.p();
    ((alt) aji.e(18)).b(true); // RenderGlobal.loadRenderers: fancy graphics leaves
    rg register = Icon::new;
    for (int id = 1; id < 4096; id++) {
      aji block = aji.e(id);
      if (block == null || block == aji.e(0)) continue;
      try { block.a(register); } catch (Throwable t) {}
    }

    // Block facts: [internal id, vanilla id, meta] for this build's blocks.
    int[][] blocks = {
      {1, 2, 0}, {2, 3, 0}, {3, 1, 0}, {4, 17, 0}, {5, 18, 0}, {5, 18, 4}, {6, 12, 0}, {7, 5, 0}, {8, 45, 0}, {9, 20, 0},
      {11, 7, 0}, {12, 4, 0}, {13, 58, 0}, {14, 61, 3}, {14, 62, 3}, {15, 16, 0}, {16, 15, 0}, {17, 56, 0}, {18, 14, 0},
      {20, 50, 5}, {21, 47, 0}, {22, 49, 0}, {23, 80, 0}, {24, 82, 0}, {25, 13, 0}, {26, 42, 0}, {27, 41, 0}, {28, 57, 0},
      {29, 60, 0}, {30, 60, 7}, {39, 31, 1}, {40, 172, 0}, {41, 54, 2}, {43, 37, 0}, {46, 78, 0}, {46, 78, 3}, {47, 79, 0},
      {48, 6, 0}, {48, 6, 8}, {51, 30, 0}, {52, 65, 3},
    };
    List<int[]> all = new ArrayList<>(Arrays.asList(blocks));
    for (int s = 0; s < 8; s++) all.add(new int[] {31 + s, 59, s});
    for (int m = 0; m < 16; m++) all.add(new int[] {19, 35, m});
    for (int m = 0; m < 9; m++) all.add(new int[] {44, 38, m});
    for (int m = 0; m < 8; m++) { all.add(new int[] {49, 141, m}); all.add(new int[] {50, 142, m}); }
    StringBuilder facts = new StringBuilder("{\"case\":\"blocks\",\"blocks\":[");
    for (int k = 0; k < all.size(); k++) {
      int[] r = all.get(k);
      aji block = aji.e(r[1]);
      facts.append(k > 0 ? "," : "").append("{\"id\":" + r[0] + ",\"mc\":" + r[1] + ",\"meta\":" + r[2]
        + ",\"gravity\":" + (double) block.I + ",\"icon\":\"" + block.a(0, r[2]).g() + "\",\"renderColor\":" + block.i(r[2])
        + ",\"bounds\":[" + block.x() + "," + block.z() + "," + block.B() + "," + block.y() + "," + block.A() + "," + block.C() + "]}");
    }
    System.out.println(facts.append("]}"));

    world = (PWorld) U.allocateInstance(PWorld.class);
    set(world, "s", new Random(5));
    set(world, "t", U.allocateInstance(aqq.class));
    set(world, "C", new qi());
    world.E = true;
    effects = new bkn(world, null);
    render = (bma) U.allocateInstance(bma.class);
    bao mc = (bao) U.allocateInstance(bao.class);
    bbj settings = (bbj) U.allocateInstance(bbj.class);
    mc.u = settings; // public fields: assigned directly, so reflection never resolves
    mc.k = effects;  // Minecraft's other field types (authlib, netty)
    sv viewer = (sv) U.allocateInstance(wo.class);
    mc.i = viewer;
    set(render, "A", mc);
    set(render, "r", world);
    Random effectRand = (Random) get(effects, "e");

    // addBlockDestroyEffects on a free-standing cell above the stone floor (the
    // block is already air when the particles move, as after setBlockToAir).
    final long M = 0x2545F4914F6CL;
    setRaw(mathRandom, M);
    System.out.println(run("destroy-stone", wrap(() -> effects.a(10, 64, 10, aji.e(1), 0)), 60));
    // Dirt in a pocket: stone above and at +x, cobwebs at +z and -x.
    put(20, 65, 20, 1, 0); put(21, 64, 20, 1, 0); put(21, 65, 20, 1, 0); put(20, 64, 21, 30, 0); put(19, 64, 20, 30, 0);
    System.out.println(run("destroy-pocket", wrap(() -> effects.a(20, 64, 20, aji.e(3), 0)), 60));
    System.out.println(run("destroy-wool", wrap(() -> effects.a(12, 64, 12, aji.e(35), 14)), 60));
    System.out.println(run("destroy-wheat", wrap(() -> effects.a(14, 64, 14, aji.e(59), 7)), 60));

    // addBlockHitEffects: a floating stone at (30,65,30), all six sides, four hits each.
    put(30, 65, 30, 1, 0);
    effectRand.setSeed(7);
    for (int side = 0; side < 6; side++) {
      final int s = side;
      System.out.println(run("hit-stone-" + side, wrap(() -> { for (int k = 0; k < 4; k++) effects.a(30, 65, 30, s); }), 60));
    }
    put(34, 64, 34, 60, 0);
    System.out.println(run("hit-farmland-1", wrap(() -> { for (int k = 0; k < 4; k++) effects.a(34, 64, 34, 1); }), 60));
    put(36, 64, 36, 59, 7);
    System.out.println(run("hit-wheat-2", wrap(() -> { for (int k = 0; k < 4; k++) effects.a(36, 64, 36, 2); }), 60));
    System.out.println(run("hit-air", wrap(() -> effects.a(38, 64, 38, 1)), 2));

    // Entity.onEntityUpdate while sprinting: one blockcrack per call, Entity.rand new Random(99).
    int[][] grounds = {{1, 0}, {2, 0}, {35, 14}, {18, 0}};
    for (int[] g : grounds) {
      put(40, 63, 40, g[0], g[1]);
      Runner e = (Runner) U.allocateInstance(Runner.class);
      set(e, "o", world);
      set(e, "Z", new Random(99));
      set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
      te watcher = new te(e);
      set(e, "af", watcher);
      watcher.a(0, Byte.valueOf((byte) 0));
      watcher.a(1, Short.valueOf((short) 300));
      set(e, "J", true);
      set(e, "M", 0.6f);
      set(e, "N", 1.8f);
      set(e, "L", 1.62f);
      Method pos = sa.class.getDeclaredMethod("b", double.class, double.class, double.class);
      pos.setAccessible(true);
      pos.invoke(e, 40.3, 64.0 + 1.62f, 40.7);
      set(e, "v", 0.28);
      set(e, "x", -0.11);
      e.c(true);
      set(viewer, "s", 40.3); set(viewer, "t", 65.62); set(viewer, "u", 40.7);
      System.out.println(run("sprint-" + g[0] + "-" + g[1], wrap(() -> { for (int k = 0; k < 3; k++) e.C(); }), 60));
    }
    // Too far from the view entity (more than 16 blocks): no particle, no Math.random draws.
    {
      Runner e = (Runner) U.allocateInstance(Runner.class);
      set(e, "o", world); set(e, "Z", new Random(99)); set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
      te watcher = new te(e); set(e, "af", watcher);
      watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
      set(e, "J", true); set(e, "M", 0.6f); set(e, "N", 1.8f); set(e, "L", 1.62f);
      Method pos = sa.class.getDeclaredMethod("b", double.class, double.class, double.class);
      pos.setAccessible(true);
      pos.invoke(e, 40.3, 64.0 + 1.62f, 40.7);
      e.c(true);
      set(viewer, "s", 60.0); set(viewer, "t", 65.62); set(viewer, "u", 40.7);
      long m0 = raw(mathRandom);
      System.out.println(run("sprint-far", wrap(() -> e.C()), 2));
      System.out.println("{\"case\":\"far-math\",\"before\":" + m0 + ",\"after\":" + raw(mathRandom) + "}");
    }

    // RenderGlobal.playAuxSFX(2006): landing dust from the block under the feet.
    set(viewer, "s", 50.5); set(viewer, "t", 65.62); set(viewer, "u", 50.5);
    put(50, 63, 50, 2, 0);
    for (int data : new int[] {1, 4, 12, 40}) {
      world.s = new Random(5);
      final int dd = data;
      System.out.println(run("dust-" + data, wrap(() -> render.a((yz) null, 2006, 50, 63, 50, dd)), data == 1 ? 60 : 0));
    }
    world.s = new Random(5);
    System.out.println(run("dust-air", wrap(() -> render.a((yz) null, 2006, 52, 70, 52, 4)), 0));
    adb.l(); // snowball item used by RenderGlobal snowballpoof
    // Original RenderGlobal filtering, including the pre-filter random draw and
    // large/huge explosion exceptions. No render method or GL call is executed.
    set(viewer, "s", 0.0); set(viewer, "t", 70.0); set(viewer, "u", 0.0);
    for (String kind : new String[] {"blockcrack_1_0", "blockdust_1_0", "smoke", "explode", "snowballpoof", "largeexplode", "hugeexplosion"})
      for (int setting = 0; setting < 3; setting++)
        for (double distance : new double[] {0.0, 16.0, 16.0001})
          for (int seed = 0; seed < 8; seed++) {
            settings.aJ = setting;
            world.s = new Random(seed);
            bkm result = render.b(kind, distance, 70, 0, 0, 0, 0);
            System.out.println("{\"case\":\"setting\",\"kind\":\"" + kind + "\",\"setting\":" + setting
              + ",\"distance\":" + distance + ",\"seed\":" + seed + ",\"accepted\":" + (result != null)
              + ",\"worldSeed\":\"" + raw(world.s) + "\"}");
          }

  }
}
