import java.lang.reflect.Method;

// Batch 44: runs the unchanged 1.7.10 RenderItem's sprite-item path (bny private a(EntityItem, IIcon, int, float, float, float, float), RenderItem.renderDroppedItem for a
// non-block stack) with the real Tessellator, the recording GL11 stand-in and stand-ins for the texture manager and the entity (probes/drop/*.java), for stack sizes around the
// copy-count thresholds, fancy graphics on and off, the hover phase and the player's view yaw. The random is reseeded to 187 per case as RenderItem.doRender does.
// Per case the event list: ["T"], ["R"], ["C"], ["P"], ["O"] and each draw ["D", n, vertices as 8 ints].
public class DroppedSpriteProbe {
  static class Icon implements rf {
    public int a() { return 16; }
    public int b() { return 16; }
    public float c() { return 0f; }
    public float d() { return 1f; }
    public float a(double v) { return (float) v; }
    public float e() { return 0f; }
    public float f() { return 1f; }
    public float b(double v) { return (float) v; }
    public String g() { return "probe"; }
  }

  // Own reflection helpers (LightFloatProbe also declares smaller bao and bbj stand-ins, which this probe must not pick up: it needs the real bbj's fancy-graphics field).
  static java.lang.reflect.Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { java.lang.reflect.Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static Object get(Object o, String name) throws Exception { return field(o.getClass(), name).get(o); }

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    sun.misc.Unsafe unsafe = (sun.misc.Unsafe) uf.get(null);
        bmh t = bmh.a;
    final java.lang.reflect.Field fF = field(bmh.class, "f");
    org.lwjgl.opengl.GL11.onDraw = () -> {
      try {
        int[] raw = (int[]) fF.get(t); int n = (Integer) get(t, "g");
        StringBuilder s = new StringBuilder("[\"D\",").append(n).append(",[");
        for (int i = 0; i < n; i++) {
          int o = i * 8;
          for (int k = 0; k < 8; k++) s.append(i + k > 0 ? "," : "").append(raw[o + k]);
        }
        return s.append("]]").toString();
      } catch (Exception e) { throw new RuntimeException(e); }
    };
    bbj settings = new bbj();
    bnn manager = new bnn();
    bqf textures = (bqf) unsafe.allocateInstance(bqf.class);
    manager.e = textures;
    manager.l = settings;
    bny render = (bny) unsafe.allocateInstance(bny.class);
    set(render, "b", manager);
    Method m = bny.class.getDeclaredMethod("a", xk.class, rf.class, int.class, float.class, float.class, float.class, float.class);
    m.setAccessible(true);
    adb item = (adb) unsafe.allocateInstance(adb.class);
    int[] sizes = {1, 2, 5, 6, 15, 16, 20, 21, 31, 32, 40, 41, 64};
    float partial = 0.5f, viewYaw = 30f;
    manager.j = viewYaw;
    StringBuilder out = new StringBuilder("{\"partial\":0.5,\"viewYaw\":30,\"age\":17,\"hover\":0.3,\"cases\":[");
    int count = 0;
    for (boolean fancy : new boolean[] {true, false}) {
      settings.i = fancy;
      for (int size : sizes) {
        xk e = (xk) unsafe.allocateInstance(xk.class);
        e.a = 17; e.c = 0.3f;
        add stack = (add) unsafe.allocateInstance(add.class);
        stack.b = size;
        set(stack, "e", item);
        e.stack = stack;
        set(render, "j", new java.util.Random(187));
        org.lwjgl.opengl.GL11.events.clear();
        int passed = size > 40 ? 5 : size > 20 ? 4 : size > 5 ? 3 : size > 1 ? 2 : 1; // doRender's count (getMiniBlockCount rule); the fancy path recomputes its own, the flat path loops over this one
        m.invoke(render, e, new Icon(), passed, partial, 1f, 1f, 1f);
        out.append(count++ > 0 ? "," : "").append("{\"fancy\":").append(fancy).append(",\"size\":").append(size).append(",\"events\":[").append(String.join(",", org.lwjgl.opengl.GL11.events)).append("]}");
      }
    }
    System.out.println(out.append("]}"));
  }
}
