import java.io.File;
import java.lang.reflect.*;
import java.util.*;

// Batch 42 (tilesync): which TileEntity subclasses of the unchanged 1.7.10 jar describe themselves to a client. Every class in the jar extending
// TileEntity (aor) is constructed with its public no-argument constructor, placed at (1, 2, 3) and asked for getDescriptionPacket (aor.m()).
// PlayerManager.PlayerInstance sends that packet for each tile entity of a chunk it sends or resends. One JSON line per class: its name, whether
// it declares m() itself, and the packet's class and fields (S35PacketUpdateTileEntity "ik": x y z, action, NBT; S33PacketUpdateSign "ij").
// The classpath is the extracted jar classes plus the 1.7.10 libraries (a stub com.mojang.authlib.GameProfile class stands in for the skull's profile field).
public class TileDescriptionProbe {
  static String js(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ") + "\""; }
  public static void main(String[] args) throws Exception {
    File dir = new File(args[0]);
    List<String> names = new ArrayList<>();
    for (File f : dir.listFiles()) if (f.getName().endsWith(".class")) names.add(f.getName().replace(".class", ""));
    Collections.sort(names);
    Class<?> base = Class.forName("aor");
    for (String n : names) {
      Class<?> c;
      try { c = Class.forName(n, false, TileDescriptionProbe.class.getClassLoader()); } catch (Throwable t) { continue; }
      if (c == base || !base.isAssignableFrom(c) || Modifier.isAbstract(c.getModifiers())) continue;
      StringBuilder b = new StringBuilder("{\"class\":" + js(n) + ",\"super\":" + js(c.getSuperclass().getName()));
      try {
        Method own = null;
        try { own = c.getDeclaredMethod("m"); } catch (NoSuchMethodException e) { }
        b.append(",\"declaresDescription\":" + (own != null));
        Object t = c.getConstructor().newInstance();
        Field fc = base.getField("c"), fd = base.getField("d"), fe = base.getField("e");
        fc.setInt(t, 1); fd.setInt(t, 2); fe.setInt(t, 3);
        Object p = c.getMethod("m").invoke(t);
        if (p == null) b.append(",\"packet\":null");
        else {
          b.append(",\"packet\":" + js(p.getClass().getName()) + ",\"fields\":{");
          boolean first = true;
          for (Field f : p.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers())) continue;
            f.setAccessible(true);
            Object v = f.get(p);
            if (v instanceof Object[]) v = Arrays.toString((Object[]) v);
            b.append((first ? "" : ",") + js(f.getName()) + ":" + js(String.valueOf(v)));
            first = false;
          }
          b.append("}");
        }
      } catch (InvocationTargetException e) { b.append(",\"error\":" + js(String.valueOf(e.getCause()))); }
      catch (Throwable e) { b.append(",\"error\":" + js(String.valueOf(e))); }
      System.out.println(b.append("}"));
    }
  }
}
