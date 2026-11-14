import java.lang.reflect.*;
import java.util.*;
// Batch 64: runs the unchanged 1.7.10 ModelBase.render of the child-aware mob models twice on the same instance, once with isChild false and once true, with the recording GL11
// stand-in (probes/gl/GL11.java, markLists on). Every ModelRenderer's display list is named after its field ("class.field", children "class.field/i"), so the recorded
// ["L", id] events say which part a transform stack belongs to. Events: ["T", x, y, z] glTranslatef, ["R", a, x, y, z] glRotatef, ["S", x, y, z] glScalef, ["P"] push,
// ["O"] pop, ["L", list] a part's display list. The model's limb angles are setRotationAngles at zero inputs (the same for both rows); each part's rest point, angles and
// boxes are printed too, so the port's boxes can be placed without another source. setRotationAngles runs with zero inputs, except in the biped family and the villager (an anonymous subclass makes it a no-op),
// whose limbs then stay at their constructor rest angles; both are what the port's rig at rest draws (models.test.js restRig). No game classes are patched; the entity argument is null (none of these render
// methods reads it). ModelHorse needs its entity and is covered by HorseModelProbe.
public class BabyModelProbe {
  static String num(float f) { return Float.toString(f); }
  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void parts(String name, bix r, Map<Integer, String> names, StringBuilder out) throws Exception {
    int id = (Integer) field(bix.class, "u").get(r);
    names.put(id, name);
    out.append(out.length() > 1 ? "," : "").append("\"" + name + "\":{\"list\":" + id + ",\"point\":[" + num(r.c) + "," + num(r.d) + "," + num(r.e) + "],\"angle\":[" + num(r.f) + "," + num(r.g) + "," + num(r.h)
      + "],\"offset\":[" + num(r.o) + "," + num(r.p) + "," + num(r.q) + "],\"mirror\":" + r.i + ",\"boxes\":[");
    boolean first = true;
    for (Object o : r.l) {
      bis b = (bis) o;
      bii c0 = ((bii[]) field(bis.class, "h").get(b))[0];
      out.append(first ? "" : ",").append("{\"from\":[" + num(b.a) + "," + num(b.b) + "," + num(b.c) + "],\"to\":[" + num(b.d) + "," + num(b.e) + "," + num(b.f) + "],\"grow\":" + (float) (b.b - c0.a.b) + "}");
      first = false;
    }
    out.append("]}");
    if (r.m != null) { int i = 0; for (Object c : r.m) parts(name + "/" + i++, (bix) c, names, out); }
  }
  static String run(String label, bhr model) throws Exception {
    List<Class<?>> chain = new ArrayList<>();
    for (Class<?> c = model.getClass(); c != bhr.class; c = c.getSuperclass()) chain.add(0, c);
    // First render compiles the display lists (and records the list ids of every part).
    model.s = false;
    org.lwjgl.opengl.GL11.markLists = false;
    org.lwjgl.opengl.GL11.events.clear();
    model.a(null, 0f, 0f, 0f, 0f, 0f, 0.0625f);
    Map<Integer, String> names = new HashMap<>();
    StringBuilder pt = new StringBuilder("{"), floats = new StringBuilder("{");
    for (Class<?> c : chain) for (Field f : c.getDeclaredFields()) {
      if (Modifier.isStatic(f.getModifiers())) continue;
      f.setAccessible(true);
      if (f.getType() == bix.class && f.get(model) != null) parts(c.getName() + "." + f.getName(), (bix) f.get(model), names, pt);
      else if (f.getType() == float.class) floats.append(floats.length() > 1 ? "," : "").append("\"" + c.getName() + "." + f.getName() + "\":" + num((Float) f.get(model)));
    }
    StringBuilder s = new StringBuilder("{\"model\":\"" + label + "\",\"class\":\"" + model.getClass().getName() + "\",\"parts\":" + pt + "},\"floats\":" + floats + "},\"render\":{");
    org.lwjgl.opengl.GL11.markLists = true;
    for (boolean child : new boolean[] {false, true}) {
      model.s = child;
      org.lwjgl.opengl.GL11.events.clear();
      model.a(null, 0f, 0f, 0f, 0f, 0f, 0.0625f);
      s.append(child ? ",\"child\":[" : "\"adult\":[");
      boolean first = true;
      for (String e : org.lwjgl.opengl.GL11.events) {
        if (e.startsWith("[\"D\"")) continue; // the compile pass's draw markers (the lists are replayed whole)
        s.append(first ? "" : ",");
        first = false;
        if (e.startsWith("[\"L\"")) { int id = Integer.parseInt(e.substring(5, e.length() - 1)); s.append("[\"L\",\"" + names.get(id) + "\"]"); } else s.append(e);
      }
      s.append("]");
    }
    return s.append("}}").toString();
  }
  public static void main(String[] args) throws Exception {
    org.lwjgl.opengl.GL11.onDraw = () -> "[\"D\"]";
    System.out.println(run("biped", new bhm(0.0f) { public void a(float a, float b, float c, float d, float e, float f, sa x) {} }));
    System.out.println(run("zombie", new bip() { public void a(float a, float b, float c, float d, float e, float f, sa x) {} }));
    System.out.println(run("pig", new bhu()));
    System.out.println(run("cow", new bhi()));
    System.out.println(run("sheep", new bhy()));
    System.out.println(run("sheepFur", new bhx()));
    System.out.println(run("chicken", new bhh()));
    System.out.println(run("wolf", new bio()));
    System.out.println(run("ocelot", new bht()));
    System.out.println(run("villager", new bik(0.0f) { public void a(float a, float b, float c, float d, float e, float f, sa x) {} }));
    System.out.println(run("zombieVillager", new bil() { public void a(float a, float b, float c, float d, float e, float f, sa x) {} }));
  }
}
