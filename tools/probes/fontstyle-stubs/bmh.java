import org.lwjgl.opengl.GL11;
// Recording stand-in for the Tessellator (bmh) used by FontRenderer for the underline/strikethrough bars.
public class bmh {
  public static final bmh a = new bmh();
  public void b() { GL11.verts.clear(); }
  public void a(double x, double y, double z) { GL11.verts.add(new float[] {(float) x, (float) y}); }
  public int a() { GL11.flush("b"); return 0; }
}
