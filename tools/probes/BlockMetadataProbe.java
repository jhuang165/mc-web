import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.Callable;

// PLAN-03b: executes unchanged original Block methods for every registered block ID and raw metadata 0-15.
// Block (aji) methods read through a map-backed World double (PlantProbe.W, MobMoveProbe.ProbeWorld) that holds the
// block at (8,64,8) with the metadata under test and air everywhere else (no neighbours, no tile entities):
//   damageDropped a(I), idDropped a(I,Random,I), quantityDropped a(Random), quantityDroppedWithBonus a(I,Random),
//   getIcon a(II) through a naming IIconRegister proxy (side 0-5), getRenderType b(), isOpaqueCube c(),
//   renderAsNormalBlock d(), getLightValue m(), getLightOpacity k(), getMapColor f(I), canCollideCheck a(IZ),
//   canProvidePower f(), setBlockBoundsBasedOnState a(IBlockAccess,x,y,z) + bounds getters (min x(),z(),B(); max y(),A(),C()),
//   getCollisionBoundingBoxFromPool a(World,x,y,z), getBlockHardness f(World,x,y,z), getPickBlock d(World,x,y,z),
//   getDamageValue k(World,x,y,z), isPassable b(IBlockAccess,x,y,z), isProvidingWeakPower b(...,side) and
//   isProvidingStrongPower c(...,side), getComparatorInputOverride g(World,x,y,z,side).
// A thrown exception is recorded as "EXC:<class>"; nothing is swallowed silently. Placement conversion uses
// Item.getMetadata adb.a(I) (ItemBlock subclasses) and Block.onBlockPlaced a(World,x,y,z,side,hx,hy,hz,meta).
// Entity-dependent onBlockPlacedBy orientation, world-position icons, tile entities and neighbour/tick/activation
// behavior are NOT executed.
public class BlockMetadataProbe {
  static String q(String s) {
    if (s == null) return "null";
    return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
  }

  static class Icon implements InvocationHandler {
    final String name;
    Icon(String name) { this.name = name; }
    public Object invoke(Object p, Method m, Object[] a) {
      switch (m.getName()) {
        case "toString": return "icon:" + name;
        case "hashCode": return name == null ? 0 : name.hashCode();
        case "equals": return p == a[0];
      }
      Class<?> r = m.getReturnType();
      if (r == int.class) return 0;
      if (r == float.class) return 0f;
      if (r == boolean.class) return false;
      if (r == String.class) return name;
      return null;
    }
  }

  static String ex(Throwable t) {
    Throwable c = t instanceof InvocationTargetException ? t.getCause() : t;
    return "EXC:" + c.getClass().getName();
  }

