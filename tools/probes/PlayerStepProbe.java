import java.lang.reflect.Field;
import java.lang.reflect.Method;

// Runs the unchanged EntityPlayerSP (blk) through Entity.moveEntity (sa.d) and
// EntityLivingBase.moveEntityWithHeading (sv.e(FF)) against the original collision boxes
// (Block.addCollisionBoxesToList through tools/probes/PlantProbe.java's world double) of
// partial-height blocks: farmland, snow layers, a chest, a ladder and stone (cactus boxes are in PlantProbe; its contact damage needs the full player). The
// player stands on a stone floor (y < 0) at z 64.5 with the obstacle in the cell (64, 0, 65).
// It records the stepHeight (sa.W, 0.5) retry, its `onGround && (sneaking player ||
// ySize < 0.05)` condition after the ySize (sa.V) *= 0.4 decay, and walks into each block.
// yOffset (sa.L) is 0, so posY is the feet. tools/verify-playerstep.mjs writes
// public/research/playerstep-reference.json; src/player-step.test.js replays it.
public class PlayerStepProbe {
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

  // As tools/probes/SneakProbe.java: an allocated EntityPlayerSP with its movement input.
  static blk spawn(sun.misc.Unsafe u, PlantProbe.W w, double x, double z, float yaw, boolean sneak, boolean onGround, float ySize) throws Exception {
    blk e = (blk) u.allocateInstance(blk.class);
    set(e, "o", w);
    set(e, "Z", new java.util.Random(1));
    set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(e);
    set(e, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0));
    watcher.a(1, Short.valueOf((short) 300));
    method(yz.class, "c").invoke(e);
    field(sv.class, "f").set(e, new java.util.HashMap());
    set(e, "bE", new yw());
    set(e, "bp", new zr());
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
    method(yz.class, "aD").invoke(e);
    set(e, "D", onGround);
    set(e, "V", ySize);
    return e;
  }

  static String num(double v) { return Double.toString(v); }

  static String state(blk e) throws Exception {
    return "{\"x\":" + num(d(e, "s")) + ",\"y\":" + num(d(e, "t")) + ",\"z\":" + num(d(e, "u"))
      + ",\"vx\":" + num(d(e, "v")) + ",\"vy\":" + num(d(e, "w")) + ",\"vz\":" + num(d(e, "x"))
      + ",\"onGround\":" + b(e, "D") + ",\"collidedH\":" + b(e, "E") + ",\"ySize\":" + Float.toString(fl(e, "V")) + "}";
  }

  // Obstacles: [label, original block id, metadata].
  static Object[][] OBSTACLES = {
    {"stone", 1, 0}, {"farmland", 60, 0}, {"farmland_wet", 60, 7}, {"chest", 54, 0}, {"ladder", 65, 2},
    {"snow0", 78, 0}, {"snow1", 78, 1}, {"snow2", 78, 2}, {"snow3", 78, 3}, {"snow4", 78, 4}, {"snow5", 78, 5}, {"snow7", 78, 7},
  };

  static PlantProbe.W world(sun.misc.Unsafe u, Object[] o, boolean second) throws Exception {
    PlantProbe.unsafe = u;
    PlantProbe.W w = PlantProbe.world((x, y, z) -> new int[] {y < 0 ? 1 : 0, 0});
    w.put(64, 0, 65, (Integer) o[1], (Integer) o[2]);
    // A one-block stone riser two cells on, for the farmland-then-block walk.
    if (second) w.put(64, 0, 66, 1, 0);
    return w;
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    Method move = method(sa.class, "d", double.class, double.class, double.class);

    // 1. Single moves toward the obstacle cell from z 64.5 (box edge 0.2 short of it).
    double[] dzs = {0.1, 0.25, 0.4, 0.7};
    float[] ySizes = {0f, 0.1f, 0.12f, 0.2f};
    for (Object[] o : OBSTACLES)
      for (double dz : dzs)
        for (float ys : ySizes)
          for (boolean onGround : new boolean[] {true, false})
            for (boolean sneak : new boolean[] {false, true}) {
              if (sneak && !onGround) continue;
              PlantProbe.W w = world(u, o, false);
              blk e = spawn(u, w, 64.5, 64.5, 0f, sneak, onGround, ys);
              move.invoke(e, 0.03, -0.0784, dz);
              System.out.println("{\"case\":\"move\",\"block\":\"" + o[0] + "\",\"id\":" + o[1] + ",\"meta\":" + o[2] + ",\"dz\":" + num(dz)
                + ",\"ySize\":" + Float.toString(ys) + ",\"onGround\":" + onGround + ",\"sneak\":" + sneak + ",\"end\":" + state(e) + "}");
            }

    // 2. Walks (moveForward 1 x0.98, walking speed 0.1) straight into the
    // obstacle, and over farmland into a one-block riser.
    for (Object[] o : OBSTACLES)
      for (float speed : new float[] {0.1f}) // EntityPlayer.getAIMoveSpeed reads the attribute (0.1), not setAIMoveSpeed
        for (boolean second : new boolean[] {false, true}) {
          if (second && !o[0].equals("farmland")) continue;
          PlantProbe.W w = world(u, o, second);
          blk e = spawn(u, w, 64.5, 64.5, 0f, false, true, 0f);
          StringBuilder out = new StringBuilder();
          for (int i = 0; i < 30; i++) {
            set(e, "p", d(e, "s"));
            set(e, "q", d(e, "t"));
            set(e, "r", d(e, "u"));
            e.i(speed);
            e.e(0f, 0.98f);
            if (i > 0) out.append(",");
            out.append(state(e));
          }
          System.out.println("{\"case\":\"walk\",\"block\":\"" + o[0] + "\",\"id\":" + o[1] + ",\"meta\":" + o[2] + ",\"speed\":" + Float.toString(speed)
            + ",\"riser\":" + second + ",\"ticks\":[" + out + "]}");
        }
  }
}
