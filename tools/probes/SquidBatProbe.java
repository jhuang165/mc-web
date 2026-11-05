import java.util.ArrayList;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.List;
import java.util.Random;

// Runs the unchanged EntitySquid (ws), EntityWaterMob (wu), EntityBat (we) and EntityAmbientCreature (wd) of the 1.7.10 JAR on the
// MobMoveProbe world double (stone below y 0, air above), extended with a switchable water flag (handleMaterialAcceleration),
// a block-light value, a calendar, a ceiling plane and a closest-player stub. One JSON object per line:
//   facts      sizes, attribute bases, sounds, volume, talk interval for both mobs
//   squidXp    wu.e(yz) over seeded world rand
//   squidTick  per tick of ws.h() (full onUpdate) in water for 240 ticks, then out of water: motion, angles, tentacle, air, health
//   squidSpawn ws.by() over a range of posY
//   squidDrops ws.b(Z,I) item stacks over seeded Entity.rand and looting 0..3
//   batTick    we.bn() flight/hang decisions (the AI step) for a seeded run with a ceiling, plus the h() tail applied by hand
//   batWake    we.bn() of a hanging bat with a player at several distances (and a missing ceiling)
//   batHeadYaw we.bn() hanging, the rotationYawHead rolls
//   batSound   we.t() hanging and flying, seeded; getSoundPitch
//   batSpawn   we.by() over light, posY and calendar dates with seeded Entity.rand
//   batHurt    we.a(ro,F) on a hanging bat (unhangs); NBT BatFlags via b(dh)/a(dh)
public class SquidBatProbe {
  public static class World extends MobMoveProbe.ProbeWorld {
    static boolean wet = false;
    static int light = 0;
    static int plane = -1000; // one stone plane at this y
    static int ladder = -1; // when >= 0 every even y from here up is stone
    static Calendar cal = new GregorianCalendar(2013, Calendar.JUNE, 1);
    static yz player;
    static double playerDist = 100;
    static List<String> items = new ArrayList<>();
    static List<String> aux = new ArrayList<>();
    public boolean a(azt box, awt material, sa entity) { return wet; }
    public boolean a(azt box, awt material) { return false; }
    public aji a(int x, int y, int z) { return y < 0 || y == plane || (ladder >= 0 && y >= ladder && y % 2 == 0) ? aji.e(1) : aji.e(0); }
    public int k(int x, int y, int z) { return light; }
    public Calendar V() { return cal; }
    public yz a(sa e, double d) { return player != null && (d < 0 || playerDist <= d) ? player : null; }
    public boolean d(sa entity) {
      if (entity instanceof xk) { add s = ((xk) entity).f(); items.add("{\"id\":" + adb.b(s.b()) + ",\"damage\":" + s.k() + ",\"count\":" + s.b + "}"); }
      return true;
    }
    public void a(yz p, int id, int x, int y, int z, int data) { aux.add("{\"id\":" + id + ",\"x\":" + x + ",\"y\":" + y + ",\"z\":" + z + "}"); }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
  }

  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static void out(String s) { System.out.println(s); }
  // Small Random seeds give correlated first outputs; rows that sweep seeds use seed = i * 1000003 + 17.
  static long mix(int i) { return i * 1000003L + 17; }
  static String quote(String s) { return s == null ? "null" : "\"" + s + "\""; }

