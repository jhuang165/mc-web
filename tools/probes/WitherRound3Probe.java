import java.lang.reflect.*;
import java.util.*;

// Batch 17 wither round 3: runs the unchanged EntityWither (xc), ModelWither (bin), ModelRenderer (bix) and the real World entity query
// (ahb.a(Class,azt,sj) over real Chunk objects, apx) headlessly.
//   targets   xc.bn() per tick (the whole post-invulnerability path: super.bn with the AI task lists emptied, then the head loop) on a world
//             of real chunks holding the candidates; per tick the Random draws of the entity, the head targets (datawatcher 18/19), the shot
//             skulls, the head timers. Candidate lists come from the genuine World.getEntitiesWithinAABB with the genuine selector (xd).
//   particles xc.e() on a client-flagged world (ahb.E) with the entity Random and the world Random logged; every spawnParticle call.
//   boxes     ModelWither ModelRenderer boxes (bix.l list of bis) and rotation points
//   pose      setLivingAnimations + render() through the stub GL11: per-renderer modelview matrices
public class WitherRound3Probe {
  static final List<String> zlog = new ArrayList<>(), wlog = new ArrayList<>();
  static class LogRandom extends Random {
    final List<String> log; int depth;
    LogRandom(long seed, List<String> log) { super(seed); this.log = log; }
    public int nextInt(int b) { depth++; int r = super.nextInt(b); depth--; if (depth == 0) log.add("i" + b + ":" + r); return r; }
    public double nextDouble() { depth++; double r = super.nextDouble(); depth--; if (depth == 0) log.add("d:" + r); return r; }
    public float nextFloat() { depth++; float r = super.nextFloat(); depth--; if (depth == 0) log.add("f:" + r); return r; }
    public double nextGaussian() { depth++; double r = super.nextGaussian(); depth--; if (depth == 0) log.add("g:" + r); return r; }
  }

