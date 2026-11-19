import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 83 corpse83: what a dying mob's own update still runs. The unchanged 1.7.10 classes on the probe world doubles of SquidBatProbe
// (water everywhere above the stone floor, or none) and EndermanProbe (a block map with switchable day, sky, rain, light).
//   squidCorpse    a squid swims 40 ticks (full ws.h()), is set to 0 health (sv.g(F): no onDeath), then 21 more ws.h() ticks are recorded:
//                  position, motion, the tentacle / angle fields, deathTime (sv.aA), isDead (sa.K), the draws of the tick on Entity.rand and the
//                  Random's state after it. Case "water": in water; "air": the water is switched off at the kill (the corpse falls), with a
//                  Speed effect (rw(1, 15, 0)) added at the kill and a revenge target (sv.b(sv)) 92 ticks old (ticksExisted counts before each ws.h(), as World.updateEntityWithOptionalForce does), so the potion countdown, its
//                  swirl draws, the effect's end and the revenge lapse (aa - bm > 100) are seen on the corpse.
//   enderCorpse    one ya.e() on an enderman at 0 health in the EndermanProbe "tick" environments (night, sun, shade, water, rain, dimSun),
//                  seeds 0..299: moved (teleported), screaming, carried block, particles and draws.
//   enderChase     ya.e() ticks of an enderman at 0 health with a non-staring player target 30 blocks away (EndermanProbe "chase"): the
//                  isEntityAlive-gated part (the chase counter ya.bs) does not run, so it never teleports to the player.
public class CorpseLivingProbe {
  // java.util.Random with its own copy of the LCG state (the state is private in java.util.Random), a draw counter and Random.nextGaussian's pair cache.
  public static class Log extends Random {
    long state; int calls; boolean haveNext; double nextG;
    Log(long seed) { super(0); state = (seed ^ 0x5DEECE66DL) & ((1L << 48) - 1); }
    protected int next(int bits) { calls++; state = (state * 0x5DEECE66DL + 0xBL) & ((1L << 48) - 1); return (int) (state >>> (48 - bits)); }
    public synchronized double nextGaussian() {
      if (haveNext) { haveNext = false; return nextG; }
      double v1, v2, s;
      do { v1 = 2 * nextDouble() - 1; v2 = 2 * nextDouble() - 1; s = v1 * v1 + v2 * v2; } while (s >= 1 || s == 0);
      double m = StrictMath.sqrt(-2 * StrictMath.log(s) / s);
      nextG = v2 * m; haveNext = true; return v1 * m;
    }
    String json() { return "{\"seed\":\"" + state + "\",\"gaussian\":" + (haveNext ? Double.toString(nextG) : "null") + "}"; }
  }

  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  static void setupWorld(ahb w) throws Exception {
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    for (java.lang.reflect.Field f : ays.class.getDeclaredFields())
      if (f.getType() == agy.class) { f.setAccessible(true); f.set(info, new agy()); }
    MobMoveProbe.set(w, "x", info);
  }

  static String squidRow(String kase, ws e, Log r, int tick, int draws, sv revenge) throws Exception {
    String s = SquidBatProbe.squidState(e, tick, 0);
    s = s.substring(s.indexOf(",\"tick\""));
    StringBuilder fx = new StringBuilder("[");
    int k = 0;
    for (Object o : e.aQ()) { rw p = (rw) o; fx.append(k++ > 0 ? "," : "").append("[" + p.a() + "," + p.b() + "]"); }
    fx.append("]");
    boolean lapsed = MobMoveProbe.field(sv.class, "i").get(e) == null;
    return "{\"case\":\"squidCorpse\",\"kind\":\"" + kase + "\"" + s.substring(0, s.length() - 1) + ",\"deathTime\":" + e.aA + ",\"dead\":" + MobMoveProbe.b(e, "K")
      + ",\"draws\":" + draws + ",\"random\":" + r.json() + ",\"effects\":" + fx + ",\"revenge\":" + (revenge == null ? "null" : !lapsed) + "}";
  }

