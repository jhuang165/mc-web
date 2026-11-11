// Batch 45 stand-in for TextureManager (bqf), shadowing the game class on the probe classpath only: bindTexture does nothing, and the item sheet lookup
// (ItemRenderer.renderItem asks for the block or item sheet by sprite number) answers null. The two interfaces are the original's.
public class bqf implements bqj, bqz {
  public void a(bqx location) {}
  public bqx a(int spriteNumber) { return null; }
  public void e() {}
  public void a(bqy manager) {}
}
