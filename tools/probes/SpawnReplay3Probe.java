import java.util.*;

// Round 3 of the seeded SpawnerAnimals.findChunksForSpawning (aho.a(mt, ZZZ)) replays (see SpawnReplay2Probe for the double and the
// Entity.rand seeding). It adds what round 2 left out:
//  * lit areas: a deterministic block-light and sky-light fixture varying per 2-8 block cell (saved sky light ahb.b(Sky, x, y, z), block
//    light, skylightSubtracted ahb.j as an int field the real EntityMob.isValidLightLevel reads and temporarily sets to 10 when
//    ahb.P() is true, getFullBlockLightValue ahb.j(x, y, z), and the provider's real lightBrightnessTable via ahb.n(x, y, z)). The
//    unchanged classes draw savedSky > rand.nextInt(32) and light <= rand.nextInt(8) in EntityMob.isValidLightLevel (zombies, skeletons,
//    creepers, spiders, endermen, witches, swamp slimes) and test grass + full light > 8 for animals; Entity.rand is seeded in
//    setLocationAndAngles for every mob that rolls on it (zombie, creeper, spider, enderman, witch, pig zombie, blaze, bat, as in round 2).
//  * a real fortress: the unchanged MapGenNetherBridge (atd) generates its starts (real structure boxes and piece boxes) through its
//    MapGenBase driver on the double over the 17 x 17 eligible chunks, and ChunkProviderHell.getPossibleCreatures' two tests
//    (atd.b(x,y,z) inside a piece box, atd.d(x,y,z) in the start's XZ footprint over a nether brick block) pick the fortress list. The
//    Nether terrain gets a raised plateau (y 62..65) with a nether brick floor over every generated start's box so that spawn heights
//    meet the piece boxes (which start at y 64).
public class SpawnReplay3Probe {
  static String q(String s) { return SpawnListProbe.q(s); }
  static boolean lit3 = false, thunder = false, nether3 = false;
  static int sub3 = 0;

  static int sky(int x, int y, int z) { if (nether3) return 0; int h = ((x >> 1) * 7 + (z >> 1) * 13 + (y >> 2) * 5) & 15; return h < 5 ? 0 : h < 10 ? h : 15; }
  static int blk(int x, int y, int z) { return ((x >> 2) * 3 + (z >> 2) * 5 + (y >> 3) * 2 + ((x ^ z) >> 4)) & 15; }

