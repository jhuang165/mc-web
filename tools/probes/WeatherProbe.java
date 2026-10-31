import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Records 1.7.10 overworld weather from the unchanged original classes:
//   timers   World.updateWeather (ahb.o) driven over many ticks from a seeded Random: every tick where
//            WorldInfo's rain/thunder timers or flags change by more than the plain countdown, plus
//            sampled prevRain/rain/prevThunder/thunder strengths.
//   sky      World.calculateSkylightSubtracted (a), getSunBrightness (b), getStarBrightness (g),
//            getRainStrength (j), getWeightedThunderStrength (h), getCloudColour (e), getSkyColor (a(sa,F))
//            with rain, thunder and lastLightningBolt set (the celestial angle is a fixture).
//   strike   World.canLightningStrikeAt (y) over rain, sky access, precipitation height and biome.
//   precip   Material.blocksMovement (c) and isLiquid (d) for every block id: the blocks that stop
//            Chunk.getPrecipitationHeight.
//   bolts    EntityLightningBolt (xh) client-side ticks: lightningState, boltLivingTime, sounds,
//            World.lastLightningBolt, from a seeded Entity.rand.
public class WeatherProbe {
  static sun.misc.Unsafe unsafe;
  static final List<String> sounds = new ArrayList<>();

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

  // The server-side/world part shared by every test: a bare World with a fixed biome, celestial angle
  // and a flat air column. World's constructor is bypassed; fields are set by reflection.
  public static class Probe extends ahb {
    int biome = 1;
    float angle = 0;
    int precip = 64;
    boolean sees = true;
    Probe() { super((azc) null, null, (aqo) null, (ahj) null, null); } // never run: allocated without a constructor
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public ahu a(int x, int z) { return ahu.d(biome); }
    public float c(float partial) { return angle; }
    public aji a(int x, int y, int z) { return aji.e(0); }
    public int h(int x, int z) { return precip; }
    public boolean i(int x, int y, int z) { return sees; }
    public void a(double x, double y, double z, String sound, float volume, float pitch) {
      sounds.add("{\"s\":\"" + sound + "\",\"v\":" + num(volume) + ",\"p\":" + num(pitch) + "}");
    }
    void tickWeather() { o(); }
    void state(float pr, float r, float pt, float t, int bolt) { m = pr; n = r; o = pt; p = t; q = bolt; }
    float rain(float partial) { return j(partial); }
    float thunder(float partial) { return h(partial); }
  }

  public static class ProbeBolt extends xh {
    ProbeBolt(ahb w, double x, double y, double z) { super(w, x, y, z); }
    public void C() {} // Entity.onEntityUpdate (profiler, water, fire) needs a populated world
  }

  static Probe world() throws Exception {
    Probe w = (Probe) unsafe.allocateInstance(Probe.class);
    w.biome = 1;
    w.precip = 64;
    w.sees = true;
    set(w, "t", unsafe.allocateInstance(aqq.class)); // WorldProviderSurface; hasNoSky (g) is false
    set(w, "s", new Random(1));
    set(w, "C", new qi());
    set(w, "c", 16777215L); // World.cloudColour's field initialiser (skipped by allocateInstance): white
    return w;
  }

  static String num(float v) { return Float.toString(v); }
  static String num(double v) { return Double.toString(v); }
  static String rgb(azw v) { return "[" + num((float) v.a) + "," + num((float) v.b) + "," + num((float) v.c) + "]"; }

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    unsafe = (sun.misc.Unsafe) f.get(null);
    aji.p();
    StringBuilder out = new StringBuilder("{");

