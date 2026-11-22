import java.lang.reflect.Field;
import java.lang.reflect.Method;

// Batch 96 (horse96): a LEAD on a ridden horse. Same real player rider as Horse95Probe (an mw whose update runs sv.ab -> mw.i, C05 every tick, C0C forward 0.98) on a saddled wi, plus a lead holder
// (sa.b(holder, true) -> sw.bv / sw.bw): a fence knot (su), another player (yz), or the rider itself. The horse's real onUpdate (sa.h -> sw.h -> td.bL: pull above 6 blocks, clearLeashed above 10) runs each tick.
// Rows: leashed (sw.bN), holder distance (sw.e), horse position / motion / yaw, the rider's link and position, lead items dropped (World.d), rider motion and fall distance.
// Scenarios: name, rider C0C forward (0 = none), ticks, holder kind (knot, player, rider), holder offset z from the start (horse starts at z 64), horse initial z offset.
public class Horse96Probe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.isNaN(v) ? "\"NaN\"" : Float.toString(v); }
  // Horse95Probe.ST plus the achievement test (mw.i line 238 reads StatFileWriter.hasAchievementUnlocked): the unset stat map made it throw once the rider had moved
  public static class ST2 extends Horse95Probe.ST { public boolean a(pb a) { return true; } }
  static Object[][] scenarios = {
    { "noLeashControl", 0.98f, 40, "none", 0.0 },
    { "knotWalkAway", 0.98f, 90, "knot", -6.0 },
    { "knotWalkTowards", 0.98f, 40, "knot", 14.0 },
    { "knotIdleStart8", 0f, 40, "knot", -8.0 },
    { "knotIdleStart11", 0f, 40, "knot", -11.0 },
    { "playerWalkAway", 0.98f, 90, "player", -6.0 },
    { "riderHolds", 0.98f, 40, "rider", 0.0 },
  };
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    Method h = MobMoveProbe.method(wi.class, "h");
    Method ride = MobMoveProbe.method(sv.class, "ab");
    Method pos = MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class);
    Method upd = MobMoveProbe.method(mw.class, "i");
    Method c0c = MobMoveProbe.method(mw.class, "a", float.class, float.class, boolean.class, boolean.class);
    for (Object[] s : scenarios) {
      HorseRearProbe.RW.cells.clear();
      Horse95Probe.WW.water.clear();
      MobMoveProbe.ProbeWorld.water = false;
      Horse95Probe.WW w = Horse95Probe.wworld();
      HorseProbe.World.items.clear();
      final apx empty = (apx) HorseProbe.u.allocateInstance(apx.class);
      MobMoveProbe.set(empty, "u", new apz[16]);
      MobMoveProbe.set(w, "v", java.lang.reflect.Proxy.newProxyInstance(apu.class.getClassLoader(), new Class[] { apu.class }, (proxy, m, a) -> { Class r = m.getReturnType(); if (r == apx.class) return empty; if (r == boolean.class) return true; if (r == int.class) return 0; return null; })); // the chunk provider Leads2Probe uses: the lead's path to the holder reads an empty chunk
      HorseProbe.clear();
      wi e = HorseProbe.horse(1);
      e.a((sy) null);
      e.i(true);
      e.n(true);
      MobMoveProbe.set(e, "y", 0f);
      for (Field f : sw.class.getDeclaredFields()) if (f.getType() == uj.class) { f.setAccessible(true); f.set(e, new uj(new qi())); }
      Horse95Probe.PM p = (Horse95Probe.PM) HorseProbe.u.allocateInstance(Horse95Probe.PM.class);
      HorseProbe.player = p;
      yz base = HorseProbe.makePlayer(false);
      for (String n : new String[] { "bm", "bE", "i" }) { Field f = MobMoveProbe.field(yz.class, n); f.set(p, f.get(base)); } // mw has its own `i`
      for (String n : new String[] { "ar", "o", "Z", "C", "L", "M", "N" }) { Field f = MobMoveProbe.field(sa.class, n); f.set(p, f.get(base)); }
      MobMoveProbe.set(p, "c", HorseProbe.u.allocateInstance(Horse95Probe.IM.class));
      Object ct = HorseProbe.u.allocateInstance(Horse95Probe.CT.class);
      MobMoveProbe.set(p, "bn", ct); MobMoveProbe.set(p, "bo", ct);
      for (Field f : mw.class.getDeclaredFields()) if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(p, new java.util.ArrayList()); }
      MobMoveProbe.set(p, "bO", HorseProbe.u.allocateInstance(ST2.class));
      MobMoveProbe.field(sv.class, "f").set(p, new java.util.HashMap()); // sv.activePotionsMap
      MobMoveProbe.field(sv.class, "g").set(p, new add[5]); // sv.previousEquipment
      for (Field f : sv.class.getDeclaredFields()) if (f.getType() == rn.class) { f.setAccessible(true); f.set(p, new rn(p)); } // sv.combatTracker
      MobMoveProbe.field(yz.class, "bp").set(p, HorseProbe.u.allocateInstance(Horse95Probe.FD.class));
      MobMoveProbe.set(MobMoveProbe.field(yz.class, "bm").get(p), "b", new add[4]); // armor slots
      MobMoveProbe.field(mw.class, "a").set(p, HorseProbe.u.allocateInstance(Horse95Probe.NS.class));
      te dw = new te(p);
      Method attrs = MobMoveProbe.method(sv.class, "aD"); // EntityLivingBase.applyEntityAttributes (virtual: the player's adds movement speed and attack damage)

      dw.a(0, Byte.valueOf((byte) 0)); // Entity.entityInit's flag byte (setSneaking writes bit 1)
      dw.a(1, Short.valueOf((short) 300)); dw.a(6, Float.valueOf(20f)); dw.a(7, Integer.valueOf(0)); dw.a(8, Byte.valueOf((byte) 0)); dw.a(9, Byte.valueOf((byte) 0)); // EntityLivingBase health / potion / arrow count
      dw.a(16, Byte.valueOf((byte) 0)); dw.a(17, Float.valueOf(0f)); dw.a(18, Integer.valueOf(0)); // EntityPlayer
      MobMoveProbe.set(p, "af", dw);
      MobMoveProbe.set(((yx) MobMoveProbe.field(yz.class, "bm").get(p)), "d", p);
      attrs.invoke(p);
      pos.invoke(p, 64.0, 0.0, 64.0);
      MobMoveProbe.set(p, "y", 0f);
      MobMoveProbe.set(p, "A", 0f);
      p.a((sa) e);
      double z0 = 64.0;
      sa holder;
      String hk = (String) s[3];
      double hz = z0 + (Double) s[4];
      if (hk.equals("knot")) { LeashProbe.fence(64, 0, (int) Math.floor(hz)); holder = su.a(w, 64, 0, (int) Math.floor(hz)); }
      else if (hk.equals("player")) { holder = HorseProbe.makePlayer(false); pos.invoke(holder, 64.0, 0.0, hz); }
      else if (hk.equals("none")) holder = p;
      else holder = p;
      if (!hk.equals("none")) e.b(holder, true);
      Horse96Probe.run(s, e, p, holder, h, ride, upd, c0c, w);
    }
  }

  static void run(Object[] s, wi e, Horse95Probe.PM p, sa holder, Method h, Method ride, Method upd, Method c0c, Object w) throws Exception {
    float fw = (Float) s[1];
    StringBuilder rows = new StringBuilder();
    for (int i = 0; i < (Integer) s[2]; i++) {
      String err = "";
      if (MobMoveProbe.field(sa.class, "m").get(p) == e) {
        try { upd.invoke(p); } catch (java.lang.reflect.InvocationTargetException x) { Throwable t = x.getCause(); while (t.getCause() != null) t = t.getCause(); err = t + " @" + t.getStackTrace()[0] + " " + t.getStackTrace()[1] + " " + t.getStackTrace()[2]; }
      }
      if (fw != 0f) { HorseProbe.FakePlayer.sneak = false; c0c.invoke(p, 0f, fw, false, false); }
      MobMoveProbe.set(e, "S", MobMoveProbe.d(e, "s")); MobMoveProbe.set(e, "T", MobMoveProbe.d(e, "t")); MobMoveProbe.set(e, "U", MobMoveProbe.d(e, "u"));
      MobMoveProbe.set(e, "A", MobMoveProbe.fl(e, "y")); MobMoveProbe.set(e, "B", MobMoveProbe.fl(e, "z"));
      int itemsBefore = HorseProbe.World.items.size();
      String readF = num(MobMoveProbe.fl(p, "be"));
      double dist = e.bN() ? e.e(e.bO()) : -1;
      h.invoke(e);
      String horseAt = "[" + num(MobMoveProbe.d(e, "s")) + "," + num(MobMoveProbe.d(e, "t")) + "," + num(MobMoveProbe.d(e, "u")) + "]";
      if (MobMoveProbe.field(sa.class, "m").get(p) == e) {
        MobMoveProbe.set(p, "S", MobMoveProbe.d(p, "s")); MobMoveProbe.set(p, "T", MobMoveProbe.d(p, "t")); MobMoveProbe.set(p, "U", MobMoveProbe.d(p, "u"));
        MobMoveProbe.set(p, "A", MobMoveProbe.fl(p, "y")); MobMoveProbe.set(p, "B", MobMoveProbe.fl(p, "z"));
        try { ride.invoke(p); } catch (java.lang.reflect.InvocationTargetException x) { err += " ride " + x.getCause() + " @" + x.getCause().getStackTrace()[0]; }
      }
      rows.append(i > 0 ? "," : "").append("{\"readForward\":" + readF + ",\"distBefore\":" + num(dist) + ",\"leashed\":" + e.bN() + ",\"horse\":" + horseAt + ",\"horseMotion\":[" + num(MobMoveProbe.d(e, "v")) + "," + num(MobMoveProbe.d(e, "w")) + "," + num(MobMoveProbe.d(e, "x")) + "],\"horseYaw\":" + num(MobMoveProbe.fl(e, "y"))
        + ",\"linked\":" + (MobMoveProbe.field(sa.class, "m").get(p) == e) + ",\"rider\":[" + num(MobMoveProbe.d(p, "s")) + "," + num(MobMoveProbe.d(p, "t")) + "," + num(MobMoveProbe.d(p, "u")) + "],\"newItems\":" + (HorseProbe.World.items.size() - itemsBefore)
        + ",\"err\":\"" + err.replace("\"", "'") + "\"}");
    }
    HorseProbe.out("{\"case\":\"leashedRide\",\"speed\":" + num(e.a(yj.d).e()) + ",\"jumpAttr\":" + num(e.ct()) + ",\"name\":\"" + s[0] + "\",\"holder\":\"" + s[3] + "\",\"ticks\":[" + rows + "]}");
  }
}
