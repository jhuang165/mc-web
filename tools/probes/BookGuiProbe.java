import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import io.netty.buffer.Unpooled;

// Drives the unchanged GuiScreenBook (bfe) of the 1.7.10 JAR headlessly, with the real FontRenderer (bbu, reading the shipped
// ascii.png and glyph_sizes.bin) and test doubles for Minecraft (bao: displayGuiScreen, fontRenderer, renderEngine, net handler),
// GameSettings (bbj), TextureManager (bqf), the resource manager (bqy), LWJGL (Keyboard, GL11 no-ops) and the net handler (bjb:
// records the MC|BEdit / MC|BSign packets, decoded back through the original PacketBuffer.readItemStackFromBuffer).
// The gui subclass records the drawTexturedModalRect blit and the FontRenderer drawString / drawSplitString calls of
// GuiScreenBook.drawScreen; the buttons are not drawn (the button list is emptied for the super call), and the page arrows
// (bff) are read from bytecode. Output: one JSON object per line (case gui / wrapUnicode); see tools/verify-book-gui.mjs.
// Usage: java BookGuiProbe <extracted-jar-dir>
class bao {
  public static final boolean a = false;
  static final bao I = new bao();
  public bbu l;
  static int closed;
  static final List<String> bound = new ArrayList<>();
  static bqf tm = new bqf(null);
  static bjb net;
  static bqy rm;
  public static bao B() { return I; }
  public bqy Q() { return rm; }
  public void a(bdw s) { closed++; }
  public void l() {} // setIngameFocus after Escape
  public bqf P() { return tm; }
  public bjb v() { return net; }
}
class bbj { public boolean e = false; }
class bqf { public bqf(bqy m) {} public void a(bqx l) { bao.bound.add(l.a()); } }
class Res implements bqy {
  final Path root;
  Res(Path root) { this.root = root; }
  static String path(bqx l) { return l.a().equals("minecraft") ? l.b() : l.a(); }
  public Set a() { return new HashSet<>(Arrays.asList("minecraft")); }
  bqw res(String path) throws IOException {
    final InputStream in = Files.newInputStream(root.resolve("assets/minecraft/" + path));
    return new bqw() { public InputStream b() { return in; } public boolean c() { return false; } public bru a(String s) { return null; } };
  }
  public bqw a(bqx l) { try { return res(path(l)); } catch (IOException e) { throw new RuntimeException(e); } }
  public List b(bqx l) { try { return new ArrayList<>(Arrays.asList(res(path(l)))); } catch (IOException e) { return new ArrayList<>(); } }
}
class Net extends bjb {
  Net() { super((bao) null, (bdw) null, (ej) null); }
  static final List<ft> sent = new ArrayList<>();
  public void a(ft p) { sent.add(p); }
}
class RecFont extends bbu {
  static final List<String> draws = new ArrayList<>();
  RecFont(Path root, boolean unicode) { super(new bbj(), new bqx("textures/font/ascii.png"), new bqf(null), unicode); }
  public int b(String s, int x, int y, int c) { draws.add("{\"op\":\"drawString\",\"text\":" + BookGuiProbe.q(s) + ",\"x\":" + x + ",\"y\":" + y + ",\"color\":" + c + "}"); return 0; }
  public void a(String s, int x, int y, int w, int c) {
    draws.add("{\"op\":\"drawSplitString\",\"text\":" + BookGuiProbe.q(s) + ",\"x\":" + x + ",\"y\":" + y + ",\"width\":" + w + ",\"color\":" + c + "}");
  }
}
class Player extends yz {
  Player() { super(null, null); }
  static Player named(String name) throws Exception { Player p = (Player) BookGuiProbe.u.allocateInstance(Player.class); MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(new UUID(1L, 2L), name)); return p; }
  public void a(fj message) {}
  public void b(fj message) {}
  public boolean a(int level, String command) { return false; }
  public r f_() { return null; }
}
class G extends bfe {
  static final List<String> blits = new ArrayList<>();
  G(yz p, add s, boolean e) { super(p, s, e); }
  public void b(int x, int y, int u, int v, int w, int h) { blits.add("{\"x\":" + x + ",\"y\":" + y + ",\"u\":" + u + ",\"v\":" + v + ",\"w\":" + w + ",\"h\":" + h + "}"); }
  void key(char c, int code) { a(c, code); }
  // GuiButton.mousePressed needs an enabled, visible button under the cursor; a button that does not exist is not clickable either.
  boolean click(int id) { for (Object o : n) { bcb b = (bcb) o; if (b.k == id) { if (!b.m || !b.l) return false; a(b); return true; } } return false; }
  List buttons() { return n; }
  void drawFrame() {
    List saved = new ArrayList(n);
    n.clear();
    try { a(0, 0, 0f); } finally { n.addAll(saved); }
  }
}
public class BookGuiProbe {
  static sun.misc.Unsafe u;
  static RecFont font;
  static Player player;
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static Object get(Object o, String name) throws Exception { Field f = o.getClass().getSuperclass() == bdw.class || o.getClass() == bfe.class ? bfe.class.getDeclaredField(name) : o.getClass().getDeclaredField(name); f.setAccessible(true); return f.get(o); }
  static Object fld(Class<?> c, Object o, String name) throws Exception { Field f = c.getDeclaredField(name); f.setAccessible(true); return f.get(o); }
  static dh tag(String[] pages, String title, String author) {
    dh t = new dh();
    if (pages != null) { dq l = new dq(); for (String p : pages) l.a(new dx(p)); t.a("pages", l); }
    if (title != null) t.a("title", new dx(title));
    if (author != null) t.a("author", new dx(author));
    return t;
  }
  static add writable(String... pages) { add s = new add(ade.bA); if (pages.length > 0) s.d(tag(pages, null, null)); return s; }
  static add written(String title, String author, String... pages) { add s = new add(ade.bB); s.d(tag(pages, title, author)); return s; }