  public static class W extends MobMoveProbe.ProbeWorld {
    static Map<Long, apx> chunks = new HashMap<>();
    static Map<Integer, sa> byId = new HashMap<>();
    static double wallX = Double.NaN;
    static List<String> spawned = new ArrayList<>(), particles = new ArrayList<>();
    public boolean c(int x, int z) { return true; }
    public apx e(int x, int z) { return chunks.computeIfAbsent(((long) x << 32) ^ (z & 0xffffffffL), k -> new apx(this, x, z)); }
    public sa a(int id) { return byId.get(id); }
    public boolean d(sa e) { if (e instanceof zp) spawned.add(WitherBossProbe.num(e.s) + "," + WitherBossProbe.num(e.t) + "," + WitherBossProbe.num(e.u) + "," + ((zp) e).f()); return true; }
    public void a(yz p, int id, int x, int y, int z, int data) {}
    public void b(int id, int x, int y, int z, int data) {}
    public yz b(sa e, double d) { return null; }
    public agw a(sa e, double x, double y, double z, float power, boolean flaming, boolean smoking) { return null; }
    public azu a(azw a, azw b) {
      if (!Double.isNaN(wallX) && (a.a - wallX) * (b.a - wallX) < 0) { try { return (azu) WitherBossProbe.u.allocateInstance(azu.class); } catch (Exception ex) { throw new RuntimeException(ex); } }
      return null;
    }
    public azu a(azw a, azw b, boolean c) { return a(a, b); }
    public azu a(azw a, azw b, boolean c, boolean d) { return a(a, b); }
    public void a(String n, double x, double y, double z, double vx, double vy, double vz) {
      particles.add("[" + WitherBossProbe.quote(n) + "," + num(x) + "," + num(y) + "," + num(z) + "," + num(vx) + "," + num(vy) + "," + num(vz) + "]");
    }
  }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return "\"" + s + "\""; }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static String arr(float[] a) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) s.append(','); s.append(Float.toString(a[i])); } return s.append(']').toString(); }
  static String list(List<String> l) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < l.size(); i++) { if (i > 0) s.append(','); s.append(q(l.get(i))); } return s.append(']').toString(); }
  static String box(sa e) { azt b = e.C; return "[" + num(b.a) + "," + num(b.b) + "," + num(b.c) + "," + num(b.d) + "," + num(b.e) + "," + num(b.f) + "]"; }

  static W world(long wseed) throws Exception {
    sun.misc.Unsafe u = WitherBossProbe.u;
    W w = (W) u.allocateInstance(W.class);
    MobMoveProbe.set(w, "s", new LogRandom(wseed, wlog));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    Object prov = u.allocateInstance(aqq.class);
    MobMoveProbe.set(prov, "h", new float[16]);
    MobMoveProbe.set(w, "t", prov);
    Object info = u.allocateInstance(ays.class);
    for (Field f : ays.class.getDeclaredFields()) if (f.getType() == agy.class) { f.setAccessible(true); f.set(info, new agy()); }
    MobMoveProbe.set(w, "x", info);
    W.chunks.clear(); W.byId.clear(); W.spawned.clear(); W.particles.clear(); W.wallX = Double.NaN;
    return w;
  }
  static void addToChunk(W w, sa e) throws Exception { w.e((int) Math.floor(e.s / 16), (int) Math.floor(e.u / 16)).a(e); }
  static int nextId = 1000;
  static void noTasks(sv e) throws Exception {
    for (String n : new String[] {"c", "d"}) { Field f = sw.class.getDeclaredField(n); f.setAccessible(true); f.set(e, new uj(new qi())); }
  }
  static xc wither(W w, long seed, double x, double y, double z, List<String> log) throws Exception {
    xc e = new xc(w);
    MobMoveProbe.set(e, "Z", new LogRandom(seed, log));
    WitherBossProbe.setPos(e, x, y, z);
    WitherBossProbe.zeroYaw(e);
    noTasks(e);
    return e;
  }
  static sv candidate(W w, String type, double x, double y, double z) throws Exception {
    sun.misc.Unsafe u = WitherBossProbe.u;
    sv e;
    if (type.equals("player") || type.equals("creative")) {
      e = (sv) u.allocateInstance(mw.class);
      MobMoveProbe.set(e, "o", w); MobMoveProbe.set(e, "Z", new Random(1)); MobMoveProbe.set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
      te watcher = new te(e); MobMoveProbe.set(e, "af", watcher);
      watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
      MobMoveProbe.method(yz.class, "c").invoke(e);
      MobMoveProbe.field(sv.class, "f").set(e, new HashMap());
      yw ab = new yw(); ab.a = type.equals("creative"); MobMoveProbe.set(e, "bE", ab);
      MobMoveProbe.set(e, "M", 0.6f); MobMoveProbe.set(e, "N", 1.8f);
      MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    } else e = MobMoveProbe.spawn(u, w, type, x, y, z, 0f);
    Field idf = sa.class.getDeclaredField("c"); idf.setAccessible(true); idf.setInt(e, nextId++);
    return e;
  }
  static void setHealth(sv e, float h) throws Exception { ((te) MobMoveProbe.field(sa.class, "af").get(e)).b(6, Float.valueOf(h)); }

  // name, difficulty (1 easy, 2 normal, 3 hard), seed, ticks, wither pos, wall x, candidates {type,x,y,z}, kills {label index, tick}
  static void scenario(String name, rd diff, int diffId, long seed, int ticks, double wx, double wy, double wz, double wall, Object[][] cands, int[][] kills) throws Exception {
    List<String> zl = new ArrayList<>();
    W w = world(99);
    MobMoveProbe.set(w, "r", diff);
    W.wallX = wall;
    xc e = wither(w, seed, wx, wy, wz, zl);
    e.bZ(); MobMoveProbe.set(e, "aa", 0);
    ((te) MobMoveProbe.field(sa.class, "af").get(e)).b(20, Integer.valueOf(0)); // Invul 0 (datawatcher 20)
    setHealth(e, 300f);
    addToChunk(w, e);
    W.byId.put(e.y(), e);
    List<sv> cs = new ArrayList<>();
    StringBuilder cj = new StringBuilder();
    for (int i = 0; i < cands.length; i++) {
      Object[] c = cands[i];
      sv s = candidate(w, (String) c[0], ((Number) c[1]).doubleValue(), ((Number) c[2]).doubleValue(), ((Number) c[3]).doubleValue());
      cs.add(s); W.byId.put(s.y(), s); addToChunk(w, s);
      cj.append(i > 0 ? "," : "").append("{\"type\":").append(q((String) c[0])).append(",\"x\":").append(num(s.s)).append(",\"y\":").append(num(s.t)).append(",\"z\":").append(num(s.u)).append(",\"box\":").append(box(s)).append("}");
    }
    StringBuilder tj = new StringBuilder();
    for (int tick = 1; tick <= ticks; tick++) {
      for (int[] k : kills) if (k[1] == tick) setHealth(cs.get(k[0]), 0f);
      zl.clear(); W.spawned.clear();
      MobMoveProbe.set(e, "aa", tick);
      WitherBossProbe.inv(xc.class, e, "bn");
      List<String> heads = new ArrayList<>();
      for (int h = 1; h <= 2; h++) { int id = e.t(h); String l = ""; for (int i = 0; i < cs.size(); i++) if (cs.get(i).y() == id) l = "" + i; heads.add(id == 0 ? "-" : l.isEmpty() ? "?" : l); }
      int[] bt = (int[]) get(e, "bt"), bu = (int[]) get(e, "bu");
      tj.append(tick > 1 ? "," : "").append("{\"tick\":").append(tick).append(",\"draws\":").append(list(zl)).append(",\"heads\":").append(list(heads))
        .append(",\"bt\":[").append(bt[0]).append(",").append(bt[1]).append("],\"bu\":[").append(bu[0]).append(",").append(bu[1]).append("],\"skulls\":[");
      for (int i = 0; i < W.spawned.size(); i++) tj.append(i > 0 ? "," : "").append("[").append(W.spawned.get(i)).append("]");
      tj.append("]}");
    }
    System.out.println("{\"case\":\"targets\",\"name\":" + q(name) + ",\"difficulty\":" + diffId + ",\"seed\":" + seed + ",\"wither\":{\"x\":" + num(e.s) + ",\"y\":" + num(e.t) + ",\"z\":" + num(e.u) + ",\"box\":" + box(e) + "},\"wall\":"
      + (Double.isNaN(wall) ? "null" : num(wall)) + ",\"kills\":" + Arrays.deepToString(kills) + ",\"candidates\":[" + cj + "],\"ticks\":[" + tj + "]}");
  }

  static void particles(String name, long zseed, long wseed, int phase) throws Exception {
    zlog.clear(); wlog.clear();
    W w = world(wseed);
    ((LogRandom) MobMoveProbe.field(ahb.class, "s").get(w)).log.clear();
    MobMoveProbe.set(w, "s", new LogRandom(wseed, wlog));
    MobMoveProbe.set(w, "r", rd.c);
    MobMoveProbe.set(w, "E", true);
    xc e = wither(w, zseed, 64.5, 20, 64.5, zlog);
    MobMoveProbe.set(e, "aM", 37f);
    if (phase == 0) e.bZ(); // Invul 220, health 100: armoured and invulnerable
    else if (phase == 1) setHealth(e, 100f);
    else setHealth(e, 300f);
    StringBuilder tj = new StringBuilder();
    for (int tick = 1; tick <= 30; tick++) {
      zlog.clear(); wlog.clear(); W.particles.clear();
      MobMoveProbe.set(e, "aa", tick);
      e.e();
      tj.append(tick > 1 ? "," : "").append("{\"tick\":").append(tick).append(",\"x\":").append(num(e.s)).append(",\"y\":").append(num(e.t)).append(",\"z\":").append(num(e.u))
        .append(",\"bodyYaw\":").append(num(MobMoveProbe.fl(e, "aM"))).append(",\"invul\":").append(e.ca()).append(",\"health\":").append(num(e.aS()))
        .append(",\"zDraws\":").append(list(zlog)).append(",\"wDraws\":").append(list(wlog)).append(",\"particles\":").append(W.particles).append("}");
    }
    System.out.println("{\"case\":\"particles\",\"name\":" + q(name) + ",\"zseed\":" + zseed + ",\"wseed\":" + wseed + ",\"ticks\":[" + tj + "]}");
  }

  static bix[] rs(bin m, String f) throws Exception { return (bix[]) get(m, f); }
  static void boxes(bin m) throws Exception {
    String[] names = {"shoulders", "spine", "tail", "head0", "head1", "head2"};
    bix[] all = {rs(m, "a")[0], rs(m, "a")[1], rs(m, "a")[2], rs(m, "b")[0], rs(m, "b")[1], rs(m, "b")[2]};
    for (int i = 0; i < 6; i++) {
      bix r = all[i];
      StringBuilder bs = new StringBuilder();
      for (Object o : (List) r.l) {
        bis b = (bis) o;
        bhv[] quads = (bhv[]) get(b, "i");
        float minU = 1e9f, minV = 1e9f;
        for (bhv qd : quads) for (bii v : qd.a) { minU = Math.min(minU, v.b); minV = Math.min(minV, v.c); }
        bii[] verts = (bii[]) get(b, "h");
        boolean mirror = Math.abs(verts[0].a.a - b.d) < 1e-6;
        bs.append(bs.length() > 0 ? "," : "").append("[" + num(b.a) + "," + num(b.b) + "," + num(b.c) + "," + num(b.d - b.a) + "," + num(b.e - b.b) + "," + num(b.f - b.c) + "," + num(minU * 64f) + "," + num(minV * 64f) + "," + mirror + "]");
      }
      System.out.println("{\"case\":\"boxes\",\"name\":" + q(names[i]) + ",\"point\":[" + num(r.c) + "," + num(r.d) + "," + num(r.e) + "],\"textureSize\":[" + num(r.a) + "," + num(r.b) + "],\"boxes\":[" + bs + "]}");
    }
  }

  static void pose(String name, float bodyYaw, float[] hy, float[] hp, float age, float netYaw, float netPitch) throws Exception {
    W w = world(1);
    xc e = wither(w, 1, 64.5, 20, 64.5, new ArrayList<>());
    MobMoveProbe.set(e, "aM", bodyYaw);
    float[] bq = (float[]) get(e, "bq"), bp = (float[]) get(e, "bp");
    bq[0] = hy[0]; bq[1] = hy[1]; bp[0] = hp[0]; bp[1] = hp[1];
    bin m = new bin();
    String[] names = {"shoulders", "spine", "tail", "head0", "head1", "head2"};
    bix[] all = {rs(m, "a")[0], rs(m, "a")[1], rs(m, "a")[2], rs(m, "b")[0], rs(m, "b")[1], rs(m, "b")[2]};
    Map<Integer, String> ids = new HashMap<>();
    for (float partial : new float[] {0f, 0.5f}) {
      org.lwjgl.opengl.GL11.reset();
      m.a((sv) e, 0f, 0f, partial);
      m.a((sa) e, 0f, 0f, age + partial, netYaw, netPitch, 0.0625f);
      if (ids.isEmpty()) for (int i = 0; i < 6; i++) ids.put((Integer) get(all[i], "u"), names[i]);
      StringBuilder calls = new StringBuilder();
      for (Object[] c : org.lwjgl.opengl.GL11.LOG) {
        if (!c[0].equals("call")) continue;
        if (calls.length() > 0) calls.append(',');
        calls.append("[" + q(ids.get((Integer) c[1])) + "," + arr((float[]) c[2]) + "]");
      }
      StringBuilder ang = new StringBuilder();
      for (int i = 0; i < 6; i++) ang.append(i > 0 ? "," : "").append("[" + num(all[i].c) + "," + num(all[i].d) + "," + num(all[i].e) + "," + num(all[i].f) + "," + num(all[i].g) + "," + num(all[i].h) + "]");
      System.out.println("{\"case\":\"pose\",\"name\":" + q(name) + ",\"partial\":" + num(partial) + ",\"age\":" + num(age + partial) + ",\"bodyYaw\":" + num(bodyYaw) + ",\"headYaw\":[" + num(hy[0]) + "," + num(hy[1]) + "],\"headPitch\":[" + num(hp[0]) + "," + num(hp[1]) + "],\"netYaw\":" + num(netYaw) + ",\"netPitch\":" + num(netPitch) + ",\"parts\":[" + ang + "],\"calls\":[" + calls + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    // scattered candidates: chunk (x then z), 16-high slices, insertion order; a cow behind the wall, an undead zombie, a creative player
    Object[][] mix = {
      {"cow", 80.5, 20, 64.5}, {"pig", 60.5, 20, 70.5}, {"zombie", 66.5, 20, 66.5}, {"cow", 70.5, 36, 64.5},
      {"player", 64.5, 20, 50.5}, {"pig", 50.5, 18, 64.5}, {"cow", 64.5, 20, 40.5}, {"creative", 72.5, 21, 72.5},
    };
    scenario("mix-normal-a", rd.c, 2, 11, 160, 64.5, 20, 64.5, Double.NaN, mix, new int[][] {});
    scenario("mix-normal-b", rd.c, 2, 12, 160, 64.5, 20, 64.5, Double.NaN, mix, new int[][] {});
    scenario("mix-hard", rd.d, 3, 13, 160, 64.5, 20, 64.5, Double.NaN, mix, new int[][] {});
    scenario("mix-easy", rd.b, 1, 14, 160, 64.5, 20, 64.5, Double.NaN, mix, new int[][] {});
    scenario("wall", rd.c, 2, 15, 160, 64.5, 20, 64.5, 66.5, mix, new int[][] {});
    // two creative players only: the search ends without a target; then the survival player and kills
    scenario("creative-only", rd.c, 2, 16, 100, 64.5, 20, 64.5, Double.NaN, new Object[][] {{"creative", 70.5, 20, 64.5}, {"creative", 58.5, 20, 64.5}}, new int[][] {});
    scenario("kills", rd.c, 2, 17, 220, 64.5, 20, 64.5, Double.NaN,
      new Object[][] {{"cow", 70.5, 20, 64.5}, {"pig", 58.5, 20, 64.5}, {"cow", 64.5, 20, 72.5}, {"pig", 64.5, 20, 56.5}, {"cow", 100.5, 20, 64.5}}, new int[][] {{0, 40}, {1, 60}, {2, 80}});
    // far from every chunk boundary mix: candidate beyond 30 blocks (the 900 cap) and the 20/8/20 box edge
    scenario("edge", rd.c, 2, 18, 160, 64.5, 20, 64.5, Double.NaN,
      new Object[][] {{"cow", 85.3, 20, 64.5}, {"pig", 85.5, 20, 64.5}, {"cow", 64.5, 31.9, 64.5}, {"pig", 64.5, 32.1, 64.5}, {"cow", 64.5, 10.8, 64.5}, {"pig", 64.5, 10.5, 64.5}, {"cow", 64.5, 20, 85.3}, {"pig", 64.5, 20, 85.5}}, new int[][] {});
    particles("invulnerable", 5, 6, 0);
    particles("armored", 7, 8, 1);
    particles("plain", 9, 10, 2);
    bin m = new bin();
    boxes(m);
    pose("idle", 0f, new float[] {0f, 0f}, new float[] {0f, 0f}, 0f, 0f, 0f);
    pose("turned", 37f, new float[] {55f, -20f}, new float[] {12f, -30f}, 25.3f, 14f, -9f);
    pose("later", -120f, new float[] {-100f, 170f}, new float[] {40f, -40f}, 97f, -35f, 22f);
  }
}
