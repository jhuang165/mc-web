import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

// Runs the unchanged EntityEnderman (ya) of the 1.7.10 JAR (with EntityMob yg, EntityLivingBase sv, Entity sa) on a
// block-map world double built on MobMoveProbe.ProbeWorld (stone below y 0, a settable block map, switchable
// daylight / sky / rain / line of sight / brightness, captured sounds, particles and spawned entities). The
// enderman is built with its real constructor; the player is an uninitialised EntityPlayer (yz). One JSON object
// per line:
//   facts      size, step height, attribute bases, XP value, datawatcher defaults, eye height, carriable block ids
//   stare      ya.f(yz) (shouldAttackPlayer) over distances, aim offsets, look angles, helmets and line of sight
//   stareSeq   ya.bR() (findPlayerToAttack) over successive ticks: result, stare counter, sounds, screaming
//   teleportTo ya.k(DDD) on hand-built terrain: success, final position, particles, sounds
//   teleportRandom ya.bZ() for seeded Random from a fixed spot; teleportToEntity ya.c(sa) likewise
//   hurt       ya.a(ro, F) for player melee, projectile, mob and drown sources
//   drops      ya.b(boolean, int) pearls for seeded Random and looting 0..3, ya.u() item
//   pick       one ya.e() tick on a block grove for seeded Random: picked block
//   place      one ya.e() tick while carrying dirt on flat ground: seeds that placed a block
//   tick       one ya.e() tick with daylight+sky, in water, in rain: health, teleport, screaming
//   chase      ya.e() ticks for a non-staring player target more than 16 blocks away: first teleport tick
public class EndermanProbe {
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }

  public static class World extends MobMoveProbe.ProbeWorld {
    static Map<Long, aji> blocks = new HashMap<>();
    static Map<Long, Integer> metas = new HashMap<>();
    static boolean sky, day, blocked, raining;
    static float light = 0f;
    static yz player;
    static agy rules;
    static List<String> sounds = new ArrayList<>(), particles = new ArrayList<>();
    static List<sa> spawned = new ArrayList<>();
    static long key(int x, int y, int z) { return ((long) (x & 0xFFFFF) << 40) | ((long) (y & 0xFFFFF) << 20) | (z & 0xFFFFF); }
    static void reset() { blocks.clear(); metas.clear(); sky = false; day = false; blocked = false; raining = false; light = 0f; clear(); }
    static void slab() { for (int x = -40; x <= 40; x++) for (int z = -40; z <= 40; z++) blocks.put(key(x, 0, z), aji.e(1)); }
    static void clear() { sounds.clear(); particles.clear(); spawned.clear(); }
    public aji a(int x, int y, int z) { aji b = blocks.get(key(x, y, z)); return b != null ? b : (y < 0 ? aji.e(1) : aji.e(0)); }
    public int e(int x, int y, int z) { Integer m = metas.get(key(x, y, z)); return m == null ? 0 : m; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { blocks.put(key(x, y, z), b); metas.put(key(x, y, z), meta); return true; }
    public boolean b(int x, int y, int z, aji b) { blocks.put(key(x, y, z), b); metas.put(key(x, y, z), 0); return true; }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++) {
            aji b = a(x, y, z);
            if (b != aji.e(0) && b.o().c() && x + 1 > box.a && x < box.d && y + 1 > box.b && y < box.e && z + 1 > box.c && z < box.f) out.add(azt.a(x, y, z, x + 1, y + 1, z + 1));
          }
      return out;
    }
    public boolean d(azt box) { // isAnyLiquid
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b); y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++) {
            int id = aji.b(a(x, y, z));
            if (id >= 8 && id <= 11) return true;
          }
      return false;
    }
    public boolean y(int x, int y, int z) { return raining; }
    public boolean w() { return day; }
    public boolean i(int x, int y, int z) { return sky; }
    public float n(int x, int y, int z) { return light; }
    public agy O() { return rules; }
    public azu a(azw from, azw to) { return blocked ? new azu(0, 0, 0, 0, azw.a(0, 0, 0)) : null; }
    public yz b(sa entity, double range) {
      if (player == null) return null;
      double dx = player.s - entity.s, dy = player.t - entity.t, dz = player.u - entity.u;
      return dx * dx + dy * dy + dz * dz < range * range ? player : null;
    }
    public boolean d(sa entity) { spawned.add(entity); return true; }
    public ayf a(sa e, sa t, float r, boolean a, boolean b, boolean c, boolean d) { return null; }
    public ayf a(sa e, int x, int y, int z, float r, boolean a, boolean b, boolean c, boolean d) { return null; }
    public void a(sa entity, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public void a(double x, double y, double z, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch + "|" + x + "," + y + "," + z); }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { particles.add(name); }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
  }

  public static abstract class FakePlayerBase extends yz { FakePlayerBase() { super(null, null); } }
  public static class FakePlayer extends FakePlayerBase {
    FakePlayer() { super(); }
    public add be() { return null; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public boolean a(int level, String command) { return true; }
    public void a(fj message) {}
    public r f_() { return null; }
  }

  static World W;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  static yz makePlayer() throws Exception {
    yz p = (yz) u.allocateInstance(FakePlayer.class);
    yx inv = (yx) u.allocateInstance(yx.class);
    inv.a = new add[36];
    inv.b = new add[4];
    inv.c = 0;
    inv.d = p;
    MobMoveProbe.set(p, "bm", inv);
    yw abilities = (yw) u.allocateInstance(yw.class);
    abilities.d = false;
    MobMoveProbe.set(p, "bE", abilities);
    MobMoveProbe.set(p, "ar", new UUID(1L, 2L));
    MobMoveProbe.set(p, "o", W);
    MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(new UUID(1L, 2L), "Player"));
    MobMoveProbe.set(p, "Z", new Random(5));
    te watcher = new te(p);
    MobMoveProbe.set(p, "af", watcher);
    watcher.a(6, Float.valueOf(20f));
    return p;
  }

  static void place(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static void setPlayer(double x, double y, double z, float yaw, float pitch) throws Exception {
    MobMoveProbe.set(World.player, "s", x); MobMoveProbe.set(World.player, "t", y); MobMoveProbe.set(World.player, "u", z);
    MobMoveProbe.set(World.player, "y", yaw); MobMoveProbe.set(World.player, "z", pitch);
    MobMoveProbe.set(World.player, "A", yaw); MobMoveProbe.set(World.player, "B", pitch);
  }
  static void helmet(add stack) throws Exception { ((yx) MobMoveProbe.field(yz.class, "bm").get(World.player)).b[3] = stack; }

  static long scramble(long seed) { return seed * 0x9E3779B97F4A7C15L; }
  static ya ender(long seed, double x, double y, double z) throws Exception {
    ya e = new ya(W);
    MobMoveProbe.set(e, "Z", new Random(scramble(seed)));
    place(e, x, y, z);
    MobMoveProbe.set(e, "D", true);
    return e;
  }

  static double d(sa e, String f) throws Exception { return MobMoveProbe.d(e, f); }
  static String pos(sa e) throws Exception { return "[" + num(d(e, "s")) + "," + num(d(e, "t")) + "," + num(d(e, "u")) + "]"; }
  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append('"').append(l.get(i)).append('"');
    return s.append("]").toString();
  }
  static boolean call(Object e, String name, Class<?>[] types, Object... args) throws Exception { return (Boolean) MobMoveProbe.method(e.getClass(), name, types).invoke(e, args); }
  static boolean teleportTo(ya e, double x, double y, double z) throws Exception { return call(e, "k", new Class<?>[] { double.class, double.class, double.class }, x, y, z); }
  static boolean teleportRandomly(ya e) throws Exception { return call(e, "bZ", new Class<?>[] {}); }
  static boolean shouldAttack(ya e, yz p) throws Exception { return call(e, "f", new Class<?>[] { yz.class }, p); }
  static boolean flag(Object e, String f) throws Exception { return MobMoveProbe.b(e, f); }
  static int integer(Object e, String f) throws Exception { return MobMoveProbe.field(e.getClass(), f).getInt(e); }
  static boolean moved(sa e, double x, double y, double z) throws Exception { double dx = d(e, "s") - x, dy = d(e, "t") - y, dz = d(e, "u") - z; return dx * dx + dy * dy + dz * dz > 9; }
  static String state(ya e) throws Exception {
    return "\"health\":" + num(e.aS()) + ",\"screaming\":" + e.cd() + ",\"aggressive\":" + flag(e, "bv") + ",\"carried\":" + aji.b(e.cb()) + ",\"carriedData\":" + e.cc();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    World world = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    W = world;
    World.rules = new agy();
    World.player = makePlayer();

    // facts
    {
      World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
      ya e = ender(1, 0.5, 0, 0.5);
      StringBuilder ids = new StringBuilder();
      boolean[] br = (boolean[]) MobMoveProbe.field(ya.class, "br").get(null);
      for (int i = 0; i < br.length; i++) if (br[i]) ids.append(ids.length() > 0 ? "," : "").append(i);
      System.out.println("{\"case\":\"facts\",\"width\":" + num(MobMoveProbe.fl(e, "M")) + ",\"height\":" + num(MobMoveProbe.fl(e, "N"))
        + ",\"stepHeight\":" + num(MobMoveProbe.fl(e, "W")) + ",\"maxHealth\":" + num(((ti) e.a(yj.a)).e()) + ",\"health\":" + num(e.aS())
        + ",\"speed\":" + num(((ti) e.a(yj.d)).e()) + ",\"attack\":" + num(((ti) e.a(yj.e)).e())
        + ",\"experience\":" + integer(e, "b") + ",\"carried\":" + aji.b(e.cb()) + ",\"carriedData\":" + e.cc() + ",\"screaming\":" + e.cd()
        + ",\"playerEyeHeight\":" + num((Float) MobMoveProbe.method(yz.class, "g").invoke(World.player))
        + ",\"enderEyeHeight\":" + num(e.g()) + ",\"carriable\":[" + ids + "]}");
    }

    // stare: ya.f(yz)
    {
      float[][] looks = { { 0, 0 }, { 90, 0 }, { 217.5f, -20 }, { 30, 35 } };
      double[] dists = { 2, 4, 8, 16, 32, 60 };
      double[] lateral = { 0, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2 };
      double[] vertical = { -1.4, 0, 0.7, 1.4 };
      for (int helm = 0; helm < 4; helm++) {
        add stack = helm == 0 ? null : new add(adb.a(aji.e(helm == 1 ? 86 : helm == 2 ? 91 : 1)));
        for (int blocked = 0; blocked < 2; blocked++) {
          if (helm > 0 && blocked > 0) continue;
          for (float[] look : looks) for (double dist : dists) for (double lat : lateral) for (double vert : vertical) {
            if (helm > 0 && (look[0] != 0 || vert != 0 || lat > 0.3)) continue;
            World.reset();
            World.blocked = blocked == 1;
            helmet(stack);
            double px = 3.5, py = 63.62, pz = -2.25;
            setPlayer(px, py, pz, look[0], look[1]);
            double yr = Math.toRadians(look[0]), pr = Math.toRadians(look[1]);
            double lx = -Math.sin(yr) * Math.cos(pr), ly = -Math.sin(pr), lz = Math.cos(yr) * Math.cos(pr);
            double rx = Math.cos(yr), rz = Math.sin(yr);
            double ex = px + lx * dist + rx * lat, ez = pz + lz * dist + rz * lat, ey = py + ly * dist + vert;
            ya e = ender(1, ex, ey - 1.45, ez);
            boolean r = shouldAttack(e, World.player);
            System.out.println("{\"case\":\"stare\",\"player\":[" + num(px) + "," + num(py) + "," + num(pz) + "],\"yaw\":" + num(look[0]) + ",\"pitch\":" + num(look[1])
              + ",\"ender\":" + pos(e) + ",\"helmet\":" + (helm == 0 ? "0" : aji.b(aji.e(helm == 1 ? 86 : helm == 2 ? 91 : 1))) + ",\"blocked\":" + World.blocked + ",\"result\":" + r + "}");
          }
        }
      }
      helmet(null);
    }

    // stareSeq: ya.bR()
    for (int variant = 0; variant < 3; variant++) {
      World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
      setPlayer(0.5, 1.62, 0.5, variant == 2 ? 90 : 0, 0);
      ya e = ender(1, 0.5, 0, 6.5);
      StringBuilder rows = new StringBuilder();
      Method find = MobMoveProbe.method(ya.class, "bR");
      for (int t = 0; t < 9; t++) {
        World.clear();
        if (variant == 1 && t == 3) setPlayer(0.5, 1.62, 0.5, 90, 0); // looks away mid-way: counter resets
        Object r = find.invoke(e);
        rows.append(t > 0 ? "," : "").append("{\"found\":" + (r != null) + ",\"counter\":" + integer(e, "bt") + ",\"aggressive\":" + flag(e, "bv")
          + ",\"screaming\":" + e.cd() + ",\"sounds\":" + strings(World.sounds) + "}");
      }
      System.out.println("{\"case\":\"stareSeq\",\"variant\":" + variant + ",\"ticks\":[" + rows + "]}");
    }

    // teleportTo on terrain
    {
      double[][] spots = { { 10.5, 5, 10.5 }, { 3.5, 3, 3.5 }, { 5.5, 3, 5.5 }, { 7.5, 2, 7.5 }, { 9.5, 2, -9.5 }, { 12.5, 1, 12.5 }, { 2.5, -5, 2.5 }, { 20.5, 40, 20.5 }, { 1.2, 1.7, 1.9 } };
      String[] names = { "air over floor", "inside stone column", "over water", "under low ceiling", "under tall ceiling", "on floor", "below floor", "high air", "fractional" };
      for (int i = 0; i < spots.length; i++) {
        World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
        World.slab();
        for (int y = 1; y <= 7; y++) World.blocks.put(World.key(3, y, 3), aji.e(1));
        World.blocks.put(World.key(5, 1, 5), aji.e(9)); // water over the floor
        World.blocks.put(World.key(7, 3, 7), aji.e(1)); // ceiling over a 2-high gap
        World.blocks.put(World.key(9, 5, -10), aji.e(1)); // ceiling over a 4-high gap
        ya e = ender(1, 0.5, 1, 0.5);
        double[] s = spots[i];
        boolean r = teleportTo(e, s[0], s[1], s[2]);
        int portal = 0; for (String p : World.particles) if (p.equals("portal")) portal++;
        System.out.println("{\"case\":\"teleportTo\",\"name\":\"" + names[i] + "\",\"target\":[" + num(s[0]) + "," + num(s[1]) + "," + num(s[2]) + "],\"success\":" + r + ",\"pos\":" + pos(e)
          + ",\"particles\":" + portal + ",\"sounds\":" + strings(World.sounds) + "}");
      }
    }

    // teleportRandomly and teleportToEntity over seeds
    for (long seed = 0; seed < 100; seed++) {
      World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
      World.slab();
      ya e = ender(seed, 0.5, 20, 0.5);
      boolean r = teleportRandomly(e);
      System.out.println("{\"case\":\"teleportRandom\",\"seed\":" + seed + ",\"success\":" + r + ",\"pos\":" + pos(e) + ",\"sounds\":" + World.sounds.size() + "}");
    }
    for (long seed = 0; seed < 60; seed++) {
      World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
      setPlayer(-4.5, 1.62, 3.5, 0, 0);
      World.slab();
      ya e = ender(seed, 10.5, 1, 12.5);
      boolean r = call(e, "c", new Class<?>[] { sa.class }, World.player);
      System.out.println("{\"case\":\"teleportToEntity\",\"seed\":" + seed + ",\"success\":" + r + ",\"pos\":" + pos(e) + "}");
    }

    // hurt
    {
      String[] kinds = { "player", "arrow", "mob", "drown", "generic" };
      for (String kind : kinds) for (long seed = 0; seed < 12; seed++) {
        World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
        setPlayer(0.5, 1.62, 3.5, 180, 0);
        World.slab();
        ya e = ender(seed, 0.5, 1, 0.5);
        ya other = ender(99, 0.5, 1, 2.5);
        ro src = kind.equals("player") ? ro.a(World.player) : kind.equals("arrow") ? new rq("arrow", other, World.player) : kind.equals("mob") ? ro.a((sv) other) : kind.equals("drown") ? ro.e : ro.j;
        double x = d(e, "s"), y = d(e, "t"), z = d(e, "u");
        boolean r = e.a(src, 4.0f);
        Object target = MobMoveProbe.field(e.getClass(), "bm").get(e);
        System.out.println("{\"case\":\"hurt\",\"kind\":\"" + kind + "\",\"seed\":" + seed + ",\"result\":" + r + ",\"moved\":" + moved(e, x, y, z) + "," + state(e)
          + ",\"target\":" + (target == null ? "null" : target == World.player ? "\"player\"" : "\"other\"") + ",\"sounds\":" + strings(World.sounds) + "}");
      }
    }

    // drops
    {
      World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
      ya e = ender(1, 0.5, 0, 0.5);
      System.out.println("{\"case\":\"dropItem\",\"id\":" + adb.b((adb) MobMoveProbe.method(ya.class, "u").invoke(e)) + "}");
      Method drop = MobMoveProbe.method(ya.class, "b", boolean.class, int.class);
      for (int looting = 0; looting < 4; looting++) {
        int[] counts = new int[6];
        for (long seed = 0; seed < 400; seed++) {
          World.reset();
          ya g = ender(seed, 0.5, 0, 0.5);
          g.a(aji.e(3));
          drop.invoke(g, true, looting);
          int n = 0;
          for (sa s : World.spawned) if (s instanceof xk) n += ((xk) s).f().b;
          counts[n]++;
        }
        System.out.println("{\"case\":\"drops\",\"looting\":" + looting + ",\"histogram\":[" + counts[0] + "," + counts[1] + "," + counts[2] + "," + counts[3] + "," + counts[4] + "," + counts[5] + "],\"seeds\":400}");
      }
    }

    // pick: one tick on a grove
    {
      int picks = 0;
      for (long seed = 0; seed < 4000; seed++) {
        World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
        for (int x = -4; x <= 4; x++) for (int y = 0; y <= 6; y++) for (int z = -4; z <= 4; z++) {
          int h = Math.floorMod(x * 31 + y * 17 + z * 13, 5);
          World.blocks.put(World.key(x, y, z), aji.e(h == 0 ? 3 : h == 1 ? 12 : h == 2 ? 1 : h == 3 ? 86 : 0));
          World.metas.put(World.key(x, y, z), (x + z) & 3);
        }
        ya e = ender(seed, 0.5, 2, 0.5);
        e.e();
        if (e.cb() != aji.e(0)) {
          picks++;
          System.out.println("{\"case\":\"pick\",\"seed\":" + seed + ",\"carried\":" + aji.b(e.cb()) + ",\"carriedData\":" + e.cc() + "}");
        }
      }
      System.out.println("{\"case\":\"pickTotal\",\"seeds\":4000,\"picks\":" + picks + "}");
    }

    // place
    {
      int placed = 0;
      for (long seed = 0; seed < 40000; seed++) {
        World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
        ya e = ender(seed, 0.5, 0, 0.5);
        e.a(aji.e(3));
        e.a(2);
        e.e();
        if (e.cb() == aji.e(0)) {
          placed++;
          StringBuilder cells = new StringBuilder();
          for (Map.Entry<Long, aji> en : World.blocks.entrySet()) {
            long k = en.getKey();
            int x = (int) ((k >> 40) & 0xFFFFF), y = (int) ((k >> 20) & 0xFFFFF), z = (int) (k & 0xFFFFF);
            if (x >= 0x80000) x -= 0x100000;
            if (y >= 0x80000) y -= 0x100000;
            if (z >= 0x80000) z -= 0x100000;
            cells.append(cells.length() > 0 ? "," : "").append("[" + x + "," + y + "," + z + "," + aji.b(en.getValue()) + "," + World.metas.get(k) + "]");
          }
          System.out.println("{\"case\":\"place\",\"seed\":" + seed + ",\"blocks\":[" + cells + "]}");
        }
      }
      System.out.println("{\"case\":\"placeTotal\",\"seeds\":40000,\"placed\":" + placed + "}");
    }

    // sun, wet, rain, plain night: one tick
    String[] envs = { "night", "sun", "shade", "water", "rain", "dimSun" };
    for (String env : envs) for (long seed = 0; seed < 300; seed++) {
      World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
      World.day = env.equals("sun") || env.equals("shade") || env.equals("dimSun");
      World.sky = env.equals("sun") || env.equals("dimSun");
      World.light = env.equals("sun") ? 0.9f : env.equals("shade") ? 0.9f : env.equals("dimSun") ? 0.45f : 0.2f;
      World.raining = env.equals("rain");
      World.slab();
      ya e = ender(seed, 0.5, 1, 0.5);
      if (env.equals("water")) MobMoveProbe.set(e, "ac", true);
      e.a(true);
      MobMoveProbe.set(e, "bv", true);
      double x = d(e, "s"), y = d(e, "t"), z = d(e, "u");
      e.e();
      System.out.println("{\"case\":\"tick\",\"env\":\"" + env + "\",\"seed\":" + seed + ",\"moved\":" + moved(e, x, y, z) + "," + state(e) + "}");
    }

    // chase: a non-staring player target more than 16 blocks away (squared distance 256)
    for (long seed = 0; seed < 4; seed++) {
      World.reset(); setPlayer(5000, 1.62, 5000, 0, 0);
      setPlayer(0.5, 1.62, 0.5, 90, 0); // looking along -x, away from the enderman
      World.slab();
      ya e = ender(seed, 0.5, 1, 30.5);
      MobMoveProbe.set(e, "bm", World.player);
      int first = -1;
      for (int t = 1; t <= 40 && first < 0; t++) {
        double x = d(e, "s"), y = d(e, "t"), z = d(e, "u");
        e.e();
        if (moved(e, x, y, z)) first = t;
      }
      System.out.println("{\"case\":\"chase\",\"seed\":" + seed + ",\"firstTeleportTick\":" + first + "}");
    }
  }
}