  static ws squid(World w, long seed, double x, double y, double z) throws Exception {
    ws e = new ws(w);
    MobMoveProbe.set(e, "Z", new Random(seed));
    // The constructor rolled rotationVelocity with an unseeded Random; replace it with the roll of the seeded one.
    MobMoveProbe.set(e, "by", 1.0F / (new Random(seed).nextFloat() + 1.0F) * 0.2F);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    MobMoveProbe.set(e, "D", true);
    zeroYaw(e);
    return e;
  }
  // EntityLivingBase's constructor rolls rotationYaw (and the head and body yaw follow); the probe starts every mob facing 0.
  static void zeroYaw(sv e) throws Exception {
    for (String n : new String[] { "y", "A", "aM", "aN", "aO", "aP" }) MobMoveProbe.set(e, n, 0.0F);
  }
  static we bat(World w, long seed, double x, double y, double z) throws Exception {
    we e = new we(w);
    MobMoveProbe.set(e, "Z", new Random(seed));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    MobMoveProbe.set(e, "D", true);
    zeroYaw(e);
    return e;
  }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }
  static float fl(Object o, String n) throws Exception { return MobMoveProbe.fl(o, n); }
  static float box(sa e, boolean h) { azt b = e.C; return (float) (h ? b.e - b.b : b.d - b.a); }
  static Object inv(Class<?> c, Object o, String n, Class<?>[] t, Object... a) throws Exception { return MobMoveProbe.method(c, n, t).invoke(o, a); }
  static Object inv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.method(c, n).invoke(o); }
  static void setPos(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static int air(sa e) throws Exception { return (Integer) MobMoveProbe.method(wu.class, "ar").invoke(e); }

  static String squidState(ws e, int tick, long seed) throws Exception {
    return "{\"case\":\"squidTick\",\"seed\":" + seed + ",\"tick\":" + tick + ",\"wet\":" + World.wet + ",\"x\":" + num(d(e, "s")) + ",\"y\":" + num(d(e, "t")) + ",\"z\":" + num(d(e, "u"))
      + ",\"vx\":" + num(d(e, "v")) + ",\"vy\":" + num(d(e, "w")) + ",\"vz\":" + num(d(e, "x"))
      + ",\"pitch\":" + num(fl(e, "bp")) + ",\"prevPitch\":" + num(fl(e, "bq")) + ",\"yaw\":" + num(fl(e, "br")) + ",\"prevYaw\":" + num(fl(e, "bs"))
      + ",\"rotation\":" + num(fl(e, "bt")) + ",\"tentacle\":" + num(fl(e, "bv")) + ",\"prevTentacle\":" + num(fl(e, "bw"))
      + ",\"motionSpeed\":" + num(fl(e, "bx")) + ",\"rotationVelocity\":" + num(fl(e, "by")) + ",\"rotateSpeed\":" + num(fl(e, "bz"))
      + ",\"vecX\":" + num(fl(e, "bA")) + ",\"vecY\":" + num(fl(e, "bB")) + ",\"vecZ\":" + num(fl(e, "bC"))
      + ",\"renderYawOffset\":" + num(fl(e, "aM")) + ",\"rotationYaw\":" + num(fl(e, "y")) + ",\"health\":" + num(e.aS()) + ",\"air\":" + air(e) + "}";
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    World w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    for (java.lang.reflect.Field f : ays.class.getDeclaredFields())
      if (f.getType() == agy.class) { f.setAccessible(true); f.set(info, new agy()); }
    MobMoveProbe.set(w, "x", info);
    ws s0 = squid(w, 1, 64, 20, 64);
    we b0 = bat(w, 1, 64, 20, 64);
    out("{\"case\":\"facts\",\"squid\":{\"width\":" + num(box(s0, false)) + ",\"height\":" + num(box(s0, true)) + ",\"maxHealth\":" + num(((ti) s0.a(yj.a)).e())
      + ",\"volume\":" + num((Float) inv(ws.class, s0, "bf")) + ",\"talkInterval\":" + s0.q()
      + ",\"living\":" + quote((String) inv(ws.class, s0, "t")) + ",\"hurt\":" + quote((String) inv(ws.class, s0, "aT"))
      + ",\"death\":" + quote((String) inv(ws.class, s0, "aU")) + ",\"canTriggerWalking\":" + inv(ws.class, s0, "g_")
      + ",\"dropItem\":" + adb.b((adb) inv(ws.class, s0, "u")) + "},"
      + "\"bat\":{\"width\":" + num(box(b0, false)) + ",\"height\":" + num(box(b0, true)) + ",\"maxHealth\":" + num(((ti) b0.a(yj.a)).e())
      + ",\"volume\":" + num((Float) inv(we.class, b0, "bf")) + ",\"hanging\":" + b0.bP()
      + ",\"canTriggerWalking\":" + inv(we.class, b0, "g_") + ",\"aiEnabled\":" + inv(we.class, b0, "bk")
      + ",\"canBePushed\":" + b0.S() + ",\"doesNotTriggerPressurePlate\":" + b0.az()
      + ",\"hurt\":" + quote((String) inv(we.class, b0, "aT")) + ",\"death\":" + quote((String) inv(we.class, b0, "aU")) + "}}");
    List<Integer> xp = new ArrayList<>();
    for (int i = 0; i < 60; i++) { w.s.setSeed(i); xp.add((Integer) inv(wu.class, s0, "e", new Class<?>[] { yz.class }, (Object) null)); }
    out("{\"case\":\"squidXp\",\"values\":" + xp + "}");
    for (long seed : new long[] { 7, 12345 }) {
      World.wet = true;
      ws e = squid(w, seed, 64.5, 20, 64.5);
      out("{\"case\":\"squidStart\",\"seed\":" + seed + ",\"rotationVelocity\":" + num(fl(e, "by")) + ",\"x\":64.5,\"y\":20.0,\"z\":64.5}");
      for (int t = 1; t <= 240; t++) { e.h(); out(squidState(e, t, seed)); }
      World.wet = false;
      // Out of water the squid is put on the ground so the run measures the air counter and drowning, not a fall.
      setPos(e, 64.5, 0.0, 64.5);
      MobMoveProbe.set(e, "w", 0.0);
      for (int t = 241; t <= 1000; t++) {
        e.h();
        if (e.aS() <= 0) { out(squidState(e, t, seed)); break; }
        if (t <= 300 || t % 20 == 0) out(squidState(e, t, seed));
      }
    }
    World.wet = false;
    for (double y : new double[] { 40, 44.5, 45, 45.0001, 45.5, 50, 62.5, 62.9999, 63, 63.5, 70 }) {
      ws e = squid(w, 3, 64.5, y, 64.5);
      out("{\"case\":\"squidSpawn\",\"y\":" + num(y) + ",\"ok\":" + e.by() + "}");
    }
    for (int looting = 0; looting <= 3; looting++)
      for (int seed = 0; seed < 40; seed++) {
        World.items.clear();
        ws e = squid(w, mix(seed), 64.5, 20, 64.5);
        inv(ws.class, e, "b", new Class<?>[] { boolean.class, int.class }, true, looting);
        out("{\"case\":\"squidDrops\",\"looting\":" + looting + ",\"seed\":" + seed + ",\"items\":" + World.items + "}");
      }
    World.ladder = 16;
    for (long seed : new long[] { 1, 99, 2024, 31337 }) {
      we e = bat(w, seed, 64.5, 25.3, 64.5);
      e.a(false);
      out("{\"case\":\"batStart\",\"seed\":" + seed + "}");
      for (int t = 1; t <= 400; t++) {
        World.aux.clear();
        inv(we.class, e, "bn");
        boolean hang = e.bP();
        r sp = (r) MobMoveProbe.field(we.class, "h").get(e);
        out("{\"case\":\"batTick\",\"seed\":" + seed + ",\"tick\":" + t + ",\"hanging\":" + hang + ",\"x\":" + num(d(e, "s")) + ",\"y\":" + num(d(e, "t")) + ",\"z\":" + num(d(e, "u"))
          + ",\"vx\":" + num(d(e, "v")) + ",\"vy\":" + num(d(e, "w")) + ",\"vz\":" + num(d(e, "x")) + ",\"yaw\":" + num(fl(e, "y")) + ",\"headYaw\":" + num(fl(e, "aO"))
          + ",\"moveForward\":" + num(fl(e, "be")) + ",\"spawnPosition\":" + (sp == null ? "null" : "[" + sp.a + "," + sp.b + "," + sp.c + "]") + ",\"aux\":" + World.aux.size() + "}");
        if (hang) {
          MobMoveProbe.set(e, "v", 0.0); MobMoveProbe.set(e, "w", 0.0); MobMoveProbe.set(e, "x", 0.0);
          MobMoveProbe.set(e, "t", Math.floor(d(e, "t")) + 1.0 - (double) fl(e, "N"));
        } else {
          MobMoveProbe.set(e, "w", d(e, "w") * 0.6000000238418579);
          setPos(e, d(e, "s") + d(e, "v") * 0.5, d(e, "t") + d(e, "w") * 0.5, d(e, "u") + d(e, "x") * 0.5);
        }
      }
    }
    World.player = (yz) u.allocateInstance(WolfProbe.FakePlayer.class);
    for (double dist : new double[] { 2, 3.9, 4.0, 4.1, 10 }) {
      for (boolean ceil : new boolean[] { true, false }) {
        World.ladder = -1;
        World.plane = ceil ? 21 : -1000;
        World.playerDist = dist;
        World.aux.clear();
        we e = bat(w, 5, 64.5, 20, 64.5);
        inv(we.class, e, "bn");
        out("{\"case\":\"batWake\",\"playerDist\":" + num(dist) + ",\"ceiling\":" + ceil + ",\"hangingAfter\":" + e.bP() + ",\"aux\":" + World.aux + "}");
      }
    }
    World.player = null;
    World.plane = 21;
    {
      we e = bat(w, 8, 64.5, 20, 64.5);
      List<String> heads = new ArrayList<>();
      for (int t = 0; t < 800; t++) { MobMoveProbe.set(e, "aO", 0.0F); inv(we.class, e, "bn"); heads.add(num(fl(e, "aO"))); } // the look helper moves the head between ticks, so each tick starts from 0
      out("{\"case\":\"batHeadYaw\",\"seed\":8,\"values\":" + heads + "}");
    }
    for (boolean hang : new boolean[] { true, false })
      for (int seed = 0; seed < 40; seed++) {
        we e = bat(w, mix(seed), 64.5, 20, 64.5);
        e.a(hang);
        String s = (String) inv(we.class, e, "t");
        float pitch = (Float) inv(we.class, e, "bg");
        out("{\"case\":\"batSound\",\"hanging\":" + hang + ",\"seed\":" + seed + ",\"sound\":" + quote(s) + ",\"pitch\":" + num(pitch) + "}");
      }
    int[][] dates = { { Calendar.JUNE, 1 }, { Calendar.OCTOBER, 19 }, { Calendar.OCTOBER, 20 }, { Calendar.OCTOBER, 31 }, { Calendar.NOVEMBER, 3 }, { Calendar.NOVEMBER, 4 } };
    for (int[] date : dates)
      for (double y : new double[] { 20, 62.5, 63, 70 })
        for (int light = 0; light <= 15; light++) {
          World.cal = new GregorianCalendar(2013, date[0], date[1]);
          World.light = light;
          StringBuilder r = new StringBuilder("[");
          for (int seed = 0; seed < 24; seed++) { we e = bat(w, mix(seed), 64.5, y, 64.5); r.append(seed > 0 ? "," : "").append(e.by()); }
          out("{\"case\":\"batSpawn\",\"month\":" + (date[0] + 1) + ",\"day\":" + date[1] + ",\"y\":" + num(y) + ",\"light\":" + light + ",\"results\":" + r + "]}");
        }
    World.cal = new GregorianCalendar(2013, Calendar.JUNE, 1);
    {
      we e = bat(w, 4, 64.5, 20, 64.5);
      boolean before = e.bP();
      boolean hit = e.a(ro.a, 1.0F);
      out("{\"case\":\"batHurt\",\"hangingBefore\":" + before + ",\"hit\":" + hit + ",\"hangingAfter\":" + e.bP() + ",\"health\":" + num(e.aS()) + "}");
      dh tag = new dh();
      e.a(true);
      e.b(tag);
      byte flags = tag.d("BatFlags");
      we f = bat(w, 4, 64.5, 20, 64.5);
      f.a(false);
      f.a(tag);
      out("{\"case\":\"batNbt\",\"writtenFlags\":" + flags + ",\"readHanging\":" + f.bP() + "}");
      dh t2 = new dh();
      t2.a("BatFlags", (byte) 0);
      we g = bat(w, 4, 64.5, 20, 64.5);
      g.a(t2);
      out("{\"case\":\"batNbt\",\"writtenFlags\":0,\"readHanging\":" + g.bP() + "}");
    }
  }
}
