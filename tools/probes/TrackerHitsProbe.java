import java.util.*;

// Batch 44: what the client's copies of arrows, thrown entities, firework rockets and fishing hooks do on their own. The harness is
// TrackerItemsProbe.run (the unchanged EntityTrackerEntry tracking a real server entity, the real class as the client entity made from the
// packets). New here: the client world double records every spawnParticle call (type, position, velocity) and makeFireworks call per client
// tick, the client entity's Entity.rand is reseeded with Random(12345) right after it is built (so the portal and spark draws replay), the server
// world double sends S1A (setEntityState) through the tracker entry, and a water volume (x 0..24, z 3..24, y 0..1) for the bobbing scenarios.
// One JSON object per line (tools/verify-tracker-hits.mjs).
public class TrackerHitsProbe {
  static boolean water, serverWater; // the server hook casts its world to WorldServer in water, so the hook scenario keeps the server dry
  static aji waterAt(int x, int y, int z, boolean on) { return on && x >= 0 && x < 24 && z >= 3 && z < 24 && y >= 0 && y <= 1 ? aji.e(9) : null; }
  // Batch 45: the client world's entity list. World.getEntitiesWithinAABBExcludingEntity returns the client's mob copies and its player (the double has no chunks:
  // every listed entity whose box intersects the query counts, which is what the chunk lookup does for loaded chunks).
  static List<sa> listed = new ArrayList<>();
  static List<sa> within(sa self, azt box) { List out = new ArrayList(); for (sa o : listed) if (o != self && !o.K && o.C.b(box)) out.add(o); return out; }
  // A mob copy whose attackEntityFrom (sv.a(ro, float)) is logged with its result: the client's call, which must answer false
  static class LoggedCow extends wh { LoggedCow(ahb w) { super(w); } public void e(int sec) { super.e(sec); fireRow("cow", this, sec); } public boolean a(ro src, float d) { boolean r = super.a(src, d); CW3.log.add("[\"call:attackEntityFrom:cow\"," + s + "," + t + "," + u + "," + d + "," + (r ? 1 : 0) + ",0]"); return r; } }
  static class LoggedEnder extends ya { LoggedEnder(ahb w) { super(w); } public void e(int sec) { super.e(sec); fireRow("enderman", this, sec); } public boolean a(ro src, float d) { boolean r = super.a(src, d); CW3.log.add("[\"call:attackEntityFrom:enderman\"," + s + "," + t + "," + u + "," + d + "," + (r ? 1 : 0) + ",0]"); return r; } }
  // Batch 46: the other client-world collidables. Each logs attackEntityFrom (with its result) and setFire (seconds, then the fire counter after); the box is logged once at listing.
  static String fmtRow(String name, double a, double b, double c, double d, double e, double g) { return "[\"" + name + "\"," + a + "," + b + "," + c + "," + d + "," + e + "," + g + "]"; }
  static int fireOf(sa e) { try { return MobMoveProbe.field(sa.class, "e").getInt(e); } catch (Exception ex) { throw new RuntimeException(ex); } }
  static void callRow(String kind, sa e, float d, boolean r) { CW3.log.add(fmtRow("call:attackEntityFrom:" + kind, e.s, e.t, e.u, d, r ? 1 : 0, 0)); }
  static void fireRow(String kind, sa e, int sec) { CW3.log.add(fmtRow("call:setFire:" + kind, e.s, e.t, e.u, sec, fireOf(e), 0)); }
  static class LoggedBoat extends xi { LoggedBoat(ahb w, double x, double y, double z) { super(w, x, y, z); } public boolean a(ro src, float d) { boolean r = super.a(src, d); callRow("boat", this, d, r); return r; } public void e(int s) { super.e(s); fireRow("boat", this, s); } }
  static class LoggedCart extends xs { LoggedCart(ahb w, double x, double y, double z) { super(w, x, y, z); } public boolean a(ro src, float d) { boolean r = super.a(src, d); callRow("minecart", this, d, r); return r; } public void e(int s) { super.e(s); fireRow("minecart", this, s); } }
  static class LoggedPainting extends tb { LoggedPainting(ahb w, int x, int y, int z, int dir) { super(w, x, y, z, dir, "Kebab"); } public boolean a(ro src, float d) { boolean r = super.a(src, d); callRow("painting", this, d, r); return r; } public void e(int s) { super.e(s); fireRow("painting", this, s); } }
  static class LoggedFrame extends st { LoggedFrame(ahb w, int x, int y, int z, int dir) { super(w, x, y, z, dir); } public boolean a(ro src, float d) { boolean r = super.a(src, d); callRow("itemFrame", this, d, r); return r; } }
  static class LoggedKnot extends su { LoggedKnot(ahb w, int x, int y, int z) { super(w, x, y, z); } public boolean a(ro src, float d) { boolean r = super.a(src, d); callRow("leashKnot", this, d, r); return r; } }
  // a dragon part: EntityDragonPart.attackEntityFrom forwards to the dragon (attackEntityFromPart), which retargets the dragon with three draws from its own Entity.rand; the row carries the dragon's new target
  static class LoggedPart extends wy { final xa dragon; LoggedPart(xa d) { super(d, "head", 1.0f, 1.0f); dragon = d; } public boolean a(ro src, float d) { boolean r = super.a(src, d); CW3.log.add(fmtRow("call:attackEntityFrom:dragonPart", dragon.h, dragon.i, dragon.bm, d, r ? 1 : 0, 0)); return r; } }
  static void listBox(String kind, sa e) { azt b = e.C; CW3.log.add(fmtRow("listed:" + kind, b.a, b.b, b.c, b.d, b.e, b.f)); listed.add(e); }
  static void listOther(String kind, double x, double y, double z) throws Exception {
    ahb w = TrackerItemsProbe.client;
    switch (kind) {
      case "boat": listBox(kind, new LoggedBoat(w, x, y, z)); break;
      case "minecart": listBox(kind, new LoggedCart(w, x, y, z)); break;
      case "painting": listBox(kind, new LoggedPainting(w, (int) x, (int) y, (int) z, 1)); break;
      case "itemFrame": listBox(kind, new LoggedFrame(w, (int) x, (int) y, (int) z, 1)); break;
      case "leashKnot": listBox(kind, new LoggedKnot(w, (int) x, (int) y, (int) z)); listBox("leashKnotFar", new LoggedKnot(w, 30, 3, 9)); break; // the second knot only logs a second tile's box
      case "dragonPart": {
        xa d = new xa(w); MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(d, x, y, z);
        MobMoveProbe.field(sa.class, "Z").set(d, new Random(12345L));
        LoggedPart p = new LoggedPart(d); MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(p, x, y, z);
        listBox("dragon", d); listBox(kind, p); break;
      }
      default: throw new IllegalArgumentException(kind);
    }
  }
  public static class CW3 extends TrackerItemsProbe.CW2 {
    static List<String> log = new ArrayList<>();
    public aji a(int x, int y, int z) { aji w = waterAt(x, y, z, water); return w != null ? w : super.a(x, y, z); }
    public List b(sa entity, azt box) { return within(entity, box); }
    public List a(sa entity, azt box, sj selector) { return within(entity, box); }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { log.add("[\"" + name + "\"," + x + "," + y + "," + z + "," + vx + "," + vy + "," + vz + "]"); }
    // Entity.playSound -> World.playSoundAtEntity (batch 45): the client's own copy of a sound, at (posX, posY - yOffset, posZ); volume and pitch in the vx and vy slots
    public void a(sa e, String name, float v, float p) { log.add("[\"sound:" + name + "\"," + e.s + "," + (e.t - e.L) + "," + e.u + "," + v + "," + p + ",0]"); }
    public void a(double x, double y, double z, double vx, double vy, double vz, dh tag) { log.add("[\"makeFireworks\"," + x + "," + y + "," + z + "," + vx + "," + vy + "," + vz + "," + (tag == null ? "null" : "\"" + tag.toString().replace("\"", "'") + "\"") + "]"); }
  }
  public static class SW2 extends TrackerItemsProbe.SW {
    public aji a(int x, int y, int z) { aji w = waterAt(x, y, z, serverWater); return w != null ? w : super.a(x, y, z); }
    public void a(sa e, byte b) { TrackerItemsProbe.entry.a(new gt(e, b)); } // WorldServer.setEntityState -> EntityTracker.func_151248_b
  }
  static void reset() {
    TrackerExtrasProbe.reset();
    TrackerItemsProbe.clientWorldClass = CW3.class; TrackerItemsProbe.serverWorldClass = SW2.class;
    TrackerItemsProbe.clientSpawned = (c) -> { try { MobMoveProbe.field(sa.class, "Z").set(c, new Random(12345L)); } catch (Exception ex) { throw new RuntimeException(ex); } };
    TrackerItemsProbe.tickHook = () -> { String s = "[" + String.join(",", CW3.log) + "]"; CW3.log.clear(); return s; };
    listed.clear(); TrackerItemsProbe.serverHook = null; TrackerItemsProbe.removeDead = false;
    water = false; serverWater = false; MobMoveProbe.ProbeWorld.water = false;
  }
  static String arrowState(sa c) { try { zc a = (zc) c; return MobMoveProbe.field(zc.class, "i").getBoolean(a) + "," + a.b; } catch (Exception ex) { throw new RuntimeException(ex); } }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    TrackerItemsProbe.U = MobMoveProbe.unsafe();
    MobMoveProbe.ProbeWorld.exact = true;
    // thrown entities hit the floor: the server copy dies (and goes to the destroy packet), the client copy runs its own onImpact each tick it still lives
    reset();
    System.out.println(TrackerItemsProbe.run("snowballImpact", (w, s) -> { zj e = new zj(w, s[0], s[1], s[2]); TrackerItemsProbe.motion(e, 0.9, 0.3, 0.2); return e; }, new double[]{2.5, 1.5, 2.5}, 64, 10, true, 40, 0.5, 0.5, false, -1));
    reset();
    System.out.println(TrackerItemsProbe.run("eggImpact", (w, s) -> { zl e = new zl(w, s[0], s[1], s[2]); TrackerItemsProbe.motion(e, 0.9, 0.3, 0.2); return e; }, new double[]{2.5, 1.5, 2.5}, 64, 10, true, 40, 0.5, 0.5, false, -1));
    reset();
    System.out.println(TrackerItemsProbe.run("pearlImpact", (w, s) -> { zm e = new zm(w, s[0], s[1], s[2]); TrackerItemsProbe.motion(e, 0.9, 0.3, 0.2); return e; }, new double[]{2.5, 1.5, 2.5}, 64, 10, true, 40, 0.5, 0.5, false, -1));
    reset();
    System.out.println(TrackerItemsProbe.run("potionImpact", (w, s) -> { zo e = new zo(w, s[0], s[1], s[2], 16421); TrackerItemsProbe.motion(e, 0.5, 0.2, 0.3); return e; }, new double[]{2.5, 3.5, 2.5}, 64, 10, true, 40, 0.5, 0.5, false, -1));
    // an arrow shot into the floor (inGround and arrowShake on the client copy), a critical one (the crit trail), and one into water (bubbles and the splash)
    reset();
    TrackerItemsProbe.clientExtra = TrackerHitsProbe::arrowState;
    System.out.println(TrackerItemsProbe.run("arrowStick", (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(1.0, 0.6, 0.3, 1.6f, 0.0f); return e; }, new double[]{2.5, 1.5, 2.5}, 64, 20, false, 60, 0.5, 0.5, false, -1));
    reset();
    TrackerItemsProbe.clientExtra = TrackerHitsProbe::arrowState;
    System.out.println(TrackerItemsProbe.run("arrowCritTrail", (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(1.0, 0.6, 0.3, 1.6f, 0.0f); e.a(true); return e; }, new double[]{2.5, 1.5, 2.5}, 64, 20, false, 40, 0.5, 0.5, false, -1));
    reset();
    water = true; serverWater = true; MobMoveProbe.ProbeWorld.water = true;
    TrackerItemsProbe.clientExtra = TrackerHitsProbe::arrowState;
    System.out.println(TrackerItemsProbe.run("arrowWater", (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(0.0, -0.05, 1.0, 0.6f, 0.0f); return e; }, new double[]{4.5, 1.5, 1.0}, 64, 20, false, 60, 0.5, 0.5, false, -1));
    // a rocket with a Fireworks tag: the client's spark trail every tick, then S1A 17 (makeFireworks with the client's position and motion)
    reset();
    System.out.println(TrackerItemsProbe.run("rocketSparks", (w, s) -> {
      add st = new add(adb.d(401), 1); dh root = new dh(), fw = new dh(); fw.a("Flight", (byte) 1); root.a("Fireworks", fw); st.d(root);
      return new zf(w, s[0], s[1], s[2], st); }, new double[]{4.5, 0.2, 4.5}, 64, 10, true, 70, 0.5, 0.5, false, -1));
    // fishing hooks (the player holds a rod): onto the floor and released again (the seeded client Entity.rand), and into water (the bobbing)
    for (boolean wet : new boolean[]{false, true}) {
      reset();
      water = wet; MobMoveProbe.ProbeWorld.water = wet;
      TrackerItemsProbe.playerSetup = (p) -> { try {
        yx inv = new yx(p);
        inv.a[0] = new add(adb.d(346), 1);
        MobMoveProbe.field(yz.class, "bm").set(p, inv);
        p.z().a(6, Float.valueOf(20.0f));
      } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run(wet ? "hookWater" : "hookFloor", (w, s) -> new xe(w, TrackerItemsProbe.serverPlayer), new double[]{0.5, 1.0, 0.5}, 64, 5, true, 100, 0.5, 0.5, false, -1));
    }
    // Batch 45: the client copies against the client's own mob copies (the server world has none, so only the client's reaction shows). The cow and the enderman
    // are real classes with attackEntityFrom logged; the client world's entity list is `listed`.
    // An arrow flying +x into a cow: the arrow searches for entities on the client too, attackEntityFrom answers false there, so it ricochets
    for (String kind : new String[]{"cow", "cowCrit", "enderman"}) {
      reset();
      TrackerItemsProbe.clientExtra = TrackerHitsProbe::arrowState;
      final boolean crit = kind.equals("cowCrit"), ender = kind.equals("enderman");
      TrackerItemsProbe.serverHook = (e, t) -> { try { if (t == 0) listMob(ender, 6.5, 0.0, 2.5); } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run("arrow_" + kind, (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(1.0, 0.04, 0.0, 1.6f, 0.0f); if (crit) e.a(true); return e; }, new double[]{2.5, 1.2, 2.5}, 64, 20, false, 40, 0.5, 0.5, false, -1));
    }
    // an arrow flying -x at the client's player (no shooter known to the client): hit, then the same with disableDamage (the hit is dropped)
    for (boolean creative : new boolean[]{false, true}) {
      reset();
      TrackerItemsProbe.clientExtra = TrackerHitsProbe::arrowState;
      TrackerItemsProbe.serverHook = (e, t) -> { try { if (t == 0) { yw cap = new yw(); cap.a = creative; MobMoveProbe.field(yz.class, "bE").set(TrackerItemsProbe.clientPlayer, cap); listed.add(TrackerItemsProbe.clientPlayer); } } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run(creative ? "arrow_playerCreative" : "arrow_player", (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(-1.0, 0.0, 0.0, 1.0f, 0.0f); return e; }, new double[]{6.5, 1.0, 0.5}, 64, 20, false, 30, 0.5, 0.5, false, -1));
    }
    // a snowball, an egg and a pearl flying into a cow: EntityThrowable.onUpdate searches for entities only when !isRemote, so the client copy flies through
    for (String kind : new String[]{"snowball", "pearl"}) {
      reset();
      TrackerItemsProbe.serverHook = (e, t) -> { try { if (t == 0) listMob(false, 6.5, 0.0, 2.5); } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run(kind + "Mob", (w, s) -> { sa e = kind.equals("pearl") ? new zm(w, s[0], s[1], s[2]) : new zj(w, s[0], s[1], s[2]); TrackerItemsProbe.motion(e, 0.9, 0.04, 0.0); return e; }, new double[]{2.5, 1.2, 2.5}, 64, 10, true, 20, 0.5, 0.5, false, -1));
    }
    // a fishing hook (the angler on the client is the client's player, the server has no mobs): its entity search is not under !isRemote either; a cow in its way
    for (boolean cow : new boolean[]{false, true}) {
      reset();
      TrackerItemsProbe.playerSetup = (p) -> { try {
        yx inv = new yx(p);
        inv.a[0] = new add(adb.d(346), 1);
        MobMoveProbe.field(yz.class, "bm").set(p, inv);
        p.z().a(6, Float.valueOf(20.0f));
      } catch (Exception ex) { throw new RuntimeException(ex); } };
      TrackerItemsProbe.serverHook = (e, t) -> { try { if (t == 0 && cow) listMob(false, 0.375, 0.0, 4.0); } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run(cow ? "hookCow" : "hookNoCow", (w, s) -> new xe(w, TrackerItemsProbe.serverPlayer), new double[]{0.5, 1.0, 0.5}, 64, 5, true, 40, 0.5, 0.5, false, -1));
    }
    // Batch 46: arrows into the other client-world collidables (listed at t = 0, their box logged), then burning arrows (the server arrow's fire flag reaches the client through S1C)
    for (String kind : new String[]{"boat", "minecart", "painting", "itemFrame", "leashKnot", "dragonPart"}) {
      reset();
      TrackerItemsProbe.clientExtra = TrackerHitsProbe::arrowState;
      TrackerItemsProbe.removeDead = true;
      TrackerItemsProbe.serverHook = (e, t) -> { try { if (t == 0) listOther(kind, 6.5, kind.equals("itemFrame") ? 1.0 : 0.5, 2.5); } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run("arrow_" + kind, (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(1.0, 0.04, 0.0, 1.6f, 0.0f); return e; }, new double[]{2.5, 1.0, 2.5}, 64, 20, false, 30, 0.5, 0.5, false, -1));
    }
    // a burning arrow into a cow (setFire(5) before attackEntityFrom, on the client copy too), into an enderman (no setFire), into a boat (setFire, then attackEntityFrom answers true: the arrow dies); the client mobs' own onEntityUpdate runs before the arrow each tick
    for (String kind : new String[]{"cow", "enderman", "boat"}) {
      reset();
      TrackerItemsProbe.clientExtra = TrackerHitsProbe::arrowState;
      TrackerItemsProbe.removeDead = true;
      TrackerItemsProbe.serverHook = (e, t) -> { try {
        if (t == 0) { if (kind.equals("boat")) listOther("boat", 6.5, 0.5, 2.5); else listMob(kind.equals("enderman"), 6.5, 0.0, 2.5); }
        else for (sa m : listed) { m.C(); CW3.log.add(fmtRow("fire:" + kind, m.s, m.t, m.u, fireOf(m), 0, 0)); }
      } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run("arrowFire_" + kind, (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(1.0, 0.04, 0.0, 1.6f, 0.0f); e.e(100); return e; }, new double[]{2.5, 1.2, 2.5}, 64, 20, false, 30, 0.5, 0.5, false, -1));
    }
    // a fishing hook into a boat (the client's attackEntityFrom answers true: the hook attaches, but the follow is under !isRemote, so it flies on) and into a dragon part
    for (String kind : new String[]{"boat", "dragonPart"}) {
      reset();
      TrackerItemsProbe.playerSetup = (p) -> { try {
        yx inv = new yx(p);
        inv.a[0] = new add(adb.d(346), 1);
        MobMoveProbe.field(yz.class, "bm").set(p, inv);
        p.z().a(6, Float.valueOf(20.0f));
      } catch (Exception ex) { throw new RuntimeException(ex); } };
      TrackerItemsProbe.serverHook = (e, t) -> { try { if (t == 0) listOther(kind, 0.375, 0.5, 4.0); } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run("hook_" + kind, (w, s) -> new xe(w, TrackerItemsProbe.serverPlayer), new double[]{0.5, 1.0, 0.5}, 64, 5, true, 40, 0.5, 0.5, false, -1));
    }
    reset();
  }
  static void listMob(boolean ender, double x, double y, double z) throws Exception {
    ahb w = TrackerItemsProbe.client;
    sa m = ender ? new LoggedEnder(w) : new LoggedCow(w);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(m, x, y, z);
    listed.add(m);
  }
}
