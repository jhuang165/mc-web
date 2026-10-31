import java.util.*;

// Runs the unchanged 1.7.10 Explosion (agw), EntityCreeper (xz), EntityAICreeperSwell (vi),
// EntityTNTPrimed (xw), BlockTNT (aob), Block.dropBlockAsItemWithChance (aji) and
// ModelCreeper (bhj) classes on a world double. The world (a subclass of World, ahb)
// stores blocks in a map, captures spawned entities and sounds, and runs newExplosion like
// WorldServer: doExplosionA then doExplosionB(false) (no client particles, so no extra
// world.rand calls). No game class is patched. One JSON object per line; see
// tools/verify-creepers.mjs and public/research/creepers.md for the record list.
public class CreeperProbe {
  static class World extends MobMoveProbe.ProbeWorld {
    static Map<Long, int[]> blocks = new HashMap<>();
    static List<String> sounds = new ArrayList<>();
    static List<Object> spawned = new ArrayList<>();
    static List<sa> entities = new ArrayList<>();
    static List<double[]> explosions = new ArrayList<>();
    static boolean runExplosions = true;
    static boolean floor = true; // stone below y = 0 outside the fixture
    static long key(int x, int y, int z) { return ((long) x & 0xfffff) | (((long) y & 0xfff) << 20) | (((long) z & 0xfffff) << 32); }
    public aji a(int x, int y, int z) {
      int[] b = blocks.get(key(x, y, z));
      if (b != null) return aji.e(b[0]);
      return floor && y < 0 ? aji.e(1) : aji.e(0);
    }
    public int e(int x, int y, int z) { int[] b = blocks.get(key(x, y, z)); return b == null ? 0 : b[1]; }
    public boolean d(int x, int y, int z, aji block, int meta, int flags) {
      int id = aji.b(block);
      if (id == 0) blocks.put(key(x, y, z), new int[] {0, 0}); else blocks.put(key(x, y, z), new int[] {id, meta});
      return true;
    }
    public boolean b(int x, int y, int z, aji block) { return d(x, y, z, block, 0, 3); }
    public boolean f(int x, int y, int z) { return d(x, y, z, aji.e(0), 0, 3); }
    public boolean c(int x, int y, int z) { return a(x, y, z).o() == awt.a; }
    public boolean v(int x, int y, int z) { return false; } // no redstone power
    public float n(int x, int y, int z) { return 0f; } // getLightBrightness: dark, so EntityMob ages normally
    public int k(int x, int y, int z) { return 0; }
    public agy O() { return new agy(); }
    public boolean d(sa entity) { spawned.add(entity); return true; }
    public void a(sa entity, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public void a(double x, double y, double z, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {}
    public void a(sa entity, byte state) {}
    public List b(sa except, azt box) {
      List<sa> out = new ArrayList<>();
      for (sa e : entities) if (e != except && e.C.b(box)) out.add(e);
      return out;
    }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
    public List a(sa entity, azt box) {
      List out = new ArrayList();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
          for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
            a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
    public agw a(sa entity, double x, double y, double z, float size, boolean flaming, boolean smoking) {
      explosions.add(new double[] {x, y, z, size, flaming ? 1 : 0, smoking ? 1 : 0});
      agw ex = new agw(this, entity, x, y, z, size);
      ex.a = flaming;
      ex.b = smoking;
      if (runExplosions) { ex.a(); ex.a(false); }
      return ex;
    }
  }

  // Palette of original block ids/metadata for the fixture and the drop tables (every
  // block the browser game implements, except chests/furnaces' contents).
  static int[][] PALETTE = {
    {1, 0}, {2, 0}, {3, 0}, {4, 0}, {5, 0}, {6, 0}, {7, 0}, {12, 0}, {13, 0}, {14, 0}, {15, 0}, {16, 0}, {17, 0}, {18, 0},
    {20, 0}, {30, 0}, {31, 1}, {35, 0}, {35, 14}, {37, 0}, {38, 0}, {38, 5}, {41, 0}, {42, 0}, {45, 0}, {46, 0}, {47, 0}, {49, 0},
    {50, 5}, {51, 0}, {54, 2}, {56, 0}, {57, 0}, {58, 0}, {59, 0}, {59, 3}, {59, 7}, {60, 0}, {60, 7}, {61, 2}, {65, 3}, {78, 0},
    {78, 3}, {79, 0}, {80, 0}, {82, 0}, {141, 0}, {141, 7}, {142, 0}, {142, 7}, {172, 0}, {9, 0}, {11, 0},
  };

  // Small java.util.Random seeds give nearly equal first floats; spread them.
  static long mix(int seed) { return seed * 0x9E3779B97F4A7C15L + 0x2545F4914F6CDD1DL; }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  // Fixture: 24 x 9 x 24 at x, z in [-12, 12), y in [0, 9). Bedrock at y = 0, stone with
  // ores/gravel at 1-2, dirt at 3, grass at 4, then a seeded scatter of palette blocks in
  // y 5-8 (40% fill), including TNT, so chained priming and drops are exercised.
  static List<int[]> fixture() {
    List<int[]> out = new ArrayList<>();
    Random r = new Random(1234);
    int[] under = {1, 1, 1, 1, 1, 1, 13, 16, 15, 14, 56};
    for (int x = -12; x < 12; x++) for (int z = -12; z < 12; z++) {
      out.add(new int[] {x, 0, z, 7, 0});
      for (int y = 1; y <= 2; y++) out.add(new int[] {x, y, z, under[r.nextInt(under.length)], 0});
      out.add(new int[] {x, 3, z, 3, 0});
      out.add(new int[] {x, 4, z, r.nextInt(6) == 0 ? 60 : 2, 0});
      for (int y = 5; y < 9; y++) {
        if (r.nextInt(10) >= 4) continue;
        int[] p = PALETTE[r.nextInt(PALETTE.length - 2)];
        out.add(new int[] {x, y, z, p[0], p[1]});
      }
    }
    return out;
  }

  static void load(List<int[]> fixture) {
    World.blocks.clear();
    for (int[] b : fixture) World.blocks.put(World.key(b[0], b[1], b[2]), new int[] {b[3], b[4]});
  }

  static String spawnedJson() {
    StringBuilder items = new StringBuilder(), tnt = new StringBuilder(), xp = new StringBuilder();
    for (Object o : World.spawned) {
      if (o instanceof xk) {
        add s = ((xk) o).f();
        if (items.length() > 0) items.append(',');
        items.append('[').append(adb.b(s.b())).append(',').append(s.k()).append(',').append(s.b)
          .append(',').append(num(((sa) o).s)).append(',').append(num(((sa) o).t)).append(',').append(num(((sa) o).u)).append(']');
      } else if (o instanceof xw) {
        xw t = (xw) o;
        if (tnt.length() > 0) tnt.append(',');
        tnt.append('[').append(num(t.s)).append(',').append(num(t.t)).append(',').append(num(t.u)).append(',').append(t.a).append(']');
      } else if (o instanceof sq) {
        if (xp.length() > 0) xp.append(',');
        xp.append(((sq) o).e());
      }
    }
    return "\"items\":[" + items + "],\"tnt\":[" + tnt + "],\"xp\":[" + xp + "]";
  }

  static void reset(ahb w) {
    World.sounds.clear(); World.spawned.clear(); World.entities.clear(); World.explosions.clear();
    World.runExplosions = true; World.floor = true; MobMoveProbe.step = 0;
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    World w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    Random rand = new Random(0);
    MobMoveProbe.set(w, "s", rand);

    // facts
    xz base = new xz(w);
    xw baseTnt = new xw(w);
    System.out.println("{\"case\":\"facts\",\"creeper\":{\"width\":" + base.M + ",\"height\":" + base.N + ",\"yOffset\":" + base.L
      + ",\"eye\":" + base.g() + ",\"health\":" + base.a(yj.a).e() + ",\"speed\":" + base.a(yj.d).e() + ",\"follow\":" + base.a(yj.b).e()
      + ",\"fuse\":" + MobMoveProbe.field(xz.class, "br").getInt(base) + ",\"radius\":" + MobMoveProbe.field(xz.class, "bs").getInt(base)
      + ",\"safeTries\":" + base.ax() + ",\"ambient\":" + (MobMoveProbe.method(sw.class, "t").invoke(base) == null) + ",\"hurt\":\""
      + MobMoveProbe.method(xz.class, "aT").invoke(base) + "\",\"death\":\"" + MobMoveProbe.method(xz.class, "aU").invoke(base) + "\"},\"tnt\":{\"width\":"
      + baseTnt.M + ",\"height\":" + baseTnt.N + ",\"yOffset\":" + baseTnt.L + ",\"fuse\":" + baseTnt.a + ",\"eye\":" + baseTnt.g()
      + ",\"step\":" + baseTnt.W + "}}");

    // blocks: explosion resistance (getExplosionResistance(null)), canDropFromExplosion,
    // material air and the isNormalCube test used for fire placement.
    for (int[] p : PALETTE) {
      aji b = aji.e(p[0]);
      System.out.println("{\"case\":\"block\",\"mc\":" + p[0] + ",\"meta\":" + p[1] + ",\"resistance\":" + num(b.a((sa) null))
        + ",\"drops\":" + b.a((agw) null) + ",\"air\":" + (b.o() == awt.a) + ",\"opaqueCube\":" + b.j() + "}");
    }
    {
      aji b = aji.e(0);
      System.out.println("{\"case\":\"block\",\"mc\":0,\"meta\":0,\"resistance\":" + num(b.a((sa) null)) + ",\"drops\":" + b.a((agw) null) + ",\"air\":true,\"opaqueCube\":" + b.j() + "}");
    }

    List<int[]> fixture = fixture();
    StringBuilder fx = new StringBuilder();
    for (int[] b : fixture) { if (fx.length() > 0) fx.append(','); fx.append(b[0]).append(',').append(b[1]).append(',').append(b[2]).append(',').append(b[3]).append(',').append(b[4]); }
    System.out.println("{\"case\":\"fixture\",\"blocks\":[" + fx + "]}");

    // explosions on the fixture: affected list order (HashSet), sound, block results, drops
    double[][] centres = { {0.5, 5.5, 0.5}, {-3.2, 6.01, 4.7}, {5.5, 4.5, -5.5}, {0.0, 9.0, 0.0}, {7.3, 7.9, 2.2}, {-6.5, 3.5, -6.5} };
    float[] sizes = {3f, 4f, 6f, 1f};
    int caseNo = 0;
    for (double[] c : centres) for (float size : sizes) for (int seed = 0; seed < 2; seed++) {
      reset(w); load(fixture); rand.setSeed(mix(seed));
      // flaming explosions (as the Ghast fireball) for one size: exercises the explosion Random
      boolean flaming = size == 1f;
      agw ex = new agw(w, null, c[0], c[1], c[2], size);
      ex.a = flaming; ex.b = true;
      ex.a();
      StringBuilder list = new StringBuilder();
      for (Object o : ex.h) { agt p = (agt) o; if (list.length() > 0) list.append(','); list.append(p.a).append(',').append(p.b).append(',').append(p.c); }
      long before = rand.nextLong(); rand.setSeed(mix(seed)); ex = new agw(w, null, c[0], c[1], c[2], size); ex.a = flaming; ex.b = true; ex.a();
      ex.a(false);
      StringBuilder changed = new StringBuilder();
      Map<Long, int[]> original = new HashMap<>();
      for (int[] b : fixture) original.put(World.key(b[0], b[1], b[2]), new int[] {b[3], b[4]});
      List<Long> keys = new ArrayList<>(World.blocks.keySet()); Collections.sort(keys);
      int removed = 0, fire = 0;
      for (long k : keys) {
        int[] now = World.blocks.get(k), was = original.get(k);
        if (was == null) was = new int[] {0, 0};
        if (now[0] != was[0]) { if (now[0] == 0) removed++; else if (now[0] == 51) fire++; }
      }
      // decode fire positions for flaming explosions
      StringBuilder fires = new StringBuilder();
      for (Object o : ex.h) { agt p = (agt) o; int[] now = World.blocks.get(World.key(p.a, p.b, p.c)); if (now != null && now[0] == 51) { if (fires.length() > 0) fires.append(','); fires.append(p.a).append(',').append(p.b).append(',').append(p.c); } }
      System.out.println("{\"case\":\"explode\",\"id\":" + (caseNo++) + ",\"x\":" + num(c[0]) + ",\"y\":" + num(c[1]) + ",\"z\":" + num(c[2]) + ",\"size\":" + num(size)
        + ",\"seed\":" + seed + ",\"flaming\":" + flaming + ",\"list\":[" + list + "],\"afterRays\":\"" + before + "\",\"sounds\":" + json(World.sounds)
        + ",\"removed\":" + removed + ",\"fires\":[" + fires + "]," + spawnedJson() + ",\"next\":\"" + rand.nextLong() + "\"}");
    }

    // density and damage: creeper targets at offsets from an explosion in the fixture;
    // exploder none / creeper / primed TNT (with and without a placer).
    double[][] targets = { {0.0, 0.0, 0.0}, {1.5, 0.0, 0.0}, {0.0, 0.0, 2.5}, {-3.1, 0.0, 1.0}, {2.0, 1.0, -2.0}, {4.6, 0.0, 0.3}, {0.2, 0.0, -6.5}, {7.0, 0.0, 7.0} };
    String[] exploders = {"none", "creeper", "tnt"};
    for (double[] c : new double[][] { {0.5, 9.0, 0.5}, {2.5, 6.0, -1.5} }) for (float size : new float[] {3f, 4f, 6f}) for (String kind : exploders) {
      reset(w); load(fixture); rand.setSeed(7);
      xz creeper = new xz(w); ChickenProbe.clearTasks(creeper); creeper.b(c[0], c[1], c[2]);
      MobMoveProbe.set(creeper, "Z", new Random(3));
      xw tnt = new xw(w, c[0], c[1], c[2], creeper);
      sa exploder = kind.equals("none") ? null : kind.equals("creeper") ? creeper : tnt;
      List<xz> mobs = new ArrayList<>();
      for (double[] t : targets) {
        xz m = new xz(w); ChickenProbe.clearTasks(m); MobMoveProbe.set(m, "Z", new Random(11));
        m.b(c[0] + t[0], Math.floor(c[1]) + t[1], c[2] + t[2]);
        m.v = 0.01; m.w = -0.0784000015258789; m.x = 0;
        mobs.add(m); World.entities.add(m);
      }
      StringBuilder rows = new StringBuilder();
      double[] dens = new double[mobs.size()];
      for (int i = 0; i < mobs.size(); i++) dens[i] = w.a(azw.a(c[0], c[1], c[2]), mobs.get(i).C);
      agw ex = new agw(w, exploder, c[0], c[1], c[2], size); ex.b = true;
      ex.a();
      for (int i = 0; i < mobs.size(); i++) {
        xz m = mobs.get(i);
        if (rows.length() > 0) rows.append(',');
        rows.append("{\"x\":" + num(m.s) + ",\"y\":" + num(m.t) + ",\"z\":" + num(m.u) + ",\"density\":" + num(dens[i]) + ",\"health\":" + num(m.aS())
          + ",\"vx\":" + num(m.v) + ",\"vy\":" + num(m.w) + ",\"vz\":" + num(m.x) + "}");
      }
      System.out.println("{\"case\":\"damage\",\"x\":" + num(c[0]) + ",\"y\":" + num(c[1]) + ",\"z\":" + num(c[2]) + ",\"size\":" + num(size) + ",\"exploder\":\"" + kind
        + "\",\"targets\":[" + rows + "]}");
    }

    // fuse: EntityCreeper.onUpdate (xz.h) with all AI removed, on a stone floor
    for (String scenario : new String[] {"ignite", "swell", "swell-release", "powered", "dead"}) {
      reset(w); World.blocks.clear(); World.runExplosions = false;
      xz e = new xz(w); ChickenProbe.clearTasks(e); e.b(0.5, 0.0, 0.5); MobMoveProbe.set(e, "Z", new Random(5));
      if (scenario.equals("ignite") || scenario.equals("dead")) e.cd();
      if (scenario.equals("powered")) { e.af.b(17, Byte.valueOf((byte) 1)); e.cd(); }
      StringBuilder rows = new StringBuilder();
      int explodedAt = -1;
      for (int i = 0; i < 45 && explodedAt < 0; i++) {
        if (scenario.startsWith("swell")) e.a(scenario.equals("swell-release") && i >= 12 ? -1 : 1);
        if (scenario.equals("dead") && i == 10) e.g(0f); // setHealth: isEntityAlive (K()) false from here
        World.sounds.clear();
        e.h();
        if (!World.explosions.isEmpty()) explodedAt = i;
        if (rows.length() > 0) rows.append(',');
        rows.append("{\"state\":" + e.cb() + ",\"t\":" + MobMoveProbe.field(xz.class, "bq").getInt(e) + ",\"last\":" + MobMoveProbe.field(xz.class, "bp").getInt(e)
          + ",\"flash0\":" + num(e.a(0f)) + ",\"flash5\":" + num(e.a(0.5f)) + ",\"sounds\":" + json(World.sounds) + ",\"dead\":" + e.K + "}");
      }
      String ex = World.explosions.isEmpty() ? "null" : "[" + num(World.explosions.get(0)[0]) + "," + num(World.explosions.get(0)[1]) + "," + num(World.explosions.get(0)[2]) + "," + num(World.explosions.get(0)[3]) + "," + (World.explosions.get(0)[5] > 0) + "]";
      System.out.println("{\"case\":\"fuse\",\"scenario\":\"" + scenario + "\",\"y\":" + num(e.t) + ",\"explodedAt\":" + explodedAt + ",\"explosion\":" + ex + ",\"ticks\":[" + rows + "]}");
    }

    // fall: EntityCreeper.fall (xz.b(F)) advancing timeSinceIgnited
    for (int start : new int[] {0, 10, 20, 24, 25, 29}) for (float dist : new float[] {0f, 1f, 2.5f, 3.4f, 7f, 20f}) {
      xz e = new xz(w); MobMoveProbe.field(xz.class, "bq").setInt(e, start);
      MobMoveProbe.method(xz.class, "b", float.class).invoke(e, dist);
      System.out.println("{\"case\":\"fall\",\"start\":" + start + ",\"distance\":" + num(dist) + ",\"t\":" + MobMoveProbe.field(xz.class, "bq").getInt(e) + "}");
    }

    // swell AI (EntityAICreeperSwell): shouldExecute / startExecuting / updateTask
    for (double d : new double[] {1.0, 2.9, 3.0, 3.1, 6.9, 7.0, 7.1, 9.0}) for (int wall = 0; wall < 2; wall++) for (int state = -1; state <= 1; state += 2) {
      reset(w); World.blocks.clear();
      if (wall == 1) for (int y = 0; y < 4; y++) for (int x = -3; x <= 3; x++) World.blocks.put(World.key(x, y, 0), new int[] {1, 0});
      xz e = new xz(w); ChickenProbe.clearTasks(e); e.b(0.5, 0.0, -0.5 - d / 2);
      xz t = new xz(w); ChickenProbe.clearTasks(t); t.b(0.5, 0.0, -0.5 + d / 2);
      e.d(t); e.a(state);
      vi ai = new vi(e);
      boolean should = ai.a();
      int after = e.cb();
      if (should) { ai.c(); ai.e(); after = e.cb(); }
      System.out.println("{\"case\":\"swell\",\"distance\":" + num(d) + ",\"wall\":" + (wall == 1) + ",\"state\":" + state + ",\"should\":" + should + ",\"after\":" + after + "}");
    }
    { reset(w); World.blocks.clear(); xz e = new xz(w); e.a(-1); vi ai = new vi(e); System.out.println("{\"case\":\"swell\",\"distance\":null,\"wall\":false,\"state\":-1,\"should\":" + ai.a() + ",\"after\":" + e.cb() + "}"); }
    { reset(w); World.blocks.clear(); xz e = new xz(w); e.a(1); vi ai = new vi(e); boolean s = ai.a(); ai.c(); ai.e(); System.out.println("{\"case\":\"swell\",\"distance\":null,\"wall\":false,\"state\":1,\"should\":" + s + ",\"after\":" + e.cb() + "}"); }

    // TNT motion: EntityTNTPrimed.onUpdate (xw.h) until it explodes (createExplosion at posY)
    double[][] starts = { {0.5, 0.5, 0.5}, {3.5, 4.5, -2.5}, {0.5, 0.5, 0.5} };
    for (int s = 0; s < starts.length; s++) {
      reset(w); World.blocks.clear(); World.runExplosions = false;
      if (s == 2) { World.blocks.put(World.key(1, 0, 0), new int[] {1, 0}); World.blocks.put(World.key(0, 0, 1), new int[] {1, 0}); }
      xw t = new xw(w, starts[s][0], starts[s][1], starts[s][2], null);
      if (s == 2) { t.v = 0.3; t.x = 0.25; }
      StringBuilder rows = new StringBuilder();
      String m0 = "[" + num(t.v) + "," + num(t.w) + "," + num(t.x) + "]";
      int explodedAt = -1;
      for (int i = 0; i < 100 && explodedAt < 0; i++) {
        t.h();
        if (!World.explosions.isEmpty()) explodedAt = i;
        if (rows.length() > 0) rows.append(',');
        rows.append("[" + num(t.s) + "," + num(t.t) + "," + num(t.u) + "," + num(t.v) + "," + num(t.w) + "," + num(t.x) + "," + t.D + "," + t.a + "]");
      }
      double[] e = World.explosions.get(0);
      System.out.println("{\"case\":\"tnt\",\"start\":[" + num(starts[s][0]) + "," + num(starts[s][1]) + "," + num(starts[s][2]) + "],\"motion\":" + m0
        + ",\"walls\":" + (s == 2) + ",\"explodedAt\":" + explodedAt + ",\"explosion\":[" + num(e[0]) + "," + num(e[1]) + "," + num(e[2]) + "," + num(e[3]) + "," + (e[5] > 0) + "],\"ticks\":[" + rows + "]}");
    }

    // BlockTNT: chain priming from an explosion (onBlockDestroyedByExplosion), and the
    // primed entity from flint and steel / fire (func_150114_a with metadata 1) or a plain
    // break (metadata 0, no entity).
    aob tntBlock = (aob) aji.e(46);
    for (int seed = 0; seed < 40; seed++) {
      reset(w); rand.setSeed(seed);
      tntBlock.a(w, 3, 4, 5, new agw(w, null, 0, 0, 0, 4f));
      xw t = (xw) World.spawned.get(0);
      System.out.println("{\"case\":\"chain\",\"seed\":" + seed + ",\"fuse\":" + t.a + ",\"pos\":[" + num(t.s) + "," + num(t.t) + "," + num(t.u) + "]}");
    }
    for (int meta = 0; meta < 2; meta++) {
      reset(w);
      tntBlock.b(w, 3, 4, 5, meta);
      System.out.println("{\"case\":\"prime\",\"meta\":" + meta + ",\"spawned\":" + World.spawned.size() + ",\"fuse\":" + (World.spawned.isEmpty() ? -1 : ((xw) World.spawned.get(0)).a)
        + ",\"sounds\":" + json(World.sounds) + "}");
    }

    // creeper drops: EntityLiving.dropFewItems (xz.b(ZI)) for seeded Entity.rand
    for (int seed = 0; seed < 200; seed++) {
      reset(w);
      xz e = new xz(w); MobMoveProbe.set(e, "Z", new Random(seed));
      MobMoveProbe.method(sw.class, "b", boolean.class, int.class).invoke(e, seed % 2 == 0, 0);
      int powder = 0, other = 0;
      for (Object o : World.spawned) { add s = ((xk) o).f(); if (s.b() == ade.H) powder += s.b; else other++; }
      System.out.println("{\"case\":\"cdrops\",\"seed\":" + seed + ",\"player\":" + (seed % 2 == 0) + ",\"gunpowder\":" + powder + ",\"other\":" + other + "}");
    }

    // per-block dropBlockAsItemWithChance(world, x, y, z, meta, 1 / size, 0) over seeded world.rand
    for (int[] p : PALETTE) for (float size : new float[] {3f, 4f, 6f}) {
      StringBuilder rows = new StringBuilder();
      for (int seed = 0; seed < 24; seed++) {
        reset(w); rand.setSeed(mix(seed));
        aji.e(p[0]).a(w, 2, 3, 4, p[1], 1f / size, 0);
        if (rows.length() > 0) rows.append(',');
        rows.append('{').append(spawnedJson()).append(",\"next\":").append(rand.nextInt(1 << 30)).append('}');
      }
      System.out.println("{\"case\":\"bdrops\",\"mc\":" + p[0] + ",\"meta\":" + p[1] + ",\"size\":" + num(size) + ",\"seeds\":[" + rows + "]}");
    }

    // ModelCreeper.setRotationAngles (bhj.a(FFFFFFsa))
    bhj model = new bhj();
    for (int i = 0; i < 24; i++) {
      float swing = i * 0.41f, amount = (i % 5) * 0.25f, yaw = -40 + i * 3.7f, pitch = -20 + i * 1.9f;
      model.a(swing, amount, 0f, yaw, pitch, 0.0625f, base);
      bix[] parts = {model.a, model.d, model.e, model.f, model.g};
      StringBuilder rows = new StringBuilder();
      for (bix b : parts) rows.append(rows.length() > 0 ? "," : "").append('[').append(b.f).append(',').append(b.g).append(',').append(b.h).append(']');
      System.out.println("{\"case\":\"pose\",\"swing\":" + swing + ",\"amount\":" + amount + ",\"yaw\":" + yaw + ",\"pitch\":" + pitch + ",\"parts\":[" + rows + "]}");
    }
  }

  static String json(List<String> list) {
    StringBuilder out = new StringBuilder("[");
    for (String s : list) { if (out.length() > 1) out.append(','); out.append('"').append(s).append('"'); }
    return out.append(']').toString();
  }
}
