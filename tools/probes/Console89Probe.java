// Batch 89 console89: executes, on the unchanged 1.7.10 classes, the chunk packets S21PacketChunkData (gx) and S26PacketMapChunkBulk (gz) on chunks built from a
// formula (blocks, metadata, sky and block light, biomes, all reproducible in JavaScript), an ItemStack with an NBT tag in S2FPacketSetSlot (gq), and S40 kick texts.
//  * "chunks": the record size (id VarInt + payload, as the encoder fa counts it), the extracted (undeflated) data length and its SHA-256 (gy.a from gx.a(apx, full, mask)),
//    for a full S21 (mask 65535), a partial S21 (mask 0b10010: section 1 and the empty but present section 4), the same full S21 in a world with no sky, and an S26 of two
//    chunks. The deflate is the packets' own (Deflater(-1)).
//  * "items": S2F with a diamond sword tagged {ench:[{id:16s,lvl:5s}],display:{Name:"Hi"}}, and the gzip length of that tag (du.a, CompressedStreamTools.compress).
//  * "kicks": S40 with each kick text (nh.c(String) sends new gs(new fq(reason))).
// Prints one JSON line {"chunks":[...],"items":[...],"kicks":[...]}. Run through tools/verify-console89.mjs.
import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.security.MessageDigest;
import java.util.*;

public class Console89Probe {
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static int size(int id, ft packet) throws Exception { et buf = new et(Unpooled.buffer()); buf.b(id); packet.b(buf); return buf.readableBytes(); }
  static String sha(byte[] b) throws Exception { StringBuilder s = new StringBuilder(); for (byte x : MessageDigest.getInstance("SHA-256").digest(b)) s.append(String.format("%02x", x)); return s.toString(); }

  // The formula (src/console89-b89.test.js repeats it): native block ids and metadata, sky and block light, biomes. cx shifts the ore pattern.
  static int id(int x, int y, int z, int cx) {
    if (y == 0) return 7;
    if (y < 40) return ((x * 7 + y * 13 + z * 3 + cx) % 17 == 0) ? 16 : 1;
    if (y < 44) return 3;
    if (y == 44) return 2;
    if (x == 8 && z == 8 && y < 50) return 17;
    if (y == 45 && x == 0) return 35;
    return 0;
  }
  static int meta(int x, int y, int z, int cx) { int b = id(x, y, z, cx); return b == 35 ? (z & 15) : b == 17 ? 1 : 0; }
  static int sky(int x, int y, int z) { return y >= 45 ? 15 : y > 40 ? 15 - (45 - y) * 3 : 0; }
  static int block(int x, int y, int z) { return Math.max(0, 14 - Math.abs(x - 4) - Math.abs(y - 20) - Math.abs(z - 11)); }
  static int biome(int x, int z) { return (x + z) % 3 == 0 ? 4 : 1; }

  static Object unsafe; static Method alloc;
  static Object world(boolean noSky) throws Exception {
    Object w = alloc.invoke(unsafe, mt.class); Object prov = alloc.invoke(unsafe, aqq.class);
    Field g = aqo.class.getDeclaredField("g"); g.setAccessible(true); g.setBoolean(prov, noSky); // WorldProvider.hasNoSky
    Field t = ahb.class.getDeclaredField("t"); t.setAccessible(true); t.set(w, prov);
    return w;
  }
  static apx chunk(Object world, int cx, int cz) throws Exception {
    apx c = new apx((ahb) world, cx, cz);
    apz[] sections = c.i();
    for (int s = 0; s < 5; s++) { // sections 0-3 hold the formula (y < 64); section 4 exists with no blocks (only light)
      apz sec = new apz(s << 4, true); sections[s] = sec;
      for (int y = 0; y < 16; y++) for (int z = 0; z < 16; z++) for (int x = 0; x < 16; x++) {
        int wy = (s << 4) + y, b = wy < 64 ? id(x, wy, z, cx) : 0;
        if (b != 0) { sec.a(x, y, z, aji.e(b)); sec.a(x, y, z, meta(x, wy, z, cx)); }
        sec.b(x, y, z, sky(x, wy, z)); sec.c(x, y, z, block(x, wy, z)); // setExtSkylightValue, setExtBlocklightValue
      }
    }
    byte[] biomes = c.m(); for (int z = 0; z < 16; z++) for (int x = 0; x < 16; x++) biomes[z << 4 | x] = (byte) biome(x, z);
    return c;
  }

  static StringBuilder chunks = new StringBuilder();
  static void chunkRow(String name, int id, ft packet, byte[] data) throws Exception {
    chunks.append(chunks.length() > 0 ? "," : "").append("{\"name\":").append(q(name)).append(",\"id\":").append(id).append(",\"bytes\":").append(size(id, packet))
      .append(",\"dataLength\":").append(data.length).append(",\"dataSha256\":").append(q(sha(data))).append("}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); // Block.registerBlocks, Item.registerItems
    Field uf = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = uf.get(null);
    alloc = unsafe.getClass().getMethod("allocateInstance", Class.class);
    Object sky = world(false), dark = world(true);
    apx a = chunk(sky, 2, 3), b = chunk(sky, 3, 3), an = chunk(dark, 2, 3);
    chunkRow("S21 full", 33, new gx(a, true, 65535), gx.a(a, true, 65535).a);
    chunkRow("S21 partial 0b10010", 33, new gx(a, false, 0x12), gx.a(a, false, 0x12).a);
    chunkRow("S21 full, no sky", 33, new gx(an, true, 65535), gx.a(an, true, 65535).a);
    byte[] da = gx.a(a, true, 65535).a, db = gx.a(b, true, 65535).a, both = new byte[da.length + db.length];
    System.arraycopy(da, 0, both, 0, da.length); System.arraycopy(db, 0, both, da.length, db.length);
    chunkRow("S26 two chunks", 38, new gz(Arrays.asList(a, b)), both);
    chunkRow("S21 unload", 33, new gx(a, true, 0), gx.a(a, true, 0).a);

    // An ItemStack with a tag in S2F (et.a(add): short id, byte count, short damage, then the tag: short length and the gzip bytes, or short -1).
    dh tag = new dh(); dq ench = new dq(); dh e = new dh(); e.a("id", (short) 16); e.a("lvl", (short) 5); ench.a(e); tag.a("ench", ench);
    dh display = new dh(); display.a("Name", "Hi"); tag.a("display", display);
    add sword = new add(adb.d(276), 1, 0); sword.d(tag);
    gq slot = new gq(0, 36, sword);
    StringBuilder items = new StringBuilder();
    items.append("{\"name\":\"S2F diamond sword, ench sharpness 5, Name Hi\",\"id\":47,\"bytes\":").append(size(47, slot)).append(",\"gzip\":").append(du.a(tag).length).append("}");
    add plain = new add(adb.d(276), 1, 0);
    items.append(",{\"name\":\"S2F diamond sword, no tag\",\"id\":47,\"bytes\":").append(size(47, new gq(0, 36, plain))).append("}");

    StringBuilder kicks = new StringBuilder();
    for (String r : new String[] { "Kicked by an operator.", "You are banned from this server.", "You have been IP banned.", "You have been idle for too long!", "Server closed", "go <away> & don't" }) {
      kicks.append(kicks.length() > 0 ? "," : "").append("{\"text\":").append(q(r)).append(",\"id\":64,\"bytes\":").append(size(64, new gs(new fq(r)))).append(",\"json\":").append(q(fk.a(new fq(r)))).append("}");
    }
    System.out.println("{\"chunks\":[" + chunks + "],\"items\":[" + items + "],\"kicks\":[" + kicks + "]}");
  }
}
