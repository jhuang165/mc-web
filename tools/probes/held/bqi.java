// Batch 45 stand-in for the texture sheet helper (bqi), shadowing the game class on the probe classpath only (its static initialiser builds a texture through OpenGL).
// ItemRenderer.renderItem calls its two blur-mipmap switches around the item sheet; they have no transform.
public class bqi {
  public static void a(boolean blur, boolean mipmap, float level) {}
  public static void b() {}
}
