// The float arithmetic of GuiInventory.func_147046_a (bfu.a(IIIFFLsv;)V) for a range of mouse offsets, exactly as the
// bytecode orders it: (float) Math.atan(offset / 40.0f) * 20.0f (or 40.0f), negated for the pitch terms.
// One JSON object per line: [offset, renderYawOffset, rotationYaw, pitch].
public class InventoryPlayerProbe {
  public static void main(String[] args) {
    for (int m = -400; m <= 400; m++) {
      float f = m;
      float atan = (float) Math.atan(f / 40.0f);
      float yawOffset = atan * 20.0f, yaw = atan * 40.0f, pitch = -atan * 20.0f;
      System.out.println("{\"m\":" + m + ",\"yawOffset\":" + yawOffset + ",\"yaw\":" + yaw + ",\"pitch\":" + pitch + "}");
    }
  }
}
