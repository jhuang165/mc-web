import java.lang.reflect.Method;

// Records the tail of the unchanged Entity.moveEntity [sa.d]: doBlockCollisions [sa.I], which
// calls Block.onEntityCollidedWithBlock for every cell of the box contracted by 0.001
// (BlockCactus: attackEntityFrom(cactus, 1); BlockWeb: setInWeb), then the burning-box test
// (World.isBoundingBoxBurning [ahb.e(azt)]: fire or lava) with dealFireDamage(1), the fire
// counter [sa.e] against fireResistance [sa.ab] and the wet fizz.
// Rec is EntityPlayerSP with four probe overrides that only record or supply inputs:
// attackEntityFrom (returns false so health is untouched), setInWeb (calls the original
// EntityPlayer.setInWeb, which skips flying players), playSound and isWet [sa.L].
// tools/verify-blockcollide.mjs writes public/research/blockcollide-reference.json;
// src/block-collisions.test.js replays it.
public class BlockCollideProbe {
  static StringBuilder log = new StringBuilder();
  static boolean wet;

  static class Rec extends blk {
    Rec() { super(null, null, null, 0); }
    public boolean a(ro source, float amount) { log.append(source.o).append(':').append(amount).append(' '); return false; }
    public void as() { log.append("web "); super.as(); }
    public void a(String sound, float volume, float pitch) { log.append(sound).append(' '); }
    public boolean L() { return wet; }
  }

  // Original ids: cactus 81, web 30, fire 51, still lava 11. Cells relative to (64, 0, 64).
  static int[][][] LAYOUTS = {
    {},
    {{0, 0, 0, 81}},
    {{0, 0, 1, 81}},
    {{0, 0, 0, 81}, {1, 0, 0, 81}},
    {{0, 0, 0, 30}},
    {{0, 1, 0, 30}},
    {{0, 0, 0, 51}},
    {{0, 0, 1, 51}},
    {{0, 0, 0, 11}},
    {{0, 0, 0, 51}, {0, 0, 1, 81}},
    {{0, 0, 0, 30}, {0, 1, 0, 51}},
    {{0, 0, 0, 81}, {0, 0, 1, 30}, {1, 0, 0, 51}},
  };
  static double[][] POSITIONS = {{64.5, 64.5}, {64.5, 64.75}, {64.5, 64.7005}, {64.75, 64.75}};

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    Method move = PlayerStepProbe.method(sa.class, "d", double.class, double.class, double.class);
    for (int l = 0; l < LAYOUTS.length; l++) {
      boolean hasWeb = false;
      for (int[] c : LAYOUTS[l]) hasWeb |= c[3] == 30;
      for (double[] p : POSITIONS)
        for (int fire : new int[] {0, -20, 30})
          for (int resistance : new int[] {20, 1})
            for (boolean isWet : new boolean[] {false, true})
              for (boolean flying : new boolean[] {false, true}) {
                if (flying && !hasWeb) continue;
                PlantProbe.unsafe = u;
                PlantProbe.W w = PlantProbe.world((x, y, z) -> new int[] {y < -1 ? 1 : 0, 0});
                for (int[] c : LAYOUTS[l]) w.put(64 + c[0], c[1], 64 + c[2], c[3], 0);
                Rec e = (Rec) PlayerStepProbe.spawn(u, w, Rec.class, p[0], p[1], 0f, false, false, 0f);
                ((yw) PlayerStepProbe.field(yz.class, "bE").get(e)).b = flying;
                // setFire reads the armour through EnchantmentProtection.getFireTimeForEntity: an empty inventory.
                PlayerStepProbe.field(yz.class, "bm").set(e, new yx(e));
                PlayerStepProbe.field(sa.class, "e").setInt(e, fire);
                PlayerStepProbe.field(sa.class, "ab").setInt(e, resistance);
                wet = isWet;
                StringBuilder ticks = new StringBuilder();
                for (int t = 0; t < 22; t++) {
                  log.setLength(0);
                  PlayerStepProbe.field(sa.class, "R").setFloat(e, 1.5f);
                  move.invoke(e, 0.0, 0.0, 0.0);
                  if (t > 0) ticks.append(',');
                  ticks.append("[\"").append(log.toString().trim()).append("\",").append(PlayerStepProbe.field(sa.class, "e").getInt(e))
                    .append(',').append(PlayerStepProbe.field(sa.class, "I").getBoolean(e)).append(',').append(PlayerStepProbe.field(sa.class, "R").getFloat(e)).append(']');
                }
                StringBuilder cells = new StringBuilder();
                for (int[] c : LAYOUTS[l]) cells.append(cells.length() == 0 ? "" : ",").append("[" + c[0] + "," + c[1] + "," + c[2] + "," + c[3] + "]");
                System.out.println("{\"cells\":[" + cells + "],\"x\":" + p[0] + ",\"z\":" + p[1] + ",\"fire\":" + fire + ",\"resistance\":" + resistance
                  + ",\"wet\":" + isWet + ",\"flying\":" + flying + ",\"ticks\":[" + ticks + "]}");
              }
    }
  }
}
