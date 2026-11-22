import java.lang.reflect.*;
import java.util.*;
// b95 tiles95: unchanged 1.7.10 tile entities, TileEntity.createAndLoadEntity (aor.c) then writeToNBT (aor.b) with NBT of every shape the
// audit cares about. One JSON line per case: label, the tile id, "loaded" (false when createAndLoadEntity returned null or threw), the
// error, and the written compound as {key:{t:type,v:value}}.
public class Tiles95Probe {
  static Class<?> DH, DQ, DY, TE;
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""; }
  static Object nbt() throws Exception { return DH.getConstructor().newInstance(); }
  static Object put(Object c, String k, Object v) throws Exception {
    Class<?> t = v instanceof Byte ? byte.class : v instanceof Short ? short.class : v instanceof Integer ? int.class : v instanceof Long ? long.class : v instanceof Float ? float.class : v instanceof Double ? double.class : v instanceof String ? String.class : v instanceof Boolean ? boolean.class : null;
    if (t != null) DH.getMethod("a", String.class, t).invoke(c, k, v); else DH.getMethod("a", String.class, DY).invoke(c, k, v);
    return c;
  }
  static Object tag(Object... kv) throws Exception { Object c = nbt(); for (int i = 0; i < kv.length; i += 2) put(c, (String) kv[i], kv[i + 1]); return c; }
  static Object list(Object... items) throws Exception { Object l = DQ.getConstructor().newInstance(); for (Object o : items) DQ.getMethod("a", DY).invoke(l, o); return l; }
  static Object item(int slot, int id, int count, int damage) throws Exception { return tag("Slot", (byte) slot, "id", (short) id, "Count", (byte) count, "Damage", (short) damage); }
  static String ser(Object t) throws Exception {
    int ty = (Byte) DY.getMethod("a").invoke(t);
    if (ty == 10) { StringBuilder b = new StringBuilder("{\"t\":10,\"v\":{"); List<String> ks = new ArrayList<>(); for (Object k : (Set<?>) DH.getMethod("c").invoke(t)) ks.add((String) k); Collections.sort(ks); boolean f = true; for (String k : ks) { b.append(f ? "" : ",").append(q(k)).append(":").append(ser(DH.getMethod("a", String.class).invoke(t, k))); f = false; } return b.append("}}").toString(); }
    if (ty == 9) { StringBuilder b = new StringBuilder("{\"t\":9,\"v\":["); Field lf = DQ.getDeclaredField("b"); lf.setAccessible(true); List<?> ll = (List<?>) lf.get(t); for (int i = 0; i < ll.size(); i++) b.append(i > 0 ? "," : "").append(ser(ll.get(i))); return b.append("]}").toString(); }
    return "{\"t\":" + ty + ",\"v\":" + q(String.valueOf(t)) + "}";
  }
  static void run(String label, String id, Object tag) throws Exception {
    Object in = tag;
    DH.getMethod("a", String.class, String.class).invoke(in, "id", id);
    StringBuilder b = new StringBuilder("{\"label\":" + q(label) + ",\"id\":" + q(id) + ",\"in\":" + ser(in));
    Object tile = null; String err = null;
    try { tile = TE.getMethod("c", DH).invoke(null, in); } catch (InvocationTargetException e) { err = String.valueOf(e.getCause()); }
    b.append(",\"loaded\":" + (tile != null));
    if (err != null) b.append(",\"error\":" + q(err));
    if (tile != null) {
      Object out = nbt();
      try { TE.getMethod("b", DH).invoke(tile, out); b.append(",\"nbt\":" + ser(out)); }
      catch (InvocationTargetException e) { b.append(",\"writeError\":" + q(String.valueOf(e.getCause()))); }
    }
    System.out.println(b.append("}"));
  }
  public static void main(String[] x) throws Exception {
    Class.forName("aji").getMethod("p").invoke(null); Class.forName("adb").getMethod("l").invoke(null); DH = Class.forName("dh"); DQ = Class.forName("dq"); DY = Class.forName("dy"); TE = Class.forName("aor");
    String p = "x"; // position keys
    // furnace
    run("furnace full", "Furnace", tag("x", 1, "y", 2, "z", 3, "BurnTime", (short) 100, "CookTime", (short) 50, "CustomName", "Hot", "Items", list(item(0, 4, 3, 0), item(1, 263, 1, 0), item(2, 265, 5, 0), item(3, 4, 1, 0), item(-1, 4, 1, 0))));
    run("furnace int times", "Furnace", tag("x", 1, "y", 2, "z", 3, "BurnTime", 70000, "CookTime", 40000));
    run("furnace string times", "Furnace", tag("x", 1, "y", 2, "z", 3, "BurnTime", "9", "CookTime", (byte) 7));
    run("furnace negative", "Furnace", tag("x", 1, "y", 2, "z", 3, "BurnTime", (short) -5, "CookTime", (short) -9));
    run("furnace empty name", "Furnace", tag("x", 1, "y", 2, "z", 3, "CustomName", ""));
    run("furnace counts", "Furnace", tag("x", 1, "y", 2, "z", 3, "Items", list(item(0, 4, 0, 0), item(1, 263, -3, 0), item(2, 0, 1, 0), item(0, 5, 9, -4))));
    // note
    for (int n : new int[]{0, 5, 24, 25, 30, 127, -3}) run("note byte " + n, "Music", tag("x", 1, "y", 2, "z", 3, "note", (byte) n));
    run("note int 7", "Music", tag("x", 1, "y", 2, "z", 3, "note", 7));
    run("note string", "Music", tag("x", 1, "y", 2, "z", 3, "note", "9"));
    run("note empty", "Music", tag("x", 1, "y", 2, "z", 3));
    // jukebox
    run("jukebox RecordItem", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", item(0, 2257, 1, 0)));
    run("jukebox Record only", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "Record", 2258));
    run("jukebox both", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "Record", 2258, "RecordItem", item(0, 2260, 1, 0)));
    run("jukebox Record 1", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "Record", 1));
    run("jukebox Record 4", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "Record", 4));
    run("jukebox Record 0", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "Record", 0));
    run("jukebox Record -2", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "Record", -2));
    run("jukebox Record bad id", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "Record", 9999));
    run("jukebox RecordItem count 0", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", item(0, 2257, 0, 0)));
    run("jukebox RecordItem non-record", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", item(0, 4, 3, 0)));
    run("jukebox RecordItem bad id", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", item(0, 9999, 1, 0), "Record", 2258));
    run("jukebox RecordItem wrong type", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", "x", "Record", 2258));
    // sign
    run("sign full", "Sign", tag("x", 1, "y", 2, "z", 3, "Text1", "abcdefghijklmnopqrstuvwxyz", "Text2", "", "Text4", "§ahi§r"));
    run("sign wrong types", "Sign", tag("x", 1, "y", 2, "z", 3, "Text1", 5, "Text2", (byte) 1, "Text3", "ok"));
    run("sign 15", "Sign", tag("x", 1, "y", 2, "z", 3, "Text1", "123456789012345", "Text2", "1234567890123456", "Text3", "😀😀😀😀😀😀😀😀"));
    run("sign empty", "Sign", tag("x", 1, "y", 2, "z", 3));
    // skull
    run("skull plain", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 1, "Rot", (byte) 5));
    run("skull type 7", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 7, "Rot", (byte) 20));
    run("skull negative", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) -1, "Rot", (byte) -1));
    run("skull int", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", 4, "Rot", 300));
    run("skull ExtraType type 1", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 1, "ExtraType", "Notch"));
    run("skull ExtraType type 3", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "ExtraType", "Notch"));
    run("skull ExtraType empty", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "ExtraType", ""));
    // comparator
    for (int v : new int[]{0, 7, 15, 99, -5, Integer.MAX_VALUE}) run("comparator " + v, "Comparator", tag("x", 1, "y", 2, "z", 3, "OutputSignal", v));
    run("comparator byte", "Comparator", tag("x", 1, "y", 2, "z", 3, "OutputSignal", (byte) 3));
    run("comparator long", "Comparator", tag("x", 1, "y", 2, "z", 3, "OutputSignal", 5L));
    run("comparator string", "Comparator", tag("x", 1, "y", 2, "z", 3, "OutputSignal", "4"));
    run("comparator empty", "Comparator", tag("x", 1, "y", 2, "z", 3));
    // command block
    run("control full", "Control", tag("x", 1, "y", 2, "z", 3, "Command", "say hi", "SuccessCount", 3, "CustomName", "Bob", "TrackOutput", (byte) 0, "LastOutput", "{\"text\":\"hi\"}"));
    run("control empty", "Control", tag("x", 1, "y", 2, "z", 3));
    run("control name empty", "Control", tag("x", 1, "y", 2, "z", 3, "CustomName", ""));
    run("control track int", "Control", tag("x", 1, "y", 2, "z", 3, "TrackOutput", 0));
    run("control track 5", "Control", tag("x", 1, "y", 2, "z", 3, "TrackOutput", (byte) 5));
    run("control track string", "Control", tag("x", 1, "y", 2, "z", 3, "TrackOutput", "0"));
    run("control success short", "Control", tag("x", 1, "y", 2, "z", 3, "SuccessCount", (short) 9));
    run("control success negative", "Control", tag("x", 1, "y", 2, "z", 3, "SuccessCount", -4));
    run("control command wrong", "Control", tag("x", 1, "y", 2, "z", 3, "Command", 7));
    run("control LastOutput string", "Control", tag("x", 1, "y", 2, "z", 3, "LastOutput", "\"plain\""));
    run("control LastOutput empty", "Control", tag("x", 1, "y", 2, "z", 3, "LastOutput", ""));
    run("control LastOutput translate", "Control", tag("x", 1, "y", 2, "z", 3, "LastOutput", "{\"translate\":\"commands.say.usage\",\"with\":[\"a\",1]}"));
    run("control LastOutput wrong type", "Control", tag("x", 1, "y", 2, "z", 3, "LastOutput", 4));
    // spawner
    run("spawner full", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Zombie", "Delay", (short) 7, "MinSpawnDelay", (short) 10, "MaxSpawnDelay", (short) 20, "SpawnCount", (short) 2, "MaxNearbyEntities", (short) 9, "RequiredPlayerRange", (short) 30, "SpawnRange", (short) 6));
    run("spawner empty", "MobSpawner", tag("x", 1, "y", 2, "z", 3));
    run("spawner no min", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "Delay", (short) 3, "MaxSpawnDelay", (short) 50, "SpawnCount", (short) 8));
    run("spawner min only", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "MinSpawnDelay", (short) 15));
    run("spawner int fields", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "Delay", 70000, "MinSpawnDelay", 66000, "MaxSpawnDelay", 4, "SpawnCount", 5, "MaxNearbyEntities", 6, "RequiredPlayerRange", 7, "SpawnRange", 8));
    run("spawner max<min", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "MinSpawnDelay", (short) 90, "MaxSpawnDelay", (short) 10));
    run("spawner negative", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "Delay", (short) -9, "MinSpawnDelay", (short) -1, "MaxSpawnDelay", (short) 0, "SpawnCount", (short) 0, "MaxNearbyEntities", (short) -2, "RequiredPlayerRange", (short) -3, "SpawnRange", (short) -4));
    run("spawner SpawnData", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "SpawnData", tag("id", "Creeper", "powered", (byte) 1)));
    run("spawner SpawnData no id", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "SpawnData", tag("Health", (short) 3)));
    run("spawner SpawnData wrong", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "SpawnData", "Creeper"));
    run("spawner potentials", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "SpawnPotentials", list(tag("Type", "Skeleton", "Weight", 3, "Properties", tag("Health", (short) 5)), tag("Type", "Spider", "Weight", 1), tag("Weight", 2))));
    run("spawner potentials empty", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "SpawnPotentials", list()));
    run("spawner potentials no mobid", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "SpawnPotentials", list(tag("Type", "Skeleton", "Weight", 3, "Properties", tag("Health", (short) 5)))));
    run("spawner potentials and data", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Pig", "SpawnData", tag("id", "Creeper"), "SpawnPotentials", list(tag("Type", "Spider", "Weight", 4))));
    run("spawner unknown id", "MobSpawner", tag("x", 1, "y", 2, "z", 3, "EntityId", "Bogus"));
    // enchanting table, ender chest
    run("enchant name", "EnchantTable", tag("x", 1, "y", 2, "z", 3, "CustomName", "Tbl"));
    run("enchant empty", "EnchantTable", tag("x", 1, "y", 2, "z", 3));
    run("enderchest", "EnderChest", tag("x", 1, "y", 2, "z", 3, "Items", list(item(0, 4, 3, 0))));
    // beacon
    run("beacon", "Beacon", tag("x", 1, "y", 2, "z", 3, "Primary", 1, "Secondary", 5, "Levels", 4));
    run("beacon odd", "Beacon", tag("x", 1, "y", 2, "z", 3, "Primary", (short) 99, "Secondary", -1, "Levels", 700));
  }
}
