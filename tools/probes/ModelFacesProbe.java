import java.lang.reflect.*;
import java.util.*;
// Builds single boxes with the unchanged 1.7.10 ModelRenderer.addBox/ModelBox (no OpenGL: the quads are built in the
// constructor) and prints every quad's four vertices (model pixels, y down) and texture coordinates in texels, in the
// order ModelBox/TexturedQuad stored them, for mirrored and unmirrored boxes on a non-square texture. The port's
// skinBox and the hand-written box helpers are compared against this per face. No game classes are patched.
public class ModelFacesProbe {
  static class M extends bhr { M(int tw, int th) { t = tw; u = th; } }
  static String num(double f) { return Double.toString(f); }
  static String box(String name, int tw, int th, int u, int v, float x, float y, float z, int w, int h, int d, float grow, boolean mirror) throws Exception {
    bhr model = new M(tw, th);
    bix r = new bix(model, u, v);
    r.i = mirror;
    r.a(x, y, z, w, h, d, grow);
    bis b = (bis) r.l.get(0);
    Field quads = bis.class.getDeclaredField("i");
    quads.setAccessible(true);
    StringBuilder s = new StringBuilder("{\"name\":\"" + name + "\",\"texture\":[" + tw + "," + th + "],\"uv\":[" + u + "," + v + "],\"from\":[" + x + "," + y + "," + z + "],\"size\":[" + w + "," + h + "," + d + "],\"grow\":" + grow + ",\"mirror\":" + mirror + ",\"quads\":[");
    bhv[] q = (bhv[]) quads.get(b);
    for (int i = 0; i < q.length; i++) {
      if (i > 0) s.append(',');
      s.append('[');
      for (int k = 0; k < q[i].a.length; k++) {
        bii p = q[i].a[k];
        if (k > 0) s.append(',');
        s.append("[" + num(p.a.a) + "," + num(p.a.b) + "," + num(p.a.c) + "," + num(Math.round(p.b * tw * 1000.0) / 1000.0) + "," + num(Math.round(p.c * th * 1000.0) / 1000.0) + "]");
      }
      s.append(']');
    }
    return s.append("]}").toString();
  }
  public static void main(String[] args) throws Exception {
    // Dimensions all differ so no face can match another by accident; offsets exercise negative origins.
    System.out.println(box("plain", 64, 64, 10, 20, -1, -2, -3, 3, 5, 7, 0f, false));
    System.out.println(box("mirror", 64, 64, 10, 20, -1, -2, -3, 3, 5, 7, 0f, true));
    System.out.println(box("grown", 64, 32, 6, 4, 0, 0, 0, 8, 4, 2, 0.5f, false));
    System.out.println(box("wide", 256, 256, 112, 88, -4, 3, -9, 16, 6, 20, 0f, true));
    // Batch 63: the player's right arm (ModelBiped bipedRightArm.addBox(-3, -2, -2, 4, 12, 4) at uv 40, 16 on steve.png), drawn by the first-person arm.
    System.out.println(box("playerArm", 64, 32, 40, 16, -3, -2, -2, 4, 12, 4, 0f, false));
  }
}
