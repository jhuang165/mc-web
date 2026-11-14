// Batch 69 (projectiles4): firework rockets in water and lava and against boat and minecart boxes. The unchanged EntityFireworkRocket (zf), Entity.onEntityUpdate (handleWaterMovement,
// handleLavaMovement) and moveEntity on the ParticleProbe world double with realFluids on (the real World.handleMaterialAcceleration and isMaterialInBB over the cell map) and with
// real EntityBoat (xi) and EntityMinecartEmpty (xs) objects in the double's entity list (World.getCollidingBoundingBoxes' entity part: sa.J of the other, sa.h(other) of the rocket).
// Rows and constructor seed as FireworkCollideProbe; the record adds "entities": [[kind, [box]]...].
import java.util.*;

public class FireworkFluidProbe extends FireworkCollideProbe {
  static void withEntities(String name, double sx, double sy, double sz, int flight, boolean remote, int maxTicks, int[][] blocks, String[] kinds, double[][] at) throws Exception {
    boxEntities.clear();
    StringBuilder e = new StringBuilder(",\"entities\":[");
    for (int k = 0; k < kinds.length; k++) {
      sa o = kinds[k].equals("boat") ? new xi(world, at[k][0], at[k][1], at[k][2]) : new xs(world, at[k][0], at[k][1], at[k][2]);
      boxEntities.add(o);
      azt b = o.C;
      e.append(k > 0 ? "," : "").append("[").append(q(kinds[k])).append(",[").append(b.a).append(",").append(b.b).append(",").append(b.c).append(",").append(b.d).append(",").append(b.e).append(",").append(b.f).append("]]");
    }
    extra = e + "]";
    run(name, sx, sy, sz, flight, remote, maxTicks, blocks);
    extra = "";
    boxEntities.clear();
  }

  static int[][] column(int x, int z, int y0, int y1, int id, int meta) {
    int[][] out = new int[y1 - y0 + 1][];
    for (int y = y0; y <= y1; y++) out[y - y0] = new int[] { x, y, z, id, meta };
    return out;
  }
  static int[][] cat(int[][]... parts) {
    List<int[]> out = new ArrayList<>();
    for (int[][] p : parts) out.addAll(Arrays.asList(p));
    return out.toArray(new int[0][]);
  }

  public static void main(String[] args) throws Exception {
    init();
    realFluids = true;
    for (int pass = 0; pass < 2; pass++) {
      boolean remote = pass == 1;
      String s = remote ? "-client" : "-server";
      // a column of still water (the rocket starts inside it), and one it enters from below (the first entry after the first update draws the splash)
      run("water-still-inside" + s, 10.5, 65.0, 10.5, 1, remote, 120, column(10, 10, 65, 80, 9, 0));
      run("water-still-below" + s, 10.5, 64.0, 10.5, 1, remote, 120, column(10, 10, 66, 80, 9, 0));
      // flowing water: a ladder of levels beside the rocket's column pushes it sideways (flow toward the higher meta), x and z, and a falling column (meta 8)
      run("water-flow-x" + s, 10.5, 65.0, 10.5, 2, remote, 120, cat(column(10, 10, 65, 80, 8, 2), column(11, 10, 65, 80, 8, 0), column(9, 10, 65, 80, 8, 5)));
      run("water-flow-z" + s, 10.5, 65.0, 10.5, 2, remote, 120, cat(column(10, 10, 65, 80, 8, 2), column(10, 11, 65, 80, 8, 6), column(10, 9, 65, 80, 8, 1)));
      run("water-falling" + s, 10.5, 65.0, 10.5, 2, remote, 120, cat(column(10, 10, 65, 80, 8, 8), column(11, 10, 65, 80, 8, 3)));
      // lava: flowing and still, entered from below and started inside
      run("lava-still-inside" + s, 10.5, 65.0, 10.5, 1, remote, 120, column(10, 10, 65, 80, 11, 0));
      run("lava-flow" + s, 10.5, 64.0, 10.5, 1, remote, 120, cat(column(10, 10, 66, 80, 10, 2), column(11, 10, 66, 80, 10, 0)));
    }
    // a water pocket of three cells with air above: leaves the water and goes on up
    run("water-pocket", 10.5, 65.0, 10.5, 2, false, 120, column(10, 10, 65, 67, 9, 0));
    realFluids = false;
    // boats and minecarts: a boat above the rocket (its box is a collision box: sa.J), a minecart above (null: the rocket passes), beside it, and both together
    for (int pass = 0; pass < 2; pass++) {
      boolean remote = pass == 1;
      String s = remote ? "-client" : "-server";
      withEntities("boat-above" + s, 10.5, 65.0, 10.5, 2, remote, 120, new int[][] {}, new String[] { "boat" }, new double[][] { { 10.5, 67.0, 10.5 } });
      withEntities("cart-above" + s, 10.5, 65.0, 10.5, 2, remote, 120, new int[][] {}, new String[] { "cart" }, new double[][] { { 10.5, 67.0, 10.5 } });
    }
    withEntities("boat-and-cart", 10.5, 65.0, 10.5, 2, false, 120, new int[][] {}, new String[] { "cart", "boat" }, new double[][] { { 10.5, 66.5, 10.5 }, { 10.5, 69.0, 10.5 } });
    // the rocket starts inside the boat's box (the sweeps clip only the way out of an overlap, as for blocks)
    withEntities("boat-inside", 10.5, 66.0, 10.5, 1, false, 120, new int[][] {}, new String[] { "boat" }, new double[][] { { 10.5, 66.3, 10.5 } });
    // beside a boat: the drift is clamped against its side (boat 1.5 wide, so its min x is 11.0 with the centre 11.75); six seeds cover both signs
    for (int k = 0; k < 6; k++) withEntities("boat-side-x-" + k, 10.8749, 65.0, 10.5, 1, false, 120, new int[][] {}, new String[] { "boat" }, new double[][] { { 11.75, 65.3, 10.5 } });
    for (int k = 0; k < 6; k++) withEntities("cart-side-x-" + k, 10.8749, 65.0, 10.5, 1, false, 120, new int[][] {}, new String[] { "cart" }, new double[][] { { 11.49, 65.35, 10.5 } });
    // a boat in water: both at once
    realFluids = true;
    withEntities("boat-in-water", 10.5, 65.0, 10.5, 2, false, 120, column(10, 10, 65, 80, 9, 0), new String[] { "boat" }, new double[][] { { 10.5, 68.0, 10.5 } });
  }
}
