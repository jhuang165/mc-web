import java.util.*;
// Batch 88 boatray88: ItemBoat.onItemRightClick's ray [abj.a] at edge angles, with the unchanged native classes on the BoatProbe map world.
// The looking player is the probe Rider (yOffset [sa.L] 0, as EntityPlayerMP: mw.<init> and mw.e_ put 0.0F in L), so the ray starts at posY + 1.62
// and its direction comes from MathHelper.sin / cos [qh.a / qh.b] of the float rotation. Each scene puts water cells where a ray changes cell (or
// misses) within a few float steps of the angle; the scan steps one float at a time (Math.nextUp) through `from`..`to` and prints the angle before and
// after every change of the result, plus coarse samples over a wider range. Records: scene, yaw, pitch, the player's posY and ySize [sa.V], the trace
// start rayTraceBlocks leaves, the item count (2 before) and the spawned boat. tools/verify-boat-ray.mjs writes public/research/boat-ray-reference.json;
// src/boatray88-b88.test.js replays it.
public class BoatRayProbe extends BoatEntityProbe {
  static String run(String scene, int[][] cells, double x, double posY, double z, float ySize, float yaw, float pitch) throws Exception {
    BW w = bw(cells);
    Rider p = rider(w, yaw, 0);
    p.V = ySize; p.b(x, posY, z);
    p.z = pitch; p.B = pitch; p.y = yaw; p.A = yaw; p.S = x; p.T = posY; p.U = z; p.p = x; p.q = posY; p.r = z;
    w.entities.add(p);
    int before = w.spawned.size();
    add stack = new add(adb.d(333), 2, 0);
    add result = ((abj) stack.b()).a(stack, w, p);
    sa b = w.spawned.size() > before ? w.spawned.get(w.spawned.size() - 1) : null;
    return "{\"scene\":\"" + scene + "\",\"yaw\":" + yaw + ",\"pitch\":" + pitch + ",\"pos\":[" + num(x) + "," + num(posY) + "," + num(z) + "],\"ySize\":" + ySize
      + ",\"box\":[" + num(p.C.b) + "],\"traceStart\":" + (w.traceStart == null ? "null" : "[" + num(w.traceStart[0]) + "," + num(w.traceStart[1]) + "," + num(w.traceStart[2]) + "]")
      + ",\"count\":" + result.b + ",\"boat\":" + (b == null ? "null" : "[" + num(b.s) + "," + num(b.t) + "," + num(b.u) + "]") + "}";
  }
  static String key(String rec) { return rec.substring(rec.indexOf(",\"count\"")); }
  // `pitchVaries`: the scan runs over the pitch with the yaw fixed, else over the yaw.
  static void scene(String name, int[][] cells, double x, double posY, double z, float ySize, boolean pitchVaries, float fixed, float from, float to, float wideFrom, float wideTo) throws Exception {
    String prev = null; boolean prevShown = false;
    for (float a = from; a <= to; a = Math.nextUp(a)) {
      String rec = pitchVaries ? run(name, cells, x, posY, z, ySize, fixed, a) : run(name, cells, x, posY, z, ySize, a, fixed);
      boolean show = prev == null || !key(rec).equals(key(prev));
      if (show && prev != null && !prevShown) System.out.println(prev);
      if (show) System.out.println(rec);
      prev = rec; prevShown = show;
    }
    if (!prevShown) System.out.println(prev);
    for (int i = 0; i <= 24; i++) {
      float a = wideFrom + (wideTo - wideFrom) * i / 24f;
      System.out.println(pitchVaries ? run(name + "-wide", cells, x, posY, z, ySize, fixed, a) : run(name + "-wide", cells, x, posY, z, ySize, a, fixed));
    }
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[][] twoX = {{2, 1, 4, 9, 0}, {3, 1, 4, 9, 0}}, twoZ = {{3, 1, 4, 9, 0}, {3, 1, 5, 9, 0}}, one = {{3, 1, 4, 9, 0}};
    // Looking east (yaw -90) down onto the edge x = 3 between two water cells.
    scene("x-edge", twoX, 2.5, 3, 4.5, 0f, true, -90f, 79.1945f, 79.1960f, 60f, 85f);
    // Pitch 70, turning across the edge z = 5 between two water cells.
    scene("z-edge", twoZ, 2.5, 3, 4.5, 0f, false, 70f, -58.3775f, -58.3645f, -85f, -20f);
    // Looking east past the near edge of a single water cell: hit or miss.
    scene("miss-edge", one, 2.5, 3, 4.5, 0f, true, -90f, 60.2048f, 60.2085f, 45f, 80f);
    // As x-edge with a step-smoothing ySize 0.3: the ray starts at posY + 1.62 (the box bottom is posY + ySize).
    scene("ysize-edge", twoX, 2.5, 3, 4.5, 0.3f, true, -90f, 79.1945f, 79.1960f, 60f, 85f);
  }
}
