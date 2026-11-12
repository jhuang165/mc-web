import java.util.Random;

// b49furnacecart. Records the unchanged EntityMinecart [xl] applyEntityCollision [xl.g(sa)] between two carts of the native types
// (plain 0 = xs, chest 1 = xm, furnace 2 = xq): the one-furnace branches (0.2 / 0.95 factors), the both-or-neither general trade, and
// the cart-vs-cart heading test (|dot| < 0.8 returns). Also the command cart's [xn] watchers 23 and 24: fresh, after CommandBlockLogic.func_145755_a
// (the run), after addChatMessage output (agp.a(fj), the [time] prefix scrubbed), after writeEntityToNBT (sa.e(dh) -> xn.b(dh), writes nothing to the watchers) and after readEntityFromNBT (xn.a(dh), which sets 23 and 24: fk.a(null) is "null"), plus the GUI's setCommand + e().
// tools/verify-furnace-cart.mjs writes public/research/furnace-cart-reference.json; src/furnace-cart-b49.test.js replays it.
public class FurnaceCartProbe {
  static String num(double v) { return NbtProbe.number(v); }
  static xl cart(MinecartProbe.MW w, int type, double x, double z, double yaw, double vx, double vz) throws Exception {
    xl c = type == 0 ? new xs(w, x, 0.5, z) : type == 1 ? new xm(w, x, 0.5, z) : new xq(w, x, 0.5, z);
    c.y = (float) yaw;
    c.v = vx; c.w = 0; c.x = vz;
    return c;
  }
  static boolean air(sa e) throws Exception { return PlayerStepProbe.field(sa.class, "al").getBoolean(e); }
  static String json(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String watchers(xn c) { return "[" + json(c.z().e(23)) + "," + json(c.z().e(24)) + "]"; }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    MinecartProbe.MW w = MinecartProbe.world(new int[0][]);
    int[][] types = {{0, 2}, {2, 0}, {2, 2}, {0, 0}, {1, 2}, {2, 1}, {1, 0}};
    double[][] offsets = {{0.6, 0}, {0, -0.7}, {0.3, 0.4}, {-0.45, 0.2}, {0.005, 0.005}};
    double[] yaws = {0, 90, 45, 180, 30};
    // this vx, vz, other vx, vz
    double[][] vels = {{0, 0, 0, 0}, {0.3, 0, 0, 0}, {0, 0, -0.25, 0}, {0.2, 0, 0.1, 0}, {-0.2, 0.1, 0.15, -0.05}, {0, 0.3, 0, 0.2}};
    StringBuilder out = new StringBuilder();
    int n = 0;
    for (int[] t : types) for (double[] o : offsets) for (double yaw : yaws) for (double[] v : vels) {
      xl a = cart(w, t[0], 0, 0, yaw, v[0], v[1]), b = cart(w, t[1], o[0], o[1], 0, v[2], v[3]);
      a.g(b);
      out.append(n++ > 0 ? "," : "").append("[").append(t[0]).append(",").append(t[1]).append(",").append(num(o[0])).append(",").append(num(o[1])).append(",").append(num(yaw))
        .append(",").append(num(v[0])).append(",").append(num(v[1])).append(",").append(num(v[2])).append(",").append(num(v[3]))
        .append(",[").append(num(a.v)).append(",").append(num(a.w)).append(",").append(num(a.x)).append(",").append(air(a))
        .append("],[").append(num(b.v)).append(",").append(num(b.w)).append(",").append(num(b.x)).append(",").append(air(b)).append("]]");
    }
    System.out.println("{\"name\":\"collisions\",\"rows\":[" + out + "]}");

    StringBuilder cmd = new StringBuilder();
    xn fresh = new xn(w, 0.5, 0.5, 0.5);
    cmd.append("[\"fresh\",").append(watchers(fresh)).append("]");
    fresh.e().a("say hi");
    fresh.e().a(w);
    cmd.append(",[\"ranNoOutput\",").append(watchers(fresh)).append("]");
    fresh.e().a(new fq("done"));
    cmd.append(",[\"output\",").append(json(fresh.z().e(24).replaceAll("\\d\\d:\\d\\d:\\d\\d", "hh:mm:ss"))).append("]");
    xn saved = new xn(w, 0.5, 0.5, 0.5);
    saved.e().a("say hi");
    dh tag = new dh();
    saved.e(tag);
    cmd.append(",[\"writeNoOutput\",").append(watchers(saved)).append("]");
    xn loaded = new xn(w, 0.5, 0.5, 0.5);
    loaded.f(tag);
    cmd.append(",[\"readNoOutput\",").append(watchers(loaded)).append("]");
    xn gui = new xn(w, 0.5, 0.5, 0.5);
    gui.e().a("say hi");
    gui.e().e();
    cmd.append(",[\"guiNoOutput\",").append(watchers(gui)).append("]");
    xn outCart = new xn(w, 0.5, 0.5, 0.5);
    outCart.e().a(new fq("done"));
    dh tag2 = new dh();
    outCart.e(tag2);
    xn loadedOut = new xn(w, 0.5, 0.5, 0.5);
    loadedOut.f(tag2);
    cmd.append(",[\"readOutput\",").append(json(loadedOut.z().e(24).replaceAll("\\d\\d:\\d\\d:\\d\\d", "hh:mm:ss"))).append("]");
    System.out.println("{\"name\":\"command\",\"rows\":[" + cmd + "]}");
  }
}
