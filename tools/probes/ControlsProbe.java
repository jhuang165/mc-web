import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

// Runs the unchanged 1.7.10 KeyBinding (bal), GameSettings (bbj) and LWJGL 2 Keyboard code headlessly:
// every key binding with its default, category and registration order, the KeyBinding hash that
// routes a key code to a binding (the last registered binding wins a shared code), press counting,
// LWJGL Keyboard.getKeyName for codes 0..255, GameSettings.saveOptions for the constructor defaults
// and loadOptions of a crafted options.txt. Nothing is rendered; Minecraft is an Unsafe-allocated
// instance with only isJava64bit set (as SettingsProbe). One JSON record per line.
public class ControlsProbe {
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c == '\n') b.append("\\n");
      else if (c == '\r') b.append("\\r");
      else if (c == '\t') b.append("\\t");
      else if (c < 32) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static Object field(Object o, Class<?> c, String name) throws Exception {
    Field f = c.getDeclaredField(name);
    f.setAccessible(true);
    return f.get(o);
  }
  static bbj construct(File dir) throws Exception {
    Field u = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe");
    u.setAccessible(true);
    sun.misc.Unsafe unsafe = (sun.misc.Unsafe) u.get(null);
    bao mc = (bao) unsafe.allocateInstance(bao.class);
    Field f = bao.class.getDeclaredField("ai");
    f.setAccessible(true);
    f.setBoolean(mc, true);
    return new bbj(mc, dir);
  }
  static bal[] all(bbj gs) { return gs.as; }
  static String pressedList(bbj gs) {
    List<String> r = new ArrayList<>();
    for (bal k : gs.as) if (k.d()) r.add(q(k.g()));
    return "[" + String.join(",", r) + "]";
  }
  static String bindings(bbj gs) {
    List<String> r = new ArrayList<>();
    for (bal k : gs.as) r.add(q(k.g()) + ":" + k.i());
    return "{" + String.join(",", r) + "}";
  }
  // The binding the KeyBinding hash (pz) returns for a code: the one setKeyBindState presses.
  static String winner(int code) throws Exception {
    Object hash = field(null, bal.class, "b");
    Method lookup = hash.getClass().getDeclaredMethod("a", int.class);
    lookup.setAccessible(true);
    Object k = lookup.invoke(hash, code);
    return k == null ? "null" : q(((bal) k).g());
  }

  public static void main(String[] args) throws Exception {
    File dir = new File(args[0]);
    dir.mkdirs();
    File options = new File(dir, "options.txt");
    options.delete();
    bbj gs = construct(dir);

    // GameSettings.keyBindings (saved order) with the static registration order (KeyBinding.keybindArray).
    List<?> registry = (List<?>) field(null, bal.class, "a");
    int i = 0;
    for (bal k : gs.as) {
      System.out.println("{\"case\":\"binding\",\"index\":" + (i++) + ",\"description\":" + q(k.g()) + ",\"defaultKey\":" + k.h()
        + ",\"category\":" + q(k.e()) + ",\"registration\":" + registry.indexOf(k) + "}");
    }
    i = 0;
    for (bal k : gs.ar) System.out.println("{\"case\":\"hotbar\",\"index\":" + (i++) + ",\"description\":" + q(k.g()) + "}");

    // LWJGL 2 Keyboard.getKeyName for every code (null names omitted) and getKeyIndex for the reverse.
    List<String> names = new ArrayList<>();
    for (int c = 0; c < 256; c++) {
      String n = org.lwjgl.input.Keyboard.getKeyName(c);
      if (n != null) names.add("[" + c + "," + q(n) + "," + org.lwjgl.input.Keyboard.getKeyIndex(n) + "]");
    }
    System.out.println("{\"case\":\"keyNames\",\"names\":[" + String.join(",", names) + "]}");
    // GameSettings.getKeyDisplayString for non-negative codes (negative ones go through I18n, not loaded here).
    List<String> shown = new ArrayList<>();
    for (int c : new int[] { 0, 17, 29, 42, 53, 57, 60, 87, 200, 219 }) shown.add("[" + c + "," + q(bbj.c(c)) + "]");
    System.out.println("{\"case\":\"displayString\",\"values\":[" + String.join(",", shown) + "]}");

    // The hash after the constructor: which binding a press of each default code reaches.
    Set<Integer> codes = new TreeSet<>();
    for (bal k : gs.as) codes.add(k.i());
    for (int c : codes) System.out.println("{\"case\":\"hash\",\"code\":" + c + ",\"binding\":" + winner(c) + "}");

    // setKeyBindState / onTick / isPressed / getIsKeyPressed.
    bal.a(17, true);
    bal.a(17);
    bal.a(17);
    System.out.println("{\"case\":\"press\",\"step\":\"forward down, two onTick\",\"pressed\":" + pressedList(gs) + ",\"isPressed\":[" + gs.U.f() + "," + gs.U.f() + "," + gs.U.f() + "]}");
    bal.a(17, false);
    bal.a(-100, true);
    bal.a(-100);
    System.out.println("{\"case\":\"press\",\"step\":\"mouse -100 down\",\"pressed\":" + pressedList(gs) + ",\"isPressed\":[" + gs.ad.f() + "," + gs.ad.f() + "]}");
    bal.a(-100, false);
    bal.a(0, true);
    bal.a(0);
    System.out.println("{\"case\":\"press\",\"step\":\"code 0 down\",\"pressed\":" + pressedList(gs) + ",\"winner\":" + winner(0) + "}");
    bal.a(0, false);
    bal.a();

    // Two bindings on one code. GuiControls calls setOptionKeyBinding (bbj.a(bal,int), which saves) and then
    // resetKeyBindingArrayAndHash, which re-adds every binding in registration order: the later one keeps the code.
    gs.a(gs.V, 57); // key.left (registration 1) -> SPACE, key.jump's default (registration 4)
    bal.b();
    bal.a(57, true);
    System.out.println("{\"case\":\"conflict\",\"code\":57,\"bindings\":[\"key.left\",\"key.jump\"],\"winner\":" + winner(57) + ",\"pressed\":" + pressedList(gs) + "}");
    bal.a(57, false);
    gs.a(gs.V, 17); // key.left -> W, key.forward's default (registration 0)
    bal.b();
    bal.a(17, true);
    System.out.println("{\"case\":\"conflict\",\"code\":17,\"bindings\":[\"key.forward\",\"key.left\"],\"winner\":" + winner(17) + ",\"pressed\":" + pressedList(gs) + ",\"hash30\":" + winner(30) + "}");
    bal.a(17, false);
    // Without the hash rebuild (setOptionKeyBinding alone) presses still follow the old codes.
    gs.a(gs.V, 44);
    System.out.println("{\"case\":\"noRebuild\",\"keyLeft\":" + gs.V.i() + ",\"hash44\":" + winner(44) + ",\"hash17\":" + winner(17) + "}");
    gs.a(gs.V, 30);
    bal.b();
    System.out.println("{\"case\":\"restored\",\"hash30\":" + winner(30) + ",\"hash17\":" + winner(17) + ",\"hash44\":" + winner(44) + "}");

    // F3+F: setOptionValue(RENDER_DISTANCE, +-1) as Minecraft.runTick calls it.
    int before = (Integer) field(gs, bbj.class, "c");
    gs.a(bbm.f, 1);
    int afterPlus = (Integer) field(gs, bbj.class, "c");
    gs.a(bbm.f, -1);
    System.out.println("{\"case\":\"f3f\",\"before\":" + before + ",\"afterPlus\":" + afterPlus + ",\"afterMinus\":" + field(gs, bbj.class, "c") + "}");

    // Max Framerate: setOptionFloatValue / getOptionFloatValue across the slider, and Options denormalize.
    List<String> fps = new ArrayList<>();
    for (float v : new float[] { 10f, 55f, 120f, 255f, 260f }) {
      gs.a(bbm.j, v);
      fps.add("[" + v + "," + gs.a(bbm.j) + "," + field(gs, bbj.class, "h") + "]");
    }
    List<String> slider = new ArrayList<>();
    for (float n : new float[] { 0f, 0.04f, 0.5f, 0.98f, 1f }) slider.add("[" + n + "," + bbm.j.d(n) + "]");
    System.out.println("{\"case\":\"framerate\",\"set\":[" + String.join(",", fps) + "],\"denormalize\":[" + String.join(",", slider)
      + "],\"min\":" + field(bbm.j, bbm.class, "W") + ",\"max\":" + bbm.j.f() + ",\"step\":" + field(bbm.j, bbm.class, "V") + "}");

    // saveOptions with every constructor default (a fresh instance; nothing was changed on it).
    options.delete();
    bbj fresh = construct(dir);
    fresh.b();
    String saved = new String(Files.readAllBytes(options.toPath()), StandardCharsets.UTF_8);
    System.out.println("{\"case\":\"defaultOptionsTxt\",\"text\":" + q(saved) + "}");

    // loadOptions of a crafted file: rebinding, mouse codes, unknown lines and junk values.
    String crafted = "key_key.forward:200\nkey_key.attack:-99\nkey_key.use:-100\nkey_key.jump:abc\nkey_unknown:5\nmaxFps:60\nenableVsync:false\n"
      + "mouseSensitivity:0.25\ninvertYMouse:true\npauseOnLostFocus:false\nadvancedItemTooltips:true\nnoColonLine\nkey_key.drop:16:9\n";
    Files.write(options.toPath(), crafted.getBytes(StandardCharsets.UTF_8));
    bbj loaded = construct(dir);
    System.out.println("{\"case\":\"loadOptions\",\"input\":" + q(crafted) + ",\"bindings\":" + bindings(loaded) + ",\"maxFps\":" + field(loaded, bbj.class, "h")
      + ",\"enableVsync\":" + field(loaded, bbj.class, "t") + ",\"mouseSensitivity\":" + field(loaded, bbj.class, "a") + ",\"invertYMouse\":" + field(loaded, bbj.class, "b")
      + ",\"pauseOnLostFocus\":" + field(loaded, bbj.class, "w") + ",\"advancedItemTooltips\":" + field(loaded, bbj.class, "v")
      + ",\"hash200\":" + winner(200) + ",\"hash17\":" + winner(17) + "}");
    // The rewrite after a load keeps the order of saveOptions, not of the file.
    loaded.b();
    System.out.println("{\"case\":\"resaved\",\"text\":" + q(new String(Files.readAllBytes(options.toPath()), StandardCharsets.UTF_8)) + "}");
    options.delete();
  }
}
