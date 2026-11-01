import java.lang.reflect.*;
import java.util.*;
// Constructs the unchanged 1.7.10 mob models (no OpenGL: ModelBox only builds quads) and
// prints every ModelRenderer field: rotation point, angles, offsets, mirror, texture size
// and each ModelBox's uninflated bounds, inflation and texture offset. No game classes are
// patched; the texture offset is read back from the box's quad UVs.
public class ModelProbe {
  static String num(float f) { return Float.toString(f); }
  static String part(bix r) throws Exception {
    StringBuilder b = new StringBuilder("{\"point\":[" + num(r.c) + "," + num(r.d) + "," + num(r.e) + "]");
    b.append(",\"angle\":[" + num(r.f) + "," + num(r.g) + "," + num(r.h) + "]");
    b.append(",\"offset\":[" + num(r.o) + "," + num(r.p) + "," + num(r.q) + "]");
    b.append(",\"mirror\":" + r.i + ",\"show\":" + r.j + ",\"hidden\":" + r.k + ",\"texture\":[" + num(r.a) + "," + num(r.b) + "]");
    b.append(",\"boxes\":[");
    Field corners = bis.class.getDeclaredField("h"), quads = bis.class.getDeclaredField("i");
    corners.setAccessible(true); quads.setAccessible(true);
    boolean first = true;
    for (Object o : r.l) {
      bis box = (bis) o;
      bii c0 = ((bii[]) corners.get(box))[0];
      float u = Float.MAX_VALUE, v = Float.MAX_VALUE;
      for (bhv q : (bhv[]) quads.get(box)) for (bii p : q.a) { u = Math.min(u, p.b); v = Math.min(v, p.c); }
      // Corner 0 is (x1 - inflate, y1 - inflate, z1 - inflate) unless mirrored, where x swaps.
      double grow = box.b - c0.a.b;
      if (!first) b.append(','); first = false;
      b.append("{\"from\":[" + num(box.a) + "," + num(box.b) + "," + num(box.c) + "],\"to\":[" + num(box.d) + "," + num(box.e) + "," + num(box.f)
        + "],\"grow\":" + (float) grow + ",\"uv\":[" + Math.round(u * r.a) + "," + Math.round(v * r.b) + "]}");
    }
    b.append("],\"children\":[");
    first = true;
    if (r.m != null) for (Object o : r.m) { if (!first) b.append(','); first = false; b.append(part((bix) o)); }
    return b.append("]}").toString();
  }
  static void dump(String name, bhr model) throws Exception {
    List<Class<?>> chain = new ArrayList<>();
    for (Class<?> c = model.getClass(); c != bhr.class; c = c.getSuperclass()) chain.add(0, c);
    StringBuilder b = new StringBuilder("{\"model\":\"" + name + "\",\"class\":\"" + model.getClass().getName() + "\",\"texture\":[" + model.t + "," + model.u + "],\"parts\":{");
    boolean first = true;
    for (Class<?> c : chain) for (Field f : c.getDeclaredFields()) {
      if (Modifier.isStatic(f.getModifiers())) continue;
      f.setAccessible(true);
      Object v = f.get(model);
      if (f.getType() == bix.class) {
        if (!first) b.append(','); first = false;
        b.append("\"" + c.getName() + "." + f.getName() + "\":" + part((bix) v));
      } else if (f.getType() == float.class) {
        if (!first) b.append(','); first = false;
        b.append("\"" + c.getName() + "." + f.getName() + "\":" + num((Float) v));
      }
    }
    System.out.println(b.append("}}"));
  }
  public static void main(String[] args) throws Exception {
    dump("pig", new bhu());
    dump("cow", new bhi());
    dump("sheep", new bhy());
    dump("sheepFur", new bhx());
    dump("chicken", new bhh());
    dump("zombie", new bip());
    dump("skeleton", new bic());
    dump("spider", new big());
    dump("creeper", new bhj());
    dump("creeperArmor", new bhj(2.0F));
    dump("biped", new bhm(0.0F));
  }
}
