import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged EntityPlayerSP (blk) through Entity.moveEntity (sa.d) and
// EntityLivingBase.moveEntityWithHeading (sv.e(FF)) on a constructor-less player and a
// finite stone platform (solid below y = 0 while x < edgeX and z < edgeZ), with the sneak
// key down or up (MovementInput.sneak, bli.d, read by blk.an() = isSneaking). Records the
// single-move displacements of the sneak edge loop and per-tick sneaking walks toward the
// edge. yOffset (sa.L) is 0 here so posY is the feet, as in tools/probes/MobMoveProbe.java.
// Tools/verify-sneak.mjs writes public/research/sneak-reference.json; src/player-movement.test.js
// replays it through src/entities.js.
public class SneakProbe {
  static double edgeX = 64, edgeZ = 64;

  static boolean solid(int x, int y, int z) { return y < 0 && x < edgeX && z < edgeZ; }

  public static class ProbeWorld extends ahb {
    ProbeWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { return solid(x, y, z) ? aji.e(1) : aji.e(0); }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public boolean a(azt box, awt material) { return false; }
    public boolean a(azt box, awt material, sa entity) { return false; }
    public void a(sa entity, String sound, float volume, float pitch) {}
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            if (solid(x, y, z)) out.add(azt.a(x, y, z, x + 1, y + 1, z + 1));
      return out;
    }
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

  // EntityPlayerSP (blk) as an allocated double: world, random, box, DataWatcher, the
  // movement input whose `sneak` flag blk.an() reads, abilities (not flying), no effects.
  static blk spawn(sun.misc.Unsafe u, ProbeWorld w, double x, double z, float yaw, boolean sneak) throws Exception {
    blk e = (blk) u.allocateInstance(blk.class);
    set(e, "o", w);
    set(e, "Z", new Random(1));
    set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(e);
    set(e, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0));
    watcher.a(1, Short.valueOf((short) 300));
    method(yz.class, "c").invoke(e);
    field(sv.class, "f").set(e, new java.util.HashMap());
    set(e, "bE", new yw());
    set(e, "bp", new zr()); // FoodStats: exhaustion from movement stats
    bli input = new bli();
    input.d = sneak;
    set(e, "c", input);
    set(e, "J", true);
    set(e, "W", 0.5f);
    set(e, "aQ", 0.02f);
    set(e, "M", 0.6f);
    set(e, "N", 1.8f);
    method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, 0.0, z);
    set(e, "y", yaw);
    method(yz.class, "aD").invoke(e); // applyEntityAttributes: movement speed 0.1, attack damage
    set(e, "D", true);
    return e;
  }

  static String num(double v) { return Double.toString(v); }

  static String state(blk e) throws Exception {
    return "{\"x\":" + num(d(e, "s")) + ",\"y\":" + num(d(e, "t")) + ",\"z\":" + num(d(e, "u"))
      + ",\"vx\":" + num(d(e, "v")) + ",\"vy\":" + num(d(e, "w")) + ",\"vz\":" + num(d(e, "x"))
      + ",\"onGround\":" + b(e, "D") + ",\"collidedH\":" + b(e, "E") + "}";
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = unsafe();
    ProbeWorld world = (ProbeWorld) u.allocateInstance(ProbeWorld.class);
    set(world, "s", new Random(2));
    set(world, "C", new qi());

    // 1. One Entity.moveEntity call on the ground, the platform edge at x = z = 64.
    // The 0.6-wide box leaves the platform when the centre passes 64.3.
    double[][] starts = { {64.0, 64.0}, {64.25, 63.0}, {62.0, 64.29}, {64.1, 64.1}, {60.0, 60.0}, {64.29, 64.29} };
    double[][] moves = { {0.2, 0.0}, {0.0, 0.2}, {0.3, 0.3}, {0.04, 0.0}, {0.049, 0.03}, {-0.1, 0.1}, {0.0392, 0.0392}, {0.5, 0.5}, {0.0, 0.07}, {0.06, 0.0}, {-0.3, 0.0} };
    for (double[] s : starts)
      for (double[] m : moves)
        for (boolean sneak : new boolean[] {true, false}) {
          edgeX = 64; edgeZ = 64;
          blk e = spawn(unsafe(), world, s[0], s[1], 0f, sneak);
          method(sa.class, "d", double.class, double.class, double.class).invoke(e, m[0], -0.0784, m[1]);
          System.out.println("{\"case\":\"move\",\"sneak\":" + sneak + ",\"start\":[" + num(s[0]) + "," + num(s[1]) + "],\"move\":[" + num(m[0]) + "," + num(m[1]) + "],\"end\":" + state(e) + "}");
        }

    // 2. Walks: moveForward = 1 (sneak: 0.3F), x0.98F, moveEntityWithHeading at the walking
    // speed 0.1F, yaw 0 (+z) and 45 (toward the corner at +x,+z), on and off the edge.
    // Java yaw 0 walks +z; yaw -45 walks toward +x and +z.
    for (boolean sneak : new boolean[] {true, false})
      for (float yaw : new float[] {0f, -45f, -90f})
        for (double[] start : new double[][] { {62.0, 62.0}, {64.2, 62.0} }) {
          edgeX = 64; edgeZ = 64;
          blk e = spawn(unsafe(), world, start[0], start[1], yaw, sneak);
          float forward = sneak ? (float) (1.0f * 0.3) : 1.0f;
          StringBuilder out = new StringBuilder();
          for (int i = 0; i < 40; i++) {
            set(e, "p", d(e, "s"));
            set(e, "q", d(e, "t"));
            set(e, "r", d(e, "u"));
            e.i(0.1f);
            e.e(0f, forward * 0.98f);
            if (i > 0) out.append(",");
            out.append(state(e));
          }
          System.out.println("{\"case\":\"walk\",\"sneak\":" + sneak + ",\"yaw\":" + yaw + ",\"start\":[" + num(start[0]) + "," + num(start[1]) + "],\"forward\":" + forward + ",\"ticks\":[" + out + "]}");
        }
  }
}
