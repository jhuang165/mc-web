import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

// Runs the unchanged EntityPig (wo), EntityAIControlledByPlayer (ub), ItemSaddle (adt) and ItemCarrotOnAStick (abp) of the
// 1.7.10 JAR on the HorseProbe/MobMoveProbe world double (stone below y 0, an optional one-block wall at z >= 2). The pig
// is built with its real constructor; its task list is never ticked, so ub's methods are called directly. The rider is
// an uninitialised EntityPlayer whose held stack is its current inventory slot. One JSON object per line:
//   facts     size, mounted offset, attributes, task priorities and classes, item stack sizes and durability
//   interact  wo.a(yz) over saddled/unsaddled, a free or taken seat and the held item (mount, feed, nothing)
//   saddle    ItemSaddle.itemInteractionForEntity and hitEntity over pigs (adult, child, saddled) and a cow
//   steer     wo.bE (canBeSteered) and ub.a (shouldExecute) by held item and boost
//   ride      ub.e() then onLivingUpdate's jump and e(0, 0) per tick: speed ramp, turn, step jump, boost, wear, break
//   use       ItemCarrotOnAStick.onItemRightClick riding or not, by ub speed and durability
//   drops     wo.b(boolean, int) items by seed, saddle, fire and looting
//   nbt       wo.b(dh) Saddle tag and the a(dh) read-back
public class PigSaddleProbe {
  public static class Player extends HorseProbe.FakePlayer {
    Player() { super(); }
    public add be() { yx inv = inv(this); return inv.a[inv.c]; }
    public void a(ph stat, int n) {}
    public void a(ph stat) {}
    public void bG() {}
  }
  static yx inv(yz p) { try { return (yx) MobMoveProbe.field(yz.class, "bm").get(p); } catch (Exception e) { throw new RuntimeException(e); } }

  static void out(String s) { System.out.println(s); }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static HorseProbe.World W;

  static yz makePlayer(boolean creative) throws Exception {
    yz p = (yz) u.allocateInstance(Player.class);
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
    MobMoveProbe.field(sv.class, "f").set(p, new java.util.HashMap());
    return p;
  }
  static void hold(yz p, add s) { inv(p).a[inv(p).c] = s; }
  static add held(yz p) { return inv(p).a[inv(p).c]; }
  static String stack(add s) { return s == null ? "null" : "{\"id\":" + adb.b(s.b()) + ",\"damage\":" + s.k() + ",\"count\":" + s.b + (s.d != null ? ",\"tag\":true" : "") + "}"; }
  static void clear() { HorseProbe.World.sounds.clear(); HorseProbe.World.states.clear(); HorseProbe.World.items.clear(); HorseProbe.FakePlayer.mounts = 0; }

