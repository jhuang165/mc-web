import java.lang.reflect.Method;

// b71 steps71: which block Entity.moveEntity (sa.d) judges a step on. Rec is EntityPlayerSP with one recording
// override, Entity.func_145780_a (sa.a(int,int,int,aji)), which logs the cell and the block it was handed. The player
// stands at feet height `feet` (posY = feet + yOffset) over a stone floor with `upper` in cell y = floor(feet - 0.2)
// and `lower` one cell below it; nextStepDistance (sa.d) is 1 and distanceWalkedOnStepModified (sa.Q) is 5 for the
// "step" moves (so the step fires if the block is not air) and 0 / 100 for the "dist" moves (vertical motion 0.25
// counts towards sa.Q only over a ladder). tools/verify-step-block.mjs writes
// public/research/step-block-reference.json; src/steps71-b71.test.js replays it.
public class StepBlockProbe {
  static String logged;

  static class Rec extends blk {
    Rec() { super(null, null, null, 0); }
    protected void a(int x, int y, int z, aji b) { logged = "{\"x\":" + x + ",\"y\":" + y + ",\"z\":" + z + ",\"block\":" + aji.b(b) + "}"; }
  }

  // [label, original id, metadata]
  static Object[][] BLOCKS = {
    {"air", 0, 0}, {"stone", 1, 0}, {"slab", 44, 0}, {"snow0", 78, 0}, {"carpet", 171, 0},
    {"fence", 85, 0}, {"nether_fence", 113, 0}, {"wall", 139, 0}, {"gate", 107, 0}, {"gate_open", 107, 4}, {"soul_sand", 88, 0},
    {"farmland", 60, 0}, {"ladder", 65, 2}, {"vine", 106, 0}, {"chest", 54, 0}, {"iron_bars", 101, 0}, {"water", 9, 0}, {"stairs", 53, 0},
  };
  static double[] FEET = {1.0, 1.2, 1.5, 1.9};

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    Method move = PlayerStepProbe.method(sa.class, "d", double.class, double.class, double.class);
    Method place = PlayerStepProbe.method(sa.class, "b", double.class, double.class, double.class);
    for (Object[] up : BLOCKS)
      for (Object[] lo : BLOCKS)
        for (double feet : FEET)
          for (float yOffset : new float[] {0f, 1.62f})
            for (String kind : new String[] {"step", "dist", "sneak", "ysize"}) {
              // b72 smallfixes72: "ysize" is a step with ySize 0.2 (a sneak drop) set before the move; only stone/air/fence floors, standing yOffset 1.62
              if (kind.equals("ysize") && (yOffset != 1.62f || !(lo[1].equals(1) || lo[1].equals(85)) || !(up[1].equals(0) || up[1].equals(1) || up[1].equals(44)))) continue;
              int cy = (int) Math.floor(feet - 0.2);
              PlantProbe.unsafe = u;
              PlantProbe.W w = PlantProbe.world((x, y, z) -> new int[] {y < -3 ? 1 : 0, 0});
              for (int y = -3; y < cy - 1; y++) w.put(64, y, 64, 1, 0);
              w.put(64, cy - 1, 64, (Integer) lo[1], (Integer) lo[2]);
              w.put(64, cy, 64, (Integer) up[1], (Integer) up[2]);
              boolean sneak = kind.equals("sneak");
              Rec e = (Rec) PlayerStepProbe.spawn(u, w, Rec.class, 64.5, 64.5, 0f, sneak, sneak, 0f);
              PlayerStepProbe.field(sa.class, "L").setFloat(e, yOffset);
              if (kind.equals("ysize")) PlayerStepProbe.field(sa.class, "V").setFloat(e, 0.2f);
              place.invoke(e, 64.5, feet + yOffset, 64.5);
              boolean dist = kind.equals("dist");
              PlayerStepProbe.field(sa.class, "Q").setFloat(e, dist ? 0f : 5f);
              PlayerStepProbe.field(sa.class, "d").setInt(e, dist ? 100 : 1);
              logged = null;
              double y0 = PlayerStepProbe.d(e, "t");
              move.invoke(e, 0.001, dist ? 0.25 : -0.01, 0.001);
              System.out.println("{\"upper\":\"" + up[0] + "\",\"lower\":\"" + lo[0] + "\",\"feet\":" + feet + ",\"yOffset\":" + Float.toString(yOffset) + ",\"kind\":\"" + kind
                + "\",\"cy\":" + cy + ",\"upperId\":" + up[1] + ",\"lowerId\":" + lo[1] + ",\"endY\":" + PlayerStepProbe.num(PlayerStepProbe.d(e, "t")) + ",\"startY\":" + PlayerStepProbe.num(y0)
                + ",\"v\":" + Float.toString(PlayerStepProbe.field(sa.class, "V").getFloat(e)) + ",\"onGround\":" + PlayerStepProbe.b(e, "D") + ",\"q\":" + Float.toString(PlayerStepProbe.field(sa.class, "Q").getFloat(e)) + ",\"next\":" + PlayerStepProbe.field(sa.class, "d").getInt(e)
                + ",\"step\":" + (logged == null ? "null" : logged) + "}");
            }
  }
}
