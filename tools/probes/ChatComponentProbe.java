// b52cc. Draws chat components through the unchanged 1.7.10 ChatComponentText [fq], ChatComponentTranslation [fr], ChatStyle [fn] and the
// IChatComponent.Serializer [fk]: getFormattedText (fj.d, what GuiNewChat.printChatMessage draws), getUnformattedText (fj.c) and the JSON,
// with StatCollector [dd] / StringTranslate [de] reading a stub /assets/minecraft/lang/en_US.lang on the classpath (the client jar has none;
// tools/verify-chat-component.mjs writes the needed lines and records them). Trees as the command classes build them (server-only, from source).
// Colours of the obfuscated enum [a] in declaration order: c DARK_GREEN, h GRAY, k GREEN, l AQUA, m RED, o YELLOW.
public class ChatComponentProbe {
  static String json(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String row(String name, fj c) { return "[" + json(name) + "," + json(fk.a(c)) + "," + json(c.d()) + "," + json(c.c()) + "]"; }
  static fq text(String s, a color, Boolean bold, Boolean italic) {
    fq t = new fq(s);
    if (color != null) t.b().a(color);
    if (bold != null) t.b().a(bold);
    if (italic != null) t.b().b(italic);
    return t;
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    fr header = new fr("commands.help.header", 1, 5); header.b().a(a.c);
    fr usageLine = new fr("commands.tp.usage");
    fr footer = new fr("commands.help.footer"); footer.b().a(a.k);
    fr dep = new fr("commands.generic.deprecatedId", "minecraft:stone"); dep.b().a(a.h);
    fr depMore = new fr("commands.generic.deprecatedId", "minecraft:stone"); depMore.b().a(a.h); depMore.a(new fq(" (more)"));
    fr admin = new fr("chat.type.admin", "@", new fr("commands.give.success", "Stone", 5, "Player")); admin.b().a(a.h).b(true);
    fr admin2 = new fr("chat.type.admin", "Rcon", new fr("commands.tp.success.coordinates", "Player", 1.5, 64.0, -3.0)); admin2.b().a(a.h).b(true);
    fr usageErr = new fr("commands.generic.usage", new fr("commands.tp.usage")); usageErr.b().a(a.m);
    fq nested = new fq("root "); nested.b().a(true);
    fq mid = text("mid ", a.m, null, true); mid.a(new fq("inner "));
    nested.a(mid); nested.a(new fq("tail"));
    fr argStyled = new fr("commands.give.success", text("[Stone]", null, null, true), 5, "Player"); argStyled.b().a(a.l);
    fq ownColour = text("gold", a.o, true, null);
    fr ach = new fr("chat.type.achievement", "Player", text("[Taking Inventory]", a.k, null, null));
    fr say = new fr("chat.type.announcement", "Server", "hello world");
    fr chatText = new fr("chat.type.text", "Player", "plain");
    fq empty = new fq(""); empty.a(text("first", a.m, null, null)); empty.a(new fq(" second"));
    fj[] comps = { header, usageLine, footer, dep, depMore, admin, admin2, usageErr, nested, argStyled, ownColour, ach, say, chatText, empty };
    String[] names = { "helpHeader", "helpLine", "helpFooter", "deprecatedId", "deprecatedIdSibling", "adminGive", "adminTp", "usageError", "nestedStyles", "argumentStyle", "ownColour", "achievement", "announcement", "chatText", "emptyRoot" };
    StringBuilder o = new StringBuilder();
    for (int i = 0; i < comps.length; i++) o.append(i > 0 ? "," : "").append(row(names[i], comps[i]));
    System.out.println("{\"name\":\"chat\",\"rows\":[" + o + "]}");
  }
}
