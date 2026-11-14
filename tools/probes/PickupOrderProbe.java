import java.util.*;

// Batch 73 (mobcells73). EntityPlayer.onLivingUpdate's pickup pass over ONE list: the player's box grown (1, 0.5, 1) is handed to the unchanged
// World.getEntitiesWithinAABBExcludingEntity (real chunks, as ChunkOrderProbe) and every listed entity that is not dead gets onCollideWithPlayer (bytecode-read loop,
// composed here), run on the real EntityItem (xk.b_), EntityXPOrb (sq.b_) and EntityArrow (zc.b_). Items, orbs and stuck arrows share one list, so which of them reaches the
// inventory first (the last free slot, a partial stack), the sound order and the orb cooldown follow the chunk list order, not the kind.
// Records per scene: the entity list in creation order (kind, position, stack), the candidate order, the pickup order (EntityPlayer.onItemPickup calls), the sound names in
// order, the inventory after (slot: id*count), the experience taken.
public class PickupOrderProbe {
  static String num(double v) { return Double.toString(v); }
  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }
  static String arr(double... v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(','); b.append(num(v[i])); } return b.append(']').toString(); }
  static String ints(List<Integer> l) { return l.toString().replace(" ", ""); }
  static void fill(yz p, int kind, Random r) {
    Arrays.fill(p.bm.a, null);
    int free = kind % 3; // 0, 1 or 2 empty slots at the end; the rest are full stacks of stone, slot 0 a partial stack of arrows
    for (int i = 1; i < 36 - free; i++) p.bm.a[i] = new add(adb.d(1), 64, 0);
    p.bm.a[0] = new add(ade.g, 40 + r.nextInt(24), 0);
  }
  static String inventoryJson(yz p) {
    StringBuilder inv = new StringBuilder("[");
    for (int i = 0; i < 36; i++) { add s = p.bm.a[i]; inv.append(i > 0 ? "," : "").append(s == null ? "0" : "\"" + adb.b(s.b()) + "*" + s.b + "\""); }
    return inv.append("]").toString();
  }
  public static void main(String[] args) throws Exception {
    ChunkOrderProbe.CW w = ChunkOrderProbe.world();
    Random rnd = new Random(73);
    double[] edge = { -0.5, -0.2, 0.0, 0.3, 0.5, 15.8, 15.5 };
    double[] offs = { -1.55, -1.3, -0.9, -0.3, 0.0, 0.3, 0.9, 1.3, 1.55 };
    double[] ys = { -0.75, -0.5, -0.4, 0.0, 0.9, 1.8, 2.2, 2.3 };
    List<String> out = new ArrayList<>();
    for (int n = 0; n < 700; n++) {
      ChunkOrderProbe.load(-3, 8);
      ChunkOrderProbe.CW.sounds.clear(); ChunkOrderProbe.Pl.taken.clear();
      double px = 16.0 * (1 + rnd.nextInt(2)) + edge[rnd.nextInt(edge.length)], pz = 16.0 * (1 + rnd.nextInt(2)) + edge[rnd.nextInt(edge.length)];
      double py = 16.0 * (1 + rnd.nextInt(2)) + (rnd.nextInt(2) == 0 ? -0.5 : 0.0) + rnd.nextInt(3) * 0.2;
      ChunkOrderProbe.Pl p = ChunkOrderProbe.player(w, px, py + 1.62, pz);
      int invKind = rnd.nextInt(6);
      fill(p, invKind, rnd);
      String before = inventoryJson(p);
      int ne = 2 + rnd.nextInt(5);
      List<sa> ents = new ArrayList<>(); StringBuilder es = new StringBuilder();
      for (int i = 0; i < ne; i++) {
        double ex = px + offs[rnd.nextInt(offs.length)], ez = pz + offs[rnd.nextInt(offs.length)], ey = py + ys[rnd.nextInt(ys.length)];
        int kind = rnd.nextInt(3); sa e; String d;
        if (kind == 0) { // an item: stone or arrows
          boolean arrowItem = rnd.nextBoolean(); int count = 1 + rnd.nextInt(arrowItem ? 20 : 64);
          xk it = new xk(w, ex, ey, ez, new add(arrowItem ? ade.g : adb.d(1), count, 0));
          set(it, "b", 0); set(it, "Z", new Random(11 + i)); ChunkOrderProbe.place(it, ex, ey, ez); e = it;
          d = "\"item\",\"" + (arrowItem ? "arrow" : "stone") + "\"," + count;
        } else if (kind == 1) { // an orb
          int v = 1 + rnd.nextInt(30); sq o = new sq(w, ex, ey, ez, v); set(o, "Z", new Random(21 + i)); ChunkOrderProbe.place(o, ex, ey, ez); e = o;
          d = "\"orb\",\"orb\"," + v;
        } else { // a stuck arrow
          zc a = new zc(w, ex, ey, ez); set(a, "i", true); set(a, "b", 0); set(a, "a", 1); set(a, "Z", new Random(31 + i)); e = a;
          d = "\"arrow\",\"arrow\",1";
        }
        ChunkOrderProbe.spawn(w, e); ents.add(e);
        es.append(i > 0 ? "," : "").append("[").append(d).append(",").append(arr(ex, ey, ez)).append("]");
        if (rnd.nextInt(5) == 0) { // an update that moves the entity: the re-slice
          double mx = ex + (rnd.nextInt(3) - 1) * 0.6, mz = ez + (rnd.nextInt(3) - 1) * 0.6;
          ChunkOrderProbe.place(e, mx, ey, mz); ChunkOrderProbe.reslice(w, e);
          es.setLength(es.length() - 1); es.append(",").append(arr(mx, ey, mz)).append("]");
        }
      }
      azt pb = (azt) MobMoveProbe.field(sa.class, "C").get(p);
      List list = w.b(p, pb.b(1.0, 0.5, 1.0));
      List<Integer> order = new ArrayList<>();
      for (Object oo : list) order.add(ents.indexOf(oo));
      for (Object oo : list) { sa e = (sa) oo; if (!e.K) e.b_(p); }
      List<Integer> taken = new ArrayList<>();
      for (sa e : ChunkOrderProbe.Pl.taken) taken.add(ents.indexOf(e));
      String inv = inventoryJson(p);
      StringBuilder sn = new StringBuilder("[");
      for (int i = 0; i < ChunkOrderProbe.CW.sounds.size(); i++) sn.append(i > 0 ? "," : "").append("\"").append(ChunkOrderProbe.CW.sounds.get(i)).append("\"");
      sn.append("]");
      out.add("{\"case\":\"pickup\",\"feet\":" + arr(px, py, pz) + ",\"inventoryKind\":" + invKind + ",\"entities\":[" + es + "],\"candidates\":" + ints(order) + ",\"taken\":" + ints(taken)
        + ",\"before\":" + before + ",\"inventory\":" + inv + ",\"sounds\":" + sn + ",\"cooldown\":" + p.bt + "}");
    }
    for (String s : out) System.out.println(s);
  }
}
