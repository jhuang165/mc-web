import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 70 carts70. Two records from the unchanged 1.7.10 classes on CartsProbe's World double:
// (1) "lookup": TileEntityHopper.func_145893_b (api.b(ahb,DDD)) with no tile entity in the cell: the entity search with IEntitySelector.selectInventories (sj.c)
//     over the cell box, World.rand.nextInt(size) when several. The world's entity query applies the selector and the box test.
// (2) "interp": EntityMinecart.setPositionAndRotation2 (xl.a(DDDFFI)V) then onUpdate (xl.h) on a client-side world (ahb.E = true), with the
//     increments NetHandlerPlayClient passes (3). Per tick the position and rotation after h().
public class CartsB70Probe {
  static class W2 extends CartsProbe.CW {
    public List a(sa except, azt box, sj selector) {
      List<sa> out = new ArrayList<>();
      for (sa e : entities) if (e != except && selector.a(e) && e.C.b(box)) out.add(e);
      return out;
    }
  }

  static W2 world() throws Exception {
    W2 w = (W2) PlantProbe.unsafe.allocateInstance(W2.class);
    MobMoveProbe.set(w, "t", PlantProbe.unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    w.cells = new java.util.HashMap<>();
    w.entities = new ArrayList<>();
    w.spawned = new ArrayList<>();
    w.explosions = new ArrayList<>();
    w.particles = new ArrayList<>();
    return w;
  }

  static xl cart(W2 w, String kind, double x, double y, double z) throws Exception {
    xl c = kind.equals("chest") ? new xm(w, x, y, z) : kind.equals("hopper") ? new xr(w, x, y, z) : kind.equals("furnace") ? new xq(w, x, y, z) : new xs(w, x, y, z);
    CartsProbe.f(sa.class, "c").setInt(c, w.entities.size() + 1);
    w.entities.add(c);
    return c;
  }

  static String which(W2 w, sa found) {
    if (found == null) return "null";
    return "" + w.entities.indexOf(found);
  }

  static void lookup(StringBuilder out, String name, String[] kinds, double[][] at, int[] dead, int cx, int cy, int cz) throws Exception {
    W2 w = world();
    for (int i = 0; i < kinds.length; i++) cart(w, kinds[i], at[i][0], at[i][1], at[i][2]);
    for (int d : dead) w.entities.get(d).K = true;
    List<String> boxes = new ArrayList<>();
    for (sa e : w.entities) boxes.add("[" + MinecartProbe.num(e.C.a) + "," + MinecartProbe.num(e.C.b) + "," + MinecartProbe.num(e.C.c) + "," + MinecartProbe.num(e.C.d) + "," + MinecartProbe.num(e.C.e) + "," + MinecartProbe.num(e.C.f) + "]");
    rb r = api.b(w, cx, cy, cz);
    out.append("{\"kind\":\"lookup\",\"name\":\"").append(name).append("\",\"cell\":[").append(cx).append(",").append(cy).append(",").append(cz).append("],\"boxes\":[").append(String.join(",", boxes))
      .append("],\"kinds\":[\"").append(String.join("\",\"", kinds)).append("\"],\"dead\":[");
    for (int i = 0; i < dead.length; i++) out.append(i > 0 ? "," : "").append(dead[i]);
    out.append("],\"found\":").append(which(w, (sa) r)).append("}\n");
  }

  static void interp(StringBuilder out, String name, double[] start, float yaw0, float pitch0, double[][] packets, int[] packetTicks, int ticks) throws Exception {
    W2 w = world();
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, true);
    xl c = cart(w, "rideable", start[0], start[1], start[2]);
    c.y = yaw0; c.z = pitch0; c.A = yaw0; c.B = pitch0;
    StringBuilder rows = new StringBuilder();
    for (int t = 0; t < ticks; t++) {
      for (int p = 0; p < packetTicks.length; p++) if (packetTicks[p] == t) c.a(packets[p][0], packets[p][1], packets[p][2], (float) packets[p][3], (float) packets[p][4], 3);
      c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z;
      c.h();
      rows.append(t > 0 ? "," : "").append("[").append(MinecartProbe.num(c.s)).append(",").append(MinecartProbe.num(c.t)).append(",").append(MinecartProbe.num(c.u)).append(",").append(MinecartProbe.num(c.y)).append(",").append(MinecartProbe.num(c.z)).append("]");
    }
    out.append("{\"kind\":\"interp\",\"name\":\"").append(name).append("\",\"start\":[").append(MinecartProbe.num(start[0])).append(",").append(MinecartProbe.num(start[1])).append(",").append(MinecartProbe.num(start[2])).append("],\"yaw\":").append(MinecartProbe.num(yaw0)).append(",\"pitch\":").append(MinecartProbe.num(pitch0)).append(",\"packets\":[");
    for (int p = 0; p < packetTicks.length; p++) out.append(p > 0 ? "," : "").append("[").append(packetTicks[p]).append(",").append(MinecartProbe.num(packets[p][0])).append(",").append(MinecartProbe.num(packets[p][1])).append(",").append(MinecartProbe.num(packets[p][2])).append(",").append(MinecartProbe.num(packets[p][3])).append(",").append(MinecartProbe.num(packets[p][4])).append("]");
    out.append("],\"ticks\":[").append(rows).append("]}\n");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    StringBuilder out = new StringBuilder();
    // Cart boxes: 0.98 wide, 0.7 high, bottom at posY - yOffset(0.35) + ... ; cell (5, 64, 5) is x 5..6, y 64..65, z 5..6.
    lookup(out, "hopper-cart-in-cell", new String[] {"hopper"}, new double[][] {{5.5, 64.4, 5.5}}, new int[] {}, 5, 64, 5);
    lookup(out, "chest-cart-in-cell", new String[] {"chest"}, new double[][] {{5.5, 64.4, 5.5}}, new int[] {}, 5, 64, 5);
    lookup(out, "rideable-cart-not-inventory", new String[] {"rideable"}, new double[][] {{5.5, 64.4, 5.5}}, new int[] {}, 5, 64, 5);
    lookup(out, "furnace-cart-not-inventory", new String[] {"furnace"}, new double[][] {{5.5, 64.4, 5.5}}, new int[] {}, 5, 64, 5);
    lookup(out, "dead-cart", new String[] {"chest"}, new double[][] {{5.5, 64.4, 5.5}}, new int[] {0}, 5, 64, 5);
    lookup(out, "straddles-edge", new String[] {"chest"}, new double[][] {{6.2, 64.4, 5.5}}, new int[] {}, 5, 64, 5);
    lookup(out, "touching-edge-only", new String[] {"chest"}, new double[][] {{6.5, 64.4, 5.5}}, new int[] {}, 5, 64, 5);
    lookup(out, "cell-above-cart", new String[] {"chest"}, new double[][] {{5.5, 64.4, 5.5}}, new int[] {}, 5, 65, 5);
    lookup(out, "cell-below-cart", new String[] {"hopper"}, new double[][] {{5.5, 64.4, 5.5}}, new int[] {}, 5, 63, 5);
    lookup(out, "two-carts-random", new String[] {"chest", "hopper"}, new double[][] {{5.4, 64.4, 5.5}, {5.6, 64.4, 5.5}}, new int[] {}, 5, 64, 5);
    lookup(out, "two-carts-first-skipped", new String[] {"rideable", "hopper"}, new double[][] {{5.4, 64.4, 5.5}, {5.6, 64.4, 5.5}}, new int[] {}, 5, 64, 5);
    // setPositionAndRotation2 over three packets, 3 ticks apart (the tracker interval), and a single packet with a yaw wrap.
    interp(out, "three-packets", new double[] {10.5, 64.4, 10.5}, 0f, 0f,
      new double[][] {{11.5, 64.4, 10.5, 30, 5}, {12.5, 64.4, 10.5, 60, 10}, {13.5, 65.4, 10.5, 90, 0}}, new int[] {1, 4, 7}, 16);
    interp(out, "yaw-wrap", new double[] {0.5, 64.4, 0.5}, 170f, 0f, new double[][] {{0.5, 64.4, 0.5, -170, 0}}, new int[] {0}, 8);
    System.out.print(out);
  }
}