  // World.updateEntityWithOptionalForce (ahb.a(sa, Z)) adds 1 to ticksExisted (sa.aa) before every onUpdate.
  static void tick(sa e) throws Exception { java.lang.reflect.Field f = MobMoveProbe.field(sa.class, "aa"); f.setInt(e, f.getInt(e) + 1); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    // --- squid ---
    SquidBatProbe.World sw = (SquidBatProbe.World) u.allocateInstance(SquidBatProbe.World.class);
    setupWorld(sw);
    for (String kase : new String[] { "water", "air" }) {
      long seed = kase.equals("water") ? 7 : 12345;
      SquidBatProbe.World.wet = true;
      ws e = SquidBatProbe.squid(sw, seed, 64.5, kase.equals("water") ? 20 : 6, 64.5);
      Log r = new Log(seed);
      MobMoveProbe.set(e, "Z", r);
      for (int t = 1; t <= 40; t++) { tick(e); e.h(); }
      sv revenge = null;
      if (kase.equals("air")) {
        SquidBatProbe.World.wet = false;
        e.c(new rw(1, 15, 0));
        revenge = SquidBatProbe.squid(sw, 99, 70.5, 6, 64.5);
        e.b(revenge);
        MobMoveProbe.field(sv.class, "bm").setInt(e, MobMoveProbe.field(sa.class, "aa").getInt(e) - 92);
      }
      e.g(0f);
      System.out.println(squidRow(kase, e, r, 40, 0, revenge));
      for (int t = 41; t <= 61; t++) {
        int before = r.calls;
        tick(e); e.h();
        System.out.println(squidRow(kase, e, r, t, r.calls - before, revenge));
      }
    }
    // --- enderman ---
    EndermanProbe.World world = (EndermanProbe.World) u.allocateInstance(EndermanProbe.World.class);
    setupWorld(world);
    EndermanProbe.W = world;
    EndermanProbe.World.rules = new agy();
    EndermanProbe.World.player = EndermanProbe.makePlayer();
    String[] envs = { "night", "sun", "shade", "water", "rain", "dimSun" };
    for (String env : envs) for (long seed = 0; seed < 300; seed++) {
      EndermanProbe.World.reset(); EndermanProbe.setPlayer(5000, 1.62, 5000, 0, 0);
      EndermanProbe.World.day = env.equals("sun") || env.equals("shade") || env.equals("dimSun");
      EndermanProbe.World.sky = env.equals("sun") || env.equals("dimSun");
      EndermanProbe.World.light = env.equals("sun") ? 0.9f : env.equals("shade") ? 0.9f : env.equals("dimSun") ? 0.45f : 0.2f;
      EndermanProbe.World.raining = env.equals("rain");
      EndermanProbe.World.slab();
      ya e = EndermanProbe.ender(seed, 0.5, 1, 0.5);
      if (env.equals("water")) MobMoveProbe.set(e, "ac", true);
      e.a(true);
      MobMoveProbe.set(e, "bv", true);
      e.g(0f);
      Log r = new Log(EndermanProbe.scramble(seed));
      MobMoveProbe.set(e, "Z", r);
      double x = EndermanProbe.d(e, "s"), y = EndermanProbe.d(e, "t"), z = EndermanProbe.d(e, "u");
      e.e();
      System.out.println("{\"case\":\"enderCorpse\",\"env\":\"" + env + "\",\"seed\":" + seed + ",\"moved\":" + EndermanProbe.moved(e, x, y, z) + "," + EndermanProbe.state(e)
        + ",\"particles\":" + EndermanProbe.World.particles.size() + ",\"draws\":" + r.calls + ",\"random\":" + r.json() + "}");
    }
    for (long seed = 0; seed < 4; seed++) {
      EndermanProbe.World.reset(); EndermanProbe.setPlayer(5000, 1.62, 5000, 0, 0);
      EndermanProbe.setPlayer(0.5, 1.62, 0.5, 90, 0);
      EndermanProbe.World.slab();
      ya e = EndermanProbe.ender(seed, 0.5, 1, 30.5);
      MobMoveProbe.set(e, "bm", EndermanProbe.World.player);
      e.g(0f);
      int first = -1;
      for (int t = 1; t <= 40 && first < 0; t++) {
        double x = EndermanProbe.d(e, "s"), y = EndermanProbe.d(e, "t"), z = EndermanProbe.d(e, "u");
        e.e();
        if (EndermanProbe.moved(e, x, y, z)) first = t;
      }
      System.out.println("{\"case\":\"enderChase\",\"seed\":" + seed + ",\"firstTeleportTick\":" + first + ",\"chaseTimer\":" + EndermanProbe.integer(e, "bs") + "}");
    }
  }
}
