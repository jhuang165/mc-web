import java.lang.reflect.*;
import java.util.*;

// Reads the unchanged crafting list (including order and dynamic recipes),
// furnace input/result map and separate result/XP map. No world or GL context.
public class RecipeCatalogueProbe {
  static zs container = new zs() { public boolean a(yz player) { return true; } };
  static Object field(Object o, Class<?> type, String name) throws Exception {
    Field f = type.getDeclaredField(name);
    f.setAccessible(true);
    return f.get(o);
  }
  static String stack(add s) {
    if (s == null) return "null";
    return "{\"id\":" + adb.b(s.b()) + ",\"count\":" + s.b + ",\"damage\":" + s.k()
      + ",\"tag\":" + CatalogueProbe.q(s.q() == null ? null : s.q().toString()) + "}";
  }
  static String stacks(List<add> values) {
    List<String> rows = new ArrayList<>();
    for (add s : values) rows.add(stack(s));
    return "[" + String.join(",", rows) + "]";
  }
  static void sample(int index, List<add> pattern, int width, int height, boolean shaped) {
    // Exercise actual manager dispatch, rather than assume getRecipeOutput
    // is the result when an earlier recipe matches. Wildcard sample = damage 0.
    for (int size = 2; size <= 3; size++) {
      if (!shaped) {
        width = Math.min(pattern.size(), size);
        height = (pattern.size() + width - 1) / width;
      }
      if (width > size || height > size) continue;
      for (int ox = 0; ox <= size - width; ox++) for (int oy = 0; oy <= size - height; oy++) {
        for (int mirror = 0; mirror < 2; mirror++) {
          aae grid = new aae(container, size, size);
          List<add> cells = new ArrayList<>(Collections.nCopies(size * size, null));
          for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
            int at = y * width + (mirror == 0 ? x : width - 1 - x);
            add source = at < pattern.size() ? pattern.get(at) : null;
            if (source == null) continue;
            add s = source.m();
            s.b = 1;
            if (s.k() == 32767) s.b(0);
            int slot = (oy + y) * size + ox + x;
            cells.set(slot, s);
            grid.a(slot, s);
          }
          System.out.println("{\"kind\":\"sample\",\"recipe\":" + index + ",\"size\":" + size
            + ",\"offset\":[" + ox + "," + oy + "],\"mirrored\":" + (mirror != 0)
            + ",\"cells\":" + stacks(cells) + ",\"result\":" + stack(afe.a().a(grid, null)) + "}");
        }
      }
    }
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    List<afg> recipes = afe.a().b();
    for (int index = 0; index < recipes.size(); index++) {
      afg recipe = recipes.get(index);
      boolean shaped = recipe.getClass() == afh.class, shapeless = recipe.getClass() == afi.class;
      int width = 0, height = 0;
      List<add> ingredients = null;
      boolean copyNbt = false;
      if (recipe instanceof afh) {
        width = (Integer) field(recipe, afh.class, "a");
        height = (Integer) field(recipe, afh.class, "b");
        ingredients = Arrays.asList((add[]) field(recipe, afh.class, "c"));
        copyNbt = (Boolean) field(recipe, afh.class, "e");
      } else if (shapeless) {
        ingredients = (List<add>) field(recipe, afi.class, "b");
      }
      System.out.println("{\"kind\":\"crafting\",\"index\":" + index + ",\"class\":" + CatalogueProbe.q(recipe.getClass().getName())
        + ",\"type\":" + CatalogueProbe.q(shaped ? "shaped" : shapeless ? "shapeless" : "special")
        + ",\"width\":" + width + ",\"height\":" + height + ",\"copyNbt\":" + copyNbt
        + ",\"ingredients\":" + (ingredients == null ? "null" : stacks(ingredients)) + ",\"declaredOutput\":" + stack(recipe.b()) + "}");
      if (shaped) sample(index, ingredients, width, height, true);
      // Two compact layouts sample the shapeless ingredients, not every permutation.
      else if (shapeless) {
        int n = ingredients.size();
        sample(index, ingredients, Math.min(n, 3), (n + 2) / 3, false);
      }
    }
    Map<add, add> smelting = afa.a().b();
    List<Map.Entry<add, add>> entries = new ArrayList<>(smelting.entrySet());
    entries.sort(Comparator.comparing(e -> stack(e.getKey())));
    for (Map.Entry<add, add> e : entries) {
      add input = e.getKey().m();
      if (input.k() == 32767) input.b(0);
      add result = afa.a().a(input);
      System.out.println("{\"kind\":\"smelting\",\"input\":" + stack(e.getKey()) + ",\"output\":" + stack(e.getValue())
        + ",\"experience\":" + afa.a().b(e.getValue()) + ",\"sample\":{\"input\":" + stack(input)
        + ",\"output\":" + stack(result) + ",\"experience\":" + (result == null ? 0 : afa.a().b(result)) + "}}");
    }
    Map<add, Float> xp = (Map<add, Float>) field(afa.a(), afa.class, "c");
    List<Map.Entry<add, Float>> xpEntries = new ArrayList<>(xp.entrySet());
    xpEntries.sort(Comparator.comparing(e -> stack(e.getKey())));
    for (Map.Entry<add, Float> e : xpEntries) {
      System.out.println("{\"kind\":\"smeltingXp\",\"output\":" + stack(e.getKey()) + ",\"experience\":" + e.getValue() + "}");
    }
  }
}
