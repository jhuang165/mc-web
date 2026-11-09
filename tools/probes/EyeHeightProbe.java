import java.io.File;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Records Entity.getEyeHeight (sa.g()F) for every concrete Entity subclass of the unchanged 1.7.10 JAR, with the class
// that declares the override. Each class is loaded by name from the class directory given as -Dclasses=..., constructed
// through its (World) constructor on MobMoveProbe's ProbeWorld double (a stone floor below y = 0), and g() is called.
// Where the real constructor throws on the double (needs a real world, a profile or a server) the instance is allocated
// without a constructor and Entity.width/height (sa.M/sa.N) are set to the marker pairs reported in "markers": that only
// proves the formula (constant, or a function of height), never a real size. Players are asked in their real states
// (sneaking, sleeping flags are fields on yz: sleeping bed state does not change getEyeHeight in 1.7.10, which the
// probe confirms by toggling them). Output: one JSON object per class. tools/verify-eye-height.mjs writes
// public/research/eye-height-reference.json; src/eye-height.test.js replays it.
public class EyeHeightProbe {
  static sun.misc.Unsafe unsafe() throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    f.setAccessible(true);
    return (sun.misc.Unsafe) f.get(null);
  }

  static void collect(File dir, String prefix, List<String> out) {
    File[] files = dir.listFiles();
    if (files == null) return;
    for (File f : files) {
      if (f.isDirectory()) continue; // obfuscated classes are all in the default package
      String n = f.getName();
      if (n.endsWith(".class") && n.indexOf('$') < 0) out.add(n.substring(0, n.length() - 6));
    }
  }

  static Class<?> declaring(Class<?> c) throws Exception {
    for (Class<?> k = c; k != null; k = k.getSuperclass())
      try { k.getDeclaredMethod("g"); return k; } catch (NoSuchMethodException e) {}
    return null;
  }

  static void set(Object o, String name, Object v) throws Exception {
    for (Class<?> c = o.getClass(); c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); f.set(o, v); return; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }

  static float fl(Object o, String name) throws Exception {
    for (Class<?> c = o.getClass(); c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f.getFloat(o); } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }

  static float eye(sa e) throws Exception {
    Method m = sa.class.getDeclaredMethod("g");
    m.setAccessible(true);
    return (Float) m.invoke(e);
  }

  static String num(float v) { return Float.toString(v); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = unsafe();
    String dir = System.getProperty("classes");
    List<String> names = new ArrayList<>();
    collect(new File(dir), "", names);
    java.util.Collections.sort(names);
    MobMoveProbe.ProbeWorld world = (MobMoveProbe.ProbeWorld) u.allocateInstance(MobMoveProbe.ProbeWorld.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    for (String n : names) {
      Class<?> c;
      try { c = Class.forName(n, false, EyeHeightProbe.class.getClassLoader()); } catch (Throwable t) { continue; }
      if (!sa.class.isAssignableFrom(c) || Modifier.isAbstract(c.getModifiers()) || c.isInterface()) continue;
      Class<?> decl = declaring(c);
      String how = "constructed";
      float height = Float.NaN, width = Float.NaN, eye = Float.NaN;
      String error = "";
      sa e = null;
      try {
        Constructor<?> k = null;
        for (Constructor<?> kk : c.getDeclaredConstructors())
          if (kk.getParameterCount() == 1 && ahb.class.isAssignableFrom(kk.getParameterTypes()[0])) k = kk;
        if (k == null) throw new NoSuchMethodException("no (World) constructor");
        k.setAccessible(true);
        e = (sa) k.newInstance(world);
      } catch (Throwable t) {
        Throwable r = t.getCause() != null ? t.getCause() : t;
        error = r.getClass().getSimpleName(); if (n.equals(System.getProperty("trace"))) r.printStackTrace(System.err);
        e = null;
      }
      if (e != null) {
        height = fl(e, "N"); width = fl(e, "M");
        eye = eye(e);
        System.out.println("{\"class\":\"" + n + "\",\"declaredIn\":\"" + (decl == null ? "" : decl.getName()) + "\",\"how\":\"constructed\",\"width\":" + num(width) + ",\"height\":" + num(height) + ",\"eye\":" + num(eye) + "}");
        continue;
      }
      // Fallback: allocate and probe with marker heights.
      try { e = (sa) u.allocateInstance(c); } catch (Throwable t) { System.out.println("{\"class\":\"" + n + "\",\"declaredIn\":\"" + (decl == null ? "" : decl.getName()) + "\",\"how\":\"unavailable\",\"constructorError\":\"" + error + "\",\"markers\":[]}"); continue; }
      StringBuilder sb = new StringBuilder();
      for (float h : new float[] { 1.0f, 2.0f, 3.0f }) {
        set(e, "N", h);
        try { sb.append(sb.length() > 0 ? "," : "").append("[").append(num(h)).append(",").append(num(eye(e))).append("]"); }
        catch (Throwable t) { sb.append(sb.length() > 0 ? "," : "").append("[").append(num(h)).append(",null]"); }
      }
      System.out.println("{\"class\":\"" + n + "\",\"declaredIn\":\"" + (decl == null ? "" : decl.getName()) + "\",\"how\":\"allocated\",\"constructorError\":\"" + error + "\",\"markers\":[" + sb + "]}");
    }
  }
}
