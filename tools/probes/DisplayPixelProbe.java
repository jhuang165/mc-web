import java.util.*;
import org.lwjgl.opengl.GL11;

// Batch 57 displaypixel (tag b57dp), two executed parts on the unchanged 1.7.10 client classes.
// 1. itemBlock: for every block id 1..255 the Item that Item.getItemFromBlock (adb.a(aji)) returns (null: the block has no item of its own), that item's id and class, the block's
//    render type (aji.b()) and RenderBlocks.renderItemIn3d (blm.a(int)). RenderItem and ItemRenderer draw an ItemBlock whose type passes renderItemIn3d as a block (renderBlockAsItem) and
//    every other item as a flat sprite.
// 2. standard item lighting: RenderHelper.enableStandardItemLighting (bam.b()) on a recording GL11: every glLight, glLightModel, glColorMaterial, glEnable call it makes, in order.
public class DisplayPixelProbe {
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    for (int id = 1; id < 256; id++) {
      aji b = aji.e(id);
      if (b == null || b == ajn.a) continue;
      adb item = adb.a(b);
      int type = b.b();
      System.out.println("{\"kind\":\"itemBlock\",\"id\":" + id + ",\"renderType\":" + type + ",\"in3d\":" + blm.a(type) + ",\"item\":" + (item == null ? -1 : adb.b(item)) + ",\"itemClass\":\"" + (item == null ? "" : item.getClass().getSimpleName()) + "\",\"itemIconName\":" + (b.O() == null ? "null" : "\"" + b.O() + "\"") + "}");
    }
    GL11.log.clear();
    bam.b();
    StringBuilder sb = new StringBuilder();
    for (String l : GL11.log) sb.append(sb.length() == 0 ? "" : ",").append('"').append(l).append('"');
    System.out.println("{\"kind\":\"standardLighting\",\"calls\":[" + sb + "]}");
  }
}
