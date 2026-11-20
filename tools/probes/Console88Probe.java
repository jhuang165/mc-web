// Batch 88 console88: executes, on the unchanged 1.7.10 classes, the packet writers (ft.b(et), writePacketData) that the netty encoder fa runs before it records
// (id, readableBytes) in NetworkStatistics (eu.b). For /netstat's byte counts.
//  * "base": every packet class of every EnumConnectionState (eo) and direction, allocated with its no-argument constructor, its fields filled with empty values
//    (numbers 0, strings "", arrays and collections empty, a chat component fq(""), enums their first constant, other objects a static instance of their class or a
//    constructor called with zeros/nulls), then written into a PacketBuffer (et). The record is the id VarInt plus the payload, as fa counts it.
//  * "samples": packets with chosen variable fields (a chat line, the "Server closed" disconnect, a sound, particles, entity ids, a tab list, window items, a
//    multi-block change, a player list item, a chunk unload ...), so the port's estimate can be compared byte for byte.
// Prints one JSON line {"base":[...],"samples":[...]}. Run through tools/verify-console88.mjs.
import com.google.common.collect.BiMap;
import io.netty.buffer.Unpooled;
import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.*;

public class Console88Probe {
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  static boolean signLines; // the sign packets (C12/S33) write exactly four lines
  static Object empty(Class<?> t, int depth) throws Exception {
    if (t.isPrimitive()) return null; // left at 0
    if (t == String.class) return "";
    if (t == add.class) return null; // an empty slot: et.a(add) writes the short -1
    if (t == String[].class && signLines) return new String[] { "", "", "", "" };
    if (t.isArray()) return Array.newInstance(t.getComponentType(), 0);
    if (t == List.class || t == Collection.class || t == ArrayList.class) return new ArrayList<Object>();
    if (t == Map.class || t == HashMap.class) return new HashMap<Object, Object>();
    if (t == Set.class) return new HashSet<Object>();
    if (t == fj.class) return new fq("");
    if (t == UUID.class) return new UUID(0, 0);
    if (t == com.mojang.authlib.GameProfile.class) return new com.mojang.authlib.GameProfile(new UUID(0, 0), "");
    if (t.isEnum()) return t.getEnumConstants()[0];
    for (Field f : t.getDeclaredFields()) if (Modifier.isStatic(f.getModifiers()) && f.getType() == t) { f.setAccessible(true); Object v = f.get(null); if (v != null) return v; }
    if (depth > 2 || Modifier.isAbstract(t.getModifiers()) || t.isInterface()) return null;
    for (Constructor<?> c : t.getDeclaredConstructors()) {
      Class<?>[] ps = c.getParameterTypes(); Object[] args = new Object[ps.length]; boolean ok = true;
      for (int i = 0; i < ps.length; i++) {
        if (ps[i] == int.class) args[i] = 0; else if (ps[i] == long.class) args[i] = 0L; else if (ps[i] == boolean.class) args[i] = false; else if (ps[i] == float.class) args[i] = 0f;
        else if (ps[i] == double.class) args[i] = 0d; else if (ps[i] == byte.class) args[i] = (byte) 0; else if (ps[i] == short.class) args[i] = (short) 0; else if (ps[i] == char.class) args[i] = (char) 0;
        else args[i] = null;
      }
      try { c.setAccessible(true); return c.newInstance(args); } catch (Throwable e) { ok = false; }
    }
    return null;
  }

  static Object blank(Class<?> cls) throws Exception {
    Constructor<?> c = cls.getDeclaredConstructor(); c.setAccessible(true); Object p = c.newInstance();
    for (Class<?> k = cls; k != null && k != ft.class; k = k.getSuperclass())
      for (Field f : k.getDeclaredFields()) {
        if (Modifier.isStatic(f.getModifiers())) continue; f.setAccessible(true);
        if (!f.getType().isPrimitive() && f.get(p) == null) f.set(p, empty(f.getType(), 0));
      }
    return p;
  }

  static int size(int id, Object packet) throws Exception {
    et buf = new et(Unpooled.buffer());
    buf.b(id); // fa: the id VarInt first
    ((ft) packet).b(buf);
    return buf.readableBytes();
  }

  static void set(Object p, String name, Object v) throws Exception {
    for (Class<?> k = p.getClass(); k != null; k = k.getSuperclass()) { try { Field f = k.getDeclaredField(name); f.setAccessible(true); f.set(p, v); return; } catch (NoSuchFieldException e) { } }
    throw new NoSuchFieldException(name);
  }

  static StringBuilder samples = new StringBuilder();
  static void sample(String name, int id, Object packet, String note) throws Exception {
    samples.append(samples.length() > 0 ? "," : "").append("{\"name\":").append(q(name)).append(",\"id\":").append(id).append(",\"bytes\":").append(size(id, packet)).append(",\"note\":").append(q(note)).append("}");
  }

