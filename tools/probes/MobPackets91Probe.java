import java.util.*;

// Batch 91 mobpackets91: the packet order of EntityTrackerEntry.sendLocationToAllClients (my.a(List)) for a living mob in one gated pass, executed on the unchanged class.
// Same harness as TrackerItemsProbe.run (the real entry tracking a real server cow on a world double). At tick `t` the hook, before the entity's update, turns the head by 90 degrees
// (sv.aO, getRotationYawHead), sets velocityChanged (sa.H, the knockback flag) and adds Speed (sv.c(rw): the S1C potion colour and the S20 movementSpeed dirt). The recorded rows are the
// packets the entry sent that tick, in order.
public class MobPackets91Probe {
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    TrackerItemsProbe.U = MobMoveProbe.unsafe();
    MobMoveProbe.ProbeWorld.exact = true;
    TrackerExtrasProbe.reset();
    TrackerItemsProbe.serverHook = (e, t) -> { try {
      if (t == 10) { MobMoveProbe.set(e, "aO", (float) (((sv) e).au() + 90)); MobMoveProbe.field(sa.class, "H").setBoolean(e, true); ((sv) e).c(new rw(1, 600, 0)); }
      if (t == 20) { MobMoveProbe.field(sa.class, "H").setBoolean(e, true); }
      if (t == 30) { MobMoveProbe.set(e, "aO", (float) (((sv) e).au() + 90)); }
    } catch (Exception ex) { throw new RuntimeException(ex); } };
    System.out.println(TrackerItemsProbe.run("cowHeadVelocity", (w, s) -> { wh c = new wh(w); c.b(s[0], s[1], s[2]); return c; }, new double[]{2.5, 0.0, 2.5}, 80, 3, true, 45, 0.5, 0.5, false, -1));
    TrackerExtrasProbe.reset();
  }
}
