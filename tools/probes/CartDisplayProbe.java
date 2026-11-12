import java.util.Random;

// Batch 49: EntityMinecart's custom display tile (data watcher 20 = tile id & 0xffff | data << 16, 21 = offset, 22 = flag) and the client's TNT cart fuse
// (EntityMinecartTNT.handleHealthUpdate(10) -> ignite()). Runs the unchanged xl / xv on CartsProbe's World double: per cart type the default tile, data, offset and flag
// (n, p, r, t) and the raw watcher values; then the setter sequences k (setDisplayTile), l (setDisplayTileData), m (setDisplayTileOffset) from the defaults of a type 0
// and a furnace cart; and a client TNT cart (world.isRemote = true) given status 10 and ticked with h(). tools/verify-cart-display.mjs writes
// public/research/cart-display-reference.json; src/cart-display-b49.test.js replays it.
public class CartDisplayProbe {
  static String state(xl c) {
    te w = c.z();
    return "[" + aji.b(c.n()) + "," + c.p() + "," + c.r() + "," + (c.t() ? 1 : 0) + "," + w.c(20) + "," + w.c(21) + "," + w.a(22) + "]";
  }

  static xl cart(CartsProbe.CW w, int type) {
    xl c = xl.a(w, 0.5, 0.5, 0.5, type);
    return c;
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    CartsProbe.CW w = CartsProbe.world(new int[][] {});
    StringBuilder defaults = new StringBuilder();
    for (int t = 0; t < 7; t++) {
      if (t == 4) { defaults.append(",null"); continue; } // the spawner cart needs its logic's world; its defaults are the type table (52, offset 6)
      defaults.append(t > 0 ? "," : "").append(state(cart(w, t)));
    }
    // sequences: [setter, argument, state after]
    StringBuilder seqs = new StringBuilder();
    int[][][] plans = {
      {{0, 0}, {1, 5}, {2, 3}, {3, 9}},      // k(5), l(3), m(9)
      {{2, 3}, {1, 5}, {3, 9}},               // l(3) first: the tile is still the default (air for the rideable cart)
      {{3, 12}},                              // offset only: the flag is set, tile and data stay the defaults... n() now reads the watcher (0)
      {{1, 54}, {2, 1}},                      // a chest id with data 1
    };
    int[] types = {0, 0, 0, 2};
    for (int p = 0; p < plans.length; p++) {
      xl c = cart(w, types[p]);
      StringBuilder row = new StringBuilder("{\"type\":" + types[p] + ",\"start\":" + state(c) + ",\"steps\":[");
      boolean first = true;
      for (int[] s : plans[p]) {
        if (s[0] == 1) c.k(s[1]); else if (s[0] == 2) c.l(s[1]); else if (s[0] == 3) c.m(s[1]);
        if (s[0] == 0) continue;
        row.append(first ? "" : ",").append("[").append(s[0]).append(",").append(s[1]).append(",").append(state(c)).append("]");
        first = false;
      }
      seqs.append(p > 0 ? "," : "").append(row).append("]}");
    }
    // the client TNT cart: fuse -1, status 10 sets 80, h() counts it down (smoke particles), 0 stays (the explosion is under !isRemote)
    CartsProbe.CW cw = CartsProbe.world(new int[][] {});
    MobMoveProbe.field(ahb.class, "E").setBoolean(cw, true);
    xv tnt = (xv) CartsProbe.make("tnt", cw, 0.5, 0.5, 0.5);
    StringBuilder fuse = new StringBuilder("{\"start\":" + CartsProbe.f(xv.class, "a").getInt(tnt) + ",\"ticks\":[");
    for (int t = 0; t < 90; t++) {
      if (t == 3) tnt.a((byte) 10);
      int before = CartsProbe.f(xv.class, "a").getInt(tnt);
      cw.particles.clear();
      tnt.S = tnt.s; tnt.T = tnt.t; tnt.U = tnt.u; tnt.A = tnt.y; tnt.B = tnt.z;
      tnt.h();
      fuse.append(t > 0 ? "," : "").append("[").append(before).append(",").append(CartsProbe.f(xv.class, "a").getInt(tnt)).append(",").append(cw.explosions.size()).append(",").append(cw.particles.size()).append("]");
    }
    fuse.append("]}");
    // the server cart: e() (ignite) sets 80 and sends status 10 through World.setEntityState (isRemote false); the probe world's setEntityState is the base class's
    System.out.println("{\"defaults\":[" + defaults + "],\"sequences\":[" + seqs + "],\"clientFuse\":" + fuse + "}");
  }
}
