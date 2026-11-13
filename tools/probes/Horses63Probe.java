import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 63 (horses2): two executed record sets on the unchanged 1.7.10 classes.
//   spawnSweep  EntityHorse.onSpawnWithEgg (wi.a(sy)) with null group data over 4000 seeds, and herds (the first horse gets null, each next one the group the last returned,
//               as WorldServer's spawner and ItemMonsterPlacer both do): the type, variant, age, attributes and the next Random draw. Types 3 and 4 never come out.
//   chestCat    BlockChest.func_149951_m (ajx.m, the inventory a click opens) and onBlockActivated for single, double and mixed chests with real EntityOcelot (wn) objects
//               in the entity list: sitting, standing, dead, on the chest, on its partner, beside, at the edge of the box. The OcelotProbe world double supplies the
//               block, tile entity and entity-list queries; ajx.o (the ocelot check) and ajx.m themselves are unchanged.
public class Horses63Probe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    spawnSweep();
    chestCat();
  }

  // [type, variant, age, maxHealth, speed, jump, next Random draw]
  static String row(wi e, Random r) throws Exception {
    return "[" + e.bZ() + "," + e.ca() + "," + e.d() + "," + num(HorseProbe.attrD(e, yj.a)) + "," + num(HorseProbe.attrD(e, yj.d)) + "," + num(e.ct()) + "," + r.nextInt(1000000) + "]";
  }

  static void spawnSweep() throws Exception {
    HorseRearProbe.world(false, false);
    int[] hist = new int[5];
    for (long seed = 0; seed < 4000; seed++) {
      wi e = HorseProbe.horse(seed);
      sy g = e.a((sy) null);
      Random r = (Random) MobMoveProbe.field(sa.class, "Z").get(e);
      hist[e.bZ()]++;
      HorseProbe.out("{\"case\":\"spawn\",\"seed\":" + seed + ",\"group\":[" + ((wk) g).a + "," + ((wk) g).b + "],\"row\":" + row(e, r) + "}");
    }
    int[] herdHist = new int[5];
    for (long seed = 0; seed < 300; seed++) {
      sy group = null;
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 6; i++) {
        wi e = HorseProbe.horse(seed * 7 + i);
        group = e.a(group);
        Random r = (Random) MobMoveProbe.field(sa.class, "Z").get(e);
        herdHist[e.bZ()]++;
        rows.append(i > 0 ? "," : "").append(row(e, r));
      }
      HorseProbe.out("{\"case\":\"herd\",\"seed\":" + seed + ",\"rows\":[" + rows + "]}");
    }
    HorseProbe.out("{\"case\":\"spawnTypes\",\"single\":" + java.util.Arrays.toString(hist) + ",\"herd\":" + java.util.Arrays.toString(herdHist) + "}");
  }

  public static class ChestPlayer extends OcelotProbe.FakePlayer {
    rb shown;
    public void a(rb inventory) { shown = inventory; }
  }

  static wn cat(double x, double y, double z, boolean sitting, float health) throws Exception {
    wn e = OcelotProbe.cat(3);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    e.j(true);
    e.k(sitting);
    e.g(health);
    return e;
  }

  // layout: chest ids by offset from (64,64,64): "single", "east" (partner at 65), "north" (partner at 64,63), "mixedEast" (a trapped chest at 65)
  static void chestCat() throws Exception {
    OcelotProbe.World world = (OcelotProbe.World) OcelotProbe.u.allocateInstance(OcelotProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", OcelotProbe.u.allocateInstance(aqq.class));
    OcelotProbe.W = world;
    ChestPlayer player = (ChestPlayer) OcelotProbe.u.allocateInstance(ChestPlayer.class);
    String[] layouts = { "single", "east", "north", "mixedEast" };
    // name, then cats as {x, y, z, sitting(1/0), health}
    Object[][] scenes = {
      { "none", new double[][] {} },
      { "sitOnThis", new double[][] { { 64.5, 65, 64.5, 1, 10 } } },
      { "standOnThis", new double[][] { { 64.5, 65, 64.5, 0, 10 } } },
      { "sitOnEastPartner", new double[][] { { 65.5, 65, 64.5, 1, 10 } } },
      { "sitOnNorthPartner", new double[][] { { 64.5, 65, 63.5, 1, 10 } } },
      { "sitOnSouthSide", new double[][] { { 64.5, 65, 65.5, 1, 10 } } },
      { "sitBeside", new double[][] { { 66.9, 65, 64.5, 1, 10 } } },
      { "sitEdge", new double[][] { { 64.2, 65, 64.9, 1, 10 } } },
      { "sitInside", new double[][] { { 64.5, 64, 64.5, 1, 10 } } },
      { "sitHigh", new double[][] { { 64.5, 66.5, 64.5, 1, 10 } } },
      { "sitDead", new double[][] { { 64.5, 65, 64.5, 1, 0 } } },
      { "twoCatsStandSit", new double[][] { { 64.5, 65, 64.5, 0, 10 }, { 65.5, 65, 64.5, 1, 10 } } },
    };
    for (int kind : new int[] { 54, 146 }) for (String layout : layouts) for (Object[] scene : scenes) {
      OcelotProbe.clearWorld();
      int[][] chests = layout.equals("single") ? new int[][] { { 64, 64, 64, kind } }
        : layout.equals("east") ? new int[][] { { 64, 64, 64, kind }, { 65, 64, 64, kind } }
        : layout.equals("north") ? new int[][] { { 64, 64, 64, kind }, { 64, 64, 63, kind } }
        : new int[][] { { 64, 64, 64, kind }, { 65, 64, 64, kind == 54 ? 146 : 54 } };
      for (int[] c : chests) { OcelotProbe.block(c[0], c[1], c[2], c[3], 2); OcelotProbe.chestTile(c[0], c[1], c[2], 0); }
      for (double[] c : (double[][]) scene[1]) OcelotProbe.World.entities.add(cat(c[0], c[1], c[2], c[3] == 1, (float) c[4]));
      StringBuilder per = new StringBuilder();
      for (int[] c : chests) {
        rb inv = ((ajx) aji.e(c[3])).m((ahb) world, c[0], c[1], c[2]);
        player.shown = null;
        boolean ret = aji.e(c[3]).a((ahb) world, c[0], c[1], c[2], (yz) player, 1, 0.5f, 0.5f, 0.5f);
        per.append(per.length() > 0 ? "," : "").append("{\"at\":[" + c[0] + "," + c[1] + "," + c[2] + "],\"id\":" + c[3] + ",\"size\":" + (inv == null ? -1 : inv.a()) + ",\"name\":\"" + (inv == null ? "" : inv.b()) + "\",\"returned\":" + ret + ",\"opened\":" + (player.shown != null) + "}");
      }
      HorseProbe.out("{\"case\":\"chestCat\",\"kind\":" + kind + ",\"layout\":\"" + layout + "\",\"scene\":\"" + scene[0] + "\",\"chests\":[" + per + "]}");
    }
  }
}
