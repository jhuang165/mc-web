import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged PathFinder (ayg) on hand-built block worlds, like
// tools/probes/MobMoveProbe.java: the world is an ahb subclass with a block lookup
// (a(III)), the entities are constructor-less EntityPig (wo) doubles whose box,
// width, height and flags are set by reflection. ayg.a(sa, III, F) is the entity
// to block search PathNavigate.getPathToXYZ reaches through World.getEntityPathToXYZ
// (the ChunkCache wrapper of that method is skipped: it only snapshots blocks);
// ayg.a(sa, sa, F) is the entity to entity search of getPathToEntityLiving.
// Each scenario prints one JSON line: the box list that builds the world (later
// boxes win; ids 0 air, 1 stone, 2 grass, 9 water, 11 lava), the entity, the flags
// (PathFinder e openDoors, f breakDoors, g avoidsWater, h canSwim) and the PathEntity
// point list or null.
//
public class PathProbe {
  static List<int[]> boxes = new ArrayList<>();

  // Every scenario sits dy blocks up: PathFinder.getSafePoint only follows a fall while
  // y > 0, so the cases near y 0 (dy = 0) record that edge and the rest stay clear of it.
  static int dy = 32;

  static void box(int x0, int y0, int z0, int x1, int y1, int z1, int id) { boxes.add(new int[] {x0, y0 + dy, z0, x1, y1 + dy, z1, id}); }

