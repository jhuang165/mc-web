import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import javax.imageio.ImageIO;

// Runs the unchanged ItemWritableBook (ael), ItemEditableBook (aem), RecipeBookCloning (aew), CraftingManager (afe),
// FontRenderer (bbu, with the glyph widths it reads from ascii.png) and GuiScreenBook (bfe) of the 1.7.10 JAR. One JSON
// object per line:
//   facts     item ids, stack sizes, creative tabs, hasEffect, share tag, display names, the book GUI constants
//   valid     ItemWritableBook.validBookPageTagContents and ItemEditableBook.validBookTagContents over built tags
//   display   ItemEditableBook.getItemStackDisplayName / addInformation by title and author
//   recipe    CraftingManager.findMatchingRecipe over book recipes and cloning grids (result id, count, tag, name)
//   wrap      FontRenderer.getStringWidth, listFormattedStringToWidth and splitStringWidth
//   gui       GuiScreenBook driven through keyTyped/actionPerformed with a recording Minecraft double (see gui())
public class BookProbe {
  static String q(String s) { return CatalogueProbe.q(s); }
  static void out(String s) { System.out.println(s); }
  static sun.misc.Unsafe u;

  static dq pages(String... values) {
    dq list = new dq();
    for (String v : values) list.a(new dx(v));
    return list;
  }
  static String[] fifty() { String[] a = new String[50]; Arrays.fill(a, "p"); return a; }
  static String repeat(char c, int n) { char[] a = new char[n]; Arrays.fill(a, c); return new String(a); }

  // Tag the way a case describes it: pages (null = absent), title (null = absent), author (null = absent).
  static dh tag(dq pages, Object title, Object author) {
    dh t = new dh();
    if (pages != null) t.a("pages", pages);
    if (title != null) t.a("title", title instanceof String ? new dx((String) title) : new dw((short) 1));
    if (author != null) t.a("author", author instanceof String ? new dx((String) author) : new dw((short) 1));
    return t;
  }

  static String tagJson(dh t) {
    if (t == null) return "null";
    StringBuilder b = new StringBuilder("{");
    boolean first = true;
    if (t.b("pages", 9)) {
      dq p = t.c("pages", 8);
      List<String> items = new ArrayList<>();
      for (int i = 0; i < p.c(); i++) items.add(q(p.f(i)));
      b.append("\"pages\":[").append(String.join(",", items)).append("]");
      first = false;
    }
    if (t.b("author", 8)) { b.append(first ? "" : ",").append("\"author\":").append(q(t.j("author"))); first = false; }
    if (t.b("title", 8)) { b.append(first ? "" : ",").append("\"title\":").append(q(t.j("title"))); first = false; }
    if (t.b("display", 10)) { b.append(first ? "" : ",").append("\"name\":").append(q(t.m("display").j("Name"))); }
    return b.append("}").toString();
  }
  static String stack(add s) {
    if (s == null) return "null";
    return "{\"id\":" + adb.b(s.b()) + ",\"count\":" + s.b + ",\"damage\":" + s.k() + ",\"tag\":" + tagJson(s.q()) + "}";
  }

  static void facts() throws Exception {
    adb w = ade.bA, s = ade.bB;
    add plainW = new add(w), plainS = new add(s), tagged = new add(s);
    dh t = tag(pages("x"), "T", "A");
    tagged.d(t);
    List<String> tabs = new ArrayList<>();
    for (abt tab : abt.a) tabs.add(q(tab.b()));
    out("{\"case\":\"facts\",\"writable\":{\"id\":" + adb.b(w) + ",\"maxStack\":" + w.m() + ",\"tab\":" + (w.n_() == null ? "null" : w.n_().a())
      + ",\"shareTag\":" + w.s() + ",\"hasEffect\":" + w.e(plainW) + ",\"hasEffectTagged\":" + w.e(plainW) + ",\"name\":" + q(w.n(plainW)) + ",\"unlocalized\":" + q(w.a()) + "},"
      + "\"written\":{\"id\":" + adb.b(s) + ",\"maxStack\":" + s.m() + ",\"tab\":" + (s.n_() == null ? "null" : s.n_().a())
      + ",\"shareTag\":" + s.s() + ",\"hasEffect\":" + s.e(plainS) + ",\"hasEffectTagged\":" + s.e(tagged) + ",\"name\":" + q(s.n(plainS)) + ",\"namedTagged\":" + q(s.n(tagged)) + ",\"unlocalized\":" + q(s.a()) + "},"
      + "\"book\":{\"id\":" + adb.b(ade.aG) + "},\"tabMisc\":" + abt.f.a() + ",\"tabs\":[" + String.join(",", tabs) + "],"
      + "\"textures\":[\"book_writable\",\"book_written\"],"
      + "\"limits\":{\"pageChars\":256,\"title\":16,\"pages\":50,\"wrapWidth\":116,\"heightLimit\":118,\"insertWrap\":118,\"gui\":[192,192]}}");
  }

