import java.io.*;
import java.util.*;

// The NBT classes and stream tools are unchanged classes from the pinned JAR.
public class NbtProbe {
  static final java.lang.reflect.Field listValues;
  static {
    try { listValues = dq.class.getDeclaredField("b"); listValues.setAccessible(true); }
    catch (Exception e) { throw new ExceptionInInitializerError(e); }
  }
  static String quote(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c == '\"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int)c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String hex(byte[] bytes) {
    StringBuilder b = new StringBuilder();
    for (byte v : bytes) b.append(String.format("%02x", v & 255));
    return b.toString();
  }
  static String number(double v) {
    if (Double.isNaN(v)) return quote("NaN");
    if (v == Double.POSITIVE_INFINITY) return quote("Infinity");
    if (v == Double.NEGATIVE_INFINITY) return quote("-Infinity");
    if (Double.doubleToRawLongBits(v) == Long.MIN_VALUE) return quote("-0");
    return Double.toString(v);
  }
  static String tag(dy t) { return "{\"type\":" + t.a() + ",\"value\":" + payload(t) + "}"; }
  static String payload(dy t) {
    switch (t.a()) {
      case 1: case 2: case 3: return Integer.toString(((dz)t).d());
      case 4: return quote(Long.toString(((dr)t).c()));
      case 5: return number(((dm)t).h());
      case 6: return number(((dk)t).g());
      case 7: return Arrays.toString(((df)t).c());
      case 8: return quote(((dx)t).a_());
      case 9: {
        dq list = (dq)t;
        StringJoiner items = new StringJoiner(",", "[", "]");
        // dq.a(int) removes an entry; inspect the private list without mutation.
        try { for (Object item : (List)listValues.get(list)) items.add(payload((dy)item)); }
        catch (IllegalAccessException e) { throw new RuntimeException(e); }
        return "{\"elementType\":" + list.d() + ",\"items\":" + items + "}";
      }
      case 10: {
        dh compound = (dh)t;
        StringJoiner entries = new StringJoiner(",", "[", "]");
        for (Object key : compound.c()) entries.add("[" + quote((String)key) + "," + tag(compound.a((String)key)) + "]");
        return entries.toString();
      }
      case 11: return Arrays.toString(((dn)t).c());
      default: throw new IllegalArgumentException();
    }
  }
  static int count = 0;
  static void emit(String id, String name, dh root) throws Exception {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    DataOutputStream out = new DataOutputStream(buffer);
    out.writeByte(10); out.writeUTF(name); root.a(out);
    byte[] bytes = buffer.toByteArray();
    dh loaded = du.a((DataInput)new DataInputStream(new ByteArrayInputStream(bytes)), new ds(16 * 1024 * 1024));
    // Native float/double equals uses ==, so NaN does not equal itself.
    if (!tag(root).equals(tag(loaded))) throw new AssertionError(id);
    System.out.println("{\"id\":" + quote(id) + ",\"name\":" + quote(name) + ",\"hex\":" + quote(hex(bytes)) + ",\"tag\":" + tag(loaded) + "}");
    count++;
  }
  static void single(String id, dy tag) throws Exception {
    dh root = new dh(); root.a("value", tag); emit(id, "", root);
  }
  public static void main(String[] args) throws Exception {
    emit("empty", "", new dh());
    for (int v : new int[]{-128, -1, 0, 1, 127}) single("byte/" + v, new dg((byte)v));
    for (int v : new int[]{-32768, -1, 0, 1, 32767}) single("short/" + v, new dw((short)v));
    for (int v : new int[]{Integer.MIN_VALUE, -1, 0, 1, Integer.MAX_VALUE}) single("int/" + v, new dp(v));
    for (long v : new long[]{Long.MIN_VALUE, -9007199254740993L, -1, 0, 1, 9007199254740993L, Long.MAX_VALUE}) single("long/" + v, new dr(v));
    int i = 0;
    for (float v : new float[]{0, -0.0f, 0.1f, Float.MIN_VALUE, Float.MIN_NORMAL, Float.MAX_VALUE, Float.NaN, Float.POSITIVE_INFINITY, Float.NEGATIVE_INFINITY}) single("float/" + i++, new dm(v));
    i = 0;
    for (double v : new double[]{0, -0.0, 0.1, Double.MIN_VALUE, Double.MIN_NORMAL, Double.MAX_VALUE, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY}) single("double/" + i++, new dk(v));
    i = 0;
    for (String v : new String[]{"", "ASCII", "\0", "\u007f\u0080\u07ff\u0800\uffff", "\ud83d\ude00", "\ud800", "\udc00", "a\0z\u4e16\u754c"}) {
      dh root = new dh(); root.a(v, new dx(v)); emit("string/" + i++, v, root);
    }
    single("string/max-ascii", new dx(String.join("", Collections.nCopies(65535, "a"))));
    single("string/max-three-byte", new dx(String.join("", Collections.nCopies(21845, "\u0800"))));
    single("bytes/empty", new df(new byte[0]));
    single("bytes/signed", new df(new byte[]{-128,-1,0,1,127}));
    single("ints/empty", new dn(new int[0]));
    single("ints/signed", new dn(new int[]{Integer.MIN_VALUE,-1,0,1,Integer.MAX_VALUE}));
    single("list/empty", new dq());
    dy[] samples = {new dg((byte)-1),new dw((short)2),new dp(3),new dr(Long.MAX_VALUE),new dm(0.1f),new dk(-0.0),new df(new byte[]{1,2}),new dx("\0"),new dq(),new dh(),new dn(new int[]{-1})};
    for (dy sample : samples) {
      dq list = new dq(); list.a(sample); list.a(sample.b()); single("list/type-" + sample.a(), list);
    }
    dh chunk = new dh(), level = new dh(), section = new dh();
    byte[] blocks = new byte[4096], nibble = new byte[2048];
    for (i = 0; i < blocks.length; i++) blocks[i] = (byte)(i * 31);
    section.a("Y", (byte)15); section.a("Blocks", blocks); section.a("Data", nibble);
    section.a("SkyLight", nibble); section.a("BlockLight", nibble);
    dq sections = new dq(); sections.a(section); level.a("Sections", sections);
    level.a("xPos", -7); level.a("zPos", 13); level.a("LastUpdate", Long.MAX_VALUE);
    level.a("TerrainPopulated", true); level.a("HeightMap", new int[256]);
    chunk.a("Level", level); emit("chunk-shaped", "", chunk);
    dh names = new dh();
    for (String key : new String[]{"__proto__", "constructor", "prototype", "Aa", "BB", "", "name\0"}) names.a(key, key);
    emit("compound/names", "root\0\ud83d\ude00", names);
    for (int depth : new int[]{1,16,128,512}) {
      dh root = new dh(), cursor = root;
      for (i = 0; i < depth; i++) { dh next = new dh(); cursor.a("n",next); cursor = next; }
      emit("depth/" + depth, "", root);
    }
  }
}
