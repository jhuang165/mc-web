import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Runs the unchanged EntityWitch (yp), EntityMob (yg), EntityLiving (sw), EntityPotion (zo), EntityThrowable (zk),
// ItemPotion (adp), PotionHelper (aen), Potion (rv), PotionEffect (rw), ModelWitch (bim) and the witch's EntityAI*
// classes of the 1.7.10 JAR on a constructor-less World double (DifficultyProbe.World plus an entity list, a block map,
// the real PathFinder and a real EntityPlayer double). Nothing is patched; every Entity.rand that matters is a seeded
// java.util.Random. EntityPotion's own rand is an unseeded Random() created inside the constructor, so a thrown potion's
// gaussian aim error is not reproducible: the witch cases record the deterministic part (potion damage, spawn point) and
// the test checks the motion against the aim within the gaussian bound; the seeded `flight` cases call
// EntityThrowable.setThrowableHeading (zk.c) with a seeded rand exactly as EntityWitch.attackEntityWithRangedAttack does.
// Prints one JSON object per line: facts, tasks, sounds, drops, damage, model, potions, table, items, decide, think,
// flight, splash, drink, throw.
public class WitchProbe {
  static WW w;
  static sun.misc.Unsafe u;
  static List<String> aux = new ArrayList<>(), hitLog = new ArrayList<>(), pathLog = new ArrayList<>();
  static List<sa> bodies = new ArrayList<>();
  static final Map<String, String> NAMES = new HashMap<>();
  static {
    NAMES.put("uf", "EntityAISwimming"); NAMES.put("vd", "EntityAIArrowAttack"); NAMES.put("vc", "EntityAIWander");
    NAMES.put("un", "EntityAIWatchClosest"); NAMES.put("vb", "EntityAILookIdle"); NAMES.put("vn", "EntityAIHurtByTarget");
    NAMES.put("vo", "EntityAINearestAttackableTarget");
  }

  public static class WW extends DifficultyProbe.World {
    static Map<String, int[]> cells = new HashMap<>();
    public aji a(int x, int y, int z) { int[] c = cells.get(x + "," + y + "," + z); return aji.e(c != null ? c[0] : (y < 0 ? 1 : 0)); }
    public int e(int x, int y, int z) { int[] c = cells.get(x + "," + y + "," + z); return c != null ? c[1] : 0; }
    public void c(int id, int x, int y, int z, int data) { aux.add("[" + id + "," + x + "," + y + "," + z + "," + data + "]"); }
    public List b(sa entity, azt box) {
      List out = new ArrayList();
      for (sa o : bodies) if (o != entity && o.C.b(box)) out.add(o);
      return out;
    }
    public List a(Class c, azt box) {
      List out = new ArrayList();
      for (sa o : bodies) if (c.isInstance(o) && o.C.b(box)) out.add(o);
      return out;
    }
    public List a(Class c, azt box, sj selector) {
      List out = new ArrayList();
      Set<sa> all = new LinkedHashSet<>(bodies);
      for (Object o : uncheck(() -> (List) fd(ahb.class, "h").get(this))) all.add((sa) o);
      for (sa o : all) if (c.isInstance(o) && o.C.b(box) && (selector == null || selector.a(o))) out.add(o);
      return out;
    }
    public ayf a(sa e, sa target, float range, boolean a, boolean b, boolean c, boolean d) { return new ayg(this, a, b, c, d).a(e, target, range); }
    public ayf a(sa e, int x, int y, int z, float range, boolean a, boolean b, boolean c, boolean d) { return new ayg(this, a, b, c, d).a(e, x, y, z, range); }
  }

  // A living target that records the hits it takes (amount, damage type, whether the damage entity is the thrower).
  public static class Target extends wo {
    static sa thrower;
    public Target(ahb w) { super(w); }
    public boolean a(ro source, float amount) {
      hitLog.add("[" + (double) amount + ",\"" + source.o + "\"," + (source.j() == thrower) + "," + (source.i() == this) + "," + source.s() + "," + source.e() + "]");
      g(aS() - amount);
      return true;
    }
  }
  public static class Undead extends yq {
    public Undead(ahb w) { super(w); }
    public boolean a(ro source, float amount) { hitLog.add("[" + (double) amount + ",\"" + source.o + "\"," + (source.j() == Target.thrower) + "," + (source.i() == this) + "," + source.s() + "," + source.e() + "]"); g(aS() - amount); return true; }
  }
  public static class Gamer extends DifficultyProbe.Player {
    public float g() { return 1.62f; }
    public boolean a(ro source, float amount) { hitLog.add("[" + (double) amount + ",\"" + source.o + "\"," + (source.j() == Target.thrower) + "," + (source.i() == this) + "," + source.s() + "," + source.e() + "]"); g(aS() - amount); return true; }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }

