import java.util.*;

// Seeded SpawnerAnimals.findChunksForSpawning (aho.a(mt, ZZZ)) replays of the flows SpawnListProbe leaves out: slimes (the swamp and
// slime chunk rules, size rolls), ocelots (jungle), horses (plains and savanna group data, foals, variants), the Nether (pigmen,
// ghasts, the fortress list with blazes, wither skeletons and magma cubes) and the End (endermen). The unchanged 1.7.10 classes run on a
// WorldServer double like SpawnListProbe's, with a terrain per mode, a native moon phase (ahb.y over a real WorldInfo day time) and the
// world seed 99.
//
// Entity.rand is an unseeded java.util.Random natively. Where a replayed outcome depends on it (the slime's size and jump delay in
// EntitySlime's constructor, EntityHorse.onSpawnWithEgg, EntityGhast.getCanSpawnHere, EntitySkeleton.onSpawnWithEgg) the probe spawns
// thin subclasses that call setSeed(World.rand's state) on Entity.rand inside setLocationAndAngles (the call SpawnerAnimals makes right
// after the constructor, after the yaw draw) and, for the slimes, repeat the constructor's own two draws (nextInt(3) for the size,
// nextInt(20) + 10 for the jump delay) on that seeded Random. Nothing else is patched: the spawner, the weighted pick, every
// getCanSpawnHere and onSpawnWithEgg run from the jar. The port seeds the same way (entities.js naturalSpawn, `entitySeed`).
public class SpawnReplay2Probe {
  static String q(String s) { return SpawnListProbe.q(s); }
  static java.lang.reflect.Field zField, worldRandField, oField;

  static Random zr(sa e) throws Exception { return (Random) zField.get(e); }
  static Random worldRand(sa e) throws Exception { return (Random) worldRandField.get(oField.get(e)); }
  static void reseed(sa e) throws Exception { zr(e).setSeed(SpawnListProbe.seedOf(worldRand(e))); }

