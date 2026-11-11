package org.lwjgl.opengl;

import java.nio.Buffer;
import java.util.ArrayList;
import java.util.List;

// Stand-in for LWJGL's GL11 for the item render probe (ItemRenderProbe): the unchanged RenderBlocks.renderBlockAsItem and Tessellator.draw call these. Transforms and
// colours are recorded in call order as {"T", x, y, z}, {"R", angle, x, y, z}, {"C", r, g, b, a} strings; glDrawArrays asks the probe for the vertices the Tessellator
// holds at that moment (the real draw would hand them to OpenGL). Everything else is a no-op.
public class GL11 {
  public static final List<String> events = new ArrayList<>();
  public static java.util.function.Supplier<String> onDraw;
  public static void glTranslatef(float x, float y, float z) { events.add("[\"T\"," + x + "," + y + "," + z + "]"); }
  public static void glRotatef(float a, float x, float y, float z) { events.add("[\"R\"," + a + "," + x + "," + y + "," + z + "]"); }
  public static void glColor4f(float r, float g, float b, float a) { events.add("[\"C\"," + r + "," + g + "," + b + "," + a + "]"); }
  public static void glEnable(int cap) {}
  public static void glDisable(int cap) {}
  public static void glEnableClientState(int a) {}
  public static void glDisableClientState(int a) {}
  public static void glColorPointer(int a, boolean b, int c, java.nio.ByteBuffer d) {}
  public static void glNormalPointer(int a, java.nio.ByteBuffer d) {}
  public static void glTexCoordPointer(int a, int b, java.nio.FloatBuffer d) {}
  public static void glTexCoordPointer(int a, int b, java.nio.ShortBuffer d) {}
  public static void glVertexPointer(int a, int b, java.nio.FloatBuffer d) {}
  public static void glDrawArrays(int mode, int first, int count) { events.add(onDraw.get()); }
}