    // ---- timers
    out.append("\"timers\":[");
    int[][] starts = {
      {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0},
      {500, 300, 1, 1}, {1, 1, 1, 0}, {1, 1, 0, 1}, {40, 0, 0, 0},
    };
    long[] seeds = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    for (int i = 0; i < starts.length; i++) {
      Probe w = world();
      w.s = new Random(seeds[i]);
      ays info = (ays) unsafe.allocateInstance(ays.class);
      info.g(starts[i][0]);
      info.f(starts[i][1]);
      info.b(starts[i][2] == 1);
      info.a(starts[i][3] == 1);
      set(w, "x", info);
      int ticks = i < 6 ? 400000 : 70000, step = i < 6 ? 1009 : 53;
      StringBuilder ev = new StringBuilder(), sm = new StringBuilder();
      int pr = info.q(), pt = info.o();
      boolean praining = info.p(), pthundering = info.n();
      for (int t = 1; t <= ticks; t++) {
        w.tickWeather();
        int r = info.q(), th = info.o();
        boolean raining = info.p(), thundering = info.n();
        boolean change = r != pr - 1 || th != pt - 1 || raining != praining || thundering != pthundering;
        // A timer rolled or a flag toggled: the countdown 1 -> 0 toggles, so those are logged too.
        if (change || r <= 0 || th <= 0) {
          if (ev.length() > 0) ev.append(",");
          ev.append("[").append(t).append(",").append(r).append(",").append(th).append(",").append(raining ? 1 : 0).append(",").append(thundering ? 1 : 0).append("]");
        }
        pr = r;
        pt = th;
        praining = raining;
        pthundering = thundering;
        if (t % step == 0 || t < 5) {
          if (sm.length() > 0) sm.append(",");
          sm.append("[").append(t).append(",").append(num(w.m)).append(",").append(num(w.n)).append(",").append(num(w.o)).append(",").append(num(w.p)).append("]");
        }
      }
      if (i > 0) out.append(",");
      out.append("{\"seed\":").append(seeds[i]).append(",\"start\":[").append(starts[i][0]).append(",").append(starts[i][1]).append(",").append(starts[i][2]).append(",").append(starts[i][3])
        .append("],\"ticks\":").append(ticks).append(",\"events\":[").append(ev).append("],\"samples\":[").append(sm).append("]}");
    }
    out.append("]");

    // ---- sky
    float[] angles = {0f, 0.05f, 0.1f, 0.15f, 0.2f, 0.23f, 0.25f, 0.27f, 0.3f, 0.4f, 0.5f, 0.6f, 0.7f, 0.73f, 0.75f, 0.77f, 0.8f, 0.9f, 0.95f};
    float[][] states = { // prevRain, rain, prevThunder, thunder, lastLightningBolt
      {0, 0, 0, 0, 0}, {1, 1, 0, 0, 0}, {0.3f, 0.5f, 0, 0, 0}, {1, 1, 1, 1, 0}, {0.6f, 0.8f, 0.5f, 0.9f, 0},
      {1, 1, 1, 1, 2}, {0, 0, 0, 0, 2}, {0.5f, 0.5f, 0.2f, 0.4f, 1}, {0, 0, 1, 1, 0},
    };
    float[] partials = {0f, 0.37f, 1f};
    int[] biomes = {1, 3, 12}; // plains 0.8, extreme hills 0.2, ice plains 0.0 (only the colour is used)
    out.append(",\"sky\":{\"states\":[");
    for (int s = 0; s < states.length; s++) out.append(s > 0 ? "," : "").append("[" + num(states[s][0]) + "," + num(states[s][1]) + "," + num(states[s][2]) + "," + num(states[s][3]) + "," + (int) states[s][4] + "]");
    out.append("],\"partials\":[0.0,0.37,1.0],\"angles\":[");
    for (int a = 0; a < angles.length; a++) out.append(a > 0 ? "," : "").append(num(angles[a]));
    out.append("],\"biomes\":[1,3,12],\"rows\":[");
    boolean first = true;
    Probe w = world();
    yq e = (yq) unsafe.allocateInstance(yq.class);
    for (int s = 0; s < states.length; s++)
      for (int p = 0; p < partials.length; p++)
        for (int a = 0; a < angles.length; a++) {
          w.angle = angles[a];
          w.state(states[s][0], states[s][1], states[s][2], states[s][3], (int) states[s][4]);
          float part = partials[p];
          StringBuilder row = new StringBuilder();
          row.append("{\"s\":").append(s).append(",\"p\":").append(p).append(",\"a\":").append(a)
            .append(",\"sub\":").append(w.a(part)).append(",\"sun\":").append(num(w.b(part))).append(",\"star\":").append(num(w.g(part)))
            .append(",\"rain\":").append(num(w.rain(part))).append(",\"thunder\":").append(num(w.thunder(part)))
            .append(",\"cloud\":").append(rgb(w.e(part))).append(",\"fog\":").append(rgb(w.f(part))).append(",\"sky\":[");
          for (int b = 0; b < biomes.length; b++) {
            w.biome = biomes[b];
            e.s = 3.5; e.t = 20; e.u = 3.5;
            row.append(b > 0 ? "," : "").append(rgb(w.a(e, part)));
          }
          row.append("]}");
          out.append(first ? "" : ",").append(row);
          first = false;
        }
    out.append("]}");