  static int blockId(int x, int y, int z) {
    int id = 0;
    for (int[] b : boxes) if (x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]) id = b[6];
    return id;
  }

  public static class ProbeWorld extends ahb {
    ProbeWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { return aji.e(blockId(x, y, z)); }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public List a(sa entity, azt box) { return new ArrayList(); }
  }

  static sun.misc.Unsafe unsafe() throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    return (sun.misc.Unsafe) f.get(null);
  }

  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
      } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }

  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static double d(Object o, String name) throws Exception { return field(o.getClass(), name).getDouble(o); }
  static float fl(Object o, String name) throws Exception { return field(o.getClass(), name).getFloat(o); }
  static boolean b(Object o, String name) throws Exception { return field(o.getClass(), name).getBoolean(o); }

  static Method method(Class<?> c, String name, Class<?>... args) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try {
        Method m = c.getDeclaredMethod(name, args);
        m.setAccessible(true);
        return m;
      } catch (NoSuchMethodException e) {}
    throw new NoSuchMethodException(name);
  }

  static sw spawn(sun.misc.Unsafe u, ProbeWorld w, double x, double y, double z, float width, float height, boolean inWater, boolean inLava) throws Exception {
    sw e = (sw) u.allocateInstance(wo.class);
    set(e, "o", w);
    set(e, "Z", new Random(1));
    set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
    set(e, "M", width);
    set(e, "N", height);
    method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    set(e, "ac", inWater); // Entity.inWater, read by isInWater (sa.M)
    return e;
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  static String worldJson() {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < boxes.size(); i++) {
      int[] b = boxes.get(i);
      if (i > 0) s.append(",");
      s.append("[").append(b[0]).append(",").append(b[1]).append(",").append(b[2]).append(",").append(b[3]).append(",").append(b[4]).append(",").append(b[5]).append(",").append(b[6]).append("]");
    }
    return s.append("]").toString();
  }

  static String pathJson(ayf path) {
    if (path == null) return "null";
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < path.d(); i++) {
      aye p = path.a(i);
      if (i > 0) s.append(",");
      s.append("[").append(p.a).append(",").append(p.b).append(",").append(p.c).append("]");
    }
    return s.append("]").toString();
  }

  static void scenario(sun.misc.Unsafe u, ProbeWorld w, String name, String type, float width, float height, double[] from, double[] to, boolean entityTarget, float range, boolean avoidsWater, boolean canSwim, boolean inWater, boolean inLava) throws Exception {
    from = new double[] {from[0], from[1] + dy, from[2]};
    to = new double[] {to[0], to[1] + dy, to[2]};
    sw e = spawn(u, w, from[0], from[1], from[2], width, height, inWater, inLava);
    ayg finder = new ayg(w, true, false, avoidsWater, canSwim);
    ayf path;
    String target;
    if (entityTarget) {
      sw t = spawn(u, w, to[0], to[1], to[2], 0.6f, 1.8f, false, false);
      path = finder.a((sa) e, (sa) t, range);
      target = "{\"entity\":[" + num(to[0]) + "," + num(to[1]) + "," + num(to[2]) + "]}";
    } else {
      path = finder.a((sa) e, (int) to[0], (int) to[1], (int) to[2], range);
      target = "{\"block\":[" + (int) to[0] + "," + (int) to[1] + "," + (int) to[2] + "]}";
    }
    System.out.println("{\"case\":\"path\",\"name\":\"" + name + "\",\"entity\":{\"type\":\"" + type + "\",\"x\":" + num(from[0]) + ",\"y\":" + num(from[1]) + ",\"z\":" + num(from[2]) + ",\"width\":" + num(width) + ",\"height\":" + num(height)
      + ",\"inWater\":" + inWater + ",\"inLava\":" + inLava + "},\"target\":" + target + ",\"range\":" + num(range)
      + ",\"flags\":{\"openDoors\":true,\"breakDoors\":false,\"avoidsWater\":" + avoidsWater + ",\"canSwim\":" + canSwim + "},\"world\":" + worldJson() + ",\"path\":" + pathJson(path) + "}");
  }

  static void floor() {
    boxes.clear();
    box(-100, -10, -100, 100, 0, 100, 1);
  }

  static final double[] ORIGIN = {0.5, 1.0, 0.5};

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = unsafe();
    ProbeWorld world = (ProbeWorld) u.allocateInstance(ProbeWorld.class);
    set(world, "s", new Random(2));
    set(world, "C", new qi());
    float[] ps = {0.9f, 0.9f}, zs = {0.6f, 1.8f}, cs = {0.3f, 0.7f}, ws = {1.4f, 0.9f}, hs = {0.9f, 1.3f};

    floor();
    scenario(u, world, "open pig", "pig", ps[0], ps[1], ORIGIN, new double[] {6, 1, 3}, false, 16f, true, false, false, false);
    scenario(u, world, "open zombie", "zombie", zs[0], zs[1], ORIGIN, new double[] {-5, 1, 7}, false, 40f, false, false, false, false);
    scenario(u, world, "open chicken", "chicken", cs[0], cs[1], ORIGIN, new double[] {4, 1, -6}, false, 16f, true, false, false, false);
    scenario(u, world, "open wide", "wide", ws[0], ws[1], ORIGIN, new double[] {5, 1, 5}, false, 16f, false, false, false, false);
    scenario(u, world, "open cow", "cow", hs[0], hs[1], ORIGIN, new double[] {-4, 1, 3}, false, 16f, true, false, false, false);
    scenario(u, world, "zombie to entity", "zombie", zs[0], zs[1], ORIGIN, new double[] {8.5, 1.0, -4.5}, true, 40f, false, false, false, false);
    scenario(u, world, "out of range", "pig", ps[0], ps[1], ORIGIN, new double[] {30, 1, 0}, false, 16f, true, false, false, false);
    scenario(u, world, "already there", "pig", ps[0], ps[1], ORIGIN, new double[] {0, 1, 0}, false, 16f, true, false, false, false);

    // A wall at x = 3 spanning z -4..4 two blocks high: the pig walks around it.
    floor();
    box(3, 1, -4, 3, 2, 4, 1);
    scenario(u, world, "around a wall pig", "pig", ps[0], ps[1], ORIGIN, new double[] {6, 1, 0}, false, 16f, true, false, false, false);
    scenario(u, world, "around a wall zombie", "zombie", zs[0], zs[1], ORIGIN, new double[] {6, 1, 0}, false, 40f, false, false, false, false);
    scenario(u, world, "around a wall wide", "wide", ws[0], ws[1], ORIGIN, new double[] {6, 1, 0}, false, 16f, false, false, false, false);

    // A full enclosure around the target: no route, so the path ends at the closest point.
    floor();
    box(4, 1, -2, 8, 3, 2, 1);
    box(5, 1, -1, 7, 3, 1, 0);
    scenario(u, world, "walled in target", "pig", ps[0], ps[1], ORIGIN, new double[] {6, 1, 0}, false, 16f, true, false, false, false);

    // A one block step: up it with a jump.
    floor();
    box(3, 1, -10, 20, 1, 10, 1);
    scenario(u, world, "one block step pig", "pig", ps[0], ps[1], ORIGIN, new double[] {6, 2, 0}, false, 16f, true, false, false, false);
    scenario(u, world, "one block step zombie", "zombie", zs[0], zs[1], ORIGIN, new double[] {6, 2, 0}, false, 40f, false, false, false, false);
    scenario(u, world, "one block step wide", "wide", ws[0], ws[1], ORIGIN, new double[] {6, 2, 0}, false, 16f, false, false, false, false);

    // A two block cliff: no jump up (the target is on the top).
    floor();
    box(3, 1, -10, 20, 2, 10, 1);
    scenario(u, world, "two block cliff", "pig", ps[0], ps[1], ORIGIN, new double[] {6, 3, 0}, false, 16f, true, false, false, false);

    // Drops: a 2 block drop is allowed (three tries), a 4 block drop is refused.
    floor();
    box(3, -10, -10, 20, 0, 10, 0);
    box(3, -10, -10, 20, -2, 10, 1);
    scenario(u, world, "two block drop", "pig", ps[0], ps[1], ORIGIN, new double[] {6, -1, 0}, false, 16f, true, false, false, false);
    floor();
    box(3, -10, -10, 20, 0, 10, 0);
    box(3, -10, -10, 20, -4, 10, 1);
    scenario(u, world, "four block drop", "pig", ps[0], ps[1], ORIGIN, new double[] {6, -3, 0}, false, 16f, true, false, false, false);
    scenario(u, world, "four block drop zombie", "zombie", zs[0], zs[1], ORIGIN, new double[] {6, -3, 0}, false, 40f, false, false, false, false);
    // The same two block drop with the floor at y 0: the fall loop stops updating the point at y <= 0.
    dy = 0;
    floor();
    box(3, -10, -10, 20, 0, 10, 0);
    box(3, -10, -10, 20, -2, 10, 1);
    scenario(u, world, "two block drop at y 0", "pig", ps[0], ps[1], ORIGIN, new double[] {6, -1, 0}, false, 16f, true, false, false, false);
    dy = 32;

    // A pond (water over the floor, 4 wide) between the pig and the target.
    floor();
    box(2, 0, -6, 5, 0, 6, 9);
    scenario(u, world, "pond avoided pig", "pig", ps[0], ps[1], ORIGIN, new double[] {8, 1, 0}, false, 16f, true, false, false, false);
    scenario(u, world, "pond waded zombie", "zombie", zs[0], zs[1], ORIGIN, new double[] {8, 1, 0}, false, 40f, false, false, false, false);
    // The same pond in the pig's way with no way around it: wide pond, avoidsWater.
    floor();
    box(2, 0, -30, 5, 0, 30, 9);
    scenario(u, world, "long pond avoided", "pig", ps[0], ps[1], ORIGIN, new double[] {8, 1, 0}, false, 16f, true, false, false, false);
    scenario(u, world, "long pond waded", "pig", ps[0], ps[1], ORIGIN, new double[] {8, 1, 0}, false, 16f, false, false, false, false);
    // A swimmer in deep water (2 blocks) swimming to a shore block.
    floor();
    box(-4, -1, -6, 5, 0, 6, 9);
    box(6, -1, -6, 12, 0, 6, 1);
    scenario(u, world, "swimming pig", "pig", ps[0], ps[1], new double[] {0.5, -0.4, 0.5}, new double[] {8, 1, 0}, false, 16f, false, true, true, false);

    // Lava floor strip: avoided (-2) unless the mob is in lava.
    floor();
    box(3, 0, -10, 4, 0, 10, 11);
    scenario(u, world, "lava strip", "pig", ps[0], ps[1], ORIGIN, new double[] {7, 1, 0}, false, 16f, true, false, false, false);
    floor();
    box(3, 0, -30, 4, 0, 30, 11);
    scenario(u, world, "long lava strip", "pig", ps[0], ps[1], ORIGIN, new double[] {7, 1, 0}, false, 16f, true, false, false, false);

    // A tunnel two high, entered through a one block gap: a zombie fits (height 1.8 -> 2),
    // a cow (height 1.3 -> 2) fits, a one-high gap stops them.
    floor();
    box(3, 1, -6, 3, 4, 6, 1);
    box(3, 1, 0, 3, 1, 0, 0);
    scenario(u, world, "one high gap zombie", "zombie", zs[0], zs[1], ORIGIN, new double[] {6, 1, 0}, false, 40f, false, false, false, false);
    scenario(u, world, "one high gap chicken", "chicken", cs[0], cs[1], ORIGIN, new double[] {6, 1, 0}, false, 16f, true, false, false, false);
    floor();
    box(3, 1, -6, 3, 4, 6, 1);
    box(3, 1, 0, 3, 2, 0, 0);
    scenario(u, world, "two high gap zombie", "zombie", zs[0], zs[1], ORIGIN, new double[] {6, 1, 0}, false, 40f, false, false, false, false);

    // A staircase up three blocks, then a drop.
    floor();
    box(2, 1, -3, 12, 1, 3, 1);
    box(4, 2, -3, 12, 2, 3, 1);
    box(6, 3, -3, 12, 3, 3, 1);
    scenario(u, world, "staircase pig", "pig", ps[0], ps[1], ORIGIN, new double[] {9, 4, 0}, false, 16f, true, false, false, false);
    scenario(u, world, "staircase zombie", "zombie", zs[0], zs[1], ORIGIN, new double[] {9, 4, 0}, false, 40f, false, false, false, false);

    // A U-shaped trap: the target is straight behind the wall of the U.
    floor();
    box(2, 1, -3, 2, 2, 3, 1);
    box(2, 1, -3, 6, 2, -3, 1);
    box(2, 1, 3, 6, 2, 3, 1);
    scenario(u, world, "u trap", "pig", ps[0], ps[1], new double[] {4.5, 1.0, 0.5}, new double[] {-2, 1, 0}, false, 16f, true, false, false, false);
  }
}
