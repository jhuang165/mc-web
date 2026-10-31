import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged EntityArrow (zc) of the 1.7.10 client JAR and prints one JSON line
// per scenario, like tools/probes/PathProbe.java:
//  heading   zc.c (setThrowableHeading) on an arrow with a seeded Entity.rand;
//  mob       the (world, shooter, target, velocity, inaccuracy) constructor a skeleton uses
//            (yl.a(sv, F)), shooter and target are constructor-less EntitySkeleton (yl) doubles;
//  player    the (world, shooter, power) constructor ItemBow uses, shooter a constructor-less
//            EntitySkeleton (yl) double whose eye height is 1.62 as in EntityPlayerMP (mw.g);
//  flight    zc.h (onUpdate) for a number of ticks in a hand-built block world (boxes: later
//            boxes win; ids 0 air, 1 stone, 9 water) with no entities: the position, motion,
//            rotation and stuck state after every tick. The hit and damage paths need a living
//            target and a world with chunks, so they are not run here.
// The seeded variants override c (setThrowableHeading) to install the seeded Random first.
public class BowProbe {
  static List<int[]> boxes = new ArrayList<>();
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
    public int e(int x, int y, int z) { return 0; }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public List a(sa entity, azt box) { return new ArrayList(); }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj filter) { return new ArrayList(); }
  }

  // The constructor needs a save handler and chunk provider, so the world is allocated
  // without running it (like tools/probes/PathProbe.java).
  static ProbeWorld world() throws Exception {
    ProbeWorld w = (ProbeWorld) unsafe().allocateInstance(ProbeWorld.class);
    set(w, "t", unsafe().allocateInstance(aqq.class)); // World.provider, read by Entity's constructor
    set(w, "C", new qi()); // World.theProfiler
    set(w, "u", new ArrayList()); // World.worldAccesses, read when a sound is played
    return w;
  }

  // EntityPlayer needs authlib and netty to load, so the player constructor is run on a
  // skeleton double (the shooter only supplies position, angles, box and g()) whose eye
  // height is the 1.62 of EntityPlayerMP (mw.g). The pickup flag (a = 1 only for a yz
  // shooter) is not probed.
  public static class Shooter extends yl {
    Shooter() { super(null); }
    public float g() { return 1.62f; }
  }

  static long seed;
  public static class SeededArrow extends zc {
    SeededArrow(ahb w, sv shooter, sv target, float v, float i) { super(w, shooter, target, v, i); }
    SeededArrow(ahb w, sv shooter, float power) { super(w, shooter, power); }
    public void c(double x, double y, double z, float v, float i) {
      this.Z = new Random(seed);
      super.c(x, y, z, v, i);
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
  static Object get(Object o, String name) throws Exception { return field(o.getClass(), name).get(o); }
  static double d(Object o, String name) throws Exception { return field(o.getClass(), name).getDouble(o); }
  static float fl(Object o, String name) throws Exception { return field(o.getClass(), name).getFloat(o); }
  static int in(Object o, String name) throws Exception { return field(o.getClass(), name).getInt(o); }
  static boolean b(Object o, String name) throws Exception { return field(o.getClass(), name).getBoolean(o); }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  static Method setPos;
  static sv living(sun.misc.Unsafe u, Class<?> cls, ProbeWorld w, double x, double y, double z, float yaw, float pitch, float width, float height) throws Exception {
    sv e = (sv) u.allocateInstance(cls);
    set(e, "o", w);
    set(e, "Z", new Random(1));
    set(e, "C", azt.a(0, 0, 0, 0, 0, 0));
    set(e, "M", width);
    set(e, "N", height);
    setPos.invoke(e, x, y, z);
    set(e, "y", yaw);
    set(e, "z", pitch);
    return e;
  }

  static String arrowJson(zc a) throws Exception {
    return "\"x\":" + num(a.s) + ",\"y\":" + num(a.t) + ",\"z\":" + num(a.u) + ",\"mx\":" + num(a.v) + ",\"my\":" + num(a.w) + ",\"mz\":" + num(a.x)
      + ",\"yaw\":" + num(a.y) + ",\"pitch\":" + num(a.z) + ",\"prevYaw\":" + num(a.A) + ",\"prevPitch\":" + num(a.B);
  }

  static void heading(long sd, double dx, double dy, double dz, float v, float inacc) {
    zc arrow = new zc(null, 0.0, 0.0, 0.0);
    arrow.Z = new Random(sd);
    arrow.c(dx, dy, dz, v, inacc);
    System.out.println("{\"case\":\"heading\",\"seed\":" + sd + ",\"d\":[" + dx + "," + dy + "," + dz + "],\"velocity\":" + num(v) + ",\"inaccuracy\":" + num(inacc)
      + ",\"mx\":" + num(arrow.v) + ",\"my\":" + num(arrow.w) + ",\"mz\":" + num(arrow.x) + ",\"yaw\":" + num(arrow.y) + ",\"pitch\":" + num(arrow.z) + "}");
  }

  static void mob(sun.misc.Unsafe u, long sd, double[] from, double[] to, float tHeight, float velocity, float inacc) throws Exception {
    ProbeWorld w = world();
    sv shooter = living(u, yl.class, w, from[0], from[1], from[2], 0f, 0f, 0.6f, 1.8f);
    sv target = living(u, yl.class, w, to[0], to[1], to[2], 0f, 0f, 0.6f, tHeight);
    seed = sd;
    zc arrow = new SeededArrow(w, shooter, target, velocity, inacc);
    System.out.println("{\"case\":\"mob\",\"seed\":" + sd + ",\"shooter\":[" + num(from[0]) + "," + num(from[1]) + "," + num(from[2]) + ",1.8],\"target\":[" + num(to[0]) + "," + num(to[1]) + "," + num(to[2]) + "," + num(tHeight) + "],\"velocity\":" + num(velocity) + ",\"inaccuracy\":" + num(inacc)
      + "," + arrowJson(arrow) + ",\"pickup\":" + in(arrow, "a") + "}");
  }

  static void player(sun.misc.Unsafe u, long sd, double[] feet, float yaw, float pitch, float power) throws Exception {
    ProbeWorld w = world();
    sv shooter = living(u, Shooter.class, w, feet[0], feet[1], feet[2], yaw, pitch, 0.6f, 1.8f);
    seed = sd;
    zc arrow = new SeededArrow(w, shooter, power);
    System.out.println("{\"case\":\"player\",\"seed\":" + sd + ",\"feet\":[" + num(feet[0]) + "," + num(feet[1]) + "," + num(feet[2]) + "],\"mcYaw\":" + num(yaw) + ",\"mcPitch\":" + num(pitch) + ",\"power\":" + num(power)
      + "," + arrowJson(arrow) + "}");
  }

  static String worldJson() {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < boxes.size(); i++) {
      int[] b = boxes.get(i);
      if (i > 0) s.append(",");
      s.append("[").append(b[0]).append(",").append(b[1]).append(",").append(b[2]).append(",").append(b[3]).append(",").append(b[4]).append(",").append(b[5]).append(",").append(b[6]).append("]");
    }
    return s.append("]").toString();
  }

  static void flight(String name, double[] at, double[] motion, int ticks, boolean inWater) throws Exception {
    ProbeWorld w = world();
    zc arrow = new zc(w, at[0], at[1], at[2]);
    arrow.v = motion[0];
    arrow.w = motion[1];
    arrow.x = motion[2];
    if (inWater) set(arrow, "ac", true);
    StringBuilder s = new StringBuilder();
    for (int t = 1; t <= ticks; t++) {
      arrow.h();
      if (t > 6 && !(t >= 1198)) continue; // long runs keep the first ticks and the tail
      if (t > 1) s.append(",");
      s.append("{\"tick\":").append(t).append(",").append(arrowJson(arrow)).append(",\"inGround\":").append(b(arrow, "i")).append(",\"shake\":").append(in(arrow, "b"))
        .append(",\"ticksInGround\":").append(in(arrow, "at")).append(",\"ticksInAir\":").append(in(arrow, "au")).append(",\"dead\":").append(arrow.K)
        .append(",\"tile\":[").append(in(arrow, "d")).append(",").append(in(arrow, "e")).append(",").append(in(arrow, "f")).append("],\"block\":").append(aji.b((aji) get(arrow, "g"))).append("}");
    }
    System.out.println("{\"case\":\"flight\",\"name\":\"" + name + "\",\"from\":[" + num(at[0]) + "," + num(at[1]) + "," + num(at[2]) + "],\"motion\":[" + num(motion[0]) + "," + num(motion[1]) + "," + num(motion[2]) + "],\"inWater\":" + inWater
      + ",\"world\":" + worldJson() + ",\"ticks\":[" + s + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = unsafe();
    Method m = null;
    for (Class<?> c = sa.class; c != null && m == null; c = c.getSuperclass())
      try { m = c.getDeclaredMethod("b", double.class, double.class, double.class); } catch (NoSuchMethodException e) {}
    m.setAccessible(true);
    setPos = m;

    long[] seeds = {1, 7, 42, 123456789L};
    double[][] dirs = {{1, 0, 0}, {0, 0, 1}, {0.3, 0.2, -0.9}, {-5, 2, 3}, {0, -1, 0.1}, {2, 2, 2}};
    float[][] vi = {{3.0f, 1.0f}, {1.6f, 6.0f}, {1.6f, 10.0f}, {1.5f, 1.0f}, {2.0f, 0.0f}};
    for (long sd : seeds)
      for (double[] dir : dirs)
        for (float[] p : vi) heading(sd, dir[0], dir[1], dir[2], p[0], p[1]);

    double[][][] pairs = {
      {{64.5, 10, 64.5}, {70.5, 10, 64.5}}, {{64.5, 10, 64.5}, {64.5, 10, 49.5}}, {{64.5, 10, 64.5}, {60.0, 13, 70.0}},
      {{0.5, 40, 0.5}, {-9.25, 37.5, 4.75}}, {{100.5, 20, -30.5}, {95.5, 20, -20.5}}};
    for (long sd : seeds)
      for (double[][] pair : pairs) {
        mob(u, sd, pair[0], pair[1], 1.8f, 1.6f, 6.0f);
        mob(u, sd, pair[0], pair[1], 1.62f, 1.6f, 14.0f);
      }
    // A target straight above or below returns before the heading is set (d3 < 1e-7).
    mob(u, 1, new double[] {5.5, 10, 5.5}, new double[] {5.5, 15, 5.5}, 1.8f, 1.6f, 6.0f);

    double[][] feets = {{64.5, 10, 64.5}, {0.5, 70, 0.5}, {-12.3, 4.0, 99.7}};
    float[][] looks = {{0f, 0f}, {90f, 0f}, {-90f, 30f}, {180f, -45f}, {37.5f, 12.25f}, {-123.4f, 77f}};
    float[] powers = {0.2f, 1.0f, 2.0f, 3.0f};
    for (long sd : new long[] {1, 7})
      for (double[] f : feets)
        for (float[] l : looks)
          for (float pw : powers) player(u, sd, f, l[0], l[1], pw);

    boxes.clear();
    flight("air", new double[] {0.5, 60, 0.5}, new double[] {1.2, 0.5, -0.4}, 40, false);
    flight("air-fast", new double[] {0.5, 60, 0.5}, new double[] {3.0, 0.0, 0.0}, 30, false);
    flight("air-lob", new double[] {0.5, 60, 0.5}, new double[] {0.0, 2.0, 0.6}, 60, false);
    boxes.add(new int[] {-100, 40, -100, 100, 80, 100, 9});
    flight("water", new double[] {0.5, 60, 0.5}, new double[] {2.0, 0.4, 0.0}, 25, true);
    boxes.clear();
    boxes.add(new int[] {6, 40, -20, 7, 80, 20, 1});
    flight("wall-x", new double[] {0.5, 60, 0.5}, new double[] {3.0, 0.1, 0.0}, 14, false);
    flight("wall-slow", new double[] {4.5, 60, 0.5}, new double[] {0.6, 0.0, 0.0}, 14, false);
    boxes.clear();
    boxes.add(new int[] {-20, 40, -20, 20, 59, 20, 1});
    flight("floor", new double[] {0.5, 64, 0.5}, new double[] {0.4, -1.5, 0.3}, 14, false);
    boxes.clear();
    boxes.add(new int[] {-20, 40, -20, 20, 59, 20, 1});
    flight("despawn", new double[] {0.5, 64, 0.5}, new double[] {0.0, -1.5, 0.0}, 1215, false);
  }
}
