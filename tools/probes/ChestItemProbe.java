// Batch 43: runs the unchanged 1.7.10 chest item path, RenderBlocks.renderBlockAsItem (blm.a) for render type 22 -> TileEntityRendererChestHelper (bls.a) ->
// TileEntityRendererDispatcher (bmk.a) -> TileEntityChestRenderer (bmm) / TileEntityEnderChestRenderer -> ModelChest (bhg) -> ModelRenderer (bix) boxes drawn through the
// real Tessellator (bmh). GL goes to the recording stand-in (probes/gl/GL11.java), which now also records glScalef/glPushMatrix/glPopMatrix and replays display lists
// where the ModelRenderers compiled their boxes. No texture manager: TileEntitySpecialRenderer.bindTexture skips a null one, so the texture choice is not executed here
// (it is the renderer's bytecode: ender.png / trapped.png / normal.png, christmas.png from Dec 24-26). Output: per chest block id (54, 146, 130) the event list as in
// ItemRenderProbe, vertices as float bits with u, v as fractions of the 64x64 texture.
public class ChestItemProbe {
  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    sun.misc.Unsafe unsafe = (sun.misc.Unsafe) uf.get(null);
    LightFloatProbe.unsafe = unsafe;
    aji.p();
    bao.M = new bao();
    bao.M.u = new bbj();
    blm rb = (blm) unsafe.allocateInstance(blm.class);
    LightFloatProbe.set(rb, "c", true);
    LightFloatProbe.set(rb, "q", bao.M);
    bmh t = bmh.a;
    final java.lang.reflect.Field fF = LightFloatProbe.field(bmh.class, "f");
    org.lwjgl.opengl.GL11.onDraw = () -> {
      try {
        int[] raw = (int[]) fF.get(t); int n = (Integer) LightFloatProbe.get(t, "g");
        StringBuilder s = new StringBuilder("[\"D\",").append(n).append(",[");
        for (int i = 0; i < n; i++) {
          int o = i * 8;
          for (int k = 0; k < 8; k++) s.append(i + k > 0 ? "," : "").append(raw[o + k]);
        }
        return s.append("]]").toString();
      } catch (Exception e) { throw new RuntimeException(e); }
    };
    StringBuilder out = new StringBuilder("{\"items\":[");
    int count = 0;
    for (int id : new int[] {54, 146, 130}) {
      aji block = aji.e(id);
      org.lwjgl.opengl.GL11.events.clear();
      rb.a(block, 0, 1.0f);
      out.append(count++ > 0 ? "," : "").append("{\"id\":").append(id).append(",\"meta\":0,\"type\":").append(block.b()).append(",\"events\":[")
        .append(String.join(",", org.lwjgl.opengl.GL11.events)).append("]}");
    }
    System.out.println(out.append("]}"));
  }
}
