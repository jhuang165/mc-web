import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Runs the unchanged client classes of the 1.7.10 JAR against an Unsafe-allocated (constructor-free) environment:
//  - EntityRenderer (blt).getNightVisionBrightness a(yz, F) with real potion effects,
//  - EntityRenderer.updateFogColor j(F) (fog colour terms: void factor, Blindness, Night Vision) with a scripted world,
//  - EntityRenderer.updateLightmap i(F) (the 256-entry lightmap with and without Night Vision, three gamma settings),
//  - World.getClosestVulnerablePlayer b(DDDD) (sneaking / invisible / armour scaling of the detection range),
//  - RenderGlobal.playAuxSFX a(yz, I, I, I, I, I) world event 2002 (splash bottle: 8 iconcrack + 100 spell particles) with a seeded
//    java.util.Random; the particle factory, world sound call and RenderGlobal.doSpawnParticle are overridden to record.
// The GL calls (glClearColor, the lightmap texture upload) throw after the colour fields are written; those fields are read back.
// setupFog (blt.a(I,F)) and EntityPlayerSP.onLivingUpdate (the portal timer) call GL / need a full client, so their records are replays of
// the bytecode formulas and are flagged "replay" (tools/research/entity-renderer-1.7.10-bytecode.txt, javap blk). Nothing is patched.
public class PotionFxProbe {
  static sun.misc.Unsafe U;
  static Object alloc(Class<?> c) throws Exception { return U.allocateInstance(c); }
  static Field field(Class<?> c, String n) throws Exception {
    for (Class<?> k = c; k != null; k = k.getSuperclass()) {
      try { Field f = k.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) { }
    }
    throw new NoSuchFieldException(c + "." + n);
  }
  static void set(Object o, String n, Object v) throws Exception { field(o.getClass(), n).set(o, v); }
  static Object get(Object o, String n) throws Exception { return field(o.getClass(), n).get(o); }
  static String num(double d) { return Double.isNaN(d) ? "\"NaN\"" : Double.isInfinite(d) ? "\"Inf\"" : Double.toString(d); }
  static String num(float d) { return Float.isNaN(d) ? "\"NaN\"" : Float.isInfinite(d) ? "\"Inf\"" : Float.toString(d); }

  // A world with scripted colours; everything the fog and lightmap code asks the world for is answered here.
  public static class World extends bjf {
    float rain, thunder, sun, celestial; // field initialisers do not run on Unsafe-allocated objects
    double[] fog, sky;
    public World() { super(null, null, 0, null, null); }
    @Override public float b(float p) { return sun; }
    @Override public float j(float p) { return rain; }
    @Override public float h(float p) { return thunder; }
    @Override public float c(float p) { return celestial; }
    @Override public float d(float p) { return celestial; }
    @Override public azw f(float p) { return azw.a(fog[0], fog[1], fog[2]); }
    @Override public azw a(sa e, float p) { return azw.a(sky[0], sky[1], sky[2]); }
    @Override public azw e(float p) { return azw.a(0.2, 0.2, 0.2); }
    @Override public aji a(int x, int y, int z) { return aji.e(0); }
  }
  // Players for World.getClosestVulnerablePlayer.
  public static class Player extends bjk {
    boolean sneak, invisible, dead; float armor; double px, py, pz;
    public Player() { super(null, null, null, null, null); }
    @Override public boolean an() { return sneak; }
    @Override public boolean ap() { return invisible; }
    @Override public float bE() { return armor; }
    @Override public boolean Z() { return !dead; }
    @Override public double e(double x, double y, double z) { double dx = px - x, dy = py - y, dz = pz - z; return dx * dx + dy * dy + dz * dz; }
  }
  // RenderGlobal with the particle factory and world events recorded.
  public static class Recorder extends bma {
    StringBuilder log = new StringBuilder();
    List<Object[]> particles = new ArrayList<>();
    public Recorder() { super(null); }
    @Override public void a(String n, double x, double y, double z, double vx, double vy, double vz) {
      record(n, x, y, z, vx, vy, vz, null);
    }
    @Override public bkm b(String n, double x, double y, double z, double vx, double vy, double vz) {
      try {
        bkm p = (bkm) alloc(bkm.class);
        record(n, x, y, z, vx, vy, vz, p);
        return p;
      } catch (Exception e) { throw new RuntimeException(e); }
    }
    void record(String n, double x, double y, double z, double vx, double vy, double vz, bkm p) { particles.add(new Object[] { n, x, y, z, vx, vy, vz, p }); }
  }
  public static class Client extends bjf {
    List<String> sounds = new ArrayList<>();
    public Client() { super(null, null, 0, null, null); }
    @Override public void a(double x, double y, double z, String n, float v, float p, boolean d) { sounds.add("{\"sound\":\"" + n + "\",\"x\":" + num(x) + ",\"y\":" + num(y) + ",\"z\":" + num(z) + ",\"volume\":" + num(v) + ",\"pitch\":" + num(p) + "}"); }
  }

