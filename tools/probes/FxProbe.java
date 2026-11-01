import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// The particles.png and item-icon particles of the unchanged 1.7.10 client, spawned through
// RenderGlobal.doSpawnParticle (bma.b) as World.spawnParticle does (plus EntityRainFX and
// EntityCrit2FX, which EntityRenderer and EntityPlayerSP construct directly), then their
// onUpdate each tick. Also the entity spawn sites the browser ports: Entity.handleWaterMovement
// (sa.N), EntityAnimal.handleHealthUpdate(18) (wf.a(byte)), EntityLivingBase.onDeathUpdate
// (sv.aF), updatePotionEffects (sv.aO), renderBrokenItemStack (sv.a(add)), PotionHelper's
// liquid colour (aen.a), ItemDye's bone-meal sparkles (acj.a), Block.randomDisplayTick of the
// torch, lit furnace, fire and liquids, and WorldClient.doVoidFogParticles (bjf.C). Same world double and
// random handling as ParticleProbe; no classes patched, no GL call.
public class FxProbe extends ParticleProbe {
  static boolean wet, allAir;
  static List<String> sounds = new ArrayList<>();
  public static class FW extends PWorld {
    FW() { super(); }
    // World.handleMaterialAcceleration for Entity.handleWaterMovement: the fixture says wet.
    public boolean a(azt box, awt material, sa entity) { return wet; }
    public void a(sa e, String name, float volume, float pitch) { sounds.add("[\"" + name + "\"," + (double) volume + "," + (double) pitch + "]"); }
    // WorldClient.playSound (the randomDisplayTick sounds), recorded with the position.
    public void a(double x, double y, double z, String name, float volume, float pitch, boolean delay) {
      sounds.add("[\"" + name + "\"," + x + "," + y + "," + z + "," + (double) volume + "," + (double) pitch + "]");
    }
    // The void-fog case reads an all-air world.
    public aji a(int x, int y, int z) { return allAir ? aji.e(0) : super.a(x, y, z); }
  }
  public static class Animal extends wf {
    Animal() { super((ahb) null); }
    public rx a(rx other) { return null; }
  }
  // particleTextureIndexX + 16 * Y, age, max age.
  static int tex(bkm p) throws Exception { return i(p, "b") + i(p, "c") * 16; }
  static final Map<String, Integer> DRAWS = new HashMap<>();
  static {
    for (String k : new String[] {"bubble", "suspended", "rain", "splash"}) DRAWS.put(k, 5);
    for (String k : new String[] {"depthsuspend", "townaura", "happyVillager", "lava"}) DRAWS.put(k, 6);
    DRAWS.put("flame", 10);
  }
  static String state(bkm p) throws Exception {
    return "[" + p.s + "," + p.t + "," + p.u + "," + p.v + "," + p.w + "," + p.x + "," + i(p, "f") + "," + tex(p) + "," + p.K + "," + p.D
      + "," + (double) fl(p, "at") + "," + (double) fl(p, "au") + "," + (double) fl(p, "av") + "]";
  }
  static String particle(String kind, int fixture, bkm p, long math, String args) throws Exception {
    String initial = spawn(p);
    long seed = back(raw((Random) get(p, "Z")), DRAWS.getOrDefault(kind.startsWith("iconcrack") ? "" : kind, 4));
    initial = "{\"seed\":" + seed + initial.substring(initial.indexOf(",\"x\""));
    StringBuilder track = new StringBuilder(), events = new StringBuilder();
    for (int t = 0; t < 140 && !p.K; t++) {
      calls.clear();
      p.h();
      if (t > 0) { track.append(','); events.append(','); }
      track.append(state(p));
      events.append(calls);
    }
    return "{\"case\":\"particle\",\"kind\":\"" + kind + "\",\"fixture\":" + fixture + ",\"math\":" + math + ",\"args\":" + args
      + ",\"alpha\":" + (double) fl(p, "aw") + ",\"layer\":" + p.a() + ",\"initial\":" + initial + ",\"tracks\":[" + track + "],\"events\":[" + events + "]}";
  }
  static void fixture(int n) {
    cells.clear();
    // 1: a 3x3x3 pool (still water) on the stone floor; 2: a stone ceiling at y 66;
    // 3: still lava pool; 4: a ceiling at y 70 over open air for drips.
    if (n == 1 || n == 3) for (int x = 9; x <= 11; x++) for (int z = 9; z <= 11; z++) for (int y = 64; y <= 66; y++) put(x, y, z, n == 1 ? 9 : 11, 0);
    if (n == 2) put(10, 66, 10, 1, 0);
    if (n == 4) put(10, 70, 10, 1, 0);
  }
  // A field of exactly this class (obfuscated names repeat down the hierarchy).
  static void setIn(Class<?> c, Object o, String name, Object v) throws Exception {
    Field f = c.getDeclaredField(name);
    f.setAccessible(true);
    f.set(o, v);
  }
  static Animal animal(long seed, double x, double y, double z, float w, float h) throws Exception {
    Animal e = (Animal) U.allocateInstance(Animal.class);
    setIn(sa.class, e, "o", world);
    setIn(sa.class, e, "Z", new Random(seed));
    te watcher = new te(e);
    setIn(sa.class, e, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0));
    watcher.a(1, Short.valueOf((short) 300));
    watcher.a(7, Integer.valueOf(0));
    watcher.a(8, Byte.valueOf((byte) 0));
    setIn(sv.class, e, "f", new HashMap<>());
    setIn(sa.class, e, "M", w);
    setIn(sa.class, e, "N", h);
    setIn(sa.class, e, "C", azt.a(0, 0, 0, 0, 0, 0));
    Method pos = sa.class.getDeclaredMethod("b", double.class, double.class, double.class);
    pos.setAccessible(true);
    pos.invoke(e, x, y, z);
    return e;
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    U = (sun.misc.Unsafe) uf.get(null);
    seedField = Random.class.getDeclaredField("seed");
    seedField.setAccessible(true);
    Math.random();
    Field holder = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
    holder.setAccessible(true);
    mathRandom = (Random) holder.get(null);
    aji.p();
    adb.l();
    rg register = Icon::new;
    for (int id = 256; id < 512; id++) {
      adb item = adb.d(id);
      if (item != null) try { item.a(register); } catch (Throwable t) {}
    }
    world = (FW) U.allocateInstance(FW.class);
    set(world, "s", new Random(5));
    set(world, "t", U.allocateInstance(aqq.class));
    set(world, "C", new qi());
    world.E = true;
    effects = new bkn(world, null);
    render = (bma) U.allocateInstance(bma.class);
    bao mc = (bao) U.allocateInstance(bao.class);
    bbj settings = (bbj) U.allocateInstance(bbj.class);
    mc.u = settings;
    mc.k = effects;
    sv viewer = (sv) U.allocateInstance(wo.class);
    mc.i = viewer;
    set(render, "A", mc);
    set(render, "r", world);
    set(viewer, "s", 10.5); set(viewer, "t", 65.62); set(viewer, "u", 10.5);

