import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged EntityChicken (wg), EntityEgg (zl) and EntityAgeable (rx) classes
// from the 1.7.10 JAR on top of the MobMoveProbe world double (a flat stone floor at
// y < 0). The chicken is built with its real constructor; its AI task lists are emptied
// so no wander/panic roll disturbs the motion. Prints one JSON object per line:
//   facts      constructor facts: size, attribute base values, egg timer range, child age
//   fall       per-tick onGround, y, motionY and the wing fields bp..bt of wg.e() while
//              the chicken drops from y = 6, lands, hops (sv.bj) and lands again
//   eggtimer   wg.e() with bu = 1 for seeded Entity.rand: sound pitch, next timer, drops
//   child      the same with the chicken a chick (age -24000): no egg, no sound
//   drops      wg.b(ZI) (dropFewItems) for seeded Entity.rand, with and without fire
//   hatch      EntityEgg.onImpact (zl.a) on a block for Entity.rand seeded i * 2654435761: chicks and
//              snowballpoof particles spawned
public class ChickenProbe {
  public static class World extends MobMoveProbe.ProbeWorld {
    static List<String> sounds = new ArrayList<>();
    static List<Object> spawned = new ArrayList<>();
    static int particles = 0;
    public boolean d(sa entity) { spawned.add(entity); return true; }
    public void a(sa entity, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { if (name.equals("snowballpoof")) particles++; }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  static void clearTasks(sw e) throws Exception {
    for (Field f : sw.class.getDeclaredFields())
      if (f.getType() == uj.class) {
        f.setAccessible(true);
        Object tasks = f.get(e);
        for (Field l : uj.class.getDeclaredFields())
          if (l.getType() == List.class) { l.setAccessible(true); ((List) l.get(tasks)).clear(); }
      }
  }

  static wg chicken(sun.misc.Unsafe u, World w, double y, long seed) throws Exception {
    wg e = new wg(w);
    clearTasks(e);
    MobMoveProbe.set(e, "Z", new Random(seed));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64.0, y, 64.0);
    return e;
  }

  static String row(wg e) throws Exception {
    return "{\"y\":" + num(MobMoveProbe.d(e, "t")) + ",\"vy\":" + num(MobMoveProbe.d(e, "w")) + ",\"onGround\":" + MobMoveProbe.b(e, "D")
      + ",\"bp\":" + num(e.bp) + ",\"bq\":" + num(e.bq) + ",\"br\":" + num(e.br) + ",\"bs\":" + num(e.bs) + ",\"bt\":" + num(e.bt) + "}";
  }

  static void tick(wg e) throws Exception {
    MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s"));
    MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t"));
    MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
    e.e();
  }

  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append('"').append(l.get(i)).append('"');
    return s.append("]").toString();
  }

