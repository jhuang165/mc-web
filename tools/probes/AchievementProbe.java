import java.lang.reflect.Field;
import java.util.*;

// Loads the unchanged AchievementList (pc) of the 1.7.10 JAR and prints one JSON object per line: the achievement table
// (id, column, row, icon item id/meta, parent, special, independent, description key), the AchievementList bounds (pc.a..d)
// and the exploreAllBiomes biome set (ahu.n, names from ahu.af). Timing and layout constants of GuiAchievement (beh) and
// GuiAchievements (bei) are bytecode-read and emitted by verify-achievements.mjs.
public class AchievementProbe {
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static Object get(Class<?> c, Object o, String n) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); return f.get(o); }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    pc.a();
    List<?> list = pc.e;
    int i = 0;
    for (Object o : list) {
      pb a = (pb) o;
      add icon = a.d;
      int item = adb.b(icon.b());
      int meta = (Integer) get(add.class, icon, "f");
      String desc = (String) get(pb.class, a, "k");
      System.out.println("{\"case\":\"achievement\",\"index\":" + (i++) + ",\"id\":" + q(a.e) + ",\"column\":" + a.a + ",\"row\":" + a.b
        + ",\"item\":" + item + ",\"meta\":" + meta + ",\"parent\":" + q(a.c == null ? null : a.c.e) + ",\"special\":" + a.g()
        + ",\"independent\":" + a.f + ",\"descKey\":" + q(desc) + ",\"count\":" + icon.b + "}");
    }
    System.out.println("{\"case\":\"bounds\",\"minColumn\":" + pc.a + ",\"minRow\":" + pc.b + ",\"maxColumn\":" + pc.c + ",\"maxRow\":" + pc.d + ",\"total\":" + list.size() + "}");
    Set<?> biomes = (Set<?>) get(ahu.class, null, "n");
    List<String> names = new ArrayList<>();
    for (Object b : biomes) names.add((String) get(ahu.class, b, "af"));
    Collections.sort(names);
    StringBuilder sb = new StringBuilder();
    for (String n : names) sb.append(sb.length() == 0 ? "" : ",").append(q(n));
    System.out.println("{\"case\":\"biomes\",\"names\":[" + sb + "]}");
  }
}
