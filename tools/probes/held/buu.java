// Batch 45 stand-in for OpenGlHelper (buu), shadowing the game class on the probe classpath only (its static initialiser queries the GL context). Only the calls
// ItemRenderer.renderItem makes (separate blend function, texture unit selection) are present; they change no matrix.
public class buu {
  public static int c = 0;
  public static void c(int a, int b, int c, int d) {}
  public static void a(int unit, float x, float y) {}
}
