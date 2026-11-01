import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Records the unchanged EntityXPOrb.onUpdate [sq.h]: Entity.onEntityUpdate (water push, the fire
// countdown, lava), gravity, the lava fizz, func_145771_j, the player search and pull, moveEntity
// and the ground friction and bounce. Rec only records attackEntityFrom (then calls the original)
// and playSound. XW is the PlantProbe map-backed world without MobMoveProbe.ProbeWorld's stubs, so
// isMaterialInBB [ahb.a(azt,awt)] and handleMaterialAcceleration [ahb.a(azt,awt,sa)] are the
// original World methods: water pushes and lava burns. The target, listed in World.playerEntities
// [ahb.h], is an EntityPlayerSP [blk] whose getEyeHeight returns EntityPlayerMP's 1.62F [mw.g]:
// server orbs aim at the server player, whose posY is the feet (mw itself needs netty to load).
// tools/verify-xporbs.mjs writes public/research/xporb-reference.json; src/xp-orbs.test.js replays it.
public class XpOrbProbe {
  static StringBuilder log = new StringBuilder();

  // The PlantProbe.W map-backed world, extending World [ahb] directly so isMaterialInBB and
  // handleMaterialAcceleration stay the original methods (ProbeWorld stubs them).
  public static class XW extends ahb {
    XW() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    Map<Long, int[]> cells = new HashMap<>();
    int[] cell(int x, int y, int z) { int[] c = cells.get(PlantProbe.W.key(x, y, z)); return c != null ? c : new int[] {y < 0 ? 1 : 0, 0}; }
    void put(int x, int y, int z, int id, int meta) { cells.put(PlantProbe.W.key(x, y, z), new int[] {id, meta}); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { return y > 255 ? aji.e(0) : aji.e(cell(x, y, z)[0]); }
    public int e(int x, int y, int z) { return y > 255 ? 0 : cell(x, y, z)[1]; }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public void a(sa entity, String sound, float volume, float pitch) {}
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
  }

  static class Rec extends sq {
    Rec(ahb w, double x, double y, double z, int value) { super(w, x, y, z, value); }
    public boolean a(ro source, float amount) { log.append(source.o).append(':').append(amount).append(' '); return super.a(source, amount); }
    public void a(String sound, float volume, float pitch) { log.append(sound).append('@').append(volume).append('/').append(pitch).append(' '); }
  }

  static class Target extends blk {
    Target() { super(null, null, null, 0); }
    public float g() { return 1.62f; }
  }

  static XW world(int[][] cells) throws Exception {
    XW w = (XW) PlantProbe.unsafe.allocateInstance(XW.class);
    MobMoveProbe.set(w, "t", PlantProbe.unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    w.cells = new HashMap<>();
    for (int[] c : cells) w.put(c[0], c[1], c[2], c[3], c.length > 4 ? c[4] : 0);
    return w;
  }

  // Original ids: stone 1, flowing water 8, water 9, still lava 11, glass 20, fire 51, ice 79, cactus 81.
  // Each case: name, cells, orb posX/posY/posZ, motion, entityId, player feet or null, the tick the
  // player moves 20 blocks away (-1 never).
  static Object[][] CASES;
  static int[][] ice() {
    List<int[]> c = new ArrayList<>();
    for (int x = -2; x < 12; x++) for (int z = -2; z < 3; z++) c.add(new int[] {x, -1, z, 79});
    return c.toArray(new int[0][]);
  }
  static int[][] stream() {
    List<int[]> c = new ArrayList<>();
    c.add(new int[] {0, 0, 0, 9, 0});
    for (int x = 1; x < 6; x++) c.add(new int[] {x, 0, 0, 8, x});
    return c.toArray(new int[0][]);
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[][] none = {};
    double[] p1 = {3.5, 0, 0.5}, p2 = {6.2, 0, 0.5}, p3 = {0.5, 0, 7.4}, p4 = {9.5, 0, 0.5}, p5 = {2.3, 2, 1.7}, p6 = {0.5, 0, 1.2};
    CASES = new Object[][] {
      {"drop", none, 0.5, 2.25, 0.5, 0.1, 0.2, -0.05, 0, null, -1},
      {"rest", none, 0.5, 0.25, 0.5, 0.0, 0.0, 0.0, 0, null, -1},
      {"ice", ice(), 0.5, 0.25, 0.5, 0.15, 0.0, 0.0, 0, null, -1},
      {"wall", new int[][] {{2, 0, 0, 20}, {2, 1, 0, 20}, {2, 2, 0, 20}}, 0.5, 0.75, 0.5, 0.3, 0.1, 0.02, 0, null, -1},
      {"ceiling", new int[][] {{0, 2, 0, 1}}, 0.5, 0.75, 0.5, 0.0, 0.5, 0.0, 0, null, -1},
      {"pull-near", none, 0.5, 0.25, 0.5, 0.0, 0.1, 0.0, 0, p1, -1},
      {"pull-far", none, 0.5, 0.25, 0.5, 0.0, 0.1, 0.0, 7, p2, -1},
      {"pull-z", none, 0.5, 1.25, 0.5, 0.05, 0.0, 0.0, 50, p3, -1},
      {"pull-out", none, 0.5, 0.25, 0.5, 0.0, 0.1, 0.0, 99, p4, -1},
      {"pull-above", none, 0.5, 0.25, 0.5, 0.0, 0.0, 0.0, 21, p5, -1},
      {"pull-leave", none, 0.5, 0.25, 0.5, 0.0, 0.0, 0.0, 120, p1, 30},
      {"pull-touch", none, 0.5, 0.25, 0.5, 0.0, 0.0, 0.0, 3, p6, -1},
      {"lava", new int[][] {{0, 0, 0, 11}}, 0.5, 0.25, 0.5, 0.0, 0.0, 0.0, 0, null, -1},
      {"lava-edge", new int[][] {{1, 0, 0, 11}}, 0.5, 0.25, 0.5, 0.2, 0.1, 0.0, 0, null, -1},
      {"water", stream(), 0.5, 0.25, 0.5, 0.0, 0.0, 0.0, 0, null, -1},
      {"fire", new int[][] {{1, 0, 0, 51}}, 0.5, 0.25, 0.5, 0.12, 0.0, 0.0, 0, null, -1},
      {"cactus", new int[][] {{1, 0, 0, 81}, {2, 0, 0, 81}}, 0.5, 1.25, 0.5, 0.15, 0.2, 0.0, 0, null, -1},
      {"inside", new int[][] {{0, 0, 0, 1}}, 0.5, 0.5, 0.5, 0.0, 0.0, 0.0, 0, null, -1},
      {"inside-side", new int[][] {{0, 0, 0, 1}, {0, 1, 0, 1}}, 0.2, 0.6, 0.55, 0.0, 0.0, 0.0, 0, null, -1},
    };
    for (int i = 0; i < CASES.length; i++) {
      Object[] c = CASES[i];
      XW w = world((int[][]) c[1]);
      Rec o = new Rec(w, (double) c[2], (double) c[3], (double) c[4], 7);
      PlayerStepProbe.field(sa.class, "Z").set(o, new Random(i + 1));
      PlayerStepProbe.field(sa.class, "c").setInt(o, (int) c[8]);
      PlayerStepProbe.field(sa.class, "v").setDouble(o, (double) c[5]);
      PlayerStepProbe.field(sa.class, "w").setDouble(o, (double) c[6]);
      PlayerStepProbe.field(sa.class, "x").setDouble(o, (double) c[7]);
      Target p = null;
      double[] feet = (double[]) c[9];
      if (feet != null) {
        p = (Target) PlantProbe.unsafe.allocateInstance(Target.class);
        PlayerStepProbe.field(sa.class, "o").set(p, w);
        PlayerStepProbe.field(sa.class, "s").setDouble(p, feet[0]);
        PlayerStepProbe.field(sa.class, "t").setDouble(p, feet[1]);
        PlayerStepProbe.field(sa.class, "u").setDouble(p, feet[2]);
        ((List) MobMoveProbe.field(ahb.class, "h").get(w)).add(p);
      }
      StringBuilder ticks = new StringBuilder();
      for (int t = 0; t < 120; t++) {
        if (p != null && t == (int) c[10]) PlayerStepProbe.field(sa.class, "s").setDouble(p, feet[0] + 20);
        log.setLength(0);
        o.h();
        if (t > 0) ticks.append(',');
        ticks.append("[").append(o.s).append(',').append(o.t).append(',').append(o.u).append(',').append(o.v).append(',').append(o.w).append(',').append(o.x)
          .append(',').append(o.D).append(',').append(PlayerStepProbe.field(sa.class, "e").getInt(o)).append(',').append(PlayerStepProbe.field(sq.class, "d").getInt(o))
          .append(',').append(o.K).append(',').append(PlayerStepProbe.field(sq.class, "g").getInt(o)).append(',').append(PlayerStepProbe.field(sq.class, "f").get(o) != null)
          .append(",\"").append(log.toString().trim()).append("\"]");
        if (o.K) break;
      }
      StringBuilder cells = new StringBuilder();
      for (int[] cell : (int[][]) c[1]) {
        cells.append(cells.length() == 0 ? "" : ",").append('[');
        for (int k = 0; k < cell.length; k++) cells.append(k == 0 ? "" : ",").append(cell[k]);
        cells.append(']');
      }
      System.out.println("{\"name\":\"" + c[0] + "\",\"seed\":" + (i + 1) + ",\"cells\":[" + cells + "],\"x\":" + c[2] + ",\"y\":" + c[3] + ",\"z\":" + c[4]
        + ",\"motion\":[" + c[5] + "," + c[6] + "," + c[7] + "],\"id\":" + c[8] + ",\"player\":" + (feet == null ? "null" : "[" + feet[0] + "," + feet[1] + "," + feet[2] + "]")
        + ",\"leave\":" + c[10] + ",\"ticks\":[" + ticks + "]}");
    }
  }
}
