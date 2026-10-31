import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Replays EntityLivingBase.moveEntityWithHeading (sv.e(FF)), Entity.moveEntity
// (sa.d), EntityLivingBase.jump (sv.bj) and knockBack (sv.a(sa, F, DD)) on the
// unchanged EntityPig (wo), EntityCow (wh) and EntityZombie (yq) classes. The
// entities and the world are constructor-less doubles (a flat stone floor at
// y < 0, optional one-block step), allocated like tools/probes/InventoryProbe.java.
// Each tick mirrors onLivingUpdate (sv.e()): EntityMoveHelper (tv.c) calls
// setAIMoveSpeed (sw.i), then moveForward and moveStrafing are scaled by 0.98
// before moveEntityWithHeading. Output is one JSON object per scenario with the
// per-tick position, motion, onGround, limbSwingAmount and limbSwing.
public class MobMoveProbe {
  static int step = 0; // height of the optional wall at z >= 2, in blocks

  public static class ProbeWorld extends ahb {
    ProbeWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { return y < 0 || (step > 0 && z >= 2 && y < step) ? aji.e(1) : aji.e(0); }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; } // checkChunksExist
    public boolean a(azt box, awt material) { return false; }
    public boolean a(azt box, awt material, sa entity) { return false; } // handleMaterialAcceleration: no water
    public void a(sa entity, String sound, float volume, float pitch) {}
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            if (y < 0 || (step > 0 && z >= 2 && y < step)) out.add(azt.a(x, y, z, x + 1, y + 1, z + 1));
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

  // sv.e(FF) reads the world and its profiler-free paths only; sv.aD (attributes)
  // is run so knockBack can read the knockbackResistance attribute.
  static sv spawn(sun.misc.Unsafe u, ProbeWorld w, String type, double x, double y, double z, float yaw) throws Exception {
    Class<?> c = type.equals("pig") ? wo.class : type.equals("cow") ? wh.class : yq.class;
    sv e = (sv) u.allocateInstance(c);
    set(e, "o", w);
    set(e, "Z", new Random(1));
    set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(e); // DataWatcher: the Entity constructor adds flags (0) and air (1), then entityInit (c)
    set(e, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0));
    watcher.a(1, Short.valueOf((short) 300));
    method(c, "c").invoke(e);
    field(sv.class, "f").set(e, new java.util.HashMap()); // active potion effects (none)
    set(e, "J", true);
    set(e, "W", 0.5f);
    set(e, "aQ", 0.02f);
    set(e, "M", type.equals("zombie") ? 0.6f : 0.9f); // width
    set(e, "N", type.equals("pig") ? 0.9f : type.equals("cow") ? 1.3f : 1.8f); // height
    method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    set(e, "y", yaw);
    method(c, "aD").invoke(e);
    return e;
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  static String state(sv e) throws Exception {
    return "{\"x\":" + num(d(e, "s")) + ",\"y\":" + num(d(e, "t")) + ",\"z\":" + num(d(e, "u"))
      + ",\"vx\":" + num(d(e, "v")) + ",\"vy\":" + num(d(e, "w")) + ",\"vz\":" + num(d(e, "x"))
      + ",\"onGround\":" + b(e, "D") + ",\"collidedH\":" + b(e, "E")
      + ",\"limbSwingAmount\":" + num(fl(e, "aF")) + ",\"limbSwing\":" + num(fl(e, "aG")) + "}";
  }

