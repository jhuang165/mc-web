import java.util.*;

// Block light audit (batch 17): Block.lightValue (field t, set by setLightLevel; Block.getLightValue() returns it and no 1.7.10 block
// overrides the per-position variant) and Block.lightOpacity (field r) for every registered block id 0-255 of the unchanged jar.
public class BlockLightProbe {
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    for (int id = 0; id < 256; id++) {
      aji b = aji.e(id);
      if (b == null || (id != 0 && aji.b(b) != id)) continue;
      System.out.println("{\"case\":\"light\",\"id\":" + id + ",\"lightValue\":" + MobMoveProbe.field(aji.class, "t").getInt(b)
        + ",\"lightOpacity\":" + MobMoveProbe.field(aji.class, "r").getInt(b) + ",\"opaque\":" + b.c() + ",\"useNeighborBrightness\":" + MobMoveProbe.b(b, "u") + "}");
    }
  }
}