  public static class XSlime extends ym {
    public XSlime(ahb w) { super(w); }
    public void b(double x, double y, double z, float yaw, float pitch) {
      super.b(x, y, z, yaw, pitch);
      try { reseed(this); Random r = zr(this); int size = 1 << r.nextInt(3); MobMoveProbe.field(ym.class, "bn").setInt(this, r.nextInt(20) + 10); a(size); } catch (Exception ex) { throw new RuntimeException(ex); }
    }
  }
  public static class XMagma extends yf {
    public XMagma(ahb w) { super(w); }
    public void b(double x, double y, double z, float yaw, float pitch) {
      super.b(x, y, z, yaw, pitch);
      try { reseed(this); Random r = zr(this); int size = 1 << r.nextInt(3); MobMoveProbe.field(ym.class, "bn").setInt(this, r.nextInt(20) + 10); a(size); } catch (Exception ex) { throw new RuntimeException(ex); }
    }
  }
  public static class XSkeleton extends yl {
    public XSkeleton(ahb w) { super(w); }
    public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } }
  }
  public static class XGhast extends yd {
    public XGhast(ahb w) { super(w); }
    public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } }
  }
  public static class XHorse extends wi {
    public XHorse(ahb w) { super(w); }
    public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } }
  }
  static final Map<Class<?>, Class<?>> SWAP = new HashMap<>();
  static {
    SWAP.put(ym.class, XSlime.class); SWAP.put(yf.class, XMagma.class); SWAP.put(yl.class, XSkeleton.class);
    SWAP.put(yd.class, XGhast.class); SWAP.put(wi.class, XHorse.class);
  }

  // Terrain and lists per mode. Overworld modes reuse SpawnListProbe's grass cells, ponds and caves (static biomes and caves arrays).
  static String mode = "overworld";
  static boolean slimeOnly = false, litSurface = false, ocelotOnly = false;
  static final int NETHERRACK = 87, NETHER_BRICK = 112, END_STONE = 121;
  static int netherFloor(int x, int z) { return 32 + (((x >> 3) + (z >> 3)) & 3); }
  // Round 3 hooks (SpawnReplay3Probe): a different Nether floor height and nether-brick footprint (null keeps the stand-in terrain).
  static java.util.function.IntBinaryOperator floorOverride = null;
  static java.util.function.BiPredicate<Integer, Integer> brickOverride = null;
  static boolean fortressChunk(int x, int z) { return Math.floorMod((x >> 4) + 2 * (z >> 4), 3) == 0; }
  // The probe's stand-in for MapGenNetherBridge's box test (ChunkProviderHell.getPossibleCreatures): a fortress chunk, y 30..60.
  static boolean inFortress(int x, int y, int z) { return fortressChunk(x, z) && y >= 30 && y <= 60; }
  static int blockId(int x, int y, int z) {
    if (y < 0 || y > 255) return 0;
    if (mode.equals("nether")) {
      int s = floorOverride != null ? floorOverride.applyAsInt(x, z) : netherFloor(x, z);
      if (y >= 120 && y < 128) return NETHERRACK;
      if (y < s - 1) return NETHERRACK;
      if (y == s - 1) return (brickOverride != null ? brickOverride.test(x, z) : fortressChunk(x, z)) ? NETHER_BRICK : NETHERRACK;
      return 0;
    }
    if (mode.equals("end")) {
      int s = 60 + (((x >> 3) + (z >> 3)) & 3);
      return y < s ? END_STONE : 0;
    }
    return SpawnListProbe.blockId(x, y, z);
  }

  public static class W extends mt {
    W() { super(null, null, null, 0, null, null); }
    List<sa> loaded, spawned;
    Map<Long, apx> chunks;
    r spawnPoint;
    ays info;
    Map<Class<?>, ahx> swapped = new HashMap<>();
    public aji a(int x, int y, int z) { return aji.e(blockId(x, y, z)); }
    public int e(int x, int y, int z) { return 0; }
    public ahu a(int x, int z) {
      if (mode.equals("nether")) return ahu.n()[8];
      if (mode.equals("end")) return ahu.n()[9];
      return ahu.n()[SpawnListProbe.biomeId(x >> 4, z >> 4)];
    }
    public apx e(int cx, int cz) {
      long key = ((long) cx << 32) ^ (cz & 0xffffffffL);
      apx c = chunks.get(key);
      if (c == null) {
        c = new apx(this, cx, cz);
        int top = 0;
        for (int x = 0; x < 16; x++) for (int z = 0; z < 16; z++) for (int y = 255; y >= 0; y--)
          if (blockId(cx * 16 + x, y, cz * 16 + z) != 0) { top = Math.max(top, y); break; }
        try {
          apz[] st = (apz[]) MobMoveProbe.field(apx.class, "u").get(c);
          for (int i = 0; i <= top >> 4; i++) st[i] = new apz(i << 4, true);
        } catch (Exception ex) { throw new RuntimeException(ex); }
        chunks.put(key, c);
      }
      return c;
    }
    public apx d(int x, int z) { return e(x >> 4, z >> 4); }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public r K() { return spawnPoint; }
    public ays N() { return info; }
    public long H() { return 99L; }
    public boolean P() { return false; }
    public boolean Q() { return false; }
    public int b(ahn type, int x, int y, int z) { return 0; }
    public int a(ahn type, int x, int y, int z) { return 0; }
    // getBlockLightValue: 0, except at the surface of the "lit" slime replay, where it varies per 4 x 4 column (the slime-only list
    // keeps every other mob, whose light rolls would use the unseeded Entity.rand, out of those columns).
    public int k(int x, int y, int z) { return litSurface && y >= 40 ? ((x >> 2) * 3 + (z >> 2) * 5) & 7 : 0; }
    public int j(int x, int y, int z) { return 15; }
    public float n(int x, int y, int z) { return 0F; }
    public Calendar V() { Calendar c = Calendar.getInstance(); c.set(2014, Calendar.OCTOBER, 31); return c; }
    public boolean d(sa e) { loaded.add(e); spawned.add(e); return true; }
    public void a(sa e, String sound, float volume, float pitch) {}
    public void a(double x, double y, double z, String sound, float volume, float pitch) {}
    public void a(String particle, double x, double y, double z, double a, double b, double c) {}
    // spawnRandomCreature: ChunkProviderGenerate / ChunkProviderHell / ChunkProviderEnd.getPossibleCreatures, then WeightedRandom on
    // World.rand; the picked entry's class is swapped for the seeded subclass where there is one.
    public ahx a(sx type, int x, int y, int z) {
      List list;
      if (mode.equals("nether") && type == sx.a && inFortress(x, y, z)) list = new atd().b();
      else list = a(x, z).a(type);
      if (slimeOnly && type == sx.a) list = Arrays.asList(new ahx(ym.class, 1, 4, 4));
      if (ocelotOnly && type == sx.b) list = Arrays.asList(new ahx(wn.class, 2, 1, 1));
      if (list == null || list.isEmpty()) return null;
      ahx e = (ahx) qv.a(this.s, list);
      Class<?> sub = SWAP.get(e.b);
      if (sub == null) return e;
      return swapped.computeIfAbsent(sub, k -> new ahx(sub, 1, e.c, e.d));
    }
    public List b(sa entity, azt box) { return a(entity, box, (sj) null); }
    public List a(sa entity, azt box, sj selector) {
      List<sa> out = new ArrayList<>();
      for (sa e : loaded) if (e != entity && e.C.b(box) && (selector == null || selector.a(e))) out.add(e);
      return out;
    }
    public List a(Class cls, azt box) { return a(cls, box, (sj) null); }
    public List a(Class cls, azt box, sj selector) {
      List<sa> out = new ArrayList<>();
      for (sa e : loaded) if (cls.isAssignableFrom(e.getClass()) && e.C.b(box) && (selector == null || selector.a(e))) out.add(e);
      return out;
    }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
  }

  static W world(long seed, int sx, int sy, int sz, long dayTime, boolean nether) throws Exception {
    W w = (W) SpawnListProbe.u.allocateInstance(W.class);
    MobMoveProbe.set(w, "t", SpawnListProbe.u.allocateInstance(nether ? aqp.class : aqq.class));
    MobMoveProbe.field(ahb.class, "s").set(w, new Random(seed));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "r").set(w, rd.c);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "e").set(w, new ArrayList());
    ays info = (ays) SpawnListProbe.u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "b").set(info, ahm.b);
    info.c(dayTime);
    w.info = info;
    MobMoveProbe.field(ahb.class, "x").set(w, info); // the field ahb.y() reads (getWorldInfo)
    w.loaded = (List<sa>) MobMoveProbe.field(ahb.class, "e").get(w);
    w.spawned = new ArrayList<>(); w.chunks = new HashMap<>(); w.swapped = new HashMap<>();
    w.spawnPoint = new r(sx, sy, sz);
    return w;
  }

  static SpawnEggProbe.P player(W w, double x, double y, double z) throws Exception {
    SpawnEggProbe.P p = (SpawnEggProbe.P) SpawnListProbe.u.allocateInstance(SpawnEggProbe.P.class);
    MobMoveProbe.set(p, "o", w); MobMoveProbe.set(p, "Z", new Random(5)); MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(p, "bE", new yw());
    MobMoveProbe.set(p, "s", x); MobMoveProbe.set(p, "t", y); MobMoveProbe.set(p, "u", z);
    return p;
  }
  static String num(float v) { return Float.toString(v); }
  static double attrD(sv e, th a) throws Exception { return ((ti) e.a(a)).e(); }
  static String horseState(wi e) throws Exception {
    return "type:" + e.bZ() + ",variant:" + e.ca() + ",age:" + e.d() + ",health:" + num(e.aS()) + ",maxHealth:" + num((float) attrD(e, yj.a))
      + ",speed:" + Double.toString(attrD(e, yj.d)) + ",jump:" + Double.toString(e.ct()) + ",tame:" + e.cc() + ",temper:" + e.cq();
  }
  static String gear(sw e) {
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < 5; i++) { add s = e.q(i); b.append(i > 0 ? "/" : "").append(s == null ? "-" : adb.b(s.b()) + ":" + s.k()); }
    return b.toString();
  }
  static String entity(sa e) throws Exception {
    StringBuilder b = new StringBuilder("[" + q(SpawnListProbe.name(e.getClass())) + "," + e.s + "," + e.t + "," + e.u + "," + e.y);
    String extra = "";
    if (e instanceof ym) extra = "size:" + ((ym) e).bX();
    if (e instanceof wi) extra = horseState((wi) e);
    if (e instanceof yl) extra = e.m != null ? "skeleton-jockey" : "skeleton:" + ((yl) e).cb() + ",gear:" + gear((yl) e); // a spider jockey is a plain yl (unseeded Entity.rand)
    if (e instanceof wp) extra = "fleece:" + ((wp) e).bZ();
    if (e instanceof yq) extra = "child:" + ((yq) e).f() + ",villager:" + ((yq) e).cb();
    if (e instanceof rx && !(e instanceof wi)) extra += (extra.isEmpty() ? "" : ",") + "age:" + ((rx) e).d();
    if (e.m != null) extra += ",riding:" + SpawnListProbe.name(e.m.getClass());
    return b.append("," + q(extra) + "]").toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    SpawnListProbe.u = MobMoveProbe.unsafe();
    SpawnListProbe.seedField = Random.class.getDeclaredField("seed");
    for (String f : new String[] {"c", "d", "e", "f", "g"}) {
      Map m = (Map) MobMoveProbe.field(sg.class, f).get(null);
      if (!m.isEmpty() && m.keySet().iterator().next() instanceof Class && m.values().iterator().next() instanceof String)
        for (Object k : m.keySet()) SpawnListProbe.names.put((Class<?>) k, (String) m.get(k));
    }
    for (Map.Entry<Class<?>, Class<?>> e : SWAP.entrySet()) SpawnListProbe.names.put(e.getValue(), SpawnListProbe.names.get(e.getKey()));
    zField = MobMoveProbe.field(sa.class, "Z");
    worldRandField = MobMoveProbe.field(ahb.class, "s");
    oField = MobMoveProbe.field(sa.class, "o");
    // name, seed, player xyz, spawn xyz, ticks, animalsEvery, mode, biomes, caves, dayTime, slimeOnly, litSurface
    Object[][] scenarios = {
      {"slime-swamp-full", 11L, 8.5, 70.0, 8.5, 0, 64, 0, 200, 40, "overworld", new int[] {6, 6, 6, 4, 6, 1, 6, 6}, true, 0L, false, false},
      {"slime-swamp-new", 12L, 8.5, 70.0, 8.5, 0, 64, 0, 200, 40, "overworld", new int[] {6, 6, 6, 4, 6, 1, 6, 6}, true, 96000L, false, false},
      {"slime-swamp-lit", 13L, 8.5, 70.0, 8.5, 0, 64, 0, 240, 40, "overworld", new int[] {6, 6, 6, 6, 6, 6, 6, 6}, true, 48000L, true, true},
      {"ocelot-jungle", 14L, 8.5, 70.0, 8.5, 0, 64, 0, 400, 20, "overworld", new int[] {21, 22, 23, 21, 22, 21, 23, 21}, false, 18000L, false, false},
      {"ocelot-only", 18L, 8.5, 70.0, 8.5, 0, 64, 0, 400, 20, "overworld", new int[] {21, 22, 23, 21, 22, 21, 23, 21}, false, 18000L, false, false},
      {"horse-plains", 15L, 8.5, 70.0, 8.5, 0, 64, 0, 400, 20, "overworld", new int[] {1, 35, 1, 129, 1, 35, 1, 1}, false, 6000L, false, false},
      {"nether-fortress", 16L, 8.5, 40.0, 8.5, 0, 33, 0, 800, 1, "nether", null, false, 0L, false, false},
      {"end-endermen", 17L, 8.5, 70.0, 8.5, 0, 62, 0, 200, 1, "end", null, false, 0L, false, false},
    };
    for (Object[] sc : scenarios) {
      mode = (String) sc[10];
      if (sc[11] != null) SpawnListProbe.biomes = (int[]) sc[11];
      SpawnListProbe.caves = (Boolean) sc[12];
      slimeOnly = (Boolean) sc[14]; litSurface = (Boolean) sc[15];
      W w = world((Long) sc[1], (Integer) sc[5], (Integer) sc[6], (Integer) sc[7], (Long) sc[13], mode.equals("nether"));
      w.h.add(player(w, (Double) sc[2], (Double) sc[3], (Double) sc[4]));
      ocelotOnly = sc[0].equals("ocelot-only");
      boolean clear = sc[0].equals("ocelot-jungle") || ocelotOnly || sc[0].equals("horse-plains");
      aho spawner = new aho();
      int ticks = (Integer) sc[8], every = (Integer) sc[9];
      int[] biomes = mode.equals("overworld") ? SpawnListProbe.biomes : new int[0];
      StringBuilder o = new StringBuilder("{\"case\":\"replay\",\"name\":" + q((String) sc[0]) + ",\"seed\":" + sc[1] + ",\"player\":[" + sc[2] + "," + sc[3] + "," + sc[4] + "],\"spawn\":[" + sc[5] + "," + sc[6] + "," + sc[7] + "],\"mode\":" + q(mode) + ",\"biomes\":" + Arrays.toString(biomes) + ",\"caves\":" + SpawnListProbe.caves + ",\"dayTime\":" + sc[13] + ",\"slimeOnly\":" + slimeOnly + ",\"ocelotOnly\":" + ocelotOnly + ",\"lit\":" + litSurface + ",\"ticks\":" + ticks + ",\"hostile\":" + !clear + ",\"clearEvery\":" + (clear ? every : 0) + ",\"animalsEvery\":" + every + ",\"steps\":[");
      for (int tick = 0; tick < ticks; tick++) {
        w.spawned.clear();
        if (clear && tick % every == 0) w.loaded.clear(); // creature scenarios: empty the world before each animal pass so the cap of 11 never ends it
        int total = spawner.a(w, !clear, true, tick % every == 0);
        StringBuilder sp = new StringBuilder("[");
        for (sa e : w.spawned) { if (sp.length() > 1) sp.append(','); sp.append(entity(e)); }
        o.append((tick == 0 ? "" : ",") + "{\"total\":" + total + ",\"seed\":" + q(Long.toString(SpawnListProbe.seedOf(w.s))) + ",\"spawned\":" + sp + "]}");
      }
      System.out.println(o.append("]}"));
    }
  }
}
