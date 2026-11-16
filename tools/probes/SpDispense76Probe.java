import java.lang.reflect.*;
import java.util.*;

// Batch 76 (tag spdispense76): the unchanged 1.7.10 filled-bucket dispense behaviour (BehaviorDispenseFilledBucket -> ItemBucket.tryPlaceContainedLiquid, abo.a)
// in front of replaceable and solid blocks, and in the Overworld and the Nether (the WorldProvider isHellWorld flag), through DispenseProbe's constructor-less World
// double. Records: the stack left, the world log (break / set / sound / aux in order), the spawned entities. One JSON per line.
public class SpDispense76Probe {
  static final int X = DispenseProbe.X, Y = DispenseProbe.Y, Z = DispenseProbe.Z;
  static String q(String s) { return DispenseProbe.q(s); }

  static void dispense(String name, boolean nether, int facing, long seed, String item, int cellId, int cellMeta) throws Exception {
    DispenseProbe.W w = DispenseProbe.world(seed);
    DispenseProbe.field(ahb.class, "u").set(w, new ArrayList<Object>()); // the world's listeners: World.spawnParticle walks them (the Nether branch's largesmoke), none here
    if (nether) {
      aqo p = (aqo) DispenseProbe.field(ahb.class, "t").get(w);
      for (Field f : aqo.class.getFields()) if (f.getType() == boolean.class && f.getName().equals("f")) f.setBoolean(p, true);
    }
    w.put(X, Y, Z, 23, facing);
    apb t = new apb();
    t.a(0, DispenseProbe.stack(item));
    DispenseProbe.field(apb.class, "j").set(t, new Random(555));
    w.tiles.put(DispenseProbe.W.key(X, Y, Z), t);
    int[][] F = DispenseProbe.FACE;
    int tx = X + F[facing][0], ty = Y + F[facing][1], tz = Z + F[facing][2];
    if (cellId >= 0) w.put(tx, ty, tz, cellId, cellMeta);
    aji.e(23).a(w, X, Y, Z, new Random(1));
    StringBuilder o = new StringBuilder("{\"kind\":\"bucket\",\"name\":" + q(name) + ",\"nether\":" + nether + ",\"facing\":" + facing + ",\"item\":" + q(item) + ",\"cell\":" + cellId + ",\"meta\":" + cellMeta + ",\"after\":[");
    for (int i = 0; i < t.a(); i++) { if (i > 0) o.append(','); o.append(DispenseProbe.enc(t.a(i))); }
    o.append("],\"log\":[");
    for (int i = 0; i < w.log.size(); i++) { if (i > 0) o.append(','); o.append(q(w.log.get(i))); }
    o.append("],\"spawned\":[");
    for (int i = 0; i < w.spawned.size(); i++) { if (i > 0) o.append(','); o.append(DispenseProbe.entity(w.spawned.get(i))); }
    o.append("]}");
    System.out.println(o);
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    DispenseProbe.U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    kl.a();
    // Cells: air, stone, torch 50, ladder 65, snow layer 78, tall grass 31, flower 37, fire 51, web 30, carpet 171, glass 20, sign post 63, flowing water 8, lava 11, wheat 59.
    int[] cells = {0, 1, 50, 65, 78, 31, 37, 51, 30, 171, 20, 63, 8, 11, 59};
    for (boolean nether : new boolean[]{false, true})
      for (int c : cells) for (int f : new int[]{0, 1, 3, 5}) {
        dispense("water", nether, f, 9, "326:1:0", c, 0);
        dispense("lava", nether, f, 9, "327:1:0", c, 0);
      }
  }
}
