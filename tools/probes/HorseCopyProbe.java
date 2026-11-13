import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Random;

// Batch 54: the unchanged EntityHorse (wi) moveEntityWithHeading e(F,F) and updateRiderPosition ac() on a CLIENT world double (ahb.E true), the copy of a horse the local
// player rides. Reuses HorseProbe's world, horse and rider doubles. One JSON object per line:
//   steer   a saddled client horse with a rider of the given look and movement input (and a jump power set directly): per tick the position, motion, yaw, previous yaw,
//           pitch, body yaw, head yaw, jump power, and the rider's position after ac()
//   rear    ac() with a rearing amount: the rider's offset from the horse
//   sound   batch 57: the real wi.h() on a client world double with a logging Random as the horse's own Entity.rand, 1500 ticks per scenario: per tick every draw (bound:result, f for
//           nextFloat) and the sounds the client entity plays (name|volume|pitch). The living sound roll (EntityLiving.onEntityUpdate) draws nextInt(1000) first; a hit draws nextInt(10)
//           (wi.t) and two floats (sv.bg), then the horse's own tail roll nextInt(200).
//   flags   batch 57: the unchanged starters of the watcher-16 flags on a SERVER world double (ahb.E false), each as one row: the watcher bits afterwards (wi.x(I) for 2..128), the
//           mouth counter bE, the rear counter bF, the eating counter bD, the draws and the sounds. Starters: death sound aU, hurt sound aT, living sound t, angry cJ, jump w(I),
//           leash distance o(F), the eating sound cL, and `graze` (wi.e() on a world whose every block is grass: the nextInt(300) start, then the 50-tick stop).
public class HorseCopyProbe {
  public static class Log extends Random {
    ArrayList<String> log = new ArrayList<>();
    Log(long seed) { super(seed); }
    public int nextInt(int bound) { int v = super.nextInt(bound); log.add(bound + ":" + v); return v; }
    public float nextFloat() { float v = super.nextFloat(); log.add("f"); return v; }
    public double nextDouble() { double v = super.nextDouble(); log.add("d"); return v; }
    public boolean nextBoolean() { boolean v = super.nextBoolean(); log.add("b"); return v; }
  }
  public static class GrassWorld extends HorseProbe.World { public aji a(int x, int y, int z) { return ajn.c; } }
  static HorseProbe.World build(Class<? extends HorseProbe.World> c, boolean client) throws Exception {
    HorseProbe.World world = (HorseProbe.World) HorseProbe.u.allocateInstance(c);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(world, client);
    { // ChunkProviderClient.provideChunk: a loaded chunk (as HorseRearProbe.world); the server double gets it too (the AI tasks of wi.e() read blocks)
      apx chunk = (apx) HorseProbe.u.allocateInstance(apx.class);
      chunk.d = true;
      java.lang.reflect.InvocationHandler ih = (proxy, m, a) -> m.getName().equals("d") && a != null && a.length == 2 ? chunk : m.getReturnType() == boolean.class ? (Object) false : m.getReturnType() == int.class ? (Object) 0 : null;
      MobMoveProbe.set(world, "v", java.lang.reflect.Proxy.newProxyInstance(apu.class.getClassLoader(), new Class[] { apu.class }, ih));
    }
    HorseProbe.W = world;
    return world;
  }
  static String list(java.util.List<String> l) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < l.size(); i++) b.append(i > 0 ? "," : "").append("\"" + l.get(i) + "\""); return b.append("]").toString(); }
  static int bits(wi e) throws Exception {
    int v = 0;
    for (int b : new int[] { 2, 4, 8, 16, 32, 64, 128 }) if ((Boolean) MobMoveProbe.method(wi.class, "x", int.class).invoke(e, b)) v |= b;
    return v;
  }
  static String state(wi e, Log r) throws Exception {
    return "\"flags\":" + bits(e) + ",\"bE\":" + MobMoveProbe.field(wi.class, "bE").getInt(e) + ",\"bF\":" + MobMoveProbe.field(wi.class, "bF").getInt(e) + ",\"bD\":" + MobMoveProbe.field(wi.class, "bD").getInt(e)
      + ",\"draws\":" + list(r.log) + ",\"sounds\":" + list(new ArrayList<>(HorseProbe.World.sounds));
  }
  // A fresh server horse with the given preset (eating through o(Z), rearing through p(Z), saddled) and a logging Random.
  static wi fresh(long seed, boolean eating, boolean rearing, boolean saddled, int type, Log[] out) throws Exception {
    HorseProbe.clear();
    wi e = HorseProbe.typed(seed, type);
    Log r = new Log(seed); MobMoveProbe.set(e, "Z", r); out[0] = r;
    if (saddled) e.n(true);
    if (eating) e.o(true);
    if (rearing) e.p(true);
    MobMoveProbe.field(wi.class, "bF").setInt(e, 0); // the preset's own bF is not part of the row
    HorseProbe.clear(); r.log.clear();
    return e;
  }
  static void row(String kind, String name, long seed, boolean eating, boolean rearing, String extra, wi e, Log r) throws Exception {
    HorseProbe.out("{\"case\":\"flags\",\"kind\":\"" + kind + "\",\"name\":\"" + name + "\",\"seed\":" + seed + ",\"preEating\":" + eating + ",\"preRearing\":" + rearing + extra + "," + state(e, r) + "}");
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) HorseProbe.u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    HorseProbe.W = world;
    HorseProbe.player = HorseProbe.makePlayer(false);
    MobMoveProbe.field(ahb.class, "E").setBoolean(world, true);
    // name, saddled, yaw start, yaw step per tick, pitch, forward, strafe, jumpPower (int, -9 none), ticks
    Object[][] sc = {
      { "forward", true, 0f, 0f, 0f, 0.98f, 0f, -9, 6 },
      { "turning", true, 350f, 25f, 40f, 0.98f, 0.98f, -9, 8 },
      { "lookUp", true, -170f, -45f, -80f, 0f, 0f, -9, 6 },
      { "jumpPowerSet", true, 90f, 0f, 10f, 0.98f, 0f, 100, 6 },
    };
    for (long seed : new long[] { 1, 6 }) for (Object[] s : sc) {
      HorseProbe.clear();
      wi e = HorseProbe.mountedHorse(seed, (Boolean) s[1], (Float) s[2], (Float) s[4], (Float) s[5], (Float) s[6]);
      MobMoveProbe.set(e, "v", 0.0); MobMoveProbe.set(e, "w", 0.0); MobMoveProbe.set(e, "x", 0.0); // motion
      StringBuilder rows = new StringBuilder();
      float yaw = (Float) s[2];
      for (int i = 0; i < (Integer) s[8]; i++) {
        MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s"));
        MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t"));
        MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
        MobMoveProbe.set(HorseProbe.player, "y", yaw);
        if (i == 0 && (Integer) s[7] != -9) e.w((Integer) s[7]);
        e.e((Float) s[6] * 0.98f, (Float) s[5]);
        e.ac();
        rows.append(i > 0 ? "," : "").append("{\"riderYaw\":" + num(yaw) + ",\"x\":" + num(MobMoveProbe.d(e, "s")) + ",\"y\":" + num(MobMoveProbe.d(e, "t")) + ",\"z\":" + num(MobMoveProbe.d(e, "u"))
          + ",\"mx\":" + num(MobMoveProbe.d(e, "v")) + ",\"my\":" + num(MobMoveProbe.d(e, "w")) + ",\"mz\":" + num(MobMoveProbe.d(e, "x"))
          + ",\"yaw\":" + num(MobMoveProbe.fl(e, "y")) + ",\"prevYaw\":" + num(MobMoveProbe.fl(e, "A")) + ",\"pitch\":" + num(MobMoveProbe.fl(e, "z"))
          + ",\"body\":" + num(MobMoveProbe.fl(e, "aM")) + ",\"head\":" + num(MobMoveProbe.fl(e, "aO")) + ",\"jumpPower\":" + num(MobMoveProbe.fl(e, "bt")) + "}");
        yaw += (Float) s[3];
      }
      HorseProbe.player.a((sa) null);
      HorseProbe.out("{\"case\":\"steer\",\"seed\":" + seed + ",\"name\":\"" + s[0] + "\",\"saddled\":" + s[1] + ",\"pitch\":" + num((Float) s[4]) + ",\"ticks\":[" + rows + "]}");
    }
    // ac(): rider position with a rearing amount (bM) and body yaw (aM)
    for (float bm : new float[] { 0f, 0.3f, 0.7f, 1f }) for (float body : new float[] { 0f, 45f, 90f, 200f, -135f }) {
      HorseProbe.clear();
      wi e = HorseProbe.mountedHorse(1, true, 0f, 0f, 0f, 0f);
      MobMoveProbe.set(e, "bM", bm);
      MobMoveProbe.set(e, "aM", body);
      e.ac();
      HorseProbe.out("{\"case\":\"rear\",\"rearAmount\":" + num(bm) + ",\"body\":" + num(body) + ",\"horse\":[" + num(MobMoveProbe.d(e, "s")) + "," + num(MobMoveProbe.d(e, "t")) + "," + num(MobMoveProbe.d(e, "u"))
        + "],\"rider\":[" + num(MobMoveProbe.d(HorseProbe.player, "s")) + "," + num(MobMoveProbe.d(HorseProbe.player, "t")) + "," + num(MobMoveProbe.d(HorseProbe.player, "u")) + "]}");
      HorseProbe.player.a((sa) null);
    }

    // batch 57: client living sounds
    Object[][] ss = { { "adult", 0, 0, 11L }, { "donkey", 1, 0, 12L }, { "zombie", 3, 0, 13L }, { "foal", 0, -24000, 14L } };
    for (Object[] s : ss) {
      build(HorseProbe.World.class, true);
      HorseProbe.clear();
      wi e = HorseProbe.typed((Long) s[3], (Integer) s[1]);
      if ((Integer) s[2] != 0) e.c((Integer) s[2]);
      Log r = new Log((Long) s[3]); MobMoveProbe.set(e, "Z", r);
      java.lang.reflect.Method h = MobMoveProbe.method(wi.class, "h");
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 1500; i++) {
        r.log.clear(); HorseProbe.World.sounds.clear();
        h.invoke(e);
        rows.append(i > 0 ? "," : "").append("[\"" + String.join(" ", r.log) + "\"" + (HorseProbe.World.sounds.isEmpty() ? "" : "," + list(new ArrayList<>(HorseProbe.World.sounds))) + "]");
      }
      HorseProbe.out("{\"case\":\"sound\",\"name\":\"" + s[0] + "\",\"seed\":" + s[3] + ",\"type\":" + s[1] + ",\"age\":" + e.d() + ",\"ticks\":[" + rows + "]}");
    }
    // batch 57: server flag starters
    build(HorseProbe.World.class, false);
    HorseProbe.player = HorseProbe.makePlayer(false);
    Log[] lg = new Log[1];
    for (boolean eat : new boolean[] { false, true }) {
      wi e = fresh(1, eat, false, false, 0, lg);
      MobMoveProbe.method(wi.class, "aU").invoke(e);
      row("death", "aU", 1, eat, false, "", e, lg[0]);
      for (long seed = 1; seed <= 8; seed++) {
        e = fresh(seed, eat, false, false, 0, lg);
        MobMoveProbe.method(wi.class, "aT").invoke(e);
        row("hurt", "aT", seed, eat, false, "", e, lg[0]);
      }
    }
    for (boolean eat : new boolean[] { false, true }) for (boolean rear : new boolean[] { false, true }) for (long seed = 1; seed <= 12; seed++) {
      if (eat && rear) continue;
      wi e = fresh(seed, eat, rear, false, 0, lg);
      MobMoveProbe.method(wi.class, "t").invoke(e);
      row("idle", "t", seed, eat, rear, "", e, lg[0]);
    }
    for (boolean eat : new boolean[] { false, true }) for (int type : new int[] { 0, 3 }) {
      wi e = fresh(1, eat, false, false, type, lg);
      e.cJ();
      row("angry", "cJ", 1, eat, false, ",\"type\":" + type, e, lg[0]);
    }
    for (boolean eat : new boolean[] { false, true }) for (int p : new int[] { -5, 0, 1, 50, 95 }) for (boolean sad : new boolean[] { false, true }) {
      wi e = fresh(1, eat, false, sad, 0, lg);
      e.w(p);
      row("jump", "w", 1, eat, false, ",\"power\":" + p + ",\"saddled\":" + sad + ",\"bt\":" + num(MobMoveProbe.fl(e, "bt")), e, lg[0]);
    }
    for (float d : new float[] { 5f, 6f, 6.5f, 12f }) {
      wi e = fresh(1, true, false, false, 0, lg);
      MobMoveProbe.method(wi.class, "o", float.class).invoke(e, d);
      row("leash", "o(F)", 1, true, false, ",\"distance\":" + num(d), e, lg[0]);
    }
    for (boolean eat : new boolean[] { false, true }) {
      wi e = fresh(3, eat, false, false, 0, lg);
      MobMoveProbe.method(wi.class, "cL").invoke(e);
      row("feed", "cL", 3, eat, false, "", e, lg[0]);
    }
    // graze: wi.e() (onLivingUpdate) on an all-grass server world; the unridden horse draws nextInt(900) and nextInt(300)
    try {
      build(GrassWorld.class, false);
      for (long seed : new long[] { 5, 8 }) {
        HorseProbe.clear();
        wi e = HorseProbe.typed(seed, 0);
        Log r = new Log(seed); MobMoveProbe.set(e, "Z", r);
        for (Class<?> k = wi.class; k != null; k = k.getSuperclass()) for (Field fd : k.getDeclaredFields()) if (fd.getType() == uj.class) { // empty EntityAITasks: no pathing, only the draws of wi.e()
          fd.setAccessible(true);
          Object tasks = HorseProbe.u.allocateInstance(uj.class);
          for (Field lf : uj.class.getDeclaredFields()) if (java.lang.reflect.Modifier.isStatic(lf.getModifiers())) continue; else if (lf.getType() == java.util.List.class) { lf.setAccessible(true); lf.set(tasks, new ArrayList()); } else if (lf.getType() == qi.class) { lf.setAccessible(true); lf.set(tasks, new qi()); } else if (lf.getType() == int.class) { lf.setAccessible(true); lf.setInt(tasks, 3); }
          fd.set(e, tasks);
        }
        java.lang.reflect.Method live = MobMoveProbe.method(wi.class, "e");
        StringBuilder rows = new StringBuilder();
        for (int i = 0; i < 400; i++) {
          r.log.clear();
          live.invoke(e);
          rows.append(i > 0 ? "," : "").append("[" + bits(e) + "," + MobMoveProbe.field(wi.class, "bD").getInt(e) + ",\"" + String.join(" ", r.log) + "\"]");
        }
        HorseProbe.out("{\"case\":\"graze\",\"seed\":" + seed + ",\"ticks\":[" + rows + "]}");
      }
    } catch (Throwable t) { System.err.println("graze failed: " + t); t.printStackTrace(); }
  }
}
