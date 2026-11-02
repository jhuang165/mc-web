import java.lang.reflect.Method;

// Records EntityPlayerSP.func_145771_j [blk.j(DDD)Z] from the unchanged classes.
// EntityPlayerSP.onLivingUpdate calls it at the four corners (posX -/+ width * 0.35,
// boundingBox.minY + 0.5, posZ +/- width * 0.35) in the order (-,+), (-,-), (+,-), (+,+),
// right after the sneak ySize raise. Each call tests Block.isNormalCube [aji.r()] through
// the private blk.e(III)Z in the corner's cell and the cell above, and sets motionX/Z to
// -/+0.1F towards the nearest side whose two cells are both clear.
// Part 1 lists aji.r() for every original block id this build uses; part 2 runs the four
// calls with stone/glass/air layouts around the player (tools/probes/PlayerStepProbe.java's
// EntityPlayerSP on the tools/probes/PlantProbe.java world double). tools/verify-pushout.mjs
// writes public/research/pushout-reference.json; src/player-pushout.test.js replays it.
public class PushOutProbe {
  static final int[] IDS = {1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 20, 30, 31, 35, 37, 38, 41, 42, 45, 46, 47, 49, 50, 51, 54, 56, 57, 58, 59, 60, 61, 65, 78, 79, 80, 81, 82, 83, 141, 142, 172, 24, 110, 159, 111};
  static final double[] OFFSETS = {0.05, 0.3, 0.5, 0.7, 0.95};
  static final double[] FEET = {0.0, 0.3, 0.6, -0.5};

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    for (int id : IDS) System.out.println("{\"case\":\"cube\",\"id\":" + id + ",\"normal\":" + aji.e(id).r() + "}");

    Method push = PlayerStepProbe.method(blk.class, "j", double.class, double.class, double.class);
    // Layouts around the cell (64, 0, 64): the centre block at the feet or the head
    // level, and each of the four sides (-x, +x, -z, +z) open, stone or glass at one
    // level or both. Stone fills y < -1 so the floor is never open.
    int[] fills = {0, 1, 20};
    int n = 0;
    for (int centre : new int[] {1, 20})
      for (int level = 0; level < 2; level++)
        for (int mask = 0; mask < 81; mask++)
          for (double ox : OFFSETS)
            for (double oz : OFFSETS)
              for (double feet : FEET) {
                // Keep the run small: every layout with the centre offset, all offsets with three layouts.
                boolean full = mask % 27 == 0 || mask == 40 || mask == 80;
                if (!full && (ox != 0.3 || oz != 0.7 || feet != 0.0)) continue;
                PlantProbe.unsafe = u;
                PlantProbe.W w = PlantProbe.world((x, y, z) -> new int[] {y < -1 ? 1 : 0, 0});
                w.put(64, level, 64, centre, 0);
                int[][] sides = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
                StringBuilder layout = new StringBuilder();
                for (int s = 0, m = mask; s < 4; s++, m /= 3) {
                  int kind = m % 3; // 0 open, 1 stone at the feet level, 2 glass at the feet level and stone above
                  int[] d = sides[s];
                  if (kind == 1) w.put(64 + d[0], 0, 64 + d[1], 1, 0);
                  if (kind == 2) {
                    w.put(64 + d[0], 0, 64 + d[1], 20, 0);
                    w.put(64 + d[0], 1, 64 + d[1], 1, 0);
                  }
                  layout.append(s == 0 ? "" : ",").append(kind);
                }
                blk e = PlayerStepProbe.spawn(u, w, 64 + ox, 64 + oz, 0f, false, true, 0f);
                PlayerStepProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64 + ox, feet, 64 + oz);
                PlayerStepProbe.set(e, "v", 0.0123);
                PlayerStepProbe.set(e, "x", -0.0456);
                double s = PlayerStepProbe.d(e, "s"), uz = PlayerStepProbe.d(e, "u"), minY = ((azt) PlayerStepProbe.field(sa.class, "C").get(e)).b;
                double r = (double) PlayerStepProbe.fl(e, "M") * 0.35;
                boolean any = false;
                double[][] corners = {{s - r, uz + r}, {s - r, uz - r}, {s + r, uz - r}, {s + r, uz + r}};
                for (double[] c : corners) any |= (Boolean) push.invoke(e, c[0], minY + 0.5, c[1]);
                System.out.println("{\"case\":\"push\",\"centre\":" + centre + ",\"level\":" + level + ",\"sides\":[" + layout + "],\"x\":" + s + ",\"y\":" + minY
                  + ",\"z\":" + uz + ",\"returned\":" + any + ",\"vx\":" + PlayerStepProbe.d(e, "v") + ",\"vz\":" + PlayerStepProbe.d(e, "x") + "}");
                n++;
              }
  }
}
