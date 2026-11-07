import java.lang.reflect.*;
import java.util.*;

// Lang keys read by the unchanged 1.7.10 classes. StatCollector (dd) holds its StringTranslate (de) in a static field; this probe replaces
// it with a de whose map answers "<key>" for every key, so every text an unchanged class builds through StatCollector.translateToLocal
// shows the key it asked for and the exact formatting around it. Records:
//  tabs: CreativeTabs.creativeTabArray (abt.a): index, getTabLabel (abt.b) and getTranslatedTabLabel (abt.c, the key GuiContainerCreative
//        passes to I18n for the tab title, the tab hover text and the search tab's per-item tab line);
//  tooltip: ItemFirework.addInformation (acs) and ItemFireworkCharge.addInformation (acr) lines for the fixtures of FireworksProbe, as keys;
//  dyes: ItemDye.field_150923_a (acj.b) names, which acr appends to "item.fireworksCharge." for a colour that is a dye colour.
public class KeyTraceProbe {
  static String q(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static dh compound(Object... kv) {
    dh c = new dh();
    for (int k = 0; k < kv.length; k += 2) {
      String key = (String) kv[k];
      Object v = kv[k + 1];
      if (v instanceof Byte) c.a(key, (byte) (Byte) v);
      else if (v instanceof int[]) c.a(key, (int[]) v);
      else if (v instanceof dy) c.a(key, (dy) v);
    }
    return c;
  }
  static dh explosion(int type, int[] colors, int[] fade, boolean flicker, boolean trail) {
    dh e = new dh();
    e.a("Type", (byte) type);
    e.a("Colors", colors);
    if (fade != null) e.a("FadeColors", fade);
    if (flicker) e.a("Flicker", (byte) 1);
    if (trail) e.a("Trail", (byte) 1);
    return e;
  }
  static dh fireworks(int flight, dh... explosions) {
    dh f = new dh();
    if (flight >= 0) f.a("Flight", (byte) flight);
    dq list = new dq();
    for (dh e : explosions) list.a(e);
    f.a("Explosions", list);
    dh root = new dh();
    root.a("Fireworks", f);
    return root;
  }
  static add fromNbt(int id, dh tag) { add s = new add(adb.d(id), 1, 0); s.d = tag; return s; }
  static void tooltip(String name, add s) {
    List<String> lines = new ArrayList<>();
    s.b().a(s, null, lines, false);
    StringBuilder out = new StringBuilder("[");
    for (int k = 0; k < lines.size(); k++) out.append(k > 0 ? "," : "").append(q(lines.get(k).replace("§", "&")));
    System.out.println("{\"case\":\"tooltip\",\"name\":" + q(name) + ",\"lines\":" + out + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    de rec = new de();
    Field map = de.class.getDeclaredField("d");
    map.setAccessible(true);
    map.set(rec, new HashMap<String, String>() { public String get(Object k) { return "<" + k + ">"; } });
    Field a = dd.class.getDeclaredField("a");
    a.setAccessible(true);
    a.set(null, rec);

    for (int i = 0; i < abt.a.length; i++) {
      abt t = abt.a[i];
      System.out.println("{\"case\":\"tab\",\"index\":" + i + ",\"label\":" + q(t.b()) + ",\"key\":" + q(t.c()) + "}");
    }
    int[] red = { 0xB3312C }, blue = { 3949738 }, three = { 0xB3312C, 0x3B511A, 0x253192 }, custom = { 0x123456 };
    tooltip("star-small", fromNbt(402, compound("Explosion", explosion(0, red, null, false, false))));
    tooltip("star-large-fade", fromNbt(402, compound("Explosion", explosion(1, blue, new int[] { 0xB3312C, 0x123456 }, true, true))));
    tooltip("star-star-multi", fromNbt(402, compound("Explosion", explosion(2, three, null, true, false))));
    tooltip("star-creeper-trail", fromNbt(402, compound("Explosion", explosion(3, custom, null, false, true))));
    tooltip("star-burst", fromNbt(402, compound("Explosion", explosion(4, red, null, false, false))));
    tooltip("star-unknown-type", fromNbt(402, compound("Explosion", explosion(9, red, null, false, false))));
    tooltip("star-no-colors", fromNbt(402, compound("Explosion", compound("Type", (byte) 1))));
    tooltip("star-bare", new add(adb.d(402), 1, 0));
    tooltip("rocket-bare", new add(adb.d(401), 1, 0));
    tooltip("rocket-flight-2", fromNbt(401, fireworks(2)));
    tooltip("rocket-one", fromNbt(401, fireworks(1, explosion(1, red, null, false, false))));
    tooltip("rocket-two", fromNbt(401, fireworks(3, explosion(0, red, new int[] { 3949738 }, false, true), explosion(4, three, null, true, false))));
    // One star per dye colour, to read each colour's key.
    int[] dyes = { 1973019, 11743532, 3887386, 5320730, 2437522, 8073150, 2651799, 11250603, 4408131, 14188952, 4312372, 14602026, 6719955, 12801229, 15435844, 15790320 };
    for (int d = 0; d < 16; d++) tooltip("dye-" + d, fromNbt(402, compound("Explosion", explosion(0, new int[] { dyes[d] }, null, false, false))));
  }
}