  static void reset() {
    WW.cells.clear(); aux.clear(); hitLog.clear(); pathLog.clear(); bodies.clear();
    ChickenProbe.World.spawned.clear(); ChickenProbe.World.sounds.clear();
    ((List) uncheck(() -> fd(ahb.class, "h").get(w))).clear();
  }
  interface Thrower<T> { T get() throws Exception; }
  static <T> T uncheck(Thrower<T> t) { try { return t.get(); } catch (Exception e) { throw new RuntimeException(e); } }

  static yp witch(double x, double y, double z, long seed) throws Exception {
    yp e = new yp(w);
    set(e, "Z", new Random(seed));
    for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) set(e, n, 0f); // the constructor rolls rotationYaw from Math.random()
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    return e;
  }
  static Gamer player(double x, double y, double z, boolean creative) throws Exception {
    Gamer p = DifficultyProbe.player(u, Gamer.class);
    p.M = 0.6f; p.N = 1.8f;
    p.b(x, y, z);
    fd(yz.class, "bm").set(p, new yx(p));
    fd(yz.class, "bp").set(p, new zr());
    MobMoveProbe.field(yw.class, "a").setBoolean(p.bE, creative);
    ((List) fd(ahb.class, "h").get(w)).add(p);
    return p;
  }
  static Target pig(double x, double y, double z) throws Exception {
    Target t = new Target(w);
    t.b(x, y, z);
    set(t, "Z", new Random(1));
    bodies.add(t);
    return t;
  }
  static Undead zombie(double x, double y, double z) throws Exception {
    Undead t = new Undead(w);
    t.b(x, y, z);
    set(t, "Z", new Random(1));
    bodies.add(t);
    return t;
  }

  static List<uk> entries(sw e, String field) throws Exception {
    Field c = sw.class.getDeclaredField(field); c.setAccessible(true);
    Field b = uj.class.getDeclaredField("b"); b.setAccessible(true);
    return (List<uk>) b.get(c.get(e));
  }
  static String running(sw e) throws Exception {
    Field c = sw.class.getDeclaredField("c"); c.setAccessible(true);
    Field l = uj.class.getDeclaredField("c"); l.setAccessible(true);
    StringBuilder s = new StringBuilder();
    for (Object o : (List) l.get(c.get(e))) { uk k = (uk) o; s.append(s.length() > 0 ? "+" : "").append(NAMES.getOrDefault(k.a.getClass().getName(), k.a.getClass().getName())); }
    return s.toString();
  }
  static String params(Object action) throws Exception {
    StringBuilder s = new StringBuilder("{");
    boolean first = true;
    List<Field> all = new ArrayList<>();
    for (Class<?> c = action.getClass(); c != ui.class; c = c.getSuperclass()) for (Field f : c.getDeclaredFields()) all.add(f);
    for (Field f : all) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      Class<?> t = f.getType();
      if (t != double.class && t != float.class && t != int.class && t != boolean.class) continue;
      f.setAccessible(true);
      s.append(first ? "" : ",").append('"').append(f.getName()).append("\":").append(f.get(action));
      first = false;
    }
    return s.append("}").toString();
  }
  static int mutex(Object action) throws Exception { Field f = ui.class.getDeclaredField("a"); f.setAccessible(true); return f.getInt(action); }

  static String effects(sv e) throws Exception {
    Map<Integer, rw> m = new TreeMap<>((Map<Integer, rw>) fd(sv.class, "f").get(e));
    StringBuilder s = new StringBuilder();
    for (rw r : m.values()) s.append(s.length() > 0 ? "," : "").append("[").append(r.a()).append(",").append(r.c()).append(",").append(r.b()).append("]");
    return "[" + s + "]";
  }
  static String stack(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.k() + "," + s.b + "]"; }
  static int drinkTimer(yp e) throws Exception { return fd(yp.class, "bs").getInt(e); }

  static void tick(sa e) throws Exception {
    set(e, "p", MobMoveProbe.d(e, "s")); set(e, "q", MobMoveProbe.d(e, "t")); set(e, "r", MobMoveProbe.d(e, "u"));
    ((sv) e).e();
  }
  static String target(sw e) throws Exception { sa t = ((td) e).o(); return t == null ? "null" : q(t instanceof yz ? "player" : "other"); }
  static String state(yp e) throws Exception {
    return "{\"x\":" + num(e.s) + ",\"y\":" + num(e.t) + ",\"z\":" + num(e.u) + ",\"vx\":" + num(e.v) + ",\"vy\":" + num(e.w) + ",\"vz\":" + num(e.x)
      + ",\"yaw\":" + num(e.y) + ",\"head\":" + num(e.aO) + ",\"health\":" + num(e.aS()) + ",\"drinking\":" + e.bZ() + ",\"timer\":" + drinkTimer(e)
      + ",\"held\":" + stack(e.be()) + ",\"effects\":" + effects(e) + ",\"speed\":" + num(e.a(yj.d).e()) + ",\"fire\":" + e.al() + ",\"target\":" + target(e)
      + ",\"onGround\":" + e.D + ",\"dead\":" + e.K + ",\"running\":" + q(running(e)) + "}";
  }
  static String thrown() {
    StringBuilder s = new StringBuilder();
    for (Object o : ChickenProbe.World.spawned) {
      if (!(o instanceof zo)) continue;
      zo p = (zo) o;
      s.append(s.length() > 0 ? "," : "").append("[").append(p.k()).append(",").append(num(p.s)).append(",").append(num(p.t)).append(",").append(num(p.u))
        .append(",").append(num(p.v)).append(",").append(num(p.w)).append(",").append(num(p.x)).append("]");
    }
    ChickenProbe.World.spawned.clear();
    return "[" + s + "]";
  }
  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append(q(l.get(i)));
    return s.append("]").toString();
  }

  static void facts() throws Exception {
    reset();
    yp e = witch(64.5, 0, 64.5, 1);
    int items = 0;
    Field br = yp.class.getDeclaredField("br"); br.setAccessible(true);
    StringBuilder drops = new StringBuilder();
    for (adb i : (adb[]) br.get(null)) drops.append(drops.length() > 0 ? "," : "").append(adb.b(i));
    System.out.println("{\"case\":\"facts\",\"width\":" + num(e.M) + ",\"height\":" + num(e.N) + ",\"maxHealth\":" + e.a(yj.a).e() + ",\"speed\":" + e.a(yj.d).e()
      + ",\"followRange\":" + e.a(yj.b).e() + ",\"knockbackResistance\":" + e.a(yj.c).e() + ",\"attackDamage\":" + e.a(yj.e).e()
      + ",\"eyeHeight\":" + num(e.g()) + ",\"health\":" + num(e.aS()) + ",\"aiEnabled\":" + MobMoveProbe.method(yp.class, "bk").invoke(e)
      + ",\"talkInterval\":" + e.q() + ",\"experienceValue\":" + MobMoveProbe.fl(e, "b") + ",\"canDespawn\":" + MobMoveProbe.method(sw.class, "v").invoke(e)
      + ",\"drinking\":" + e.bZ() + ",\"dropTable\":[" + drops + "],\"penaltyUuid\":\"5CD17E52-A79A-43D3-A529-90FDE04B181E\",\"penaltyAmount\":-0.25,\"penaltyOperation\":0"
      + ",\"idle\":" + q((String) MobMoveProbe.method(yp.class, "t").invoke(e)) + ",\"hurt\":" + q((String) MobMoveProbe.method(yp.class, "aT").invoke(e))
      + ",\"death\":" + q((String) MobMoveProbe.method(yp.class, "aU").invoke(e)) + ",\"volume\":" + num((Float) MobMoveProbe.method(sv.class, "bf").invoke(e))
      + ",\"pathWeightDark\":" + num(e.a(64, 0, 64)) + ",\"isUndead\":" + e.aR() + ",\"mobType\":" + (e.bd() == sz.a) + "}");
    List<uk> list = entries(e, "c"), targets = entries(e, "d");
    StringBuilder tl = new StringBuilder(), tt = new StringBuilder();
    for (int i = 0; i < list.size(); i++) { uk k = list.get(i); tl.append(i > 0 ? "," : "").append("{\"priority\":").append(k.b).append(",\"class\":\"").append(NAMES.getOrDefault(k.a.getClass().getName(), k.a.getClass().getName())).append("\",\"mutex\":").append(mutex(k.a)).append(",\"params\":").append(params(k.a)).append("}"); }
    for (int i = 0; i < targets.size(); i++) { uk k = targets.get(i); tt.append(i > 0 ? "," : "").append("{\"priority\":").append(k.b).append(",\"class\":\"").append(NAMES.getOrDefault(k.a.getClass().getName(), k.a.getClass().getName())).append("\",\"mutex\":").append(mutex(k.a)).append(",\"params\":").append(params(k.a)).append("}"); }
    System.out.println("{\"case\":\"tasks\",\"tasks\":[" + tl + "],\"targets\":[" + tt + "]}");
    // the potion entity's own fields
    zo p = new zo(w, e, 32732);
    System.out.println("{\"case\":\"potionFacts\",\"gravity\":" + num((Float) MobMoveProbe.method(zo.class, "i").invoke(p)) + ",\"velocity\":" + num((Float) MobMoveProbe.method(zo.class, "e").invoke(p))
      + ",\"pitchOffset\":" + num((Float) MobMoveProbe.method(zo.class, "f").invoke(p)) + ",\"width\":" + num(p.M) + ",\"height\":" + num(p.N) + ",\"damage\":" + p.k()
      + ",\"yOffset\":" + num(p.L) + ",\"spawnX\":" + num(p.s) + ",\"spawnY\":" + num(p.t) + ",\"spawnZ\":" + num(p.u) + "}");
  }

  // The sounds pitch rolls, drops and the potion damage reduction.
  static void behaviours() throws Exception {
    Method pitch = MobMoveProbe.method(sv.class, "bg"), drop = MobMoveProbe.method(yp.class, "b", boolean.class, int.class);
    StringBuilder pitches = new StringBuilder();
    for (long seed = 0; seed < 4; seed++) {
      yp e = witch(64.5, 0, 64.5, seed);
      pitches.append(pitches.length() > 0 ? "," : "").append("{\"seed\":").append(seed).append(",\"pitch\":").append(num((Float) pitch.invoke(e))).append("}");
    }
    System.out.println("{\"case\":\"sounds\",\"pitches\":[" + pitches + "]}");
    for (int looting = 0; looting <= 3; looting += 3) {
      StringBuilder rows = new StringBuilder();
      for (long seed = 0; seed < 80; seed++) {
        reset();
        yp e = witch(64.5, 0, 64.5, seed);
        drop.invoke(e, true, looting);
        StringBuilder items = new StringBuilder();
        for (Object o : ChickenProbe.World.spawned) { add st = ((xk) o).f(); items.append(items.length() > 0 ? "," : "").append("[").append(adb.b(st.b())).append(",").append(st.b).append("]"); }
        rows.append(seed > 0 ? "," : "").append("[").append(items).append("]");
      }
      System.out.println("{\"case\":\"drops\",\"looting\":" + looting + ",\"rows\":[" + rows + "]}");
    }
    // EntityLiving.dropEquipment (sw.a(boolean,int)): a witch carrying a potion drops it with 8.5 % (nextFloat - looting * 0.01).
    Method equip = MobMoveProbe.method(sw.class, "a", boolean.class, int.class);
    for (int looting = 0; looting <= 3; looting += 3) {
      StringBuilder rows = new StringBuilder();
      for (int hit = 1; hit >= 0; hit--)
        for (long seed = 0; seed < 120; seed++) {
          reset();
          yp e = witch(64.5, 0, 64.5, seed * 2654435761L);
          e.c(0, new add(ade.bn, 1, 16341));
          equip.invoke(e, hit == 1, looting);
          StringBuilder items = new StringBuilder();
          for (Object o : ChickenProbe.World.spawned) { add st = ((xk) o).f(); items.append(items.length() > 0 ? "," : "").append("[").append(adb.b(st.b())).append(",").append(st.b).append(",").append(st.k()).append("]"); }
          rows.append(rows.length() > 0 ? "," : "").append("[").append(hit).append(",").append(seed * 2654435761L).append(",[").append(items).append("],").append(((Random) fd(sa.class, "Z").get(e)).nextInt()).append("]");
        }
      System.out.println("{\"case\":\"equipment\",\"looting\":" + looting + ",\"rows\":[" + rows + "]}");
    }
    // applyPotionDamageCalculations (yp.c): the base value of EntityLivingBase.applyPotionDamageCalculations then the witch's reduction
    reset();
    yp e = witch(64.5, 0, 64.5, 1);
    Target other = pig(65.5, 0, 64.5);
    Method calc = MobMoveProbe.method(yp.class, "c", ro.class, float.class);
    List<Object[]> src = new ArrayList<>();
    for (Field f : ro.class.getDeclaredFields()) if (f.getType() == ro.class && java.lang.reflect.Modifier.isStatic(f.getModifiers())) src.add(new Object[] {q(f.getName()), f.get(null)});
    src.add(new Object[] {"\"indirectMagicByOther\"", ro.b((sa) other, (sa) other)});
    src.add(new Object[] {"\"indirectMagicBySelf\"", ro.b((sa) e, (sa) e)});
    src.add(new Object[] {"\"indirectMagicSelfThrower\"", ro.b((sa) other, (sa) e)});
    src.add(new Object[] {"\"mob\"", ro.a((sv) other)});
    StringBuilder rows = new StringBuilder();
    for (Object[] s : src) {
      ro source = (ro) s[1];
      for (float amount : new float[] {1f, 6f, 20f, 7.5f})
        rows.append(rows.length() > 0 ? "," : "").append("{\"source\":").append(s[0]).append(",\"type\":").append(q(source.o)).append(",\"magic\":").append(source.s()).append(",\"entity\":").append(source.j() == null ? "null" : source.j() == e ? "\"self\"" : "\"other\"")
          .append(",\"amount\":").append(num(amount)).append(",\"result\":").append(num((Float) calc.invoke(e, source, amount))).append("}");
    }
    System.out.println("{\"case\":\"damage\",\"rows\":[" + rows + "]}");
  }

  // Potion (rv) table: every registered type with its accessors and attribute modifiers, and the ModelWitch parts.
  static void tables() throws Exception {
    StringBuilder pots = new StringBuilder();
    for (rv p : rv.a) {
      if (p == null) continue;
      StringBuilder acc = new StringBuilder();
      for (Method m : rv.class.getDeclaredMethods()) {
        if (m.getParameterCount() != 0 || java.lang.reflect.Modifier.isStatic(m.getModifiers())) continue;
        Class<?> r = m.getReturnType();
        if (r != boolean.class && r != int.class && r != double.class && r != String.class) continue;
        m.setAccessible(true);
        acc.append(acc.length() > 0 ? "," : "").append(q(m.getName() + ":" + r.getSimpleName())).append(":");
        Object v = m.invoke(p);
        acc.append(v instanceof String ? q((String) v) : String.valueOf(v));
      }
      StringBuilder mods = new StringBuilder();
      Map<th, tj> map = (Map<th, tj>) p.k();
      for (Map.Entry<th, tj> en : map.entrySet()) {
        tj mod = en.getValue();
        mods.append(mods.length() > 0 ? "," : "").append("{\"attribute\":").append(q(en.getKey().a())).append(",\"uuid\":").append(q(mod.a().toString())).append(",\"base\":").append(mod.d()).append(",\"operation\":").append(mod.c()).append(",\"amounts\":[");
        for (int amp = 0; amp < 4; amp++) mods.append(amp > 0 ? "," : "").append(p.a(amp, mod));
        mods.append("]}");
      }
      pots.append(pots.length() > 0 ? "," : "").append("{\"id\":").append(p.H).append(",\"fields\":{").append(acc).append("},\"modifiers\":[").append(mods).append("]}");
    }
    System.out.println("{\"case\":\"potions\",\"types\":[" + pots + "]}");
    // PotionHelper: requirements, amplifier strings, colours and effect lists for every damage value
    Field n = aen.class.getDeclaredField("n"), o = aen.class.getDeclaredField("o");
    n.setAccessible(true); o.setAccessible(true);
    StringBuilder req = new StringBuilder(), amps = new StringBuilder();
    for (Map.Entry<Integer, String> en : new TreeMap<>((Map<Integer, String>) n.get(null)).entrySet()) req.append(req.length() > 0 ? "," : "").append("\"").append(en.getKey()).append("\":").append(q(en.getValue()));
    for (Map.Entry<Integer, String> en : new TreeMap<>((Map<Integer, String>) o.get(null)).entrySet()) amps.append(amps.length() > 0 ? "," : "").append("\"").append(en.getKey()).append("\":").append(q(en.getValue()));
    java.security.MessageDigest colorDigest = java.security.MessageDigest.getInstance("SHA-256"), effectDigest = java.security.MessageDigest.getInstance("SHA-256"), prefixDigest = java.security.MessageDigest.getInstance("SHA-256");
    StringBuilder samples = new StringBuilder();
    int nonEmpty = 0;
    int[] sample = {0, 1, 2, 3, 8193, 8194, 8197, 8200, 8201, 8202, 8204, 8206, 8225, 8226, 8228, 8229, 8232, 8233, 8235, 8236, 8237, 8238, 8257, 8258, 8259, 8260, 8261, 8264, 8265, 8266, 8270, 16385, 16386, 16389, 16392, 16393, 16394, 16396, 16398, 16417, 16418, 16420, 16421, 16424, 16425, 16427, 16428, 16429, 16430, 16449, 16450, 16451, 16452, 16453, 16456, 16457, 16458, 16462, 32660, 32696, 32698, 32732, 16274, 16307, 16341, 8237, 16421, 16385, 16382, 64, 7, 15, 16, 32};
    Set<Integer> wanted = new HashSet<>();
    for (int s : sample) wanted.add(s);
    for (int meta = 0; meta < 32768; meta++) {
      int color = aen.a(meta, false);
      List<rw> list = aen.b(meta, false);
      StringBuilder eff = new StringBuilder();
      if (list != null) for (rw r : list) eff.append(eff.length() > 0 ? ";" : "").append(r.a()).append(":").append(r.b()).append(":").append(r.c());
      String pre = aen.c(meta);
      colorDigest.update((meta + "=" + color + "\n").getBytes());
      effectDigest.update((meta + "=" + eff + "\n").getBytes());
      prefixDigest.update((meta + "=" + pre + "\n").getBytes());
      if (list != null) nonEmpty++;
      if (wanted.contains(meta)) samples.append(samples.length() > 0 ? "," : "").append("{\"damage\":").append(meta).append(",\"color\":").append(color).append(",\"effects\":").append(q(eff.toString())).append(",\"prefix\":").append(q(pre)).append(",\"splash\":").append(adp.g(meta)).append("}");
    }
    System.out.println("{\"case\":\"table\",\"requirements\":{" + req + "},\"amplifiers\":{" + amps + "},\"defaultColor\":" + aen.a(0, false) + ",\"nonEmpty\":" + nonEmpty
      + ",\"colorSha256\":\"" + hex(colorDigest.digest()) + "\",\"effectSha256\":\"" + hex(effectDigest.digest()) + "\",\"prefixSha256\":\"" + hex(prefixDigest.digest()) + "\",\"samples\":[" + samples + "]}");
    // ItemPotion (adp) facts
    add water = new add(ade.bn, 1, 0), splash = new add(ade.bn, 1, 16384 | 37);
    System.out.println("{\"case\":\"items\",\"potionId\":" + adb.b(ade.bn) + ",\"potionMaxStack\":" + ade.bn.m()
      + ",\"useDuration\":" + ade.bn.d_(water) + ",\"hasSubtypes\":" + ade.bn.n() + ",\"waterEffects\":" + (ade.bn.g(water) == null)
      + ",\"splashBit\":" + (16384) + ",\"model\":null}");
    bim m = new bim(0.0f);
    ModelProbe.dump("witch", m);
    // setRotationAngles: nose angles / offsets with and without the held item
    StringBuilder poses = new StringBuilder();
    reset();
    yp e = witch(64.5, 0, 64.5, 1);
    Field noseField = bik.class.getDeclaredField("f"); noseField.setAccessible(true);
    bix nose = (bix) noseField.get(m);
    for (boolean held : new boolean[] {false, true})
      for (int id : new int[] {1, 7, 10, 19})
        for (int ticks : new int[] {0, 1, 40, 123}) {
          e.aa = ticks;
          m.g = held;
          m.a(0.3f, 0.5f, ticks + 0.25f, 12f, 4f, 0.0625f, e);
          poses.append(poses.length() > 0 ? "," : "").append("{\"held\":").append(held).append(",\"id\":").append(e.y()).append(",\"ticks\":").append(ticks).append(",\"nose\":[").append(num(nose.f)).append(",").append(num(nose.g)).append(",").append(num(nose.h)).append(",").append(num(nose.o)).append(",").append(num(nose.p)).append(",").append(num(nose.q)).append("]}");
        }
    System.out.println("{\"case\":\"nose\",\"poses\":[" + poses + "]}");
  }
  static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x)); return s.toString(); }

  // EntityWitch.attackEntityWithRangedAttack: the potion chosen, the spawn point, the motion (with the unseeded aim error).
  static void decide() throws Exception {
    StringBuilder rows = new StringBuilder();
    int[] maskIds = {0, 2, 18, 19};
    double[] dists = {1.5, 2.9, 3.0, 3.1, 5, 7.9, 8.0, 9.5, 14};
    float[] healths = {20f, 8f, 7.9f, 4f};
    int[] masks = {0, 1, 2, 4, 6};
    for (double dist : dists)
      for (float health : healths)
        for (int mask : masks)
          for (long seed = 1; seed <= 4; seed++) {
            reset();
            yp e = witch(64.5, 0, 64.5, seed);
            Target.thrower = e;
            Target t = pig(64.5, 0, 64.5 + dist);
            t.g(health);
            if ((mask & 1) != 0) t.c(new rw(19, 600, 0));
            if ((mask & 2) != 0) t.c(new rw(2, 600, 0));
            if ((mask & 4) != 0) t.c(new rw(18, 600, 0));
            e.a((sv) t, 1.0f);
            rows.append(rows.length() > 0 ? "," : "").append("[").append(num(dist)).append(",").append(num(health)).append(",").append(mask).append(",").append(seed).append(",").append(thrown()).append("]");
          }
    // moving target and a drinking witch (no throw)
    reset();
    yp e = witch(64.5, 0, 64.5, 9);
    Target t = pig(70.5, 0, 66.5);
    t.v = 0.2; t.x = -0.1;
    e.a((sv) t, 1.0f);
    String moving = thrown();
    e.a(true);
    e.a((sv) t, 1.0f);
    String drinking = thrown();
    System.out.println("{\"case\":\"decide\",\"rows\":[" + rows + "],\"moving\":" + moving + ",\"movingTarget\":[70.5,0,66.5,0.2,-0.1],\"drinking\":" + drinking + "}");
  }

  // The witch's own tick with the real AI. kind: idle, burning, hurt, water, far (player at 14), near (player at 9), close (player at 5).
  static void think(String kind, long seed, int ticks) throws Exception {
    reset();
    yp e = witch(64.5, 0, 64.5, seed);
    Target.thrower = e;
    Gamer p = null;
    double px = 64.5, pz = 64.5;
    switch (kind) {
      case "burning": e.e(100); break;
      case "hurt": e.g(10f); break;
      case "water": for (int x = 60; x < 70; x++) for (int y = 0; y < 3; y++) for (int z = 60; z < 70; z++) WW.cells.put(x + "," + y + "," + z, new int[] {9, 0}); break;
      case "far": p = player(64.5, 0, 78.5, false); pz = 78.5; break;
      case "near": p = player(64.5, 0, 73.5, false); pz = 73.5; break;
      case "close": p = player(64.5, 0, 69.5, false); pz = 69.5; break;
      case "dist2": p = player(64.5, 0, 66.5, false); pz = 66.5; break;
      case "hurtfar": e.g(10f); p = player(64.5, 0, 78.5, false); pz = 78.5; break;
      default: break;
    }
    if (System.getenv("WDEBUG") != null) System.err.println(kind + " near=" + w.a(yz.class, e.C.b(16, 4, 16), (sj) null).size() + " players=" + ((List) fd(ahb.class, "h").get(w)).size() + " pf=" + (p == null ? 0 : p.Z() + " " + p.C));
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < ticks; i++) {
      tick(e);
      out.append(i > 0 ? "," : "").append(state(e));
      String th = thrown();
      if (!th.equals("[]")) out.insert(out.length() - 1, ",\"thrown\":" + th);
    }
    System.out.println("{\"case\":\"think\",\"kind\":" + q(kind) + ",\"seed\":" + seed + ",\"player\":" + (p == null ? "null" : "[" + num(px) + ",0," + num(pz) + "]") + ",\"sounds\":" + strings(ChickenProbe.World.sounds) + ",\"ticks\":[" + out + "]}");
  }

  // A thrown potion: the witch's formula with a seeded EntityThrowable rand, then onUpdate until it breaks.
  static void flight(String name, long seed, double tx, double tz, double tmx, double tmz, boolean witchTarget, boolean block) throws Exception {
    reset();
    yp e = witch(64.5, 0, 64.5, 1);
    Target.thrower = e;
    sv target = zombie(tx, 0, tz);
    target.v = tmx; target.x = tmz;
    bodies.add(e);
    if (block) for (int y = 0; y < 3; y++) for (int z = 66; z < 69; z++) for (int x = 62; x < 68; x++) WW.cells.put(x + "," + y + "," + z, new int[] {1, 0});
    Target near = pig(tx + 1.0, 0, tz);
    Target far = pig(tx + 3.5, 0, tz);
    zo p = new zo(w, e, 32660);
    ChickenProbe.World.spawned.clear();
    set(p, "Z", new Random(seed));
    double dx = target.s + target.v - e.s, dy = target.C.b + target.g() - 1.100000023841858 - e.t, dz = target.u + target.x - e.u;
    float dist = (float) Math.sqrt(dx * dx + dz * dz);
    p.c(dx, dy + dist * 0.2f, dz, 0.75f, 8.0f);
    StringBuilder rows = new StringBuilder();
    int end = -1;
    for (int i = 0; i < 120; i++) {
      set(p, "p", p.s); set(p, "q", p.t); set(p, "r", p.u);
      p.h();
      rows.append(i > 0 ? "," : "").append("[").append(num(p.s)).append(",").append(num(p.t)).append(",").append(num(p.u)).append(",").append(num(p.v)).append(",").append(num(p.w)).append(",").append(num(p.x)).append(",").append(p.K).append("]");
      if (p.K) { end = i; break; }
    }
    StringBuilder effs = new StringBuilder();
    for (sv t : new sv[] {target, near, far}) effs.append(effs.length() > 0 ? "," : "").append("{\"health\":").append(num(t.aS())).append(",\"effects\":").append(effects(t)).append("}");
    System.out.println("{\"case\":\"flight\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"target\":[" + num(tx) + "," + num(tz) + "," + num(tmx) + "," + num(tmz) + "],\"damage\":32660,\"start\":[" + num(p.s) + "," + num(p.t) + "," + num(p.u) + "],\"end\":" + end
      + ",\"aux\":" + aux + ",\"hits\":" + hitLog + ",\"targets\":[" + effs + "],\"ticks\":[" + rows + "]}");
  }

  // EntityPotion.onImpact on its own: the damage value, the impact point, targets at fixed offsets, direct entity hits.
  static void splash() throws Exception {
    int[] damages = {16421, 16453, 16457, 16396, 16394, 16417, 16418, 16420, 16428, 16430, 16456, 16462, 16385, 16389, 16392, 16393, 16424, 16454, 16482, 32732, 32698, 32660, 32696, 16274, 16341, 16307, 16384 | 8237, 16384 | 8225, 16384 | 8264, 16384 | 8200, 16384 | 8201, 16384 | 8206};
    double[] offsets = {0, 0.5, 1, 2, 3, 3.9, 4.1, 5};
    StringBuilder rows = new StringBuilder();
    for (int damage : damages) {
      reset();
      yp thrower = witch(64.5, 0, 56.5, 1);
      Target.thrower = thrower;
      bodies.add(thrower);
      zo potion = new zo(w, thrower, damage);
      potion.b(64.5, 0, 64.5);
      List<sv> targets = new ArrayList<>();
      for (double off : offsets) { Target pig = pig(64.5 + off, 0, 64.5); pig.g(10f); targets.add(pig); }
      Undead undead = zombie(64.5, 0, 66.0); undead.g(10f);
      targets.add(undead);
      Gamer player = player(64.5, 0, 62.5, false); player.g(10f); bodies.add(player);
      targets.add(player);
      // the potion strikes the block below: azu(x, y, z, side, point)
      Method onImpact = MobMoveProbe.method(zo.class, "a", azu.class);
      onImpact.invoke(potion, new azu(64, -1, 64, 1, azw.a(64.5, 0, 64.5)));
      StringBuilder effs = new StringBuilder();
      for (sv t : targets) effs.append(effs.length() > 0 ? "," : "").append("{\"health\":").append(num(t.aS())).append(",\"effects\":").append(effects(t)).append("}");
      rows.append(rows.length() > 0 ? "," : "").append("{\"damage\":").append(damage).append(",\"dead\":").append(potion.K).append(",\"aux\":").append(aux).append(",\"hits\":").append(hitLog).append(",\"targets\":[").append(effs).append("]}");
    }
    // a direct entity hit (distance factor 1 for the entity struck) and a thrower-less potion (dispenser)
    StringBuilder direct = new StringBuilder();
    for (int damage : new int[] {32732, 16421}) {
      reset();
      yp thrower = witch(64.5, 0, 56.5, 1);
      Target.thrower = thrower;
      zo potion = new zo(w, thrower, damage);
      potion.b(64.5, 0, 64.5);
      Target hit = pig(64.5, 0, 66.5); hit.g(10f);
      Target[] around = {pig(67.5, 0, 65.5)};
      around[0].g(10f);
      MobMoveProbe.method(zo.class, "a", azu.class).invoke(potion, new azu((sa) hit));
      direct.append(direct.length() > 0 ? "," : "").append("{\"damage\":").append(damage).append(",\"hit\":[").append(num(hit.aS())).append(",").append(effects(hit)).append("],\"around\":[").append(num(around[0].aS())).append(",").append(effects(around[0])).append("],\"hits\":").append(hitLog).append("}");
    }
    System.out.println("{\"case\":\"splash\",\"offsets\":" + Arrays.toString(offsets) + ",\"rows\":[" + rows + "],\"direct\":[" + direct + "]}");
  }

  // ItemPotion.onItemRightClick for a splash potion and ItemPotion.onEaten for a drinkable one, on the player double.
  static void items() throws Exception {
    StringBuilder rows = new StringBuilder();
    for (int damage : new int[] {8261, 8193, 8197, 8200, 8194, 8201, 8225, 8228, 8196, 8206, 8232, 0, 16421, 8237, 8226, 8264, 16385}) {
      reset();
      Gamer p = player(64.5, 0, 64.5, false);
      p.g(10f);
      Target.thrower = p;
      add stack = new add(ade.bn, 2, damage);
      add result;
      if (adp.g(damage)) {
        MobMoveProbe.field(ahb.class, "s").set(w, new Random(2));
        result = ade.bn.a(stack, w, p);
        rows.append(rows.length() > 0 ? "," : "").append("{\"damage\":").append(damage).append(",\"splash\":true,\"result\":").append(stack(result)).append(",\"thrown\":").append(thrown()).append(",\"sounds\":").append(strings(ChickenProbe.World.sounds)).append("}");
      } else {
        result = ade.bn.b(stack, w, p);
        rows.append(rows.length() > 0 ? "," : "").append("{\"damage\":").append(damage).append(",\"splash\":false,\"result\":").append(stack(result)).append(",\"health\":").append(num(p.aS())).append(",\"effects\":").append(effects(p)).append(",\"hits\":").append(hitLog).append("}");
      }
    }
    System.out.println("{\"case\":\"items2\",\"rows\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    w = (WW) u.allocateInstance(WW.class);
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    fd(ays.class, "g").setLong(info, 1);
    fd(ays.class, "x").set(info, new agy());
    fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    fd(ahb.class, "J").set(w, date);
    fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);

    facts();
    behaviours();
    tables();
    decide();
    splash();
    items();
    for (long seed = 1; seed <= 3; seed++) {
      think("idle", seed, 300);
      think("burning", seed, 300);
      think("hurt", seed, 300);
      think("water", seed, 300);
      think("hurtfar", seed, 300);
    }
    for (long seed = 1; seed <= 2; seed++) { think("near", seed, 200); think("far", seed, 200); think("close", seed, 200); think("dist2", seed, 160); }
    flight("static", 3, 64.5, 72.5, 0, 0, false, false);
    flight("static-far", 4, 64.5, 80.5, 0, 0, false, false);
    flight("moving", 5, 70.5, 73.5, 0.2, -0.1, false, false);
    flight("near", 6, 64.5, 67.5, 0, 0, false, false);
    flight("wall", 7, 64.5, 72.5, 0, 0, false, true);
    flight("seed", 8, 64.5, 72.5, 0, 0, false, false);
  }
}
