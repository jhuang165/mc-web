// Batch 57 (itemtags). The unchanged 1.7.10 ItemStack (add), ItemPotion (adp), ItemSkull, EntityPotion (zo) and Potion (rv) classes.
//   tag     stacks carrying display.Lore, SkullOwner, CustomPotionEffects and map_is_scaling (some malformed on purpose): ItemStack.getDisplayName (s),
//           getTooltip (a(player, advanced), a null player), ItemPotion.getEffects(stack) (adp.g), hasEffect (adp.e / add.p), writeToNBT toString.
//           The tag is recorded as a descriptor (["b",1] byte, ["s",".."] string, ["i",n] int, ["l",[..]] list, ["c",{..}] compound) the replay rebuilds.
//   splash  the real EntityPotion.onImpact (zo.a(azu)) in a world whose entity query lists doubled mobs: instant health / harm at amplifiers 0..3
//           (from a CustomPotionEffects stack and from real potion damages), timed effects, several offsets from the impact, a direct hit, undead kinds.
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

public class ItemTagsProbe {
  static String json(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }

  // ---- tag builders: the NBT value and its descriptor
  static class N {
    dy v; String d;
    N(dy v, String d) { this.v = v; this.d = d; }
  }
  static N b(int x) { return new N(new dg((byte) x), "[\"b\"," + x + "]"); }
  static N sh(int x) { return new N(new dw((short) x), "[\"h\"," + x + "]"); }
  static N i(int x) { return new N(new dp(x), "[\"i\"," + x + "]"); }
  static N s(String x) { return new N(new dx(x), "[\"s\"," + json(x) + "]"); }
  static N l(N... items) {
    dq q = new dq();
    StringBuilder d = new StringBuilder("[\"l\",[");
    for (int k = 0; k < items.length; k++) { q.a(items[k].v); d.append(k == 0 ? "" : ",").append(items[k].d); }
    return new N(q, d.append("]]").toString());
  }
  static N c(Object... kv) {
    dh t = new dh();
    StringBuilder d = new StringBuilder("[\"c\",{");
    for (int k = 0; k < kv.length; k += 2) { t.a((String) kv[k], ((N) kv[k + 1]).v); d.append(k == 0 ? "" : ",").append(json((String) kv[k])).append(":").append(((N) kv[k + 1]).d); }
    return new N(t, d.append("}]").toString());
  }
  static N effect(int id, int amp, int dur, int ambient) { return c("Id", b(id), "Amplifier", b(amp), "Duration", i(dur), "Ambient", b(ambient)); }

  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int k = 0; k < l.size(); k++) s.append(k == 0 ? "" : ",").append(json(l.get(k)));
    return s.append("]").toString();
  }
  static String effectRows(List l) {
    if (l == null) return "null";
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (Object o : l) {
      rw p = (rw) o;
      s.append(first ? "" : ",").append("[").append(p.a()).append(",").append(p.c()).append(",").append(p.b()).append(",").append(p.e() ? 1 : 0).append("]");
      first = false;
    }
    return s.append("]").toString();
  }
  static String err(Throwable x) { Throwable c = x.getCause() != null ? x.getCause() : x; return json(c.toString()); }

  static void tag(String name, int id, int damage, N tag, String display) {
    StringBuilder out = new StringBuilder("{\"name\":" + json(name) + ",\"id\":" + id + ",\"damage\":" + damage + ",\"tag\":" + (tag == null ? "null" : tag.d));
    try {
      add st = new add(adb.d(id), 1, damage);
      if (tag != null) st.d((dh) tag.v);
      if (display != null) st.c(display);
      String shown = st.s();
      out.append(",\"display\":").append(json(shown));
      if (id != 358) try { String t0 = strings(st.a((yz) null, false)); out.append(",\"tooltip\":").append(t0); } catch (Throwable x) { out.append(",\"tooltipError\":").append(err(x)); }
      if (id != 358) try { String t1 = strings(st.a((yz) null, true)); out.append(",\"tooltipAdvanced\":").append(t1); } catch (Throwable x) { out.append(",\"tooltipAdvancedError\":").append(err(x)); }
            out.append(",\"nbt\":").append(json(st.b(new dh()).toString()));
      if (id == 373) {
        out.append(",\"effects\":").append(effectRows(((adp) adb.d(373)).g(st)));
        out.append(",\"hasEffect\":").append(adb.d(373).e(st)).append(",\"color\":").append(adb.d(373).a(st, 0));
      }
    } catch (Throwable x) { out.append(",\"error\":").append(err(x)); }
    System.out.println("{\"tag\":\"b57tag\",\"row\":" + out.append("}") + "}");
  }

  static void tags() {
    N lore = l(s("First line"), s("§bblue second"), s(""));
    tag("loreSword", 276, 0, c("display", c("Lore", lore)), null);
    tag("loreNamed", 276, 0, c("display", c("Name", s("Sting"), "Lore", l(s("a")))), null);
    tag("loreEnch", 276, 12, c("ench", l(c("id", sh(16), "lvl", sh(2))), "display", c("Lore", l(s("x"), s("y")))), null);
    tag("loreColor", 298, 0, c("display", c("color", i(255), "Lore", l(s("dyed lore")))), null);
    tag("loreEmpty", 276, 0, c("display", c("Lore", l())), null);
    tag("loreInts", 276, 0, c("display", c("Lore", l(i(1), i(2)))), null);
    tag("loreString", 276, 0, c("display", c("Lore", s("not a list"))), null);
    tag("loreTopLevel", 276, 0, c("Lore", l(s("outside display"))), null);
    tag("loreBook", 387, 0, c("pages", l(s("p")), "author", s("A"), "title", s("T"), "display", c("Lore", l(s("book lore")))), null);
    tag("loreNameTag", 421, 0, c("display", c("Lore", l(s("tagged")))), "Fido");
    tag("skullOwner", 397, 3, c("SkullOwner", s("Notch")), null);
    tag("skullOwnerCompound", 397, 3, c("SkullOwner", c("Name", s("jeb_"))), null);
    tag("skullOwnerCompoundNoName", 397, 3, c("SkullOwner", c("Other", s("x"))), null);
    tag("skullOwnerNamed", 397, 3, c("SkullOwner", s("Notch")), "Trophy");
    tag("skullOwnerWither", 397, 1, c("SkullOwner", s("Notch")), null);
    tag("skullOwnerInt", 397, 3, c("SkullOwner", i(5)), null);
    tag("skullOwnerEmpty", 397, 3, c("SkullOwner", s("")), null);
    tag("skullOwnerLore", 397, 3, c("SkullOwner", s("Dinnerbone"), "display", c("Lore", l(s("owned")))), null);
    tag("skullPlain", 397, 3, null, null);
    N spd = effect(1, 1, 1800, 0), psn = effect(19, 0, 900, 1);
    tag("customStrength", 373, 8201, c("CustomPotionEffects", l(effect(5, 2, 3600, 0))), null);
    tag("customReplaces", 373, 8193, c("CustomPotionEffects", l(spd, psn)), null);
    tag("customWater", 373, 0, c("CustomPotionEffects", l(spd)), null);
    tag("customAwkward", 373, 16, c("CustomPotionEffects", l(effect(3, 0, 600, 0))), null);
    tag("customSplash", 373, 16384, c("CustomPotionEffects", l(effect(7, 1, 1, 0))), null);
    tag("customSplashPlain", 373, 16421, c("CustomPotionEffects", l(effect(10, 0, 1200, 0))), null);
    tag("customEmptyList", 373, 8193, c("CustomPotionEffects", l()), null);
    tag("customBadId", 373, 8193, c("CustomPotionEffects", l(effect(0, 0, 100, 0), effect(99, 0, 100, 0), effect(-1, 0, 100, 0), effect(8, 3, 400, 0))), null);
    tag("customAllBad", 373, 8193, c("CustomPotionEffects", l(effect(0, 0, 100, 0))), null);
    tag("customDupes", 373, 8193, c("CustomPotionEffects", l(effect(1, 0, 100, 0), effect(1, 2, 200, 0))), null);
    tag("customShortDurations", 373, 8193, c("CustomPotionEffects", l(effect(1, 0, 20, 0), effect(2, 0, 21, 0), effect(3, 0, 0, 0), effect(4, 0, -5, 0))), null);
    tag("customAmplifiers", 373, 8193, c("CustomPotionEffects", l(effect(1, 3, 600, 0), effect(2, 4, 600, 0), effect(3, 126, 600, 0), effect(4, -1, 600, 0))), null);
    tag("customInstant", 373, 8193, c("CustomPotionEffects", l(effect(6, 0, 1, 0), effect(7, 3, 1, 0))), null);
    tag("customModifiers", 373, 8193, c("CustomPotionEffects", l(effect(1, 0, 1200, 0), effect(5, 1, 1200, 0), effect(18, 0, 1200, 0), effect(21, 2, 1200, 0), effect(22, 0, 1200, 0))), null);
    tag("customIntList", 373, 8193, c("CustomPotionEffects", l(i(1))), null);
    tag("customString", 373, 8193, c("CustomPotionEffects", s("x")), null);
    tag("customMissingFields", 373, 8193, c("CustomPotionEffects", l(c("Id", b(1)))), null);
    tag("customWideTypes", 373, 8193, c("CustomPotionEffects", l(c("Id", i(5), "Amplifier", sh(1), "Duration", b(100)))), null);
    tag("customNamed", 373, 8193, c("CustomPotionEffects", l(spd), "display", c("Name", s("Elixir"), "Lore", l(s("brewed")))), null);
    tag("customOnSword", 276, 0, c("CustomPotionEffects", l(spd)), null);
    tag("plainSplash", 373, 16421, null, null);
    tag("plainDrink", 373, 8193, null, null);
    tag("mapPlain", 358, 5, null, null);
    tag("mapScaling", 358, 5, c("map_is_scaling", b(1)), null);
    tag("mapScalingZero", 358, 5, c("map_is_scaling", b(0)), null);
    tag("mapNamed", 358, 5, null, "Treasure");
    tag("mapScalingNamed", 358, 12, c("map_is_scaling", b(1)), "Atlas");
    tag("mapScalingLore", 358, 7, c("map_is_scaling", b(1), "display", c("Lore", l(s("zoomed")))), null);
    tag("emptyMapLore", 395, 0, c("display", c("Lore", l(s("blank")))), null);
  }

  // ---- splash
  static sun.misc.Unsafe u;
  static class SW extends HorseProbe.World {
    List<sa> ents = new ArrayList<>();
    public void c(int a, int b, int c, int d, int e) {}
    public List a(Class c, azt box) {
      List out = new ArrayList();
      for (sa o : ents) if (c.isInstance(o) && !o.K && o.C.b(box)) out.add(o);
      return out;
    }
  }
  static SW W;
  static Method SETPOS;
  static Field MAP;
  static sa make(String kind) throws Exception {
    sa m = sg.a(kind, W);
    if (m == null) throw new IllegalStateException("no mob " + kind);
    return m;
  }
  static void place(sa m, double x, double y, double z) throws Exception { SETPOS.invoke(m, x, y, z); }
  static String num(double d) { return Double.toString(d); }
  static String effectsOf(sa m) throws Exception {
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (Object o : ((HashMap) MAP.get(m)).values()) {
      rw p = (rw) o;
      s.append(first ? "" : ",").append("[").append(p.a()).append(",").append(p.c()).append(",").append(p.b()).append(",").append(p.e() ? 1 : 0).append("]");
      first = false;
    }
    return s.append("]").toString();
  }

  static final String[] KINDS = { "Pig", "Zombie", "Skeleton", "Spider", "CaveSpider", "Villager", "PigZombie", "WitherBoss" };
  // One throw: `stack` (potion stack), impact at (0, 64, 0), every kind at impact + (dx, dy, dz), `health` set first (clamped to the kind's maximum),
  // `direct` the index of the kind the projectile hit (-1 none), `thrower` a living thrower far away (or none).
  static void splash(String name, add stack, double dx, double dy, double dz, float health, int direct, boolean thrower) throws Exception {
    W.ents.clear();
    List<sa> mobs = new ArrayList<>();
    for (String k : KINDS) {
      sa m = make(k);
      place(m, dx, 64.0 + dy, dz);
      ((sv) m).g(health);
      W.ents.add(m);
      mobs.add(m);
    }
    StringBuilder out = new StringBuilder("{\"tag\":\"b57splash\",\"name\":" + json(name) + ",\"damage\":" + stack.k() + ",\"stack\":" + json(stack.b(new dh()).toString())
      + ",\"effects\":" + effectRows(((adp) adb.d(373)).g(stack)) + ",\"offset\":[" + num(dx) + "," + num(dy) + "," + num(dz) + "],\"health\":" + health + ",\"direct\":" + direct + ",\"thrower\":" + thrower + ",\"targets\":[");
    String error = "null";
    try {
      sa th = null;
      if (thrower) { th = make("Zombie"); place(th, 60, 64, 60); W.ents.add(th); }
      zo p = thrower ? new zo(W, (sv) th, stack) : new zo(W, 0.0, 64.0, 0.0, stack);
      place(p, 0.0, 64.0, 0.0);
      for (sa m : mobs) { ((sv) m).g(health); }
      azu hit = direct >= 0 ? new azu(mobs.get(direct)) : new azu(0, 64, 0, 0, azw.a(0.0, 64.0, 0.0));
      if (direct < 0) hit.g = null;
      Method on = zo.class.getDeclaredMethod("a", azu.class);
      on.setAccessible(true);
      on.invoke(p, hit);
      out.append("");
    } catch (Throwable x) { error = err(x); }
    for (int k = 0; k < mobs.size(); k++) {
      sv m = (sv) mobs.get(k);
      out.append(k == 0 ? "" : ",").append("{\"kind\":\"").append(KINDS[k]).append("\",\"x\":").append(num(m.s)).append(",\"y\":").append(num(m.t)).append(",\"z\":").append(num(m.u))
        .append(",\"width\":").append(m.M).append(",\"height\":").append(m.N).append(",\"undead\":").append(m.aR()).append(",\"health\":").append(m.aS()).append(",\"dead\":").append(m.K).append(",\"effects\":").append(effectsOf(m)).append("}");
    }
    System.out.println(out.append("],\"error\":" + error + "}"));
  }

  static add potion(int damage, N tag) {
    add st = new add(adb.d(373), 1, damage);
    if (tag != null) st.d((dh) tag.v);
    return st;
  }

  static void splashes() throws Exception {
    double[][] offsets = { { 0, 0, 0 }, { 1, 0, 0 }, { 2, 0, 1 }, { 3, 0, 0 }, { 3.5, 0, 1.5 }, { 0, -1.5, 0 }, { 1, 1, 1 }, { 3.9, 0, 0 }, { 4.5, 0, 0 } };
    List<Object[]> potions = new ArrayList<>();
    for (int id = 6; id <= 7; id++) for (int amp = 0; amp <= 3; amp++)
      potions.add(new Object[] { (id == 6 ? "customHeal" : "customHarm") + amp, potion(16384, c("CustomPotionEffects", l(effect(id, amp, 1, 0)))), id == 6 ? 1f : 20f });
    for (int d : new int[] { 16421, 16453, 16396, 16460, 16388, 16418, 16420 }) potions.add(new Object[] { "damage" + d, potion(d, null), (d == 16421 || d == 16453) ? 1f : 20f });
    potions.add(new Object[] { "customTimed", potion(16384, c("CustomPotionEffects", l(effect(19, 0, 900, 0), effect(10, 1, 600, 0), effect(2, 0, 40, 0), effect(2, 1, 43, 0), effect(9, 0, 200, 1)))), 20f });
    potions.add(new Object[] { "customMixed", potion(16384, c("CustomPotionEffects", l(effect(6, 1, 1, 0), effect(7, 0, 1, 0), effect(19, 0, 900, 0)))), 6f });
    potions.add(new Object[] { "customEmpty", potion(16384, c("CustomPotionEffects", l())), 20f });
    potions.add(new Object[] { "customOverrides", potion(16396, c("CustomPotionEffects", l(effect(6, 0, 1, 0)))), 3f });
    for (Object[] p : potions)
      for (double[] o : offsets) {
        splash((String) p[0], (add) p[1], o[0], o[1], o[2], (Float) p[2], -1, false);
        if (o[0] <= 3.5) splash((String) p[0], (add) p[1], o[0], o[1], o[2], (Float) p[2], 1, false);
      }
    // a living thrower: Potion.affectEntity takes the indirect-magic path
    for (Object[] p : potions) { splash((String) p[0], (add) p[1], 1, 0, 0, (Float) p[2], -1, true); splash((String) p[0], (add) p[1], 0, 0, 0, (Float) p[2], 1, true); }
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    u = MobMoveProbe.unsafe();
    tags();
    SW world = (SW) u.allocateInstance(SW.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(world, info);
    world.ents = new ArrayList<>();
    W = world;
    HorseProbe.W = world;
    MAP = MobMoveProbe.field(sv.class, "f");
    SETPOS = MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class);
    splashes();
  }
}
