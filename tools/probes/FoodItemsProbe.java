// Prints, from the unchanged 1.7.10 classes (no world, no GL), what the browser build needs for three items:
//  * Pumpkin Pie (item 400) and the Golden Apple (item 322, damage 0 and 1, "enchanted"): ItemFood fields, ItemStack
//    stack size/name/rarity/glint, the creative tab, and the effects ItemAppleGold.onFoodEaten / ItemFood.onFoodEaten
//    apply (run with stand-ins for the world and the player that only record addPotionEffect) plus FoodStats.addStats.
//  * The crafting results of the pumpkin pie and golden apple grids through the real CraftingManager.
//  * BlockSilverfish (block 97, the monster egg): sub-blocks, names, icons per metadata, hardness, drops, and the
//    static helpers func_150196_a / func_150195_a / func_150197_b.
import java.lang.reflect.*;
import java.util.*;

public class FoodItemsProbe {
  static zs container = new zs() { public boolean a(yz player) { return true; } };
  static sun.misc.Unsafe unsafe;
  static List<String> effects;

  // Stand-in for EntityPlayer: only addPotionEffect (sv.addPotionEffect, called as yz.c(rw)) is observed.
  static class Player extends yz {
    Player() { super(null, null); }
    public r f_() { return null; }
    public boolean a(int level, String command) { return true; }
    public void a(fj message) {}
    public void c(rw e) { effects.add("{\"id\":" + e.a() + ",\"duration\":" + e.b() + ",\"amplifier\":" + e.c() + "}"); }
  }

  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static Object field(Object o, Class<?> type, String name) throws Exception {
    Field f = type.getDeclaredField(name);
    f.setAccessible(true);
    return f.get(o);
  }
  static adb item(int id) {
    for (Object o : adb.e) { adb i = (adb) o; if (i != null && adb.b(i) == id) return i; }
    return null;
  }
  static aji block(int id) { return aji.e(id); }
  static String stackJson(add s) {
    if (s == null) return "null";
    return "{\"id\":" + adb.b(s.b()) + ",\"count\":" + s.b + ",\"damage\":" + s.k() + "}";
  }
  static String craft(String name, int size, int[][] cells) {
    aae grid = new aae(container, size, size);
    for (int i = 0; i < cells.length; i++) if (cells[i] != null) grid.a(i, new add(item(cells[i][0]), 1, cells[i][1]));
    return "{\"kind\":\"craft\",\"name\":" + q(name) + ",\"size\":" + size + ",\"result\":" + stackJson(afe.a().a(grid, null)) + "}";
  }

  static void foodItem(String name, int id, int damage) throws Exception {
    adb it = item(id);
    add s = new add(it, 1, damage);
    acx food = (acx) it;
    ahb world = (ahb) unsafe.allocateInstance(mt.class);
    world.E = false;
    world.s = new Random(1);
    Player player = (Player) unsafe.allocateInstance(Player.class);
    effects = new ArrayList<>();
    Method eaten = acx.class.getDeclaredMethod("c", add.class, ahb.class, yz.class);
    eaten.setAccessible(true);
    // The potion chance of the base ItemFood is a nextFloat roll; run it 1000 times to see whether it is certain.
    int hits = 0;
    for (int i = 0; i < 1000; i++) {
      effects = new ArrayList<>();
      eaten.invoke(food, s, world, player);
      if (!effects.isEmpty()) hits++;
    }
    effects = new ArrayList<>();
    world.s = new Random(1);
    eaten.invoke(food, s, world, player);
    String first = effects.toString();
    zr stats = new zr();
    stats.a(0); stats.b(0.0f);
    stats.a(food, s);
    adq rarity = s.w();
    abt tab = it.n_();
    System.out.println("{\"kind\":\"item\",\"name\":" + q(name) + ",\"id\":" + id + ",\"damage\":" + damage
      + ",\"class\":" + q(it.getClass().getName()) + ",\"heal\":" + food.g(s) + ",\"saturationModifier\":" + food.h(s)
      + ",\"wolfsFavoriteMeat\":" + food.i() + ",\"useDuration\":" + food.d_(s) + ",\"action\":" + q(food.d(s).name())
      + ",\"alwaysEdible\":" + field(food, acx.class, "m") + ",\"potionId\":" + field(food, acx.class, "n")
      + ",\"potionDuration\":" + field(food, acx.class, "o") + ",\"potionAmplifier\":" + field(food, acx.class, "p")
      + ",\"potionProbability\":" + field(food, acx.class, "q") + ",\"maxStackSize\":" + s.e() + ",\"unlocalizedName\":" + q(s.a())
      + ",\"displayName\":" + q(s.s()) + ",\"rarity\":" + q(rarity.f) + ",\"rarityFormat\":" + q(rarity.e.toString().replace('§', '$'))
      + ",\"glint\":" + s.v() + ",\"creativeTab\":" + (tab == null ? "null" : q(tab.b())) + ",\"maxDamage\":" + it.m()
      + ",\"onFoodEatenFirstRoll\":" + first + ",\"onFoodEatenChanceHits1000\":" + hits
      + ",\"foodLevelAfterAddStatsFrom0\":" + stats.a() + ",\"saturationAfterAddStatsFrom0\":" + stats.e() + "}");
  }

