import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged 1.7.10 VillageSiege (wb) on the VillageLiveProbe world double: World.isDaytime (w), World.getCelestialAngle (c(F)), World.rand (s, a logging
// Random), World.playerEntities (h, allocated yz objects with a position), World.villageCollectionObj (A, the real wc) and spawnEntityInWorld (d, counted).
// Villages are built with the real vz/vy classes (doors added with vz.a(vy)); the village's tick counter (g) and population (h) are set by reflection, as the
// collection's own ticks would leave them. Output, one JSON object per line: "gates" (siege conditions, one night ahead), "cycle" (day and night schedules over
// many seeds), "overlap" (a second village near the spawn ring). Every tick row is [state c, spawnsLeft d, delay e, setup b, draws, draw hash, zombies spawned].
public class SiegeProbe {
  public static class W extends VillageLiveProbe.W {
    static float angle = 0.0f;
    static int zombies = 0;
    public float c(float partial) { return angle; }
    public boolean d(sa e) { zombies++; return true; }
  }
  public static class LogRandom extends Random {
    static List<Integer> log = new ArrayList<>();
    LogRandom(long seed) { super(seed); }
    public int nextInt(int bound) { int r = super.nextInt(bound); log.add(bound * 65536 + r); return r; }
    public float nextFloat() { float r = super.nextFloat(); log.add(Float.floatToIntBits(r)); return r; }
  }

  public static class P extends yz {
    P() { super(null, null); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }

  static Object doorOf(int[] d) { return new vy(d[0], d[1], d[2], d[3], d[4], d[5]); }
  static vz village(ahb w, int[][] doors, int pop, int tickCounter) throws Exception {
    vz v = new vz(w);
    for (int[] d : doors) v.a((vy) doorOf(d));
    MobMoveProbe.set(v, "g", tickCounter);
    MobMoveProbe.set(v, "h", pop);
    return v;
  }
  static String arr(int[] a) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < a.length; i++) s.append(i > 0 ? "," : "").append(a[i]); return s.append("]").toString(); }
  static String doors(int[][] d) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < d.length; i++) s.append(i > 0 ? "," : "").append(arr(d[i])); return s.append("]").toString(); }
  static int[][] ring(int cx, int cz, int n, int stamp) {
    int[][] d = new int[n][];
    for (int i = 0; i < n; i++) d[i] = new int[] {cx - 6 + (i % 4) * 4, 64, cz - 6 + (i / 4) * 4, 0, 2, stamp};
    return d;
  }

  // vills: {doors, pop, tickCounter}; players: x,y,z triples. script: {day (0/1), angle}.
  static void run(String name, long seed, Object[][] vills, double[][] players, float[][] script, String extra) throws Exception {
    VillageLiveProbe.newCollection(seed);
    ahb w = VillageLiveProbe.world;
    LogRandom r = new LogRandom(seed);
    MobMoveProbe.set(w, "s", r);
    wc c = (wc) MobMoveProbe.field(ahb.class, "A").get(w);
    StringBuilder vs = new StringBuilder("[");
    for (int i = 0; i < vills.length; i++) {
      vz v = village(w, (int[][]) vills[i][0], (Integer) vills[i][1], (Integer) vills[i][2]);
      c.b().add(v);
      vs.append(i > 0 ? "," : "").append("{\"doors\":").append(doors((int[][]) vills[i][0])).append(",\"pop\":").append(vills[i][1]).append(",\"tick\":").append(vills[i][2])
        .append(",\"center\":[").append(v.a().a).append(',').append(v.a().b).append(',').append(v.a().c).append("],\"radius\":").append(v.b()).append("}");
    }
    vs.append("]");
    List<yz> list = (List<yz>) MobMoveProbe.field(ahb.class, "h").get(w);
    list.clear();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    StringBuilder ps = new StringBuilder("[");
    for (int i = 0; i < players.length; i++) {
      yz p = (yz) u.allocateInstance(P.class);
      MobMoveProbe.set(p, "s", players[i][0]); MobMoveProbe.set(p, "t", players[i][1]); MobMoveProbe.set(p, "u", players[i][2]);
      list.add(p);
      ps.append(i > 0 ? "," : "").append("[").append(players[i][0]).append(',').append(players[i][1]).append(',').append(players[i][2]).append("]");
    }
    ps.append("]");
    wb s = new wb(w);
    W.zombies = 0;
    StringBuilder rows = new StringBuilder("["), sc = new StringBuilder("[");
    for (int t = 0; t < script.length; t++) {
      W.day = script[t][0] != 0; W.angle = script[t][1];
      LogRandom.log.clear();
      s.a();
      int h = 0;
      for (int tok : LogRandom.log) h = 31 * h + tok;
      rows.append(t > 0 ? "," : "").append("[").append(VillageLiveProbe.gi(s, "c")).append(',').append(VillageLiveProbe.gi(s, "d")).append(',').append(VillageLiveProbe.gi(s, "e")).append(',')
        .append(MobMoveProbe.b(s, "b") ? 1 : 0).append(',').append(LogRandom.log.size()).append(',').append(h).append(',').append(W.zombies).append("]");
      sc.append(t > 0 ? "," : "").append("[").append(script[t][0] != 0 ? 1 : 0).append(',').append(script[t][1]).append("]");
    }
    System.out.println("{\"case\":\"" + name + "\",\"seed\":" + seed + ",\"villages\":" + vs + ",\"players\":" + ps + ",\"script\":" + sc + "],\"rows\":" + rows + "]" + extra + "}");
  }

  static float[][] night(int n, float angle) { float[][] s = new float[n][]; for (int i = 0; i < n; i++) s[i] = new float[] {0, angle}; return s; }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    W w = (W) u.allocateInstance(W.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);

    // gates: one night ahead from the initial state; each variant changes one condition of VillageSiege.func_75529_b
    int[][] twelve = ring(100, 100, 12, 0);
    Object[][] ok = {{twelve, 25, 100}};
    double[][] inside = {{100.5, 64, 100.5}};
    run("gates", 11, ok, inside, night(4, 0.3f), ",\"variant\":\"ok\"");
    run("gates", 11, new Object[][] {{ring(100, 100, 9, 0), 25, 100}}, inside, night(4, 0.3f), ",\"variant\":\"nine doors\"");
    run("gates", 11, new Object[][] {{ring(100, 100, 10, 0), 25, 100}}, inside, night(4, 0.3f), ",\"variant\":\"ten doors\"");
    run("gates", 11, new Object[][] {{twelve, 25, 19}}, inside, night(4, 0.3f), ",\"variant\":\"door added 19 ticks ago\"");
    run("gates", 11, new Object[][] {{twelve, 25, 20}}, inside, night(4, 0.3f), ",\"variant\":\"door added 20 ticks ago\"");
    run("gates", 11, new Object[][] {{twelve, 19, 100}}, inside, night(4, 0.3f), ",\"variant\":\"19 villagers\"");
    run("gates", 11, new Object[][] {{twelve, 20, 100}}, inside, night(4, 0.3f), ",\"variant\":\"20 villagers\"");
    run("gates", 11, ok, new double[][] {{400, 64, 400}}, night(4, 0.3f), ",\"variant\":\"player far away\"");
    run("gates", 11, ok, new double[][] {{140, 64, 100}}, night(4, 0.3f), ",\"variant\":\"player 40 blocks out\"");
    run("gates", 11, ok, new double[][] {{100.5, 64, 100.5}, {101.5, 70, 99.5}}, night(4, 0.3f), ",\"variant\":\"two players\"");
    run("gates", 11, ok, new double[][] {}, night(4, 0.3f), ",\"variant\":\"no player\"");

    // cycle: a day, then a night whose angle crosses the 0.5..0.501 window; many seeds so some roll 1 (the siege) and some 2
    float[] angles = {0.3f, 0.4999f, 0.5f, 0.5005f, 0.501f, 0.5011f, 0.52f};
    for (long seed = 1; seed <= 24; seed++) {
      float[][] s = new float[40][];
      for (int t = 0; t < 40; t++) s[t] = t < 4 ? new float[] {1, 0.0f} : new float[] {0, angles[(t - 4) % angles.length]};
      run("cycle", seed, ok, inside, s, "");
    }
    // a night that holds the window for 12 ticks: the roll repeats once state 2 is left... (state 2 stays until day)
    for (long seed = 100; seed < 106; seed++) {
      float[][] s = new float[60][];
      for (int t = 0; t < 60; t++) s[t] = t < 3 ? new float[] {1, 0.0f} : t < 15 ? new float[] {0, 0.5004f} : t < 20 ? new float[] {1, 0.0f} : new float[] {0, t % 2 == 0 ? 0.5f : 0.3f};
      run("cycle", seed, ok, inside, s, ",\"long\":true");
    }

    // overlap: a second village whose range reaches the ring (radius * 0.9 around the first village's centre)
    int[][] v1 = ring(100, 100, 12, 0);
    for (int dx : new int[] {18, 30, 45, 70}) {
      int[][] v2 = ring(100 + dx, 100, 4, 0);
      run("overlap", 31 + dx, new Object[][] {{v1, 25, 100}, {v2, 3, 100}}, inside, night(6, 0.3f), ",\"dx\":" + dx);
    }
  }
}