  static String val(Callable<Object> c) {
    try {
      Object o = c.call();
      if (o == null) return "null";
      if (o instanceof azt) { azt b = (azt) o; return "box[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }
      if (o instanceof adb) return "item:" + adb.b((adb) o);
      if (o instanceof add) return "stack:" + adb.b(((add) o).b()) + ":" + ((add) o).k();
      if (o instanceof awv) return "mapColor:" + ((Integer) MobMoveProbe.field(awv.class, "L").get(o)) + ":" + ((Integer) MobMoveProbe.field(awv.class, "M").get(o));
      return String.valueOf(o);
    } catch (Throwable t) { return ex(t); }
  }

  static PlantProbe.W world(aji b, int meta) throws Exception {
    PlantProbe.W w = PlantProbe.world((x, y, z) -> new int[] {0, 0});
    w.put(8, 64, 8, aji.b(b), meta);
    return w;
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    rg register = (rg) Proxy.newProxyInstance(rg.class.getClassLoader(), new Class<?>[] {rg.class}, (proxy, m, a) -> {
      if (m.getName().equals("a") && a != null && a.length == 1 && a[0] instanceof String)
        return Proxy.newProxyInstance(rf.class.getClassLoader(), new Class<?>[] {rf.class}, new Icon((String) a[0]));
      return null;
    });
    for (Object o : aji.c) ((aji) o).a(register);
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    for (Object o : aji.c) {
      aji b = (aji) o;
      int id = aji.b(b);
      adb item = adb.a(b);
      List<String> chain = new ArrayList<>();
      for (Class<?> c = b.getClass(); c != aji.class && c != null; c = c.getSuperclass()) chain.add(q(c.getName()));
      List<add> variants = new ArrayList<>();
      if (item != null && b.J() != null) b.a(item, b.J(), variants);
      TreeSet<Integer> creativeDamages = new TreeSet<>();
      for (add s : variants) creativeDamages.add(s.k());
      // Item damage 0-15 to placed metadata through the original getMetadata and onBlockPlaced.
      StringBuilder itemMeta = new StringBuilder();
      for (int d = 0; d < 16; d++) {
        final int dd = d;
        String m = item == null ? "null" : val(() -> item.a(dd));
        itemMeta.append(d == 0 ? "" : ",").append(q(m));
      }
      TreeSet<Integer> placedAll = new TreeSet<>(), placedCreative = new TreeSet<>();
      StringBuilder placeErr = new StringBuilder();
      if (item != null) {
        for (int d = 0; d < 16; d++) {
          int in = item.a(d);
          for (int side = 0; side < 6; side++)
            for (float hy : new float[] {0.25f, 0.75f}) {
              try {
                int out = b.a(world(b, 0), 8, 64, 8, side, 0.5f, hy, 0.5f, in);
                placedAll.add(out);
                if (creativeDamages.contains(d)) placedCreative.add(out);
              } catch (Throwable t) { if (placeErr.indexOf(ex(t)) < 0) placeErr.append(ex(t)).append(' '); }
            }
        }
      }
      StringBuilder metas = new StringBuilder();
      for (int meta = 0; meta < 16; meta++) {
        final int m = meta;
        PlantProbe.W w = world(b, meta);
        StringBuilder f = new StringBuilder();
        java.util.function.BiConsumer<String, Callable<Object>> put = (k, c) -> f.append(f.length() == 0 ? "" : ",").append(q(k)).append(':').append(q(val(c)));
        put.accept("damageDropped", () -> b.a(m));
        put.accept("dropItem", () -> b.a(m, new Random(0), 0));
        put.accept("quantityDropped", () -> b.a(new Random(1)));
        put.accept("quantityDroppedFortune3", () -> b.a(3, new Random(1)));
        for (int s = 0; s < 6; s++) { final int side = s; put.accept("icon" + s, () -> b.a(side, m)); }
        put.accept("renderType", () -> b.b());
        put.accept("opaque", () -> b.c());
        put.accept("renderNormal", () -> b.d());
        put.accept("light", () -> b.m());
        put.accept("opacity", () -> b.k());
        put.accept("mapColor", () -> b.f(m));
        put.accept("canCollideFalse", () -> b.a(m, false));
        put.accept("canCollideTrue", () -> b.a(m, true));
        put.accept("canProvidePower", () -> b.f());
        put.accept("bounds", () -> { b.a((ahl) w, 8, 64, 8); return azt.a(b.x(), b.z(), b.B(), b.y(), b.A(), b.C()); });
        put.accept("collision", () -> { b.a((ahl) w, 8, 64, 8); return b.a((ahb) w, 8, 64, 8); });
        put.accept("hardness", () -> b.f((ahb) w, 8, 64, 8));
        put.accept("pickBlock", () -> b.d((ahb) w, 8, 64, 8));
        put.accept("damageValue", () -> b.k((ahb) w, 8, 64, 8));
        put.accept("passable", () -> b.b((ahl) w, 8, 64, 8));
        for (int s = 0; s < 6; s++) { final int side = s; put.accept("weakPower" + s, () -> b.b((ahl) w, 8, 64, 8, side)); }
        for (int s = 0; s < 6; s++) { final int side = s; put.accept("strongPower" + s, () -> b.c((ahl) w, 8, 64, 8, side)); }
        put.accept("comparator", () -> b.g((ahb) w, 8, 64, 8, 0));
        metas.append(meta == 0 ? "" : ",").append('{').append(f).append('}');
      }
      System.out.println("{\"id\":" + id + ",\"class\":" + q(b.getClass().getName()) + ",\"chain\":[" + String.join(",", chain)
        + "],\"itemId\":" + (item == null ? "null" : adb.b(item)) + ",\"creativeDamages\":" + creativeDamages
        + ",\"itemMetadata\":[" + itemMeta + "],\"placedAll\":" + placedAll + ",\"placedCreative\":" + placedCreative
        + ",\"placeErrors\":" + q(placeErr.toString().trim()) + ",\"meta\":[" + metas + "]}");
    }
  }
}