  // ---- scenario state ----
  static G g;
  static add item;
  static List<String> steps;
  static String repeat(String s, int n) { StringBuilder b = new StringBuilder(); for (int i = 0; i < n; i++) b.append(s); return b.toString(); }

  static String stackJson(add s) { return BookProbe.stack(s); }
  static String state() throws Exception {
    dq pages = (dq) fld(bfe.class, g, "y");
    List<String> pj = new ArrayList<>();
    if (pages != null) for (int i = 0; i < pages.c(); i++) pj.add(q(pages.f(i)));
    List<String> bj = new ArrayList<>();
    for (Object o : g.buttons()) {
      bcb b = (bcb) o;
      bj.add("{\"id\":" + b.k + ",\"visible\":" + b.m + ",\"enabled\":" + b.l + ",\"x\":" + b.h + ",\"y\":" + b.i + ",\"w\":" + b.f + ",\"h\":" + b.g + ",\"label\":" + q(b.j) + "}");
    }
    List<String> pk = new ArrayList<>();
    for (ft p : Net.sent) pk.add(packet(p));
    Net.sent.clear();
    String s = "{\"page\":" + fld(bfe.class, g, "x") + ",\"total\":" + fld(bfe.class, g, "w") + ",\"signing\":" + fld(bfe.class, g, "s") + ",\"modified\":" + fld(bfe.class, g, "r")
      + ",\"title\":" + q((String) fld(bfe.class, g, "z")) + ",\"pages\":" + (pages == null ? "null" : "[" + String.join(",", pj) + "]")
      + ",\"buttons\":[" + String.join(",", bj) + "],\"closed\":" + bao.closed + ",\"packets\":[" + String.join(",", pk) + "],\"item\":" + stackJson(item) + "}";
    return s;
  }
  static String packet(ft p) throws Exception {
    String channel = (String) fld(iz.class, p, "a");
    byte[] data = (byte[]) fld(iz.class, p, "c");
    add decoded = new et(Unpooled.wrappedBuffer(data)).c();
    return "{\"channel\":" + q(channel) + ",\"stack\":" + stackJson(decoded) + "}";
  }
  static void step(String op, String arg) throws Exception {
    steps.add("{\"op\":\"" + op + "\",\"arg\":" + arg + ",\"state\":" + state() + "}");
  }
  static void begin(add stack, boolean editable) throws Exception {
    item = stack;
    bao.closed = 0; Net.sent.clear();
    g = new G(player, stack, editable);
    g.a(bao.I, 320, 240);
    steps = new ArrayList<>();
    step("open", "null");
  }
  static void end(String name, boolean editable) {
    System.out.println("{\"case\":\"gui\",\"name\":" + q(name) + ",\"editable\":" + editable + ",\"steps\":[" + String.join(",", steps) + "]}");
  }
  static void key(char c, int code) throws Exception { g.key(c, code); step("key", "[" + (int) c + "," + code + "]"); }
  static void type(String s) throws Exception { for (char c : s.toCharArray()) g.key(c, 0); step("type", q(s)); }
  static void click(int id) throws Exception { boolean hit = g.click(id); step(hit ? "click" : "clickMissed", "" + id); }
  static void clickN(int id, int n) throws Exception { for (int i = 0; i < n; i++) g.click(id); step("clickN", "[" + id + "," + n + "]"); }
  static void tick(int n) throws Exception { for (int i = 0; i < n; i++) g.e(); step("tick", "" + n); }
  static void paste(String s) throws Exception {
    Method m = bfe.class.getDeclaredMethod("b", String.class); m.setAccessible(true);
    m.invoke(g, s); step("paste", q(s));
  }
  static void draw() throws Exception {
    RecFont.draws.clear(); G.blits.clear(); bao.bound.clear();
    g.drawFrame();
    steps.add("{\"op\":\"draw\",\"arg\":null,\"draw\":[" + String.join(",", RecFont.draws) + "],\"blits\":[" + String.join(",", G.blits) + "],\"bound\":" + listJson(bao.bound) + ",\"state\":" + state() + "}");
  }
  static String listJson(List<String> l) { List<String> o = new ArrayList<>(); for (String s : l) o.add(q(s)); return "[" + String.join(",", o) + "]"; }