  static void blockMeta(aji b, adb it, int meta, rg register) throws Exception {
    add s = new add(it, 1, meta);
    String icons;
    StringBuilder ic = new StringBuilder("[");
    for (int side = 0; side < 6; side++) { if (side > 0) ic.append(','); rf icon = b.a(side, meta); ic.append(q(icon == null ? null : icon.g())); }
    icons = ic.append(']').toString();
    Method stacked = amb.class.getDeclaredMethod("j", int.class);
    stacked.setAccessible(true);
    add st = (add) stacked.invoke(b, meta);
    org.apache.commons.lang3.tuple.ImmutablePair<?, ?> pair = amb.b(meta);
    aji pairBlock = (aji) pair.getLeft();
    Random r = new Random(0);
    adb dropped = b.a(meta, r, 0);
    System.out.println("{\"kind\":\"block\",\"meta\":" + meta + ",\"unlocalizedName\":" + q(s.a()) + ",\"displayName\":" + q(s.s())
      + ",\"icons\":" + icons + ",\"damageDropped\":" + b.a(meta) + ",\"itemDropped\":" + (dropped == null ? "null" : adb.b(dropped))
      + ",\"quantityDropped\":" + b.a(r) + ",\"stackedBlock\":" + stackJson(st)
      + ",\"func_150197_b\":{\"block\":" + aji.b(pairBlock) + ",\"meta\":" + pair.getRight() + "}}");
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    adb.l();
    rg register = (rg) Proxy.newProxyInstance(rg.class.getClassLoader(), new Class<?>[] { rg.class }, (proxy, m, a) -> {
      if (m.getName().equals("a") && a != null && a.length == 1 && a[0] instanceof String) {
        final String name = (String) a[0];
        return Proxy.newProxyInstance(rf.class.getClassLoader(), new Class<?>[] { rf.class }, (p2, m2, a2) -> m2.getName().equals("g") && m2.getParameterCount() == 0 ? name : null);
      }
      return null;
    });
    for (Object o : aji.c) try { ((aji) o).a(register); } catch (Throwable t) {}
    for (Object o : adb.e) try { ((adb) o).a(register); } catch (Throwable t) {}

    foodItem("pumpkin_pie", 400, 0);
    foodItem("golden_apple", 322, 0);
    foodItem("enchanted_golden_apple", 322, 1);
    // ItemAppleGold.getSubItems: the stacks the Food tab lists for the item.
    List<add> sub = new ArrayList<>();
    item(322).a(item(322), null, sub);
    StringBuilder subs = new StringBuilder("[");
    for (add s : sub) { if (subs.length() > 1) subs.append(','); subs.append(stackJson(s)); }
    System.out.println("{\"kind\":\"subItems\",\"item\":322,\"stacks\":" + subs.append(']') + "}");

    // CraftingManager results (damage 32767 wildcards are exercised with metadata 0 as the catalogue probe does).
    int[] none = null;
    System.out.println(craft("pumpkin pie: pumpkin, sugar, egg", 3, new int[][] { {86, 0}, {353, 0}, {344, 0}, none, none, none, none, none, none }));
    System.out.println(craft("pumpkin pie: egg, pumpkin, sugar (order)", 2, new int[][] { {344, 0}, {86, 0}, {353, 0}, none }));
    System.out.println(craft("pumpkin pie: pumpkin, sugar only", 2, new int[][] { {86, 0}, {353, 0}, none, none }));
    int[][] ring = new int[9][];
    for (int i = 0; i < 9; i++) ring[i] = new int[] { 41, 0 };
    ring[4] = new int[] { 260, 0 };
    System.out.println(craft("8 gold blocks around an apple", 3, ring));
    for (int i = 0; i < 9; i++) ring[i] = new int[] { 266, 0 };
    ring[4] = new int[] { 260, 0 };
    System.out.println(craft("8 gold ingots around an apple", 3, ring));
    for (int i = 0; i < 9; i++) ring[i] = new int[] { 371, 0 };
    ring[4] = new int[] { 260, 0 };
    System.out.println(craft("8 gold nuggets around an apple", 3, ring));
    int count = 0, ach = 0;
    for (Object o : afe.a().b()) {
      afg rec = (afg) o;
      add out = rec.b();
      if (out != null && out.b() != null && (adb.b(out.b()) == 400 || adb.b(out.b()) == 322)) count++;
    }
    System.out.println("{\"kind\":\"recipeCount\",\"recipesWithOutput322or400\":" + count + "}");

    // BlockSilverfish.
    aji egg = block(97);
    adb eggItem = item(97);
    abt tab = eggItem.n_();
    List<add> subBlocks = new ArrayList<>();
    egg.a(eggItem, null, subBlocks);
    StringBuilder sb = new StringBuilder("[");
    for (add s : subBlocks) { if (sb.length() > 1) sb.append(','); sb.append(stackJson(s)); }
    String[] names = (String[]) amb.class.getField("a").get(null);
    System.out.println("{\"kind\":\"blockInfo\",\"class\":" + q(egg.getClass().getName()) + ",\"itemClass\":" + q(eggItem.getClass().getName())
      + ",\"creativeTab\":" + (tab == null ? "null" : q(tab.b())) + ",\"hardness\":" + field(egg, aji.class, "v") + ",\"resistance\":" + field(egg, aji.class, "w")
      + ",\"unlocalizedBlockNames\":" + Arrays.toString(Arrays.stream(names).map(FoodItemsProbe::q).toArray()) + ",\"subBlocks\":" + sb.append(']') + "}");
    for (int meta = 0; meta <= 6; meta++) blockMeta(egg, eggItem, meta, register);
    // BlockSilverfish.func_150196_a (canContainSilverfish) and func_150195_a (metadata for a block + its metadata).
    int[][] probes = { {1, 0}, {4, 0}, {98, 0}, {98, 1}, {98, 2}, {98, 3}, {98, 4}, {1, 1}, {4, 1}, {3, 0}, {5, 0} };
    StringBuilder pr = new StringBuilder("[");
    for (int[] p : probes) {
      if (pr.length() > 1) pr.append(',');
      aji b = block(p[0]);
      pr.append("{\"block\":" + p[0] + ",\"meta\":" + p[1] + ",\"canContainSilverfish\":" + amb.a(b) + ",\"eggMeta\":" + amb.a(b, p[1]) + "}");
    }
    System.out.println("{\"kind\":\"containment\",\"cases\":" + pr.append(']') + "}");
  }
}
