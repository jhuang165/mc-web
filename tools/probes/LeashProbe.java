import java.util.List;
import java.util.Random;

// Drives the unchanged 1.7.10 EntityCreature.updateLeashedState (td.bL, calling EntityLiving.updateLeashedState sw.bL),
// EntityLeashKnot (su, an EntityHanging ss), ItemLead.func_150909_a (adf.a) and the Leash NBT of EntityLiving (sw.b / sw.a)
// on the HorseGearProbe world double. One JSON object per line:
//   path       td.bL per mob (pig, horse, sitting wolf, standing wolf) and holder distance: leashed, navigator path and speed,
//              home radius and cell (setHomeArea), the EntityAIMoveTowardsRestriction (ut) task and the avoid-water flag, motion
//   release    the tick after the lead is removed: home detached, task removed, avoid-water restored
//   homeCell   the home cell for a holder at fractional / negative coordinates (d2i truncation)
//   eating     EntityHorse.func_142017_o (wi.o(F)): a grazing horse stops beyond 6 blocks
//   knotLife   su.h (EntityHanging.onUpdate) over 400 ticks: when a knot with or without mobs dies after the fence goes
//   knotValid  su.e (onValidSurface) for fence, nether fence, gate, stone and air
//   fenceBreak a leashed pig, the fence removed: the tick the knot dies and the lead drops
//   knotHit    su.a(DamageSource, float): the knot dies without a drop and the mob loses its lead on the next tick
//   knotClick2 su.c(EntityPlayer) with the player's own leashed mobs near and far
//   fenceClick adf.a(player, world, x, y, z) with an existing knot: reuse, no new knot, no kill
//   nbt        sw.b write of the Leash compound for a player and a knot holder, su.d (writeToNBTOptional) refusing to save, and
//              sw.a read back with sw.bL restoring the holder (new or existing knot, absent fence, player UUID and range)
public class LeashProbe {
  static void out(String s) { System.out.println(s); }
  static String str(String s) { return HorseProbe.str(s); }
  static String f(double v) { return Double.toString(v); }

