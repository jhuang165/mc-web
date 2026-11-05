import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Polish track probe: the unchanged 1.7.10 EntityFireworkRocket (zf) default constructor + Entity.readFromNBT (sa.f) +
// zf.readEntityFromNBT (a(dh)), and EntityMinecartCommandBlock (xn: onActivatorRailPass a(IIIZ), NBT). Reuses the
// FireworksProbe bootstrap (world double FW, library items, NBT printer). The command itself cannot run here
// (CommandBlockLogic.func_145755_a needs a MinecraftServer, which is null: it only resets SuccessCount), so the cart
// records the delay field b after each activator call at a chosen ticksExisted (Entity.aa).
// Prints one JSON object per line: fireworkNbt, commandCartPass, commandCartNbt.
public class PolishProbe extends FireworksProbe {
  static dq doubles(double... v) { dq l = new dq(); for (double d : v) l.a(new dk(d)); return l; }


  // NBT printer with typed output: strings quoted, numbers bare, double lists and int arrays expanded.
  static String jn(dy tag) {
    if (tag instanceof dh) {
      dh c = (dh) tag;
      List<String> keys = new ArrayList<>(c.c());
      Collections.sort(keys);
      StringBuilder s = new StringBuilder("{");
      keys.removeIf(key -> key.startsWith("UUID"));
      for (int k = 0; k < keys.size(); k++) s.append(k > 0 ? "," : "").append(q(keys.get(k))).append(":").append(jn(c.a(keys.get(k))));
      return s.append("}").toString();
    }
    if (tag instanceof dq) {
      dq l = (dq) tag;
      StringBuilder s = new StringBuilder("[");
      for (int k = 0; k < l.c(); k++) s.append(k > 0 ? "," : "").append(l.d() == 10 ? jn(l.b(k)) : l.d() == 6 ? Double.toString(l.d(k)) : l.d() == 5 ? Float.toString(l.e(k)) : "null");
      return s.append("]").toString();
    }
    if (tag.a() == 11) return nbt(tag);
    String t = tag.toString();
    if (tag.a() == 8) t = t.length() >= 2 && t.startsWith("\"") ? t.substring(1, t.length() - 1) : t;
    if (tag.a() == 8) return "\"" + t.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    if (tag.a() == 4) return "\"" + t + "\"";
    return t.replaceAll("[bslfd]$", "");
  }

  static void rocket(String name, dh tag) throws Exception {
    world.E = false;
    zf r = new zf(world);
    r.f(tag);
    dh out = new dh();
    r.e(out);
    boolean hasItem = r.z().f(8) != null;
    String item = "null";
    if (hasItem) { dh s = new dh(); r.z().f(8).b(s); item = jn(s); }
    System.out.println("{\"case\":\"fireworkNbt\",\"name\":" + q(name) + ",\"in\":" + jn(tag) + ",\"life\":" + i(r, "a") + ",\"lifetime\":" + i(r, "b")
      + ",\"motion\":[" + r.v + "," + r.w + "," + r.x + "],\"item\":" + item + ",\"out\":" + jn(out) + "}");
  }

  static void cartPass(String name, int firstAge, int ticks, boolean powered) throws Exception {
    world.E = false;
    xn c = new xn(world);
    Field age = field(sa.class, "aa"), b = field(xn.class, "b");
    StringBuilder rows = new StringBuilder();
    for (int k = 0; k < ticks; k++) {
      int t = firstAge + k;
      age.setInt(c, t);
      int before = b.getInt(c);
      c.a(0, 64, 0, powered);
      int after = b.getInt(c);
      rows.append(k > 0 ? "," : "").append("[").append(t).append(",").append(before).append(",").append(after).append(",").append(after != before ? 1 : 0).append("]");
    }
    System.out.println("{\"case\":\"commandCartPass\",\"name\":" + q(name) + ",\"powered\":" + powered + ",\"rows\":[" + rows + "]}");
  }

  static void cartNbt(String name, dh tag) throws Exception {
    world.E = false;
    xn c = new xn(world);
    c.f(tag);
    dh out = new dh();
    c.e(out);
    System.out.println("{\"case\":\"commandCartNbt\",\"name\":" + q(name) + ",\"in\":" + jn(tag) + ",\"out\":" + jn(out) + ",\"type\":" + c.m() + ",\"name2\":" + q(c.e().i()) + ",\"display\":" + adb.b(adb.a(c.o())) + "}");
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    U = (sun.misc.Unsafe) uf.get(null);
    seedField = Random.class.getDeclaredField("seed");
    seedField.setAccessible(true);
    aji.p();
    adb.l();
    world = (PWorld) U.allocateInstance(FW.class);
    set(world, "s", new Random(7));
    set(world, "t", U.allocateInstance(aqq.class));
    set(world, "C", new qi());
    for (Method m : adb.class.getDeclaredMethods())
      if (java.lang.reflect.Modifier.isStatic(m.getModifiers()) && m.getReturnType() == adb.class && Arrays.equals(m.getParameterTypes(), new Class<?>[] { int.class })) { m.setAccessible(true); itemById = m; }

    rocket("bare", new dh());
    rocket("life", compound("Life", 5, "LifeTime", 17));
    rocket("negative", compound("Life", -3, "LifeTime", -1));
    dh motion = new dh(); motion.a("Motion", doubles(0.5, 0.25, -0.75));
    rocket("motion", motion);
    dh clamp = new dh(); clamp.a("Motion", doubles(11, -12, 3));
    rocket("motion-clamp", clamp);
    dh stackTag = new dh();
    stackTag.a("id", (short) 401); stackTag.a("Count", (byte) 1); stackTag.a("Damage", (short) 0);
    stackTag.a("tag", fireworks(2, explosion(1, new int[] { 16711680 }, new int[] { 255 }, true, false)));
    rocket("item", compound("LifeTime", 30, "FireworksItem", stackTag));
    dh plain = new dh(); plain.a("id", (short) 401); plain.a("Count", (byte) 1); plain.a("Damage", (short) 0);
    rocket("item-no-tag", compound("LifeTime", 30, "FireworksItem", plain));
    dh bogus = new dh(); bogus.a("id", (short) 9999); bogus.a("Count", (byte) 1); bogus.a("Damage", (short) 0);
    rocket("item-unknown-id", compound("FireworksItem", bogus));
    dh stone = new dh(); stone.a("id", (short) 1); stone.a("Count", (byte) 1); stone.a("Damage", (short) 0);
    rocket("item-not-a-rocket", compound("FireworksItem", stone));

    cartPass("powered-from-0", 0, 14, true);
    cartPass("powered-from-100", 100, 14, true);
    cartPass("unpowered", 0, 14, false);
    dh cmd = compound("SuccessCount", 1, "TrackOutput", (byte) 0); cmd.a("Command", "say hi"); cmd.a("CustomName", "Rail");
    cartNbt("command", cmd);
    cartNbt("bare", new dh());
  }
}