    // [name, fixture, x, y, z, vx, vy, vz]
    Object[][] cases = {
      {"bubble", 1, 10.5, 65.5, 10.5, 0.1, 0.05, -0.2}, {"bubble", 0, 10.5, 64.5, 10.5, 0.0, 0.0, 0.0},
      {"suspended", 1, 10.3, 65.7, 10.6, 0.0, 0.0, 0.0}, {"suspended", 0, 10.3, 65.7, 10.6, 0.0, 0.0, 0.0},
      {"depthsuspend", 0, 10.2, 64.4, 10.8, 0.0, 0.0, 0.0}, {"townaura", 2, 10.5, 65.8, 10.5, 0.0, 0.0, 0.0},
      {"happyVillager", 0, 10.4, 64.3, 10.6, 0.01, -0.02, 0.015},
      {"crit", 0, 10.5, 65.0, 10.5, 0.3, 0.1, -0.2}, {"crit", 2, 10.5, 65.5, 10.5, 0.0, 1.2, 0.0}, {"magicCrit", 0, 10.5, 65.0, 10.5, -0.4, 0.2, 0.3},
      {"mobSpell", 0, 10.5, 64.8, 10.5, 0.34509803921568627, 0.4627450980392157, 0.3254901960784314},
      {"mobSpellAmbient", 0, 10.5, 64.8, 10.5, 0.3, 0.5, 0.7}, {"spell", 2, 10.5, 65.5, 10.5, 0.0, 0.0, 0.0}, {"spell", 0, 10.5, 64.5, 10.5, 0.2, 0.0, 0.0},
      {"flame", 0, 10.5, 64.7, 10.5, 0.0, 0.0, 0.0}, {"flame", 2, 10.5, 65.7, 10.5, 0.0, 0.05, 0.0},
      {"lava", 0, 10.4, 65.0, 10.6, 0.0, 0.0, 0.0}, {"lava", 2, 10.4, 65.0, 10.6, 0.0, 0.0, 0.0},
      {"splash", 0, 10.5, 64.2, 10.5, 0.0, 0.0, 0.0}, {"splash", 0, 10.5, 64.6, 10.5, 0.12, 0.0, -0.05}, {"splash", 1, 10.5, 66.95, 10.5, 0.0, 0.3, 0.0},
      {"heart", 0, 10.5, 64.5, 10.5, 0.01, 0.0, -0.02}, {"heart", 2, 10.5, 65.5, 10.5, 0.0, 0.0, 0.0}, {"angryVillager", 0, 10.5, 64.5, 10.5, 0.0, 0.0, 0.0},
      {"dripWater", 4, 10.3, 68.95, 10.7, 0.0, 0.0, 0.0}, {"dripLava", 4, 10.3, 68.95, 10.7, 0.0, 0.0, 0.0}, {"dripWater", 1, 10.3, 68.0, 10.7, 0.0, 0.0, 0.0},
      {"iconcrack_297", 0, 10.5, 65.5, 10.5, 0.05, 0.12, -0.03}, {"iconcrack_351_15", 2, 10.5, 65.5, 10.5, 0.0, 0.2, 0.0},
    };
    long M = 0x2545F4914F6CL;
    int n = 0;
    for (Object[] c : cases) {
      String kind = (String) c[0];
      int fx = (Integer) c[1];
      fixture(fx);
      setRaw(mathRandom, M + n++);
      long math = raw(mathRandom);
      calls.clear();
      bkm p = render.b(kind, (double) c[2], (double) c[3], (double) c[4], (double) c[5], (double) c[6], (double) c[7]);
      String a = "[" + c[2] + "," + c[3] + "," + c[4] + "," + c[5] + "," + c[6] + "," + c[7] + "]";
      System.out.println(particle(kind, fx, p, math, a));
    }
    // EntityRenderer.addRainParticles: new EntityRainFX(world, x, y, z), no RenderGlobal.
    for (int fx : new int[] {0, 1}) {
      fixture(fx);
      setRaw(mathRandom, M + n++);
      long math = raw(mathRandom);
      bkm p = new blf(world, 10.4, fx == 1 ? 67.1 : 64.1, 10.6);
      System.out.println(particle("rain", fx, p, math, "[10.4," + (fx == 1 ? 67.1 : 64.1) + ",10.6,0,0,0]"));
    }
    // EntityPlayerSP.onCriticalHit: new EntityCrit2FX(world, entity), added directly; its
    // three updates spawn "crit" through World.spawnParticle (recorded, then real crits).
    {
      fixture(0);
      Animal target = animal(31, 10.5, 64.0, 10.5, 0.9f, 1.3f);
      target.v = 0.2; target.w = 0.1; target.x = -0.1;
      setRaw(mathRandom, M + n++);
      long math = raw(mathRandom);
      calls.clear();
      bkm p = new bjw(world, target);
      String first = calls.toString();
      // The four EntityFX draws, then the constructor's onUpdate: 16 x 3 floats.
      long seed = back(raw((Random) get(p, "Z")), 52);
      StringBuilder events = new StringBuilder();
      for (int t = 0; t < 4 && !p.K; t++) {
        calls.clear();
        p.h();
        if (t > 0) events.append(',');
        events.append(calls);
      }
      System.out.println("{\"case\":\"crit2\",\"math\":" + math + ",\"seed\":" + seed + ",\"constructor\":" + first + ",\"events\":[" + events + "],\"dead\":" + p.K + "}");
    }
    // Entity.handleWaterMovement on its first tick in water (and the first-update skip).
    for (Object[] c : new Object[][] {{0.6f, 0.0, -0.5, 0.0, false}, {0.6f, 0.3, -0.1, 0.25, false}, {0.9f, 0.0, -1.4, 0.0, false}, {0.25f, 1.2, 0.3, -0.8, false}, {0.6f, 0.0, -0.5, 0.0, true}}) {
      fixture(1);
      wet = true;
      sounds.clear(); calls.clear();
      Animal e = animal(77, 10.5, 64.7, 10.5, (Float) c[0], 1.4f);
      e.v = (Double) c[1]; e.w = (Double) c[2]; e.x = (Double) c[3];
      setIn(sa.class, e, "ac", false);
      setIn(sa.class, e, "f", (Boolean) c[4]);
      e.N();
      System.out.println("{\"case\":\"water\",\"width\":" + (double) (Float) c[0] + ",\"motion\":[" + c[1] + "," + c[2] + "," + c[3] + "],\"first\":" + c[4]
        + ",\"x\":10.5,\"minY\":" + e.C.b + ",\"z\":10.5,\"sounds\":" + sounds + ",\"calls\":" + calls + "}");
      wet = false;
    }
    // EntityAnimal.handleHealthUpdate(18) and EntityLivingBase.onDeathUpdate at deathTime 20.
    fixture(0);
    {
      calls.clear();
      Animal e = animal(41, 10.5, 64.0, 10.5, 0.9f, 1.3f);
      e.a((byte) 18);
      System.out.println("{\"case\":\"hearts\",\"seed\":41,\"x\":10.5,\"y\":64.0,\"z\":10.5,\"width\":0.8999999761581421,\"height\":1.2999999523162842,\"calls\":" + calls + "}");
      calls.clear();
      Animal d = animal(43, 10.5, 64.0, 10.5, 0.45f, 0.65f);
      setIn(sv.class, d, "aA", 19);
      Method death = sv.class.getDeclaredMethod("aF");
      death.setAccessible(true);
      death.invoke(d);
      System.out.println("{\"case\":\"death\",\"seed\":43,\"x\":10.5,\"y\":64.0,\"z\":10.5,\"width\":" + (double) 0.45f + ",\"height\":" + (double) 0.65f + ",\"calls\":" + calls + "}");
    }
    // PotionHelper.calcPotionLiquidColor and updatePotionEffects' particle, 40 ticks each.
    {
      int[][] sets = {{17, 0}, {19, 0}, {17, 0, 19, 0}, {19, 1}, {17, 2, 19, 0}};
      for (int[] s : sets) {
        List<rw> list = new ArrayList<>();
        for (int k = 0; k < s.length; k += 2) list.add(new rw(s[k], 100, s[k + 1]));
        int color = aen.a(list);
        for (int mode = 0; mode < 3; mode++) {
          calls.clear();
          Animal e = animal(53 + mode, 10.5, 64.0 + (mode == 2 ? 1.62f : 0), 10.5, 0.6f, 1.8f);
          if (mode == 2) setIn(sa.class, e, "L", 1.62f);
          e.af.b(7, Integer.valueOf(color));
          e.af.b(8, Byte.valueOf((byte) (mode == 1 ? 1 : 0)));
          Method potions = sv.class.getDeclaredMethod("aO");
          potions.setAccessible(true);
          for (int t = 0; t < 40; t++) potions.invoke(e);
          System.out.println("{\"case\":\"potion\",\"effects\":" + Arrays.toString(s) + ",\"color\":" + color + ",\"mode\":" + mode + ",\"seed\":" + (53 + mode)
            + ",\"y\":" + e.t + ",\"yOffset\":" + (double) e.L + ",\"calls\":" + calls + "}");
        }
      }
    }
    // EntityLivingBase.renderBrokenItemStack: 5 "iconcrack_<id>" in front of the eyes.
    for (float[] r : new float[][] {{0, 0}, {37.5f, -20}, {-160, 65}, {90, -90}}) {
      calls.clear(); sounds.clear();
      Animal e = animal(61, 10.5, 64.0, 10.5, 0.6f, 1.8f);
      e.y = r[0]; e.z = r[1];
      setRaw(mathRandom, M + n++);
      long math = raw(mathRandom);
      e.a(new add(adb.d(267)));
      System.out.println("{\"case\":\"crumbs\",\"yaw\":" + (double) r[0] + ",\"pitch\":" + (double) r[1] + ",\"seed\":61,\"math\":" + math + ",\"eye\":" + (e.t + (double) e.g()) + ",\"calls\":" + calls + "}");
    }
    // ItemDye.func_150918_a (aux SFX 2005), Item.itemRand reseeded per case.
    Field itemRand = adb.class.getDeclaredField("g");
    itemRand.setAccessible(true);
    for (int[] c : new int[][] {{6, 0}, {59, 3}, {2, 0}, {0, 0}}) {
      fixture(0);
      put(10, 64, 10, c[0], c[1]);
      itemRand.set(null, new Random(71));
      calls.clear();
      acj.a(world, 10, 64, 10, 0);
      System.out.println("{\"case\":\"bonemeal\",\"block\":" + c[0] + ",\"meta\":" + c[1] + ",\"maxY\":" + aji.e(c[0]).A() + ",\"calls\":" + calls + "}");
    }
    // Block.randomDisplayTick (aji.b) with a seeded Random: [seed, World.spawnParticle calls,
    // WorldClient.playSound calls, Random raw state after]. Cells are [x, y, z, id, meta]; the
    // block itself is at (10, 70, 10), over air unless a cell says otherwise.
    alb.e(); // BlockFire.initFire: the setFireInfo table
    Object[][] display = {
      {"torch floor", 50, 5, 1, new int[][] {}}, {"torch east", 50, 1, 1, new int[][] {}}, {"torch west", 50, 2, 1, new int[][] {}},
      {"torch south", 50, 3, 1, new int[][] {}}, {"torch north", 50, 4, 1, new int[][] {}},
      {"lit furnace", 62, 3, 40, new int[][] {}},
      {"fire on stone", 51, 0, 120, new int[][] {{10, 69, 10, 1, 0}}},
      {"fire by planks", 51, 0, 120, new int[][] {{9, 70, 10, 5, 0}, {10, 70, 11, 5, 0}, {10, 71, 10, 5, 0}}},
      {"fire by planks 2", 51, 0, 60, new int[][] {{11, 70, 10, 5, 0}, {10, 70, 9, 5, 0}}},
      {"still water ceiling", 9, 0, 240, new int[][] {{10, 69, 10, 1, 0}}},
      {"flowing water ceiling", 8, 3, 240, new int[][] {{10, 69, 10, 1, 0}}},
      {"falling water", 8, 8, 60, new int[][] {}},
      {"lava ceiling", 11, 0, 600, new int[][] {{10, 69, 10, 1, 0}}},
      {"covered lava", 11, 0, 60, new int[][] {{10, 71, 10, 1, 0}}},
    };
    for (Object[] c : display) {
      fixture(0);
      int[][] extra = (int[][]) c[4];
      put(10, 70, 10, (Integer) c[1], (Integer) c[2]);
      for (int[] e : extra) put(e[0], e[1], e[2], e[3], e[4]);
      StringBuilder runs = new StringBuilder(), cellText = new StringBuilder();
      for (int[] e : extra) cellText.append(cellText.length() > 0 ? "," : "").append(Arrays.toString(e));
      for (int seed = 0; seed < (Integer) c[3]; seed++) {
        calls.clear(); sounds.clear();
        Random r = new Random(seed);
        aji.e((Integer) c[1]).b(world, 10, 70, 10, r);
        runs.append(seed > 0 ? "," : "").append("[" + seed + "," + calls + "," + sounds + "," + raw(r) + "]");
      }
      System.out.println("{\"case\":\"display\",\"name\":\"" + c[0] + "\",\"block\":" + c[1] + ",\"meta\":" + c[2] + ",\"cells\":[" + cellText + "],\"runs\":[" + runs + "]}");
    }
    // WorldClient.doVoidFogParticles over an all-air world (no display ticks run): 1000 cells
    // within 15 blocks of (10, 4, 10) from World.rand; air below y 8 rolls depthsuspend.
    allAir = true;
    for (long seed : new long[] {1, 2, 3}) {
      calls.clear();
      Random r = new Random(seed);
      set(world, "s", r);
      world.C(10, 4, 10);
      System.out.println("{\"case\":\"voidfog\",\"seed\":" + seed + ",\"calls\":" + calls + ",\"after\":" + raw(r) + "}");
    }
    allAir = false;
  }
}
