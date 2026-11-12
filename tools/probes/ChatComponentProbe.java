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
  static fq player(String formatted, String raw) {
    fq t = new fq(formatted);
    t.b().a(new fh(fi.e, "/msg " + raw + " "));
    return t;
  }
  // CommandBase.func_147176_a: ChatComponentText("") with each word a sibling, " " siblings between.
  static fq words(String... w) {
    fq r = new fq("");
    for (int i = 0; i < w.length; i++) { if (i > 0) r.a(new fq(" ")); r.a(new fq(w[i])); }
    return r;
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
    // b53ct: the trees CommandMessage, CommandBroadcast, CommandServerEmote (CommandBase.func_147176_a) and NetHandlerPlayServer.processChatMessage
    // build (source-recalled; none of those classes is in the client jar). EntityPlayer.func_145748_c_ (yz.c_) is read from bytecode: a ChatComponentText
    // of the team-formatted name with a ClickEvent(fi.e = suggest_command, "/msg <name> "), no hover; it is built here with the real fq/fn/fh/fi.
    fq whisperer = player("Steve", "Steve"), target = player("Alex", "Alex");
    fq msg = words("hi", "there");
    fr tellIn = new fr("commands.message.display.incoming", whisperer, msg); tellIn.b().a(a.h).b(true);
    fr tellOut = new fr("commands.message.display.outgoing", target, words("hi", "there")); tellOut.b().a(a.h).b(true);
    fr tellBlock = new fr("commands.message.display.incoming", new fq("@"), words("hi", "there")); tellBlock.b().a(a.h).b(true);
    fr chatClick = new fr("chat.type.text", player("Steve", "Steve"), "hello");
    fr chatTeam = new fr("chat.type.text", player("\u00a7c[Red] Steve\u00a7r", "Steve"), "hello");
    fq selWords = new fq(""); selWords.a(new fq("hi")); selWords.a(new fq(" "));
    fq sel = new fq(""); sel.a(player("Steve", "Steve")); selWords.a(sel);
    fr sayWords = new fr("chat.type.announcement", player("Steve", "Steve"), words("hi", "there"));
    fr sayBlock = new fr("chat.type.announcement", new fq("@"), selWords);
    fr emoteWords = new fr("chat.type.emote", player("Steve", "Steve"), words("waves", "hello"));
    fj[] comps = { header, usageLine, footer, dep, depMore, admin, admin2, usageErr, nested, argStyled, ownColour, ach, say, chatText, empty, tellIn, tellOut, tellBlock, chatClick, chatTeam, sayWords, sayBlock, emoteWords };
    String[] names = { "helpHeader", "helpLine", "helpFooter", "deprecatedId", "deprecatedIdSibling", "adminGive", "adminTp", "usageError", "nestedStyles", "argumentStyle", "ownColour", "achievement", "announcement", "chatText", "emptyRoot", "tellIncoming", "tellOutgoing", "tellFromBlock", "chatTextClick", "chatTextTeam", "sayWords", "sayBlockSelector", "emoteWords" };
    StringBuilder o = new StringBuilder();
    for (int i = 0; i < comps.length; i++) o.append(i > 0 ? "," : "").append(row(names[i], comps[i]));
    System.out.println("{\"name\":\"chat\",\"rows\":[" + o + "]}");
  }
}
