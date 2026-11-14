import java.util.*;

// Round 4 of the seeded SpawnerAnimals.findChunksForSpawning (aho.a(mt, ZZZ)) replays: slimes and bats with the rules that rounds 2 and 3
// held fixed. Same double, lit fixture and Entity.rand seeding as SpawnReplay3Probe; this round varies
//  * the world seed (Chunk.getRandomWithSeed(987234911L) in EntitySlime.getCanSpawnHere reads World.getSeed, ahb.H()),
//  * the moon phase (WorldInfo day time -> WorldProvider.getMoonPhase) for the swamp rule (biome 6, 50 < y < 70, light <= nextInt(8)),
//  * the date: the unchanged EntityBat reads World.getCurrentDate (ahb.V()); the double returns a fixed month/day (never the machine
//    clock), so the replay is deterministic: limit 4 normally, 7 from Oct 20 to Nov 3,
//  * the lists: "slime-only" replaces the monster list with one Slime entry (weight 1, groups 4..4) so no other mob pollutes the
//    swamp / slime chunk draws; the bat scenarios keep the real ambient list (only bats) and run with hostile = false.
// The slime size and jump delay draws are repeated after setLocationAndAngles exactly as SpawnReplay2Probe.XSlime does.
public class SpawnReplay4Probe {
  static String q(String s) { return SpawnListProbe.q(s); }
  static int month = 10, day = 31; // Calendar.get(MONTH) is 0-based
  static long worldSeed = 99L;
  static boolean slimeOnly = false;

  public static class W4 extends SpawnReplay3Probe.W3 {
    W4() { super(); }
    public Calendar V() { Calendar c = Calendar.getInstance(); c.set(2014, month, day); return c; }
    public long H() { return worldSeed; }
    public ahx a(sx type, int x, int y, int z) {
      List list = a(x, z).a(type);
      if (slimeOnly && type == sx.a) list = Arrays.asList(new ahx(ym.class, 1, 4, 4));
      if (list == null || list.isEmpty()) return null;
      ahx e = (ahx) qv.a(this.s, list);
      Class<?> sub = SpawnReplay2Probe.SWAP.get(e.b);
      if (sub == null) return e;
      return swapped.computeIfAbsent(sub, k -> new ahx(sub, 1, e.c, e.d));
    }
  }