  static void scenarios() throws Exception {
    // 1. fresh Book and Quill: typing, newline, backspace, blink, paging, Done sends MC|BEdit.
    begin(writable(), true);
    draw(); type("Hello"); draw(); tick(6); draw(); tick(6); draw();
    key('\n', 28); type("x"); key('\0', 14); key('\0', 14); key('\0', 14); key('\0', 14); key('\0', 14); key('\0', 14); key('\0', 14);
    type("Second line"); key('\r', 156); type("kp");
    draw(); click(1); draw(); type("page2"); click(2); click(2); click(1); click(1);
    click(1); draw(); click(0); end("fresh writable: type, enter, backspace, pages, Done", true);

    // 2. Done without any change sends nothing.
    begin(writable(), true); click(1); step("noop", "null"); click(2); click(0); end("writable Done unmodified", true);
    begin(writable("kept"), true); click(0); end("writable with page Done unmodified", true);

    // 3. Escape discards.
    begin(writable("old"), true); type("new text"); key('\033', 1); end("writable Escape discards", true);

    // 4. page limit 256 characters, height limit (newlines), narrow glyphs.
    begin(writable(), true); type(repeat("i", 300)); draw(); end("256 character limit with i", true);
    begin(writable(), true); type(repeat("W", 300)); end("height limit with W", true);
    begin(writable(), true); for (int i = 0; i < 20; i++) key('\n', 28); type("z"); draw(); end("height limit with newlines", true);
    begin(writable(), true); type(repeat("abc def ", 40)); draw(); end("word wrap typing", true);
    begin(writable(), true); type(repeat("l", 254)); type("li"); end("limit exactly 255 then rejected", true);

    // 5. 50 page limit.
    begin(writable("first"), true);
    clickN(1, 60); draw(); click(0); end("50 pages limit and trailing empty pages dropped", true);
    begin(writable("first"), true);
    clickN(1, 4);
    type("p5"); click(0); end("trailing empty pages after content kept up to the last", true);
    begin(writable("a", "b", "c"), true); click(1); click(1); click(1); draw(); end("add page from last existing page", true);

    // 6. sign flow.
    begin(writable("Story page"), true);
    type("x"); draw(); click(3); draw(); type("A very long title that is too long"); draw(); key('\0', 14); type("§"); type("\u007f"); type("\u0001"); draw();
    click(5); end("sign: title max 16, Sign and Close", true);
    begin(writable("Story"), true); type("!"); click(3); step("sign", "null"); click(5); key('\0', 28); type("   "); click(5); key('\n', 28); end("sign: empty and blank title", true);
    begin(writable("Story"), true); type("!"); click(3); type("T"); click(4); step("cancel", "null"); draw(); click(3); key('\0', 14); key('\0', 14); type("Done title"); key('\n', 28); end("sign: cancel and Enter sends", true);
    begin(writable("Story"), true); click(3); type("  Padded  "); click(5); end("sign: trimmed title, unmodified pages", true);
    begin(writable("Story"), true); click(3); key('\033', 1); end("sign: Escape closes", true);
    begin(writable("a", "b", "", ""), true); type("x"); click(3); type("Tt"); click(5); end("sign: trailing empty pages dropped", true);
    begin(writable("Story"), true); click(3); type("T"); key('\0', 14); step("backspace title", "null"); draw(); end("sign: backspace to empty title", true);

    // 7. paste: pageInsertIntoCurrent takes the raw clipboard text; ctrl+V as a key goes through the system clipboard (empty here).
    begin(writable("start"), true);
    paste(" and §cred"); paste("tab\there\u0001"); paste("multi\nline"); paste(repeat("q", 300)); paste(repeat("q", 200)); paste("tail"); end("paste: raw text and the 256 limit", true);
    begin(writable("start"), true); key('\u0016', 47); type("v"); click(3); key('\u0016', 47); end("ctrl+V char with an empty clipboard, and in the title", true);

    // 8. written book, read-only.
    begin(written("Saga", "Steve", "one", "two", "three"), false);
    draw(); type("ignored"); key('\0', 14); key('\n', 28); click(1); draw(); click(1); draw(); click(1); click(2); click(2); click(2); click(3); click(0); end("written read-only", false);
    begin(written("Saga", "Steve", "one"), false); draw(); key('\033', 1); end("written one page Escape", false);
    begin(written("Saga", "Steve"), false); draw(); end("written no pages", false);
    begin(new add(ade.bB), false); draw(); end("written without tag", false);

    // 9. odd tags on a Book and Quill: the page list is empty when the stack has a tag but no pages (hasTagCompound).
    add named = new add(ade.bA); dh nameTag = new dh(); dh display = new dh(); display.a("Name", "My Book"); nameTag.a("display", display); named.d(nameTag);
    begin(named, true); draw(); type("abc"); click(1); draw(); type("def"); click(0); end("writable with only a display name tag", true);
    begin(writable(new String[0]), true); draw(); end("writable with an empty page list", true);
    add emptyPages = new add(ade.bA); emptyPages.d(tag(new String[0], null, null));
    begin(emptyPages, true); type("abc"); click(1); type("d"); click(0); end("writable with explicit empty pages tag", true);

    // 10. a different player name reaches the title screen and the signed packet.
    Player old = player; player = Player.named("Alex");
    begin(writable("x"), true); type("y"); click(3); draw(); type("Alex book"); click(5); end("sign with another player name", true);
    player = old;

    // 11. unicode and formatting in a page.
    begin(writable(), true); type("café über Ångström"); draw(); type(" 中文 あいう Жж"); draw(); end("accented and unicode typing", true);
    begin(writable(), true); type("§"); type("abc"); end("section sign is not typeable", true);
    begin(writable(), true); paste("§lBold §r plain §cred text that is long enough to wrap onto more lines of the page ok"); draw(); end("paste with formatting codes draws wrapped", true);
  }