  // One onLivingUpdate tick of motion: lastTickPos/prevPos, optional jump,
  // setAIMoveSpeed(speed), x0.98 on moveForward/moveStrafing, moveEntityWithHeading.
  static void tick(sv e, float speed, boolean jump) throws Exception {
    set(e, "p", d(e, "s")); // prevPosX
    set(e, "q", d(e, "t"));
    set(e, "r", d(e, "u"));
    if (jump && b(e, "D")) method(sv.class, "bj").invoke(e);
    e.i(speed);
    float forward = fl(e, "be") * 0.98f, strafe = 0f;
    e.e(strafe, forward);
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = unsafe();
    ProbeWorld world = (ProbeWorld) u.allocateInstance(ProbeWorld.class);
    set(world, "s", new Random(2));
    set(world, "C", new qi());
    // type, attribute * multiplier as the move helper computes it, ticks
    Object[][] walks = {
      {"pig", 1.0, 60}, {"pig", 1.25, 60}, {"pig", 1.2, 60},
      {"cow", 1.0, 60}, {"cow", 2.0, 60}, {"cow", 1.25, 60},
      {"zombie", 1.0, 60}, {"zombie", 1.5, 60},
    };
    for (Object[] w : walks) {
      step = 0;
      sv e = spawn(u, world, (String) w[0], 64.0, 0.0, 64.0, 0f);
      float speed = (float) ((Double) w[1] * ((ti) e.a(yj.d)).e());
      StringBuilder out = new StringBuilder();
      for (int i = 0; i < (Integer) w[2]; i++) {
        tick(e, speed, false);
        if (i > 0) out.append(",");
        out.append(state(e));
      }
      System.out.println("{\"case\":\"walk\",\"type\":\"" + w[0] + "\",\"multiplier\":" + w[1] + ",\"speed\":" + num(speed) + ",\"yaw\":0,\"ticks\":[" + out + "]}");
    }
    // Rotated walk: yaw 90 sends +z walkers toward -x (Java: x -= sin(yaw)).
    {
      step = 0;
      sv e = spawn(u, world, "pig", 64.0, 0.0, 64.0, 135f);
      float speed = (float) (1.0 * ((ti) e.a(yj.d)).e());
      StringBuilder out = new StringBuilder();
      for (int i = 0; i < 20; i++) { tick(e, speed, false); if (i > 0) out.append(","); out.append(state(e)); }
      System.out.println("{\"case\":\"walk\",\"type\":\"pig\",\"multiplier\":1.0,\"speed\":" + num(speed) + ",\"yaw\":135,\"ticks\":[" + out + "]}");
    }
    // Hop a one-block step at z = 2: jump whenever blocked on the ground.
    for (String type : new String[] {"pig", "zombie"}) {
      step = 1;
      sv e = spawn(u, world, type, 64.0, 0.0, 0.5, 0f);
      float speed = (float) (1.0 * ((ti) e.a(yj.d)).e());
      StringBuilder out = new StringBuilder();
      for (int i = 0; i < 50; i++) {
        tick(e, speed, b(e, "E") && b(e, "D"));
        if (i > 0) out.append(",");
        out.append(state(e));
      }
      System.out.println("{\"case\":\"hop\",\"type\":\"" + type + "\",\"multiplier\":1.0,\"speed\":" + num(speed) + ",\"yaw\":0,\"ticks\":[" + out + "]}");
    }
    // Half a block (stepHeight 0.5) needs no jump: a 0.5-high slab is not in this
    // build, so the walk toward a wall only checks that the mob stops against it.
    {
      step = 2;
      sv e = spawn(u, world, "cow", 64.0, 0.0, 0.5, 0f);
      float speed = (float) (1.0 * ((ti) e.a(yj.d)).e());
      StringBuilder out = new StringBuilder();
      for (int i = 0; i < 30; i++) { tick(e, speed, false); if (i > 0) out.append(","); out.append(state(e)); }
      System.out.println("{\"case\":\"wall\",\"type\":\"cow\",\"multiplier\":1.0,\"speed\":" + num(speed) + ",\"yaw\":0,\"ticks\":[" + out + "]}");
    }
    // Knockback from an attacker at (ax, az) onto a mob walking at speed, then
    // 30 ticks of friction/gravity with no AI input.
    double[][] hits = { {64.0, 62.0}, {66.0, 64.0}, {63.0, 66.0} };
    for (String type : new String[] {"pig", "zombie"}) {
      for (double[] hit : hits) {
        step = 0;
        sv e = spawn(u, world, type, 64.0, 0.0, 64.0, 0f);
        float speed = (float) (1.0 * ((ti) e.a(yj.d)).e());
        for (int i = 0; i < 10; i++) tick(e, speed, false);
        double x0 = d(e, "s"), z0 = d(e, "u");
        StringBuilder out = new StringBuilder();
        e.a((sa) null, 5.0f, hit[0] - x0, hit[1] - z0);
        out.append(state(e));
        for (int i = 0; i < 30; i++) { tick(e, 0f, false); out.append(",").append(state(e)); }
        System.out.println("{\"case\":\"knockback\",\"type\":\"" + type + "\",\"attacker\":[" + hit[0] + "," + hit[1] + "],\"start\":[" + num(x0) + "," + num(z0) + "],\"ticks\":[" + out + "]}");
      }
    }
  }
}
