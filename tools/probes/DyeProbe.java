// Prints the dye, flower and wool-dyeing facts of the unchanged 1.7.10 classes:
// ItemDye's name tables (acj.a / acj.b), BlockFlower's names (alc.a / alc.b),
// every crafting result CraftingManager.findMatchingRecipe (afe) gives for a
// grid of 1-3 items drawn from the dye/flower/wool universe (and 4 dyes), and
// the flower the biome chooser (BiomeGenBase.func_150572_a) returns for a seeded
// Random, with the plains noise (BiomeGenBase.ad) values behind it.
import java.lang.reflect.*;
import java.util.*;

public class DyeProbe {
  static zs container = new zs() {
    public boolean a(yz player) { return true; }
  };
  static List<add> universe = new ArrayList<>();
  static StringBuilder out = new StringBuilder();

  static String stack(add s) {
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]";
  }

  static void craft(int[] picks, StringBuilder recipes, int[] count) {
    aae grid = new aae(container, 3, 3);
    for (int i = 0; i < picks.length; i++) grid.a(i, universe.get(picks[i]).m());
    add result = afe.a().a(grid, null);
    if (result == null) return;
    if (count[0]++ > 0) recipes.append(',');
    recipes.append("[[");
    for (int i = 0; i < picks.length; i++) recipes.append(i > 0 ? "," : "").append(picks[i]);
    recipes.append("],").append(stack(result)).append(']');
  }

  static void multisets(int size, int from, int limit, int[] picks, int depth, StringBuilder recipes, int[] count) {
    if (depth == size) { craft(picks, recipes, count); return; }
    for (int i = from; i < limit; i++) {
      picks[depth] = i;
      multisets(size, i, limit, picks, depth + 1, recipes, count);
    }
  }

  static String names(String[] a) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < a.length; i++) b.append(i > 0 ? "," : "").append('"').append(a[i]).append('"');
    return b.append(']').toString();
  }

  static String flower(String name) {
    return "[" + aji.b(alc.e(name)) + "," + alc.f(name) + "]";
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    for (int i = 0; i < 16; i++) universe.add(new add(ade.aR, 1, i));
    universe.add(new add(ajn.N, 1, 0));
    for (int i = 0; i < 9; i++) universe.add(new add(ajn.O, 1, i));
    for (int i = 0; i < 16; i++) universe.add(new add(ajn.L, 1, i));
    universe.add(new add(ade.aS, 1, 0));
    universe.add(new add(aji.e(1), 1, 0));
    int dyeLike = 16, boneIndex = 42;
    out.append("{\"dyeNames\":").append(names(acj.a)).append(",\"dyeTextures\":").append(names(acj.b));
    out.append(",\"yellowFlowerNames\":").append(names(alc.b)).append(",\"redFlowerNames\":").append(names(alc.a));
    out.append(",\"universe\":[");
    for (int i = 0; i < universe.size(); i++) out.append(i > 0 ? "," : "").append(stack(universe.get(i)));
    out.append("],\"recipes\":[");
    StringBuilder recipes = new StringBuilder();
    int[] count = {0};
    for (int size = 1; size <= 3; size++) multisets(size, 0, universe.size(), new int[size], 0, recipes, count);
    // Four items: dyes and bone only.
    int[] four = new int[4];
    List<Integer> small = new ArrayList<>();
    for (int i = 0; i < 16; i++) small.add(i);
    small.add(boneIndex);
    for (int a = 0; a < small.size(); a++)
      for (int b = a; b < small.size(); b++)
        for (int c = b; c < small.size(); c++)
          for (int d = c; d < small.size(); d++)
            craft(new int[] {small.get(a), small.get(b), small.get(c), small.get(d)}, recipes, count);
    out.append(recipes).append("]");
    // Flower choice: biome 0 (ocean) uses the BiomeGenBase default, biome 1 is plains.
    Field ad = ahu.class.getDeclaredField("ad");
    ad.setAccessible(true);
    awl noise = (awl) ad.get(null);
    out.append(",\"flowerChoice\":{");
    for (int biome = 0; biome < 2; biome++) {
      Random random = new Random(1234 + biome), spots = new Random(99);
      ahu b = ahu.d(biome);
      out.append(biome > 0 ? "," : "").append(biome == 0 ? "\"base\"" : "\"plains\"").append(":{\"seed\":").append(1234 + biome).append(",\"points\":[");
      StringBuilder results = new StringBuilder();
      for (int i = 0; i < 4000; i++) {
        int x = spots.nextInt(60000) - 30000, y = spots.nextInt(64), z = spots.nextInt(60000) - 30000;
        out.append(i > 0 ? "," : "").append('[').append(x).append(',').append(y).append(',').append(z).append(']');
        results.append(i > 0 ? "," : "").append(flower(b.a(random, x, y, z)));
      }
      out.append("],\"results\":[").append(results).append("]}");
    }
    out.append("},\"noise\":{\"points\":[");
    Random spots = new Random(7);
    StringBuilder values = new StringBuilder();
    for (int i = 0; i < 1500; i++) {
      int x = spots.nextInt(60000) - 30000, z = spots.nextInt(60000) - 30000;
      if (i % 3 == 0) { x = spots.nextInt(400) - 200; z = spots.nextInt(400) - 200; }
      out.append(i > 0 ? "," : "").append('[').append(x).append(',').append(z).append(']');
      values.append(i > 0 ? "," : "").append(noise.a(x / 200.0, z / 200.0));
    }
    out.append("],\"values\":[").append(values).append("]}}");
    System.out.println(out);
  }
}
