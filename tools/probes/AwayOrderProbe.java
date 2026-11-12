import java.util.*;

// Batch 50 (b50ao): the order of World.loadedEntityList when mobs, items, orbs, arrows, carts, boats and paintings join (at different ticks) and leave
// (a merged item, a killed cow that is removed at deathTime 20, an arrow that dies on its target, a broken painting). It reuses EntityListProbe's scenario walk
// (the real World.updateEntities order on XpOrbProbe.XW) and its spec helpers; only the scenarios are new. The away run (src/away-entities.js) replays the records.
// Six groups, far apart in z (and from the probe's player shell at the origin, which would pick up an item) so they do not touch; inside a group the order decides the outcome: two merging stacks (G1), a cart that pushes and takes aboard a cow
// (G2), a boat and a cart (G3), an arrow that kills a cow whose drops join the list (G4), two orbs (G5), a painting that loses its wall (G6, the drop joins the end).
public class AwayOrderProbe {
  static String[][] groups(int[] j) {
    return new String[][] {
      item(0.9, 0.3, 6.5, 0.2, 4, 10, j[0]), item(1.1, 0.3, 6.5, -0.25, 4, 50, j[1]),
      cart(0.55, 0.5, 10.5, 0.3, 0.0, j[2]), cow(1.5, 0.0, 10.5, 0.0, j[3]),
      boat(0.5, 0.5, 20.5, 0.25, 0, j[4]), cart(2.2, 0.5, 20.5, -0.15, 0.0, j[5]),
      arrow(-2.0, 1.0, 30.5, 0.9, 0.0, 0.0, j[6]), dcow(1.0, 0.0, 30.5, 1, 0, j[7]),
      orb(30.4, 0.5, 40.5, 7, j[8]), orb(30.6, 0.5, 40.5, 3, j[9]),
      painting(20, 3, 50, 0, 98, j[10]),
    };
  }
  static String[] item(double x, double y, double z, double vx, int c, int a, int j) { return EntityListProbe.item(x, y, z, vx, c, a, j); }
  static String[] cart(double x, double y, double z, double vx, double vz, int j) { return EntityListProbe.cart(x, y, z, vx, vz, j); }
  static String[] cow(double x, double y, double z, double vx, int j) { return EntityListProbe.cow(x, y, z, vx, j); }
  static String[] boat(double x, double y, double z, double vx, double yaw, int j) { return EntityListProbe.boat(x, y, z, vx, yaw, j); }
  static String[] arrow(double x, double y, double z, double vx, double vy, double vz, int j) { return EntityListProbe.arrow(x, y, z, vx, vy, vz, j); }
  static String[] dcow(double x, double y, double z, int h, int r, int j) { return EntityListProbe.dcow(x, y, z, h, r, j); }
  static String[] orb(double x, double y, double z, int v, int j) { return EntityListProbe.orb(x, y, z, v, j); }
  static String[] painting(int x, int y, int z, int d, int c, int j) { return EntityListProbe.painting(x, y, z, d, c, j); }
  // the groups in the given order of their 11 entities, then the wall set-ups of the painting
  static void run(String name, int ticks, int[] order, int[] joins, String[]... extra) throws Exception {
    String[][] g = groups(joins);
    List<String[]> specs = new ArrayList<>();
    specs.add(EntityListProbe.setBlock(20, 3, 50, 1, -1));
    for (int i : order) specs.add(g[i]);
    specs.add(EntityListProbe.setBlock(20, 3, 50, 0, 2));
    specs.addAll(Arrays.asList(extra));
    EntityListProbe.scenario(name, ticks, specs.toArray(new String[0][]));
  }
  static int at(int[] order, int group) { for (int i = 0; i < order.length; i++) if (order[i] == group) return i; throw new RuntimeException(); }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[] fwd = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, rev = {10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0}, mix = {5, 0, 3, 7, 10, 2, 9, 4, 1, 8, 6};
    int[] now = new int[11];
    run("b50ao-all-fwd", 30, fwd, now);
    run("b50ao-all-rev", 30, rev, now);
    run("b50ao-all-mix", 30, mix, now);
    // joins at different ticks: the later joiner of a pair updates after its partner whatever the order the specs were made in
    run("b50ao-join-late-a", 30, fwd, new int[] {0, 2, 1, 0, 3, 0, 2, 0, 0, 1, 0});
    run("b50ao-join-late-b", 30, rev, new int[] {2, 0, 0, 1, 0, 3, 0, 2, 1, 0, 1});
    run("b50ao-join-late-mix", 30, mix, new int[] {1, 0, 0, 2, 2, 0, 1, 0, 3, 0, 4});
    // a cow killed at tick 2 (outOfWorld, before the walk) is removed from the list at deathTime 20; the entities that join after (tick 4 and tick 24) land at the end
    run("b50ao-kill-mid", 40, fwd, new int[] {0, 4, 0, 0, 0, 24, 0, 0, 24, 4, 0}, EntityListProbe.hit(at(fwd, 3), 1, 2, 0, 1000.0f, 0));
    run("b50ao-kill-mid-rev", 40, rev, new int[] {0, 4, 0, 0, 0, 24, 0, 0, 24, 4, 0}, EntityListProbe.hit(at(rev, 3), 1, 2, 0, 1000.0f, 0));
  }
}