  static wo pig(long seed, double x, double y, double z) throws Exception {
    wo e = new wo(W);
    MobMoveProbe.set(e, "Z", new Random(seed));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    MobMoveProbe.set(e, "D", true);
    return e;
  }
  static wo pig(long seed) throws Exception { return pig(seed, 64.5, 0.0, 64.5); }
  static Field fieldOf(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static float ubC(ub t) throws Exception { return fieldOf(ub.class, "c").getFloat(t); }
  static String ubState(ub t) throws Exception {
    return "{\"speed\":" + num(ubC(t)) + ",\"boosted\":" + fieldOf(ub.class, "d").getBoolean(t) + ",\"boostTime\":" + fieldOf(ub.class, "e").getInt(t) + ",\"maxBoostTime\":" + fieldOf(ub.class, "f").getInt(t) + "}";
  }
  static void ride(yz p, sa e) { p.a(e); }
  static void unride(yz p) { p.a((sa) null); }
  static int rand(wo e) throws Exception { return ((Random) MobMoveProbe.field(sa.class, "Z").get(e)).nextInt(1 << 30); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    W = world;
    HorseProbe.W = world;
    facts();
    interact();
    saddle();
    steer();
    rideCases();
    use();
    drops();
    nbt();
  }

  static void facts() throws Exception {
    wo e = pig(1);
    StringBuilder tasks = new StringBuilder("[");
    Object list = MobMoveProbe.field(sw.class, "c").get(e);
    List entries = (List) MobMoveProbe.field(list.getClass(), "b").get(list);
    for (int i = 0; i < entries.size(); i++) {
      Object entry = entries.get(i);
      Field action = null, prio = null;
      for (Field f : entry.getClass().getDeclaredFields()) { f.setAccessible(true); if (f.getType() == int.class) prio = f; else if (ui.class.isAssignableFrom(f.getType())) action = f; }
      ui a = (ui) action.get(entry);
      tasks.append(i > 0 ? "," : "").append("{\"priority\":" + prio.getInt(entry) + ",\"class\":\"" + a.getClass().getName() + "\",\"mutex\":" + a.j() + "}");
    }
    tasks.append("]");
    ub t = e.ca();
    out("{\"case\":\"facts\",\"width\":" + num(MobMoveProbe.fl(e, "M")) + ",\"height\":" + num(MobMoveProbe.fl(e, "N")) + ",\"mountedOffset\":" + num(e.ae())
      + ",\"maxHealth\":" + num(((ti) e.a(yj.a)).e()) + ",\"speed\":" + num(((ti) e.a(yj.d)).e()) + ",\"ubMaxSpeed\":" + num(fieldOf(ub.class, "b").getFloat(t)) + ",\"ubMutex\":" + t.j()
      + ",\"tasks\":" + tasks + ",\"stick\":{\"id\":" + adb.b(ade.bM) + ",\"maxDamage\":" + ade.bM.o() + ",\"maxStack\":" + ade.bM.m() + ",\"full3D\":" + ade.bM.f() + "},\"saddle\":{\"id\":" + adb.b(ade.av) + ",\"maxStack\":" + ade.av.m() + "}}");
  }

  static void interact() throws Exception {
    // saddled, seat (0 free, 1 this player, 2 another player), held item id (0 none), age
    Object[][] sc = { { false, 0, 0, 0 }, { true, 0, 0, 0 }, { true, 2, 0, 0 }, { true, 0, 391, 0 }, { false, 0, 391, 0 }, { true, 0, 329, 0 }, { true, 0, 398, 0 }, { true, 0, 391, 6000 }, { true, 1, 0, 0 } };
    for (Object[] s : sc) {
      clear();
      yz p = makePlayer(false), other = makePlayer(false);
      wo e = pig(3);
      e.i((Boolean) s[0]);
      e.c((Integer) s[3]);
      int item = (Integer) s[2];
      hold(p, item == 0 ? null : new add(adb.d(item), item == 391 ? 3 : 1));
      if ((Integer) s[1] == 2) ride(other, e);
      if ((Integer) s[1] == 1) ride(p, e);
      boolean r = e.a(p);
      Object rider = MobMoveProbe.field(sa.class, "l").get(e);
      out("{\"case\":\"interact\",\"saddled\":" + s[0] + ",\"seat\":" + s[1] + ",\"item\":" + item + ",\"age\":" + s[3] + ",\"result\":" + r + ",\"rider\":\"" + (rider == p ? "player" : rider == other ? "other" : rider == null ? "none" : "?")
        + "\",\"held\":" + stack(held(p)) + ",\"inLove\":" + e.ce() + ",\"sounds\":" + HorseProbe.strings(HorseProbe.World.sounds) + "}");
    }
  }

  static void saddle() throws Exception {
    // target (pig/cow), saddled, age, stack count, hit (true) or use
    Object[][] sc = { { "pig", false, 0, 1, false }, { "pig", true, 0, 1, false }, { "pig", false, -24000, 1, false }, { "cow", false, 0, 1, false }, { "pig", false, 0, 2, false },
      { "pig", false, 0, 1, true }, { "pig", true, 0, 1, true }, { "pig", false, -24000, 1, true }, { "cow", false, 0, 1, true } };
    for (Object[] s : sc) {
      clear();
      yz p = makePlayer(false);
      sv target;
      if (s[0].equals("pig")) { wo e = pig(4); e.i((Boolean) s[1]); e.c((Integer) s[2]); target = e; }
      else { target = new wh(W); }
      add st = new add(ade.av, (Integer) s[3]);
      boolean r = (Boolean) s[4] ? ade.av.a(st, target, p) : ade.av.a(st, p, target);
      out("{\"case\":\"saddle\",\"target\":\"" + s[0] + "\",\"saddled\":" + s[1] + ",\"age\":" + s[2] + ",\"count\":" + s[3] + ",\"hit\":" + s[4] + ",\"result\":" + r
        + ",\"after\":" + (target instanceof wo ? ((wo) target).bZ() : false) + ",\"stack\":" + st.b + ",\"sounds\":" + HorseProbe.strings(HorseProbe.World.sounds) + "}");
    }
  }

  static void steer() throws Exception {
    // held item (0 none), boosted, rider (player/none), pig health
    Object[][] sc = { { 398, false, true, 10f }, { 0, false, true, 10f }, { 391, false, true, 10f }, { 346, false, true, 10f }, { 0, true, true, 10f }, { 398, false, false, 10f }, { 398, false, true, 0f } };
    for (Object[] s : sc) {
      yz p = makePlayer(false);
      wo e = pig(5);
      e.i(true);
      int item = (Integer) s[0];
      hold(p, item == 0 ? null : new add(adb.d(item)));
      if ((Boolean) s[2]) ride(p, e);
      if ((Boolean) s[1]) fieldOf(ub.class, "d").setBoolean(e.ca(), true);
      e.g((Float) s[3]);
      boolean steer = (Boolean) s[2] ? e.bE() : false;
      out("{\"case\":\"steer\",\"item\":" + item + ",\"boosted\":" + s[1] + ",\"ridden\":" + s[2] + ",\"health\":" + num((Float) s[3]) + ",\"canSteer\":" + steer + ",\"shouldExecute\":" + e.ca().a() + "}");
      unride(p);
    }
  }

  // One onLivingUpdate of a ridden pig: prev pos, the jump timer, motion snap, ub.e() (with its own e(0, speed)), the
  // move helper's moveForward = 0, the jump helper, the jump, then e(strafe * 0.98, 0).
  static void tick(wo e, ub t) throws Exception {
    MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s"));
    MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t"));
    MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
    Field jt = fieldOf(sv.class, "bq"), jumping = fieldOf(sv.class, "bc");
    if (jt.getInt(e) > 0) jt.setInt(e, jt.getInt(e) - 1);
    for (String v : new String[] { "v", "w", "x" }) if (Math.abs(MobMoveProbe.d(e, v)) < 0.005) MobMoveProbe.set(e, v, 0.0);
    t.e();
    fieldOf(sv.class, "be").setFloat(e, 0f);
    e.l().b();
    if (jumping.getBoolean(e)) {
      if (MobMoveProbe.b(e, "D") && jt.getInt(e) == 0) { MobMoveProbe.method(sv.class, "bj").invoke(e); jt.setInt(e, 10); }
    } else jt.setInt(e, 0);
    e.e(fieldOf(sv.class, "bd").getFloat(e) * 0.98f, 0f);
  }

  static void rideCases() throws Exception {
    // name, seed, player yaw, pig yaw, aiMoveSpeed, step wall, boost tick (-1 none), stick damage, creative, ticks, start z
    Object[][] sc = {
      { "flat", 7L, 0f, 0f, 0.25f, 0, -1, 0, false, 220, 64.5 },
      { "turn", 8L, 90f, 0f, 0.25f, 0, -1, 0, false, 60, 64.5 },
      { "turnBack", 8L, -170f, 30f, 0.3f, 0, -1, 0, false, 60, 64.5 },
      { "noAiSpeed", 9L, 0f, 0f, 0f, 0, -1, 0, false, 20, 64.5 },
      { "tempted", 10L, 45f, 45f, 0.3f, 0, -1, 0, false, 120, 64.5 },
      { "step", 11L, 0f, 0f, 0.25f, 1, -1, 0, false, 160, -6.5 },
      { "wall2", 12L, 0f, 0f, 0.25f, 2, -1, 0, false, 160, -6.5 },
      { "boost", 13L, 0f, 0f, 0.25f, 0, 40, 0, false, 260, 64.5 },
      { "wearBreak", 14L, 0f, 0f, 0.25f, 0, -1, 24, false, 400, 64.5 },
      { "creative", 14L, 0f, 0f, 0.25f, 0, -1, 24, true, 400, 64.5 },
    };
    for (Object[] s : sc) {
      clear();
      MobMoveProbe.step = (Integer) s[5];
      yz p = makePlayer((Boolean) s[8]);
      wo e = pig((Long) s[1], 0.5, 0.0, (Double) s[10]);
      e.i(true);
      MobMoveProbe.set(e, "y", (Float) s[3]);
      e.i((Float) s[4]);
      fieldOf(sv.class, "be").setFloat(e, 0f);
      add stick = new add(ade.bM);
      stick.b((Integer) s[7]);
      hold(p, stick);
      MobMoveProbe.set(p, "y", (Float) s[2]);
      ride(p, e);
      ub t = e.ca();
      t.c();
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < (Integer) s[9]; i++) {
        if (i == (Integer) s[6]) t.g();
        tick(e, t);
        rows.append(i > 0 ? "," : "").append("{\"pig\":" + MobMoveProbe.state(e) + ",\"yaw\":" + num(MobMoveProbe.fl(e, "y")) + ",\"ub\":" + ubState(t) + ",\"jumping\":" + fieldOf(sv.class, "bc").getBoolean(e) + ",\"held\":" + stack(held(p)) + "}");
      }
      unride(p);
      MobMoveProbe.step = 0;
      out("{\"case\":\"ride\",\"name\":\"" + s[0] + "\",\"seed\":" + s[1] + ",\"playerYaw\":" + num((Float) s[2]) + ",\"pigYaw\":" + num((Float) s[3]) + ",\"aiMoveSpeed\":" + num((Float) s[4])
        + ",\"step\":" + s[5] + ",\"boostAt\":" + s[6] + ",\"damage\":" + s[7] + ",\"creative\":" + s[8] + ",\"z\":" + num((Double) s[10]) + ",\"nextInt\":" + rand(e) + ",\"sounds\":" + HorseProbe.strings(HorseProbe.World.sounds) + ",\"ticks\":[" + rows + "]}");
    }
  }

