// b80 potspacks80. Loads zip resource packs through the unchanged 1.7.10 ResourcePackRepository.Entry (brf.a(): FileResourcePack bqr ->
// AbstractResourcePack.getPackMetadata bqn.a -> IMetadataSerializer brw.a("pack", json) -> PackMetadataSectionSerializer bsh -> IChatComponent.Serializer
// fk, JsonUtils pu.m) and then draws the row text (brf.e(): getFormattedText or the red "Invalid pack.mcmeta" line). ResourcePackRepository.a()
// (brc.a, bytecode-read) adds an entry only when brf.a() returns without an Exception, so `load` decides whether the pack is listed at all.
// Each argument is a pack.mcmeta text; "<missing>" makes a zip without one. Output: {"rows":[[mcmeta, loadError|null, packFormat|null, row|null, rowError|null]]}.
import java.io.*;
import java.lang.reflect.*;
import java.util.zip.*;

public class PackMetaProbe {
  static String js(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String err(Throwable t) {
    String m = t.getMessage();
    return t.getClass().getSimpleName() + (m == null ? "" : ": " + m);
  }
  public static void main(String[] args) throws Exception {
    // Minecraft.<init> registers PackMetadataSectionSerializer for PackMetadataSection on the metadata serializer.
    brw serializer = new brw();
    serializer.a(new bsh(), bsg.class);
    final java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(1, 1, java.awt.image.BufferedImage.TYPE_INT_ARGB);
    bra defaultPack = (bra) Proxy.newProxyInstance(bra.class.getClassLoader(), new Class[] { bra.class }, (p, m, a) -> m.getName().equals("a") && (a == null || a.length == 0) ? img : null);
    Field uf = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    Object unsafe = uf.get(null);
    brc repo = (brc) unsafe.getClass().getMethod("allocateInstance", Class.class).invoke(unsafe, brc.class);
    Field fc = brc.class.getDeclaredField("c"), fb = brc.class.getDeclaredField("b");
    for (Field f : new Field[] { fc, fb }) f.setAccessible(true);
    Method put = unsafe.getClass().getMethod("putObject", Object.class, long.class, Object.class), off = unsafe.getClass().getMethod("objectFieldOffset", Field.class);
    put.invoke(unsafe, repo, off.invoke(unsafe, fc), serializer);
    put.invoke(unsafe, repo, off.invoke(unsafe, fb), defaultPack);
    Constructor<brf> ctor = brf.class.getDeclaredConstructor(brc.class, File.class);
    ctor.setAccessible(true);
    Field fd = brf.class.getDeclaredField("d");
    fd.setAccessible(true);
    File dir = new File(System.getProperty("java.io.tmpdir"), "packmeta-probe");
    dir.mkdirs();
    StringBuilder out = new StringBuilder("{\"rows\":[");
    for (int i = 0; i < args.length; i++) {
      File zip = new File(dir, "p" + i + ".zip");
      try (ZipOutputStream z = new ZipOutputStream(new FileOutputStream(zip))) {
        z.putNextEntry(new ZipEntry("assets/minecraft/lang/x.txt"));
        z.write(new byte[] { 1 });
        z.closeEntry();
        if (!args[i].equals("<missing>")) {
          z.putNextEntry(new ZipEntry("pack.mcmeta"));
          z.write(args[i].getBytes("UTF-8"));
          z.closeEntry();
        }
      }
      brf entry = ctor.newInstance(repo, zip);
      String load = null, fmt = null, row = null, rowErr = null;
      try {
        entry.a();
        Object meta = fd.get(entry);
        fmt = meta == null ? null : String.valueOf(((bsg) meta).b());
        try { row = entry.e(); } catch (Throwable t) { rowErr = err(t); }
        entry.b();
      } catch (Throwable t) { load = err(t); }
      out.append(i > 0 ? "," : "").append("[").append(js(args[i])).append(",").append(js(load)).append(",").append(fmt == null ? "null" : fmt)
        .append(",").append(js(row)).append(",").append(js(rowErr)).append("]");
      zip.delete();
    }
    System.out.println(out.append("]}"));
  }
}
