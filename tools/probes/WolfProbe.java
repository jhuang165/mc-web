import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

// Runs the unchanged EntityWolf (wv), EntityTameable (tg), EntityAnimal (wf), ModelWolf (bio) and the
// ItemFood/ItemDye logic of the 1.7.10 JAR on top of the MobMoveProbe world double. The wolf is built with
// its real constructor (its AI task lists are left alone, they are never ticked). The fake player is an
// uninitialised EntityPlayer (yz) with an inventory, abilities and a UUID. One JSON object per line:
//   facts      constructor size, attribute bases, datawatcher defaults, eye height, max spawn group
//   tail       ch() (the tail angle) for wild, angry and tamed wolves at health 0..20
//   interact   wv.a(yz) for a bone on a wild wolf (seeded Entity.rand: tamed or not, status byte, health,
//              owner, sitting wish), a bone on an angry wolf, meat, dye and an empty hand on tamed wolves
//   sound      wv.t() (living sound) for seeded Entity.rand in wild, angry, tamed, hurt tamed states
//   hurt       wv.a(ro, F): the damage rule for attackers (player, mob, arrow) and the sitting wish
//   attack     wv.n(sa) against a sheep: wild and tamed damage dealt
//   shake      wet shake: e() starting it (status 8), then h() ticks of bu/bv and the splash particle counts
//   angles     p(F), g(F, F), q(F) for a grid of shake timers
//   child      wv.b(rx) of tamed and wild parents
//   mate       wv.a(wf) canMateWith over tamed, sitting, love combinations
//   target     wv.a(sv, sv) shouldAttackEntity for the creeper, a sheep, an own wolf, another's wolf
//   dye        BlockColored.func_150032_b over the metadata 0..15 and ItemFood facts (wolf's favourite meat, heal)
//   model      ModelWolf parts at rest, then after setLivingAnimations / setRotationAngles for the wolf states
public class WolfProbe {
  public static class World extends MobMoveProbe.ProbeWorld {
    static List<String> sounds = new ArrayList<>();
    static List<String> particles = new ArrayList<>();
    static List<Integer> states = new ArrayList<>();
    static yz player;
    public boolean d(sa entity) { return true; }
    public void a(sa entity, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public void a(sa entity, byte state) { states.add((int) state); }
    static bac board = new bac();
    public bac W() { return board; }
    public yz a(UUID id) { return player != null && id.equals(player.aB()) ? player : null; }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { particles.add(name + "|" + y); }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
  }

  public static abstract class FakePlayerBase extends yz { FakePlayerBase() { super(null, null); } }
  public static class FakePlayer extends FakePlayerBase {
    FakePlayer() { super(); }
    public add be() { return null; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public boolean a(int level, String command) { return true; }
    public void a(fj message) {}
    public r f_() { return null; }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }

  static wv wolf(World w, long seed) throws Exception {
    wv e = new wv(w);
    MobMoveProbe.set(e, "Z", new Random(seed));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64.0, 0.0, 64.0);
    MobMoveProbe.set(e, "D", true);
    return e;
  }

  static World W;
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
    return p;
  }

  static void hold(yz p, add stack) throws Exception { ((yx) MobMoveProbe.field(yz.class, "bm").get(p)).a[0] = stack; }
  static add held(yz p) throws Exception { return ((yx) MobMoveProbe.field(yz.class, "bm").get(p)).a[0]; }

  static void setHealth(sv e, float h) throws Exception { e.g(h); MobMoveProbe.method(wv.class, "bp").invoke(e); }
  static boolean tamed(wv e) { return e.bZ(); }
  static String bool(boolean b) { return b ? "true" : "false"; }
  static String str(String s) { return "\"" + (s == null ? "" : s) + "\""; }

  static boolean sitWish(wv e) throws Exception {
    vh sit = e.cc();
    return MobMoveProbe.b(sit, "b");
  }

  static String stack(add s) { return s == null ? "null" : "{\"id\":" + adb.b(s.b()) + ",\"damage\":" + s.k() + ",\"count\":" + s.b + "}"; }

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

