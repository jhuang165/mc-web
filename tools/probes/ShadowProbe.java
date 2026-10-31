// Prints, for each 1.7.10 block ID given as an argument, what
// Render.renderShadow reads from the block under a shadow: whether its
// material is air, Block.renderAsNormalBlock (func_149686_d) and the
// default block bounds, from the unchanged classes after Block registration.
public class ShadowProbe {
  public static void main(String[] args) {
    aji.p();
    for (String a : args) {
      aji b = aji.e(Integer.parseInt(a));
      System.out.println("{\"id\":" + a + ",\"air\":" + (b.o() == awt.a) + ",\"normal\":" + b.d()
        + ",\"bounds\":[" + b.x() + "," + b.z() + "," + b.B() + "," + b.y() + "," + b.A() + "," + b.C() + "]}");
    }
  }
}
