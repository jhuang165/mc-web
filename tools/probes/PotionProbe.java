import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Runs the unchanged PotionHelper (aen), Potion (rv), PotionEffect (rw), ItemPotion (adp) and TileEntityBrewingStand (aov)
// of the 1.7.10 JAR. Prints one JSON object per line: potions (all 24 Potion types), table (requirement/amplifier maps and
// the ingredient strings), damage (all 32768 potion damage values: effects, colour, prefix, name, splash, instant, tooltip as
// digests plus samples), ingredients (every item whose isPotionIngredient is true), apply (applyIngredient for every
// ingredient string x every damage value as a digest plus samples), brew (canBrew/brewPotions on seeded bottle layouts),
// tile (slot/side facts). Nothing is patched.
public class PotionProbe {
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String hex(byte[] d) { StringBuilder s = new StringBuilder(); for (byte b : d) s.append(String.format("%02x", b)); return s.toString(); }
  static String eff(List<rw> list) {
    if (list == null) return "";
    StringBuilder e = new StringBuilder();
    for (rw r : list) e.append(e.length() > 0 ? ";" : "").append(r.a()).append(":").append(r.b()).append(":").append(r.c());
    return e.toString();
  }
  static Object get(Class<?> c, Object o, String n) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); return f.get(o); }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    // Potion types
    StringBuilder pots = new StringBuilder();
    for (int id = 1; id < rv.a.length; id++) {
      rv p = rv.a[id];
      if (p == null) continue;
      StringBuilder mods = new StringBuilder();
      Map<th, tj> map = (Map<th, tj>) p.k();
      for (Map.Entry<th, tj> en : map.entrySet()) {
        tj mod = en.getValue();
        mods.append(mods.length() > 0 ? "," : "").append("{\"attribute\":").append(q(en.getKey().a())).append(",\"uuid\":").append(q(mod.a().toString())).append(",\"base\":").append(mod.d()).append(",\"operation\":").append(mod.c()).append(",\"amounts\":[");
        for (int amp = 0; amp < 4; amp++) mods.append(amp > 0 ? "," : "").append(p.a(amp, mod));
        mods.append("]}");
      }
      pots.append(pots.length() > 0 ? "," : "").append("{\"id\":").append(p.H).append(",\"name\":").append(q(p.a())).append(",\"color\":").append(p.j())
        .append(",\"instant\":").append(p.b()).append(",\"bad\":").append(p.f()).append(",\"effectiveness\":").append(p.g()).append(",\"hasIcon\":").append(p.d()).append(",\"icon\":").append(p.e()).append(",\"modifiers\":[").append(mods).append("]}");
    }
    System.out.println("{\"case\":\"potions\",\"types\":[" + pots + "]}");
    // PotionHelper tables
    Field n = aen.class.getDeclaredField("n"), o = aen.class.getDeclaredField("o");
    n.setAccessible(true); o.setAccessible(true);
    StringBuilder req = new StringBuilder(), amps = new StringBuilder(), cons = new StringBuilder();
    for (Map.Entry<Integer, String> en : new TreeMap<>((Map<Integer, String>) n.get(null)).entrySet()) req.append(req.length() > 0 ? "," : "").append("\"").append(en.getKey()).append("\":").append(q(en.getValue()));
    for (Map.Entry<Integer, String> en : new TreeMap<>((Map<Integer, String>) o.get(null)).entrySet()) amps.append(amps.length() > 0 ? "," : "").append("\"").append(en.getKey()).append("\":").append(q(en.getValue()));
    for (char c = 'a'; c <= 'm'; c++) cons.append(cons.length() > 0 ? "," : "").append("\"").append(c).append("\":").append(q((String) aen.class.getField(String.valueOf(c)).get(null)));
    String[] prefixes = (String[]) get(aen.class, null, "q");
    StringBuilder pre = new StringBuilder();
    for (String s : prefixes) pre.append(pre.length() > 0 ? "," : "").append(q(s));
    // English strings (assets/minecraft/lang/en_US.lang through StringTranslate dd.a)
    StringBuilder lang = new StringBuilder();
    List<String> keys = new ArrayList<>(Arrays.asList(prefixes));
    for (int id = 1; id < rv.a.length; id++) if (rv.a[id] != null) { keys.add(rv.a[id].a()); keys.add(rv.a[id].a() + ".postfix"); }
    keys.addAll(Arrays.asList("potion.prefix.grenade", "potion.potency.0", "potion.potency.1", "potion.potency.2", "potion.potency.3", "potion.empty", "item.emptyPotion.name", "item.potion.name", "potion.effects.whenDrank",
      "attribute.modifier.plus.0", "attribute.modifier.plus.1", "attribute.modifier.plus.2", "attribute.modifier.take.0", "attribute.modifier.take.1", "attribute.modifier.take.2",
      "attribute.name.generic.movementSpeed", "attribute.name.generic.maxHealth", "attribute.name.generic.attackDamage", "item.glassBottle.name", "tile.brewingStand.name", "item.brewingStand.name", "container.brewing"));
    for (String k : keys) lang.append(lang.length() > 0 ? "," : "").append(q(k)).append(":").append(q(dd.a(k)));
    System.out.println("{\"case\":\"table\",\"lang\":{" + lang + "},\"requirements\":{" + req + "},\"amplifiers\":{" + amps + "},\"strings\":{" + cons + "},\"prefixes\":[" + pre + "],\"defaultColor\":" + aen.a(0, false) + "}");
    // All damage values
    java.security.MessageDigest dc = java.security.MessageDigest.getInstance("SHA-256"), de = java.security.MessageDigest.getInstance("SHA-256"),
      dp = java.security.MessageDigest.getInstance("SHA-256"), dn = java.security.MessageDigest.getInstance("SHA-256"),
      dt = java.security.MessageDigest.getInstance("SHA-256"), df = java.security.MessageDigest.getInstance("SHA-256");
    int[] sample = {0, 1, 2, 3, 7, 8, 15, 16, 32, 64, 8193, 8194, 8195, 8196, 8197, 8198, 8200, 8201, 8202, 8204, 8205, 8206, 8225, 8226, 8228, 8229, 8232, 8233, 8235, 8236, 8237, 8238, 8257, 8258, 8259, 8260, 8261, 8264, 8265, 8266, 8270, 8289, 8290, 8292, 8296, 8297, 8298, 8299, 8300, 8301, 16274, 16307, 16341, 16385, 16386, 16389, 16392, 16393, 16394, 16396, 16398, 16417, 16418, 16420, 16421, 16424, 16425, 16427, 16428, 16429, 16430, 16449, 16450, 16451, 16452, 16453, 16456, 16457, 16458, 16462, 32660, 32696, 32698, 32732, 32767, 24000, 12345};
    Set<Integer> wanted = new HashSet<>();
    for (int s : sample) wanted.add(s);
    StringBuilder samples = new StringBuilder();
    int nonEmpty = 0, splash = 0, instant = 0;
    adp potion = ade.bn;
    for (int meta = 0; meta < 32768; meta++) {
      int color = aen.a(meta, false), colorTrue = aen.a(meta, true);
      List<rw> list = aen.b(meta, false);
      String e = eff(list), prefix = aen.c(meta);
      add stack = new add(potion, 1, meta);
      String name = potion.n(stack);
      boolean sp = adp.g(meta), inst = potion.i(meta);
      List<String> tip = new ArrayList<>();
      potion.a(stack, null, tip, false);
      String tips = String.join("|", tip);
      dc.update((meta + "=" + color + "/" + colorTrue + "\n").getBytes());
      de.update((meta + "=" + e + "\n").getBytes());
      dp.update((meta + "=" + prefix + "\n").getBytes());
      dn.update((meta + "=" + name + "\n").getBytes());
      dt.update((meta + "=" + tips + "\n").getBytes("UTF-8"));
      df.update((meta + "=" + sp + "/" + inst + "\n").getBytes());
      if (list != null) nonEmpty++;
      if (sp) splash++;
      if (inst) instant++;
      if (wanted.contains(meta)) samples.append(samples.length() > 0 ? "," : "").append("{\"damage\":").append(meta).append(",\"color\":").append(color).append(",\"effects\":").append(q(e)).append(",\"prefix\":").append(q(prefix))
        .append(",\"name\":").append(q(name)).append(",\"splash\":").append(sp).append(",\"instant\":").append(inst).append(",\"tooltip\":").append(q(tips)).append("}");
    }
    System.out.println("{\"case\":\"damage\",\"count\":32768,\"nonEmpty\":" + nonEmpty + ",\"splash\":" + splash + ",\"instant\":" + instant
      + ",\"colorSha256\":\"" + hex(dc.digest()) + "\",\"effectSha256\":\"" + hex(de.digest()) + "\",\"prefixSha256\":\"" + hex(dp.digest()) + "\",\"nameSha256\":\"" + hex(dn.digest())
      + "\",\"tooltipSha256\":\"" + hex(dt.digest()) + "\",\"flagSha256\":\"" + hex(df.digest()) + "\",\"samples\":[" + samples + "],\"emptyName\":" + q(potion.n(new add(potion, 1, 0))) + "}");
    // Ingredients
    StringBuilder ing = new StringBuilder();
    List<String> strings = new ArrayList<>();
    List<int[]> ingredientItems = new ArrayList<>();
    for (int id = 256; id < 4096; id++) {
      adb item = adb.d(id);
      if (item == null) continue;
      int[] dmgs = id == 349 ? new int[]{0, 1, 2, 3} : new int[]{0};
      for (int d : dmgs) {
        add st = new add(item, 1, d);
        if (item.m(st)) {
          ing.append(ing.length() > 0 ? "," : "").append("{\"id\":").append(id).append(",\"damage\":").append(d).append(",\"effect\":").append(q(item.i(st))).append("}");
          strings.add(item.i(st));
          ingredientItems.add(new int[]{id, d});
        }
      }
    }
    System.out.println("{\"case\":\"ingredients\",\"items\":[" + ing + "]}");
    // applyIngredient over every ingredient string x every damage value
    StringBuilder ap = new StringBuilder();
    for (int k = 0; k < strings.size(); k++) {
      java.security.MessageDigest da = java.security.MessageDigest.getInstance("SHA-256");
      StringBuilder sm = new StringBuilder();
      int[] sampleApply = {0, 1, 7, 8, 16, 64, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8200, 8201, 8202, 8204, 8205, 8206, 8225, 8226, 8228, 8229, 8232, 8233, 8235, 8236, 8237, 8238, 8257, 8258, 8259, 8260, 8261, 8264, 8265, 8266, 8270, 16385, 16386, 16389, 16392, 16393, 16394, 16396, 16398, 16417, 16418, 16420, 16421, 16424, 16425, 16427, 16428, 16429, 16430, 16449, 16450, 16451, 16452, 16453, 16456, 16457, 16458, 16462, 8195, 8201, 12345, 20000};
      for (int meta = 0; meta < 32768; meta++) {
        int r = aen.a(meta, strings.get(k));
        da.update((meta + ">" + r + "\n").getBytes());
      }
      for (int meta : sampleApply) sm.append(sm.length() > 0 ? "," : "").append("[").append(meta).append(",").append(aen.a(meta, strings.get(k))).append("]");
      ap.append(ap.length() > 0 ? "," : "").append("{\"effect\":").append(q(strings.get(k))).append(",\"sha256\":\"").append(hex(da.digest())).append("\",\"samples\":[").append(sm).append("]}");
    }
    System.out.println("{\"case\":\"apply\",\"rows\":[" + ap + "]}");
    // Brewing stand tile: canBrew / brewPotions on constructor-less instances
    java.lang.reflect.Constructor<?>[] cs = aov.class.getDeclaredConstructors();
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true);
    sun.misc.Unsafe u = (sun.misc.Unsafe) uf.get(null);
    Method canBrew = aov.class.getDeclaredMethod("k"), brew = aov.class.getDeclaredMethod("l"), bits = aov.class.getDeclaredMethod("j");
    canBrew.setAccessible(true); brew.setAccessible(true); bits.setAccessible(true);
    Field slots = aov.class.getDeclaredField("j"); slots.setAccessible(true);
    Random rnd = new Random(1710);
    int[] meta0 = {0, 16, 8192, 8193, 8194, 8197, 8200, 8201, 8202, 8204, 8206, 8225, 8226, 8228, 8229, 8232, 8233, 8235, 8236, 8237, 8238, 8257, 8258, 8260, 8261, 8264, 8265, 8266, 8270, 16385, 16386, 16389, 16393, 16394, 16396, 16421, 16456, 16457, 16458, 16462};
    List<int[]> ingStacks = ingredientItems;
    StringBuilder brews = new StringBuilder();
    java.security.MessageDigest db = java.security.MessageDigest.getInstance("SHA-256");
    int cases = 0;
    for (int[] it : ingStacks) {
      for (int rep = 0; rep < 60; rep++) {
        aov t = (aov) u.allocateInstance(aov.class);
        add[] s = new add[4];
        int count = 1 + rnd.nextInt(3);
        StringBuilder in = new StringBuilder();
        for (int k = 0; k < 3; k++) {
          int c = rnd.nextInt(8);
          if (c == 0) { in.append(k > 0 ? ";" : "").append("-"); continue; }
          if (c == 1) { s[k] = new add(adb.d(374), 1, 0); in.append(k > 0 ? ";" : "").append("b"); continue; }
          int m = meta0[rnd.nextInt(meta0.length)];
          if (rnd.nextInt(5) == 0) m = rnd.nextInt(32768);
          s[k] = new add(ade.bn, 1, m);
          in.append(k > 0 ? ";" : "").append(m);
        }
        s[3] = new add(adb.d(it[0]), 1 + rnd.nextInt(3), it[1]);
        slots.set(t, s);
        boolean can = (Boolean) canBrew.invoke(t);
        int before = (Integer) bits.invoke(t);
        brew.invoke(t);
        StringBuilder out = new StringBuilder();
        for (int k = 0; k < 4; k++) out.append(k > 0 ? ";" : "").append(s[k] == null ? "-" : s[k].b() == ade.bn ? "p" + s[k].k() : "i" + adb.b(s[k].b()) + ":" + s[k].k() + "x" + s[k].b);
        String line = it[0] + ":" + it[1] + "|" + in + "|" + can + "|" + before + "|" + out;
        db.update((line + "\n").getBytes());
        brews.append(brews.length() > 0 ? "," : "").append(q(line));
        cases++;
      }
    }
    // Empty ingredient slot and non-ingredient stack
    System.out.println("{\"case\":\"brew\",\"cases\":" + cases + ",\"sha256\":\"" + hex(db.digest()) + "\",\"samples\":[" + brews + "]}");
    // Tile facts
    aov t = (aov) u.allocateInstance(aov.class);
    add[] s = new add[4];
    slots.set(t, s);
    StringBuilder valid = new StringBuilder();
    int[] testIds = {373, 374, 331, 348, 289, 372, 1, 276, 0};
    for (int slot = 0; slot < 4; slot++) for (int id : testIds) {
      adb item = id == 0 ? null : adb.d(id);
      if (item == null) continue;
      add st = new add(item, 1, 0);
      valid.append(valid.length() > 0 ? "," : "").append("[").append(slot).append(",").append(id).append(",").append(t.b(slot, st)).append(",").append(t.a(slot, st, 1)).append(",").append(t.a(slot, st, 0)).append(",").append(t.b(slot, st, 0)).append("]");
    }
    StringBuilder sides = new StringBuilder();
    for (int sd = 0; sd < 6; sd++) sides.append(sides.length() > 0 ? "," : "").append(Arrays.toString(t.c(sd)));
    System.out.println("{\"case\":\"tile\",\"size\":" + t.a() + ",\"limit\":" + t.d() + ",\"valid\":[" + valid + "],\"sides\":[" + sides + "],\"potionMaxStack\":" + ade.bn.m() + ",\"bottleId\":" + adb.b(adb.d(374)) + ",\"potionId\":" + adb.b(ade.bn) + "}");
  }
}
