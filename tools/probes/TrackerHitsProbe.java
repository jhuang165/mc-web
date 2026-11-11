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
  public static class CW3 extends TrackerItemsProbe.CW2 {
    static List<String> log = new ArrayList<>();
    public aji a(int x, int y, int z) { aji w = waterAt(x, y, z, water); return w != null ? w : super.a(x, y, z); }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { log.add("[\"" + name + "\"," + x + "," + y + "," + z + "," + vx + "," + vy + "," + vz + "]"); }
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
    reset();
  }
}
