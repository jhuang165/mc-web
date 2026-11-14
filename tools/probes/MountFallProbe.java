import java.lang.reflect.*;

// b73 mpriders73: executed check on the unchanged 1.7.10 classes of what a rider's own Entity.moveEntity (sa.d) does with a carried fallDistance (sa.R).
// A rider's updateRidden (sa.ab) zeroes motionX/Y/Z (sa.v/w/x) before its onUpdate, and EntityLivingBase.moveEntityWithHeading (sv.e) calls moveEntity
// with the motion BEFORE it subtracts gravity (bytecode-read), so a rider moves (0, 0, 0). This probe runs moveEntity of an EntityPlayerSP with fallDistance 5
// standing `gap` above a stone floor, with a mount (sa.m) and without, for dy 0 (a rider's move) and dy -0.0784 (a free player's gravity step), and records
// whether EntityPlayer.fall (yz.b(float), overridden here) ran, with what distance, plus onGround and fallDistance afterwards.
public class MountFallProbe {
  static float fallArg = -1; static int falls = 0;
  static class Rec extends blk {
    Rec() { super(null, null, null, 0); }
    protected void a(int x, int y, int z, aji b) {}
    protected void b(float d) { falls++; fallArg = d; }
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    Method move = PlayerStepProbe.method(sa.class, "d", double.class, double.class, double.class);
    Method place = PlayerStepProbe.method(sa.class, "b", double.class, double.class, double.class);
    for (double gap : new double[] {0.03, 0.2}) for (boolean riding : new boolean[] {false, true}) for (double dy : new double[] {0.0, -0.0784000015258789}) {
      double feet = 1.0 + gap;
      PlantProbe.unsafe = u;
      PlantProbe.W w = PlantProbe.world((x, y, z) -> new int[] {y < 1 ? 1 : 0, 0});
      Rec e = (Rec) PlayerStepProbe.spawn(u, w, Rec.class, 64.5, 64.5, 0f, false, false, 0f);
      PlayerStepProbe.field(sa.class, "L").setFloat(e, 1.62f);
      place.invoke(e, 64.5, feet + 1.62, 64.5);
      if (riding) PlayerStepProbe.field(sa.class, "m").set(e, MobMoveProbe.spawn(u, w, "pig", 64.5, 5, 64.5, 0f));
      PlayerStepProbe.field(sa.class, "R").setFloat(e, 5f);
      falls = 0; fallArg = -1;
      move.invoke(e, 0.0, dy, 0.0);
      System.out.println("{\"case\":\"mountfall\",\"gap\":" + gap + ",\"riding\":" + riding + ",\"dy\":" + dy + ",\"falls\":" + falls + ",\"fallArg\":" + fallArg
        + ",\"onGround\":" + PlayerStepProbe.field(sa.class, "D").getBoolean(e) + ",\"after\":" + Float.toString(PlayerStepProbe.field(sa.class, "R").getFloat(e)) + "}");
    }
  }
}
