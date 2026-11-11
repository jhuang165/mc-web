// Batch 44 stand-in for TextureManager (bqf), shadowing the game class on the probe classpath only: bindTexture does nothing (no GL, no resources), so the unchanged
// RenderItem sprite path can run. The two interfaces are the original's.
public class bqf implements bqj, bqz {
  public void a(bqx location) {}
  public void e() {}
  public void a(bqy manager) {}
}