  static String drops() {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < World.spawned.size(); i++) {
      xk item = (xk) World.spawned.get(i);
      add stack = item.f();
      s.append(i > 0 ? "," : "").append("[\"").append(stack.b() == ade.aK ? "egg" : stack.b() == ade.G ? "feather" : stack.b() == ade.bf ? "raw" : stack.b() == ade.bg ? "cooked" : "other").append("\",").append(stack.b).append(']');
    }
    return s.append("]").toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    World world = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields()) // loaded entity/tile lists of the constructor-less world
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class)); // WorldProviderSurface: Entity.dimension = t.i

    // Constructor facts and the range of the initial egg timer (Entity.rand is unseeded
    // here, so only the extremes are recorded).
    int min = Integer.MAX_VALUE, max = Integer.MIN_VALUE;
    for (int i = 0; i < 4000; i++) { wg e = new wg(world); min = Math.min(min, e.bu); max = Math.max(max, e.bu); }
    wg base = new wg(world);
    System.out.println("{\"case\":\"facts\",\"width\":" + num(MobMoveProbe.fl(base, "M")) + ",\"height\":" + num(MobMoveProbe.fl(base, "N"))
      + ",\"maxHealth\":" + num(((ti) base.a(yj.a)).e()) + ",\"speed\":" + num(((ti) base.a(yj.d)).e())
      + ",\"eggTimerMin\":" + min + ",\"eggTimerMax\":" + max + ",\"wingRotDelta\":" + num(base.bt) + ",\"age\":" + base.d() + "}");

    // Fall from y = 6 for 40 ticks, a hop (motionY = 0.42, as sv.bj) and 40 more ticks.
    {
      wg e = chicken(u, world, 6.0, 1);
      StringBuilder out = new StringBuilder();
      for (int i = 0; i < 40; i++) { tick(e); out.append(i > 0 ? "," : "").append(row(e)); }
      MobMoveProbe.set(e, "w", 0.42);
      for (int i = 0; i < 40; i++) { tick(e); out.append(",").append(row(e)); }
      System.out.println("{\"case\":\"fall\",\"hopAt\":40,\"ticks\":[" + out + "]}");
    }

    // Egg laying: bu = 1 counts to 0 on the first tick. Entity.rand is seeded so the
    // pitch (two nextFloat) and the next timer (nextInt(6000)) are reproducible.
    for (long seed = 0; seed < 6; seed++) {
      World.sounds.clear(); World.spawned.clear();
      wg e = chicken(u, world, 0.0, seed);
      e.bu = 1;
      tick(e);
      System.out.println("{\"case\":\"eggtimer\",\"seed\":" + seed + ",\"sounds\":" + strings(World.sounds) + ",\"drops\":" + drops() + ",\"next\":" + e.bu + "}");
    }
    {
      World.sounds.clear(); World.spawned.clear();
      wg e = chicken(u, world, 0.0, 3);
      e.c(-24000);
      e.bu = 1;
      for (int i = 0; i < 5; i++) tick(e);
      System.out.println("{\"case\":\"child\",\"age\":" + e.d() + ",\"bu\":" + e.bu + ",\"sounds\":" + strings(World.sounds) + ",\"drops\":" + drops() + "}");
    }

    // dropFewItems (wg.b(ZI) with looting 0), burning or not.
    java.lang.reflect.Method drop = MobMoveProbe.method(wg.class, "b", boolean.class, int.class);
    for (int fire = 0; fire < 2; fire++)
      for (long seed = 0; seed < 300; seed++) {
        World.spawned.clear();
        wg e = chicken(u, world, 0.0, seed);
        if (fire == 1) e.e(10);
        drop.invoke(e, true, 0);
        System.out.println("{\"case\":\"drops\",\"burning\":" + (fire == 1) + ",\"seed\":" + seed + ",\"items\":" + drops() + "}");
      }

    // EntityEgg.onImpact on a block hit.
    java.lang.reflect.Method impact = MobMoveProbe.method(zl.class, "a", azu.class);
    StringBuilder chicks = new StringBuilder(), parts = new StringBuilder();
    String sample = "null";
    for (long seed = 0; seed < 4000; seed++) {
      World.spawned.clear(); World.particles = 0;
      zl egg = new zl(world, 10.5, 20.25, 30.75);
      MobMoveProbe.set(egg, "Z", new Random(seed * 2654435761L)); // consecutive small seeds never roll nextInt(8) == 0
      MobMoveProbe.set(egg, "y", 135f);
      MobMoveProbe.set(egg, "z", -20f);
      impact.invoke(egg, new azu(10, 20, 30, 1, azw.a(10.5, 20.25, 30.75)));
      chicks.append(seed > 0 ? "," : "").append(World.spawned.size());
      parts.append(seed > 0 ? "," : "").append(World.particles);
      if (World.spawned.size() == 1 && sample.equals("null")) {
        wg c = (wg) World.spawned.get(0);
        sample = "{\"seed\":" + seed * 2654435761L + ",\"age\":" + c.d() + ",\"x\":" + num(MobMoveProbe.d(c, "s")) + ",\"y\":" + num(MobMoveProbe.d(c, "t")) + ",\"z\":" + num(MobMoveProbe.d(c, "u"))
          + ",\"yaw\":" + num(MobMoveProbe.fl(c, "y")) + ",\"pitch\":" + num(MobMoveProbe.fl(c, "z")) + ",\"child\":" + c.f() + "}";
      }
    }
    System.out.println("{\"case\":\"hatch\",\"seeds\":4000,\"chicks\":[" + chicks + "],\"particles\":[" + parts + "],\"sample\":" + sample + "}");
  }
}
