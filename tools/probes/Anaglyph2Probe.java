// Evaluates the RenderBlocks / RenderGlobal anaglyph colour expressions (bytecode-read from blm.q @56, bma.a @566) in Java float
// arithmetic for fixed colour multipliers. The expression is replicated (the classes need a live Minecraft instance), so the
// numbers pin Java's float semantics, not the unchanged classes. Prints JSON.
public class Anaglyph2Probe {
  static float[] conv(float r, float g, float b) { return new float[]{(r * 30.0f + g * 59.0f + b * 11.0f) / 100.0f, (r * 30.0f + g * 70.0f) / 100.0f, (r * 30.0f + b * 70.0f) / 100.0f}; }
  public static void main(String[] a) {
    int[] cols = {0xFFFFFF, 0x7CBD6B, 0x48B518, 0x619961, 0x80A755, 0x3F76E4, 0xFF0000, 0x00FF00, 0x0000FF, 0xE0C040, 0x1F6B2B};
    StringBuilder sb = new StringBuilder("{\"multipliers\":[");
    for (int i = 0; i < cols.length; i++) {
      int c = cols[i]; float r = (c >> 16 & 255) / 255.0f, g = (c >> 8 & 255) / 255.0f, b = (c & 255) / 255.0f; float[] o = conv(r, g, b);
      sb.append(i > 0 ? "," : "").append(String.format("{\"rgb\":%d,\"out\":[%s,%s,%s]}", c, Float.toString(o[0]), Float.toString(o[1]), Float.toString(o[2])));
    }
    float[][] sun = {{1.0f, 0.5f, 0.2f, 0.8f}, {0.7f, 0.25f, 0.1f, 0.3f}, {0.9f, 0.9f, 0.1f, 0.05f}};
    sb.append("],\"sunrise\":[");
    for (int i = 0; i < sun.length; i++) {
      float[] o = conv(sun[i][0], sun[i][1], sun[i][2]);
      sb.append(i > 0 ? "," : "").append(String.format("{\"in\":[%s,%s,%s,%s],\"centre\":[%s,%s,%s],\"rim\":[%s,%s,%s]}", sun[i][0], sun[i][1], sun[i][2], sun[i][3], o[0], o[1], o[2], sun[i][0], sun[i][1], sun[i][2]));
    }
    System.out.println(sb.append("]}"));
  }
}
