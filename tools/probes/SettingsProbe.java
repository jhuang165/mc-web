import java.io.File;
import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged GameSettings/Options/KeyBinding/SoundCategory constructors
// and static initializers headlessly (null Minecraft, nonexistent options file).
// Nothing is rendered, no I18n/lang resources are loaded and no window or audio
// device is created. Names are obfuscated; the Node wrapper maps them with SRG.
public class SettingsProbe {
  static String q(String s) { return CatalogueProbe.q(s); }
  static Object field(Object o, Class<?> c, String name) throws Exception {
    Field f = c.getDeclaredField(name);
    f.setAccessible(true);
    return f.get(o);
  }
  static String js(Object v) {
    if (v == null) return "null";
    if (v instanceof String) return q((String) v);
    if (v instanceof Float) {
      float f = (Float) v;
      return Float.isNaN(f) || Float.isInfinite(f) ? q(String.valueOf(f)) : Float.toString(f);
    }
    if (v instanceof Number || v instanceof Boolean) return String.valueOf(v);
    if (v instanceof Enum) return q(((Enum<?>) v).name());
    if (v instanceof Object[]) {
      List<String> r = new ArrayList<>();
      for (Object o : (Object[]) v) r.add(js(o));
      return "[" + String.join(",", r) + "]";
    }
    if (v instanceof Collection) {
      List<String> r = new ArrayList<>();
      for (Object o : (Collection<?>) v) r.add(js(o));
      return "[" + String.join(",", r) + "]";
    }
    return q(v.toString());
  }
  static String enumDump(Class<?> c) throws Exception {
    List<String> rows = new ArrayList<>();
    for (Object o : c.getEnumConstants()) {
      List<String> parts = new ArrayList<>();
      parts.add("\"name\":" + q(((Enum<?>) o).name()));
      parts.add("\"ordinal\":" + ((Enum<?>) o).ordinal());
      for (Field f : c.getDeclaredFields()) {
        if (Modifier.isStatic(f.getModifiers()) || f.isSynthetic()) continue;
        f.setAccessible(true);
        parts.add(q(f.getName()) + ":" + js(f.get(o)));
      }
      rows.add("{" + String.join(",", parts) + "}");
    }
    return "[" + String.join(",", rows) + "]";
  }
  static bbj construct(boolean is64, File file) throws Exception {
    Field u = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe");
    u.setAccessible(true);
    sun.misc.Unsafe unsafe = (sun.misc.Unsafe) u.get(null);
    bao mc = (bao) unsafe.allocateInstance(bao.class);
    Field f = bao.class.getDeclaredField("ai");
    f.setAccessible(true);
    f.setBoolean(mc, is64);
    return new bbj(mc, file.getParentFile());
  }
  public static void main(String[] args) throws Exception {
    File tmp = new File(args[0], "options-absent.txt");
    if (tmp.exists()) tmp.delete();
    // GameSettings only reads Minecraft.isJava64bit() (render distance 12 vs 8), so an
    // uninitialized instance with that one flag set is enough; no Minecraft state runs.
    bbj gs = construct(true, tmp);
    bbj gs32 = construct(false, tmp);
    System.out.println("{\"kind\":\"renderDistanceByJvm\",\"java64bit\":" + gs.a(bbm.f) + ",\"java32bit\":" + gs32.a(bbm.f) + "}");

    for (bbm o : bbm.values()) {
      boolean isFloat = o.a(), isBool = o.b();
      String value = "null";
      if (isFloat) value = Float.toString(gs.a(o));
      else if (isBool) value = String.valueOf(gs.b(o));
      float min = (Float) field(o, bbm.class, "W"), max = (Float) field(o, bbm.class, "X"), step = (Float) field(o, bbm.class, "V");
      // Native slider conversions: normalized->raw (d) and raw->normalized (c), plus snap (e).
      String slider = "null";
      if (isFloat) slider = "{\"rawAt0\":" + o.d(0f) + ",\"rawAt1\":" + o.d(1f) + ",\"rawAt0_5\":" + o.d(0.5f)
        + ",\"normalizedMin\":" + o.c(min) + ",\"normalizedMax\":" + o.c(max) + ",\"snap\":" + o.e(min + (max - min) * 0.37f) + "}";
      System.out.println("{\"kind\":\"option\",\"ordinal\":" + o.ordinal() + ",\"name\":" + q(o.name()) + ",\"translationKey\":" + q(o.d())
        + ",\"isFloat\":" + isFloat + ",\"isBoolean\":" + isBool + ",\"returnedOrdinal\":" + o.c()
        + ",\"min\":" + min + ",\"max\":" + max + ",\"step\":" + step + ",\"default\":" + value + ",\"slider\":" + slider + "}");
    }

    // Instance defaults as constructed (all non-static GameSettings fields except key bindings).
    List<String> fields = new ArrayList<>();
    for (Field f : bbj.class.getDeclaredFields()) {
      if (Modifier.isStatic(f.getModifiers())) continue;
      f.setAccessible(true);
      Object v = f.get(gs);
      if (v instanceof bal || v instanceof bal[] || v instanceof bao || v instanceof File) continue;
      if (v instanceof Map) {
        List<String> e = new ArrayList<>();
        for (Map.Entry<?, ?> en : ((Map<?, ?>) v).entrySet()) e.add(q(String.valueOf(en.getKey())) + ":" + js(en.getValue()));
        fields.add(q(f.getName()) + ":{" + String.join(",", e) + "}");
        continue;
      }
      fields.add(q(f.getName()) + ":" + js(v));
    }
    System.out.println("{\"kind\":\"gameSettingsFields\",\"fields\":{" + String.join(",", fields) + "}}");

    // String value sets (private static arrays) used by the display/cycle logic.
    for (String n : new String[] { "aP", "aQ", "aR", "aS", "aT", "aU", "aV" })
      System.out.println("{\"kind\":\"valueSet\",\"field\":" + q(n) + ",\"values\":" + js(field(null, bbj.class, n)) + "}");
    System.out.println("{\"kind\":\"enum\",\"class\":\"rd\",\"constants\":" + enumDump(rd.class) + "}");
    System.out.println("{\"kind\":\"enum\",\"class\":\"zb\",\"constants\":" + enumDump(zb.class) + "}");

    // Sound categories with volumes returned by constructed settings.
    for (w c : w.values())
      System.out.println("{\"kind\":\"soundCategory\",\"enum\":" + q(c.name()) + ",\"ordinal\":" + c.ordinal() + ",\"key\":" + q(c.a()) + ",\"id\":" + c.b() + ",\"default\":" + gs.a(c) + "}");

    // Key bindings: named GameSettings fields, keyBindings array (saved order), hotbar array, static registration order.
    for (Field f : bbj.class.getDeclaredFields()) {
      if (Modifier.isStatic(f.getModifiers()) || f.getType() != bal.class) continue;
      f.setAccessible(true);
      bal k = (bal) f.get(gs);
      System.out.println("{\"kind\":\"keyField\",\"field\":" + q(f.getName()) + ",\"description\":" + q(k.g()) + "}");
    }
    int i = 0;
    for (bal k : gs.as) {
      System.out.println("{\"kind\":\"keyBinding\",\"index\":" + (i++) + ",\"description\":" + q(k.g()) + ",\"defaultKey\":" + k.h()
        + ",\"category\":" + q(k.e()) + ",\"currentKey\":" + k.i() + "}");
    }
    i = 0;
    for (bal k : gs.ar) System.out.println("{\"kind\":\"hotbarKey\",\"index\":" + (i++) + ",\"description\":" + q(k.g()) + ",\"defaultKey\":" + k.h() + "}");
    List<?> all = (List<?>) field(null, bal.class, "a");
    i = 0;
    for (Object o : all) System.out.println("{\"kind\":\"keyRegistration\",\"index\":" + (i++) + ",\"description\":" + q(((bal) o).g()) + "}");
    System.out.println("{\"kind\":\"keyCategories\",\"hashSetIterationOrder\":" + js(bal.c()) + "}");

    // Static option arrays for option screens.
    String[][] screens = { { "bef", "i" }, { "bcs", "a" }, { "bcs", "f" }, { "bdm", "f" }, { "bew", "h" } };
    for (String[] s : screens) {
      Class<?> c = Class.forName(s[0]);
      Object[] arr = (Object[]) field(null, c, s[1]);
      System.out.println("{\"kind\":\"screenArray\",\"class\":" + q(s[0]) + ",\"field\":" + q(s[1]) + ",\"options\":" + js(arr) + "}");
    }
  }
}
