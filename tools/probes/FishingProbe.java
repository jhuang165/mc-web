import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged EntityFishHook (xe), ItemFishingRod (acv), ItemFishFood (act/acu) and
// WeightedRandomFishable (xf) classes against constructor-less doubles: a WorldServer (mt) whose
// blocks are a flat lake (water y 58-62 over stone) or flat ground, whose particle/sound/spawn
// calls are recorded, and an EntityPlayer holding a fishing rod with optional Lure / Luck of the
// Sea. Entity.rand and World.rand are replaced with seeded java.util.Random instances after
// construction; the (World, EntityPlayer) constructor consumes an unseeded Entity.rand for its
// three gaussians, so launch cases build the same direction by hand and call
// EntityThrowable-style setThrowableHeading (xe.c) with a seeded Random.
public class FishingProbe {
  static sun.misc.Unsafe U;
  static final List<String> EFF = new ArrayList<>();

  static Field field(Class<?> c, String n) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(n);
  }
  static void set(Object o, String n, Object v) throws Exception { field(o.getClass(), n).set(o, v); }
  static int gi(Object o, String n) throws Exception { return field(o.getClass(), n).getInt(o); }
  static float gf(Object o, String n) throws Exception { return field(o.getClass(), n).getFloat(o); }
  static boolean gb(Object o, String n) throws Exception { return field(o.getClass(), n).getBoolean(o); }
  static String q(String s) { return "\"" + s + "\""; }

  // ---- doubles ---------------------------------------------------------------------------
  public static class Pl extends yz {
    Pl() { super(null, null); }
    add held; List<String> stats = new ArrayList<>();
    public add be() { return held; }
    public add bF() { return held; }
    public boolean Z() { return true; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public r f_() { return null; }
    public boolean a(int level, String command) { return false; }
    public void a(fj message) {}
    public void a(ph stat, int n) { stats.add(stat.e + "|" + n); }
  }

  public static class W extends mt {
    W() { super(null, null, null, 0, null, null); }
    boolean water = true, lightning = false, sky = true;
    List<String> events = new ArrayList<>();
    List<sa> spawned = new ArrayList<>();
    List<sa> nearby = new ArrayList<>();
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    boolean solid(int y) { return water ? y < 58 : y < 63; }
    public aji a(int x, int y, int z) { return solid(y) ? aji.e(1) : (water && y < 63 ? aji.e(9) : aji.e(0)); }
    public int e(int x, int y, int z) { return 0; }
    public boolean y(int x, int y, int z) { return lightning; }
    public boolean i(int x, int y, int z) { return sky; }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public boolean a(azt box, awt material, sa entity) { return false; }
    public void a(sa entity, String sound, float volume, float pitch) { events.add("sound|" + sound + "|" + volume + "|" + pitch); }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            if (solid(y)) out.add(azt.a(x, y, z, x + 1, y + 1, z + 1));
      return out;
    }
    public List b(sa entity, azt box) { return new ArrayList<>(nearby); }
    public boolean d(sa entity) { spawned.add(entity); return true; }
    public void a(String name, double x, double y, double z, int count, double dx, double dy, double dz, double speed) {
      events.add("particle|" + name + "|" + x + "|" + y + "|" + z + "|" + count + "|" + dx + "|" + dy + "|" + dz + "|" + speed);
    }
  }

  static W world(boolean water, long seed) throws Exception {
    W w = (W) U.allocateInstance(W.class);
    w.water = water; w.events = new ArrayList<>(); w.spawned = new ArrayList<>(); w.nearby = new ArrayList<>(); w.sky = true; w.lightning = false;
    set(w, "s", new Random(seed)); set(w, "C", new qi()); set(w, "t", U.allocateInstance(aqq.class));
    return w;
  }

  static dq nbtList(int[][] pairs) { dq l = new dq(); for (int[] e : pairs) { dh t = new dh(); t.a("id", (short) e[0]); t.a("lvl", (short) e[1]); l.a(t); } return l; }
  static add rod(int luck, int lure) {
    add s = new add(adb.d(346), 1, 0);
    if (luck > 0 || lure > 0) {
      List<int[]> p = new ArrayList<>();
      if (luck > 0) p.add(new int[]{61, luck});
      if (lure > 0) p.add(new int[]{62, lure});
      s.d(new dh()); s.q().a("ench", nbtList(p.toArray(new int[0][])));
    }
    return s;
  }
  static Pl player(W w, double x, double y, double z, float yaw, float pitch, int luck, int lure) throws Exception {
    Pl p = (Pl) U.allocateInstance(Pl.class);
    p.stats = new ArrayList<>(); p.held = rod(luck, lure);
    set(p, "o", w); set(p, "Z", new Random(1)); set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    p.s = x; p.t = y; p.u = z; p.y = yaw; p.z = pitch; set(p, "L", 1.62F);
    return p;
  }
  static xe blank(W w, Pl p, long seed) throws Exception {
    xe h = new xe((ahb) null);
    set(h, "o", w); h.Z = new Random(seed); set(h, "b", p);
    return h;
  }
  // The geometry of xe(World, EntityPlayer) before setThrowableHeading, built with the same float ops.
  static xe launch(W w, Pl p, long seed) throws Exception {
    xe h = blank(w, p, seed);
    double x = p.s, y = p.t + 1.62D - (double) gf(p, "L"), z = p.u;
    h.b(x, y, z, p.y, p.z); // setLocationAndAngles
    h.s -= (double) (qh.b(h.y / 180.0F * 3.1415927F) * 0.16F);
    h.t -= 0.10000000149011612D;
    h.u -= (double) (qh.a(h.y / 180.0F * 3.1415927F) * 0.16F);
    h.b(h.s, h.t, h.u);
    set(h, "L", 0.0F);
    float f = 0.4F;
    h.v = (double) (-qh.a(h.y / 180.0F * 3.1415927F) * qh.b(h.z / 180.0F * 3.1415927F) * f);
    h.x = (double) (qh.b(h.y / 180.0F * 3.1415927F) * qh.b(h.z / 180.0F * 3.1415927F) * f);
    h.w = (double) (-qh.a(h.z / 180.0F * 3.1415927F) * f);
    h.c(h.v, h.w, h.x, 1.5F, 1.0F);
    p.bK = h;
    return h;
  }

  static String d(double v) { return Double.toString(v); }
  static String state(int tick, xe h) {
    return "[" + tick + "," + d(h.s) + "," + d(h.t) + "," + d(h.u) + "," + d(h.v) + "," + d(h.w) + "," + d(h.x) + "]";
  }
  static String timers(int tick, xe h) throws Exception {
    return "[" + tick + "," + gi(h, "ax") + "," + gi(h, "ay") + "," + gi(h, "az") + "," + gf(h, "aA") + "," + gi(h, "av") + "," + gi(h, "aw") + "," + h.a + "," + (gb(h, "au") ? 1 : 0) + "]";
  }
  static String list(List<String> l) { StringBuilder b = new StringBuilder("["); for (String s : l) { if (b.length() > 1) b.append(','); b.append(q(s)); } return b.append(']').toString(); }

  static String enc(add s) {
    if (s == null) return "null";
    dq e = s.r();
    StringBuilder en = new StringBuilder("[");
    if (e != null) for (int i = 0; i < e.c(); i++) { if (i > 0) en.append(','); en.append('[').append(e.b(i).e("id")).append(',').append(e.b(i).e("lvl")).append(']'); }
    StringBuilder st = new StringBuilder("[");
    dq stored = s.p() && s.q().b("StoredEnchantments", 9) ? s.q().c("StoredEnchantments", 10) : null;
    if (stored != null) for (int i = 0; i < stored.c(); i++) { if (i > 0) st.append(','); st.append('[').append(stored.b(i).e("id")).append(',').append(stored.b(i).e("lvl")).append(']'); }
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + en + "]," + st + "]]";
  }

  // The reel-in result: return value, spawned drop/orb, stats, hook state.
  static String reel(W w, Pl p, xe h) throws Exception {
    w.spawned.clear(); p.stats.clear();
    int ret = h.e();
    StringBuilder sp = new StringBuilder("[");
    for (sa e : w.spawned) {
      if (sp.length() > 1) sp.append(',');
      if (e instanceof xk) { xk it = (xk) e; sp.append("{\"kind\":\"item\",\"stack\":").append(enc(it.f())).append(",\"x\":").append(d(it.s)).append(",\"y\":").append(d(it.t)).append(",\"z\":").append(d(it.u))
        .append(",\"vx\":").append(d(it.v)).append(",\"vy\":").append(d(it.w)).append(",\"vz\":").append(d(it.x)).append('}'); }
      else if (e instanceof sq) { sq o = (sq) e; sp.append("{\"kind\":\"orb\",\"value\":").append(o.e()).append(",\"x\":").append(d(o.s)).append(",\"y\":").append(d(o.t)).append(",\"z\":").append(d(o.u)).append('}'); }
      else sp.append("{\"kind\":").append(q(e.getClass().getName())).append('}');
    }
    return "{\"ret\":" + ret + ",\"dead\":" + h.K + ",\"playerHook\":" + (p.bK == null ? "null" : "\"set\"") + ",\"spawned\":" + sp + "],\"stats\":" + list(p.stats) + "}";
  }

  // [return, stack, orb value, stat, item velocity y] of one reel-in.
  static String compact(W w, Pl p, xe h) throws Exception {
    w.spawned.clear(); p.stats.clear();
    int ret = h.e();
    String stack = "null"; int orb = 0; String vel = "0";
    for (sa e : w.spawned) { if (e instanceof xk) { stack = enc(((xk) e).f()); vel = d(e.w); } if (e instanceof sq) orb = ((sq) e).e(); }
    return "[" + ret + "," + stack + "," + orb + "," + list(p.stats) + "," + vel + "]";
  }

  static void tables() throws Exception {
    String[] names = {"d", "e", "f"}, kinds = {"junk", "treasure", "fish"};
    for (int k = 0; k < 3; k++) {
      java.util.List<?> l = (java.util.List<?>) field(xe.class, names[k]).get(null);
      StringBuilder b = new StringBuilder("[");
      for (Object o : l) {
        xf f = (xf) o; add s = (add) field(xf.class, "b").get(f);
        if (b.length() > 1) b.append(',');
        b.append("{\"weight\":").append(gi(f, "a")).append(",\"stack\":").append(enc(s)).append(",\"damaged\":").append(gf(f, "c")).append(",\"enchanted\":").append(gb(f, "d")).append('}');
      }
      System.out.println("{\"kind\":\"table\",\"name\":" + q(kinds[k]) + ",\"entries\":" + b + "]}");
    }
  }

  static void food() throws Exception {
    adb raw = adb.d(349), cooked = adb.d(350);
    StringBuilder b = new StringBuilder("[");
    for (acu t : acu.values()) {
      if (b.length() > 1) b.append(',');
      add rs = new add(raw, 1, t.a()), cs = new add(cooked, 1, t.a());
      b.append("{\"meta\":").append(t.a()).append(",\"name\":").append(q(t.b())).append(",\"rawHeal\":").append(t.c()).append(",\"rawSaturation\":").append(t.d())
        .append(",\"cookedHeal\":").append(t.e()).append(",\"cookedSaturation\":").append(t.f()).append(",\"hasCooked\":").append(t.i())
        .append(",\"itemRawHeal\":").append(((act) raw).g(rs)).append(",\"itemRawSaturation\":").append(((act) raw).h(rs))
        .append(",\"itemCookedHeal\":").append(t.i() ? ((act) cooked).g(cs) : -1).append(",\"itemCookedSaturation\":").append(t.i() ? ((act) cooked).h(cs) : -1)
        .append(",\"unlocalized\":").append(q(raw.a(rs))).append('}');
    }
    add rod = new add(adb.d(346));
    System.out.println("{\"kind\":\"food\",\"types\":" + b + "],\"rodMaxDamage\":" + rod.l() + ",\"rodEnchantability\":" + rod.b().c()
      + ",\"rodFull3D\":" + rod.b().f() + ",\"rodRotates\":" + rod.b().g() + "}");
  }

  // Native ItemFishFood.onFoodEaten (act.c) for a pufferfish: the potion effects it hands the player.
  static void pufferEffects() throws Exception {
    EFF.clear();
    final List<String> eff = EFF;
    class EP extends Pl { EP() { super(); } public void c(rw e) { EFF.add(e.a() + "|" + e.b() + "|" + e.c()); } }
    W w = world(true, 1);
    EP p = (EP) U.allocateInstance(EP.class);
    p.held = null; p.stats = new ArrayList<>();
    set(p, "o", w); set(p, "Z", new Random(1)); set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    java.lang.reflect.Method m = field(act.class, "b").getDeclaringClass().getDeclaredMethod("c", add.class, ahb.class, yz.class);
    m.setAccessible(true);
    String[] names = {"cod", "salmon", "clownfish", "pufferfish"};
    StringBuilder b = new StringBuilder("[");
    for (int meta = 0; meta < 4; meta++) {
      eff.clear();
      try { m.invoke(adb.d(349), new add(adb.d(349), 1, meta), w, p); } catch (Exception e) { eff.add("error|" + e.getCause()); }
      if (b.length() > 1) b.append(',');
      b.append("{\"type\":").append(q(names[meta])).append(",\"effects\":").append(list(eff)).append('}');
    }
    System.out.println("{\"kind\":\"effects\",\"cases\":" + b + "]}");
  }

  static void launches() throws Exception {
    float[][] views = {{0, 0}, {90, 0}, {-45, -30}, {180, 20}, {33.5F, -75.25F}, {270, 60}, {-170.125F, 5.5F}};
    for (int i = 0; i < views.length; i++) {
      W w = world(true, 1);
      Pl p = player(w, 12.5, 63.0, -7.25, views[i][0], views[i][1], 0, 0);
      xe real = new xe(w, p); // unseeded Entity.rand: only position/heading magnitude are comparable
      xe h = launch(w, p, 4000 + i);
      System.out.println("{\"kind\":\"launch\",\"yaw\":" + views[i][0] + ",\"pitch\":" + views[i][1] + ",\"seed\":" + (4000 + i)
        + ",\"real\":{\"x\":" + d(real.s) + ",\"y\":" + d(real.t) + ",\"z\":" + d(real.u) + ",\"vx\":" + d(real.v) + ",\"vy\":" + d(real.w) + ",\"vz\":" + d(real.x) + "}"
        + ",\"hook\":{\"x\":" + d(h.s) + ",\"y\":" + d(h.t) + ",\"z\":" + d(h.u) + ",\"vx\":" + d(h.v) + ",\"vy\":" + d(h.w) + ",\"vz\":" + d(h.x) + ",\"yaw\":" + h.y + ",\"pitch\":" + h.z + ",\"prevYaw\":" + h.A + ",\"prevPitch\":" + h.B + "}}");
    }
  }

  // One cast: flight into the lake and bobbing until the bite, then (optionally) the reel-in.
  static void cast(String name, boolean water, long seed, float yaw, float pitch, int luck, int lure, boolean lightning, boolean sky, int extraTicks, int maxTicks, boolean reelAtBite) throws Exception {
    W w = world(water, seed + 1); w.lightning = lightning; w.sky = sky;
    Pl p = player(w, 0.5, 63.0, 0.5, yaw, pitch, luck, lure);
    xe h = launch(w, p, seed);
    StringBuilder trace = new StringBuilder("["), timers = new StringBuilder("[");
    int bite = -1, tick = 0;
    for (; tick < maxTicks; tick++) {
      h.h();
      if (tick < 80 || tick % 20 == 0) { if (trace.length() > 1) trace.append(','); trace.append(state(tick, h)); }
      if (tick % 10 == 0 || (bite >= 0 && tick <= bite + 3)) { if (timers.length() > 1) timers.append(','); timers.append(timers(tick, h)); }
      if (h.K) break;
      if (bite < 0 && gi(h, "ax") > 0) bite = tick;
      if (bite >= 0 && tick >= bite + extraTicks) break;
    }
    String reel = reelAtBite || !water ? reel(w, p, h) : "null";
    System.out.println("{\"kind\":\"cast\",\"name\":" + q(name) + ",\"water\":" + water + ",\"seed\":" + seed + ",\"yaw\":" + yaw + ",\"pitch\":" + pitch + ",\"luck\":" + luck + ",\"lure\":" + lure
      + ",\"lightning\":" + lightning + ",\"sky\":" + sky + ",\"maxTicks\":" + maxTicks + ",\"extraTicks\":" + extraTicks + ",\"bite\":" + bite + ",\"endTick\":" + tick + ",\"dead\":" + h.K
      + ",\"inGround\":" + gb(h, "au") + ",\"trace\":" + trace + "],\"timers\":" + timers + "],\"events\":" + list(w.events) + ",\"final\":" + state(tick, h) + ",\"reel\":" + reel + "}");
  }

  static void groundDespawn() throws Exception {
    W w = world(false, 7);
    Pl p = player(w, 0.5, 64.0, 0.5, 20, -10, 0, 0);
    xe h = launch(w, p, 9);
    int landed = -1, dead = -1;
    for (int tick = 1; tick <= 1300; tick++) {
      h.h();
      if (landed < 0 && gb(h, "au")) landed = tick;
      if (h.K) { dead = tick; break; }
    }
    System.out.println("{\"kind\":\"ground\",\"landed\":" + landed + ",\"dead\":" + dead + ",\"inGround\":" + gb(h, "au") + ",\"final\":" + state(dead, h) + ",\"playerHook\":" + (p.bK == null ? "null" : "\"set\"") + "}");
  }

  static void reelCases() throws Exception {
    // Reeling with no bite in the water, in the ground, and with a hooked entity.
    W w = world(true, 3);
    Pl p = player(w, 0.5, 63.0, 0.5, 0, 0, 0, 0);
    xe h = launch(w, p, 11);
    for (int i = 0; i < 40; i++) h.h();
    System.out.println("{\"kind\":\"reel\",\"case\":\"water-no-bite\",\"result\":" + reel(w, p, h) + "}");

    W g = world(false, 3);
    Pl pg = player(g, 0.5, 64.0, 0.5, 0, 20, 0, 0);
    xe hg = launch(g, pg, 12);
    for (int i = 0; i < 20; i++) hg.h();
    System.out.println("{\"kind\":\"reel\",\"case\":\"ground\",\"inGround\":" + gb(hg, "au") + ",\"result\":" + reel(g, pg, hg) + "}");

    W e = world(true, 3);
    Pl pe = player(e, 4.0, 70.0, -2.0, 0, 0, 0, 0);
    xe he = launch(e, pe, 13);
    sa target = (sa) U.allocateInstance(wo.class);
    target.s = 10.0; target.t = 64.0; target.u = 3.0; target.v = 0.25; target.w = -0.5; target.x = 0.125;
    he.s = 1.0; he.t = 63.5; he.u = 2.0; set(he, "ax", 0);
    he.c = target;
    String res = reel(e, pe, he);
    System.out.println("{\"kind\":\"reel\",\"case\":\"entity\",\"target\":{\"vx\":" + d(target.v) + ",\"vy\":" + d(target.w) + ",\"vz\":" + d(target.x) + "},\"player\":{\"x\":" + d(pe.s) + ",\"y\":" + d(pe.t) + ",\"z\":" + d(pe.u) + "},\"hook\":{\"x\":1.0,\"y\":63.5,\"z\":2.0},\"result\":" + res + "}");
  }

  static void loot() throws Exception {
    int[][] configs = {{0, 0}, {1, 0}, {2, 0}, {3, 0}, {0, 3}, {3, 3}};
    int trials = 400;
    Random master = new Random(17101710L);
    for (int[] c : configs) {
      StringBuilder rows = new StringBuilder("[");
      for (int i = 0; i < trials; i++) {
        W w = world(true, master.nextLong());
        Pl p = player(w, 5.0, 63.0, 5.0, 0, 0, c[0], c[1]);
        xe h = blank(w, p, master.nextLong());
        h.s = 1.5; h.t = 63.25; h.u = -2.0;
        set(h, "ax", 20);
        p.bK = h;
        if (rows.length() > 1) rows.append(',');
        rows.append(compact(w, p, h));
      }
      System.out.println("{\"kind\":\"loot\",\"luck\":" + c[0] + ",\"lure\":" + c[1] + ",\"trials\":" + trials + ",\"rows\":" + rows + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    tables(); food(); pufferEffects(); launches();
    // yaw, pitch chosen to land inside the lake a few blocks out
    cast("lure0", true, 21, 30, -35, 0, 0, false, true, 4, 1500, true);
    cast("lure0-sky-closed", true, 22, 140, -40, 0, 0, false, false, 4, 1500, true);
    cast("lure3", true, 23, -60, -30, 0, 3, false, true, 4, 1500, true);
    cast("rain-open", true, 24, 10, -45, 0, 0, true, true, 4, 1500, true);
    cast("rain-covered", true, 25, 200, -45, 0, 1, true, false, 4, 1500, true);
    cast("luck3-lure2", true, 26, 75, -50, 3, 2, false, true, 6, 1500, true);
    cast("no-reel-expire", true, 27, 5, -40, 0, 0, false, true, 40, 1500, false);
    groundDespawn(); reelCases(); loot();
  }
}
