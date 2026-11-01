import java.util.*;

// Registry and subtype inventory only. No game classes are patched and no
// world, GL context, localization, or textures are needed.
public class CatalogueProbe {
  static String q(String s) {
    if (s == null) return "null";
    return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
  }
  static String stacks(List<add> stacks) {
    List<String> rows = new ArrayList<>();
    for (add s : stacks) rows.add("{\"id\":" + adb.b(s.b()) + ",\"damage\":" + s.k()
      + ",\"count\":" + s.b + ",\"tag\":" + q(s.q() == null ? null : s.q().toString()) + "}");
    return "[" + String.join(",", rows) + "]";
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    // Icon array lengths affect the native subtype lists. A null-returning
    // icon register initializes those arrays without loading media.
    rg register = (rg) java.lang.reflect.Proxy.newProxyInstance(rg.class.getClassLoader(), new Class<?>[] { rg.class }, (proxy, m, a) -> null);
    for (Object o : aji.c) ((aji) o).a(register);
    for (Object o : adb.e) ((adb) o).a(register);
    for (Object o : adb.e) {
      adb item = (adb) o;
      List<add> variants = new ArrayList<>();
      if (item.n_() != null) item.a(item, null, variants);
      System.out.println("{\"kind\":\"item\",\"id\":" + adb.b(item) + ",\"name\":" + q(adb.e.c(item))
        + ",\"tab\":" + q(item.n_() == null ? null : item.n_().b()) + ",\"stackLimit\":" + item.m()
        + ",\"hasSubtypes\":" + item.n() + ",\"maxDamage\":" + item.o() + ",\"variants\":" + stacks(variants) + "}");
    }
    for (Object o : aji.c) {
      aji block = (aji) o;
      adb item = adb.a(block);
      List<add> variants = new ArrayList<>();
      if (item != null && block.J() != null) block.a(item, block.J(), variants);
      System.out.println("{\"kind\":\"block\",\"id\":" + aji.b(block) + ",\"name\":" + q(aji.c.c(block))
        + ",\"itemId\":" + (item == null ? "null" : adb.b(item)) + ",\"variants\":" + stacks(variants) + "}");
    }
    List<add> books = new ArrayList<>();
    for (aft enchantment : aft.b) if (enchantment != null && enchantment.C != null) ade.bR.a(enchantment, books);
    System.out.println("{\"kind\":\"searchEnchantedBooks\",\"variants\":" + stacks(books) + "}");
    // Read the complete ID map rather than guessing an ID range or using
    // spawn eggs (which exclude projectiles, utility and abstract entities).
    java.lang.reflect.Field entityIds = sg.class.getDeclaredField("e");
    entityIds.setAccessible(true);
    Map<Integer, Class<?>> entities = (Map<Integer, Class<?>>) entityIds.get(null);
    for (int id : new TreeSet<Integer>(entities.keySet())) {
      System.out.println("{\"kind\":\"entity\",\"id\":" + id + ",\"name\":" + q(sg.b(id))
        + ",\"class\":" + q(entities.get(id).getName()) + ",\"abstract\":" + java.lang.reflect.Modifier.isAbstract(entities.get(id).getModifiers())
        + ",\"spawnEgg\":" + sg.a.containsKey(id) + "}");
    }
    ahu[] biomeRegistry = ahu.n();
    for (int slot = 0; slot < biomeRegistry.length; slot++) if (biomeRegistry[slot] != null) {
      ahu biome = biomeRegistry[slot];
      System.out.println("{\"kind\":\"biome\",\"id\":" + slot + ",\"declaredId\":" + biome.ay + ",\"name\":" + q(biome.af)
        + ",\"class\":" + q(biome.getClass().getName()) + "}");
    }
    agy rules = new agy();
    for (String name : rules.b()) {
      System.out.println("{\"kind\":\"gamerule\",\"name\":" + q(name) + ",\"defaultValue\":" + q(rules.a(name)) + "}");
    }
  }
}