  static void valid() {
    Object[][] cases = {
      {"null tag", null},
      {"empty compound", new dh()},
      {"empty pages", tag(new dq(), null, null)},
      {"one page", tag(pages("hello"), null, null)},
      {"256 chars", tag(pages(repeat('a', 256)), null, null)},
      {"257 chars", tag(pages(repeat('a', 257)), null, null)},
      {"256 then 257", tag(pages(repeat('a', 256), repeat('b', 257)), null, null)},
      {"50 pages", tag(pages(fifty()), null, null)},
      {"newline page", tag(pages("a\nb"), null, null)},
      {"pages of compounds", compoundPages()},
      {"title ok", tag(pages("p"), "Title", "Steve")},
      {"title 16", tag(pages("p"), repeat('t', 16), "Steve")},
      {"title 17", tag(pages("p"), repeat('t', 17), "Steve")},
      {"title empty", tag(pages("p"), "", "Steve")},
      {"title missing", tag(pages("p"), null, "Steve")},
      {"author missing", tag(pages("p"), "T", null)},
      {"author empty", tag(pages("p"), "T", "")},
      {"title wrong type", tag(pages("p"), new dw((short) 1), "Steve")},
      {"author wrong type", tag(pages("p"), "T", new dw((short) 1))},
      {"pages missing title ok", tag(null, "T", "Steve")},
      {"long page signed", tag(pages(repeat('a', 257)), "T", "Steve")},
    };
    for (Object[] c : cases) {
      dh t = (dh) c[1];
      out("{\"case\":\"valid\",\"name\":" + q((String) c[0]) + ",\"writable\":" + ael.a(t) + ",\"written\":" + aem.a(t) + ",\"tag\":" + tagJson(t) + "}");
    }
  }
  static dh compoundPages() {
    dq list = new dq();
    list.a(new dh());
    dh t = new dh();
    t.a("pages", list);
    return t;
  }

  static void display() {
    adb s = ade.bB;
    String[][] cases = { {null, null}, {"Title", "Steve"}, {"", "Steve"}, {"Title", ""}, {"Title", null}, {null, "Steve"}, {" ", "Alex"} };
    for (String[] c : cases) {
      add stack = new add(s);
      if (c[0] != null || c[1] != null) {
        dh t = new dh();
        t.a("pages", pages("p"));
        if (c[0] != null) t.a("title", new dx(c[0]));
        if (c[1] != null) t.a("author", new dx(c[1]));
        stack.d(t);
      }
      List<String> lines = new ArrayList<>();
      s.a(stack, null, lines, false);
      List<String> quoted = new ArrayList<>();
      for (String l : lines) quoted.add(q(l));
      out("{\"case\":\"display\",\"title\":" + q(c[0]) + ",\"author\":" + q(c[1]) + ",\"name\":" + q(s.n(stack)) + ",\"lines\":[" + String.join(",", quoted) + "],\"hasEffect\":" + s.e(stack) + "}");
    }
  }

  static zs container = new zs() { public boolean a(yz player) { return true; } };
  static add written(String title, String author, String name, String... pageList) {
    add s = new add(ade.bB);
    dh t = new dh();
    t.a("pages", pages(pageList));
    if (title != null) t.a("title", new dx(title));
    if (author != null) t.a("author", new dx(author));
    s.d(t);
    if (name != null) s.c(name);
    return s;
  }
  static add writable(String... pageList) {
    add s = new add(ade.bA);
    if (pageList.length > 0) { dh t = new dh(); t.a("pages", pages(pageList)); s.d(t); }
    return s;
  }
  static void recipe(String name, int size, add... cells) {
    aae grid = new aae(container, size, size);
    List<String> in = new ArrayList<>();
    for (int i = 0; i < cells.length; i++) { if (cells[i] != null) grid.a(i, cells[i].m()); in.add(stack(cells[i])); }
    String result;
    try { result = stack(afe.a().a(grid, null)); } catch (Throwable e) { result = "{\"error\":" + q(e.getClass().getSimpleName()) + "}"; }
    // Direct aew calls too: matches (a(aae, ahb)) and the result (a(aae)).
    aew cloning = new aew();
    String direct;
    try { direct = stack(cloning.a(grid)); } catch (Throwable e) { direct = "{\"error\":" + q(e.getClass().getSimpleName()) + "}"; }
    out("{\"case\":\"recipe\",\"name\":" + q(name) + ",\"size\":" + size + ",\"cells\":[" + String.join(",", in) + "],\"result\":" + result
      + ",\"cloningMatches\":" + cloning.a(grid, null) + ",\"cloningResult\":" + direct + "}");
  }
  static void recipes() {
    add book = new add(ade.aG), ink = new add(ade.aR, 1, 0), feather = new add(ade.G), blueDye = new add(ade.aR, 1, 4);
    recipe("book quill 3x3", 3, book, ink, feather);
    recipe("book quill reversed", 3, feather, ink, book);
    recipe("book quill 2x2", 2, ink, book, feather, null);
    recipe("book quill needs black ink", 3, book, blueDye, feather);
    recipe("book quill two feathers", 3, book, ink, feather, feather);
    recipe("book quill no feather", 3, book, ink);
    add w1 = written("Saga", "Steve", null, "one", "two");
    recipe("clone 1", 3, w1, writable());
    recipe("clone 2", 3, w1, writable(), writable());
    recipe("clone 3 offset", 3, null, writable(), null, writable(), w1, writable(), null, null, null);
    recipe("clone 8", 3, w1, writable(), writable(), writable(), writable(), writable(), writable(), writable(), writable());
    recipe("clone 2x2", 2, w1, writable(), writable(), null);
    recipe("clone named", 3, written("Saga", "Steve", "Renamed", "one"), writable());
    recipe("clone writable with pages", 3, w1, writable("draft"));
    recipe("clone no writable", 3, w1);
    recipe("clone two written", 3, w1, written("Other", "Alex", null, "x"), writable());
    recipe("clone foreign item", 3, w1, writable(), new add(ade.aG));
    recipe("clone writable only", 3, writable(), writable());
    recipe("clone untagged written", 3, new add(ade.bB), writable());
    recipe("clone empty title", 3, written("", "Steve", null, "one"), writable());
  }

