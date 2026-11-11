// Batch 45 stand-in for Minecraft (bao), shadowing the game class on the probe classpath only (its static initialiser needs LWJGL's display classes): ItemRenderer.renderItem
// reads the texture manager through P(). The held transforms never reach the other members.
public class bao {
  public bqf L;
  public bqf P() { return L; }
}
