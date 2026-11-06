import java.lang.reflect.Field;
import java.util.*;

// Loads the unchanged StatList (pp) of the 1.7.10 JAR and prints one JSON object per line: every registered stat in
// registration order (pp.b: id ph.e, class, general-list membership, formatter kind, awardLocallyOnly ph.f, item id for
// StatCrafting), the stat id lists pp.c/pp.d/pp.e, the per-item arrays pp.C..F (index -> id, after block merging), the
// EntityList egg infos in HashMap iteration order (sg.a, kill stat sh.d / killedBy stat sh.e) and formatter samples.
public class StatsProbe {
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static Object get(Class<?> c, Object o, String n) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); return f.get(o); }
  static String kind(Object formatter) throws Exception {
    if (formatter == ph.g) return "simple";
    if (formatter == ph.h) return "time";
    if (formatter == ph.i) return "distance";
    if (formatter == ph.j) return "decimal";
    return "other";
  }
  static String ids(List<?> l) {
    StringBuilder sb = new StringBuilder();
    for (Object o : l) sb.append(sb.length() == 0 ? "" : ",").append(q(((ph) o).e));
    return "[" + sb + "]";
  }
  static void array(String name, ph[] a) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < a.length; i++) if (a[i] != null) sb.append(sb.length() == 0 ? "" : ",").append("[").append(i).append(",").append(q(a[i].e)).append("]");
    System.out.println("{\"case\":\"array\",\"name\":" + q(name) + ",\"entries\":[" + sb + "]}");
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    pc.a();
    pp.a(); // StatList.init: per-block and per-item stats (needs the crafting and smelting recipes)
    int i = 0;
    Set<Object> general = new HashSet<>(pp.c);
    for (Object o : pp.b) {
      ph s = (ph) o;
      String item = s instanceof pf ? String.valueOf(adb.b(((pf) s).a())) : "null";
      System.out.println("{\"case\":\"stat\",\"index\":" + (i++) + ",\"id\":" + q(s.e) + ",\"class\":" + q(s.getClass().getName())
        + ",\"general\":" + general.contains(s) + ",\"format\":" + q(kind(get(ph.class, s, "b"))) + ",\"local\":" + s.f + ",\"item\":" + item + "}");
    }
    System.out.println("{\"case\":\"lists\",\"general\":" + ids(pp.c) + ",\"items\":" + ids(pp.d) + ",\"blocks\":" + ids(pp.e) + "}");
    array("mineBlock", pp.C); array("craftItem", pp.D); array("useItem", pp.E); array("breakItem", pp.F);
    long[] values = {0, 1, 5, 20, 21, 100, 999, 1000, 1234567, 12000, 36000, 72000, 1728000, 631152000L, 2147483647L};
    pm[] formatters = {ph.g, ph.h, ph.i, ph.j};
    String[] names = {"simple", "time", "distance", "decimal"};
    for (int k = 0; k < formatters.length; k++) {
      StringBuilder sb = new StringBuilder();
      for (long v : values) sb.append(sb.length() == 0 ? "" : ",").append("[").append(v).append(",").append(q(formatters[k].a((int) v))).append("]");
      System.out.println("{\"case\":\"format\",\"kind\":" + q(names[k]) + ",\"samples\":[" + sb + "]}");
    }
    int n = 0;
    for (Object o : sg.a.entrySet()) {
      Map.Entry<?, ?> e = (Map.Entry<?, ?>) o;
      sh egg = (sh) e.getValue();
      System.out.println("{\"case\":\"egg\",\"order\":" + (n++) + ",\"id\":" + e.getKey() + ",\"name\":" + q(sg.b((Integer) e.getKey())) + ",\"kills\":" + q(egg.d.e) + ",\"killedBy\":" + q(egg.e.e) + "}");
    }
    System.out.println("{\"case\":\"uuid\",\"name\":\"Player\",\"offline\":" + q(UUID.nameUUIDFromBytes("OfflinePlayer:Player".getBytes("UTF-8")).toString()) + "}");
  }
}