  // FontRenderer with the glyph widths bbu.c() derives from textures/font/ascii.png (the unicode path is not used).
  static bbu font;
  static void fontSetup(String asciiPng) throws Exception {
    BufferedImage img = ImageIO.read(new File(asciiPng));
    int w = img.getWidth(), h = img.getHeight();
    int[] px = new int[w * h];
    img.getRGB(0, 0, w, h, px, 0, w);
    int rows = h / 16, cols = w / 16;
    float scale = 8.0f / cols;
    int[] widths = new int[256];
    for (int i = 0; i < 256; i++) {
      int cx = i % 16, cy = i / 16;
      if (i == 32) widths[i] = 3 + 1;
      int col;
      for (col = cols - 1; col >= 0; col--) {
        int x = cx * cols + col;
        boolean empty = true;
        for (int row = 0; row < rows && empty; row++) {
          int y = (cy * cols + row) * w;
          if (((px[x + y] >> 24) & 255) != 0) empty = false;
        }
        if (!empty) break;
      }
      col++;
      widths[i] = (int) (0.5 + col * scale) + 1;
    }
    font = (bbu) u.allocateInstance(bbu.class);
    MobMoveProbe.set(font, "d", widths);
    MobMoveProbe.set(font, "a", 9);
    MobMoveProbe.set(font, "e", new byte[65536]);
    MobMoveProbe.set(font, "k", false);
    MobMoveProbe.set(font, "l", false);
  }
  static void wrap() {
    // § is the formatting character; the cursor suffix of GuiScreenBook is a black code and an underscore.
    String s = "§";
    String[] texts = {
      "", "a", "Hello World", "The quick brown fox jumps over the lazy dog and keeps running far away",
      "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWW", "line one\nline two\n\nline four", "trailing newline\n", "\nleading newline",
      "word   with   spaces", "a b c d e f g h i j k l m n o p q r s t u v w x y z a b c d e f g h i j k l m n o p q r s t u v w x y z",
      s + "lbold " + s + "rplain text " + s + "a green words that go on and on for a while",
      s + "6gold text wraps here " + s + "oitalic words that also wrap around the line limit", "with underscore cursor" + s + "0_",
      "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~",
      "supercalifragilisticexpialidocious-and-more-supercalifragilisticexpialidocious",
    };
    int[] widths = {116, 118, 104, 160};
    for (String text : texts) {
      for (int width : widths) {
        List<String> lines = new ArrayList<>();
        for (Object l : font.c(text, width)) lines.add(q((String) l));
        out("{\"case\":\"wrap\",\"text\":" + q(text) + ",\"width\":" + width + ",\"stringWidth\":" + font.a(text) + ",\"lines\":[" + String.join(",", lines) + "],\"height\":" + font.b(text, width) + "}");
      }
    }
  }
  static void charWidths() {
    List<String> a = new ArrayList<>();
    for (int c = 32; c < 127; c++) a.add(String.valueOf(font.a((char) c)));
    out("{\"case\":\"charWidths\",\"from\":32,\"widths\":[" + String.join(",", a) + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    u = MobMoveProbe.unsafe();
    fontSetup(args[0]);
    facts();
    valid();
    display();
    recipes();
    charWidths();
    wrap();
    BookGuiProbe.run(u, font, args);
  }
}
