import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged EntityMooshroom (wm), EntityCow (wh), EntityAnimal (wf), EntityAgeable (rx), EntitySnowman (wr),
// EntityGolem (wl), EntityIronGolem (wt), BlockPumpkin (amw), EntitySnowball (zj) and the EntityAI* classes of the 1.7.10 JAR on the
// WitchProbe world double (GW: SlimeProbe.SW plus a block map that records setBlock/notify, a biome switch and a water flag).
// Nothing is patched; every Entity.rand that matters is a seeded java.util.Random (a snowball's own rand is seeded the way
// WitchProbe.flight seeds a potion's). Prints one JSON object per line: facts, tasks, shear, bowl, bucket, breed, spawn, drops,
// build, trail, damage, flight, think, model.
public class MooshroomGolemProbe {
  public static class GW extends SlimeProbe.SW {
    static ahu biome = ahu.o;
    static boolean wet = false;
    static List<String> log = new ArrayList<>();
    public ahu a(int x, int z) { return biome; }
    public boolean a(azt box, awt material, sa entity) { return wet; }
    public int j(int x, int y, int z) { return DifficultyProbe.World.light; } // getFullBlockLightValue
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      WitchProbe.WW.cells.put(x + "," + y + "," + z, new int[] {aji.b(b), meta});
      log.add("[" + x + "," + y + "," + z + "," + aji.b(b) + "," + meta + "," + flags + "]");
      return true;
    }
    public void c(int x, int y, int z, aji b) { log.add("[\"notify\"," + x + "," + y + "," + z + "]"); }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }
  static Object call(Object o, Class<?> c, String name, Class<?>[] types, Object... args) throws Exception { return MobMoveProbe.method(c, name, types).invoke(o, args); }

  static void reset() {
    WitchProbe.reset();
    GW.log.clear(); GW.biome = ahu.o; GW.wet = false;
    DifficultyProbe.World.swirls.clear(); DifficultyProbe.World.swirlNames.clear();
    DifficultyProbe.World.light = 15;
    WitchProbe.Target.thrower = null;
  }

  static <T extends sw> T place(T e, double x, double y, double z, long seed, float yaw, float pitch) throws Exception {
    set(e, "Z", new Random(seed));
    set(e, "y", yaw); set(e, "z", pitch); set(e, "aO", yaw); set(e, "aM", yaw); set(e, "aN", yaw); set(e, "aP", yaw);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    return e;
  }
  static wm mooshroom(long seed) throws Exception { return place(new wm(WitchProbe.w), 64.5, 0, 64.5, seed, 33f, 12f); }
  static wh cow(long seed) throws Exception { return place(new wh(WitchProbe.w), 64.5, 0, 64.5, seed, 33f, 12f); }

  static WitchProbe.Gamer player(boolean creative) throws Exception {
    WitchProbe.Gamer p = WitchProbe.player(64.5, 0, 64.0, creative);
    fd(yw.class, "d").setBoolean(((yz) p).bE, creative);
    return p;
  }
  static String stack(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"; }
  static String inventory(yz p) {
    StringBuilder s = new StringBuilder();
    yx inv = p.bm;
    for (int i = 0; i < inv.a.length; i++) if (inv.a[i] != null) s.append(s.length() > 0 ? "," : "").append("[").append(i).append(",").append(adb.b(inv.a[i].b())).append(",").append(inv.a[i].b).append(",").append(inv.a[i].k()).append("]");
    return "[" + s + "]";
  }
  static String entities() {
    StringBuilder s = new StringBuilder();
    for (Object o : ChickenProbe.World.spawned) {
      if (s.length() > 0) s.append(",");
      if (o instanceof xk) {
        xk it = (xk) o; add st = it.f();
        s.append("{\"item\":[").append(adb.b(st.b())).append(",").append(st.b).append(",").append(st.k()).append("],\"at\":[").append(num(it.s)).append(",").append(num(it.t)).append(",").append(num(it.u)).append("]}");
      } else {
        sa e = (sa) o;
        s.append("{\"class\":").append(q(e.getClass().getName())).append(",\"at\":[").append(num(e.s)).append(",").append(num(e.t)).append(",").append(num(e.u)).append("],\"yaw\":").append(num(e.y)).append(",\"pitch\":").append(num(e.z));
        if (e instanceof sv) s.append(",\"health\":").append(num(((sv) e).aS())).append(",\"maxHealth\":").append(num(((sv) e).a(yj.a).e())).append(",\"renderYawOffset\":").append(num(((sv) e).aM));
        if (e instanceof wt) s.append(",\"playerCreated\":").append(((wt) e).cc());
        if (e instanceof rx) s.append(",\"age\":").append(((rx) e).d());
        s.append("}");
      }
    }
    return "[" + s + "]";
  }
  static String particles() {
    StringBuilder s = new StringBuilder();
    for (int i = 0; i < DifficultyProbe.World.swirls.size(); i++) {
      double[] v = DifficultyProbe.World.swirls.get(i);
      s.append(i > 0 ? "," : "").append("[").append(q(DifficultyProbe.World.swirlNames.get(i))).append(",").append(num(v[0])).append(",").append(num(v[1])).append(",").append(num(v[2])).append("]");
    }
    return "[" + s + "]";
  }
  static String strings(List<String> l) { return WitchProbe.strings(l); }

  static void facts() throws Exception {
    reset();
    StringBuilder rows = new StringBuilder();
    sw[] mobs = {new wm(WitchProbe.w), new wh(WitchProbe.w), new wr(WitchProbe.w), new wt(WitchProbe.w)};
    String[] names = {"mooshroom", "cow", "snowman", "iron_golem"};
    for (int i = 0; i < mobs.length; i++) {
      sw e = mobs[i];
      Class<?> c = e.getClass();
      Object drop = MobMoveProbe.method(c, "u").invoke(e);
      rows.append(i > 0 ? "," : "").append("{\"name\":").append(q(names[i])).append(",\"class\":").append(q(c.getName())).append(",\"super\":").append(q(c.getSuperclass().getName()))
        .append(",\"width\":").append(num(e.M)).append(",\"height\":").append(num(e.N)).append(",\"maxHealth\":").append(e.a(yj.a).e()).append(",\"health\":").append(num(e.aS()))
        .append(",\"speedAttr\":").append(e.a(yj.d).e()).append(",\"followRange\":").append(e.a(yj.b).e()).append(",\"knockbackResist\":").append(e.a(yj.c).e())
        .append(",\"say\":").append(q((String) MobMoveProbe.method(c, "t").invoke(e))).append(",\"hurt\":").append(q((String) MobMoveProbe.method(c, "aT").invoke(e)))
        .append(",\"death\":").append(q((String) MobMoveProbe.method(c, "aU").invoke(e))).append(",\"volume\":").append(num((Float) MobMoveProbe.method(c, "bf").invoke(e)))
        .append(",\"pitch\":").append(num((Float) MobMoveProbe.method(sv.class, "bg").invoke(e))).append(",\"drop\":").append(drop == null ? "null" : adb.b((adb) drop))
        .append(",\"eyeHeight\":").append(num(e.g())).append(",\"talkInterval\":").append(e.q()).append(",\"canDespawn\":").append(MobMoveProbe.method(sw.class, "v").invoke(e))
        .append(",\"aiEnabled\":").append(MobMoveProbe.method(c, "bk").invoke(e)).append(",\"maxSpawnedInChunk\":").append(e.bB()).append("}");
    }
    System.out.println("{\"case\":\"facts\",\"rows\":[" + rows + "]}");
    // Cow step sound (EntityCow.func_145780_a) plays "mob.cow.step" at 0.15, 1.0.
    reset();
    wm m = mooshroom(1);
    MobMoveProbe.method(wh.class, "a", int.class, int.class, int.class, aji.class).invoke(m, 64, 0, 64, aji.e(2));
    System.out.println("{\"case\":\"step\",\"sounds\":" + strings(ChickenProbe.World.sounds) + "}");
  }

  static void tasks() throws Exception {
    WitchProbe.NAMES.put("uz", "EntityAIPanic"); WitchProbe.NAMES.put("ua", "EntityAIMate"); WitchProbe.NAMES.put("vk", "EntityAITempt");
    WitchProbe.NAMES.put("uh", "EntityAIFollowParent");
    String[] fields = {"c", "d"};
    String[] names = {"mooshroom", "cow", "snowman"};
    for (String n : names) {
      reset();
      sw e = n.equals("mooshroom") ? mooshroom(1) : n.equals("cow") ? cow(1) : place(new wr(WitchProbe.w), 64.5, 0, 64.5, 1, 0f, 0f);
      for (String f : fields) {
        StringBuilder rows = new StringBuilder();
        for (uk k : WitchProbe.entries(e, f)) rows.append(rows.length() > 0 ? "," : "").append("{\"priority\":").append(fd(uk.class, "b").getInt(k)).append(",\"class\":").append(q(WitchProbe.NAMES.getOrDefault(k.a.getClass().getName(), k.a.getClass().getName()))).append(",\"params\":").append(WitchProbe.params(k.a)).append("}");
        System.out.println("{\"case\":\"tasks\",\"mob\":" + q(n) + ",\"list\":" + q(f.equals("c") ? "tasks" : "targets") + ",\"rows\":[" + rows + "]}");
      }
    }
  }

  static void giveHeld(WitchProbe.Gamer p, add st) { p.bm.a[0] = st; p.bm.c = 0; }
  static void fill(WitchProbe.Gamer p) { for (int i = 1; i < 36; i++) p.bm.a[i] = new add(aji.e(1), 64); }

  // Interaction with the player holding `item` on a mooshroom or cow. Records the return value, held stack, inventory, spawned things.
  static void interact(String kind, String mob, adb item, int count, boolean full, boolean creative, int age, int damage, int health) throws Exception {
    reset();
    WitchProbe.Gamer p = player(creative);
    giveHeld(p, new add(item, count, damage));
    if (full) fill(p);
    sw e = mob.equals("mooshroom") ? mooshroom(3) : cow(3);
    ((rx) e).a(age);
    e.g((float) health);
    ChickenProbe.World.spawned.clear(); ChickenProbe.World.sounds.clear();
    boolean r = ((rx) e).a((yz) p);
    System.out.println("{\"case\":\"" + kind + "\",\"mob\":" + q(mob) + ",\"count\":" + count + ",\"full\":" + full + ",\"creative\":" + creative + ",\"age\":" + age + ",\"damage\":" + damage + ",\"health\":" + health
      + ",\"result\":" + r + ",\"dead\":" + e.K + ",\"held\":" + stack(p.bm.a[0]) + ",\"inventory\":" + inventory(p) + ",\"spawned\":" + entities() + ",\"particles\":" + particles() + ",\"sounds\":" + strings(ChickenProbe.World.sounds) + "}");
  }

  static void interactions() throws Exception {
    for (String mob : new String[] {"mooshroom", "cow"}) {
      // shears: adult at two health values, damaged shears, creative, calf, a stack of 2, empty-hand control
      interact("shear", mob, ade.aZ, 1, false, false, 0, 0, 10);
      interact("shear", mob, ade.aZ, 1, false, false, 0, 7, 6);
      interact("shear", mob, ade.aZ, 1, false, true, 0, 0, 10);
      interact("shear", mob, ade.aZ, 1, false, false, -6000, 0, 10);
      interact("shear", mob, ade.aZ, 1, false, false, 0, 237, 10);
      // bowl
      interact("bowl", mob, ade.z, 1, false, false, 0, 0, 10);
      interact("bowl", mob, ade.z, 2, false, false, 0, 0, 10);
      interact("bowl", mob, ade.z, 2, true, false, 0, 0, 10);
      interact("bowl", mob, ade.z, 2, false, true, 0, 0, 10);
      interact("bowl", mob, ade.z, 1, false, true, 0, 0, 10);
      interact("bowl", mob, ade.z, 1, false, false, -6000, 0, 10);
      // bucket
      interact("bucket", mob, ade.ar, 1, false, false, 0, 0, 10);
      interact("bucket", mob, ade.ar, 3, false, false, 0, 0, 10);
      interact("bucket", mob, ade.ar, 3, true, false, 0, 0, 10);
      interact("bucket", mob, ade.ar, 1, false, true, 0, 0, 10);
      interact("bucket", mob, ade.ar, 1, false, false, -6000, 0, 10);
      interact("bucket", mob, ade.aB, 1, false, false, 0, 0, 10);
    }
  }

  static void breed() throws Exception {
    reset();
    wm m = mooshroom(1); wh c = cow(1);
    StringBuilder items = new StringBuilder();
    adb[] list = {ade.O, ade.A, ade.z, ade.ay, ade.aZ};
    for (adb i : list) items.append(items.length() > 0 ? "," : "").append("[").append(adb.b(i)).append(",").append(m.c(new add(i)) ).append(",").append(c.c(new add(i))).append("]");
    // createChild: mooshroom x mooshroom, cow x cow, cow x mooshroom, mooshroom x cow
    String kids = "[" + q(m.c(mooshroom(2)).getClass().getName()) + "," + q(c.b(cow(2)).getClass().getName()) + "," + q(c.b(mooshroom(2)).getClass().getName()) + "," + q(m.c(cow(2)).getClass().getName()) + "]";
    System.out.println("{\"case\":\"breed\",\"breedingItems\":[" + items + "],\"children\":" + kids + ",\"canMate\":[" + m.a((wf) mooshroom(4)) + "," + m.a((wf) cow(4)) + "]}");
  }

  static void spawn() throws Exception {
    // EntityAnimal.getCanSpawnHere (wf.by): grass below, block light > 8
    StringBuilder rows = new StringBuilder();
    int[][] cases = {{2, 9}, {2, 15}, {2, 8}, {110, 15}, {3, 15}, {1, 15}};
    for (int[] c : cases) {
      for (String mob : new String[] {"mooshroom", "cow"}) {
        reset();
        WitchProbe.WW.cells.put("64,-1,64", new int[] {c[0], 0});
        DifficultyProbe.World.light = c[1];
        sw e = mob.equals("mooshroom") ? mooshroom(1) : cow(1);
        boolean ok = (Boolean) call(e, wf.class, "by", new Class<?>[0]);
        rows.append(rows.length() > 0 ? "," : "").append("[").append(q(mob)).append(",").append(c[0]).append(",").append(c[1]).append(",").append(ok).append("]");
      }
    }
    System.out.println("{\"case\":\"spawn\",\"rows\":[" + rows + "]}");
  }

  static void drops() throws Exception {
    for (String mob : new String[] {"mooshroom", "cow", "snowman"}) {
      for (int looting = 0; looting <= 3; looting += 3) {
        for (boolean burning : new boolean[] {false, true}) {
          if (burning && !mob.equals("mooshroom")) continue;
          StringBuilder rows = new StringBuilder();
          for (long seed = 0; seed < 120; seed++) {
            reset();
            sw e = mob.equals("mooshroom") ? mooshroom(seed) : mob.equals("cow") ? cow(seed) : place(new wr(WitchProbe.w), 64.5, 0, 64.5, seed, 0f, 0f);
            if (burning) e.e(100);
            MobMoveProbe.method(sw.class, "b", boolean.class, int.class).invoke(e, true, looting);
            StringBuilder items = new StringBuilder();
            for (Object o : ChickenProbe.World.spawned) { add st = ((xk) o).f(); items.append(items.length() > 0 ? "," : "").append("[").append(adb.b(st.b())).append(",").append(st.b).append("]"); }
            rows.append(seed > 0 ? "," : "").append("[").append(items).append("]");
          }
          System.out.println("{\"case\":\"drops\",\"mob\":" + q(mob) + ",\"looting\":" + looting + ",\"burning\":" + burning + ",\"rows\":[" + rows + "]}");
        }
      }
    }
  }

  static void set(int x, int y, int z, int id) { WitchProbe.WW.cells.put(x + "," + y + "," + z, new int[] {id, 0}); }
  static String cellsAround(int x, int y, int z) {
    StringBuilder s = new StringBuilder();
    for (int yy = y + 1; yy >= y - 3; yy--) for (int xx = x - 2; xx <= x + 2; xx++) for (int zz = z - 2; zz <= z + 2; zz++) {
      int[] c = WitchProbe.WW.cells.get(xx + "," + yy + "," + zz);
      if (c != null && c[0] != 0) s.append(s.length() > 0 ? "," : "").append("[").append(xx - x).append(",").append(yy - y).append(",").append(zz - z).append(",").append(c[0]).append("]");
    }
    return "[" + s + "]";
  }

  // BlockPumpkin.onBlockAdded (amw.b) on the block map. `cells` is [dx, dy, dz, id] relative to the pumpkin at (64, 64, 64).
  static void build(String name, int head, int[][] cells) throws Exception {
    reset();
    for (int[] c : cells) set(64 + c[0], 64 + c[1], 64 + c[2], c[3]);
    set(64, 64, 64, head);
    ChickenProbe.World.spawned.clear();
    String before = cellsAround(64, 64, 64);
    ((amw) aji.e(head)).b(WitchProbe.w, 64, 64, 64);
    int snowshovel = 0, snowballpoof = 0;
    double minY = 1e9, maxY = -1e9;
    for (int i = 0; i < DifficultyProbe.World.swirlNames.size(); i++) {
      String n = DifficultyProbe.World.swirlNames.get(i);
      double[] v = DifficultyProbe.World.swirls.get(i);
      if (n.equals("snowshovel")) snowshovel++; if (n.equals("snowballpoof")) snowballpoof++;
      minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    }
    System.out.println("{\"case\":\"build\",\"name\":" + q(name) + ",\"head\":" + head + ",\"before\":" + before + ",\"after\":" + cellsAround(64, 64, 64) + ",\"writes\":" + GW.log + ",\"spawned\":" + entities()
      + ",\"snowshovel\":" + snowshovel + ",\"snowballpoof\":" + snowballpoof + ",\"particleY\":[" + (snowshovel + snowballpoof > 0 ? num(minY) + "," + num(maxY) : "") + "]}");
  }

  static void builds() throws Exception {
    int SNOW = 80, IRON = 42, PUMP = 86, LIT = 91;
    for (int head : new int[] {PUMP, LIT}) {
      String h = head == PUMP ? "pumpkin" : "lit";
      build(h + "-snow", head, new int[][] {{0, -1, 0, SNOW}, {0, -2, 0, SNOW}, {0, -3, 0, 1}});
      build(h + "-snow-one", head, new int[][] {{0, -1, 0, SNOW}, {0, -2, 0, 1}});
      build(h + "-snow-layer", head, new int[][] {{0, -1, 0, 78}, {0, -2, 0, 78}});
      build(h + "-snow-gap", head, new int[][] {{0, -1, 0, SNOW}, {0, -3, 0, SNOW}});
      build(h + "-iron-x", head, new int[][] {{0, -1, 0, IRON}, {0, -2, 0, IRON}, {-1, -1, 0, IRON}, {1, -1, 0, IRON}});
      build(h + "-iron-z", head, new int[][] {{0, -1, 0, IRON}, {0, -2, 0, IRON}, {0, -1, -1, IRON}, {0, -1, 1, IRON}});
      build(h + "-iron-both", head, new int[][] {{0, -1, 0, IRON}, {0, -2, 0, IRON}, {-1, -1, 0, IRON}, {1, -1, 0, IRON}, {0, -1, -1, IRON}, {0, -1, 1, IRON}});
      build(h + "-iron-one-arm", head, new int[][] {{0, -1, 0, IRON}, {0, -2, 0, IRON}, {-1, -1, 0, IRON}});
      build(h + "-iron-no-legs", head, new int[][] {{0, -1, 0, IRON}, {-1, -1, 0, IRON}, {1, -1, 0, IRON}});
      build(h + "-iron-diagonal", head, new int[][] {{0, -1, 0, IRON}, {0, -2, 0, IRON}, {-1, -1, 1, IRON}, {1, -1, -1, IRON}});
      build(h + "-iron-arms-high", head, new int[][] {{0, -1, 0, IRON}, {0, -2, 0, IRON}, {-1, 0, 0, IRON}, {1, 0, 0, IRON}});
      build(h + "-mixed", head, new int[][] {{0, -1, 0, SNOW}, {0, -2, 0, IRON}});
      build(h + "-nothing", head, new int[][] {});
    }
  }

  static void trail() throws Exception {
    int[] biomes = {1, 2, 12, 5, 6, 21, 8, 14, 0, 4, 13, 10};
    for (int id : biomes) {
      reset();
      GW.biome = ahu.d(id);
      wr e = place(new wr(WitchProbe.w), 64.9, 0, 64.1, 1, 0f, 0f);
      ChickenProbe.clearTasks(e);
      set(63, -1, 64, 79); // ice below one corner cell: BlockSnow.canPlaceBlockAt refuses it
      WitchProbe.tick(e);
      StringBuilder out = new StringBuilder();
      for (String k : WitchProbe.WW.cells.keySet()) { int[] c = WitchProbe.WW.cells.get(k); if (c[0] == 78) out.append(out.length() > 0 ? "," : "").append("\"").append(k).append("\""); }
      System.out.println("{\"case\":\"trail\",\"biome\":" + id + ",\"temperature\":" + num(GW.biome.a(64, 0, 64)) + ",\"pos\":[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "],\"health\":" + num(e.aS()) + ",\"placed\":[" + out + "]}");
    }
    // existing blocks are not replaced
    reset();
    wr e = place(new wr(WitchProbe.w), 64.9, 0, 64.1, 1, 0f, 0f);
    ChickenProbe.clearTasks(e);
    set(65, 0, 64, 1); set(64, 0, 64, 78);
    WitchProbe.tick(e);
    StringBuilder out = new StringBuilder();
    for (String k : WitchProbe.WW.cells.keySet()) { int[] c = WitchProbe.WW.cells.get(k); if (c[0] == 78) out.append(out.length() > 0 ? "," : "").append("\"").append(k).append("\""); }
    System.out.println("{\"case\":\"trail\",\"biome\":\"blocked\",\"placed\":[" + out + "],\"writes\":" + GW.log + "}");
  }

  static void damage() throws Exception {
    // EntityLivingBase.attackEntityFrom with the sources EntitySnowman.onLivingUpdate uses, plus generic and fall
    List<Object[]> sources = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (Field f : ro.class.getDeclaredFields())
      if (f.getType() == ro.class && java.lang.reflect.Modifier.isStatic(f.getModifiers()) && seen.add(((ro) f.get(null)).o)) sources.add(new Object[] {((ro) f.get(null)).o, f.get(null)});
    for (Object[] s : sources) {
      for (String mob : new String[] {"snowman", "iron_golem"}) {
        reset();
        sw e = mob.equals("snowman") ? place(new wr(WitchProbe.w), 64.5, 0, 64.5, 1, 0f, 0f) : place(new wt(WitchProbe.w), 64.5, 0, 64.5, 1, 0f, 0f);
        float before = e.aS();
        boolean r = e.a((ro) s[1], 1.0f);
        System.out.println("{\"case\":\"damage\",\"mob\":" + q(mob) + ",\"source\":" + q((String) s[0]) + ",\"type\":" + q(((ro) s[1]).o) + ",\"result\":" + r + ",\"before\":" + num(before) + ",\"after\":" + num(e.aS()) + "}");
      }
    }
    // fall (EntityLivingBase.fall, b(F)): golems override it with an empty body
    for (String mob : new String[] {"snowman", "iron_golem", "cow"}) {
      reset();
      sw e = mob.equals("snowman") ? place(new wr(WitchProbe.w), 64.5, 0, 64.5, 1, 0f, 0f) : mob.equals("iron_golem") ? place(new wt(WitchProbe.w), 64.5, 0, 64.5, 1, 0f, 0f) : cow(1);
      float before = e.aS();
      String err = null;
      try { MobMoveProbe.method(sv.class, "b", float.class).invoke(e, 10f); } catch (Exception ex) { err = String.valueOf(ex.getCause()); }
      System.out.println("{\"case\":\"fall\",\"mob\":" + q(mob) + ",\"distance\":10.0,\"before\":" + num(before) + ",\"after\":" + num(e.aS()) + ",\"sounds\":" + strings(ChickenProbe.World.sounds) + "}");
    }
  }

  static zj ball(wr shooter, long seed, sv target) throws Exception {
    double tx = target.s, ty = target.C.b, tz = target.u;
    zj b = new zj(WitchProbe.w, shooter);
    set(b, "Z", new Random(seed));
    double dx = tx - shooter.s, dy = ty + target.g() - 1.100000023841858 - b.t, dz = tz - shooter.u;
    float f1 = (float) (Math.sqrt(dx * dx + dz * dz) * 0.2f);
    b.c(dx, dy + f1, dz, 1.6f, 12.0f);
    return b;
  }

  // EntitySnowman.attackEntityWithRangedAttack's aim (the formula, with a seeded rand) then EntityThrowable.onUpdate until it hits or dies.
  static void flight(String name, long seed, double tx, double tz, boolean hit) throws Exception {
    reset();
    wr e = place(new wr(WitchProbe.w), 64.5, 0, 64.5, 1, 0f, 0f);
    WitchProbe.Target.thrower = e;
    WitchProbe.bodies.add(e);
    WitchProbe.Target t = WitchProbe.pig(tx, 0, tz);
    zj b = ball(e, seed, t);
    ChickenProbe.World.spawned.clear();
    StringBuilder rows = new StringBuilder();
    for (int i = 0; i < 60; i++) {
      set(b, "p", b.s); set(b, "q", b.t); set(b, "r", b.u);
      b.h();
      rows.append(i > 0 ? "," : "").append("[").append(num(b.s)).append(",").append(num(b.t)).append(",").append(num(b.u)).append(",").append(num(b.v)).append(",").append(num(b.w)).append(",").append(num(b.x)).append(",").append(b.K).append("]");
      if (b.K) break;
    }
    System.out.println("{\"case\":\"flight\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"target\":[" + num(tx) + "," + num(tz) + "],\"start\":[" + num(0) + "],\"hits\":" + WitchProbe.hitLog + ",\"targetHealth\":" + num(t.aS()) + ",\"particles\":" + particles() + ",\"ticks\":[" + rows + "]}");
  }

  static void shootOnce() throws Exception {
    // The real attackEntityWithRangedAttack (wr.a(sv, F)): spawn point, sound, and the deterministic part of the motion
    reset();
    wr e = place(new wr(WitchProbe.w), 64.5, 0, 64.5, 1, 0f, 0f);
    WitchProbe.Target t = WitchProbe.pig(64.5, 0, 72.5);
    ChickenProbe.World.spawned.clear(); ChickenProbe.World.sounds.clear();
    e.a((sv) t, 1.0f);
    StringBuilder s = new StringBuilder();
    for (Object o : ChickenProbe.World.spawned) { sa b = (sa) o; s.append(s.length() > 0 ? "," : "").append("{\"class\":").append(q(b.getClass().getName())).append(",\"at\":[").append(num(b.s)).append(",").append(num(b.t)).append(",").append(num(b.u)).append("],\"motion\":[").append(num(b.v)).append(",").append(num(b.w)).append(",").append(num(b.x)).append("]}"); }
    System.out.println("{\"case\":\"shoot\",\"eye\":" + num(e.g()) + ",\"targetEye\":" + num(t.g()) + ",\"spawned\":[" + s + "],\"sounds\":" + strings(ChickenProbe.World.sounds) + "}");
  }

  static String shots() {
    StringBuilder s = new StringBuilder();
    for (Object o : ChickenProbe.World.spawned) {
      if (!(o instanceof zj)) continue;
      zj p = (zj) o;
      s.append(s.length() > 0 ? "," : "").append("[").append(num(p.s)).append(",").append(num(p.t)).append(",").append(num(p.u)).append(",").append(num(p.v)).append(",").append(num(p.w)).append(",").append(num(p.x)).append("]");
    }
    ChickenProbe.World.spawned.clear();
    return "[" + s + "]";
  }
  static String running(sw e) throws Exception { return WitchProbe.running(e); }

  static void think(String kind, long seed, int ticks) throws Exception {
    reset();
    wr e = place(new wr(WitchProbe.w), 64.5, 0, 64.5, seed, 0f, 0f);
    WitchProbe.Target.thrower = e;
    WitchProbe.Undead z = null;
    WitchProbe.Gamer p = null;
    switch (kind) {
      case "zombie": z = WitchProbe.zombie(64.5, 0, 72.5); break;
      case "zombie-edge": z = WitchProbe.zombie(64.5, 0, 74.5); break;
      case "zombie-far": z = WitchProbe.zombie(64.5, 0, 82.5); break;
      case "zombie-wall": z = WitchProbe.zombie(64.5, 0, 72.5); for (int y = 0; y < 3; y++) for (int x = 60; x < 70; x++) set(x, y, 68, 1); break;
      case "pig": WitchProbe.pig(64.5, 0, 72.5); break;
      case "player": p = player(false); WitchProbe.Gamer q = WitchProbe.player(64.5, 0, 70.5, false); break;
      default: break;
    }
    StringBuilder out = new StringBuilder();
    List<Integer> shotTicks = new ArrayList<>();
    for (int i = 0; i < ticks; i++) {
      WitchProbe.tick(e);
      String s = shots();
      if (!s.equals("[]")) shotTicks.add(i);
      sa target = ((td) e).o();
      out.append(i > 0 ? "," : "").append("[").append(num(e.s)).append(",").append(num(e.t)).append(",").append(num(e.u)).append(",").append(num(e.y)).append(",").append(target == null ? "0" : "1").append(",").append(s).append("]");
    }
    System.out.println("{\"case\":\"think\",\"kind\":" + q(kind) + ",\"seed\":" + seed + ",\"shotTicks\":" + shotTicks + ",\"sounds\":" + strings(ChickenProbe.World.sounds) + ",\"hits\":" + WitchProbe.hitLog + ",\"ticks\":[" + out + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    WitchProbe.u = MobMoveProbe.unsafe();
    sun.misc.Unsafe u = WitchProbe.u;
    WitchProbe.w = (WitchProbe.WW) u.allocateInstance(GW.class);
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
    tasks();
    interactions();
    breed();
    spawn();
    drops();
    builds();
    trail();
    damage();
    shootOnce();
    flight("static", 3, 64.5, 72.5, true);
    flight("static-far", 4, 64.5, 78.5, true);
    flight("near", 5, 64.5, 67.5, true);
    for (long seed = 1; seed <= 2; seed++) {
      think("idle", seed, 200);
      think("zombie", seed, 200);
      think("zombie-edge", seed, 160);
      think("zombie-far", seed, 160);
      think("zombie-wall", seed, 160);
      think("pig", seed, 160);
      think("player", seed, 160);
    }
    ModelProbe.dump("snowman", new bif());
  }
}
