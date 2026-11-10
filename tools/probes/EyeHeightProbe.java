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
// probe confirms by toggling them). Batch 34: the classes that have no (World) constructor are tried with their real constructors and
// default arguments (World = the double, numbers 0 / 1.0 for floats, GameProfile a dummy, anything else null) and the first one that runs
// is used ("how":"constructed", "ctor" the signature). EntityHorse needs the empty en_US.lang resource on the class path (its constructor
// reads StatCollector); EntityPlayerMP is built through its real (MinecraftServer, WorldServer, GameProfile, ItemInWorldManager)
// constructor on server / world / network-free doubles (Srv, TW, PL below); EntityDragonPart is read from the constructed EntityDragon.
// Whatever still cannot be built keeps the allocated marker-height fallback. Output: one JSON object per class. tools/verify-eye-height.mjs writes
// public/research/eye-height-reference.json; src/eye-height.test.js replays it.
public class EyeHeightProbe {
  // ---- doubles for EntityPlayerMP's real constructor (the server and world classes are the original ones, subclassed only to cut I/O) ----
  public static class Info extends ays { Info() { super(); } }
  public static class Srv extends net.minecraft.server.MinecraftServer {
    Srv() { super(new java.io.File(System.getProperty("java.io.tmpdir")), java.net.Proxy.NO_PROXY); }
    protected boolean e() { return true; } public boolean h() { return false; } public ahk i() { return ahk.a(1); } public rd j() { return null; }
    public boolean k() { return false; } public int l() { return 0; } public boolean m() { return false; } public boolean X() { return false; }
    public boolean ad() { return false; } public String a(ahk k, boolean b) { return ""; }
    public boolean N() { return true; } public int af() { return 256; }
  }
  public static class PL extends oi {
    PL() { super(null); }
    public pg a(yz p) { return null; }
  }
  public static class TW extends mt {
    TW() { super(null, null, null, 0, null, null); }
    static final Info INFO = new Info();
    public ays N() { return INFO; }
    public java.util.List a(sa e, azt box) { return new ArrayList(); }
    public boolean d(int x, int y, int z) { return true; }
    public aji a(int x, int y, int z) { return aji.e(0); }
    public int i(int x, int z) { return 64; }
  }

  // Constructed entities by class: later constructors take them as arguments (EntityDragonPart takes the EntityDragon, EntityCrit2FX a target).
  static final java.util.Map<Class<?>, Object> built = new java.util.LinkedHashMap<>();
  // Client players: AbstractClientPlayer's constructor asks Minecraft.getMinecraft().getSkinManager() to load the skin; the manager is a no-op double
  // on an allocated Minecraft (set as Minecraft.theMinecraft), the Session is a real one with a dummy name and id.
  public static class SM extends brj {
    SM() { super(null, null, null); }
    public void a(com.mojang.authlib.GameProfile p, bro c, boolean b) {}
  }
  static void installMinecraft(sun.misc.Unsafe u) throws Exception {
    bao mc = (bao) u.allocateInstance(bao.class);
    set(mc, "aA", u.allocateInstance(SM.class));
    for (Field f : bao.class.getDeclaredFields()) if (f.getType() == bao.class && Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(null, mc); }
  }
  static Object defaultArg(Class<?> t, ahb world, sun.misc.Unsafe u) throws Exception {
    if (ahb.class.isAssignableFrom(t)) return world;
    if (t == double.class) return 0.0d; if (t == float.class) return 1.0f; if (t == int.class) return 0; if (t == boolean.class) return false;
    if (t == long.class) return 0L; if (t == byte.class) return (byte) 0; if (t == short.class) return (short) 0; if (t == String.class) return "";
    if (t == com.mojang.authlib.GameProfile.class) return new com.mojang.authlib.GameProfile(new java.util.UUID(1L, 2L), "Probe");
    if (t == bbs.class) return new bbs("Probe", "00000000000000000000000000000001", "token", "legacy");
    if (t == aji.class) return aji.e(1);
    if (t == adb.class) return adb.d(1);
    for (java.util.Map.Entry<Class<?>, Object> b : built.entrySet()) if (t.isAssignableFrom(b.getKey())) return b.getValue();
    try { Constructor<?> k0 = t.getDeclaredConstructor(); k0.setAccessible(true); if (t.getName().indexOf('.') < 0 || t == java.util.ArrayList.class) return k0.newInstance(); } catch (Throwable x) {}
    if (t.getName().indexOf('.') < 0 && !t.isInterface() && !Modifier.isAbstract(t.getModifiers())) return u.allocateInstance(t); // Minecraft, Session, ... : fields stay null
    return null;
  }

  static String signature(Constructor<?> k) {
    StringBuilder b = new StringBuilder("(");
    for (Class<?> t : k.getParameterTypes()) b.append(b.length() > 1 ? "," : "").append(t.getSimpleName());
    return b.append(")").toString();
  }

