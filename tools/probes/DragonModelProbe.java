import java.lang.reflect.*;
import java.util.*;

// Unchanged 1.7.10 ModelDragon (biq), ModelRenderer (bix), ModelBox (bis) and the dragon's ring buffer (xa.b(int, float)) driven headlessly
// through a stub GL11 (tools/probes/gl): the model is constructed for real, boxes and texture offsets are read from the built ModelBox quads,
// and render() runs with a matrix stack so every ModelRenderer display-list call is recorded with its modelview matrix.
//   boxes   per ModelRenderer name: [x, y, z, w, h, d, u, v, mirror] for every box, plus the rotation point the constructor set
//   pose    dragon states x partial ticks: ring offsets 0..40, animation clock, and the per-part modelview matrices of render()
// Prints one JSON object per line with a "case" key.
public class DragonModelProbe {
  static String q(String s) { return TerrainProbe.q(s); }
  static String num(double v) { return Double.toString(v); }
  static Object get(Object o, String n) throws Exception { Field f = TerrainProbe.field(o.getClass(), n); return f.get(o); }
  static String arr(float[] a) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) s.append(','); s.append(Float.toString(a[i])); } return s.append(']').toString(); }

  static List<bix> renderers(biq m) throws Exception {
    List<bix> out = new ArrayList<>();
    for (String f : new String[] {"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"}) out.add((bix) get(m, f));
    return out;
  }

  static void boxes(biq m) throws Exception {
    for (bix r : renderers(m)) {
      StringBuilder bs = new StringBuilder();
      for (Object o : (List) r.l) {
        bis b = (bis) o;
        bhv[] quads = (bhv[]) get(b, "i");
        float minU = 1e9f, minV = 1e9f;
        for (bhv qd : quads) for (bii v : qd.a) { minU = Math.min(minU, v.b); minV = Math.min(minV, v.c); }
        // mirrored boxes swap x1/x2 in the vertex table: vertex 0 sits at x1 (unmirrored: x2)
        bii[] verts = (bii[]) get(b, "h");
        boolean mirror = Math.abs(verts[0].a.a - b.d) < 1e-6;
        // the first quad's four vertices: x extent is the width
        bs.append(bs.length() > 0 ? "," : "").append("[" + num(b.a) + "," + num(b.b) + "," + num(b.c) + "," + num(b.d - b.a) + "," + num(b.e - b.b) + "," + num(b.f - b.c) + "," + num(minU * 256f) + "," + num(minV * 256f) + "," + mirror + "]");
      }
      System.out.println("{\"case\":\"boxes\",\"name\":" + q(r.n) + ",\"point\":[" + num(r.c) + "," + num(r.d) + "," + num(r.e) + "],\"angles\":[" + num(r.f) + "," + num(r.g) + "," + num(r.h) + "],\"textureSize\":[" + num(r.a) + "," + num(r.b) + "],\"boxes\":[" + bs + "]}");
    }
  }

  static void pose(String name, long seed, float yaw, int ticks, int dying) throws Exception {
    DragonProbe.DW w = DragonProbe.world();
    xa d = DragonProbe.dragon(w, 4, 110, -3, yaw, seed);
    for (int t = 0; t < ticks; t++) { d.aa++; d.e(); }
    if (dying > 0) DragonProbe.setHealth(d, 0f);
    biq m = new biq(0f);
    Map<Integer, String> names = new HashMap<>();
    for (float partial : new float[] {0f, 0.25f, 0.6f, 1f}) {
      org.lwjgl.opengl.GL11.reset();
      m.a((sv) d, 0f, 0f, partial);
      m.a((sa) d, 0f, 0f, (float) d.aa + partial, 0f, 0f, 0.0625f);
      if (names.isEmpty()) {
        // display-list ids are assigned by ModelRenderer on first render: map them by reflection afterwards
        for (bix r : renderers(m)) names.put((Integer) get(r, "u"), r.n);
      }
      StringBuilder calls = new StringBuilder();
      for (Object[] e : org.lwjgl.opengl.GL11.LOG) {
        if (calls.length() > 0) calls.append(',');
        if (e[0].equals("call")) calls.append("[\"call\"," + q(names.get((Integer) e[1])) + "," + arr((float[]) e[2]) + "]");
        else if (e[0].equals("scale")) calls.append("[\"scale\"," + arr((float[]) e[1]) + "]");
        else calls.append("[\"cull\"," + e[1] + "]");
      }
      StringBuilder offs = new StringBuilder();
      for (int n = 0; n <= 40; n++) { double[] o = d.b(n, partial); if (n > 0) offs.append(','); offs.append("[" + num(o[0]) + "," + num(o[1]) + "," + num(o[2]) + "]"); }
      // animation clock exactly as render reads it
      System.out.println("{\"case\":\"pose\",\"name\":" + q(name) + ",\"ticks\":" + ticks + ",\"dying\":" + dying + ",\"partial\":" + num(partial) + ",\"anim\":[" + num(d.by) + "," + num(d.bx) + "],\"health\":" + num(d.aS()) + ",\"offsets\":[" + offs + "],\"calls\":[" + calls + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    TerrainProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    adb.l();
    biq m = new biq(0f);
    boxes(m);
    pose("fresh", 1L, 0f, 0, 0);
    pose("flying-a", 20260101L, 123.5f, 60, 0);
    pose("flying-b", 7L, -40f, 170, 0);
    pose("flying-c", 5L, 90f, 400, 0);
  }
}