  static sw mob(String kind) throws Exception {
    sw e;
    if (kind.equals("horse")) e = HorseGearProbe.gearHorse(0, false);
    else if (kind.startsWith("wolf")) { e = new wv(HorseProbe.W); MobMoveProbe.set(e, "Z", new Random(3)); }
    else { e = new wo(HorseProbe.W); MobMoveProbe.set(e, "Z", new Random(3)); }
    HorseGearProbe.at(e, 0, 0, 0);
    e.b(0.0, 0.0, 0.0); // setPosition: the path starts from the bounding box
    MobMoveProbe.set(e, "D", true); // onGround: PathNavigate.canNavigate needs it
    if (kind.equals("wolfSitting")) { ((tg) e).j(true); ((tg) e).k(true); } // setTamed, setSitting
    return e;
  }
  // HorseProbe.FakePlayer answers getHeldItem (yz.be) with null; su.c reads it, so the held lead needs a player that returns the slot.
  public static class LeashPlayer extends HorseProbe.FakePlayer {
    public add be() { try { return HorseProbe.held(this); } catch (Exception x) { throw new RuntimeException(x); } }
  }
  static yz player(boolean creative) throws Exception {
    yz p = (yz) HorseGearProbe.u.allocateInstance(LeashPlayer.class);
    yx inv = (yx) HorseGearProbe.u.allocateInstance(yx.class);
    inv.a = new add[40];
    inv.c = 0;
    inv.d = p;
    MobMoveProbe.set(p, "bm", inv);
    yw abilities = (yw) HorseGearProbe.u.allocateInstance(yw.class);
    abilities.d = creative;
    MobMoveProbe.set(p, "bE", abilities);
    MobMoveProbe.set(p, "ar", new java.util.UUID(1L, 2L));
    MobMoveProbe.set(p, "o", HorseProbe.W);
    MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(new java.util.UUID(1L, 2L), "Player"));
    MobMoveProbe.set(p, "Z", new Random(5));
    MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(p, "L", 1.62f);
    MobMoveProbe.set(p, "M", 0.6f);
    MobMoveProbe.set(p, "N", 1.8f);
    HorseGearProbe.at(p, 0, 0, 0);
    return p;
  }
  static boolean tdBool(sw e, String name) throws Exception { return MobMoveProbe.field(td.class, name).getBoolean(e); }
  static String nav(sw e) throws Exception {
    vv n = e.m();
    ayf p = n.e();
    double speed = MobMoveProbe.field(vv.class, "d").getDouble(n);
    return "\"followRange\":" + n.d() + ",\"hasPath\":" + (p != null && !n.g()) + ",\"navSpeed\":" + (p == null ? 0 : speed) + ",\"avoidsWater\":" + n.a();
  }
  static String task(sw e) throws Exception {
    uj list = (uj) MobMoveProbe.field(sw.class, "c").get(e);
    List<?> entries = (List<?>) MobMoveProbe.field(uj.class, "b").get(list);
    int n = 0, pri = -1;
    double speed = 0;
    for (Object o : entries) {
      uk k = (uk) o;
      if (k.a instanceof ut) { n++; pri = k.b; speed = MobMoveProbe.field(ut.class, "e").getDouble(k.a); }
    }
    return "\"restrictionTasks\":" + n + ",\"restrictionPriority\":" + pri + ",\"restrictionSpeed\":" + speed;
  }
  static String home(sw e) throws Exception {
    r pos = (r) MobMoveProbe.field(td.class, "bq").get(e);
    return "\"homeRadius\":" + MobMoveProbe.field(td.class, "br").getFloat(e) + ",\"home\":[" + pos.a + "," + pos.b + "," + pos.c + "]";
  }
  static String state(sw e) throws Exception {
    return "\"leashed\":" + e.bN() + ",\"taskFlag\":" + tdBool(e, "bt") + "," + home(e) + "," + task(e) + "," + nav(e) + ",\"motion\":" + HorseGearProbe.vec(e)
      + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items);
  }
  static void bL(sw e) throws Exception { MobMoveProbe.method(sw.class, "bL").invoke(e); }
  static void reset() { HorseProbe.clear(); HorseGearProbe.GW.entities.clear(); HorseGearProbe.GW.fx = Integer.MIN_VALUE; HorseGearProbe.GW.fid = 85; }
  static void fence(int x, int y, int z) { HorseGearProbe.GW.fx = x; HorseGearProbe.GW.fy = y; HorseGearProbe.GW.fz = z; }
  static boolean dead(sa e) throws Exception { return MobMoveProbe.b(e, "K"); }
  static int knots() throws Exception { int n = 0; for (sa e : HorseGearProbe.GW.entities) if (e instanceof su && !dead(e)) n++; return n; }

  static void path() throws Exception {
    for (String kind : new String[] { "pig", "horse", "wolfSitting", "wolfStanding" })
      for (double dist : new double[] { 1, 3.9, 4.0, 4.1, 5.9, 6.0, 6.1, 8, 9.9, 10.0, 10.1, 12 }) for (double dy : new double[] { 0, 3 }) {
        reset();
        sw e = mob(kind);
        yz p = player(false);
        HorseGearProbe.at(p, dist, dy, 0);
        e.b(p, true);
        String steps = "[";
        for (int i = 0; i < 2; i++) {
          bL(e);
          steps += (i > 0 ? "," : "") + "{" + state(e) + "}";
        }
        out("{\"case\":\"path\",\"mob\":" + str(kind) + ",\"distance\":" + dist + ",\"dy\":" + dy + ",\"steps\":" + steps + "]}");
      }
  }

  static void release() throws Exception {
    for (String kind : new String[] { "pig", "horse" }) {
      reset();
      sw e = mob(kind);
      yz p = player(false);
      HorseGearProbe.at(p, 5, 0, 0);
      e.b(p, true);
      bL(e);
      String leashed = state(e);
      e.a(true, true); // the holder clears the lead (sw.a(boolean, boolean))
      String direct = state(e);
      bL(e);
      out("{\"case\":\"release\",\"mob\":" + str(kind) + ",\"leashedState\":{" + leashed + "},\"afterClear\":{" + direct + "},\"afterTick\":{" + state(e) + "}}");
    }
  }

  static void homeCell() throws Exception {
    double[][] at = { { -2.5, 1.5, 3.7 }, { 0.9, 0.1, -0.9 }, { 4.2, -1.5, -4.2 } };
    for (double[] h : at) {
      reset();
      sw e = mob("pig");
      yz p = player(false);
      HorseGearProbe.at(p, h[0], h[1], h[2]);
      e.b(p, true);
      bL(e);
      out("{\"case\":\"homeCell\",\"holder\":[" + f(h[0]) + "," + f(h[1]) + "," + f(h[2]) + "],\"leashed\":" + e.bN() + "," + home(e) + "}");
    }
  }

  static void eating() throws Exception {
    for (double dist : new double[] { 3, 5, 6.0, 6.1, 7, 11 }) {
      reset();
      wi e = HorseGearProbe.gearHorse(0, false);
      yz p = player(false);
      HorseGearProbe.at(p, dist, 0, 0);
      e.o(true);
      boolean before = e.cm();
      e.b(p, true);
      bL(e);
      out("{\"case\":\"eating\",\"distance\":" + dist + ",\"eatingBefore\":" + before + ",\"eatingAfter\":" + e.cm() + ",\"leashed\":" + e.bN() + "}");
    }
  }

  static void knotLife() throws Exception {
    for (int withMob = 0; withMob < 2; withMob++) for (int removeAt : new int[] { -1, 0, 50, 99, 100, 101, 150 }) {
      reset();
      fence(5, 0, 0);
      su knot = su.a(HorseProbe.W, 5, 0, 0);
      sw pig = null;
      if (withMob == 1) {
        pig = mob("pig");
        HorseGearProbe.at(pig, 5, 0, 0);
        pig.b(knot, true);
      }
      int diedAt = -1, unleashedAt = -1;
      for (int t = 1; t <= 400; t++) {
        if (t - 1 == removeAt) HorseGearProbe.GW.fx = Integer.MIN_VALUE;
        knot.h();
        if (diedAt < 0 && dead(knot)) diedAt = t;
        if (pig != null) { bL(pig); if (unleashedAt < 0 && !pig.bN()) unleashedAt = t; }
      }
      out("{\"case\":\"knotLife\",\"mob\":" + (withMob == 1) + ",\"fenceRemovedBeforeTick\":" + (removeAt + 1) + ",\"knotDiedAtTick\":" + diedAt + ",\"mobUnleashedAtTick\":" + unleashedAt
        + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items) + "}");
    }
  }

  static void knotValid() throws Exception {
    for (int id : new int[] { 85, 113, 107, 1, 0, 139, 101 }) {
      reset();
      HorseGearProbe.GW.fid = id;
      fence(5, 0, 0);
      su knot = su.a(HorseProbe.W, 5, 0, 0);
      out("{\"case\":\"knotValid\",\"block\":" + id + ",\"valid\":" + knot.e() + ",\"width\":" + knot.f() + ",\"height\":" + knot.i() + "}");
    }
    reset();
    su knot = su.a(HorseProbe.W, 5, 0, 0);
    out("{\"case\":\"knotValid\",\"block\":-1,\"valid\":" + knot.e() + ",\"width\":" + knot.f() + ",\"height\":" + knot.i() + "}");
  }

  static void fenceBreak() throws Exception {
    reset();
    fence(5, 0, 0);
    su knot = su.a(HorseProbe.W, 5, 0, 0);
    sw pig = mob("pig");
    HorseGearProbe.at(pig, 5, 0, 0);
    pig.b(knot, true);
    String rows = "[";
    HorseGearProbe.GW.fx = Integer.MIN_VALUE;
    for (int t = 1; t <= 103; t++) {
      knot.h();
      bL(pig);
      if (t == 1 || t == 100 || t == 101 || t == 102 || t == 103) rows += (t > 1 ? "," : "") + "{\"tick\":" + t + ",\"knotDead\":" + dead(knot) + ",\"leashed\":" + pig.bN() + ",\"holderIsKnot\":" + (pig.bO() == knot) + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items) + "}";
    }
    out("{\"case\":\"fenceBreak\",\"rows\":" + rows + "]}");
  }

  static void knotHit() throws Exception {
    for (int creativeMode = 0; creativeMode < 2; creativeMode++) {
      reset();
      fence(5, 0, 0);
      su knot = su.a(HorseProbe.W, 5, 0, 0);
      sw pig = mob("pig");
      HorseGearProbe.at(pig, 5, 0, 0);
      pig.b(knot, true);
      yz p = player(creativeMode == 1);
      boolean hit = knot.a(ro.a(p), 1f);
      boolean deadAfterHit = dead(knot), leashedAfterHit = pig.bN();
      int dropsAfterHit = HorseProbe.World.items.size();
      bL(pig);
      out("{\"case\":\"knotHit\",\"creative\":" + (creativeMode == 1) + ",\"result\":" + hit + ",\"knotDead\":" + deadAfterHit + ",\"leashedAfterHit\":" + leashedAfterHit + ",\"dropsAfterHit\":" + dropsAfterHit
        + ",\"leashedAfterTick\":" + pig.bN() + ",\"dropsAfterTick\":" + HorseProbe.strings(HorseProbe.World.items) + "}");
    }
  }

  static void knotClick2() throws Exception {
    for (double d : new double[] { 0, 6.9, 8.1 }) for (int knotMob = 0; knotMob < 2; knotMob++) {
      reset();
      fence(5, 0, 0);
      su knot = su.a(HorseProbe.W, 5, 0, 0);
      sw own = mob("pig");
      HorseGearProbe.at(own, 5 + d, 0, 0);
      HorseGearProbe.GW.entities.add(own);
      yz p = player(false);
      HorseGearProbe.at(p, 5, 0, 3);
      own.b(p, true);
      sw other = null;
      if (knotMob == 1) { other = mob("pig"); HorseGearProbe.at(other, 5, 0, 1); HorseGearProbe.GW.entities.add(other); other.b(knot, true); }
      HorseProbe.hold(p, new add(ade.ca, 1));
      boolean r = knot.c(p);
      out("{\"case\":\"knotClick2\",\"ownDistance\":" + d + ",\"otherOnKnot\":" + (knotMob == 1) + ",\"result\":" + r + ",\"knotDead\":" + dead(knot) + ",\"ownHolderIsKnot\":" + (own.bO() == knot) + ",\"ownLeashed\":" + own.bN()
        + ",\"otherLeashed\":" + (other != null && other.bN()) + ",\"heldAfter\":" + (HorseProbe.held(p) == null ? 0 : HorseProbe.held(p).b) + "}");
    }
  }

  static void fenceClick() throws Exception {
    for (int withMob = 0; withMob < 2; withMob++) {
      reset();
      fence(5, 0, 0);
      su knot = su.a(HorseProbe.W, 5, 0, 0);
      sw own = mob("pig");
      HorseGearProbe.at(own, 5, 0, 1);
      HorseGearProbe.GW.entities.add(own);
      yz p = player(false);
      HorseGearProbe.at(p, 5, 0, 3);
      if (withMob == 1) own.b(p, true);
      boolean used = new adf().a(new add(ade.ca, 1), p, HorseProbe.W, 5, 0, 0, 1, 0.5f, 0.5f, 0.5f);
      out("{\"case\":\"fenceClick\",\"mobHeld\":" + (withMob == 1) + ",\"used\":" + used + ",\"knots\":" + knots() + ",\"knotDead\":" + dead(knot) + ",\"holderIsExistingKnot\":" + (own.bO() == knot) + ",\"leashed\":" + own.bN() + "}");
    }
  }

  static void nbt() throws Exception {
    {
      reset();
      fence(5, 0, 0);
      su knot = su.a(HorseProbe.W, 5, 0, 0);
      sw a = mob("pig"), b = mob("pig");
      yz p = player(false);
      a.b(p, true);
      b.b(knot, true);
      dh ta = new dh(), tb = new dh(), tk = new dh();
      a.b(ta);
      b.b(tb);
      boolean saved = knot.d(tk);
      out("{\"case\":\"nbtWrite\",\"player\":" + str(ta.m("Leash").toString()) + ",\"playerLeashed\":" + ta.n("Leashed") + ",\"knot\":" + str(tb.m("Leash").toString()) + ",\"knotWritesToChunk\":" + saved + ",\"knotTag\":" + str(tk.toString()) + "}");
    }
    String[] kinds = { "knotFence", "knotFenceExisting", "knotNoFence", "playerNear", "playerFar", "playerWrongUuid", "noLeashTag" };
    for (String kind : kinds) {
      reset();
      if (!kind.equals("knotNoFence")) fence(5, 0, 0);
      su existing = kind.equals("knotFenceExisting") ? su.a(HorseProbe.W, 5, 0, 0) : null;
      yz p = player(false);
      HorseGearProbe.at(p, kind.equals("playerFar") ? 30 : 4, 0, 0);
      HorseGearProbe.GW.entities.add(p);
      dh tag = new dh();
      dh leash = new dh();
      if (kind.startsWith("knot")) { leash.a("X", 5); leash.a("Y", 0); leash.a("Z", 0); }
      else if (kind.startsWith("player")) {
        leash.a("UUIDMost", kind.equals("playerWrongUuid") ? 9L : 1L);
        leash.a("UUIDLeast", 2L);
      }
      tag.a("Leashed", true);
      if (!kind.equals("noLeashTag")) tag.a("Leash", leash);
      sw e = mob("pig");
      e.a(tag);
      int knotsBefore = knots();
      bL(e);
      sa holder = e.bO();
      out("{\"case\":\"nbtRead\",\"kind\":" + str(kind) + ",\"knotsBefore\":" + knotsBefore + ",\"leashed\":" + e.bN() + ",\"holderIsKnot\":" + (holder instanceof su) + ",\"holderIsExisting\":" + (existing != null && holder == existing)
        + ",\"holderIsPlayer\":" + (holder == p) + ",\"knotsAfter\":" + knots() + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items) + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    HorseGearProbe.setup();
    path();
    release();
    homeCell();
    eating();
    knotLife();
    knotValid();
    fenceBreak();
    knotHit();
    knotClick2();
    fenceClick();
    nbt();
  }
}