  // EntityPlayerMP through its real constructor. The server, world, profile manager and item manager are the doubles above; the world
  // is allocated without its constructor and given the provider, random and profiler fields the entity constructors read.
  static sa buildPlayerMP(MobMoveProbe.ProbeWorld probeWorld, sun.misc.Unsafe u) throws Exception {
    Srv srv = new Srv();
    TW w = (TW) u.allocateInstance(TW.class);
    set(w, "s", new Random(2)); set(w, "C", new qi()); set(w, "t", u.allocateInstance(aqq.class)); set(w, "x", TW.INFO);
    PL list = (PL) u.allocateInstance(PL.class);
    for (Field f : net.minecraft.server.MinecraftServer.class.getDeclaredFields()) if (f.getType() == oi.class) { f.setAccessible(true); f.set(srv, list); }
    Constructor<?> k = mw.class.getDeclaredConstructors()[0];
    k.setAccessible(true);
    return (sa) k.newInstance(srv, w, new com.mojang.authlib.GameProfile(new java.util.UUID(1L, 2L), "Probe"), new mx(w));
  }

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
    MobMoveProbe.ProbeWorld world2 = (MobMoveProbe.ProbeWorld) u.allocateInstance(MobMoveProbe.ProbeWorld.class); // spawn point readable (player constructors)
    MobMoveProbe.set(world2, "s", new Random(2));
    MobMoveProbe.set(world2, "C", new qi());
    MobMoveProbe.set(world2, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(world2, "x", TW.INFO);
    MobMoveProbe.set(world2, "u", new ArrayList<>()); // loadedEntityList (EntityFX subclasses that scan for entities)
    installMinecraft(u);
    names.remove("wy"); names.add("wy"); // EntityDragonPart takes the EntityDragon (xa), built earlier in the list
    for (String n : names) {
      Class<?> c;
      try { c = Class.forName(n, false, EyeHeightProbe.class.getClassLoader()); } catch (Throwable t) { continue; }
      if (!sa.class.isAssignableFrom(c) || Modifier.isAbstract(c.getModifiers()) || c.isInterface()) continue;
      Class<?> decl = declaring(c);
      // The world's Random restarts for every class so a record never depends on how many draws earlier classes made (slimes pick a random size).
      MobMoveProbe.set(world, "s", new Random(2)); MobMoveProbe.set(world2, "s", new Random(2));
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
      String ctor = "(World)";
      if (e == null && n.equals("mw")) {
        try { e = buildPlayerMP(world, u); ctor = "(MinecraftServer,WorldServer,GameProfile,ItemInWorldManager)"; }
        catch (Throwable t) { Throwable r = t.getCause() != null ? t.getCause() : t; error = r.getClass().getSimpleName() + (r.getMessage() == null ? "" : ":" + r.getMessage()); if (n.equals(System.getProperty("trace"))) r.printStackTrace(System.err); e = null; }
      }
      if (e == null && !n.equals("mw")) {
        List<Constructor<?>> ks = new ArrayList<>(Arrays.asList(c.getDeclaredConstructors()));
        ks.sort((a, b) -> a.getParameterCount() - b.getParameterCount());
        for (Constructor<?> kk : ks) {
          if (kk.getParameterCount() == 0) continue;
          try {
            kk.setAccessible(true);
            Object[] a = new Object[kk.getParameterCount()];
            for (int i = 0; i < a.length; i++) a[i] = defaultArg(kk.getParameterTypes()[i], world2, u);
            e = (sa) kk.newInstance(a);
            ctor = signature(kk);
            break;
          } catch (Throwable t) { Throwable r = t.getCause() != null ? t.getCause() : t; if (n.equals(System.getProperty("trace"))) r.printStackTrace(System.err); e = null; }
        }
      }
      if (e != null) {
        built.putIfAbsent(c, e);
        height = fl(e, "N"); width = fl(e, "M");
        eye = eye(e);
        String sneak = "";
        if (yz.class.isAssignableFrom(c)) { // Entity.setSneaking(sa.b(Z)V): the flag only; players keep the same getEyeHeight
          try { Method m = sa.class.getDeclaredMethod("b", boolean.class); m.setAccessible(true); m.invoke(e, true); sneak = ",\"sneakEye\":" + num(eye(e)) + ",\"sneakHeight\":" + num(fl(e, "N")); }
          catch (Throwable t) { sneak = ",\"sneakEye\":null"; }
        }
        System.out.println("{\"class\":\"" + n + "\",\"declaredIn\":\"" + (decl == null ? "" : decl.getName()) + "\",\"how\":\"constructed\",\"ctor\":\"" + ctor + "\",\"width\":" + num(width) + ",\"height\":" + num(height) + ",\"eye\":" + num(eye) + sneak + "}");
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
