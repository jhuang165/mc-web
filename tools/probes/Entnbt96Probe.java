import java.util.*;

// Batch 96 entnbt96: what a real EntityPlayerMP (ServerPlayerProbe.make, the unchanged constructor) writes with Entity.writeToNBT (sa.e) after Entity.readFromNBT (sa.f) of
// hand-made compounds (LevelDatProbe.richPlayer plus edits), and what a second player writes after reading that again. One JSON line per case:
// {"name":..,"in":hex of the input,"out":"key=value;..." sorted,"re":same after reload,"live":"hurt death attack sleeping sleepTimer"}.
public class Entnbt96Probe {
  static String q(String s) { return LevelDatProbe.q(s); }
  static String sorted(dh t) {
    TreeSet<String> ks = new TreeSet<>();
    for (Object k : t.c()) ks.add((String) k);
    StringBuilder b = new StringBuilder();
    for (String k : ks) { String v = t.a(k).toString(); if (k.startsWith("UUID")) v = "uuid"; b.append(k).append('=').append(v).append(';'); }
    return b.toString();
  }
  static String live(mw p) throws Exception {
    return MobMoveProbe.field(sv.class, "ax").getInt(p) + "";
  }
  static int n = 0;
  static void run(String name, dh input, Edit after) throws Exception {
    try {
      ServerPlayerProbe.PM p = ServerPlayerProbe.make(LevelDatProbe.world, "p" + (n++));
      if (input != null) p.f(input);
      if (after != null) after.apply(p);
      dh out = new dh(); p.e(out);
      ServerPlayerProbe.PM p2 = ServerPlayerProbe.make(LevelDatProbe.world, "p" + (n++));
      p2.f(out);
      dh re = new dh(); p2.e(re);
      System.out.println("{\"name\":" + q(name) + (input == null ? "" : ",\"in\":\"" + LevelDatProbe.hex(input) + "\"") + ",\"out\":" + q(sorted(out)) + ",\"re\":" + q(sorted(re)) + ",\"hex\":\"" + LevelDatProbe.hex(out) + "\"}");
    } catch (Throwable t) { if (n < 3 && System.getenv("TRACE") != null) { Throwable c = t; while (c.getCause() != null) c = c.getCause(); c.printStackTrace(); } System.out.println("{\"name\":" + q(name) + ",\"error\":" + q(t.toString()) + "}"); }
  }
  interface Edit { void apply(ServerPlayerProbe.PM p) throws Exception; }
  interface TEdit { void apply(dh t) throws Exception; }
  static void edit(String name, TEdit e) throws Exception { dh t = LevelDatProbe.richPlayer(); e.apply(t); run(name, t, null); }

