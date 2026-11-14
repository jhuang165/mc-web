import java.util.Random;

// Batch 71 hudfx71: BlockGlowstone [alg] quantityDroppedWithBonus (aji.a(int fortune, Random)) and the item it drops (aji.a(int, Random, int)),
// run on the unchanged class with java.util.Random seeds 0..199 and Fortune 0..3. `after` is the next nextInt(1000) of the same Random, which
// pins the draw order and count (nextInt(3) for quantityDropped, then nextInt(fortune + 1)).
public class GlowstoneDropProbe {
  public static void main(String[] args) throws Exception {
    aji.p();
    aji glow = aji.e(89);
    StringBuilder out = new StringBuilder();
    out.append("{\"class\":\"").append(glow.getClass().getName()).append("\",\"dropsGlowstoneDustItem\":").append(glow.a(0, new Random(0), 0) == ade.aO).append("}\n");
    for (int fortune = 0; fortune <= 3; fortune++)
      for (int seed = 0; seed < 200; seed++) {
        Random r = new Random(seed);
        int n = glow.a(fortune, r);
        out.append("{\"fortune\":").append(fortune).append(",\"seed\":").append(seed).append(",\"count\":").append(n).append(",\"after\":").append(r.nextInt(1000)).append("}\n");
      }
    System.out.print(out);
  }
}
