import java.util.*;

// Batch 47: client copies of boats, minecarts and hanging entities. The unchanged EntityTrackerEntry (my) tracks a real server EntityBoat (xi), EntityMinecart (xl.a,
// the factory NetHandlerPlayClient uses), EntityPainting (tb), EntityItemFrame (st) and EntityLeashKnot (su) on the server world double; the packets are handled by the same
// classes on the client world double the way NetHandlerPlayClient.a(S0E), a(S10), a(S12), a(S14), a(S18), a(S1C) do (TrackerItemsProbe.handle), and the client entity runs its
// own onUpdate once per client tick. Rows carry the server entity, the packets and the client entity (position, motion, previous position, rotation) as TrackerItemsProbe does;
// `clientExtra` adds the client's bounding box (and its data watcher for item frames), the client world's own particles ride in `log`.
public class TrackerVehiclesProbe {
  static String box(sa c) { azt b = c.C; return b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f; }
  static String boxAndMeta(sa c) throws Exception { return box(c) + "," + TrackerItemsProbe.metaOf(c); }
  // the server entity is pushed along by the scenario: its motion is set before its own onUpdate (the world double has no water, rails or players to drive it)
  static void drive(sa e, double vx, double vz) throws Exception { TrackerItemsProbe.motion(e, vx, 0.0, vz); }
  static void moveTo(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static void reset() {
    TrackerHitsProbe.reset();
    TrackerItemsProbe.clientExtra = null;
    TrackerItemsProbe.removeDead = false;
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    TrackerItemsProbe.U = MobMoveProbe.unsafe();
    MobMoveProbe.ProbeWorld.exact = true;
    // a boat pushed along +x/+z by pulses: relative moves and looks, the S12 after the spawn, the 8 tick interpolation of an empty boat (3 + 5), the spawn's extra yOffset
    reset();
    TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
    TrackerItemsProbe.serverHook = (e, t) -> { try { if (t % 12 < 6) drive(e, 0.3, 0.1); else drive(e, 0.0, 0.0); } catch (Exception ex) { throw new RuntimeException(ex); } };
    System.out.println(TrackerItemsProbe.run("boatGlide", (w, s) -> { xi e = new xi(w, s[0], s[1], s[2]); return e; }, new double[]{5.5, 0.0, 5.5}, 80, 3, true, 80, 0.5, 0.5, false, -1));
    // a boat moving faster than 0.2625 a tick: the client copy draws its own splash particles from its own Entity.rand (Random(12345)); the S12 decides the client's motion
    reset();
    TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
    TrackerItemsProbe.serverHook = (e, t) -> { try { if (t > 0) drive(e, 0.0, 0.8); } catch (Exception ex) { throw new RuntimeException(ex); } };
    System.out.println(TrackerItemsProbe.run("boatSplash", (w, s) -> new xi(w, s[0], s[1], s[2]), new double[]{5.5, 0.0, 5.5}, 80, 3, true, 24, 0.5, 0.5, false, -1));
    // a boat teleported 9 blocks (the packet delta leaves -128..127: S18), then back by a relative move
    reset();
    TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
    TrackerItemsProbe.serverHook = (e, t) -> { try { drive(e, 0.0, 0.0); if (t == 10) moveTo(e, d(e, "s") + 9.0, d(e, "t"), d(e, "u")); } catch (Exception ex) { throw new RuntimeException(ex); } };
    System.out.println(TrackerItemsProbe.run("boatTeleport", (w, s) -> new xi(w, s[0], s[1], s[2]), new double[]{5.5, 0.0, 5.5}, 80, 3, true, 50, 0.5, 0.5, false, -1));
    // a boat that leaves the 80 block square (the player stays put): destroy, then the tracker drops it
    reset();
    TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
    TrackerItemsProbe.serverHook = (e, t) -> { try { drive(e, 0.34, 0.0); } catch (Exception ex) { throw new RuntimeException(ex); } };
    System.out.println(TrackerItemsProbe.run("boatFar", (w, s) -> new xi(w, s[0], s[1], s[2]), new double[]{70.5, 0.0, 5.5}, 80, 3, true, 80, 0.5, 0.5, false, -1));
    // minecarts: an empty cart (data 0: the spawn carries no motion), a chest cart (data 1: the motion rides in the spawn packet); the 5 tick interpolation (3 + 2), no motion of their own
    for (int type : new int[]{0, 1, 3}) {
      reset();
      TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
      TrackerItemsProbe.serverHook = (e, t) -> { try { if (t == 0 && type > 0) drive(e, 0.15, 0.0); else if (t % 14 < 5) drive(e, 0.25, -0.1); else drive(e, 0.0, 0.0); } catch (Exception ex) { throw new RuntimeException(ex); } };
      System.out.println(TrackerItemsProbe.run("cart" + type, (w, s) -> xl.a(w, s[0], s[1], s[2], type), new double[]{5.5, 0.35, 5.5}, 80, 3, true, 70, 0.5, 0.5, false, -1));
    }
    // a cart teleported over a 9 block gap
    reset();
    TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
    TrackerItemsProbe.serverHook = (e, t) -> { try { drive(e, 0.0, 0.0); if (t == 10) moveTo(e, d(e, "s"), d(e, "t"), d(e, "u") - 9.0); } catch (Exception ex) { throw new RuntimeException(ex); } };
    System.out.println(TrackerItemsProbe.run("cartTeleport", (w, s) -> xl.a(w, s[0], s[1], s[2], 0), new double[]{5.5, 0.35, 12.5}, 80, 3, true, 50, 0.5, 0.5, false, -1));
    // hanging entities: S10 for a painting (title, direction), S0E 71 for an item frame, S0E 77 for a knot; nothing moves them afterwards (frequency 2147483647)
    for (int dir = 0; dir < 4; dir++) {
      final int d = dir;
      reset();
      TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
      System.out.println(TrackerItemsProbe.run("painting" + dir, (w, s) -> new tb(w, (int) s[0], (int) s[1], (int) s[2], d, "Kebab"), new double[]{4, 2, 6}, 160, 2147483647, false, 6, 0.5, 0.5, false, -1));
      reset();
      TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
      System.out.println(TrackerItemsProbe.run("frame" + dir, (w, s) -> new st(w, (int) s[0], (int) s[1], (int) s[2], d), new double[]{4, 2, 6}, 160, 2147483647, false, 6, 0.5, 0.5, false, -1));
    }
    // a big painting (4 x 4: Skull and Roses is 2 x 2; "BurningSkull" 4 x 4 ), and a painting with a negative tile coordinate (the d2i casts truncate toward zero)
    reset();
    TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
    System.out.println(TrackerItemsProbe.run("paintingBig", (w, s) -> new tb(w, (int) s[0], (int) s[1], (int) s[2], 1, "BurningSkull"), new double[]{4, 2, 6}, 160, 2147483647, false, 6, 0.5, 0.5, false, -1));
    reset();
    TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
    System.out.println(TrackerItemsProbe.run("frameNegative", (w, s) -> new st(w, (int) s[0], (int) s[1], (int) s[2], 2), new double[]{-3, 2, -5}, 160, 2147483647, false, 6, -2.5, -4.5, false, -1));
    reset();
    TrackerItemsProbe.clientExtra = TrackerVehiclesProbe::box;
    System.out.println(TrackerItemsProbe.run("knot", (w, s) -> new su(w, (int) s[0], (int) s[1], (int) s[2]), new double[]{4, 2, 6}, 160, 2147483647, false, 6, 0.5, 0.5, false, -1));
    // an item frame that receives a stack and a rotation (S1C: data watcher 2 and 3), the hanging entity is otherwise still
    reset();
    TrackerItemsProbe.clientExtra = (c) -> { try { return boxAndMeta(c); } catch (Exception ex) { throw new RuntimeException(ex); } };
    TrackerItemsProbe.serverHook = (e, t) -> { if (t == 3) { st fr = (st) e; fr.a(new add(ade.G, 1)); fr.c(3); } };
    System.out.println(TrackerItemsProbe.run("frameItem", (w, s) -> new st(w, (int) s[0], (int) s[1], (int) s[2], 1), new double[]{4, 2, 6}, 160, 2147483647, false, 8, 0.5, 0.5, false, -1));
    reset();
  }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }
}
