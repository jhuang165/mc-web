import java.lang.reflect.Field;
import java.lang.reflect.Method;

// Batch 89 (horse89): the sneak (dismount) tick of a ridden EntityHorse, in the native order. A real EntityPlayerMP (ServerPlayerProbe, with HorseRearProbe.RecNet recording
// setPlayerLocation) rides the unchanged wi on Horse88Probe's server world double. Per tick, as the integrated server does it:
//   the network tick's packets first: C0B action 6 -> wi.w(int) (only when the script says), then the C0C -> mw.a(FFZZ) (strafe, forward, jump, sneak: the real handler);
//   then the world tick: wi.h() (onUpdate), and, when the rider is still linked and isSneaking, the real yz.ab() (EntityPlayer.updateRidden), which
//   World.updateEntityWithOptionalForce (ahb.a(sa, Z), bytecode-read) calls right after the mount's onUpdate;
//   then, while still riding, wi.ac() (updateRiderPosition: the network tick's riding branch seats the player, mw.m.ac()).
// The rider's own updateRidden on the other ticks (its onUpdate) is not run: only its seat matters to the horse and the dismount.
// `freshAir`: a fresh wi (bp = 0) mounted in the air, so the first ridden tick's aQ (jumpMovementFactor) shows in the motion.
public class Horse89Probe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static final float SNEAK = (float) (1.0F * 0.3D) * 0.98F; // MovementInputFromOptions (forward 1, sneak * 0.3), then EntityLivingBase.onLivingUpdate's * 0.98F

  // name, start y, ticks, sneak tick (-1 none), jump-held ticks [from, to), C0B rows { tick, power }, stone boxes { x0, y0, z0, x1, y1, z1 }, forward
  static Object[][] scenarios = {
    { "sneak", 0.0, 12, 6, new int[] { 0, 0 }, new int[][] {}, new int[][] {}, 1f },
    { "sneakJump", 0.0, 24, 11, new int[] { 0, 11 }, new int[][] { { 11, 100 } }, new int[][] {}, 1f },
    { "sneakStill", 0.0, 8, 3, new int[] { 0, 0 }, new int[][] {}, new int[][] {}, 0f },
    { "sneakCeiling", 0.0, 8, 3, new int[] { 0, 0 }, new int[][] {}, new int[][] { { 60, 3, 60, 68, 3, 68 } }, 0f },
    { "freshAir", 3.0, 8, -1, new int[] { 0, 0 }, new int[][] {}, new int[][] {}, 1f },
  };

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    Method h = MobMoveProbe.method(wi.class, "h");
    Method ride = MobMoveProbe.method(yz.class, "ab");
    Method sneaking = MobMoveProbe.method(sa.class, "an");
    Method pos = MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class);
    for (long seed : new long[] { 1, 6 }) for (Object[] s : scenarios) {
      HorseRearProbe.RW.cells.clear();
      for (int[] bx : (int[][]) s[6]) for (int x = bx[0]; x <= bx[3]; x++) for (int y = bx[1]; y <= bx[4]; y++) for (int z = bx[2]; z <= bx[5]; z++) HorseRearProbe.RW.cells.add(x + "," + y + "," + z);
      Horse88Probe.W88 w = Horse88Probe.world();
      HorseProbe.clear();
      mw pl = ServerPlayerProbe.make(w, "probe");
      pl.a = (nh) HorseProbe.u.allocateInstance(HorseRearProbe.RecNet.class);
      HorseRearProbe.RecNet.player = pl;
      wi e = HorseProbe.horse(seed);
      e.a((sy) null);
      e.i(true);
      e.n(true);
      double y0 = (Double) s[1];
      pos.invoke(e, 64.0, y0, 64.0);
      MobMoveProbe.set(e, "D", y0 == 0.0);
      MobMoveProbe.set(e, "y", 0f);
      MobMoveProbe.set(pl, "y", 180f); // the port's rider yaw for a view yaw of 0
      for (Field f : sw.class.getDeclaredFields()) if (f.getType() == uj.class) { f.setAccessible(true); f.set(e, new uj(new qi())); }
      pl.a((sa) e); // mw.a(sa): yz.a(sa) -> mount, S1B, setPlayerLocation at the seat
      e.ac();
      HorseRearProbe.RecNet.spots.clear();
      String speed = num(e.a(yj.d).e()), jump = num(e.ct());
      int sneakTick = (Integer) s[3];
      int[] held = (int[]) s[4];
      float forward = (Float) s[7];
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < (Integer) s[2]; i++) {
        boolean riding = MobMoveProbe.field(sa.class, "m").get(pl) == e;
        String seat = "[" + num(pl.s) + "," + num(pl.t) + "," + num(pl.u) + "]";
        if (riding) {
          for (int[] r : (int[][]) s[5]) if (r[0] == i) e.w(r[1]);
          boolean sneak = i == sneakTick;
          pl.a(0f, sneak ? SNEAK * forward : 0.98F * forward, i >= held[0] && i < held[1], sneak);
        }
        HorseRearProbe.RecNet.spots.clear();
        h.invoke(e);
        boolean updated = false;
        if (riding && MobMoveProbe.field(sa.class, "m").get(pl) == e && (Boolean) sneaking.invoke(pl)) { ride.invoke(pl); updated = true; }
        if (MobMoveProbe.field(sa.class, "m").get(pl) == e) e.ac();
        rows.append(i > 0 ? "," : "").append("{\"x\":" + num(MobMoveProbe.d(e, "s")) + ",\"y\":" + num(MobMoveProbe.d(e, "t")) + ",\"z\":" + num(MobMoveProbe.d(e, "u"))
          + ",\"vx\":" + num(MobMoveProbe.d(e, "v")) + ",\"vy\":" + num(MobMoveProbe.d(e, "w")) + ",\"vz\":" + num(MobMoveProbe.d(e, "x")) + ",\"onGround\":" + MobMoveProbe.b(e, "D")
          + ",\"jumpPower\":" + num(MobMoveProbe.fl(e, "bt")) + ",\"jumping\":" + e.cj() + ",\"stepHeight\":" + num(MobMoveProbe.fl(e, "W")) + ",\"jumpFactor\":" + num(MobMoveProbe.fl(e, "aQ"))
          + ",\"rider\":" + (MobMoveProbe.field(sa.class, "l").get(e) != null) + ",\"updateRidden\":" + updated + ",\"seatBefore\":" + seat
          + ",\"player\":[" + num(pl.s) + "," + num(pl.t) + "," + num(pl.u) + "],\"playerSneaking\":" + sneaking.invoke(pl) + ",\"spots\":" + HorseRearProbe.RecNet.spots + "}");
      }
      HorseProbe.out("{\"case\":\"sneak\",\"seed\":" + seed + ",\"name\":\"" + s[0] + "\",\"startY\":" + num(y0) + ",\"sneakTick\":" + sneakTick + ",\"held\":[" + held[0] + "," + held[1] + "],\"forward\":" + num(forward)
        + ",\"c0b\":" + java.util.Arrays.deepToString((int[][]) s[5]) + ",\"cells\":" + java.util.Arrays.deepToString((int[][]) s[6]) + ",\"speed\":" + speed + ",\"jumpAttr\":" + jump
        + ",\"sneakForward\":" + num(SNEAK) + ",\"ticks\":[" + rows + "]}");
    }
  }
}
