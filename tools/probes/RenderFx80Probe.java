import java.lang.reflect.Field;
import java.util.*;

// Batch 80 renderfx80: runs unchanged 1.7.10 render code headlessly against the stub org.lwjgl.opengl.GL11 / org.lwjgl.Sys in
// tools/probes/renderfx80-stubs (float matrix stacks, texgen and draw logging; the real Tessellator bmh fills its raw buffer as in the game).
//   portal    TileEntityEndPortalRenderer (bmt) .a(apo, x, y, z, partial): every GL call, texgen plane (with the modelview it was given under),
//             texture binding, and per layer the texture matrix, modelview, colour and vertices the Tessellator drew.
//   stemBig   RenderBlocks.func_147740_a (blm.a(anu, meta, dir, height, x, y, z)): the connected stem plane, raw vertices.
//   stemSmall RenderBlocks.func_147795_a (blm.a(aji, meta, height, x, y, z)): the crossed small stem, raw vertices.
//   skull     RenderWitherSkull (bpd) .a(zp, x, y, z, yaw, partial) with ModelSkeletonHead (bib): the texture bound, the display list's
//             vertices (compiled through the real ModelBox/TexturedQuad into the Tessellator) and the modelview at glCallList.
// One JSON object per line.
public class RenderFx80Probe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String n) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; }
  static void set(Class<?> c, Object o, String n, Object v) throws Exception { field(c, n).set(o, v); }
  static Object get(Class<?> c, Object o, String n) throws Exception { return field(c, n).get(o); }

  static final List<String> names = new ArrayList<>();
  public static class Icon implements rf {
    final String name; final int idx;
    Icon(String n) { name = n; idx = names.size(); names.add(n); }
    public int a() { return 16; }
    public int b() { return 16; }
    public float c() { return 2f * idx; }
    public float d() { return 2f * idx + 1f; }
    public float a(double d) { return 2f * idx + (float) d / 16f; }
    public float e() { return 0f; }
    public float f() { return 1f; }
    public float b(double d) { return (float) d / 16f; }
    public String g() { return name; }
  }
  // TextureManager stand-in: logs bindTexture.
  public static class TM extends bqf {
    TM() { super(null); }
    public void a(bqx r) { org.lwjgl.opengl.GL11.LOG.add("[\"bind\",\"" + r.a() + "\",\"" + r.b() + "\"]"); }
  }

  // The Tessellator's raw vertices since startDrawing: x, y, z, u, v as floats, the colour int and the normal int (8 ints per vertex).
  static String verts(bmh t) throws Exception {
    int[] raw = (int[]) get(bmh.class, t, "f");
    int n = (Integer) get(bmh.class, t, "g");
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < n; i++) {
      int o = i * 8;
      s.append(i > 0 ? "," : "").append("[").append(Float.intBitsToFloat(raw[o])).append(",").append(Float.intBitsToFloat(raw[o + 1])).append(",").append(Float.intBitsToFloat(raw[o + 2]))
        .append(",").append(Float.intBitsToFloat(raw[o + 3])).append(",").append(Float.intBitsToFloat(raw[o + 4])).append(",").append(raw[o + 5]).append(",").append(raw[o + 6]).append("]");
    }
    return s.append("]").toString();
  }
  static String log() { return "[" + String.join(",", org.lwjgl.opengl.GL11.LOG) + "]"; }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    rg register = name -> new Icon(String.valueOf(name));
    aji.e(104).a(register);
    aji.e(105).a(register);
    bmh t = bmh.a;
    java.lang.reflect.Method reset = bmh.class.getDeclaredMethod("d");
    reset.setAccessible(true);
    blm rb = (blm) unsafe.allocateInstance(blm.class);

    // Stems: both kinds, the four directions, a few heights and positions (y already 1/16 low, as renderBlockStem passes it: (float) y - 0.0625f).
    int[][] cells = {{8, 8, 8}, {-3, 64, -17}, {12345, 200, -6789}, {-30000, 1, 29999}};
    double[] heights = {1.0, 0.875, 0.5, 0.125};
    for (int id : new int[] {104, 105}) {
      anu stem = (anu) aji.e(id);
      for (int[] c : cells) for (double h : heights) {
        double y = (double) ((float) c[1] - 0.0625F);
        for (int dir = 0; dir < 4; dir++) {
          field(bmh.class, "x").setBoolean(t, false);
          t.b();
          rb.a(stem, 7, dir, h, (double) c[0], y, (double) c[2]);
          System.out.println("{\"case\":\"stemBig\",\"id\":" + id + ",\"dir\":" + dir + ",\"h\":" + h + ",\"x\":" + c[0] + ",\"y\":" + y + ",\"z\":" + c[2] + ",\"verts\":" + verts(t) + "}");
          reset.invoke(t);
        }
        field(bmh.class, "x").setBoolean(t, false);
        t.b();
        rb.a((aji) stem, 7, h, (double) c[0], y, (double) c[2]);
        System.out.println("{\"case\":\"stemSmall\",\"id\":" + id + ",\"h\":" + h + ",\"x\":" + c[0] + ",\"y\":" + y + ",\"z\":" + c[2] + ",\"verts\":" + verts(t) + "}");
        reset.invoke(t);
      }
    }

    // End portal: camera entity position (dispatcher j, k, l), the tile's camera-relative position, ActiveRenderInfo.objectX/Y/Z (baj a, b, c),
    // the system clock (ms) and a view rotation (pitch about x, then yaw about y) as the modelview the renderer starts from.
    TM tm = (TM) unsafe.allocateInstance(TM.class);
    bmk disp = (bmk) unsafe.allocateInstance(bmk.class);
    disp.e = tm;
    bmt portal = new bmt();
    set(bml.class, portal, "a", disp);
    apo te = new apo();
    double[][] fixtures = {
      {0.5, 70.62, 0.5, -1, -3, -1, 0, 0, 0, 1234567, 0, 90},
      {100.25, 40.62, -200.75, -2, -2.5, 3, 0.01, -0.02, 0.03, 987654321, 37, 55},
      {-1234.5, 12.3, 5678.9, 4, -1, -5, -0.04, 0.0, 0.02, 699999, -120, 20},
      {3.5, 50.0, 3.5, 0, -40, 0, 0, 0.05, 0, 0, 200, 89},
      {10.1, 33.2, -9.8, -3, -0.5, 2, 0.02, 0.03, -0.01, 314159, 15, 5},
    };
    for (double[] f : fixtures) {
      org.lwjgl.opengl.GL11.reset();
      org.lwjgl.opengl.GL11.glRotatef((float) f[11], 1, 0, 0);
      org.lwjgl.opengl.GL11.glRotatef((float) f[10], 0, 1, 0);
      org.lwjgl.opengl.GL11.LOG.clear();
      disp.j = f[0]; disp.k = f[1]; disp.l = f[2];
      baj.a = (float) f[6]; baj.b = (float) f[7]; baj.c = (float) f[8];
      org.lwjgl.Sys.time = (long) f[9];
      org.lwjgl.opengl.GL11.onDraw = () -> {
        try { org.lwjgl.opengl.GL11.LOG.add("[\"draw\"," + org.lwjgl.opengl.GL11.mat(org.lwjgl.opengl.GL11.tex) + "," + org.lwjgl.opengl.GL11.mat(org.lwjgl.opengl.GL11.mv) + "," + verts(bmh.a) + "]"); }
        catch (Exception e) { throw new RuntimeException(e); }
      };
      field(bmh.class, "x").setBoolean(t, false);
      portal.a(te, f[3], f[4], f[5], 0.5F);
      StringBuilder s = new StringBuilder("{\"case\":\"portal\",\"cam\":[" + f[0] + "," + f[1] + "," + f[2] + "],\"rel\":[" + f[3] + "," + f[4] + "," + f[5] + "],\"object\":[" + (float) f[6] + "," + (float) f[7] + "," + (float) f[8] + "],\"time\":" + (long) f[9] + ",\"yaw\":" + f[10] + ",\"pitch\":" + f[11] + ",\"log\":" + log() + "}");
      System.out.println(s);
    }

    // RenderWitherSkull: prev/current yaw (A, y) and pitch (B, z) on the skull, the partial tick, the charged (blue) flag.
    org.lwjgl.opengl.GL11.reset();
    bnn rm = (bnn) unsafe.allocateInstance(bnn.class);
    rm.e = tm;
    bpd skullRender = new bpd();
    set(bno.class, skullRender, "b", rm);
    Map<Integer, String> lists = new LinkedHashMap<>();
    org.lwjgl.opengl.GL11.onDraw = () -> {
      try { int l = org.lwjgl.opengl.GL11.list; if (l != 0) lists.merge(l, verts(bmh.a), (a, b) -> a.substring(0, a.length() - 1) + "," + b.substring(1)); }
      catch (Exception e) { throw new RuntimeException(e); }
    };
    float[][] turns = {{10, 30, -5, 15, 0.5f, 0}, {170, -170, 0, 0, 0.25f, 1}, {-90, 45, 80, -80, 1, 0}, {0, 0, 0, 0, 0, 1}, {359, 1, 10, 20, 0.75f, 0}, {-170, 170, 45, 45, 0.5f, 1}};
    for (float[] tr : turns) {
      zp skull = new zp((ahb) null);
      set(sa.class, skull, "A", tr[0]); set(sa.class, skull, "y", tr[1]);
      set(sa.class, skull, "B", tr[2]); set(sa.class, skull, "z", tr[3]);
      skull.a(tr[5] != 0);
      org.lwjgl.opengl.GL11.reset();
      field(bmh.class, "x").setBoolean(t, false);
      skullRender.a((sa) skull, 1.5, -2.25, 3.75, tr[1], tr[4]);
      System.out.println("{\"case\":\"skull\",\"prevYaw\":" + tr[0] + ",\"yaw\":" + tr[1] + ",\"prevPitch\":" + tr[2] + ",\"pitch\":" + tr[3] + ",\"partial\":" + tr[4] + ",\"blue\":" + (tr[5] != 0) + ",\"pos\":[1.5,-2.25,3.75],\"log\":" + log() + "}");
    }
    StringBuilder ls = new StringBuilder("{\"case\":\"skullLists\",\"lists\":{");
    int k = 0;
    for (Map.Entry<Integer, String> e : lists.entrySet()) ls.append(k++ > 0 ? "," : "").append("\"").append(e.getKey()).append("\":").append(e.getValue());
    System.out.println(ls.append("}}"));
    System.out.println("{\"case\":\"icons\",\"names\":[\"" + String.join("\",\"", names) + "\"]}");
  }
}
