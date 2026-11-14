// Batch 64 stand-in for Minecraft (bao), shadowing the game class on the probe classpath only (its static initialiser needs LWJGL's display classes): ItemRenderer.renderItemInFirstPerson
// reads the player h, the world f and the texture manager through P().
public class bao {
  public bqf L;
  public bjk h;
  public bjf f;
  public bqf P() { return L; }
}
