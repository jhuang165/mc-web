import java.lang.reflect.Field;
import java.util.*;

// Batch 43: the tracked objects that batch 42 left out (eye of ender zd, firework rocket zf, fishing hook xe, thrown potion zo), the
// DataWatcher (S1C) contents of items, arrows, falling blocks, the client's TNT fuse, and the falling block's step height. Same
// harness as TrackerItemsProbe (the unchanged EntityTrackerEntry on a real server entity, the real client entity made from the packets
// the way NetHandlerPlayClient does), with TrackerItemsProbe.run's per-tick extras. One JSON object per line (tools/verify-tracker-extras.mjs).
public class TrackerExtrasProbe {
  static final String FEATHER = "feather";
  static add feather(int n) { return new add(ade.G, n); }
  static void reset() { TrackerItemsProbe.serverExtra = null; TrackerItemsProbe.clientExtra = null; TrackerItemsProbe.serverHook = null; TrackerItemsProbe.playerSetup = null; TrackerItemsProbe.metaMode = false; TrackerItemsProbe.serverWorldClass = TrackerItemsProbe.SW.class; TrackerItemsProbe.SW.sand = null; }
  static int intField(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getInt(o); }

  // a half block high slab at y = 0 for z >= 2: Entity.stepHeight decides whether a falling block climbs it
  public static class SlabWorld extends TrackerItemsProbe.SW {
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>(super.a(entity, box));
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
          if (z >= 2) { azt cell = azt.a(x, 0, z, x + 1, 0.5, z + 1); if (box.b(cell)) out.add(cell); }
      return out;
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    TrackerItemsProbe.U = MobMoveProbe.unsafe();
    MobMoveProbe.ProbeWorld.exact = true;
    // an eye of ender launched toward a target 30 blocks away: it flies 80 ticks, then drops or shatters on the server (the client copy has no target and no end)
    System.out.println(TrackerItemsProbe.run("eyeFlight", (w, s) -> { zd e = new zd(w, s[0], s[1], s[2]); e.a(32.5, 70, 2.5); return e; }, new double[]{2.5, 3.0, 2.5}, 64, 4, true, 100, 0.5, 0.5, false, -1));
    // a firework rocket rising: both copies run zf.h (the client's trail), the server's ends at its lifetime
    System.out.println(TrackerItemsProbe.run("fireworkRocket", (w, s) -> new zf(w, s[0], s[1], s[2], new add(adb.d(401), 1)), new double[]{4.5, 0.2, 4.5}, 64, 10, true, 60, 0.5, 0.5, false, -1));
    // a splash potion thrown down and across (the witch's EntityPotion at its S0E data = the damage value), it breaks on the floor
    System.out.println(TrackerItemsProbe.run("potionThrow", (w, s) -> { zo e = new zo(w, s[0], s[1], s[2], 16421); TrackerItemsProbe.motion(e, 0.5, 0.2, 0.3); return e; }, new double[]{2.5, 3.5, 2.5}, 64, 10, true, 60, 0.5, 0.5, false, -1));
    // a fishing hook cast by the tracked player: the client hook interpolates toward the position packets, then moves by its own physics
    reset();
    TrackerItemsProbe.playerSetup = (p) -> { try {
      yx inv = new yx(p);
      inv.a[0] = new add(adb.d(346), 1);
      MobMoveProbe.field(yz.class, "bm").set(p, inv);
      p.z().a(6, Float.valueOf(20.0f)); // EntityLivingBase.getHealth: isEntityAlive
    } catch (Exception ex) { throw new RuntimeException(ex); } };
    System.out.println(TrackerItemsProbe.run("fishHook", (w, s) -> { xe e = new xe(w, TrackerItemsProbe.serverPlayer); return e; }, new double[]{0.5, 1.0, 0.5}, 64, 5, true, 80, 0.5, 0.5, false, -1));
    reset();
    // DataWatcher contents. An item: the stack arrives in the S1C of the spawn and again when the server replaces it (a merge)
    TrackerItemsProbe.metaMode = true;
    TrackerItemsProbe.serverExtra = (e) -> { try { return TrackerItemsProbe.metaOf(e); } catch (Exception ex) { throw new RuntimeException(ex); } };
    TrackerItemsProbe.clientExtra = TrackerItemsProbe.serverExtra;
    TrackerItemsProbe.serverHook = (e, t) -> { if (t == 30) ((xk) e).a(feather(5)); };
    System.out.println(TrackerItemsProbe.run("itemMeta", (w, s) -> { xk e = new xk(w, s[0], s[1], s[2], feather(3)); TrackerItemsProbe.motion(e, 0.0, 0.0, 0.0); return e; }, new double[]{5.3, 1.0, 5.7}, 64, 20, true, 50, 0.5, 0.5, false, -1));
    reset();
    // an arrow that left the bow critical (the flag is DataWatcher object 16), then loses it
    TrackerItemsProbe.serverExtra = (e) -> { try { return TrackerItemsProbe.metaOf(e) + "," + ((zc) e).f(); } catch (Exception ex) { throw new RuntimeException(ex); } };
    TrackerItemsProbe.clientExtra = TrackerItemsProbe.serverExtra;
    TrackerItemsProbe.serverHook = (e, t) -> { if (t == 15) ((zc) e).a(false); };
    System.out.println(TrackerItemsProbe.run("arrowCrit", (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(1.0, 0.6, 0.3, 1.6f, 0.0f); e.a(true); return e; }, new double[]{2.5, 1.5, 2.5}, 64, 20, false, 40, 0.5, 0.5, false, -1));
    reset();
    // a falling red sand block: the packet carries blockId | meta << 16, the client entity's block and metadata come from it
    TrackerItemsProbe.serverExtra = (e) -> { try { xj x = (xj) e; return aji.b(x.f()) + "," + intField(x, "a"); } catch (Exception ex) { throw new RuntimeException(ex); } };
    TrackerItemsProbe.clientExtra = TrackerItemsProbe.serverExtra;
    System.out.println(TrackerItemsProbe.run("fallingMeta", (w, s) -> { TrackerItemsProbe.SW.sand = new int[]{4, 19, 4}; return new xj(w, s[0], s[1], s[2], aji.e(12), 1); }, new double[]{4.5, 19.99, 4.5}, 160, 20, true, 30, 0.5, 0.5, false, -1));
    reset();
    // primed TNT whose server fuse is 40: the fuse is not synchronised, the client's copy counts down from its own 80
    TrackerItemsProbe.serverExtra = (e) -> { try { return String.valueOf(intField(e, "a")); } catch (Exception ex) { throw new RuntimeException(ex); } };
    TrackerItemsProbe.clientExtra = TrackerItemsProbe.serverExtra;
    System.out.println(TrackerItemsProbe.run("tntFuse", (w, s) -> { xw e = new xw(w, s[0], s[1], s[2], null); TrackerItemsProbe.motion(e, 0.0, 0.0, 0.0); MobMoveProbe.field(xw.class, "a").setInt(e, 40); return e; }, new double[]{4.5, 0.0, 4.5}, 160, 10, true, 30, 0.5, 0.5, false, -1));
    reset();
    // Entity.stepHeight: a falling block (0.98 wide) pushed at a half block step lands against it; step height 0 keeps it from climbing
    TrackerItemsProbe.serverWorldClass = SlabWorld.class;
    TrackerItemsProbe.serverExtra = (e) -> "1";
    System.out.println(TrackerItemsProbe.run("fallingStep", (w, s) -> { TrackerItemsProbe.SW.sand = new int[]{4, 0, 1}; xj e = new xj(w, s[0], s[1], s[2], aji.e(12), 0); TrackerItemsProbe.motion(e, 0.0, -0.01, 0.9); return e; }, new double[]{4.5, 0.53, 1.5}, 160, 20, true, 6, 0.5, 0.5, false, -1));
    reset();
  }
}
