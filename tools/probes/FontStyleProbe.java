// FontStyleProbe: runs the unchanged FontRenderer (bbu) with recording stand-ins for GL11 and the Tessellator (bmh) and reports
//   draw    - every primitive drawString/drawStringWithShadow issues (glyph quads and the underline/strikethrough bars), for both
//             unicode flags: the replay input for src/font-quads.js (src/font-style.test.js)
//   bidi    - bidiReorder (private bbu.b(String): ArabicShaping(LETTERS_SHAPE) then Bidi(DEFAULT_RTL), DO_MIRRORING) of probe strings
//   data    - ICU4J 51.2 character data for the BMP that src/bidi-data.js is generated from: bidi class, mirror, joining type/group
// Usage: java FontStyleProbe <mode> <extracted-jar-dir>
import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import org.lwjgl.opengl.GL11;

class bao {
  static final bao I = new bao();
  static bqy rm;
  public static bao B() { return I; }
  public bqy Q() { return rm; }
}
class bbj { public boolean e = false; }
class bqf { public bqf(bqy m) {} public void a(bqx l) { org.lwjgl.opengl.GL11.tex = l.a().equals("minecraft") ? l.b() : l.a(); } }
class Res implements bqy {
  final Path root;
  Res(Path root) { this.root = root; }
  static String path(bqx l) { return l.a().equals("minecraft") ? l.b() : l.a(); }
  public Set a() { return new HashSet<>(Arrays.asList("minecraft")); }
  public bqw a(bqx l) { try { return res(path(l)); } catch (IOException e) { throw new RuntimeException(e); } }
  bqw res(String path) throws IOException {
    final InputStream in = Files.newInputStream(root.resolve("assets/minecraft/" + path));
    return new bqw() { public InputStream b() { return in; } public boolean c() { return false; } public bru a(String s) { return null; } };
  }
  public List b(bqx l) { try { return new ArrayList<>(Arrays.asList(res(path(l)))); } catch (IOException e) { return new ArrayList<>(); } }
}
public class FontStyleProbe {
  static String q(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  public static void main(String[] args) throws Exception {
    Res res = new Res(Paths.get(args[1]));
    bao.rm = res;
    if (args[0].equals("data")) { data(); return; }
    if (args[0].equals("shape")) { shapeData(); return; }
    Method reorder = bbu.class.getDeclaredMethod("b", String.class);
    reorder.setAccessible(true);
    if (args[0].equals("bidi")) {
      BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
      bbu fr = new bbu(new bbj(), new bqx("textures/font/ascii.png"), new bqf(null), false);
      fr.a((bqy) res);
      String line;
      while ((line = in.readLine()) != null) {
        // input lines are hex code units separated by spaces (empty line = empty string)
        StringBuilder s = new StringBuilder();
        for (String h : line.trim().split(" ")) if (!h.isEmpty()) s.append((char) Integer.parseInt(h, 16));
        String out = (String) reorder.invoke(fr, s.toString());
        StringBuilder o = new StringBuilder();
        for (char c : out.toCharArray()) o.append(String.format("%04x ", (int) c));
        System.out.println(o.toString().trim());
      }
      return;
    }
    String[] strings = {"Hello", "A B", "iii WWW", "§nUnder", "§mStrike", "§oItalic", "§n§m§oAll", "§lBold§nUL", "§c§nRed under§r plain", "§lB§oI§nU§mS", "§4§mX§rY§nZ", "a§", "§x§nq", "§k§nxx", "§n  §m  ", "ÀÁ§nÂ", "Mixed Ångström §nunder", "あいうえお", "§nあいうえお", "§mあいうえお", "§oあいうえお", "§lあいうえお", "§n§lあい", "Абвгд", "§nАбвгд", "§m§oАбвгд §lЖ", "中文 §n中文", "ﻻ§nﺑ", "§n\u0000x", "a§nb§rc§md", "fi§nfi", "ǅ§nǆ", "ilfjt§nilfjt", "§lilfjt§m!", "§oﺑﺒ"};
    for (boolean unicode : new boolean[] {false, true}) {
      bbu fr = new bbu(new bbj(), new bqx("textures/font/ascii.png"), new bqf(null), unicode);
      fr.a((bqy) res);
      StringBuilder rows = new StringBuilder();
      for (String s : strings) {
        for (int shadow = 0; shadow < 2; shadow++) {
          GL11.prims.clear(); GL11.verts.clear();
          int x = 7, y = 11, col = shadow == 1 ? 0xffffff : 0xff8040;
          int ret = shadow == 1 ? fr.a(s, x, y, col) : fr.b(s, x, y, col);
          if (rows.length() > 0) rows.append(',');
          rows.append("{\"s\":").append(q(s)).append(",\"shadow\":").append(shadow == 1).append(",\"x\":").append(x).append(",\"y\":").append(y).append(",\"color\":").append(col).append(",\"ret\":").append(ret).append(",\"w\":").append(fr.a(s)).append(",\"prims\":[").append(String.join(",", GL11.prims)).append("]}");
        }
      }
      System.out.println("{\"unicode\":" + unicode + ",\"rows\":[" + rows + "]}");
    }
  }
  // ---- shape mode: ArabicShaping(LETTERS_SHAPE) of each candidate character alone and between dual-joining BEH (U+0628) ----
  static String hex(String t) { StringBuilder b = new StringBuilder(); for (char c : t.toCharArray()) b.append(String.format("%04x", (int) c)); return b.toString(); }
  static void shapeData() throws Exception {
    com.ibm.icu.text.ArabicShaping sh = new com.ibm.icu.text.ArabicShaping(8);
    String B = "\u0628";
    int[][] ranges = {{0x0600, 0x08ff}, {0x2000, 0x206f}, {0xfb50, 0xfeff}};
    StringBuilder out = new StringBuilder();
    for (int[] r : ranges) for (int c = r[0]; c <= r[1]; c++) {
      String s = String.valueOf((char) c);
      String[] f = {sh.shape(s), sh.shape(B + s), sh.shape(s + B), sh.shape(B + s + B), sh.shape(B + s + "\u064e" + B)};
      boolean plain = f[0].equals(s) && f[1].equals(B + s) && f[2].equals(s + B) && f[3].equals(B + s + B) && f[4].equals(B + s + "\u064e" + B);
      if (plain) continue;
      out.append(String.format("%04x", c));
      for (String x : f) out.append(' ').append(hex(x));
      out.append('\n');
    }
    // lam + alef family, alone and after BEH, and with a tashkeel between
    for (char a : new char[] {0x622, 0x623, 0x625, 0x627, 0x671, 0x672, 0x673, 0x675}) {
      String l = "\u0644" + a;
      out.append("L" + String.format("%04x", (int) a));
      for (String x : new String[] {l, B + l, l + B, B + l + B, "\u0644\u064e" + a, B + "\u0644\u064e" + a}) out.append(' ').append(hex(sh.shape(x)));
      out.append('\n');
    }
    System.out.print(out);
  }
  // ---- data mode ----
  static void data() {
    com.ibm.icu.impl.UBiDiProps p = com.ibm.icu.impl.UBiDiProps.INSTANCE;
    StringBuilder cls = new StringBuilder(), mir = new StringBuilder(), jt = new StringBuilder(), jg = new StringBuilder();
    for (int c = 0; c < 0x10000; c++) {
      cls.append(p.getClass(c)).append(',');
      int m = p.getMirror(c);
      if (m != c) mir.append(c).append(':').append(m).append(',');
      int t = p.getJoiningType(c);
      if (t != 0) jt.append(c).append(':').append(t).append(',');
      int g = p.getJoiningGroup(c);
      if (g != 0) jg.append(c).append(':').append(g).append(',');
    }
    System.out.println("{\"classes\":\"" + cls + "\",\"mirror\":\"" + mir + "\",\"joiningType\":\"" + jt + "\",\"joiningGroup\":\"" + jg + "\"}");
  }
}
