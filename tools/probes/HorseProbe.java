import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

// Runs the unchanged EntityHorse (wi), EntityAnimal/EntityAgeable, EntityAIRunAroundLikeCrazy (vg) and ModelHorse (bhs)
// of the 1.7.10 JAR on the MobMoveProbe world double. The horse is built with its real constructor (AI task lists are
// never ticked); the rider is an uninitialised EntityPlayer with an inventory, abilities, UUID, a sneak flag and
// recorded mount/GUI calls. One JSON object per line:
//   facts      size, attribute bases, mounted offsets, scale by age, talk interval, max spawn group, armour values
//   spawn      wi.a(sy) onSpawnWithEgg over seeds (type, variant, age, attributes, next Random int) with and without wk group data
//   feed       wi.a(yz) with the feeding table over tame/foal/health/type states, saddle, armour, chest, empty hand, sneak
//   tame       vg.e() (RunAroundLikeCrazy updateTask) over seeds until the horse is tamed
//   jump       w(int) setJumpPower curve with and without a saddle
//   ride       e(F,F) rider movement ticks (saddled, unsaddled, jump, backwards, strafe, rearing) and ac() rider position
//   child      a(rx) createChild: type, variant and attribute averages over seeds
//   mate       a(wf) canMateWith over types and states
//   drops      u() item and b(boolean,int) counts, e(yz) experience
//   sound      t(), aT(), aU(), cv() and the step sound by type and state
//   fall       b(F) fall damage and armour reduction
//   nbt        b(dh) written tags and a(dh) read-back, including the legacy forms
//   anim       p/q/r partial-tick getters and h() timers
//   model      ModelHorse parts at rest and after setLivingAnimations
public class HorseProbe {
  public static class World extends MobMoveProbe.ProbeWorld {
    static List<String> sounds = new ArrayList<>();
    static List<Integer> states = new ArrayList<>();
    static List<String> items = new ArrayList<>();
    public boolean d(sa entity) {
      if (entity instanceof xk) { add s = ((xk) entity).f(); items.add(adb.b(s.b()) + "x" + s.b); }
      return true;
    }
    public void a(sa entity, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public void a(sa entity, byte state) { states.add((int) state); }
    static bac board = new bac();
    public bac W() { return board; }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {}
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
  }

  public static abstract class FakePlayerBase extends yz { FakePlayerBase() { super(null, null); } }
  public static class FakePlayer extends FakePlayerBase {
    static boolean sneak = false;
    static int guiOpens = 0;
    static int mounts = 0;
    FakePlayer() { super(); }
    public add be() { return null; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public boolean a(int level, String command) { return true; }
    public void a(fj message) {}
    public r f_() { return null; }
    public boolean an() { return sneak; }
    public void a(wi horse, rb inv) { guiOpens++; }
    public void a(sa e) {
      try {
        Field ridden = MobMoveProbe.field(sa.class, "l"), riding = MobMoveProbe.field(sa.class, "m");
        sa old = (sa) riding.get(this);
        if (e == null) { if (old != null) ridden.set(old, null); riding.set(this, null); }
        else { riding.set(this, e); ridden.set(e, this); mounts++; }
      } catch (Exception x) { throw new RuntimeException(x); }
    }
  }

  static void out(String s) { System.out.println(s); }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static World W;
  static yz player, creative;

  static wi horse(long seed) throws Exception {
    wi e = new wi(W);
    MobMoveProbe.set(e, "Z", new Random(seed));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64.0, 0.0, 64.0);
    MobMoveProbe.set(e, "D", true);
    return e;
  }
  static wi spawned(long seed, sy data) throws Exception {
    wi e = horse(seed);
    e.a(data);
    return e;
  }
  static wi typed(long seed, int type) throws Exception {
    wi e = horse(seed);
    e.a(new wk(type, 0));
    return e;
  }

  static yz makePlayer(boolean creative) throws Exception {
    yz p = (yz) u.allocateInstance(FakePlayer.class);
    yx inv = (yx) u.allocateInstance(yx.class);
    inv.a = new add[40];
    inv.c = 0;
    inv.d = p;
    MobMoveProbe.set(p, "bm", inv);
    yw abilities = (yw) u.allocateInstance(yw.class);
    abilities.d = creative;
    MobMoveProbe.set(p, "bE", abilities);
    MobMoveProbe.set(p, "ar", new UUID(1L, 2L));
    MobMoveProbe.set(p, "o", W);
    MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(new UUID(1L, 2L), "Player"));
    MobMoveProbe.set(p, "Z", new Random(5));
    MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(p, "L", 1.62f);
    MobMoveProbe.set(p, "M", 0.6f);
    MobMoveProbe.set(p, "N", 1.8f);
    return p;
  }

