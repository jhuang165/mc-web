package org.lwjgl.opengl;
import java.util.*;
// Recording stand-in for the GL11 calls FontRenderer (bbu) makes; the unchanged class runs against it (see FontStyleProbe).
// The recorder state lives here because a default-package class cannot be referenced from a named package.
public class GL11 {
  public static String tex = "";
  public static float[] color = new float[4];
  public static List<String> prims = new ArrayList<>();
  public static List<float[]> verts = new ArrayList<>();
  public static float tu, tv;
  static String q(String s) { return "\"" + s + "\""; }
  static String f(float v) { return Float.toString(v); }
  public static void flush(String kind) {
    StringBuilder b = new StringBuilder("{\"k\":\"" + kind + "\",\"tex\":" + (kind.equals("g") ? q(tex) : "null") + ",\"c\":[" + f(color[0]) + "," + f(color[1]) + "," + f(color[2]) + "," + f(color[3]) + "],\"v\":[");
    for (int i = 0; i < verts.size(); i++) {
      float[] v = verts.get(i);
      if (i > 0) b.append(',');
      b.append("[").append(f(v[0])).append(',').append(f(v[1])).append(kind.equals("g") ? "," + f(v[2]) + "," + f(v[3]) : "").append("]");
    }
    prims.add(b.append("]}").toString());
    verts.clear();
  }
  public static void glEnable(int c) {}
  public static void glDisable(int c) {}
  public static void glColor4f(float r, float g, float b, float a) { color = new float[] {r, g, b, a}; }
  public static void glBegin(int mode) { verts.clear(); }
  public static void glTexCoord2f(float u, float v) { tu = u; tv = v; }
  public static void glVertex3f(float x, float y, float z) { verts.add(new float[] {x, y, tu, tv}); }
  public static void glEnd() { flush("g"); }
}
