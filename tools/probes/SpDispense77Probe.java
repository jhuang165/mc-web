import java.lang.reflect.*;
import java.util.*;

// Batch 77 (tag spdispense77): the dispenser behaviours batch 76 left unchecked, run unchanged through DispenseProbe's constructor-less World double.
//   registry: every item id 0..4095 whose Bootstrap dispense behaviour is not BehaviorDefaultDispenseItem (cm) with its class name, so a missing behaviour (shears, pumpkin, skull) shows;
//   fireCharge (kz -> EntitySmallFireball zi), boat (la), firework (ky): the world log (aux / sound), the spawned entities with position, motion and the double fields of their class chain
//   (a fireball's acceleration), the stack left.
public class SpDispense77Probe {
  static final int X = DispenseProbe.X, Y = DispenseProbe.Y, Z = DispenseProbe.Z;
  static String q(String s) { return DispenseProbe.q(s); }

  static String entity(sa e) throws Exception {
    String base = DispenseProbe.entity(e);
    StringBuilder o = new StringBuilder(base.substring(0, base.length() - 1)).append(",\"doubles\":{");
    boolean first = true;
    for (Class<?> c = e.getClass(); c != null && c != sa.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) if (f.getType() == double.class && !Modifier.isStatic(f.getModifiers())) {
        f.setAccessible(true);
        if (!first) o.append(',');
        first = false;
        o.append(q(c.getName() + "." + f.getName())).append(':').append(f.getDouble(e));
      }
    return o.append("}}").toString();
  }

  static void dispense(String name, int facing, long seed, String item, String... cells) throws Exception {
    DispenseProbe.W w = DispenseProbe.world(seed);
    DispenseProbe.field(ahb.class, "u").set(w, new ArrayList<Object>());
    w.put(X, Y, Z, 23, facing);
    apb t = new apb();
    t.a(0, DispenseProbe.stack(item));
    DispenseProbe.field(apb.class, "j").set(t, new Random(555));
    w.tiles.put(DispenseProbe.W.key(X, Y, Z), t);
    int[][] F = DispenseProbe.FACE;
    int tx = X + F[facing][0], ty = Y + F[facing][1], tz = Z + F[facing][2];
    for (String c : cells) { String[] p = c.split(","); w.put(tx + Integer.parseInt(p[0]), ty + Integer.parseInt(p[1]), tz + Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4])); }
    StringBuilder o = new StringBuilder("{\"kind\":\"dispense\",\"name\":" + q(name) + ",\"facing\":" + facing + ",\"seed\":\"" + seed + "\",\"item\":" + q(item) + ",\"cells\":[");
    for (int i = 0; i < cells.length; i++) { if (i > 0) o.append(','); o.append(q(cells[i])); }
    o.append("]");
    try { aji.e(23).a(w, X, Y, Z, new Random(1)); } catch (Throwable e) { System.out.println(o + ",\"error\":" + q(e.toString()) + "}"); return; }
    o.append(",\"after\":[");
    for (int i = 0; i < t.a(); i++) { if (i > 0) o.append(','); o.append(DispenseProbe.enc(t.a(i))); }
    o.append("],\"log\":[");
    for (int i = 0; i < w.log.size(); i++) { if (i > 0) o.append(','); o.append(q(w.log.get(i))); }
    o.append("],\"spawned\":[");
    for (int i = 0; i < w.spawned.size(); i++) { if (i > 0) o.append(','); o.append(entity(w.spawned.get(i))); }
    o.append("],\"worldNext\":").append(w.s.nextInt(1000000)).append('}');
    System.out.println(o);
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    DispenseProbe.U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    kl.a();
    for (int id = 0; id < 4096; id++) {
      adb item = adb.d(id);
      if (item == null) continue;
      Object b = akm.a.a(item);
      if (b.getClass() != cm.class) System.out.println("{\"kind\":\"registry\",\"id\":" + id + ",\"class\":" + q(b.getClass().getName()) + ",\"super\":" + q(b.getClass().getSuperclass().getName()) + "}");
    }
    for (int f = 0; f < 6; f++) for (long seed : new long[]{5, 6}) dispense("fireCharge", f, seed, "385:2:0");
    for (int f = 0; f < 6; f++) {
      dispense("boatWater", f, 3, "333:2:0", "0,0,0,9,0");
      dispense("boatFlowing", f, 3, "333:2:0", "0,0,0,8,3");
      if (f != 1) dispense("boatOverWater", f, 3, "333:2:0", "0,-1,0,9,0"); // facing up: the cell under the front cell is the dispenser itself
      dispense("boatLava", f, 3, "333:2:0", "0,0,0,11,0");
      dispense("boatNone", f, 3, "333:2:0");
      dispense("boatStone", f, 3, "333:2:0", "0,0,0,1,0");
    }
    for (int f = 0; f < 6; f++) dispense("firework", f, 7, "401:2:0");
  }
}