  static void hold(yz p, add stack) throws Exception { ((yx) MobMoveProbe.field(yz.class, "bm").get(p)).a[0] = stack; }
  static add held(yz p) throws Exception { return ((yx) MobMoveProbe.field(yz.class, "bm").get(p)).a[0]; }
  static String stack(add s) { return s == null ? "null" : "{\"id\":" + adb.b(s.b()) + ",\"damage\":" + s.k() + ",\"count\":" + s.b + "}"; }
  static String str(String s) { return "\"" + (s == null ? "" : s) + "\""; }
  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append('"').append(l.get(i)).append('"');
    return s.append("]").toString();
  }
  static String ints(List<Integer> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append(l.get(i));
    return s.append("]").toString();
  }
  static void clear() { World.sounds.clear(); World.states.clear(); World.items.clear(); FakePlayer.guiOpens = 0; FakePlayer.mounts = 0; FakePlayer.sneak = false; }
  static float attr(sv e, th a) { return (float) ((ti) e.a(a)).e(); }
  static double attrD(sv e, th a) { return ((ti) e.a(a)).e(); }
  static th jumpAttr() throws Exception { return (th) MobMoveProbe.field(wi.class, "bv").get(null); }
  static void setHealth(sv e, float h) throws Exception { e.g(h); }

  static String horseState(wi e) throws Exception {
    return "{\"type\":" + e.bZ() + ",\"variant\":" + e.ca() + ",\"age\":" + e.d() + ",\"tame\":" + e.cc() + ",\"saddled\":" + e.cu() + ",\"chested\":" + e.ck()
      + ",\"bred\":" + e.co() + ",\"eating\":" + e.cm() + ",\"rearing\":" + e.cn() + ",\"inLove\":" + e.ce() + ",\"temper\":" + e.cq()
      + ",\"health\":" + num(e.aS()) + ",\"maxHealth\":" + num(attrD(e, yj.a)) + ",\"speed\":" + num(attrD(e, yj.d)) + ",\"jump\":" + num(e.ct())
      + ",\"armor\":" + e.cl() + ",\"owner\":" + str(e.ch()) + "}";
  }

  static String dumpParts(String tag, bhs m, String extra) throws Exception {
    StringBuilder b = new StringBuilder("{\"case\":\"model\",\"tag\":\"" + tag + "\"" + extra + ",\"parts\":{");
    boolean first = true;
    for (Field f : bhs.class.getDeclaredFields()) {
      if (f.getType() != bix.class) continue;
      f.setAccessible(true);
      if (!first) b.append(',');
      first = false;
      b.append("\"" + f.getName() + "\":" + ModelProbe.part((bix) f.get(m)));
    }
    return b.append("}}").toString();
  }

  static String nbt(dh t) {
    StringBuilder b = new StringBuilder("{");
    boolean first = true;
    List<String> keys = new ArrayList<>((java.util.Set<String>) t.c());
    java.util.Collections.sort(keys);
    for (String k : keys) {
      if (!first) b.append(',');
      first = false;
      dy v = t.a(k);
      b.append("\"" + k + "\":{\"id\":" + v.a() + ",\"text\":\"" + v.toString().replace("\\", "\\\\").replace("\"", "\\\"") + "\"}");
    }
    return b.append("}").toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    World world = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    W = world;
    player = makePlayer(false);
    creative = makePlayer(true);
    facts();
    spawn();
    feed();
    tame();
    jump();
    ride();
    child();
    mate();
    drops();
    sound();
    fall();
    nbtCases();
    anim();
    model();
    //CASES
  }

  static void facts() throws Exception {
    wi e = horse(1);
    StringBuilder ages = new StringBuilder();
    int[] agesIn = { 0, 5, -1, -6000, -12000, -18000, -24000 };
    for (int a : agesIn) {
      wi x = horse(1);
      x.c(a);
      ages.append(ages.length() > 0 ? "," : "").append("{\"age\":" + x.d() + ",\"scale\":" + num(x.ci()) + ",\"adult\":" + x.cb() + ",\"mountedY\":" + num(((sa) x).ae()) + "}");
    }
    StringBuilder armors = new StringBuilder();
    for (int idx = 0; idx < 4; idx++) {
      wi x = horse(1);
      MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class);
      x.d(idx == 0 ? null : new add(idx == 1 ? ade.bX : idx == 2 ? ade.bY : ade.bZ));
      armors.append(armors.length() > 0 ? "," : "").append("{\"index\":" + x.cl() + ",\"value\":" + x.aV() + "}");
    }
    StringBuilder types = new StringBuilder();
    for (int t = 0; t < 5; t++) {
      wi x = horse(1);
      x.s(t);
      types.append(types.length() > 0 ? "," : "").append("{\"type\":" + t + ",\"zombieOrSkeleton\":" + x.cE() + ",\"undeadOrMule\":" + x.cF() + ",\"canWearArmor\":" + x.cB() + ",\"canCarryChest\":" + x.cC() + "}");
    }
    out("{\"case\":\"facts\",\"width\":" + num(MobMoveProbe.fl(e, "M")) + ",\"height\":" + num(MobMoveProbe.fl(e, "N"))
      + ",\"baseMaxHealth\":" + num(attrD(e, yj.a)) + ",\"baseSpeed\":" + num(attrD(e, yj.d)) + ",\"baseJump\":" + num(attrD(e, jumpAttr()))
      + ",\"maxTemper\":" + e.cw() + ",\"maxSpawnGroup\":" + e.bB() + ",\"talkInterval\":" + e.q() + ",\"soundVolume\":" + num((Float) MobMoveProbe.method(wi.class, "bf").invoke(e))
      + ",\"inventorySize\":" + MobMoveProbe.method(wi.class, "cM").invoke(e) + ",\"defaultHealth\":" + num(e.aS()) + ",\"immuneToFire\":" + MobMoveProbe.b(e, "ag")
      + ",\"ages\":[" + ages + "],\"armors\":[" + armors + "],\"types\":[" + types + "]}");
  }

  static void spawn() throws Exception {
    for (long seed = 0; seed < 400; seed++) {
      wi e = horse(seed);
      sy g = e.a((sy) null);
      Random r = (Random) MobMoveProbe.field(sa.class, "Z").get(e);
      wk gd = (wk) g;
      out("{\"case\":\"spawn\",\"seed\":" + seed + ",\"horse\":" + horseState(e) + ",\"group\":[" + gd.a + "," + gd.b + "],\"next\":" + r.nextInt(1000000) + "}");
    }
    for (int type = 0; type < 5; type++) for (long seed = 0; seed < 12; seed++) {
      wi e = horse(seed);
      sy g = e.a((sy) new wk(type, 258));
      Random r = (Random) MobMoveProbe.field(sa.class, "Z").get(e);
      out("{\"case\":\"spawnGroup\",\"seed\":" + seed + ",\"inType\":" + type + ",\"horse\":" + horseState(e) + ",\"next\":" + r.nextInt(1000000) + "}");
    }
  }

  static add itemStack(String kind, int count) {
    switch (kind) {
      case "wheat": return new add(ade.O, count);
      case "sugar": return new add(ade.aT, count);
      case "bread": return new add(ade.P, count);
      case "hay": return new add(ajn.cf, count);
      case "apple": return new add(ade.e, count);
      case "goldenCarrot": return new add(ade.bK, count);
      case "goldenApple": return new add(ade.ao, count);
      case "carrot": return new add(adb.d(391), count);
      case "saddle": return new add(adb.d(329), count);
      case "ironArmor": return new add(ade.bX, count);
      case "goldArmor": return new add(ade.bY, count);
      case "diamondArmor": return new add(ade.bZ, count);
      case "chest": return new add(ajn.ae, count);
      case "stick": return new add(adb.d(280), count);
      default: return null;
    }
  }

  static wi stateHorse(int type, boolean tame, int age, float health, int temper, long seed) throws Exception {
    wi e = horse(seed);
    e.s(type);
    if (tame) e.i(true);
    e.c(age);
    e.u(temper);
    setHealth(e, health);
    return e;
  }

  static void feed() throws Exception {
    String[] foods = { "wheat", "sugar", "bread", "hay", "apple", "goldenCarrot", "goldenApple", "carrot", "stick" };
    for (String food : foods) for (int type : new int[] { 0, 1, 3 }) for (int tame = 0; tame < 2; tame++) for (int age : new int[] { 0, -12000 }) for (float health : new float[] { 5f, 53f }) for (int temper : new int[] { 0, 98 }) {
      clear();
      wi e = stateHorse(type, tame == 1, age, health, temper, 3);
      if (type == 1 || type == 3) { e.a(new wk(type, 0)); e.i(tame == 1); e.c(age); e.u(temper); }
      setHealth(e, Math.min(health, (float) attrD(e, yj.a)));
      float before = e.aS();
      hold(player, itemStack(food, 3));
      boolean r = e.a(player);
      out("{\"case\":\"feed\",\"food\":\"" + food + "\",\"type\":" + type + ",\"tame\":" + (tame == 1) + ",\"startAge\":" + age + ",\"startHealth\":" + num(before) + ",\"startTemper\":" + temper
        + ",\"result\":" + r + ",\"heal\":" + num(e.aS() - before) + ",\"horse\":" + horseState(e) + ",\"held\":" + stack(held(player)) + ",\"states\":" + ints(World.states) + ",\"sounds\":" + strings(World.sounds)
        + ",\"gui\":" + FakePlayer.guiOpens + ",\"mounted\":" + (MobMoveProbe.field(sa.class, "l").get(e) != null) + "}");
      if (MobMoveProbe.field(sa.class, "l").get(e) != null) player.a((sa) null);
    }
    // other interactions: item x state
    String[] others = { "saddle", "ironArmor", "goldArmor", "diamondArmor", "chest", "stick", null };
    for (String item : others) for (int type : new int[] { 0, 1, 2, 3, 4 }) for (int tame = 0; tame < 2; tame++) for (int sneak = 0; sneak < 2; sneak++) for (int age : new int[] { 0, -12000 }) {
      clear();
      FakePlayer.sneak = sneak == 1;
      wi e = horse(3);
      e.a(new wk(type, 0));
      e.i(tame == 1);
      e.c(age);
      if (type >= 3) e.i(tame == 1);
      hold(player, item == null ? null : itemStack(item, 2));
      boolean r = e.a(player);
      out("{\"case\":\"interact\",\"item\":\"" + item + "\",\"type\":" + type + ",\"tame\":" + (tame == 1) + ",\"sneak\":" + (sneak == 1) + ",\"startAge\":" + age + ",\"result\":" + r
        + ",\"horse\":" + horseState(e) + ",\"held\":" + stack(held(player)) + ",\"states\":" + ints(World.states) + ",\"sounds\":" + strings(World.sounds) + ",\"gui\":" + FakePlayer.guiOpens
        + ",\"mounted\":" + (MobMoveProbe.field(sa.class, "l").get(e) != null) + ",\"inventory\":" + MobMoveProbe.method(wi.class, "cM").invoke(e) + "}");
      if (MobMoveProbe.field(sa.class, "l").get(e) != null) player.a((sa) null);
    }
    // creative players keep the stack
    {
      clear();
      wi e = stateHorse(0, true, 0, 5f, 0, 3);
      hold(creative, itemStack("wheat", 3));
      e.a(creative);
      out("{\"case\":\"creativeFeed\",\"held\":" + stack(held(creative)) + ",\"horse\":" + horseState(e) + "}");
    }
    FakePlayer.sneak = false;
  }

  static void tame() throws Exception {
    for (long seed = 0; seed < 150; seed++) {
      clear();
      wi e = horse(seed);
      e.a((sy) null);
      e.i(false);
      vg task = new vg(e, 1.2);
      StringBuilder ev = new StringBuilder();
      int tick = 0, events = 0;
      boolean tamed = false;
      for (; tick < 40000 && events < 60 && !tamed; tick++) {
        if (MobMoveProbe.field(sa.class, "l").get(e) == null) player.a((sa) e);
        int tBefore = e.cq();
        World.states.clear();
        task.e();
        if (!World.states.isEmpty()) {
          events++;
          tamed = e.cc();
          ev.append(ev.length() > 0 ? "," : "").append("{\"tick\":" + tick + ",\"status\":" + World.states.get(0) + ",\"tame\":" + e.cc() + ",\"temperBefore\":" + tBefore + ",\"temperAfter\":" + e.cq() + ",\"rearing\":" + e.cn() + ",\"rider\":" + (MobMoveProbe.field(sa.class, "l").get(e) != null) + ",\"owner\":" + str(e.ch()) + "}");
        } else if (e.cq() != tBefore) System.out.println("unexpected temper change");
      }
      player.a((sa) null);
      out("{\"case\":\"tame\",\"seed\":" + seed + ",\"events\":[" + ev + "],\"finalTick\":" + tick + "}");
    }
  }

  static void jump() throws Exception {
    int[] powers = { -5, -1, 0, 1, 10, 30, 45, 60, 89, 90, 91, 100, 200 };
    for (int saddled = 0; saddled < 2; saddled++) for (int p : powers) {
      wi e = horse(1);
      e.i(true);
      e.n(saddled == 1);
      e.w(p);
      out("{\"case\":\"jump\",\"saddled\":" + (saddled == 1) + ",\"power\":" + p + ",\"jumpPower\":" + num(MobMoveProbe.fl(e, "bt")) + ",\"held\":" + MobMoveProbe.b(e, "bI") + ",\"rearing\":" + e.cn() + ",\"canJump\":" + MobMoveProbe.method(wi.class, "bk").invoke(e) + "}");
    }
  }

  static wi mountedHorse(long seed, boolean saddled, float yaw, float pitch, float forward, float strafe) throws Exception {
    wi e = horse(seed);
    e.a((sy) null);
    e.i(true);
    e.n(saddled);
    MobMoveProbe.set(player, "y", yaw);
    MobMoveProbe.set(player, "z", pitch);
    MobMoveProbe.set(player, "be", forward);
    MobMoveProbe.set(player, "bd", strafe);
    MobMoveProbe.set(e, "y", 0f);
    player.a((sa) e);
    return e;
  }

  static void ride() throws Exception {
    // name, saddled, yaw, pitch, forward, strafe, jumpPower (int, -9 none), rearing, ticks
    Object[][] sc = {
      { "forward", true, 0f, 0f, 0.98f, 0f, -9, false, 50 },
      { "backward", true, 0f, 0f, -0.98f, 0f, -9, false, 30 },
      { "strafe", true, 0f, 0f, 0f, 0.98f, -9, false, 30 },
      { "diagonalYaw90", true, 90f, 20f, 0.98f, 0.98f, -9, false, 30 },
      { "jumpFull", true, 0f, 0f, 0.98f, 0f, 100, false, 60 },
      { "jumpHalf", true, 0f, 0f, 0f, 0f, 45, false, 60 },
      { "jumpWeak", true, 180f, 0f, 0.98f, 0f, 5, false, 60 },
      { "rearingBlocked", true, 0f, 0f, 0.98f, 0f, -9, true, 20 },
      { "unsaddled", false, 0f, 0f, 0.98f, 0f, -9, false, 30 },
      { "idle", true, 0f, 0f, 0f, 0f, -9, false, 10 },
    };
    for (long seed : new long[] { 1, 6 }) for (Object[] s : sc) {
      clear();
      wi e = mountedHorse(seed, (Boolean) s[1], (Float) s[2], (Float) s[3], (Float) s[4], (Float) s[5]);
      if ((Boolean) s[7]) e.p(true);
      StringBuilder rows = new StringBuilder();
      float speed = (float) attrD(e, yj.d);
      for (int i = 0; i < (Integer) s[8]; i++) {
        MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s"));
        MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t"));
        MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
        if (i == 0 && (Integer) s[6] != -9) e.w((Integer) s[6]);
        e.i(speed);
        e.e((Float) s[5] * 0.98f, (Float) s[4]);
        e.ac();
        rows.append(i > 0 ? "," : "").append("{\"horse\":" + MobMoveProbe.state(e) + ",\"yaw\":" + num(MobMoveProbe.fl(e, "y")) + ",\"pitch\":" + num(MobMoveProbe.fl(e, "z"))
          + ",\"rider\":[" + num(MobMoveProbe.d(player, "s")) + "," + num(MobMoveProbe.d(player, "t")) + "," + num(MobMoveProbe.d(player, "u")) + "],\"jumpPower\":" + num(MobMoveProbe.fl(e, "bt")) + ",\"riderYaw\":" + num(MobMoveProbe.fl(player, "y")) + ",\"aiSpeed\":" + num(MobMoveProbe.field(sv.class, "bp").getFloat(e)) + "}");
      }
      player.a((sa) null);
      out("{\"case\":\"ride\",\"seed\":" + seed + ",\"name\":\"" + s[0] + "\",\"speed\":" + num(speed) + ",\"jumpAttr\":" + num(e.ct()) + ",\"ticks\":[" + rows + "]}");
    }
  }

  static wi parent(long seed, int type, int colour) throws Exception {
    wi e = horse(seed);
    e.a(new wk(type, colour));
    return e;
  }

  static void child() throws Exception {
    int[][] pairs = { { 0, 0 }, { 0, 1 }, { 1, 0 }, { 1, 1 }, { 2, 0 }, { 2, 2 }, { 0, 3 } };
    for (int[] pr : pairs) for (long seed = 0; seed < 80; seed++) {
      wi a = parent(seed, pr[0], (int) (seed % 7));
      wi b = parent(seed + 1000, pr[1], (int) ((seed + 3) % 7));
      MobMoveProbe.set(a, "Z", new Random(seed * 31 + 7));
      wi c = (wi) a.a((rx) b);
      Random r = (Random) MobMoveProbe.field(sa.class, "Z").get(a);
      out("{\"case\":\"child\",\"typeA\":" + pr[0] + ",\"typeB\":" + pr[1] + ",\"seed\":" + seed + ",\"a\":" + horseState(a) + ",\"b\":" + horseState(b) + ",\"child\":" + horseState(c) + ",\"next\":" + r.nextInt(1000000) + "}");
    }
  }

  static void mate() throws Exception {
    for (int ta = 0; ta < 5; ta++) for (int tb = 0; tb < 5; tb++) {
      wi a = parent(1, ta, 0), b = parent(2, tb, 0);
      a.c(0); b.c(0);
      a.i(true); b.i(true);
      MobMoveProbe.field(wf.class, "bp").setInt(a, 600);
      MobMoveProbe.field(wf.class, "bp").setInt(b, 600);
      setHealth(a, (float) attrD(a, yj.a)); setHealth(b, (float) attrD(b, yj.a));
      out("{\"case\":\"mate\",\"typeA\":" + ta + ",\"typeB\":" + tb + ",\"result\":" + a.a((wf) b) + ",\"canBreedA\":" + MobMoveProbe.method(wi.class, "cT").invoke(a) + "}");
    }
    for (int mask = 0; mask < 128; mask++) {
      wi a = parent(1, 0, 0), b = parent(2, 0, 0);
      a.c(0); b.c(0);
      boolean tameA = (mask & 1) != 0, foalA = (mask & 2) != 0, hurtA = (mask & 4) != 0, riderA = (mask & 8) != 0, loveA = (mask & 16) != 0, loveB = (mask & 32) != 0, tameB = (mask & 64) != 0;
      a.i(tameA); b.i(tameB);
      if (foalA) a.c(-12000);
      MobMoveProbe.field(wf.class, "bp").setInt(a, loveA ? 600 : 0);
      MobMoveProbe.field(wf.class, "bp").setInt(b, loveB ? 600 : 0);
      setHealth(a, hurtA ? 5f : (float) attrD(a, yj.a)); setHealth(b, (float) attrD(b, yj.a));
      if (riderA) player.a((sa) a);
      out("{\"case\":\"mateState\",\"tameA\":" + tameA + ",\"foalA\":" + foalA + ",\"hurtA\":" + hurtA + ",\"riderA\":" + riderA + ",\"loveA\":" + loveA + ",\"loveB\":" + loveB + ",\"tameB\":" + tameB + ",\"result\":" + a.a((wf) b) + ",\"canBreedA\":" + MobMoveProbe.method(wi.class, "cT").invoke(a) + "}");
      if (riderA) player.a((sa) null);
    }
    wi self = parent(1, 0, 0); self.i(true);
    MobMoveProbe.field(wf.class, "bp").setInt(self, 600);
    out("{\"case\":\"mateSelf\",\"result\":" + self.a((wf) self) + "}");
  }

  static void drops() throws Exception {
    for (int type : new int[] { 0, 1, 2, 3, 4 }) {
      wi e = typed(1, type);
      Object item = MobMoveProbe.method(wi.class, "u").invoke(e);
      out("{\"case\":\"dropItem\",\"type\":" + type + ",\"item\":" + (item == null ? -1 : adb.b((adb) item)) + "}");
    }
    for (int type : new int[] { 0, 1, 3, 4 }) for (int looting = 0; looting < 4; looting++) for (long seed = 0; seed < 60; seed++) {
      clear();
      wi e = typed(seed, type);
      MobMoveProbe.set(e, "Z", new Random(seed));
      MobMoveProbe.method(wi.class, "b", boolean.class, int.class).invoke(e, true, looting);
      out("{\"case\":\"drops\",\"type\":" + type + ",\"looting\":" + looting + ",\"seed\":" + seed + ",\"items\":" + strings(World.items) + "}");
    }
    for (long seed = 0; seed < 60; seed++) {
      wi e = typed(seed, 0);
      MobMoveProbe.set(e, "Z", new Random(seed));
      out("{\"case\":\"xp\",\"seed\":" + seed + ",\"xp\":" + MobMoveProbe.method(wi.class, "e", yz.class).invoke(e, player) + "}");
    }
  }

  static void sound() throws Exception {
    for (int type = 0; type < 5; type++) {
      for (long seed = 0; seed < 40; seed++) {
        clear();
        wi e = typed(seed, type);
        MobMoveProbe.set(e, "Z", new Random(seed));
        Object living = MobMoveProbe.method(wi.class, "t").invoke(e);
        boolean r1 = e.cn();
        clear();
        wi h = typed(seed, type);
        MobMoveProbe.set(h, "Z", new Random(seed));
        Object hurt = MobMoveProbe.method(wi.class, "aT").invoke(h);
        out("{\"case\":\"sound\",\"type\":" + type + ",\"seed\":" + seed + ",\"living\":" + (living == null ? "null" : "\"" + living + "\"") + ",\"livingRearing\":" + r1 + ",\"hurt\":" + (hurt == null ? "null" : "\"" + hurt + "\"") + ",\"hurtRearing\":" + h.cn() + "}");
      }
      wi e = typed(1, type);
      Object death = MobMoveProbe.method(wi.class, "aU").invoke(e), angry = MobMoveProbe.method(wi.class, "cv").invoke(e);
      out("{\"case\":\"soundFixed\",\"type\":" + type + ",\"death\":" + (death == null ? "null" : "\"" + death + "\"") + ",\"angry\":" + (angry == null ? "null" : "\"" + angry + "\"") + "}");
    }
    // step sounds: stone, planks, water over 12 steps, with and without a rider
    Object[][] blocks = { { "stone", 1 }, { "planks", 5 }, { "water", 9 }, { "grass", 2 } };
    for (int type : new int[] { 0, 1, 2, 3 }) for (Object[] bl : blocks) for (int ride = 0; ride < 2; ride++) {
      clear();
      wi e = typed(4, type);
      if (ride == 1) { e.i(true); e.n(true); player.a((sa) e); }
      StringBuilder per = new StringBuilder();
      for (int i = 0; i < 12; i++) {
        World.sounds.clear();
        MobMoveProbe.method(wi.class, "a", int.class, int.class, int.class, aji.class).invoke(e, 64, 0, 64, aji.e((Integer) bl[1]));
        per.append(i > 0 ? "," : "").append(strings(World.sounds));
      }
      if (ride == 1) player.a((sa) null);
      out("{\"case\":\"step\",\"type\":" + type + ",\"block\":\"" + bl[0] + "\",\"ridden\":" + (ride == 1) + ",\"steps\":[" + per + "]}");
    }
  }

  static void fall() throws Exception {
    float[] dists = { 0f, 1f, 1.5f, 3f, 5f, 7f, 10f, 20f };
    for (float d : dists) for (int armor : new int[] { 0, 3 }) {
      clear();
      wi e = typed(1, 0);
      e.i(true);
      if (armor > 0) e.d(new add(ade.bZ));
      float before = e.aS();
      MobMoveProbe.method(wi.class, "b", float.class).invoke(e, d);
      out("{\"case\":\"fall\",\"distance\":" + num(d) + ",\"armor\":" + e.cl() + ",\"lost\":" + num(before - e.aS()) + ",\"sounds\":" + strings(World.sounds) + "}");
    }
    for (int armor = 0; armor < 4; armor++) for (float dmg : new float[] { 4f, 10f }) {
      clear();
      wi e = typed(1, 0);
      e.d(armor == 0 ? null : new add(armor == 1 ? ade.bX : armor == 2 ? ade.bY : ade.bZ));
      float before = e.aS();
      e.a(ro.j, dmg);
      out("{\"case\":\"armor\",\"armor\":" + e.cl() + ",\"value\":" + e.aV() + ",\"damage\":" + num(dmg) + ",\"lost\":" + num(before - e.aS()) + "}");
    }
    // rider damage is ignored
    {
      clear();
      wi e = typed(1, 0);
      e.i(true); e.n(true);
      player.a((sa) e);
      float before = e.aS();
      boolean r = e.a(ro.a((sv) (yz) player), 4f);
      player.a((sa) null);
      out("{\"case\":\"riderHit\",\"result\":" + r + ",\"lost\":" + num(before - e.aS()) + "}");
      wi f = typed(1, 0);
      before = f.aS();
      boolean r2 = f.a(ro.a((sv) (yz) player), 4f);
      out("{\"case\":\"playerHit\",\"result\":" + r2 + ",\"lost\":" + num(before - f.aS()) + "}");
    }
  }

  static void nbtCases() throws Exception {
    // write: wild, tame saddled armoured horse, chested donkey with items, bred foal
    for (int kind = 0; kind < 4; kind++) {
      clear();
      wi e = typed(5, kind == 2 ? 1 : 0);
      if (kind >= 1) { e.i(true); e.b(player.aB().toString()); e.u(37); }
      if (kind == 1) { e.n(true); e.d(new add(ade.bY)); }
      if (kind == 2) {
        e.l(true);
        MobMoveProbe.method(wi.class, "cN").invoke(e);
        rh inv = (rh) MobMoveProbe.field(wi.class, "bG").get(e);
        inv.a(0, new add(adb.d(329)));
        inv.a(2, new add(adb.d(264), 3));
        inv.a(16, new add(adb.d(1), 7));
      }
      if (kind == 3) { e.k(true); e.m(true); e.c(-6000); }
      dh t = new dh();
      e.b(t);
      out("{\"case\":\"nbtWrite\",\"kind\":" + kind + ",\"horse\":" + horseState(e) + ",\"tag\":" + nbt(t) + "}");
      wi r = horse(9);
      r.a(t);
      out("{\"case\":\"nbtRead\",\"kind\":" + kind + ",\"horse\":" + horseState(r) + ",\"saddled\":" + r.cu() + "}");
    }
    // legacy / odd input
    String[] names = { "legacySaddle", "armourStick", "saddleStick", "armourDiamond" };
    for (int k = 0; k < names.length; k++) {
      wi e = typed(5, 0);
      dh t = new dh();
      t.a("Type", 0); t.a("Variant", 5); t.a("Tame", true); t.a("Temper", 12);
      if (k == 0) t.a("Saddle", true);
      if (k == 1) { dh a = new dh(); new add(adb.d(280)).b(a); t.a("ArmorItem", a); }
      if (k == 2) { dh a = new dh(); new add(adb.d(280)).b(a); t.a("SaddleItem", a); }
      if (k == 3) { dh a = new dh(); new add(ade.bZ).b(a); t.a("ArmorItem", a); }
      wi r = horse(9);
      r.a(t);
      out("{\"case\":\"nbtLegacy\",\"name\":\"" + names[k] + "\",\"horse\":" + horseState(r) + ",\"saddled\":" + r.cu() + "}");
    }
  }

  static void anim() throws Exception {
    String[] fl = { "bJ", "bK", "bL", "bM", "bN", "bO" };
    String[] modes = { "rear", "eat", "mouth", "idle" };
    for (String mode : modes) {
      wi e = typed(5, 0);
      e.i(true);
      Method h = MobMoveProbe.method(wi.class, "h");
      if (mode.equals("rear")) e.p(true);
      if (mode.equals("eat")) e.e(true);
      if (mode.equals("mouth")) MobMoveProbe.method(wi.class, "cS").invoke(e);
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 40; i++) {
        h.invoke(e);
        StringBuilder row = new StringBuilder("{\"rear\":" + e.cn() + ",\"eat\":" + e.cm() + ",\"p\":" + num(e.p(0.5f)) + ",\"q\":" + num(e.q(0.5f)) + ",\"r\":" + num(e.r(0.5f)) + ",\"bp\":" + MobMoveProbe.field(wi.class, "bp").getInt(e) + ",\"bq\":" + MobMoveProbe.field(wi.class, "bq").getInt(e));
        for (String f : fl) row.append(",\"" + f + "\":" + num(MobMoveProbe.fl(e, f)));
        rows.append(i > 0 ? "," : "").append(row).append("}");
      }
      out("{\"case\":\"anim\",\"mode\":\"" + mode + "\",\"ticks\":[" + rows + "]}");
    }
  }

  static void model() throws Exception {
    out(dumpParts("rest", new bhs(), ""));
  }
}