    // ---- strike
    out.append(",\"strike\":[");
    first = true;
    int[] strikeBiomes = {1, 3, 12, 2, 5, 6, 0};
    float[] rainLevels = {0f, 0.1f, 0.3f, 1f};
    for (int biome : strikeBiomes)
      for (float rain : rainLevels)
        for (int sees = 0; sees < 2; sees++)
          for (int dy = -1; dy <= 1; dy++) {
            w.biome = biome;
            w.sees = sees == 1;
            w.precip = 40 + dy;
            w.state(rain, rain, 0, 0, 0);
            out.append(first ? "" : ",").append("[").append(biome).append(",").append(num(rain)).append(",").append(sees).append(",").append(dy).append(",").append(w.y(5, 40, 5) ? 1 : 0).append("]");
            first = false;
          }
    out.append("]");
    w.sees = true;

    // ---- biome facts
    out.append(",\"biomes\":[");
    for (int b = 0; b < 40; b++) {
      ahu biome = ahu.d(b);
      if (biome == null) continue;
      out.append(b > 0 ? "," : "").append("[").append(b).append(",").append(num(biome.a(5, 40, 5))).append(",").append(biome.e() ? 1 : 0).append(",").append(biome.d() ? 1 : 0).append("]");
    }
    out.append("]");

    // ---- precipitation
    out.append(",\"precipitation\":[");
    first = true;
    for (int id = 0; id < 256; id++) {
      aji b = aji.e(id);
      if (b == null || (id != 0 && b == aji.e(0))) continue;
      awt m = b.o();
      if (m.c() || m.d()) {
        out.append(first ? "" : ",").append("[").append(id).append(",").append(m.c() ? 1 : 0).append(",").append(m.d() ? 1 : 0).append("]");
        first = false;
      }
    }
    out.append("]");

    // ---- bolts
    out.append(",\"bolts\":[");
    Probe bw = world();
    set(bw, "E", true); // client side: no fire, no damage; sets lastLightningBolt
    first = true;
    for (int living = 1; living <= 3; living++)
      for (long seed = 1; seed <= 12; seed++) {
        sounds.clear();
        bw.q = 0;
        ProbeBolt bolt = new ProbeBolt(bw, 4.5, 30, 6.5);
        long ctorVertex = bolt.a;
        set(bolt, "Z", new Random(seed));
        set(bolt, "c", living);
        StringBuilder ticks = new StringBuilder();
        for (int t = 0; t < 120 && !bolt.K; t++) {
          sounds.clear();
          bw.q = 0;
          bolt.h();
          if (t > 0) ticks.append(",");
          ticks.append("{\"state\":").append(get(bolt, "b")).append(",\"living\":").append(get(bolt, "c")).append(",\"vertex\":\"").append(bolt.a).append("\",\"flash\":").append(bw.q)
            .append(",\"dead\":").append(bolt.K).append(",\"sounds\":[").append(String.join(",", sounds)).append("]}");
        }
        out.append(first ? "" : ",").append("{\"living\":").append(living).append(",\"seed\":").append(seed).append(",\"ticks\":[").append(ticks).append("]}");
        first = false;
      }
    out.append("]");

    System.out.println(out.append("}"));
  }
}
