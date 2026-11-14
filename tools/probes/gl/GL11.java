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
  public static void glTranslatef(float x, float y, float z) { add("[\"T\"," + x + "," + y + "," + z + "]"); }
  public static void glRotatef(float a, float x, float y, float z) { add("[\"R\"," + a + "," + x + "," + y + "," + z + "]"); }
  public static void glColor4f(float r, float g, float b, float a) { add("[\"C\"," + r + "," + g + "," + b + "," + a + "]"); }
  public static void glScalef(float x, float y, float z) { add("[\"S\"," + x + "," + y + "," + z + "]"); }
  public static void glPushMatrix() { add("[\"P\"]"); }
  public static void glPopMatrix() { add("[\"O\"]"); }
  // Display lists (ModelRenderer compiles its boxes into one): events while a list is open go to that list, glCallList replays the list's events inline.
  static int nextList = 1;
  static List<String> open;
  static final java.util.Map<Integer, List<String>> lists = new java.util.HashMap<>();
  static void add(String e) { (open != null ? open : events).add(e); }
  public static int glGenLists(int n) { int id = nextList; nextList += n; return id; }
  public static void glNewList(int id, int mode) { open = new ArrayList<>(); lists.put(id, open); }
  public static void glEndList() { open = null; }
  public static boolean markLists; // BabyModelProbe: a ["L", id] event ahead of each replayed list names the model part that is drawn
  public static void glCallList(int id) { if (markLists) add("[\"L\"," + id + "]"); events.addAll(lists.get(id)); }
  public static void glColor3f(float r, float g, float b) {}
  public static void glDepthMask(boolean on) {}
  public static void glDepthFunc(int f) {}
  public static void glMatrixMode(int m) {}
  public static int glGenTextures() { return 1; }
  public static void glBindTexture(int target, int id) {}
  public static void glTexParameteri(int target, int name, int v) {}
  public static void glTexParameterf(int target, int name, float v) {}
  public static void glPixelStorei(int name, int v) {}
  public static void glTexImage2D(int a, int b, int c, int d, int e, int f, int g, int h, java.nio.IntBuffer data) {}
  public static void glTexSubImage2D(int a, int b, int c, int d, int e, int f, int g, int h, java.nio.IntBuffer data) {}
  public static void glDeleteTextures(int id) {}
  public static void glEnable(int cap) {}
  public static void glDisable(int cap) {}
  public static void glEnableClientState(int a) {}
  public static void glDisableClientState(int a) {}
  public static void glColorPointer(int a, boolean b, int c, java.nio.ByteBuffer d) {}
  public static void glNormalPointer(int a, java.nio.ByteBuffer d) {}
  public static void glTexCoordPointer(int a, int b, java.nio.FloatBuffer d) {}
  public static void glTexCoordPointer(int a, int b, java.nio.ShortBuffer d) {}
  public static void glVertexPointer(int a, int b, java.nio.FloatBuffer d) {}
  public static void glDrawArrays(int mode, int first, int count) { add(onDraw.get()); }
}
