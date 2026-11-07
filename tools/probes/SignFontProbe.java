// Copy of the LanguageProbe test doubles; SignFontProbe runs the original FontRenderer (bbu) over sign lines.
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

// Original-bytecode harness for FontRenderer (bbu) widths and the Locale (brs) lang parser. The unchanged client classes run
// against minimal test doubles: bao (Minecraft: only getMinecraft/getResourceManager), bbj (GameSettings: the anaglyph flag the
// constructor reads), bqf (TextureManager: bindTexture) and a bqy resource manager that serves files from the extracted
// JAR (and, for Locale, fixtures or installed lang files). No original code or text is shipped.
// Usage: java LanguageProbe <extracted-jar-dir> [<lang-dir-with-xx_YY.lang>]
class bao {
  static final bao I = new bao();
  static bqy rm;
  public static bao B() { return I; }
  public bqy Q() { return rm; }
}
class bbj { public boolean e = false; }
class bqf { public bqf(bqy m) {} public void a(bqx l) {} }
class Res implements bqy {
  final Path root; final Map<String, String> fixtures = new HashMap<>(); Path langDir;
  Res(Path root) { this.root = root; }
  static String path(bqx l) { return l.a().equals("minecraft") ? l.b() : l.a(); }
  public Set a() { return new HashSet<>(Arrays.asList("minecraft")); }
  InputStream open(String path) throws IOException {
    if (path.startsWith("lang/")) {
      String code = path.substring(5, path.length() - 5);
      if (fixtures.containsKey(code)) return new ByteArrayInputStream(fixtures.get(code).getBytes("UTF-8"));
      Path p = langDir != null ? langDir.resolve(code + ".lang") : null;
      if (p != null && Files.exists(p)) return Files.newInputStream(p);
      if (code.equals("en_US")) return Files.newInputStream(root.resolve("assets/minecraft/lang/en_US.lang"));
      throw new FileNotFoundException(path);
    }
    return Files.newInputStream(root.resolve("assets/minecraft/" + path));
  }
  public bqw a(bqx l) { try { return res(path(l)); } catch (IOException e) { throw new RuntimeException(e); } }
  bqw res(String path) throws IOException {
    final InputStream in = open(path);
    return new bqw() { public InputStream b() { return in; } public boolean c() { return false; } public bru a(String s) { return null; } };
  }
  public List b(bqx l) {
    try { return new ArrayList<>(Arrays.asList(res(path(l)))); } catch (IOException e) { return new ArrayList<>(); }
  }
}
public class SignFontProbe {
  static String q(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  // Sign lines as TileEntitySignRenderer draws them: the string (the edited line wrapped "> " + s + " <"), its getStringWidth and
  // the x it passes to drawString (0 - getStringWidth / 2, Java int division).
  public static void main(String[] args) throws Exception {
    Res res = new Res(Paths.get(args[0]));
    bao.rm = res;
    String[] lines = {"", "Hello", "WWW WWW WWW WWW", "iiiiiiiiiiiiiii", "Welcome!", "> <", "> Hello <", "> WWWWWWWWWWWWWWW <", "§4Red §lbold", "§lBBBB§r BBBB", "Mixed Ångström", "あいうえお", "中文字符中文字符", "Абвгд Эюя", "héllo wörld", "a§", "x§zy", "fffffffffffffff", "1234567890ABCDE"};
    for (boolean unicode : new boolean[] {false, true}) {
      bbu f = new bbu(new bbj(), new bqx("textures/font/ascii.png"), new bqf(null), unicode);
      f.a((bqy) res);
      StringBuilder s = new StringBuilder();
      for (int i = 0; i < lines.length; i++) {
        int w = f.a(lines[i]);
        if (i > 0) s.append(',');
        s.append("[").append(q(lines[i])).append(',').append(w).append(',').append(-(w / 2)).append(']');
      }
      System.out.println("{\"unicode\":" + unicode + ",\"lines\":[" + s + "]}");
    }
  }
}
