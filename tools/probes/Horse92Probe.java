import java.lang.reflect.Field;
import java.lang.reflect.Method;

// Batch 92 (horse92): a MOB on a saddled EntityHorse, in the native order. The unchanged wi (EntityHorse) on Horse88Probe's server world double carries a real EntityZombie (yq) or
// EntitySkeleton (yl) through sa.a(sa) (mountEntity). The rider's own onUpdate (sa.h) is replaced by nothing (the AI needs a chunk provider), so the rider's input is fixed per scenario,
// as the player probes do; everything else is the real code. Per tick, in the order World.updateEntities / updateEntityWithOptionalForce (ahb.a(sa, Z)) walk it:
//   the horse: lastTickPos / prevRotationYaw (S T U A B), then wi.h() (onUpdate: sv.h -> sv.e -> wi.e(FF) steering from the rider, the rear counters bL / bM);
//   the rider right after its mount (the world loop skips a linked rider): its own lastTickPos / prevRotation, then the real sv.ab() (EntityLivingBase.updateRidden -> Entity.updateRidden:
//   motion zeroed, onUpdate, wi.ac() = updateRiderPosition with the rearing shift and the renderYawOffset copy, then the rider turns with the mount's yaw change; then fallDistance 0).
// `rearTick`: wi.cU() (makeHorseRear) before that tick; `riderYaw` / `riderPitch` are the rider's rotationYaw / rotationPitch at the start.
public class Horse92Probe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  public static class ZR extends yq { ZR(ahb w) { super(w); } public void h() {} }
  public static class SR extends yl { SR(ahb w) { super(w); } public void h() {} }

  // name, rider type, saddled, rider yaw, rider pitch, forward, strafe, rear tick (-1 none), ticks
  static Object[][] scenarios = {
    { "stand", "zombie", true, 0f, 0f, 0f, 0f, -1, 6 },
    { "steer90", "zombie", true, 90f, 0f, 0.98f, 0f, -1, 14 },
    { "steer200", "zombie", true, 200f, 20f, 0.98f, 0.98f, -1, 14 },
    { "steerSkeleton", "skeleton", true, 135f, -30f, 0.98f, 0f, -1, 14 },
    { "standRear", "zombie", true, 0f, 0f, 0f, 0f, 2, 34 },
    { "steerRear", "zombie", true, 90f, 0f, 0.98f, 0f, 3, 34 },
    { "skeletonRear", "skeleton", true, 45f, 0f, 0f, 0f, 2, 34 },
    { "unsaddled", "zombie", false, 90f, 0f, 0.98f, 0f, -1, 10 },
    { "unsaddledRear", "zombie", false, 0f, 0f, 0f, 0f, 2, 28 },
  };

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    Method h = MobMoveProbe.method(wi.class, "h");
    Method rear = MobMoveProbe.method(wi.class, "cU");
    Method ride = MobMoveProbe.method(sv.class, "ab");
    Method mount = MobMoveProbe.method(sa.class, "a", sa.class);
    Method pos = MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class);
    for (Object[] s : scenarios) {
      HorseRearProbe.RW.cells.clear();
      Horse88Probe.W88 w = Horse88Probe.world();
      HorseProbe.clear();
      wi e = HorseProbe.horse(1);
      e.a((sy) null);
      e.i(true);
      e.n((Boolean) s[2]);
      MobMoveProbe.set(e, "y", 0f);
      for (Field f : sw.class.getDeclaredFields()) if (f.getType() == uj.class) { f.setAccessible(true); f.set(e, new uj(new qi())); }
      sv r = s[1].equals("zombie") ? new ZR(w) : new SR(w);
      pos.invoke(r, 64.0, 0.0, 64.0);
      MobMoveProbe.set(r, "y", (Float) s[3]);
      MobMoveProbe.set(r, "z", (Float) s[4]);
      MobMoveProbe.set(r, "A", (Float) s[3]);
      MobMoveProbe.set(r, "B", (Float) s[4]);
      MobMoveProbe.set(r, "aM", (Float) s[3] + 30f); // its own body yaw, apart from the mount's
      mount.invoke(r, e); // Entity.mountEntity: no health, tame or saddle test
      String speed = num(e.a(yj.d).e()), jump = num(e.ct());
      int rearTick = (Integer) s[7];
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < (Integer) s[8]; i++) {
        if (i == rearTick) rear.invoke(e);
        MobMoveProbe.set(r, "bd", (Float) s[6]);
        MobMoveProbe.set(r, "be", (Float) s[5]);
        MobMoveProbe.set(e, "S", MobMoveProbe.d(e, "s")); MobMoveProbe.set(e, "T", MobMoveProbe.d(e, "t")); MobMoveProbe.set(e, "U", MobMoveProbe.d(e, "u"));
        MobMoveProbe.set(e, "A", MobMoveProbe.fl(e, "y")); MobMoveProbe.set(e, "B", MobMoveProbe.fl(e, "z"));
        h.invoke(e);
        String seatBefore = "[" + num(MobMoveProbe.d(r, "s")) + "," + num(MobMoveProbe.d(r, "t")) + "," + num(MobMoveProbe.d(r, "u")) + "]";
        if (MobMoveProbe.field(sa.class, "m").get(r) == e) {
          MobMoveProbe.set(r, "S", MobMoveProbe.d(r, "s")); MobMoveProbe.set(r, "T", MobMoveProbe.d(r, "t")); MobMoveProbe.set(r, "U", MobMoveProbe.d(r, "u"));
          MobMoveProbe.set(r, "A", MobMoveProbe.fl(r, "y")); MobMoveProbe.set(r, "B", MobMoveProbe.fl(r, "z"));
          ride.invoke(r);
        }
        rows.append(i > 0 ? "," : "").append("{\"horse\":[" + num(MobMoveProbe.d(e, "s")) + "," + num(MobMoveProbe.d(e, "t")) + "," + num(MobMoveProbe.d(e, "u")) + "],\"horseYaw\":" + num(MobMoveProbe.fl(e, "y"))
          + ",\"horsePitch\":" + num(MobMoveProbe.fl(e, "z")) + ",\"horsePrevPitch\":" + num(MobMoveProbe.fl(e, "B")) + ",\"horseBody\":" + num(MobMoveProbe.fl(e, "aM")) + ",\"rearing\":" + e.cn() + ",\"rearAmount\":" + num(MobMoveProbe.fl(e, "bL")) + ",\"prevRearAmount\":" + num(MobMoveProbe.fl(e, "bM"))
          + ",\"onGround\":" + MobMoveProbe.b(e, "D") + ",\"seatBefore\":" + seatBefore
          + ",\"rider\":[" + num(MobMoveProbe.d(r, "s")) + "," + num(MobMoveProbe.d(r, "t")) + "," + num(MobMoveProbe.d(r, "u")) + "],\"riderYaw\":" + num(MobMoveProbe.fl(r, "y"))
          + ",\"riderPitch\":" + num(MobMoveProbe.fl(r, "z")) + ",\"riderBody\":" + num(MobMoveProbe.fl(r, "aM")) + ",\"linked\":" + (MobMoveProbe.field(sa.class, "m").get(r) == e) + "}");
      }
      HorseProbe.out("{\"case\":\"mobRider\",\"name\":\"" + s[0] + "\",\"rider\":\"" + s[1] + "\",\"saddled\":" + s[2] + ",\"riderYaw\":" + num((Float) s[3]) + ",\"riderPitch\":" + num((Float) s[4])
        + ",\"forward\":" + num((Float) s[5]) + ",\"strafe\":" + num((Float) s[6]) + ",\"rearTick\":" + rearTick + ",\"riderHeight\":" + num(r.N) + ",\"riderYOffset\":" + num(r.ad()) + ",\"speed\":" + speed + ",\"jumpAttr\":" + jump
        + ",\"mountOffset\":" + num(e.ae()) + ",\"ticks\":[" + rows + "]}");
    }
  }
}