  static Object renderer, mc, settings, player;
  static World world;

  static void setup() throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    world = (World) alloc(World.class);
    world.rain = 0; world.thunder = 0; world.sun = 1f; world.celestial = 0.3f;
    set(world, "s", new Random(1));
    aqq provider = (aqq) alloc(aqq.class);
    float[] table = new float[16];
    for (int i = 0; i <= 15; i++) { float f1 = 1.0F - (float) i / 15.0F; table[i] = (1.0F - f1) / (f1 * 3.0F + 1.0F) * (1.0F - 0.0F) + 0.0F; } // WorldProvider.generateLightBrightnessTable with ambient 0
    provider.h = table;
    provider.i = 0;
    field(aqo.class, "j").set(provider, new float[4]); // calcSunriseSunsetColors scratch array (field initialiser)
    set(provider, "c", ahm.b); // WorldType.DEFAULT
    set(world, "t", provider);
    bao client = (bao) alloc(bao.class);
    mc = client;
    bbj gs = (bbj) alloc(bbj.class);
    settings = gs;
    gs.c = 8;      // renderDistanceChunks
    gs.e = false;  // anaglyph
    gs.aG = 0f;    // gammaSetting
    client.u = gs;
    client.f = world;
    Player p = (Player) alloc(Player.class);
    field(sv.class, "f").set(p, new HashMap<Integer, rw>());
    yw abilities = (yw) alloc(yw.class);
    p.bE = abilities;
    player = p;
    client.h = (bjk) p;
    client.i = (sv) p;
    blt er = (blt) alloc(blt.class);
    renderer = er;
    set(er, "t", client);
    set(er, "an", 1f); set(er, "ao", 1f);   // fogColor brightness 1
    set(er, "Z", 0f); set(er, "aa", 0f);    // no boss colour modifier
    set(er, "ab", false);
    set(er, "u", 8f * 16f);                 // farPlaneDistance
  }
  static void effects(Map<Integer, Integer> list) throws Exception {
    HashMap<Integer, rw> map = (HashMap<Integer, rw>) field(sv.class, "f").get(player);
    map.clear();
    for (Map.Entry<Integer, Integer> e : list.entrySet()) map.put(e.getKey(), new rw(e.getKey(), e.getValue()));
  }
  static Method priv(Class<?> c, String n, Class<?>... types) throws Exception { Method m = c.getDeclaredMethod(n, types); m.setAccessible(true); return m; }

  public static void main(String[] args) throws Exception {
    setup();
    StringBuilder out = new StringBuilder();
    // --- night vision brightness
    Method nv = priv(blt.class, "a", yz.class, float.class);
    float[] partials = { 0f, 0.25f, 0.5f, 0.75f, 1f };
    StringBuilder rows = new StringBuilder();
    int[] durations = new int[260];
    for (int i = 0; i < durations.length; i++) durations[i] = i + 1;
    for (int d : durations) {
      effects(Map.of(16, d));
      for (float p : partials) rows.append(rows.length() > 0 ? "," : "").append("[").append(d).append(",").append(num(p)).append(",").append(num((float) nv.invoke(renderer, (yz) player, p))).append("]");
    }
    out.append("{\"case\":\"nightVision\",\"rows\":[").append(rows).append("]}\n");

    // --- updateFogColor j(F)
    Method fogM = priv(blt.class, "j", float.class);
    rows = new StringBuilder();
    double[] ys = { -10, 0, 8, 16, 31.5, 32, 48, 63, 100, 250 };
    int[] blind = { 0, 1, 5, 10, 19, 20, 21, 100 };
    int[] night = { 0, 5, 30, 150, 199, 200, 201, 1000 };
    double[][] bases = { { 0.7, 0.8, 1.0 }, { 0.02, 0.03, 0.05 } };
    int[] chunkChoices = { 2, 8, 16 };
    for (double[] base : bases) for (int chunks : chunkChoices) for (double y : ys) for (int b : blind) for (int n : night) {
      if (chunks != 8 && (b != 0 || n != 0) && (y != 31.5 && y != 63)) continue;
      world.fog = base; world.sky = new double[] { base[2], base[0], base[1] };
      ((bbj) settings).c = chunks;
      Map<Integer, Integer> m = new LinkedHashMap<>();
      if (b > 0) m.put(15, b);
      if (n > 0) m.put(16, n);
      effects(m);
      player.getClass();
      field(sa.class, "t").setDouble(player, y); field(sa.class, "T").setDouble(player, y);
      for (String nm : new String[] { "m", "n", "o" }) set(renderer, nm, 0f);
      try { fogM.invoke(renderer, 1.0f); } catch (java.lang.reflect.InvocationTargetException e) { if (System.getenv("PROBE_DEBUG") != null) e.getCause().printStackTrace(); if (!(e.getCause() instanceof LinkageError) && !(e.getCause() instanceof RuntimeException)) throw e; }
      rows.append(rows.length() > 0 ? "," : "").append("[").append(num(base[0])).append(",").append(num(base[1])).append(",").append(num(base[2])).append(",").append(chunks).append(",").append(num(y)).append(",").append(b).append(",").append(n)
        .append(",").append(num((float) get(renderer, "m"))).append(",").append(num((float) get(renderer, "n"))).append(",").append(num((float) get(renderer, "o"))).append("]");
    }
    out.append("{\"case\":\"fogColor\",\"columns\":[\"fogR\",\"fogG\",\"fogB\",\"chunks\",\"feetY\",\"blindness\",\"nightVision\",\"outR\",\"outG\",\"outB\"],\"rows\":[").append(rows).append("]}\n");
    ((bbj) settings).c = 8;

    // --- updateLightmap i(F)
    Method lm = priv(blt.class, "i", float.class);
    rows = new StringBuilder();
    float[] suns = { 1f, 0.6f, 0.2f };
    float[] flickers = { 0f, 0.7f, -0.4f };
    float[] gammas = { 0f, 0.5f, 1f };
    int[] nights = { 0, 30, 100, 199, 300 };
    for (float sun : suns) for (float fl : flickers) for (float g : gammas) for (int n : nights) {
      if (n != 0 && !(sun == 0.2f)) { if (g != 0f && g != 1f) continue; }
      world.sun = sun;
      ((bbj) settings).aG = g;
      set(renderer, "f", fl);
      effects(n > 0 ? Map.of(16, n) : Map.of());
      int[] colors = (int[]) get(renderer, "U");
      if (colors == null || colors.length != 256) { colors = new int[256]; set(renderer, "U", colors); }
      Arrays.fill(colors, 0);
      try { lm.invoke(renderer, 1.0f); } catch (java.lang.reflect.InvocationTargetException e) { if (!(e.getCause() instanceof RuntimeException) && !(e.getCause() instanceof LinkageError)) throw e; }
      StringBuilder row = new StringBuilder();
      for (int c : colors) row.append(row.length() > 0 ? "," : "").append(c);
      rows.append(rows.length() > 0 ? "," : "").append("{\"sun\":").append(num(sun)).append(",\"flicker\":").append(num(fl)).append(",\"gamma\":").append(num(g)).append(",\"nightVision\":").append(n).append(",\"argb\":[").append(row).append("]}");
    }
    out.append("{\"case\":\"lightmap\",\"rows\":[").append(rows).append("]}\n");
    effects(Map.of());

    // --- World.getClosestVulnerablePlayer
    rows = new StringBuilder();
    for (int sneak = 0; sneak < 2; sneak++) for (int inv = 0; inv < 2; inv++) for (int armor = 0; armor <= 4; armor++) {
      Player p = (Player) alloc(Player.class);
      yw ab = (yw) alloc(yw.class);
      p.bE = ab; p.sneak = sneak == 1; p.invisible = inv == 1; p.armor = armor / 4f; p.px = 100; p.py = 64; p.pz = 100;
      List<Object> list = new ArrayList<>(); list.add(p);
      world.h = list;
      StringBuilder bits = new StringBuilder();
      for (int i = 1; i <= 80; i++) bits.append(world.b(100 + i * 0.2, 64, 100, 16) != null ? '1' : '0');
      rows.append(rows.length() > 0 ? "," : "").append("[").append(sneak).append(",").append(inv).append(",").append(armor).append(",\"").append(bits).append("\"]");
    }
    out.append("{\"case\":\"detection\",\"range\":16,\"step\":0.2,\"columns\":[\"sneaking\",\"invisible\",\"armorPieces\",\"foundByDistance\"],\"rows\":[").append(rows).append("]}\n");

    // --- RenderGlobal.playAuxSFX 2002
    rows = new StringBuilder();
    int[] damages = { 16384 | 8193, 16384 | 8225, 16384 | 8194, 16384 | 8196, 16384 | 8201, 16384 | 8230, 16384 | 8236, 16384 | 8261, 16384 | 16, 16384 | 0, 16384 | 8229, 16384 | 8206 };
    long[] seeds = { 1L, 42L, 123456789L };
    for (int dmg : damages) for (long seed : seeds) {
      Client w = (Client) alloc(Client.class);
      w.sounds = new ArrayList<>();
      Random rnd = new Random(seed);
      set(w, "s", rnd);
      Recorder r = (Recorder) alloc(Recorder.class);
      set(r, "r", w);
      r.particles = new ArrayList<>();
      int x = 12, y = 64, z = -5;
      try { r.a((yz) null, 2002, x, y, z, dmg); } catch (Throwable t) { if (!(t instanceof NullPointerException) && !(t instanceof LinkageError)) throw t; }
      StringBuilder ps = new StringBuilder();
      for (Object[] p : r.particles) {
        bkm k = (bkm) p[7];
        ps.append(ps.length() > 0 ? "," : "").append("[\"").append(p[0]).append("\",").append(num((double) p[1])).append(",").append(num((double) p[2])).append(",").append(num((double) p[3])).append(",").append(num((double) p[4])).append(",").append(num((double) p[5])).append(",").append(num((double) p[6]));
        if (k != null) ps.append(",").append(num((float) get(k, "at"))).append(",").append(num((float) get(k, "au"))).append(",").append(num((float) get(k, "av"))).append(",").append(num(field(sa.class, "v").getDouble(k))).append(",").append(num(field(sa.class, "w").getDouble(k))).append(",").append(num(field(sa.class, "x").getDouble(k)));
        ps.append("]");
      }
      StringBuilder ss = new StringBuilder();
      for (String s : w.sounds) ss.append(ss.length() > 0 ? "," : "").append(s);
      rows.append(rows.length() > 0 ? "," : "").append("{\"damage\":").append(dmg).append(",\"seed\":").append(seed).append(",\"pos\":[").append(x).append(",").append(y).append(",").append(z).append("],\"particles\":[").append(ps).append("],\"sounds\":[").append(ss).append("]}");
    }
    out.append("{\"case\":\"splashBreak\",\"columns\":[\"name\",\"x\",\"y\",\"z\",\"vx\",\"vy\",\"vz\",\"r\",\"g\",\"b\",\"mx\",\"my\",\"mz\"],\"rows\":[").append(rows).append("]}\n");

    // --- replays of the bytecode formulas that need GL or a full client (flagged "replay")
    rows = new StringBuilder();
    for (int d = 0; d <= 25; d++) {
      float end = 5.0F; // setupFog, Blindness: duration < 20 widens the far plane from 5 towards farPlaneDistance
      float far = 8 * 16f;
      if (d < 20) end = 5.0F + (far - 5.0F) * (1.0F - (float) d / 20.0F);
      rows.append(rows.length() > 0 ? "," : "").append("[").append(d).append(",").append(num(end * 0.25F)).append(",").append(num(end)).append("]");
    }
    out.append("{\"case\":\"blindnessFog\",\"kind\":\"replay\",\"far\":128,\"columns\":[\"duration\",\"start\",\"end\"],\"rows\":[").append(rows).append("]}\n");
    rows = new StringBuilder();
    // EntityPlayerSP.onLivingUpdate: the portal timer for a Nausea effect of `n` ticks, and EntityRenderer's warp scale per amount.
    for (int n : new int[] { 40, 61, 100, 300 }) {
      float cur = 0f; StringBuilder s = new StringBuilder();
      for (int t = 0; t < 200; t++) {
        float prev = cur;
        int dur = n - t;
        if (dur > 60) { cur += 0.006666667F; if (cur > 1.0F) cur = 1.0F; }
        else { if (cur > 0.0F) cur -= 0.05F; if (cur < 0.0F) cur = 0.0F; }
        s.append(s.length() > 0 ? "," : "").append("[").append(num(prev)).append(",").append(num(cur)).append("]");
      }
      rows.append(rows.length() > 0 ? "," : "").append("{\"duration\":").append(n).append(",\"ticks\":[").append(s).append("]}");
    }
    out.append("{\"case\":\"portalTimer\",\"kind\":\"replay\",\"rows\":[").append(rows).append("]}\n");
    rows = new StringBuilder();
    for (int i = 0; i <= 20; i++) {
      float a = i / 20f, f6 = 5.0F / (a * a + 5.0F) - a * 0.04F; f6 = f6 * f6;
      rows.append(rows.length() > 0 ? "," : "").append("[").append(num(a)).append(",").append(num(f6)).append("]");
    }
    out.append("{\"case\":\"warpScale\",\"kind\":\"replay\",\"rows\":[").append(rows).append("]}\n");
    System.out.print(out);
  }
}
