// Batch 44: runs the unchanged 1.7.10 ItemRenderer.renderItemIn2D (bly.a(Tessellator, f1, f2, f3, f4, width, height, thickness), a static method) with the real Tessellator
// (bmh) and the recording GL11 stand-in (probes/gl/GL11.java), for several uv rectangles and icon sizes. Output per case: the args and the draws, each vertex as 8 ints
// (x, y, z, u, v as float bits, colour, normal, brightness). ItemRenderer.renderItem (hand) and RenderItem.renderDroppedItem call this with thickness 0.0625.
public class ItemSpriteProbe {
  static java.lang.reflect.Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { java.lang.reflect.Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static Object get(Object o, String name) throws Exception { return field(o.getClass(), name).get(o); }

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
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
    // f1, f2, f3, f4 as ItemRenderer.renderItem passes them: maxU, minV, minU, maxV of the icon; the unit case and an atlas-like icon at (32, 48) of a 256 px sheet
    float[][] cases = {
      {1f, 0f, 0f, 1f, 16, 16, 0.0625f},
      {64f / 256f, 48f / 256f, 48f / 256f, 64f / 256f, 16, 16, 0.0625f},
      {0.75f, 0.25f, 0.25f, 0.5f, 32, 32, 0.0625f},
      {1f, 0f, 0f, 1f, 16, 32, 0.0625f},
    };
    StringBuilder out = new StringBuilder("{\"cases\":[");
    int count = 0;
    for (float[] c : cases) {
      org.lwjgl.opengl.GL11.events.clear();
      bly.a(t, c[0], c[1], c[2], c[3], (int) c[4], (int) c[5], c[6]);
      out.append(count++ > 0 ? "," : "").append("{\"args\":[").append(c[0]).append(",").append(c[1]).append(",").append(c[2]).append(",").append(c[3]).append(",")
        .append((int) c[4]).append(",").append((int) c[5]).append(",").append(c[6]).append("],\"events\":[").append(String.join(",", org.lwjgl.opengl.GL11.events)).append("]}");
    }
    System.out.println(out.append("]}"));
  }
}
