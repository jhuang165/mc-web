import java.lang.reflect.Field;
import java.lang.reflect.Method;

// Batch 93 (horse93): the rider input a MOB feeds a saddled EntityHorse. Horse92Probe stubbed the rider's own update and fixed its moveForward / moveStrafing (bd / be) by hand;
// here the rider is a real EntityLivingBase (sv) whose own onLivingUpdate (sv.e) runs: the old-AI hook bq() (updateEntityActionState) sets raw move values the way a mob's AI
// does, then sv.e multiplies bd / be by 0.98 IN PLACE and moves. The horse (wi, unchanged) reads the rider's bd / be fields at its next update (wi.e(FF) 98-122: bd * 0.5, be).
// Per tick, in World.updateEntityWithOptionalForce order: the horse (lastTickPos / prevRotation, wi.h()), then its rider (sv.ab: onUpdate -> sv.h -> sv.e, then wi.ac()).
// Rows record the rider's bd / be as the horse read them (before the rider's update) and after the rider's own update, and the horse's move.
public class Horse93Probe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  public static class LR extends sv {
    float setForward, setStrafe;
    LR(ahb w) { super(w); }
    public boolean bk() { return false; } // isAIEnabled false: the old updateEntityActionState (bq) runs
    protected void bq() { this.be = setForward; this.bd = setStrafe; } // raw AI values, as a mob's move helper leaves them
    public add be() { return null; }
    public add q(int i) { return null; }
    public void c(int i, add a) {}
    public add[] ak() { return new add[0]; }
  }

  // name, rider yaw, raw forward, raw strafe, ticks
  static Object[][] scenarios = {
    { "forward", 90f, 1.0f, 0f, 14 },
    { "forwardStrafe", 200f, 1.0f, 1.0f, 14 },
    { "slow", 45f, 0.5f, 0f, 14 },
    { "backward", 0f, -1.0f, 0f, 10 },
    { "idle", 0f, 0f, 0f, 6 },
  };

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    Method h = MobMoveProbe.method(wi.class, "h");
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
      e.n(true);
      MobMoveProbe.set(e, "y", 0f);
      for (Field f : sw.class.getDeclaredFields()) if (f.getType() == uj.class) { f.setAccessible(true); f.set(e, new uj(new qi())); }
      LR r = new LR(w);
      pos.invoke(r, 64.0, 0.0, 64.0);
      MobMoveProbe.set(r, "y", (Float) s[1]);
      MobMoveProbe.set(r, "A", (Float) s[1]);
      r.setForward = (Float) s[2];
      r.setStrafe = (Float) s[3];
      mount.invoke(r, e);
      String speed = num(e.a(yj.d).e()), jump = num(e.ct());
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < (Integer) s[4]; i++) {
        MobMoveProbe.set(e, "S", MobMoveProbe.d(e, "s")); MobMoveProbe.set(e, "T", MobMoveProbe.d(e, "t")); MobMoveProbe.set(e, "U", MobMoveProbe.d(e, "u"));
        MobMoveProbe.set(e, "A", MobMoveProbe.fl(e, "y")); MobMoveProbe.set(e, "B", MobMoveProbe.fl(e, "z"));
        String readF = num(MobMoveProbe.fl(r, "be")), readS = num(MobMoveProbe.fl(r, "bd"));
        h.invoke(e);
        String horseAt = "[" + num(MobMoveProbe.d(e, "s")) + "," + num(MobMoveProbe.d(e, "t")) + "," + num(MobMoveProbe.d(e, "u")) + "]";
        if (MobMoveProbe.field(sa.class, "m").get(r) == e) {
          MobMoveProbe.set(r, "S", MobMoveProbe.d(r, "s")); MobMoveProbe.set(r, "T", MobMoveProbe.d(r, "t")); MobMoveProbe.set(r, "U", MobMoveProbe.d(r, "u"));
          MobMoveProbe.set(r, "A", MobMoveProbe.fl(r, "y")); MobMoveProbe.set(r, "B", MobMoveProbe.fl(r, "z"));
          ride.invoke(r);
        }
        rows.append(i > 0 ? "," : "").append("{\"horse\":" + horseAt + ",\"readForward\":" + readF + ",\"readStrafe\":" + readS
          + ",\"afterForward\":" + num(MobMoveProbe.fl(r, "be")) + ",\"afterStrafe\":" + num(MobMoveProbe.fl(r, "bd")) + ",\"horseYaw\":" + num(MobMoveProbe.fl(e, "y"))
          + ",\"linked\":" + (MobMoveProbe.field(sa.class, "m").get(r) == e) + "}");
      }
      HorseProbe.out("{\"case\":\"aiRider\",\"name\":\"" + s[0] + "\",\"riderYaw\":" + num((Float) s[1]) + ",\"rawForward\":" + num((Float) s[2]) + ",\"rawStrafe\":" + num((Float) s[3])
        + ",\"speed\":" + speed + ",\"jumpAttr\":" + jump + ",\"ticks\":[" + rows + "]}");
    }
  }
}