  public static void main(String[] args) throws Exception {
    StringBuilder b = new StringBuilder("{\"base\":[");
    boolean first = true;
    for (eo st : eo.values()) for (int dir = 0; dir < 2; dir++) {
      BiMap map = dir == 0 ? st.a() : st.b();
      TreeMap<Integer, Class<?>> sorted = new TreeMap<>();
      for (Object e : map.entrySet()) { Map.Entry en = (Map.Entry) e; sorted.put((Integer) en.getKey(), (Class<?>) en.getValue()); }
      for (Map.Entry<Integer, Class<?>> en : sorted.entrySet()) {
        String r;
        try { r = String.valueOf(size(en.getKey(), blank(en.getValue()))); } catch (ArrayIndexOutOfBoundsException e) { signLines = true; try { r = String.valueOf(size(en.getKey(), blank(en.getValue()))); } catch (Throwable e2) { r = q("error " + e2.getClass().getSimpleName()); } signLines = false; } catch (Throwable e) { r = q("error " + e.getClass().getSimpleName()); }
        b.append(first ? "" : ",").append("{\"state\":").append(q(st.name())).append(",\"dir\":").append(q(dir == 0 ? "serverbound" : "clientbound")).append(",\"id\":").append(en.getKey())
          .append(",\"class\":").append(q(en.getValue().getName())).append(",\"bytes\":").append(r).append("}");
        first = false;
      }
    }
    // Samples (all PLAY clientbound unless noted).
    aji.p(); adb.l(); // Block.registerBlocks, Item.registerItems (as DispenseProbe)
    Object p;
    fr chat = new fr("chat.type.text", new Object[] { new fq("Alex"), "hello" });
    p = blank(gj.class); set(p, "a", chat); sample("S02 chat.type.text Alex hello", 2, p, fk.a(chat));
    p = blank(gj.class); set(p, "a", new fq("hello")); sample("S02 text hello", 2, p, fk.a(new fq("hello")));
    p = blank(gs.class); set(p, "a", new fq("Server closed")); sample("S40 Server closed", 64, p, fk.a(new fq("Server closed")));
    p = blank(hc.class); set(p, "a", "random.click"); sample("S29 random.click", 41, p, "");
    p = blank(hb.class); set(p, "a", "flame"); sample("S2A flame", 42, p, "");
    p = blank(hq.class); set(p, "a", new int[] { 1, 2, 3 }); sample("S13 three ids", 19, p, "");
    p = blank(gi.class); set(p, "a", new String[] { "/help", "/home" }); sample("S3A /help /home", 58, p, "");
    p = blank(ho.class); set(p, "a", "Alex"); set(p, "b", true); sample("S38 Alex", 56, p, "");
    p = blank(go.class); set(p, "b", new add[3]); sample("S30 three empty slots", 48, p, "");
    p = blank(go.class); set(p, "b", new add[] { new add(ajn.b, 1, 0), null }); sample("S30 one stone, one empty", 48, p, "ItemStack(Blocks.stone, 1, 0)");
    p = blank(gq.class); set(p, "c", new add(ajn.b, 64, 0)); sample("S2F stone x64", 47, p, "");
    p = blank(gk.class); set(p, "c", new byte[12]); set(p, "d", 3); sample("S22 three records", 34, p, "");
    p = blank(gn.class); set(p, "c", "container.chest"); sample("S2D container.chest", 45, p, "");
    p = blank(fw.class); set(p, "k", 1); sample("S0E data 1", 14, p, "the three velocity shorts follow a non-zero data int");
    p = blank(fz.class); set(p, "l", new te(null)); sample("S0F empty watcher", 15, p, "DataWatcher with no entries: the 127 end byte");
    p = blank(gd.class); Map<Object, Object> stats = new HashMap<>(); ph stat = new ph("stat.leaveGame", new fq("")); stats.put(stat, 7); set(p, "a", stats); sample("S37 stat.leaveGame 7", 55, p, stat.e);
    p = blank(hd.class); set(p, "g", ahm.b); sample("S01 default", 1, p, ahm.b.a());
    p = blank(hs.class); set(p, "d", ahm.b); sample("S07 default", 7, p, "");
    // The unload: PlayerInstance.removePlayer sends S21(chunk, true, 0): no sections, the 256 biome bytes deflated (Deflater(-1)).
    Field uf = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe"); uf.setAccessible(true); Object unsafe = uf.get(null);
    java.lang.reflect.Method alloc = unsafe.getClass().getMethod("allocateInstance", Class.class);
    Object world = alloc.invoke(unsafe, mt.class); Field prov = ahb.class.getDeclaredField("t"); prov.setAccessible(true); prov.set(world, alloc.invoke(unsafe, aqq.class)); // a WorldServer double with a surface provider (sky light)
    apx chunk = new apx((ahb) world, 0, 0); byte[] biomes = chunk.m(); java.util.Arrays.fill(biomes, (byte) 1);
    try { sample("S21 unload, one biome", 33, new gx(chunk, true, 0), "mask 0, full chunk, 256 equal biome bytes"); } catch (Throwable e) { samples.append(",{\"name\":\"S21 unload\",\"error\":").append(q(String.valueOf(e))).append("}"); }
    System.out.println(b.append("],\"samples\":[").append(samples).append("]}"));
  }
}