  public static class Stage2 extends ServerPlayerProbe.Stage { // a WorldServer double with one bed block at (10,64,10), metadata in bedMeta
    static int bedMeta = 12;
    public aji a(int x, int y, int z) { return x == 10 && y == 64 && z == 10 ? aji.e(26) : aji.e(0); }
    public int e(int x, int y, int z) { return x == 10 && y == 64 && z == 10 ? bedMeta : 0; }
    public boolean a(int x, int y, int z, int m, int f) { if (x == 10 && y == 64 && z == 10) bedMeta = m; return true; }
    public boolean d(int x, int y, int z) { return true; }
    public boolean c(int x, int y, int z) { return true; }
    public boolean b(int a, int b, int c, int d, int e, int f) { return true; }
    public boolean w() { return false; }
    public mn r() { try { return (mn) LevelDatProbe.u.allocateInstance(Tracker.class); } catch (Exception e) { throw new RuntimeException(e); } }
  }
  public static class Tracker extends mn { Tracker() { super(null); } public void b(sa e, ft packet) {} public void a(sa e) {} }
  static ahb stage2() throws Exception {
    Stage2 w = (Stage2) LevelDatProbe.u.allocateInstance(Stage2.class);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "s", new Random(2)); MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "t", LevelDatProbe.u.allocateInstance(aqq.class));
    return w;
  }
  static java.lang.invoke.MethodHandle tick;
  static java.lang.invoke.MethodHandle wake;
  static double attr(mw p, String n) { return p.bc().a(n).e(); }
  static String vals(mw p) throws Exception {
    return "speed=" + attr(p, "generic.movementSpeed") + ";damage=" + attr(p, "generic.attackDamage") + ";maxHealth=" + attr(p, "generic.maxHealth") + ";effects=" + p.aQ().size()
      + ";attackTime=" + MobMoveProbe.field(sv.class, "aB").getInt(p) + ";hurtTime=" + MobMoveProbe.field(sv.class, "ax").getInt(p) + ";sleeping=" + MobMoveProbe.field(yz.class, "bA").getBoolean(p) + ";sleepTimer=" + MobMoveProbe.field(yz.class, "b").getInt(p)
      + ";motion=" + p.v + "," + p.w + "," + p.x;
  }
  static void stage(String name, String st, mw p) throws Exception {
    dh t = new dh(); p.e(t);
    System.out.println("{\"name\":" + q(name) + ",\"stage\":" + q(st) + ",\"live\":" + q(vals(p)) + ",\"out\":" + q(sorted(t)) + "}");
  }
  static void ticks(String name, mw p, int... stops) throws Exception {
    int done = 0;
    for (int s : stops) {
      try { while (done < s) { tick.invoke((mw) p); done++; } } catch (Throwable t) { Throwable c = t; while (c.getCause() != null) c = c.getCause(); System.out.println("{\"name\":" + q(name) + ",\"stage\":\"tick" + s + "\",\"error\":" + q(c.toString() + " " + c.getStackTrace()[0]) + "}"); return; }
      stage(name, "tick" + s, p);
    }
  }
  static dh effectsTag(int id, int amp, int dur) throws Exception {
    ServerPlayerProbe.PM p0 = ServerPlayerProbe.make(LevelDatProbe.world, "e" + (n++));
    dh t = new dh(); p0.e(t); dq l = new dq(); l.a(LevelDatProbe.effect(id, amp, dur, false)); t.a("ActiveEffects", l); return t;
  }
  static void fx(String name, int id, int amp, int dur) throws Exception {
    ServerPlayerProbe.PM p = ServerPlayerProbe.make(LevelDatProbe.world, "l" + (n++)); p.f(effectsTag(id, amp, dur));
    stage(name + "-loaded", "load", p); ticks(name + "-loaded", p, 1, dur / 2, dur + 2);
    ServerPlayerProbe.PM s = ServerPlayerProbe.make(LevelDatProbe.world, "s" + (n++)); s.c(new rw(id, dur, amp));
    stage(name + "-session", "applied", s);
    dh saved = new dh(); s.e(saved);
    ServerPlayerProbe.PM r = ServerPlayerProbe.make(LevelDatProbe.world, "r" + (n++)); r.f(saved);
    stage(name + "-session-reload", "load", r); ticks(name + "-session-reload", r, 1, dur + 2);
    ticks(name + "-session", s, 1, dur + 2);
  }
  static void tagCase(String name, TEdit e, int... stops) throws Exception { tagCaseIn(name, LevelDatProbe.world, e, stops); }
  static void tagCaseIn(String name, ahb w, TEdit e, int... stops) throws Exception {
    dh t = LevelDatProbe.richPlayer(); e.apply(t);
    try {
      ServerPlayerProbe.PM p = ServerPlayerProbe.make(w, "t" + (n++)); p.f(t);
      stage(name, "load", p); ticks(name, p, stops);
    } catch (Throwable x) { Throwable c = x; while (c.getCause() != null) c = c.getCause(); System.out.println("{\"name\":" + q(name) + ",\"error\":" + q(c.toString() + " " + c.getStackTrace()[0]) + "}"); }
  }

  public static void main(String[] argv) throws Throwable {
    aji.p(); adb.l();
    LevelDatProbe.u = MobMoveProbe.unsafe();
    LevelDatProbe.world = (LevelDatProbe.W) LevelDatProbe.u.allocateInstance(LevelDatProbe.W.class);
    { java.lang.reflect.Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true);
      LevelDatProbe.u.putObject(LevelDatProbe.u.staticFieldBase(jf), LevelDatProbe.u.staticFieldOffset(jf), LevelDatProbe.u.allocateInstance(ServerPlayerProbe.Server.class)); }
    MobMoveProbe.set(LevelDatProbe.world, "C", new qi()); MobMoveProbe.set(LevelDatProbe.world, "s", new Random(2)); MobMoveProbe.set(LevelDatProbe.world, "t", LevelDatProbe.u.allocateInstance(aqq.class));
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(LevelDatProbe.world, new ArrayList()); }
    { java.lang.invoke.MethodHandles.Lookup l = java.lang.invoke.MethodHandles.privateLookupIn(mw.class, java.lang.invoke.MethodHandles.lookup());
      tick = l.findSpecial(sv.class, "C", java.lang.invoke.MethodType.methodType(void.class), mw.class);
      wake = l.findSpecial(yz.class, "a", java.lang.invoke.MethodType.methodType(void.class, boolean.class, boolean.class, boolean.class), mw.class); }
    // 1. effects: loaded from ActiveEffects versus applied in the session (speed 1, strength 5, health boost 21, slowness 2, jump 8)
    fx("speed", 1, 1, 100); fx("strength", 5, 0, 100); fx("healthboost", 21, 1, 100); fx("slowness", 2, 2, 100); fx("jump", 8, 1, 100);
    { // combined modifiers: the saved Modifiers order (HashSet of every modifier) and re-adding a loaded effect
      int[][][] combos = { {{1, 1}, {2, 0}}, {{18, 0}, {5, 1}}, {{1, 0}, {2, 2}, {5, 0}, {18, 1}, {21, 2}}, {{18, 2}, {5, 2}, {1, 3}, {2, 1}, {21, 0}} };
      for (int c = 0; c < combos.length; c++) for (int held : new int[] {0, 276, 257}) for (boolean sprint : new boolean[] {false, true}) {
        ServerPlayerProbe.PM p = ServerPlayerProbe.make(LevelDatProbe.world, "c" + (n++));
        if (held != 0) { yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p); add sw = new add(adb.d(held), 1, 0); inv.a[0] = sw; p.bc().b(sw.D()); }
        if (sprint) p.c(true);
        for (int[] e : combos[c]) p.c(new rw(e[0], 100, e[1]));
        stage("combo" + c + "-held" + held + (sprint ? "-sprint" : ""), "applied", p);
      }
      ServerPlayerProbe.PM p = ServerPlayerProbe.make(LevelDatProbe.world, "ra" + (n++)); p.f(effectsTag(1, 1, 100));
      stage("readd", "loaded", p); p.c(new rw(1, 50, 1)); stage("readd", "same-amp-shorter", p); p.c(new rw(1, 200, 1)); stage("readd", "same-amp-longer", p);
      ServerPlayerProbe.PM q = ServerPlayerProbe.make(LevelDatProbe.world, "rb" + (n++)); q.f(effectsTag(1, 1, 100)); q.c(new rw(1, 50, 0)); stage("readd", "weaker", q);
    }
    // 2. Motion and AttackTime
    tagCase("motion-small", t -> t.a("Motion", LevelDatProbe.doubles(0.1, -0.0784000015258789, 0.0)), 1, 5);
    tagCase("motion-edge", t -> t.a("Motion", LevelDatProbe.doubles(10.0, -10.0, 9.99)));
    tagCase("motion-over", t -> t.a("Motion", LevelDatProbe.doubles(10.5, 0.5, -10.01)));
    tagCase("motion-nan", t -> t.a("Motion", LevelDatProbe.doubles(Double.NaN, Double.POSITIVE_INFINITY, 0.0)));
    tagCase("motion-air", t -> { t.a("Motion", LevelDatProbe.doubles(0.0, 0.0, 0.0)); t.a("OnGround", false); }, 1, 3, 10);
    tagCase("attack-4", t -> t.a("AttackTime", (short) 4), 1, 3, 10);
    tagCase("attack-neg", t -> t.a("AttackTime", (short) -4), 1, 3);
    { // server Motion of a client-driven player: set by knockback (sv.a(sa, float, dx, dz)), then ticked (onEntityUpdate) and moved (Entity.moveEntity, sa.d) over the probe world's floor (y < 0)
      ServerPlayerProbe.PM p = ServerPlayerProbe.make(LevelDatProbe.world, "k" + (n++)); p.b(0.5, 5.0, 0.5);
      stage("knockback", "fresh", p);
      p.a((sa) null, 1f, 0.5, 0.5); stage("knockback", "hit", p);
      ticks("knockback", p, 1, 20);
      p.d(0.3, 0.0, 0.0); stage("knockback", "moved-x", p);
      p.d(0.0, -10.0, 0.0); stage("knockback", "moved-down", p); ticks("knockback-after", p, 1);
    }
    for (int id = 1; id <= 23; id++) for (int amp : new int[] {0, 2}) { // every potion's attribute modifiers when applied in the session: the Attributes list
      ServerPlayerProbe.PM p = ServerPlayerProbe.make(LevelDatProbe.world, "a" + (n++)); try { p.c(new rw(id, 100, amp)); } catch (Throwable t) { continue; }
      dh t = new dh(); p.e(t); System.out.println("{\"potion\":" + id + ",\"amp\":" + amp + ",\"attrs\":" + q(String.valueOf(t.c("Attributes", 10))) + ",\"absorption\":" + p.bs() + ",\"health\":" + p.aS() + "}");
    }
    // 3. sleeping
    tagCaseIn("sleeping-load", stage2(), t -> { Stage2.bedMeta = 12; t.a("Sleeping", true); t.a("SleepTimer", (short) 50); t.a("Pos", LevelDatProbe.doubles(10.5, 64.9375, 10.5)); }, 1, 3);
    tagCaseIn("sleeping-load-100", stage2(), t -> { t.a("Sleeping", true); t.a("SleepTimer", (short) 100); }, 1);
    tagCase("awake-105", t -> { t.a("Sleeping", false); t.a("SleepTimer", (short) 105); }, 1, 4, 5, 6);
    tagCase("awake-timer-50", t -> { t.a("Sleeping", false); t.a("SleepTimer", (short) 50); }, 1, 5, 70);
    tagCase("awake-timer-300", t -> { t.a("Sleeping", false); t.a("SleepTimer", (short) 300); }, 1);
    // wake-up calls on a sleeping player: wakeUpPlayer(immediate, update, setSpawn)
    for (boolean imm : new boolean[] {false, true}) {
      Stage2.bedMeta = 12;
      ServerPlayerProbe.PM p = ServerPlayerProbe.make(stage2(), "w" + (n++));
      MobMoveProbe.field(yz.class, "bA").setBoolean(p, true); MobMoveProbe.field(yz.class, "b").setInt(p, 60);
      MobMoveProbe.field(yz.class, "bB").set(p, new r(10, 64, 10)); p.b(10.5, 64.9375, 10.5);
      String nm = "wake-" + (imm ? "immediate" : "normal");
      stage(nm, "asleep", p);
      wake.invoke((mw) p, imm, false, false);
      stage(nm, "woken", p); ticks(nm, p, 1, 3, 9, 10, 11, 12);
    }
  }
}
