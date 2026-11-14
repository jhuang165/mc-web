import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged MapData (ayi), MapData.MapInfo (ayj) and MapData.MapCoord (ayk) of the 1.7.10 JAR (no world double needed): MapInfo.getPacket(stack) is the
// per-player S34PacketMaps payload generator the server calls once per tick for every map in a player's inventory (EntityPlayerMP.onUpdateEntity) and every 10 ticks
// for a map in an item frame (EntityTrackerEntry). Prints one JSON object per line, one per call: {case, i, t, n, h, b}. `t` is the first byte (2 scale, 1 icons,
// 0 columns), `n` the length, `h` Arrays.hashCode of the bytes, `b` the bytes (all for n <= 40, else the first 6). A null result prints {t: -1}.
public class MapPacketProbe {
  static final Class<?> DATA, INFO, COORD, STACK, ITEM, FRAME;
  static final Method SET_INFO, DIRTY, PACKET, STACK_FRAME;
  static final Field G, E, D;
  static {
    try {
      DATA = Class.forName("ayi"); INFO = Class.forName("ayj"); COORD = Class.forName("ayk"); STACK = Class.forName("add"); ITEM = Class.forName("adb"); FRAME = Class.forName("st");
      SET_INFO = DATA.getMethod("a", Class.forName("yz"));
      DIRTY = DATA.getMethod("a", int.class, int.class, int.class);
      PACKET = INFO.getMethod("a", STACK);
      STACK_FRAME = STACK.getMethod("a", FRAME);
      G = DATA.getField("g"); E = DATA.getField("e"); D = DATA.getField("d");
    } catch (Exception e) { throw new RuntimeException(e); }
  }
  static Object unsafe() throws Exception { Field f = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe"); f.setAccessible(true); return f.get(null); }
  static Object newData(int scale) throws Exception {
    Object d = DATA.getConstructor(String.class).newInstance("map_0");
    D.setByte(d, (byte) scale);
    byte[] c = (byte[]) E.get(d);
    for (int i = 0; i < c.length; i++) c[i] = (byte) ((i * 7 + 3) % 200);
    return d;
  }
  static Object newStack(boolean onFrame) throws Exception {
    Object stack = STACK.getConstructor(ITEM, int.class, int.class).newInstance(null, 1, 0);
    if (onFrame) {
      Object u = unsafe();
      Object frame = u.getClass().getMethod("allocateInstance", Class.class).invoke(u, FRAME);
      STACK_FRAME.invoke(stack, frame);
    }
    return stack;
  }
  static void icon(Object data, String key, int type, int x, int z, int rot) throws Exception {
    Constructor<?> k = COORD.getConstructor(DATA, byte.class, byte.class, byte.class, byte.class);
    ((Map<Object, Object>) G.get(data)).put(key, k.newInstance(data, (byte) type, (byte) x, (byte) z, (byte) rot));
  }
  static void print(String c, int i, byte[] b) {
    StringBuilder s = new StringBuilder("{\"case\":\"" + c + "\",\"i\":" + i);
    if (b == null) s.append(",\"t\":-1,\"n\":0,\"h\":0,\"b\":[]}");
    else {
      s.append(",\"t\":").append(b[0]).append(",\"n\":").append(b.length).append(",\"h\":").append(Arrays.hashCode(b)).append(",\"b\":[");
      int m = b.length <= 40 ? b.length : 6;
      for (int j = 0; j < m; j++) s.append(j > 0 ? "," : "").append(b[j]);
      s.append("]}");
    }
    System.out.println(s);
  }
  static void run(String c, Object info, Object stack, int from, int count) throws Exception {
    for (int i = from; i < from + count; i++) print(c, i, (byte[]) PACKET.invoke(info, stack));
  }
  public static void main(String[] a) throws Exception {
    // seq: a new map with every column dirty, plain stack: the scale record, the first icon packet, then a column every call and icons every 5th call
    Object d = newData(2), info = SET_INFO.invoke(d, new Object[] { null }), plain = newStack(false);
    run("seq", info, plain, 0, 170);
    // partial: the columns are all sent; two dirty ranges of column 5 merge (min of lows, max of highs), column 77 is separate
    DIRTY.invoke(d, 5, 10, 20); DIRTY.invoke(d, 5, 15, 30); DIRTY.invoke(d, 77, 0, 3); DIRTY.invoke(d, 5, 2, 2);
    run("partial", info, plain, 0, 60);
    // decor: two icons added after three calls; a plain stack sends the icon packet only when it changed
    d = newData(0); info = SET_INFO.invoke(d, new Object[] { null });
    run("decor", info, plain, 0, 3);
    icon(d, "Alex", 0, 10, -20, 4); icon(d, "frame-3", 1, 120, 30, 8);
    run("decor", info, plain, 3, 30);
    icon(d, "Alex", 0, 11, -20, 4);
    run("decor", info, plain, 33, 12);
    // frame: the same on an item-frame stack, whose icon packet is sent at every fifth call whether or not it changed
    d = newData(1); info = SET_INFO.invoke(d, new Object[] { null });
    icon(d, "frame-3", 1, 120, 30, 8);
    run("frame", info, newStack(true), 0, 30);
  }
}