  static void use() throws Exception {
    // riding (0 no, 1 pig, 2 horse), ub speed, boosted, stick damage, seed
    Object[][] sc = { { 0, 0.3f, false, 0, 1L }, { 1, 0f, false, 0, 1L }, { 1, 0.09f, false, 0, 1L }, { 1, 0.0901f, false, 0, 2L }, { 1, 0.3f, false, 0, 3L }, { 1, 0.3f, true, 0, 4L },
      { 1, 0.3f, false, 18, 5L }, { 1, 0.3f, false, 19, 6L }, { 1, 0.3f, false, 25, 7L }, { 2, 0.3f, false, 0, 8L } };
    for (Object[] s : sc) {
      clear();
      yz p = makePlayer(false);
      wo e = pig((Long) s[4]);
      e.i(true);
      int mode = (Integer) s[0];
      if (mode == 1) ride(p, e);
      if (mode == 2) ride(p, HorseProbe.horse(1));
      ub t = e.ca();
      fieldOf(ub.class, "c").setFloat(t, (Float) s[1]);
      fieldOf(ub.class, "d").setBoolean(t, (Boolean) s[2]);
      add stick = new add(ade.bM);
      stick.b((Integer) s[3]);
      hold(p, stick);
      add r = ade.bM.a(stick, W, p);
      out("{\"case\":\"use\",\"riding\":" + mode + ",\"speed\":" + num((Float) s[1]) + ",\"boosted\":" + s[2] + ",\"damage\":" + s[3] + ",\"seed\":" + s[4] + ",\"result\":" + stack(r) + ",\"same\":" + (r == stick)
        + ",\"stick\":" + stack(stick) + ",\"ub\":" + ubState(t) + ",\"sounds\":" + HorseProbe.strings(HorseProbe.World.sounds) + "}");
      unride(p);
    }
  }

