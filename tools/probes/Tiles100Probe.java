import java.util.*;
// b100 tiles100: unchanged 1.7.10 classes. Numeric tags of other widths (Unbreakable, map_is_scaling, ench id/lvl), extra keys in ench / Explosion / Fireworks entries
// through a chest (aor.c then aor.b). Each record's `nbt` shows what ItemStack.readFromNBT / writeToNBT wrote back.
public class Tiles100Probe {
  static Object tag(Object... kv) throws Exception { return Tiles95Probe.tag(kv); }
  static Object list(Object... i) throws Exception { return Tiles95Probe.list(i); }
  static void chest(String label, int id, Object t) throws Exception {
    Object c = Tiles95Probe.item(0, id, 1, 0); Tiles95Probe.put(c, "tag", t);
    Tiles95Probe.run(label, "Chest", tag("x", 1, "y", 2, "z", 3, "Items", list(c)));
  }
  public static void main(String[] x) throws Exception {
    Class.forName("aji").getMethod("p").invoke(null); Class.forName("adb").getMethod("l").invoke(null);
    Tiles95Probe.DH = Class.forName("dh"); Tiles95Probe.DQ = Class.forName("dq"); Tiles95Probe.DY = Class.forName("dy"); Tiles95Probe.TE = Class.forName("aor");
    Object[] ws = {(byte) 5, (short) 1, 1, 1L, 1.5f, 1.5d};
    for (Object w : ws) { chest("Unbreakable " + w.getClass().getSimpleName(), 276, tag("Unbreakable", w)); chest("map_is_scaling " + w.getClass().getSimpleName(), 358, tag("map_is_scaling", w)); }
    chest("ench int id lvl", 276, tag("ench", list(tag("id", 16, "lvl", 3))));
    chest("ench long byte", 276, tag("ench", list(tag("id", 16L, "lvl", (byte) 3))));
    chest("ench extra key", 276, tag("ench", list(tag("id", (short) 16, "lvl", (short) 3, "foo", 1))));
    chest("StoredEnchantments extra", 403, tag("StoredEnchantments", list(tag("id", 16, "lvl", 3, "foo", "x"))));
    chest("Explosion extra", 402, tag("Explosion", tag("Type", 1, "Flicker", 1, "foo", "x")));
    chest("Fireworks extra", 401, tag("Fireworks", tag("Flight", (byte) 2, "bar", 9, "Explosions", list(tag("Type", (byte) 1, "baz", 2)))));
  }
}
