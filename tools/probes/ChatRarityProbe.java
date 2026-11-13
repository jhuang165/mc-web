// b55cr. Runs the unchanged 1.7.10 ItemStack (add) func_151000_E (E) and getRarity (w, Item.getRarity -> adq EnumRarity) for every registered item in a
// plain, an enchanted (ench tag) and a stored-enchantments variant. Rarity rows are per item id: [id, rarity at damage 0, [[damage, rarity] where it
// differs from damage 0 over 0..299 and the potion/spawn-egg style damages]] for each variant. Component rows are [name, fk.a JSON, getFormattedText,
// getUnformattedText] of E() for named stacks (so no lang lookup is needed). EnumRarity (adq): a common/white, b uncommon/yellow, c rare/aqua, d epic/light purple.
import java.util.*;
public class ChatRarityProbe {
  static String json(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static dq list(int id, int lvl) { dq l = new dq(); dh t = new dh(); t.a("id", (short) id); t.a("lvl", (short) lvl); l.a(t); return l; }
  static add make(adb item, int damage, int variant) {
    add s = new add(item, 1, damage);
    if (variant == 1 || variant == 2) {
      s.d(new dh());
      s.q().a(variant == 1 ? "ench" : "StoredEnchantments", list(16, 1));
    }
    return s;
  }
  // b56nbt rows: the port's tag fields (ench, StoredEnchantments, RepairCost, display Name/color, Unbreakable, Explosion, Fireworks, pages, author, title)
  // written into real dh/dq tags, and ItemStack.b(dh) (writeToNBT) toString and E() for the stack.
  static dh explosion(int type, int[] colors, int[] fade, int flicker, int trail) {
    dh e = new dh();
    e.a("Type", (byte) type); e.a("Colors", colors); e.a("FadeColors", fade); e.a("Flicker", (byte) flicker); e.a("Trail", (byte) trail);
    return e;
  }
  static dq strings(String... v) { dq l = new dq(); for (String x : v) l.a(new dx(x)); return l; }
  static String nbtRow(String name, int id, int damage, int count, dh tag, String display) {
    add s = new add(adb.d(id), count, damage);
    if (tag != null) s.d(tag);
    if (display != null) s.c(display);
    fj c = s.E();
    return "[" + json(name) + "," + json(fk.a(c)) + "," + json(c.d()) + "," + json(c.c()) + "," + json(s.w().f) + "," + json(s.b(new dh()).toString()) + "]";
  }
  static List<String> nbtRows() {
    List<String> r = new ArrayList<>();
    dh t = new dh(); t.a("ench", list(16, 1)); t.a("RepairCost", 5); t.a("Unbreakable", (byte) 1);
    r.add(nbtRow("nbtSwordRepair", 276, 12, 1, t, "Sting"));
    t = new dh(); dh d = new dh(); d.a("color", 10511680); t.a("display", d);
    r.add(nbtRow("nbtLeatherColor", 298, 0, 1, t, "Cap"));
    t = new dh(); t.a("pages", strings("a b", "second \"x\"")); t.a("author", "Alex"); t.a("title", "Log");
    r.add(nbtRow("nbtWrittenBook", 387, 0, 1, t, null));
    t = new dh(); t.a("pages", strings());
    r.add(nbtRow("nbtWritableEmpty", 386, 0, 1, t, null));
    t = new dh(); t.a("Explosion", explosion(2, new int[] { 16711680, 255 }, new int[] { 65280 }, 1, 0));
    r.add(nbtRow("nbtStar", 402, 0, 1, t, null));
    t = new dh(); t.a("Explosion", explosion(0, new int[] {}, new int[] {}, 0, 1));
    r.add(nbtRow("nbtStarEmpty", 402, 0, 1, t, "Spark"));
    t = new dh(); dh f = new dh(); f.a("Flight", (byte) 2); dq ex = new dq(); ex.a(explosion(4, new int[] { 1 }, new int[] {}, 1, 1)); ex.a(explosion(1, new int[] { 2, 3 }, new int[] { 4 }, 0, 0)); f.a("Explosions", ex); t.a("Fireworks", f);
    r.add(nbtRow("nbtRocket", 401, 0, 64, t, null));
    t = new dh(); f = new dh(); f.a("Flight", (byte) 1); f.a("Explosions", new dq()); t.a("Fireworks", f);
    r.add(nbtRow("nbtRocketEmpty", 401, 0, 3, t, null));
    t = new dh(); t.a("StoredEnchantments", list(34, 3)); t.a("RepairCost", 7); d = new dh(); d.a("Name", "Tome"); t.a("display", d);
    r.add(nbtRow("nbtBookStored", 403, 0, 1, t, null));
    // Insertion order of the port (ench, StoredEnchantments, RepairCost, display, Explosion/Fireworks, pages, author, title, Unbreakable); a bucket collision keeps it.
    t = new dh(); t.a("ench", list(0, 4)); t.a("RepairCost", 31); d = new dh(); d.a("Name", "All"); d.a("color", 1); t.a("display", d);
    t.a("Explosion", explosion(3, new int[] { 7 }, new int[] { 8 }, 1, 1)); t.a("pages", strings("p")); t.a("author", "A"); t.a("title", "T"); t.a("Unbreakable", (byte) 0);
    r.add(nbtRow("nbtAllKeys", 276, 0, 1, t, null));
    // Raw compounds: every tag type's toString and HashMap order past a resize (13 and 25 keys).
    dh raw = new dh();
    raw.a("b", (byte) -3); raw.a("s", (short) -300); raw.a("i", -70000); raw.a("l", 1L << 40); raw.a("f", 1.5f); raw.a("d", 0.1d); raw.a("str", "hi \"q\"");
    raw.a("ba", new byte[] { 1, 2, 3 }); raw.a("ia", new int[] { 4, -5 }); raw.a("ea", new int[] {});
    dq lf = new dq(); lf.a(new dm(1.0f)); lf.a(new dm(1.0E10f)); raw.a("lf", lf);
    dq ls = strings("x", "y"); raw.a("ls", ls);
    dq lc = new dq(); lc.a(list(1, 2)); raw.a("lc", lc);
    raw.a("fs", 0.001f); raw.a("fbig", 1.0E7f); raw.a("fsmall", 1.0E-4f); raw.a("dbig", 12345678.9d); raw.a("dneg", -2.5d);
    r.add("[\"rawTypes\"," + json(raw.toString()) + "]");
    dh many = new dh(); for (int i = 0; i < 13; i++) many.a("k" + i, i);
    r.add("[\"rawMany13\"," + json(many.toString()) + "]");
    many = new dh(); for (int i = 0; i < 25; i++) many.a("key" + i, (short) i);
    r.add("[\"rawMany25\"," + json(many.toString()) + "]");
    return r;
  }
  static final int[] EXTRA = { 8193, 8225, 8257, 16385, 16417, 16449, 16384, 32767, 32768 };
  static String rarityOf(adb item, int d, int v) { return make(item, d, v).w().f; }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    StringBuilder rar = new StringBuilder();
    for (int id = 0; id < 4096; id++) {
      adb item = adb.d(id);
      if (item == null) continue;
      StringBuilder row = new StringBuilder("[" + id);
      for (int v = 0; v < 3; v++) {
        String base = rarityOf(item, 0, v);
        StringBuilder diff = new StringBuilder();
        List<Integer> ds = new ArrayList<>();
        for (int d = 1; d < 300; d++) ds.add(d);
        for (int d : EXTRA) ds.add(d);
        for (int d : ds) {
          String r;
          try { r = rarityOf(item, d, v); } catch (Throwable t) { r = "err"; }
          if (!r.equals(base)) diff.append(diff.length() > 0 ? "," : "").append("[").append(d).append(",").append(json(r)).append("]");
        }
        row.append(",").append(json(base)).append(",[").append(diff).append("]");
      }
      rar.append(rar.length() > 0 ? "," : "").append(row).append("]");
    }
    // Component rows.
    String[] names = { "namedSword", "namedGoldenAppleEnchanted", "namedEnchantedSword", "namedNetherStar", "namedBeacon", "namedPotion", "namedBook", "namedRecord", "namedExpBottle", "namedFish" };
    int[][] spec = { { 276, 0, 0 }, { 322, 1, 0 }, { 276, 0, 1 }, { 399, 0, 0 }, { 138, 0, 0 }, { 373, 8193, 0 }, { 403, 0, 2 }, { 2256, 0, 0 }, { 384, 0, 0 }, { 349, 0, 0 } };
    StringBuilder rows = new StringBuilder();
    for (int i = 0; i < names.length; i++) {
      adb item = adb.d(spec[i][0]);
      add s = make(item, spec[i][1], spec[i][2]);
      s.c("Sting");
      fj c = s.E();
      rows.append(i > 0 ? "," : "").append("[").append(json(names[i])).append(",").append(json(fk.a(c))).append(",").append(json(c.d())).append(",").append(json(c.c())).append(",").append(json(s.w().f)).append(",").append(json(s.q() == null ? "" : s.q().toString())).append("]");
    }
    String nbt = String.join(",", nbtRows());
    System.out.println("{\"name\":\"rarity\",\"rarity\":[" + rar + "],\"rows\":[" + rows + "],\"nbt\":[" + nbt + "]}");
  }
}