  static void wrapUnicode(Path root) throws Exception {
    String[] texts = {"café crème brûlée naïve façade Über Ångström Ñoño", "ßœŒæ ðþ ¡¿«» £¥€",
      "中文字符串中文字符串中文字符串中文字符串", "あいうえお カタカナ", "Абвг Дежз Ийк лмн опрст",
      "العربية שלום 한글", "█░▒▓ ☃ ❤ ─│┌", "\u007f\u0080\u009f ­ ok", "￿� 😀", "§lé§ré §cÜber"};
    int[] widths = {116, 118, 60};
    for (boolean unicode : new boolean[] {false, true}) {
      RecFont f = new RecFont(root, unicode);
      f.a((bqy) new Res(root));
      for (String t : texts) for (int w : widths) {
        List<String> lines = new ArrayList<>();
        for (Object l : f.c(t, w)) lines.add(q((String) l));
        System.out.println("{\"case\":\"wrapUnicode\",\"unicodeFlag\":" + unicode + ",\"text\":" + q(t) + ",\"width\":" + w + ",\"stringWidth\":" + f.a(t) + ",\"lines\":[" + String.join(",", lines) + "],\"height\":" + f.b(t, w) + "}");
      }
    }
  }

  public static void main(String[] args) throws Exception {
    Path root = Paths.get(args[0]);
    bao.rm = new Res(root);
    brs locale = new brs();
    locale.a(bao.rm, new ArrayList<>(Arrays.asList("en_US")));
    Method setLocale = brp.class.getDeclaredMethod("a", brs.class); setLocale.setAccessible(true); setLocale.invoke(null, locale);
    u = MobMoveProbe.unsafe();
    aji.p();
    adb.l();
    player = Player.named("Player");
    font = new RecFont(root, false);
    font.a((bqy) new Res(root));
    bao.I.l = font;
    bao.net = (bjb) u.allocateInstance(Net.class);
    wrapUnicode(root);
    scenarios();
  }
}