  static W4 world(long seed, int sx, int sy, int sz, long dayTime, int sub) throws Exception {
    W4 w = (W4) SpawnListProbe.u.allocateInstance(W4.class);
    Object provider = SpawnListProbe.u.allocateInstance(aqq.class);
    MobMoveProbe.set(w, "t", provider);
    MobMoveProbe.field(aqo.class, "h").set(provider, new float[16]);
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a");
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
    w.j = sub;
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
    SpawnReplay2Probe.SWAP.put(ym.class, SpawnReplay2Probe.XSlime.class);
    SpawnReplay2Probe.SWAP.put(we.class, SpawnReplay3Probe.XBat.class);
    for (Map.Entry<Class<?>, Class<?>> e : SpawnReplay2Probe.SWAP.entrySet()) SpawnListProbe.names.put(e.getValue(), SpawnListProbe.names.get(e.getKey()));
    SpawnReplay2Probe.zField = MobMoveProbe.field(sa.class, "Z");
    SpawnReplay2Probe.worldRandField = MobMoveProbe.field(ahb.class, "s");
    SpawnReplay2Probe.oField = MobMoveProbe.field(sa.class, "o");
    int[] plains = {1, 1, 1, 1, 1, 1, 1, 1}, swamp = {6, 6, 6, 6, 6, 6, 6, 6};
    // name, seed, worldSeed, ticks, clearEvery, biomes, caves, dayTime, sub, hostile, slimeOnly, month (0-based), day
    Object[][] scenarios = {
      {"slime-chunk-a", 41L, 99L, 300, 40, plains, true, 18000L, 11, true, true, 10, 14},
      {"slime-chunk-b", 42L, 20261114L, 300, 40, plains, true, 18000L, 11, true, true, 10, 14},
      {"slime-chunk-c", 43L, -777L, 300, 40, plains, true, 6000L, 0, true, true, 10, 14},
      {"swamp-moon0", 44L, 99L, 200, 40, swamp, false, 0L * 24000 + 18000, 11, true, true, 10, 14},
      {"swamp-moon2", 45L, 99L, 200, 40, swamp, false, 2L * 24000 + 18000, 11, true, true, 10, 14},
      {"swamp-moon4", 46L, 99L, 200, 40, swamp, false, 4L * 24000 + 18000, 11, true, true, 10, 14},
      {"swamp-moon6", 47L, 99L, 200, 40, swamp, false, 6L * 24000 + 18000, 11, true, true, 10, 14},
      {"swamp-moon4-dusk", 48L, 99L, 200, 40, swamp, false, 4L * 24000 + 13000, 4, true, true, 10, 14},
      {"bat-halloween", 51L, 99L, 200, 20, plains, true, 6000L, 0, false, false, 9, 31},
      {"bat-oct20", 52L, 99L, 200, 20, plains, true, 6000L, 0, false, false, 9, 20},
      {"bat-nov3", 53L, 99L, 200, 20, plains, true, 6000L, 0, false, false, 10, 3},
      {"bat-oct19", 54L, 99L, 200, 20, plains, true, 6000L, 0, false, false, 9, 19},
      {"bat-nov4", 55L, 99L, 200, 20, plains, true, 6000L, 0, false, false, 10, 4},
      {"bat-nov14", 56L, 99L, 200, 20, plains, true, 6000L, 0, false, false, 10, 14},
      {"bat-cap-halloween", 57L, 99L, 400, 1000000, plains, true, 6000L, 0, false, false, 9, 31},
    };
    for (Object[] sc : scenarios) {
      SpawnReplay2Probe.mode = "overworld";
      SpawnListProbe.biomes = (int[]) sc[5];
      SpawnListProbe.caves = (Boolean) sc[6];
      SpawnReplay2Probe.slimeOnly = false; SpawnReplay2Probe.litSurface = false; SpawnReplay2Probe.ocelotOnly = false;
      SpawnReplay2Probe.floorOverride = null; SpawnReplay2Probe.brickOverride = null;
      SpawnReplay3Probe.lit3 = true; SpawnReplay3Probe.nether3 = false; SpawnReplay3Probe.thunder = false; SpawnReplay3Probe.realFortress = false;
      SpawnReplay3Probe.sub3 = (Integer) sc[8];
      month = (Integer) sc[11]; day = (Integer) sc[12]; worldSeed = (Long) sc[2]; slimeOnly = (Boolean) sc[10];
      W4 w = world((Long) sc[1], 0, 64, 0, (Long) sc[7], (Integer) sc[8]);
      w.h.add(SpawnReplay2Probe.player(w, 8.5, 70.0, 8.5));
      boolean hostile = (Boolean) sc[9];
      aho spawner = new aho();
      int ticks = (Integer) sc[3], clearEvery = (Integer) sc[4];
      StringBuilder o = new StringBuilder("{\"case\":\"replay\",\"name\":" + q((String) sc[0]) + ",\"seed\":" + sc[1] + ",\"worldSeed\":" + sc[2] + ",\"player\":[8.5,70.0,8.5],\"spawn\":[0,64,0],\"mode\":\"overworld\",\"biomes\":" + Arrays.toString((int[]) sc[5]) + ",\"caves\":" + sc[6] + ",\"dayTime\":" + sc[7] + ",\"sub\":" + sc[8] + ",\"hostile\":" + hostile + ",\"slimeOnly\":" + slimeOnly + ",\"month\":" + (month + 1) + ",\"day\":" + day + ",\"ticks\":" + ticks + ",\"clearEvery\":" + clearEvery + ",\"animalsEvery\":1000000,\"steps\":[");
      for (int tick = 0; tick < ticks; tick++) {
        w.spawned.clear();
        if (tick % clearEvery == 0) w.loaded.clear();
        int total = spawner.a(w, hostile, true, tick % 1000000 == 0);
        StringBuilder sp = new StringBuilder("[");
        for (sa e : w.spawned) { if (sp.length() > 1) sp.append(','); sp.append(SpawnReplay2Probe.entity(e)); }
        o.append((tick == 0 ? "" : ",") + "{\"total\":" + total + ",\"seed\":" + q(Long.toString(SpawnListProbe.seedOf(w.s))) + ",\"spawned\":" + sp + "]}");
      }
      System.out.println(o.append("]}"));
    }
  }
}