  public static class XZombie extends yq { public XZombie(ahb w) { super(w); } public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { SpawnReplay2Probe.reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } } }
  public static class XPigman extends yh { public XPigman(ahb w) { super(w); } public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { SpawnReplay2Probe.reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } } }
  public static class XCreeper extends xz { public XCreeper(ahb w) { super(w); } public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { SpawnReplay2Probe.reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } } }
  public static class XSpider extends yn { public XSpider(ahb w) { super(w); } public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { SpawnReplay2Probe.reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } } }
  public static class XEnderman extends ya { public XEnderman(ahb w) { super(w); } public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { SpawnReplay2Probe.reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } } }
  public static class XWitch extends yp { public XWitch(ahb w) { super(w); } public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { SpawnReplay2Probe.reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } } }
  public static class XBlaze extends xx { public XBlaze(ahb w) { super(w); } public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { SpawnReplay2Probe.reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } } }

  public static class XBat extends we { public XBat(ahb w) { super(w); } public void b(double x, double y, double z, float yaw, float pitch) { super.b(x, y, z, yaw, pitch); try { SpawnReplay2Probe.reseed(this); } catch (Exception ex) { throw new RuntimeException(ex); } } }

  static atd bridge;
  static boolean realFortress = false;

  public static class W3 extends SpawnReplay2Probe.W {
    W3() { super(); }
    public int k(int x, int y, int z) { return lit3 ? Math.max(blk(x, y, z), sky(x, y, z) - this.j) : super.k(x, y, z); }
    public int b(ahn type, int x, int y, int z) { return lit3 ? (type == ahn.a ? sky(x, y, z) : blk(x, y, z)) : 0; }
    public int j(int x, int y, int z) { return lit3 ? Math.max(sky(x, y, z), blk(x, y, z)) : 15; }
    public float n(int x, int y, int z) { return this.t.h[k(x, y, z)]; }
    public boolean P() { return thunder; }
    public ayl a(Class c, String n) { return null; }
    public void a(String n, ayl d) {}
    // ChunkProviderHell.getPossibleCreatures with the real MapGenNetherBridge; the rest as SpawnReplay2Probe.W.
    public ahx a(sx type, int x, int y, int z) {
      List list;
      if (realFortress && type == sx.a && bridge.b(x, y, z)) list = bridge.b();
      else if (realFortress && type == sx.a && bridge.d(x, y, z) && a(x, y - 1, z) == ajn.bj) list = bridge.b();
      else list = a(x, z).a(type);
      if (list == null || list.isEmpty()) return null;
      ahx e = (ahx) qv.a(this.s, list);
      Class<?> sub = SpawnReplay2Probe.SWAP.get(e.b);
      if (sub == null) return e;
      return swapped.computeIfAbsent(sub, k -> new ahx(sub, 1, e.c, e.d));
    }
  }

  static String entity(sa e) throws Exception {
    String s = SpawnReplay2Probe.entity(e);
    if (e instanceof yq) s = s.substring(0, s.length() - 2) + ",gear:" + SpawnReplay2Probe.gear((yq) e) + "\"]";
    return s;
  }

  static W3 world(long seed, int sx, int sy, int sz, long dayTime, boolean nether) throws Exception {
    W3 w = (W3) SpawnListProbe.u.allocateInstance(W3.class);
    Object provider = SpawnListProbe.u.allocateInstance(nether ? aqp.class : aqq.class);
    MobMoveProbe.set(w, "t", provider);
    // WorldProvider.generateLightBrightnessTable (aqo.a(), aqp overrides it with ambient 0.1) fills lightBrightnessTable (aqo.h).
    MobMoveProbe.field(aqo.class, "h").set(provider, new float[16]);
    java.lang.reflect.Method gen = (nether ? aqp.class : aqo.class).getDeclaredMethod("a");
    gen.setAccessible(true); gen.invoke(provider);
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
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    w.loaded = (List<sa>) MobMoveProbe.field(ahb.class, "e").get(w);
    w.spawned = new ArrayList<>(); w.chunks = new HashMap<>(); w.swapped = new HashMap<>();
    w.spawnPoint = new r(sx, sy, sz);
    w.j = sub3;
    return w;
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
    Class<?>[][] swaps = {{ym.class, SpawnReplay2Probe.XSlime.class}, {yf.class, SpawnReplay2Probe.XMagma.class}, {yl.class, SpawnReplay2Probe.XSkeleton.class}, {yd.class, SpawnReplay2Probe.XGhast.class}, {wi.class, SpawnReplay2Probe.XHorse.class},
      {yq.class, XZombie.class}, {yh.class, XPigman.class}, {xz.class, XCreeper.class}, {yn.class, XSpider.class}, {ya.class, XEnderman.class}, {yp.class, XWitch.class}, {xx.class, XBlaze.class}, {we.class, XBat.class}};
    for (Class<?>[] s : swaps) SpawnReplay2Probe.SWAP.put(s[0], s[1]);
    for (Map.Entry<Class<?>, Class<?>> e : SpawnReplay2Probe.SWAP.entrySet()) SpawnListProbe.names.put(e.getValue(), SpawnListProbe.names.get(e.getKey()));
    SpawnReplay2Probe.zField = MobMoveProbe.field(sa.class, "Z");
    SpawnReplay2Probe.worldRandField = MobMoveProbe.field(ahb.class, "s");
    SpawnReplay2Probe.oField = MobMoveProbe.field(sa.class, "o");
    // name, seed, player xyz, spawn xyz, ticks, animalsEvery, clearEvery, mode, biomes, caves, dayTime, sub, thunder, hostile
    Object[][] scenarios = {
      {"lit-day", 31L, 8.5, 70.0, 8.5, 0, 64, 0, 160, 10, 20, "overworld", new int[] {1, 4, 6, 2, 1, 5, 6, 2}, true, 6000L, 0, false, true},
      {"lit-night", 32L, 8.5, 70.0, 8.5, 0, 64, 0, 160, 10, 20, "overworld", new int[] {1, 4, 6, 2, 1, 5, 6, 2}, true, 18000L, 11, false, true},
      {"lit-dusk-thunder", 33L, 8.5, 70.0, 8.5, 0, 64, 0, 160, 10, 20, "overworld", new int[] {1, 4, 6, 2, 1, 5, 6, 2}, true, 13000L, 4, true, true},
      {"lit-swamp-night", 34L, 8.5, 70.0, 8.5, 0, 64, 0, 160, 10, 20, "overworld", new int[] {6, 6, 6, 4, 6, 1, 6, 6}, true, 42000L, 11, false, true},
      {"lit-animals-day", 35L, 8.5, 70.0, 8.5, 0, 64, 0, 160, 5, 5, "overworld", new int[] {1, 35, 1, 129, 1, 4, 1, 1}, false, 6000L, 0, false, false},
      {"nether-lit-fortress", 36L, 330.5, 64.0, 140.5, 0, 64, 0, 2500, 1, 100, "nether", null, false, 0L, 0, false, true},
    };
    for (Object[] sc : scenarios) {
      SpawnReplay2Probe.mode = (String) sc[11];
      String mode = SpawnReplay2Probe.mode;
      if (sc[12] != null) SpawnListProbe.biomes = (int[]) sc[12];
      SpawnListProbe.caves = (Boolean) sc[13];
      SpawnReplay2Probe.slimeOnly = false; SpawnReplay2Probe.litSurface = false; SpawnReplay2Probe.ocelotOnly = false;
      nether3 = mode.equals("nether"); lit3 = true; sub3 = (Integer) sc[15]; thunder = (Boolean) sc[16];
      realFortress = nether3;
      SpawnReplay2Probe.floorOverride = null; SpawnReplay2Probe.brickOverride = null;
      W3 w = world((Long) sc[1], (Integer) sc[5], (Integer) sc[6], (Integer) sc[7], (Long) sc[14], nether3);
      String startsJson = "null";
      if (nether3) {
        bridge = new atd();
        int pcx = (int) Math.floor((Double) sc[2] / 16), pcz = (int) Math.floor((Double) sc[4] / 16);
        // provideChunk generates every eligible chunk; each one runs the structure driver (range 8 chunks around it).
        for (int cx = pcx - 8; cx <= pcx + 8; cx++) for (int cz = pcz - 8; cz <= pcz + 8; cz++) bridge.a((apu) null, w, cx, cz, (aji[]) null);
        startsJson = FortressProbe.startList(bridge, 1000);
        final List<asv> boxes = new ArrayList<>();
        for (Object o : ((Map<?, ?>) MobMoveProbe.field(ave.class, "d").get(bridge)).values()) boxes.add(((avm) o).a());
        java.util.function.BiPredicate<Integer, Integer> in = (x, z) -> { for (asv b : boxes) if (x >= b.a && x <= b.d && z >= b.c && z <= b.f) return true; return false; };
        SpawnReplay2Probe.floorOverride = (x, z) -> in.test(x, z) ? 62 + (((x >> 3) + (z >> 3)) & 3) : SpawnReplay2Probe.netherFloor(x, z);
        SpawnReplay2Probe.brickOverride = in;
      }
      w.h.add(SpawnReplay2Probe.player(w, (Double) sc[2], (Double) sc[3], (Double) sc[4]));
      boolean hostile = (Boolean) sc[17];
      aho spawner = new aho();
      int ticks = (Integer) sc[8], every = (Integer) sc[9], clearEvery = (Integer) sc[10];
      int[] biomes = mode.equals("overworld") ? SpawnListProbe.biomes : new int[0];
      StringBuilder o = new StringBuilder("{\"case\":\"replay\",\"name\":" + q((String) sc[0]) + ",\"seed\":" + sc[1] + ",\"player\":[" + sc[2] + "," + sc[3] + "," + sc[4] + "],\"spawn\":[" + sc[5] + "," + sc[6] + "," + sc[7] + "],\"mode\":" + q(mode) + ",\"biomes\":" + Arrays.toString(biomes) + ",\"caves\":" + SpawnListProbe.caves + ",\"dayTime\":" + sc[14] + ",\"sub\":" + sub3 + ",\"thunder\":" + thunder + ",\"ticks\":" + ticks + ",\"hostile\":" + hostile + ",\"clearEvery\":" + clearEvery + ",\"animalsEvery\":" + every + ",\"starts\":" + startsJson + ",\"steps\":[");
      for (int tick = 0; tick < ticks; tick++) {
        w.spawned.clear();
        if (tick % clearEvery == 0) w.loaded.clear();
        int total = spawner.a(w, hostile, true, tick % every == 0);
        StringBuilder sp = new StringBuilder("[");
        for (sa e : w.spawned) { if (sp.length() > 1) sp.append(','); sp.append(entity(e)); }
        o.append((tick == 0 ? "" : ",") + "{\"total\":" + total + ",\"seed\":" + q(Long.toString(SpawnListProbe.seedOf(w.s))) + ",\"spawned\":" + sp + "]}");
      }
      System.out.println(o.append("]}"));
    }
  }
}
