import java.util.*;

// Independent float32 model of RenderItem.renderItemIntoGUI's cube for a render type 0 block and the GL pixel-centre rasterisation of its three visible
// faces. Not the game's code: the GL11 matrix calls are bytecode-read (bny.a(bty, bqf, add, int, int) and blm.a(aji, int, float)); GL's own maths is
// composed here with float matrices (Mesa style rotate). Output: JSON lines {scale, drop, face, count, hash}, where the hash is FNV-1a over the
// covered pixels' (x, y, texel u, texel v) in row-major order.
public class IconEdgeProbe {
  static float[] I() { return new float[]{1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1}; }
  static float[] mul(float[] a, float[] b) {
    float[] o = new float[16];
    for (int c = 0; c < 4; c++) for (int r = 0; r < 4; r++) { float s = 0; for (int k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; }
    return o;
  }
  static float[] tr(float[] m, float x, float y, float z) { return mul(m, new float[]{1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1}); }
  static float[] sc(float[] m, float x, float y, float z) { return mul(m, new float[]{x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1}); }
  static float[] rot(float[] m, float deg, float x, float y, float z) {
    float len = (float) Math.sqrt(x*x + y*y + z*z); x /= len; y /= len; z /= len;
    double ang = deg * Math.PI / 180.0; float s = (float) Math.sin(ang), c = (float) Math.cos(ang), t = 1 - c;
    return mul(m, new float[]{ t*x*x + c, t*x*y + s*z, t*x*z - s*y, 0,  t*x*y - s*z, t*y*y + c, t*y*z + s*x, 0,  t*x*z + s*y, t*y*z - s*x, t*z*z + c, 0,  0,0,0,1 });
  }
  static float[] M;
  static double[] P(double x, double y, double z) {
    float fx = (float) x, fy = (float) y, fz = (float) z;
    return new double[]{ M[0]*fx + M[4]*fy + M[8]*fz + M[12], M[1]*fx + M[5]*fy + M[9]*fz + M[13] };
  }
  // face(u, v) -> block coordinates; (u, v) in tile pixels
  interface Face { double[] at(double u, double v, double drop); }
  public static void main(String[] a) {
    M = I();
    M = tr(M, -2, 3, -3); M = sc(M, 10, 10, 10); M = tr(M, 1, 0.5f, 1); M = sc(M, 1, 1, -1);
    M = rot(M, 210, 1, 0, 0); M = rot(M, 45, 0, 1, 0); M = rot(M, -90, 0, 1, 0);
    M = rot(M, 90, 0, 1, 0); M = tr(M, -0.5f, -0.5f, -0.5f);
    System.out.println("{\"matrix\":" + Arrays.toString(M).replace(" ", "") + "}");
    String[] names = {"west", "south", "top"};
    Face[] faces = {
      (u, v, d) -> new double[]{0, 1 - v / 16, u / 16},
      (u, v, d) -> new double[]{u / 16, 1 - v / 16, 1},
      (u, v, d) -> new double[]{1 - v / 16, 1 - d / 16, u / 16}};
    for (int S = 1; S <= 6; S++) for (int drop : new int[]{0, 8, 14}) for (int f = 0; f < 3; f++) {
      int W = 16 * S, H = 16 * S, d = f == 2 ? 0 : drop;
      // the tile rectangle's corners and the affine map pixel -> (u, v): three corners fix it
      double[] o = scr(faces[f].at(0, 0, drop), S), pu = scr(faces[f].at(16, 0, drop), S), pv = scr(faces[f].at(0, 16, drop), S);
      double ax = (pu[0] - o[0]) / 16, ay = (pu[1] - o[1]) / 16, bx = (pv[0] - o[0]) / 16, by = (pv[1] - o[1]) / 16, det = ax * by - ay * bx;
      long hash = 0xcbf29ce484222325L; int count = 0;
      for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
        double dx = x + 0.5 - o[0], dy = y + 0.5 - o[1], u = (dx * by - dy * bx) / det, v = (ax * dy - ay * dx) / det;
        // half-open parallelogram: a pixel centre exactly on an edge belongs to the face on its +u / +v side, GL's top-left rule on this axis-aligned-in-uv shape
        if (u < 0 || u >= 16 || v < d || v >= 16) continue;
        int tu = Math.min(15, (int) Math.floor(u)), tv = Math.min(15, (int) Math.floor(v - d));
        count++;
        for (int q : new int[]{x, y, tu, tv}) { hash ^= q; hash *= 0x100000001b3L; }
      }
      System.out.println("{\"scale\":" + S + ",\"drop\":" + drop + ",\"face\":\"" + names[f] + "\",\"count\":" + count + ",\"hash\":\"" + Long.toHexString(hash) + "\"}");
    }
  }
  static double[] scr(double[] p, int S) { double[] r = P(p[0], p[1], p[2]); return new double[]{r[0] * S, r[1] * S}; }
}