  static String wolfState(wv e) throws Exception {
    return "{\"tamed\":" + e.bZ() + ",\"angry\":" + e.ci() + ",\"sitting\":" + e.ca() + ",\"sitWish\":" + sitWish(e)
      + ",\"health\":" + num(e.aS()) + ",\"maxHealth\":" + num(((ti) e.a(yj.a)).e()) + ",\"owner\":" + str(e.b()) + ",\"collar\":" + e.cj() + ",\"begging\":" + e.ck() + "}";
  }

  static String dumpParts(String tag, bio m, wv e, String extra) throws Exception {
    StringBuilder b = new StringBuilder("{\"case\":\"model\",\"tag\":\"" + tag + "\"" + extra + ",\"parts\":{");
    boolean first = true;
    for (Field f : bio.class.getDeclaredFields()) {
      if (f.getType() != bix.class) continue;
      f.setAccessible(true);
      if (!first) b.append(',');
      first = false;
      b.append("\"" + f.getName() + "\":" + ModelProbe.part((bix) f.get(m)));
    }
    return b.append("}}").toString();
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
    World.player = makePlayer(false);
    yz creative = makePlayer(true);

    // facts
    {
      wv e = wolf(world, 1);
      wv t = wolf(world, 1);
      t.j(true);
      Method eye = MobMoveProbe.method(wv.class, "g");
      System.out.println("{\"case\":\"facts\",\"width\":" + num(MobMoveProbe.fl(e, "M")) + ",\"height\":" + num(MobMoveProbe.fl(e, "N"))
        + ",\"speed\":" + num(((ti) e.a(yj.d)).e()) + ",\"wildMax\":" + num(((ti) e.a(yj.a)).e()) + ",\"wildHealth\":" + num(e.aS())
        + ",\"tamedMax\":" + num(((ti) t.a(yj.a)).e()) + ",\"tamedHealthAfterTaming\":" + num(t.aS())
        + ",\"collarDefault\":" + e.cj() + ",\"eyeHeight\":" + num((Float) eye.invoke(e)) + ",\"maxSpawnGroup\":" + e.bB()
        + ",\"verticalFaceSpeed\":" + e.x() + ",\"wildDefault\":" + wolfState(e) + "}");
      t.k(true);
      System.out.println("{\"case\":\"sittingFaceSpeed\",\"value\":" + t.x() + "}");
    }

    // tail angle
    {
      StringBuilder rows = new StringBuilder();
      for (int h = 0; h <= 20; h++) {
        wv t = wolf(world, 1); t.j(true); setHealth(t, h);
        rows.append(h > 0 ? "," : "").append(num(t.ch()));
      }
      wv a = wolf(world, 1); a.l(true);
      wv w = wolf(world, 1);
      wv fresh = wolf(world, 1); fresh.j(true);
      System.out.println("{\"case\":\"tail\",\"tamedByHealth\":[" + rows + "],\"angry\":" + num(a.ch()) + ",\"wild\":" + num(w.ch()) + ",\"freshTamed\":" + num(fresh.ch()) + "}");
    }

    // interact
    for (long seed = 0; seed < 300; seed++) {
      World.states.clear();
      wv e = wolf(world, seed);
      hold(World.player, new add(ade.aS, 3));
      boolean r = e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"bone\",\"seed\":" + seed + ",\"result\":" + r + ",\"states\":" + ints(World.states) + ",\"held\":" + stack(held(World.player)) + ",\"wolf\":" + wolfState(e) + "}");
    }
    {
      wv e = wolf(world, 5); e.l(true);
      hold(World.player, new add(ade.aS, 3));
      boolean r = e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"boneAngry\",\"seed\":5,\"result\":" + r + ",\"held\":" + stack(held(World.player)) + ",\"wolf\":" + wolfState(e) + "}");
    }
    {
      wv e = wolf(world, 5);
      hold(World.player, new add(ade.aS, 1));
      e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"boneLast\",\"result\":null,\"held\":" + stack(held(World.player)) + "}");
    }
    // meat on a tamed wolf: raw pork, steak, chicken, rotten flesh, fish (not wolf's meat), bread (not meat)
    int[] foodIds = { 319, 320, 363, 364, 365, 366, 367, 349, 297, 260 };
    for (int foodId : foodIds) {
      adb food = adb.d(foodId);
      for (int hp : new int[] { 10, 19, 20 }) {
        wv e = wolf(world, 7); e.j(true); e.b(World.player.aB().toString()); setHealth(e, hp);
        hold(World.player, new add(food, 2));
        boolean r = e.a(World.player);
        boolean favourite = food instanceof acx && ((acx) food).i();
        int heal = food instanceof acx ? ((acx) food).g(new add(food, 1)) : -1;
        System.out.println("{\"case\":\"interact\",\"kind\":\"meat\",\"item\":" + adb.b(food) + ",\"favourite\":" + favourite + ",\"heal\":" + heal + ",\"startHealth\":" + hp + ",\"result\":" + r + ",\"held\":" + stack(held(World.player)) + ",\"wolf\":" + wolfState(e) + "}");
      }
    }
    // dye
    for (int dmg = 0; dmg < 16; dmg++) {
      wv e = wolf(world, 7); e.j(true); e.b(World.player.aB().toString());
      hold(World.player, new add(ade.aR, 2, dmg));
      boolean r = e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"dye\",\"damage\":" + dmg + ",\"result\":" + r + ",\"held\":" + stack(held(World.player)) + ",\"wolf\":" + wolfState(e) + "}");
    }
    {
      wv e = wolf(world, 7); e.j(true); e.b(World.player.aB().toString());
      hold(World.player, new add(ade.aR, 2, 1)); // red dye is damage 1 -> colour 14, the default: not consumed
      boolean r = e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"dyeSame\",\"result\":" + r + ",\"held\":" + stack(held(World.player)) + ",\"wolf\":" + wolfState(e) + "}");
    }
    {
      wv e = wolf(world, 7); e.j(true); e.b(World.player.aB().toString());
      hold(World.player, new add(ade.aR, 2, 4));
      e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"dyeCreative\",\"held\":" + stack(held(World.player)) + "}");
      hold(creative, new add(ade.aR, 2, 4));
      wv c = wolf(world, 7); c.j(true); c.b(creative.aB().toString());
      c.a(creative);
      System.out.println("{\"case\":\"interact\",\"kind\":\"dyeCreativePlayer\",\"held\":" + stack(held(creative)) + ",\"wolf\":" + wolfState(c) + "}");
    }
    // sit toggle: owner with an empty hand and with a stick; a non-owner; twice
    {
      wv e = wolf(world, 7); e.j(true); e.b(World.player.aB().toString());
      hold(World.player, null);
      boolean r1 = e.a(World.player);
      String s1 = wolfState(e);
      e.cc().c(); // the Sit task starts on the next AI pass: k(true)
      boolean r2 = e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"sit\",\"first\":{\"result\":" + r1 + ",\"wolf\":" + s1 + "},\"second\":{\"result\":" + r2 + ",\"wolf\":" + wolfState(e) + "}}");
      wv o = wolf(world, 7); o.j(true); o.b(new UUID(9L, 9L).toString());
      boolean r3 = o.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"sitStranger\",\"result\":" + r3 + ",\"wolf\":" + wolfState(o) + "}");
      wv m = wolf(world, 7); m.j(true); m.b(World.player.aB().toString());
      hold(World.player, new add(adb.d(363), 2));
      setHealth(m, 20);
      boolean r4 = m.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"sitWithBreedItem\",\"result\":" + r4 + ",\"wolf\":" + wolfState(m) + ",\"inLove\":" + m.ce() + ",\"held\":" + stack(held(World.player)) + "}");
      wv st = wolf(world, 7); st.j(true); st.b(World.player.aB().toString());
      hold(World.player, new add(adb.d(280), 1));
      boolean r5 = st.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"sitWithStick\",\"result\":" + r5 + ",\"wolf\":" + wolfState(st) + "}");
    }

    // living sound
    Method say = MobMoveProbe.method(wv.class, "t");
    for (int mode = 0; mode < 5; mode++)
      for (long seed = 0; seed < 60; seed++) {
        wv e = wolf(world, seed);
        if (mode == 1) e.l(true);
        if (mode >= 2) { e.j(true); }
        if (mode == 3) setHealth(e, 5);
        if (mode == 4) setHealth(e, 10);
        System.out.println("{\"case\":\"sound\",\"mode\":" + mode + ",\"seed\":" + seed + ",\"say\":" + str((String) say.invoke(e)) + "}");
      }
    {
      wv e = wolf(world, 1);
      System.out.println("{\"case\":\"soundFixed\",\"hurt\":" + str((String) MobMoveProbe.method(wv.class, "aT").invoke(e)) + ",\"death\":" + str((String) MobMoveProbe.method(wv.class, "aU").invoke(e))
        + ",\"volume\":" + num((Float) MobMoveProbe.method(wv.class, "bf").invoke(e)) + "}");
      World.sounds.clear();
      MobMoveProbe.method(wv.class, "a", int.class, int.class, int.class, aji.class).invoke(e, 1, 1, 1, aji.e(1));
      System.out.println("{\"case\":\"step\",\"sounds\":" + strings(World.sounds) + "}");
    }

    // hurt rule
    {
      yz p = World.player;
      sheepAttackers(world, p);
    }

    // attack
    for (int tamedFlag = 0; tamedFlag < 2; tamedFlag++) {
      wv e = wolf(world, 3);
      if (tamedFlag == 1) e.j(true);
      wp sheep = new wp(world);
      MobMoveProbe.set(sheep, "Z", new Random(1));
      float before = sheep.aS();
      boolean r = e.n(sheep);
      System.out.println("{\"case\":\"attack\",\"tamed\":" + (tamedFlag == 1) + ",\"result\":" + r + ",\"sheepBefore\":" + num(before) + ",\"sheepAfter\":" + num(sheep.aS()) + "}");
    }

    // shake: wet wolf on the ground starts shaking from e() (status 8); h() then counts bu up
    {
      wv e = wolf(world, 11);
      MobMoveProbe.set(e, "bs", true);
      World.states.clear(); World.sounds.clear(); World.particles.clear();
      Method update = MobMoveProbe.method(wv.class, "e");
      update.invoke(e);
      StringBuilder rows = new StringBuilder();
      boolean startedByE = MobMoveProbe.b(e, "bt");
      Method h = MobMoveProbe.method(wv.class, "h");
      // The statuses/handler: wv.a(byte 8) is what a client runs; here the server flag is set directly by e().
      for (int i = 0; i < 70; i++) {
        World.particles.clear();
        h.invoke(e);
        int splashes = 0;
        for (String p : World.particles) if (p.startsWith("splash")) splashes++;
        rows.append(i > 0 ? "," : "").append("{\"bs\":" + MobMoveProbe.b(e, "bs") + ",\"bt\":" + MobMoveProbe.b(e, "bt") + ",\"bu\":" + num(MobMoveProbe.fl(e, "bu")) + ",\"bv\":" + num(MobMoveProbe.fl(e, "bv")) + ",\"splashes\":" + splashes + "}");
        if (!MobMoveProbe.b(e, "bt") && !MobMoveProbe.b(e, "bs")) break;
      }
      System.out.println("{\"case\":\"shake\",\"startedByUpdate\":" + startedByE + ",\"states\":" + ints(World.states) + ",\"sounds\":" + strings(World.sounds) + ",\"ticks\":[" + rows + "]}");
      wv c = wolf(world, 11);
      c.a((byte) 8);
      System.out.println("{\"case\":\"shakeStatus\",\"bt\":" + MobMoveProbe.b(c, "bt") + ",\"bu\":" + num(MobMoveProbe.fl(c, "bu")) + ",\"bv\":" + num(MobMoveProbe.fl(c, "bv")) + "}");
    }

    // angle functions over a grid
    {
      StringBuilder rows = new StringBuilder();
      float[] timers = { 0f, 0.05f, 0.4f, 0.65f, 1.0f, 1.45f, 1.95f, 2.0f };
      float[] partials = { 0f, 0.3f, 1f };
      float[] offsets = { 0f, 0.4f, 1.2f, 2.0f };
      boolean first = true;
      for (float bu : timers) for (float bv : new float[] { 0f, bu > 0.05f ? bu - 0.05f : 0f }) {
        wv e = wolf(world, 11);
        MobMoveProbe.set(e, "bu", bu);
        MobMoveProbe.set(e, "bv", bv);
        for (float p : partials) {
          for (float off : offsets) {
            rows.append(first ? "" : ",").append("{\"bu\":" + num(bu) + ",\"bv\":" + num(bv) + ",\"partial\":" + num(p) + ",\"offset\":" + num(off) + ",\"shake\":" + num(e.g(p, off)) + "}");
            first = false;
          }
          rows.append(",").append("{\"bu\":" + num(bu) + ",\"bv\":" + num(bv) + ",\"partial\":" + num(p) + ",\"shade\":" + num(e.p(p)) + "}");
        }
      }
      StringBuilder interest = new StringBuilder();
      float[][] heads = { { 0f, 0f }, { 0f, 1f }, { 1f, 0f }, { 1f, 1f }, { 0.4f, 0.25f }, { 0.9f, 0.1f } };
      for (int i = 0; i < heads.length; i++) {
        wv e = wolf(world, 11);
        MobMoveProbe.set(e, "bq", heads[i][0]);
        MobMoveProbe.set(e, "br", heads[i][1]);
        for (float p : partials) interest.append(i + 0 == 0 && p == 0f ? "" : ",").append("{\"bq\":" + num(heads[i][0]) + ",\"br\":" + num(heads[i][1]) + ",\"partial\":" + num(p) + ",\"interested\":" + num(e.q(p)) + "}");
      }
      System.out.println("{\"case\":\"angles\",\"shake\":[" + rows + "],\"interested\":[" + interest + "]}");
    }

    // begging head tilt: h() moves bq toward 1 while begging and sets the AI idle counter
    {
      wv e = wolf(world, 11);
      e.m(true);
      Method h = MobMoveProbe.method(wv.class, "h");
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 12; i++) { h.invoke(e); rows.append(i > 0 ? "," : "").append("[" + num(MobMoveProbe.fl(e, "bq")) + "," + num(MobMoveProbe.fl(e, "br")) + "]"); }
      e.m(false);
      for (int i = 0; i < 12; i++) { h.invoke(e); rows.append(",[" + num(MobMoveProbe.fl(e, "bq")) + "," + num(MobMoveProbe.fl(e, "br")) + "]"); }
      System.out.println("{\"case\":\"begging\",\"ticks\":[" + rows + "]}");
    }

    // child
    {
      for (int mode = 0; mode < 3; mode++) {
        wv parent = wolf(world, 3);
        if (mode >= 1) { parent.j(true); parent.b(mode == 2 ? "   " : World.player.aB().toString()); }
        wv other = wolf(world, 4);
        wv child = parent.b(other);
        System.out.println("{\"case\":\"child\",\"mode\":" + mode + ",\"child\":" + wolfState(child) + ",\"age\":" + child.d() + "}");
      }
    }

    // canMateWith
    {
      boolean[] t = { false, true };
      for (int a = 0; a < 2; a++) for (int b = 0; b < 2; b++) for (int sitA = 0; sitA < 2; sitA++) for (int sitB = 0; sitB < 2; sitB++) for (int loveA = 0; loveA < 2; loveA++) for (int loveB = 0; loveB < 2; loveB++) {
        wv x = wolf(world, 1), y = wolf(world, 2);
        if (a == 1) x.j(true);
        if (b == 1) y.j(true);
        if (sitA == 1) x.k(true);
        if (sitB == 1) y.k(true);
        MobMoveProbe.field(wf.class, "bp").setInt(x, loveA * 600);
        MobMoveProbe.field(wf.class, "bp").setInt(y, loveB * 600);
        System.out.println("{\"case\":\"mate\",\"tamedA\":" + t[a] + ",\"tamedB\":" + t[b] + ",\"sitA\":" + (sitA == 1) + ",\"sitB\":" + (sitB == 1) + ",\"loveA\":" + (loveA == 1) + ",\"loveB\":" + (loveB == 1) + ",\"result\":" + x.a((wf) y) + "}");
      }
      wv self = wolf(world, 1); self.j(true); MobMoveProbe.field(wf.class, "bp").setInt(self, 600);
      System.out.println("{\"case\":\"mate\",\"self\":true,\"result\":" + self.a((wf) self) + "}");
      wv x = wolf(world, 1); x.j(true); MobMoveProbe.field(wf.class, "bp").setInt(x, 600);
      wp sheep = new wp(world);
      System.out.println("{\"case\":\"mate\",\"other\":\"sheep\",\"result\":" + x.a((wf) sheep) + "}");
    }

    // shouldAttackEntity
    {
      wv e = wolf(world, 1); e.j(true); e.b(World.player.aB().toString());
      xz creeper = new xz(world);
      wp sheep = new wp(world);
      wv own = wolf(world, 2); own.j(true); own.b(World.player.aB().toString());
      wv other = wolf(world, 3); other.j(true); other.b(new UUID(9L, 9L).toString());
      wv wild = wolf(world, 4);
      System.out.println("{\"case\":\"target\",\"creeper\":" + e.a((sv) creeper, (sv) World.player) + ",\"sheep\":" + e.a((sv) sheep, (sv) World.player) + ",\"ownWolf\":" + e.a((sv) own, (sv) World.player)
        + ",\"otherTamedWolf\":" + e.a((sv) other, (sv) World.player) + ",\"wildWolf\":" + e.a((sv) wild, (sv) World.player) + ",\"ownerAsTarget\":" + e.a((sv) World.player, (sv) World.player) + "}");
    }

    // dye colours and food facts
    {
      StringBuilder dyes = new StringBuilder();
      for (int i = 0; i < 16; i++) dyes.append(i > 0 ? "," : "").append(aka.b(i));
      System.out.println("{\"case\":\"dye\",\"colorOfDamage\":[" + dyes + "]}");
    }

    // model
    {
      bio m = new bio();
      System.out.println(dumpParts("rest", m, null, ""));
      // [name, tamed, sitting, health, shakeBu, shakeBv, begQ, begR, angry]
      Object[][] states = {
        { "wild", false, false, 8f, 0f, 0f, 0f, 0f, false },
        { "tamedFull", true, false, 20f, 0f, 0f, 0f, 0f, false },
        { "tamedHurt", true, false, 6f, 0f, 0f, 0f, 0f, false },
        { "sitting", true, true, 20f, 0f, 0f, 0f, 0f, false },
        { "angry", false, false, 8f, 0f, 0f, 0f, 0f, true },
        { "shaking", false, false, 8f, 0.6f, 0.55f, 0f, 0f, false },
        { "shakingSitting", true, true, 20f, 0.9f, 0.85f, 0f, 0f, false },
        { "begging", false, false, 8f, 0f, 0f, 1f, 1f, false },
      };
      float[][] poses = { { 0f, 0f, 0f, 0f, 0f }, { 1.3f, 0.7f, 50f, 20f, -15f }, { 4.1f, 1f, 123.4f, -35f, 25f } };
      for (Object[] st : states) {
        wv e = wolf(world, 11);
        if ((Boolean) st[1]) e.j(true);
        if ((Boolean) st[2]) e.k(true);
        if ((Boolean) st[8]) e.l(true);
        setHealth(e, (Float) st[3]);
        MobMoveProbe.set(e, "bu", st[4]);
        MobMoveProbe.set(e, "bv", st[5]);
        MobMoveProbe.set(e, "bq", st[6]);
        MobMoveProbe.set(e, "br", st[7]);
        for (float[] pose : poses)
          for (float partial : new float[] { 0f, 0.5f }) {
            bio model = new bio();
            model.a((sv) e, pose[0], pose[1], partial);
            model.a(pose[0], pose[1], pose[2], pose[3], pose[4], 0.0625f, (sa) e);
            System.out.println(dumpParts((String) st[0], model, e, ",\"limbSwing\":" + num(pose[0]) + ",\"limbAmount\":" + num(pose[1]) + ",\"age\":" + num(pose[2])
              + ",\"headYaw\":" + num(pose[3]) + ",\"headPitch\":" + num(pose[4]) + ",\"partial\":" + num(partial)));
          }
      }
    }
  }

  // wv.a(ro, F) with a player, a mob and an arrow as the damage source; the sitting wish is cleared first.
  static void sheepAttackers(World world, yz p) throws Exception {
    wv a = wolf(world, 1);
    wp sheep = new wp(world);
    ro[] sources = { ro.a(p), ro.a((sv) sheep), ro.j, ro.h, ro.a((zc) null, null) };
    String[] names = { "player", "mob", "generic", "fall", "arrowNoOwner" };
    for (int i = 0; i < sources.length; i++) {
      if (sources[i] == null) continue;
      wv e = wolf(world, 1);
      e.j(true);
      e.b(p.aB().toString());
      e.cc().a(true);
      boolean r;
      try { r = e.a(sources[i], 5f); } catch (Exception ex) { continue; }
      System.out.println("{\"case\":\"hurt\",\"source\":\"" + names[i] + "\",\"result\":" + r + ",\"health\":" + num(e.aS()) + ",\"sitWish\":" + sitWish(e) + "}");
    }
  }
}