  static void drops() throws Exception {
    for (long seed = 1; seed <= 6; seed++) for (boolean saddled : new boolean[] { false, true }) for (int looting : new int[] { 0, 2 }) for (boolean fire : new boolean[] { false, true }) {
      if (fire && looting > 0) continue;
      clear();
      wo e = pig(seed);
      e.i(saddled);
      if (fire) e.e(8);
      MobMoveProbe.method(wo.class, "b", boolean.class, int.class).invoke(e, true, looting);
      out("{\"case\":\"drops\",\"seed\":" + seed + ",\"saddled\":" + saddled + ",\"looting\":" + looting + ",\"fire\":" + fire + ",\"items\":" + HorseProbe.strings(HorseProbe.World.items) + ",\"nextInt\":" + rand(e) + "}");
    }
  }

  static void nbt() throws Exception {
    for (boolean saddled : new boolean[] { false, true }) {
      wo e = pig(1);
      e.i(saddled);
      dh t = new dh();
      e.b(t);
      wo back = pig(2);
      back.a(t);
      out("{\"case\":\"nbt\",\"saddled\":" + saddled + ",\"tag\":" + (t.c("Saddle") ? "\"" + t.a("Saddle") + "\"" : "null") + ",\"id\":" + (t.c("Saddle") ? t.a("Saddle").a() : -1) + ",\"back\":" + back.bZ() + "}");
    }
    dh empty = new dh();
    wo back = pig(2);
    back.i(true);
    back.a(empty);
    out("{\"case\":\"nbtMissing\",\"back\":" + back.bZ() + "}");
  }
}
