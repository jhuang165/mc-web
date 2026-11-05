import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged EntitySlime (ym), EntityLiving (sw), EntityLivingBase (sv), Chunk (apx.getRandomWithSeed) and ModelSlime (bie/bot
// via ModelProbe) of the 1.7.10 JAR on the WitchProbe world double (constructor-less World, entity list, block map, real EntityPlayer double).
// Nothing is patched; Entity.rand is a seeded java.util.Random wherever a result depends on it (the constructor's own unseeded rolls of size
// and jump delay are bounded in "facts"). Prints one JSON object per line: facts, jumpDelay, split, drops, xp, chunkRandom, spawn, spawnChunk,
// attack, think, model.
public class SlimeProbe {
  public static class SW extends WitchProbe.WW {
    static boolean swamp = false;
    static Map<Long, apx> chunks = new HashMap<>();
    public apx d(int x, int z) {
      long key = ((long) (x >> 4) << 32) ^ ((z >> 4) & 0xffffffffL);
      apx c = chunks.get(key);
      if (c == null) {
        try {
          c = (apx) WitchProbe.u.allocateInstance(apx.class);
          Field gx = MobMoveProbe.field(apx.class, "g"), hz = MobMoveProbe.field(apx.class, "h"), world = MobMoveProbe.field(apx.class, "e");
          WitchProbe.u.putInt(c, WitchProbe.u.objectFieldOffset(gx), x >> 4);
          WitchProbe.u.putInt(c, WitchProbe.u.objectFieldOffset(hz), z >> 4);
          world.set(c, this);
        } catch (Exception ex) { throw new RuntimeException(ex); }
        chunks.put(key, c);
      }
      return c;
    }
    public ahu a(int x, int z) { return swamp ? ahu.u : ahu.o; }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static void setSeed(long seed) throws Exception { fd(ays.class, "a").setLong(fd(ahb.class, "x").get(WitchProbe.w), seed); }
  static void setTime(long t) throws Exception { DifficultyProbe.w = WitchProbe.w; DifficultyProbe.setTime(t); }

  static ym slime(int size, double x, double y, double z, long seed) throws Exception {
    ym e = new ym(WitchProbe.w);
    MobMoveProbe.set(e, "Z", new Random(seed));
    for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, n, 0f);
    MobMoveProbe.method(ym.class, "a", int.class).invoke(e, size);
    MobMoveProbe.set(e, "bn", 15);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    return e;
  }
  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append(q(l.get(i)));
    return s.append("]").toString();
  }

  static void facts() throws Exception {
    WitchProbe.reset();
    StringBuilder rows = new StringBuilder();
    for (int size : new int[] {1, 2, 3, 4, 8}) {
      ym e = slime(size, 64.5, 0, 64.5, 1);
      Class<?> c = ym.class;
      rows.append(rows.length() > 0 ? "," : "").append("{\"size\":").append(size).append(",\"stored\":").append(e.bX())
        .append(",\"width\":").append(num(e.M)).append(",\"height\":").append(num(e.N)).append(",\"maxHealth\":").append(e.a(yj.a).e())
        .append(",\"health\":").append(num(e.aS())).append(",\"speedAttr\":").append(e.a(yj.d).e()).append(",\"followRange\":").append(e.a(yj.b).e())
        .append(",\"experienceValue\":").append(MobMoveProbe.fl(e, "b") == 0 ? MobMoveProbe.field(sw.class, "b").getInt(e) : MobMoveProbe.field(sw.class, "b").getInt(e))
        .append(",\"damage\":").append(MobMoveProbe.method(c, "bU").invoke(e)).append(",\"canDamage\":").append(MobMoveProbe.method(c, "bT").invoke(e))
        .append(",\"hurt\":").append(q((String) MobMoveProbe.method(c, "aT").invoke(e))).append(",\"death\":").append(q((String) MobMoveProbe.method(c, "aU").invoke(e)))
        .append(",\"jumpSound\":").append(q((String) MobMoveProbe.method(c, "bV").invoke(e))).append(",\"particle\":").append(q((String) MobMoveProbe.method(c, "bP").invoke(e)))
        .append(",\"volume\":").append(num((Float) MobMoveProbe.method(c, "bf").invoke(e))).append(",\"makesJumpSound\":").append(MobMoveProbe.method(c, "bY").invoke(e))
        .append(",\"landSound\":").append(MobMoveProbe.method(c, "bW").invoke(e)).append(",\"drop\":").append(MobMoveProbe.method(c, "u").invoke(e) == null ? "null" : adb.b((adb) MobMoveProbe.method(c, "u").invoke(e)))
        .append(",\"eyeHeight\":").append(num(e.g())).append(",\"talkInterval\":").append(e.q()).append(",\"canDespawn\":").append(MobMoveProbe.method(sw.class, "v").invoke(e))
        .append(",\"aiEnabled\":").append(MobMoveProbe.method(ym.class, "bk").invoke(e)).append(",\"pitch\":").append(num((Float) MobMoveProbe.method(sv.class, "bg").invoke(e)))
        .append(",\"maxSpawnedInChunk\":").append(e.bB()).append("}");
    }
    int min = 99, max = -1, sizes = 0;
    Map<Integer, Integer> hist = new TreeMap<>();
    for (int i = 0; i < 4000; i++) {
      ym e = new ym(WitchProbe.w);
      min = Math.min(min, MobMoveProbe.field(ym.class, "bn").getInt(e)); max = Math.max(max, MobMoveProbe.field(ym.class, "bn").getInt(e));
      hist.merge(e.bX(), 1, Integer::sum);
    }
    System.out.println("{\"case\":\"facts\",\"rows\":[" + rows + "],\"constructorJumpDelay\":[" + min + "," + max + "],\"constructorSizes\":" + hist.keySet() + ",\"saveSizeTag\":\"Size\"}");
  }

  static void jumpDelay() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (long seed = 0; seed < 200; seed++) {
      ym e = slime(1, 64.5, 0, 64.5, seed);
      rows.append(seed > 0 ? "," : "").append(MobMoveProbe.method(ym.class, "bR").invoke(e));
    }
    System.out.println("{\"case\":\"jumpDelay\",\"rows\":[" + rows + "]}");
  }

  // setDead (B): a slime above size 1 that has died splits into 2 + nextInt(3) children of size / 2.
  static void split() throws Exception {
    for (int size : new int[] {1, 2, 4, 8}) {
      StringBuilder rows = new StringBuilder();
      for (long seed = 0; seed < 100; seed++) {
        WitchProbe.reset();
        ym e = slime(size, 64.5, 3, 70.5, seed);
        e.g(0f);
        e.B();
        StringBuilder kids = new StringBuilder();
        for (Object o : ChickenProbe.World.spawned) {
          ym k = (ym) o;
          kids.append(kids.length() > 0 ? "," : "").append("[").append(k.bX()).append(",").append(num(k.s)).append(",").append(num(k.t)).append(",").append(num(k.u)).append(",").append(num(k.y)).append(",").append(num(k.aS())).append(",").append(num(k.M)).append("]");
        }
        rows.append(seed > 0 ? "," : "").append("[").append(kids).append("]");
      }
      System.out.println("{\"case\":\"split\",\"size\":" + size + ",\"rows\":[" + rows + "]}");
    }
    // A slime that is not dead (health > 0) does not split; a client world never does.
    WitchProbe.reset();
    ym alive = slime(4, 64.5, 3, 70.5, 1);
    alive.B();
    System.out.println("{\"case\":\"splitAlive\",\"children\":" + ChickenProbe.World.spawned.size() + "}");
  }

  static void drops() throws Exception {
    for (int size : new int[] {1, 2}) {
      for (int looting = 0; looting <= 3; looting += 3) {
        StringBuilder rows = new StringBuilder();
        for (long seed = 0; seed < 120; seed++) {
          WitchProbe.reset();
          ym e = slime(size, 64.5, 0, 64.5, seed);
          MobMoveProbe.method(sw.class, "b", boolean.class, int.class).invoke(e, true, looting);
          StringBuilder items = new StringBuilder();
          for (Object o : ChickenProbe.World.spawned) { add st = ((xk) o).f(); items.append(items.length() > 0 ? "," : "").append("[").append(adb.b(st.b())).append(",").append(st.b).append("]"); }
          rows.append(seed > 0 ? "," : "").append("[").append(items).append("]");
        }
        System.out.println("{\"case\":\"drops\",\"size\":" + size + ",\"looting\":" + looting + ",\"rows\":[" + rows + "]}");
      }
    }
  }

  static void xp() throws Exception {
    WitchProbe.reset();
    WitchProbe.Gamer p = WitchProbe.player(64.5, 0, 64.5, false);
    StringBuilder rows = new StringBuilder();
    for (int size : new int[] {1, 2, 3, 4, 8}) {
      ym e = slime(size, 64.5, 0, 64.5, 5);
      rows.append(rows.length() > 0 ? "," : "").append("[").append(size).append(",").append(MobMoveProbe.method(sw.class, "e", yz.class).invoke(e, p)).append("]");
    }
    System.out.println("{\"case\":\"xp\",\"rows\":[" + rows + "]}");
  }

  // Chunk.getRandomWithSeed(987234911L).nextInt(10) == 0 for chunk coordinates of several world seeds.
  static void chunkRandom() throws Exception {
    long[] seeds = {0L, 1L, 12345L, -987654321L, 4611686018427387903L, -4172144997902289642L};
    int[][] samples = {{0, 0}, {1000000, -1000000}, {-30000, 30000}, {46341, 46341}, {-46341, 46341}, {2000000, 2000000}, {-1, -1}, {7, -3}};
    StringBuilder out = new StringBuilder();
    for (long seed : seeds) {
      setSeed(seed);
      SW.chunks.clear();
      StringBuilder grid = new StringBuilder();
      int count = 0;
      for (int cz = -40; cz <= 40; cz++)
        for (int cx = -40; cx <= 40; cx++) {
          boolean hit = WitchProbe.w.d(cx << 4, cz << 4).a(987234911L).nextInt(10) == 0;
          grid.append(hit ? '1' : '0');
          if (hit) count++;
        }
      StringBuilder samp = new StringBuilder();
      for (int[] s : samples) samp.append(samp.length() > 0 ? "," : "").append("[").append(s[0]).append(",").append(s[1]).append(",").append(WitchProbe.w.d(s[0] << 4, s[1] << 4).a(987234911L).nextInt(10)).append("]");
      out.append(out.length() > 0 ? "," : "").append("{\"seed\":\"").append(seed).append("\",\"count\":").append(count).append(",\"grid\":\"").append(grid).append("\",\"samples\":[").append(samp).append("]}");
    }
    System.out.println("{\"case\":\"chunkRandom\",\"min\":-40,\"max\":40,\"rows\":[" + out + "]}");
  }

  // Entity seeds are spread (seed * 2654435761): java.util.Random with consecutive small seeds gives nearly equal first draws.
  static boolean canSpawn(ym e, long entSeed) throws Exception {
    MobMoveProbe.set(e, "Z", new Random(entSeed * 2654435761L));
    return e.by();
  }

  // getCanSpawnHere (by): the swamp rule over biome, height, moon phase, block light, size and difficulty; and the slime chunk rule.
  static void spawn() throws Exception {
    setSeed(12345);
    StringBuilder moon = new StringBuilder();
    for (int phase = 0; phase < 8; phase++) { setTime(phase * 24000L); moon.append(moon.length() > 0 ? "," : "").append(num(WitchProbe.w.y())); }
    SW.swamp = true;
    System.out.println("{\"case\":\"spawnFacts\",\"moonFactors\":[" + moon + "],\"swampBiome\":" + (WitchProbe.w.a(0, 0) == ahu.u) + ",\"light\":" + WitchProbe.w.k(0, 60, 0) + "}");
    SW.swamp = false;
    StringBuilder rows = new StringBuilder();
    int[] ys = {45, 50, 51, 55, 65, 69, 70, 75, 30};
    for (int diff = 0; diff <= 2; diff += 2)
      for (int size : new int[] {1, 2})
        for (int swamp = 0; swamp <= 1; swamp++)
          for (int phase = 0; phase < 8; phase += 1)
            for (int light : new int[] {0, 3, 7, 15})
              for (int y : ys) {
                SW.swamp = swamp == 1;
                fd(ahb.class, "r").set(WitchProbe.w, rd.values()[diff]);
                setTime(phase * 24000L);
                DifficultyProbe.World.light = light;
                StringBuilder bits = new StringBuilder();
                for (long s = 0; s < 24; s++) {
                  WitchProbe.reset();
                  ym e = slime(size, 64.5, y, 64.5, 0);
                  bits.append(canSpawn(e, s) ? '1' : '0');
                }
                rows.append(rows.length() > 0 ? "," : "").append("[").append(diff).append(",").append(size).append(",").append(swamp).append(",").append(phase).append(",").append(light).append(",").append(y).append(",\"").append(bits).append("\"]");
              }
    System.out.println("{\"case\":\"spawn\",\"seeds\":24,\"seedMultiplier\":2654435761,\"worldSeed\":12345,\"rows\":[" + rows + "]}");
    SW.swamp = false;
    fd(ahb.class, "r").set(WitchProbe.w, rd.values()[2]);
    setTime(0);
    DifficultyProbe.World.light = 15;
    // The slime chunk rule on plains at several heights: entity seeds 0..199 against chunks 0..15 x 0..15 for two world seeds.
    for (long world : new long[] {12345L, -987654321L}) {
      setSeed(world);
      SW.chunks.clear();
      for (int y : new int[] {30, 39, 40, 41}) {
        StringBuilder grid = new StringBuilder();
        for (int cz = 0; cz < 16; cz++) {
          for (int cx = 0; cx < 16; cx++) {
            StringBuilder bits = new StringBuilder();
            for (long s = 0; s < 60; s++) {
              WitchProbe.reset();
              ym e = slime(1, cx * 16 + 8.5, y, cz * 16 + 8.5, 0);
              bits.append(canSpawn(e, s) ? '1' : '0');
            }
            grid.append(cx + cz > 0 ? "," : "").append("\"").append(bits).append("\"");
          }
        }
        System.out.println("{\"case\":\"spawnChunk\",\"worldSeed\":\"" + world + "\",\"y\":" + y + ",\"entitySeeds\":60,\"seedMultiplier\":2654435761,\"chunks\":16,\"rows\":[" + grid + "]}");
      }
    }
    setSeed(1);
  }

  // onCollideWithPlayer (b_): a player within 0.6 * size (distance squared < (0.6 * size)^2) takes `size` mob damage if size > 1.
  static void attack() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (int size : new int[] {1, 2, 4})
      for (double d : new double[] {0.2, 0.5, 0.7, 1.1, 1.3, 2.3, 2.5, 3.0}) {
        WitchProbe.reset();
        ym e = slime(size, 64.5, 0, 64.5, 9);
        WitchProbe.Gamer p = WitchProbe.player(64.5, 0, 64.5 + d, false);
        MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(p, 64.5, 0.0, 64.5 + d);
        e.b_(p);
        rows.append(rows.length() > 0 ? "," : "").append("{\"size\":").append(size).append(",\"dist\":").append(d).append(",\"hits\":").append(WitchProbe.hitLog)
          .append(",\"sounds\":").append(strings(ChickenProbe.World.sounds)).append(",\"rand\":").append(((Random) fd(sa.class, "Z").get(e)).nextInt()).append("}");
      }
    System.out.println("{\"case\":\"attack\",\"rows\":[" + rows + "]}");
  }

  static String state(ym e) throws Exception {
    return "[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "," + num(e.y) + "," + num(e.aO) + "," + (e.D ? 1 : 0)
      + "," + num(e.h) + "," + num(e.i) + "," + num(e.bm) + "," + MobMoveProbe.field(ym.class, "bn").getInt(e) + "," + (MobMoveProbe.b(e, "bc") ? 1 : 0) + "," + num(e.be) + "," + num(e.bd) + "," + e.aS() + "," + (e.K ? 1 : 0) + "]";
  }

  // The slime's own tick (onUpdate h: squish, then EntityLivingBase.onUpdate with updateEntityActionState) with the real world double.
  static void think(String kind, int size, long seed, int ticks) throws Exception {
    WitchProbe.reset();
    DifficultyProbe.World.swirls.clear(); DifficultyProbe.World.swirlNames.clear();
    ym e = slime(size, 64.5, 0, 64.5, seed);
    WitchProbe.Gamer p = null;
    double px = 64.5, pz = 64.5;
    switch (kind) {
      case "near": p = WitchProbe.player(64.5, 0, 72.5, false); pz = 72.5; break;
      case "far": p = WitchProbe.player(64.5, 0, 90.5, false); pz = 90.5; break;
      case "creative": p = WitchProbe.player(64.5, 0, 72.5, true); pz = 72.5; break;
      case "peaceful": fd(ahb.class, "r").set(WitchProbe.w, rd.values()[0]); break;
      case "water": for (int x = 60; x < 70; x++) for (int y = 0; y < 3; y++) for (int z = 60; z < 70; z++) WitchProbe.WW.cells.put(x + "," + y + "," + z, new int[] {9, 0}); break;
      default: break;
    }
    StringBuilder out = new StringBuilder();
    List<Integer> particleTicks = new ArrayList<>();
    for (int i = 0; i < ticks; i++) {
      int before = DifficultyProbe.World.swirls.size();
      MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s")); MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t")); MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
      e.h();
      out.append(i > 0 ? "," : "").append(state(e));
      if (DifficultyProbe.World.swirls.size() > before) particleTicks.add(i);
    }
    fd(ahb.class, "r").set(WitchProbe.w, rd.values()[2]);
    System.out.println("{\"case\":\"think\",\"kind\":" + q(kind) + ",\"size\":" + size + ",\"seed\":" + seed + ",\"player\":" + (p == null ? "null" : "[" + num(px) + ",0," + num(pz) + "]")
      + ",\"fields\":\"x,y,z,vx,vy,vz,yaw,head,onGround,squishAmount,squishFactor,prevSquishFactor,jumpDelay,jumping,moveForward,moveStrafing,health,dead\""
      + ",\"particleTicks\":" + particleTicks + ",\"particleNames\":" + new TreeSet<>(DifficultyProbe.World.swirlNames).stream().map(SlimeProbe::q).toList()
      + ",\"particleCount\":" + DifficultyProbe.World.swirls.size() + ",\"sounds\":" + strings(ChickenProbe.World.sounds) + ",\"ticks\":[" + out + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    WitchProbe.u = MobMoveProbe.unsafe();
    sun.misc.Unsafe u = WitchProbe.u;
    WitchProbe.w = (WitchProbe.WW) u.allocateInstance(SW.class);
    WitchProbe.WW w = WitchProbe.w;
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    fd(ays.class, "g").setLong(info, 1);
    fd(ays.class, "x").set(info, new agy());
    fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    fd(ahb.class, "J").set(w, date);
    fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.World.light = 15;

    facts();
    jumpDelay();
    split();
    drops();
    xp();
    chunkRandom();
    spawn();
    attack();
    for (int size : new int[] {1, 2, 4}) {
      for (long seed = 1; seed <= 2; seed++) { think("idle", size, seed, 160); think("near", size, seed, 160); }
      think("far", size, 3, 120);
      think("creative", size, 3, 120);
      think("water", size, 3, 120);
    }
    think("peaceful", 2, 3, 5);
    // The model (bit ModelSlime inner body, bis outer shell) is dumped by ModelProbe.
    ModelProbe.dump("slime", new bie(16));
  }
}
