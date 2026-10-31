// Prints EntitySheep (wp) facts from the unchanged 1.7.10 classes: the fleece
// colour table (wp.bp), the colour roll wp.a(Random) for a seeded Random, and
// EntitySheep.func_90014_a's dye mix: two parent colours become dye damages
// 15 - colour in a 2 x 1 InventoryCrafting and CraftingManager.findMatchingRecipe
// picks the result. A result that is dye gives the child 15 - its damage; any
// other result (null) falls back to a coin flip between the parents.
import java.util.*;

public class SheepProbe {
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    zs container = new zs() {
      public boolean a(yz player) { return true; }
    };
    StringBuilder out = new StringBuilder("{\"fleeceColors\":[");
    for (int i = 0; i < 16; i++) {
      if (i > 0) out.append(',');
      out.append('[').append(wp.bp[i][0]).append(',').append(wp.bp[i][1]).append(',').append(wp.bp[i][2]).append(']');
    }
    out.append("],\"colorRolls\":{\"seed\":42,\"count\":2000,\"values\":[");
    Random random = new Random(42);
    for (int i = 0; i < 2000; i++) {
      if (i > 0) out.append(',');
      out.append(wp.a(random));
    }
    out.append("]},\"mix\":[");
    for (int a = 0; a < 16; a++) {
      for (int b = 0; b < 16; b++) {
        aae grid = new aae(container, 2, 1);
        grid.a(0, new add(ade.aR, 1, 15 - a));
        grid.a(1, new add(ade.aR, 1, 15 - b));
        add result = afe.a().a(grid, null);
        int child = result != null && result.b() == ade.aR ? 15 - result.k() : -1;
        if (a + b > 0) out.append(',');
        out.append(child);
      }
    }
    System.out.println(out.append("]}"));
  }
}
