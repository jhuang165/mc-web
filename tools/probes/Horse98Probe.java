import java.lang.reflect.Field;
import java.lang.reflect.Method;

// Batch 98 (horse98): the same scenarios with a saddled PIG (wo) under the player rider instead of the horse (arg "pig"); the "sneakSpot" mode is in the main below.
// Batch 95 (horse95): copy of Horse94Probe; the scenarios are a player rider on a horse that walks into (or starts in) real still water (block id 9, real ahb.a(azt,awt,sa) / sa.N / sv.e).
// Batch 94 (horse94): a PLAYER rider's own input on a saddled EntityHorse. The rider is a real EntityPlayerMP (mw, allocated without its constructor, like HorseProbe.FakePlayer) whose
// own mw.a(FFZZ) (NetHandlerPlayServer.processInput's setEntityActionState: only while riding, strafe -> bd and forward -> be each only inside [-1, 1], jump -> bc, sneak) takes the C0C
// and whose real update (sv.ab -> Entity.updateRidden -> mw.i -> yz.h -> sv.h -> sv.e, which decays bd / be by 0.98 in place) runs after the horse, as in Horse93Probe. The horse (wi) is
// unchanged. Rows per tick: the C0C applied before the tick (or none), the bd / be the horse reads, bd / be after the rider's update, the horse position / motion / yaw.
public class Horse98Probe {
  static boolean HORSE = false;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.isNaN(v) ? "\"NaN\"" : Float.toString(v); }

  public static class PM extends mw {
    PM() { super(null, null, null, null); }
    public add be() { return null; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public boolean a(int level, String command) { return true; }
    public void a(fj message) {}
    public r f_() { return null; }
    public boolean an() { return HorseProbe.FakePlayer.sneak; }
    public void a(sa e) {
      try {
        Field ridden = MobMoveProbe.field(sa.class, "l"), riding = MobMoveProbe.field(sa.class, "m");
        sa old = (sa) riding.get(this);
        if (e == null) { if (old != null) ridden.set(old, null); riding.set(this, null); }
        else { riding.set(this, e); ridden.set(e, this); }
      } catch (Exception x) { throw new RuntimeException(x); }
    }
  }

  public static class IM extends mx { IM() { super(null); } public void a() {} } // ItemInWorldManager.updateBlockRemoving: nothing is being broken

  public static class CT extends zs { CT() { super(); } public boolean a(yz p) { return true; } public void b() {} } // a container that detects no changes

  public static class ST extends pg { ST() { super(null, null); } public void a(yz p, ph st, int n) {} public void b(yz p, ph st, int n) {} } // StatFileWriter: distance stats go nowhere

  public static class FD extends zr { FD() { super(); } public void a(yz p) {} } // FoodStats.onUpdate: no hunger tick

  public static class NS extends nh { NS() { super(null, null, null); } public void a(ft packet) {} } // NetHandlerPlayServer.sendPacket: the packets go nowhere

  // still water (block 9, metadata 0) in the cells of `water`, over the probe floor at y = -1
  public static class WW extends Horse88Probe.W88 {
    static java.util.Set<String> water = new java.util.HashSet<>();
    public aji a(int x, int y, int z) { return water.contains(x + "," + y + "," + z) ? aji.e(9) : super.a(x, y, z); }
    public boolean b(int a, int b, int c, int d, int e, int f) { return true; }
  }
  static WW wworld() throws Exception {
    WW world = (WW) HorseProbe.u.allocateInstance(WW.class);
    MobMoveProbe.set(world, "s", new java.util.Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new java.util.ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(world, false);
    HorseProbe.W = world;
    return world;
  }
  // each tick: { strafe, forward, jump, sneak } as the C0C, or null for no packet; `mountFirst` false sends the first packet before the mount
  static final float[] NONE = null;
  // name, rider yaw, ticks, C0C per tick, which ticks the C05 (position packet, mw.i) arrives before the C0C ("1" every tick, as a client riding sends it)
  // name, rider yaw, ticks, C0C per tick, C05 pattern, water: 0 none, 1 pool for z >= 68 (depth 2: y 0..1), 2 pool from the start (z >= 0), 3 deep pool z >= 68 (y -0 .. 3)
  static Object[][] scenarios = {
    { "dryControl", 0f, 30, new float[][] { {0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0} }, "111111111111111111111111111111", 0 },
    { "walkIn", 0f, 30, new float[][] { {0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0} }, "111111111111111111111111111111", 1 },
    { "startInside", 0f, 30, new float[][] { {0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0} }, "111111111111111111111111111111", 2 },
    { "deep", 0f, 30, new float[][] { {0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0} }, "111111111111111111111111111111", 3 },
    { "deepStart", 0f, 30, new float[][] { {0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0} }, "111111111111111111111111111111", 4 },
    { "oneStart", 0f, 30, new float[][] { {0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0},{0, .98f, 0, 0} }, "111111111111111111111111111111", 5 },
  };


  // The real ahb.h() (World.updateEntities) needs only the chunk-existence test answered: no chunk is loaded here, entities carry the chunk cell they are in.
  public static class W94 extends Horse88Probe.W88 { public boolean b(int a, int b, int c, int d, int e, int f) { return true; } public boolean c(int x, int z) { return false; } } // no chunk is loaded: the dead entity leaves the list without a chunk call
  static String nul(Object o) { return o == null ? "null" : "true"; }

  // Dismounts other than the sneak path, through the unchanged World.updateEntities (ahb.h): a ZR rider (EntityZombie with its own update stubbed) on a saddled horse in the loaded entity list.
  //   mountSetDead: Entity.setDead on the mount (despawn, deathTime 20)    riderSetDead: setDead on the rider
  //   mountKilled: attackEntityFrom(outOfWorld, 1000) on the horse (/kill): the corpse carries the rider until deathTime 20 sets it dead
  //   riderKilled: the same on the rider (a ZR rider keeps its stubbed update, so deathTime does not advance: records that a dying rider stays seated)
  static final Object[][] DISMOUNTS = { { "mountSetDead", "mount", 0 }, { "riderSetDead", "rider", 0 }, { "mountKilled", "mount", 1 }, { "riderKilled", "rider", 1 } };

  static void dismounts() throws Exception {
    Method pos = MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class);
    Method mount = MobMoveProbe.method(sa.class, "a", sa.class);
    Method upd = MobMoveProbe.method(ahb.class, "h");
    Method dead = MobMoveProbe.method(sa.class, "B");
    ro kill = null;
    for (Field f : ro.class.getDeclaredFields()) if (java.lang.reflect.Modifier.isStatic(f.getModifiers()) && f.getType() == ro.class && "outOfWorld".equals(((ro) f.get(null)).o)) kill = (ro) f.get(null);
    for (Object[] sc : DISMOUNTS) {
      HorseRearProbe.RW.cells.clear();
      for (int x = 56; x < 74; x++) for (int z = 56; z < 74; z++) HorseRearProbe.RW.cells.add(x + ",-1," + z); // a floor
      W94 w = (W94) HorseProbe.u.allocateInstance(W94.class);
      MobMoveProbe.set(w, "s", new java.util.Random(2));
      MobMoveProbe.set(w, "C", new qi());
      for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new java.util.ArrayList()); }
      MobMoveProbe.set(w, "t", HorseProbe.u.allocateInstance(aqq.class));
      MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
      for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == ays.class) { f.setAccessible(true); { Object info = HorseProbe.u.allocateInstance(ays.class); for (Field g : ays.class.getDeclaredFields()) if (g.getType() == agy.class) { g.setAccessible(true); g.set(info, new agy()); } f.set(w, info); } } // WorldInfo (difficulty, game rules read by damage)
      for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == agy.class) { f.setAccessible(true); f.set(w, new agy()); }
      HorseProbe.W = w;
      HorseProbe.clear();
      wi e = HorseProbe.horse(1);
      e.a((sy) null);
      e.i(true);
      e.n(true);
      for (Field f : sw.class.getDeclaredFields()) if (f.getType() == uj.class) { f.setAccessible(true); f.set(e, new uj(new qi())); }
      Horse92Probe.ZR r = new Horse92Probe.ZR(w);
      pos.invoke(r, 64.0, 0.0, 64.0);
      mount.invoke(r, e);
      java.util.List list = (java.util.List) MobMoveProbe.field(ahb.class, "e").get(w);
      list.add(e); list.add(r);
      sa target = sc[1].equals("mount") ? e : r;
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 26; i++) {
        if (i == 3) { if ((Integer) sc[2] == 0) dead.invoke(target); else target.a(kill, 1000f); }
        for (sa x : new sa[] { e, r }) {
          MobMoveProbe.field(sa.class, "ag").setBoolean(x, true);
          MobMoveProbe.field(sa.class, "ah").setInt(x, (int) Math.floor(MobMoveProbe.d(x, "s") / 16));
          MobMoveProbe.field(sa.class, "ai").setInt(x, (int) Math.floor(MobMoveProbe.d(x, "t") / 16));
          MobMoveProbe.field(sa.class, "aj").setInt(x, (int) Math.floor(MobMoveProbe.d(x, "u") / 16));
        }
        String err = "";
        try { upd.invoke(w); } catch (java.lang.reflect.InvocationTargetException x) { Throwable t = x.getCause(); err = t + " @" + t.getStackTrace()[0] + " " + t.getStackTrace()[1]; }
        rows.append(i > 0 ? "," : "").append("{\"mountDead\":" + MobMoveProbe.b(e, "K") + ",\"riderDead\":" + MobMoveProbe.b(r, "K")
          + ",\"riding\":" + (MobMoveProbe.field(sa.class, "m").get(r) != null) + ",\"ridden\":" + (MobMoveProbe.field(sa.class, "l").get(e) != null)
          + ",\"loaded\":" + list.size() + ",\"health\":" + num(((sv) e).aS()) + ",\"riderHealth\":" + num(((sv) r).aS()) + ",\"mountDeathTime\":" + MobMoveProbe.field(sv.class, "aA").getInt(e)
          + ",\"horse\":[" + num(MobMoveProbe.d(e, "s")) + "," + num(MobMoveProbe.d(e, "t")) + "," + num(MobMoveProbe.d(e, "u")) + "],\"rider\":[" + num(MobMoveProbe.d(r, "s")) + "," + num(MobMoveProbe.d(r, "t")) + "," + num(MobMoveProbe.d(r, "u")) + "],\"err\":\"" + err.replace("\"", "'") + "\"}");
      }
      HorseProbe.out("{\"case\":\"dismount\",\"name\":\"" + sc[0] + "\",\"ticks\":[" + rows + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HORSE = args.length > 0 && args[0].equals("horse");
    if (args.length > 0 && args[0].equals("dismounts") /* not used in b98 */) { dismounts(); return; }
    Method h = MobMoveProbe.method(HORSE ? wi.class : wo.class, "h");
    Method ride = MobMoveProbe.method(sv.class, "ab");
    Method pos = MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class);
    Method upd = MobMoveProbe.method(mw.class, "i");
    Method c0c = MobMoveProbe.method(mw.class, "a", float.class, float.class, boolean.class, boolean.class);
    for (Object[] s : scenarios) {
      HorseRearProbe.RW.cells.clear();
      WW.water.clear();
      int wk = (Integer) s[5];
      if (wk != 0) for (int x = 56; x < 74; x++) for (int z = wk >= 2 && wk != 3 ? 56 : 68; z < 74; z++) for (int y = 0; y < (wk == 3 || wk == 4 ? 4 : wk == 5 ? 1 : 2); y++) WW.water.add(x + "," + y + "," + z);
      MobMoveProbe.ProbeWorld.water = wk != 0;
      WW w = wworld();
      HorseProbe.clear();
      sw e = HORSE ? (sw) new wi(HorseProbe.W) : (sw) new wo(HorseProbe.W);
      MobMoveProbe.set(e, "Z", new java.util.Random(1));
      MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64.0, 0.0, 64.0);
      MobMoveProbe.set(e, "D", true);
      if (HORSE) { wi hh = (wi) e; hh.a((sy) null); hh.i(true); hh.n(true); } else ((wo) e).i(true);
      MobMoveProbe.set(e, "y", 0f);
      for (Field f : sw.class.getDeclaredFields()) if (f.getType() == uj.class) { f.setAccessible(true); f.set(e, new uj(new qi())); }
      PM p = (PM) HorseProbe.u.allocateInstance(PM.class);
      HorseProbe.player = p;
      yz base = HorseProbe.makePlayer(false);
      for (String n : new String[] { "bm", "bE", "i" }) { Field f = MobMoveProbe.field(yz.class, n); f.set(p, f.get(base)); } // mw has its own `i`
      for (String n : new String[] { "ar", "o", "Z", "C", "L", "M", "N" }) { Field f = MobMoveProbe.field(sa.class, n); f.set(p, f.get(base)); }
      MobMoveProbe.set(p, "c", HorseProbe.u.allocateInstance(IM.class));
      Object ct = HorseProbe.u.allocateInstance(CT.class);
      MobMoveProbe.set(p, "bn", ct); MobMoveProbe.set(p, "bo", ct);
      for (Field f : mw.class.getDeclaredFields()) if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(p, new java.util.ArrayList()); }
      MobMoveProbe.set(p, "bO", HorseProbe.u.allocateInstance(ST.class));
      MobMoveProbe.field(sv.class, "f").set(p, new java.util.HashMap()); // sv.activePotionsMap
      MobMoveProbe.field(sv.class, "g").set(p, new add[5]); // sv.previousEquipment
      for (Field f : sv.class.getDeclaredFields()) if (f.getType() == rn.class) { f.setAccessible(true); f.set(p, new rn(p)); } // sv.combatTracker
      MobMoveProbe.field(yz.class, "bp").set(p, HorseProbe.u.allocateInstance(FD.class));
      MobMoveProbe.set(MobMoveProbe.field(yz.class, "bm").get(p), "b", new add[4]); // armor slots
      MobMoveProbe.field(mw.class, "a").set(p, HorseProbe.u.allocateInstance(NS.class));
      te dw = new te(p);
      Method attrs = MobMoveProbe.method(sv.class, "aD"); // EntityLivingBase.applyEntityAttributes (virtual: the player's adds movement speed and attack damage)

      dw.a(0, Byte.valueOf((byte) 0)); // Entity.entityInit's flag byte (setSneaking writes bit 1)
      dw.a(1, Short.valueOf((short) 300)); dw.a(6, Float.valueOf(20f)); dw.a(7, Integer.valueOf(0)); dw.a(8, Byte.valueOf((byte) 0)); dw.a(9, Byte.valueOf((byte) 0)); // EntityLivingBase health / potion / arrow count
      dw.a(16, Byte.valueOf((byte) 0)); dw.a(17, Float.valueOf(0f)); dw.a(18, Integer.valueOf(0)); // EntityPlayer
      MobMoveProbe.set(p, "af", dw);
      MobMoveProbe.set(((yx) MobMoveProbe.field(yz.class, "bm").get(p)), "d", p);
      attrs.invoke(p);
      pos.invoke(p, 64.0, 0.0, 64.0);
      MobMoveProbe.set(p, "y", (Float) s[1]);
      MobMoveProbe.set(p, "A", (Float) s[1]);
      p.a((sa) e);
      MobMoveProbe.set(p, "L", 0f); // yOffset: mw.e_ / the mw constructor set 0 on the server (the horse95 probe copied yz's 1.62 from `base`, so its posY was feet + 1.62 and its eyes (mw.g() = 1.62) counted twice)
      pos.invoke(p, 64.0, HORSE ? 0.7 : 0.175, 64.0); // seated first (the dry pig seat), so tick 0 is not an unseated artefact
      String speed = num(((sv) e).a(yj.d).e()), jump = "0";
      float[][] c = (float[][]) s[3];
      StringBuilder rows = new StringBuilder();
      String pat = (String) s[4];
      for (int i = 0; i < (Integer) s[2]; i++) {
        // the network phase of the previous server tick, in packet order: C05 (NetHandlerPlayServer.processPlayer -> mw.i -> yz.h -> sv.e decays bd / be in place), then the C0C
        String err = "";
        boolean c05 = pat.charAt(i) == '1';
        if (c05 && MobMoveProbe.field(sa.class, "m").get(p) == e) {
          try { upd.invoke(p); } catch (java.lang.reflect.InvocationTargetException x) { { Throwable t = x.getCause(); while (t.getCause() != null) t = t.getCause(); err = t + " @" + t.getStackTrace()[0] + " " + t.getStackTrace()[1]; } }
        }
        String afterC05F = num(MobMoveProbe.fl(p, "be")), afterC05S = num(MobMoveProbe.fl(p, "bd"));
        String sent = "null";
        if (c[i] != null) {
          HorseProbe.FakePlayer.sneak = false;
          c0c.invoke(p, c[i][0], c[i][1], c[i][2] != 0, c[i][3] != 0);
          sent = "[" + num(c[i][0]) + "," + num(c[i][1]) + "," + (c[i][2] != 0) + "," + (c[i][3] != 0) + "]";
        }
        // the world tick: the horse (lastTickPos / prevRotation, wi.h() reading bd / be), then its rider through sv.ab (mw.h, which does not run sv.e)
        MobMoveProbe.set(e, "S", MobMoveProbe.d(e, "s")); MobMoveProbe.set(e, "T", MobMoveProbe.d(e, "t")); MobMoveProbe.set(e, "U", MobMoveProbe.d(e, "u"));
        MobMoveProbe.set(e, "A", MobMoveProbe.fl(e, "y")); MobMoveProbe.set(e, "B", MobMoveProbe.fl(e, "z"));
        String readF = num(MobMoveProbe.fl(p, "be")), readS = num(MobMoveProbe.fl(p, "bd"));
        h.invoke(e);
        String horseAt = "[" + num(MobMoveProbe.d(e, "s")) + "," + num(MobMoveProbe.d(e, "t")) + "," + num(MobMoveProbe.d(e, "u")) + "]";
        if (MobMoveProbe.field(sa.class, "m").get(p) == e) {
          MobMoveProbe.set(p, "S", MobMoveProbe.d(p, "s")); MobMoveProbe.set(p, "T", MobMoveProbe.d(p, "t")); MobMoveProbe.set(p, "U", MobMoveProbe.d(p, "u"));
          MobMoveProbe.set(p, "A", MobMoveProbe.fl(p, "y")); MobMoveProbe.set(p, "B", MobMoveProbe.fl(p, "z"));
          try { ride.invoke(p); } catch (java.lang.reflect.InvocationTargetException x) { err += " ride " + x.getCause() + " @" + x.getCause().getStackTrace()[0]; }
        }
        rows.append(i > 0 ? "," : "").append("{\"c05\":" + c05 + ",\"c0c\":" + sent + ",\"afterC05Forward\":" + afterC05F + ",\"afterC05Strafe\":" + afterC05S + ",\"readForward\":" + readF + ",\"readStrafe\":" + readS
          + ",\"afterForward\":" + num(MobMoveProbe.fl(p, "be")) + ",\"afterStrafe\":" + num(MobMoveProbe.fl(p, "bd")) + ",\"horse\":" + horseAt + ",\"horseYaw\":" + num(MobMoveProbe.fl(e, "y"))
          + ",\"err\":\"" + err.replace("\"", "'") + "\",\"linked\":" + (MobMoveProbe.field(sa.class, "m").get(p) == e) + ",\"horseVY\":" + num(MobMoveProbe.d(e, "w")) + ",\"horseInWater\":" + MobMoveProbe.b(e, "ac") + ",\"horseOnGround\":" + MobMoveProbe.b(e, "D") + ",\"riderInWater\":" + MobMoveProbe.b(p, "ac") + ",\"rider\":[" + num(MobMoveProbe.d(p, "s")) + "," + num(MobMoveProbe.d(p, "t")) + "," + num(MobMoveProbe.d(p, "u")) + "],\"horseFall\":" + num(MobMoveProbe.fl(e, "R")) + "}");
      }
      HorseProbe.out("{\"case\":\"" + (HORSE ? "horse" : "pig") + "Rider\",\"name\":\"" + s[0] + "\",\"riderYaw\":" + num((Float) s[1]) + ",\"speed\":" + speed + ",\"jumpAttr\":" + jump + ",\"ticks\":[" + rows + "]}");
    }
  }
}
