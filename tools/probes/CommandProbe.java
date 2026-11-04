import java.lang.reflect.*;
import java.util.*;

// ServerCommandManager (bl) of Minecraft Java 1.7.10. Its constructor needs a MinecraftServer for the dedicated-server branch, so the
// command classes it registers (the class list is asserted against the constructor bytecode by tools/verify-commands.mjs) are
// instantiated directly. Each line is {"kind":"command",...}: CommandBase.getCommandName c(), getCommandAliases b(),
// getRequiredPermissionLevel a(), getCommandUsage c(sender). Then CommandBase's static parsers (y.a / y.b / y.c) are driven with a
// proxy ICommandSender (ac): {"kind":"parse",...} with the result or the thrown CommandException key + arguments.
public class CommandProbe {
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String arr(Collection<?> c) { StringBuilder b = new StringBuilder("["); boolean first = true; for (Object o : c) { if (!first) b.append(','); first = false; b.append(q(String.valueOf(o))); } return b.append("]").toString(); }

  public static void main(String[] args) throws Exception {
    String[] classes = args[0].split(",");
    ac sender = (ac) Proxy.newProxyInstance(CommandProbe.class.getClassLoader(), new Class[]{ac.class}, (p, m, a) -> {
      if (m.getName().equals("a") && m.getParameterTypes().length == 2) return Boolean.TRUE;
      if (m.getName().equals("b_")) return "Player";
      return null;
    });
    for (String cls : classes) {
      y c;
      try { c = (y) Class.forName(cls).getDeclaredConstructor().newInstance(); }
      catch (Throwable t) { System.out.println("{\"kind\":\"command\",\"class\":" + q(cls) + ",\"loadError\":" + q(String.valueOf(t)) + "}"); continue; }
      List al = c.b();
      System.out.println("{\"kind\":\"command\",\"class\":" + q(cls) + ",\"name\":" + q(c.c()) + ",\"aliases\":" + (al == null ? "[]" : arr(al)) + ",\"permission\":" + c.a() + ",\"usage\":" + q(c.c(sender)) + "}");
    }
    aji.p();
    adb.l();
    for (Class<?> owner : new Class<?>[]{adb.class, aji.class}) {
      for (Field f : owner.getDeclaredFields()) {
        if (!Modifier.isStatic(f.getModifiers()) || !cw.class.isAssignableFrom(f.getType())) continue;
        f.setAccessible(true);
        cw reg = (cw) f.get(null);
        List<String> names = new ArrayList<>();
        for (Object k : reg.b()) names.add((String) k);
        Collections.sort(names);
        StringBuilder b = new StringBuilder();
        for (String n : names) b.append(b.length() == 0 ? "" : ",").append("[").append(q(n)).append(",").append(reg.b(reg.a(n))).append("]");
        System.out.println("{\"kind\":\"registry\",\"registry\":" + q(owner == adb.class ? "item" : "block") + ",\"entries\":[" + b + "]}");
      }
    }
    // EntityList: stringToClassMapping (sg.c) and classToIDMapping (sg.f).
    Field fc = sg.class.getDeclaredField("c"), ff = sg.class.getDeclaredField("f");
    fc.setAccessible(true); ff.setAccessible(true);
    Map<String, Class<?>> byName = (Map<String, Class<?>>) fc.get(null);
    Map<Class<?>, Integer> byClass = (Map<Class<?>, Integer>) ff.get(null);
    List<String> en = new ArrayList<>(byName.keySet()); Collections.sort(en);
    StringBuilder eb = new StringBuilder();
    for (String n : en) eb.append(eb.length() == 0 ? "" : ",").append("[").append(q(n)).append(",").append(byClass.get(byName.get(n))).append("]");
    System.out.println("{\"kind\":\"entities\",\"entries\":[" + eb + "]}");
    StringBuilder pb = new StringBuilder();
    for (int i = 0; i < rv.a.length; i++) if (rv.a[i] != null) pb.append(pb.length() == 0 ? "" : ",").append("[").append(i).append(",").append(q(rv.a[i].a())).append(",").append(rv.a[i].c()).append("]");
    System.out.println("{\"kind\":\"potions\",\"entries\":[" + pb + "]}");
    StringBuilder nb = new StringBuilder();
    for (int i = 0; i < aft.b.length; i++) if (aft.b[i] != null) nb.append(nb.length() == 0 ? "" : ",").append("[").append(i).append(",").append(q(aft.b[i].a())).append(",").append(aft.b[i].b()).append("]");
    System.out.println("{\"kind\":\"enchantments\",\"entries\":[" + nb + "]}");
    agy rules = new agy();
    StringBuilder rb = new StringBuilder();
    for (String n : rules.b()) rb.append(rb.length() == 0 ? "" : ",").append("[").append(q(n)).append(",").append(q(rules.a(n))).append("]");
    System.out.println("{\"kind\":\"gamerules\",\"entries\":[" + rb + "]}");
    StringBuilder gb = new StringBuilder();
    for (int i = 0; i < 4; i++) { ahk g = ahk.a(i); gb.append(gb.length() == 0 ? "" : ",").append("[").append(i).append(",").append(q(g.b())).append("]"); }
    System.out.println("{\"kind\":\"gametypes\",\"entries\":[" + gb + "]}");
    String[] ints = {"5", "-3", "abc", "", "2147483648", "1.5", " 7"};
    for (String s : ints) {
      System.out.println(call("parseInt", s, () -> String.valueOf(y.a(sender, s))));
      System.out.println(call("parseIntBounded(1,10)", s, () -> String.valueOf(y.a(sender, s, 1, 10))));
      System.out.println(call("parseIntMin(0)", s, () -> String.valueOf(y.a(sender, s, 0))));
    }
    String[] ds = {"1.5", "~", "~2", "~-3.5", "abc", "60000000", "-60000000", "~0.5", "3"};
    for (String s : ds) {
      System.out.println(call("parseDouble", s, () -> String.valueOf(y.b(sender, s))));
      System.out.println(call("relative(base=10)", s, () -> String.valueOf(y.a(sender, 10.0, s))));
      System.out.println(call("relative(base=10,-30000000,30000000)", s, () -> String.valueOf(y.a(sender, 10.0, s, -30000000, 30000000))));
      System.out.println(call("relative(base=10,0,256)", s, () -> String.valueOf(y.a(sender, 10.0, s, 0, 256))));
    }
    for (String s : new String[]{"true", "false", "TRUE", "1", "0", "yes", ""}) System.out.println(call("parseBoolean", s, () -> String.valueOf(y.c(sender, s))));
    for (String[] pair : new String[][]{{"he", "help"}, {"HE", "help"}, {"h", "help"}, {"minecraft:st", "minecraft:stone"}, {"x", "help"}}) {
      System.out.println("{\"kind\":\"parse\",\"fn\":\"doesStringStartWith\",\"input\":" + q(pair[0] + "|" + pair[1]) + ",\"result\":" + y.a(pair[0], pair[1]) + "}");
    }
    List<String> m = y.a(new String[]{"gi"}, new String[]{"give", "gamemode", "gamerule", "gi"});
    System.out.println("{\"kind\":\"parse\",\"fn\":\"getListOfStringsMatchingLastWord\",\"input\":\"gi|give,gamemode,gamerule,gi\",\"result\":" + arr(m) + "}");
  }
  interface Thrower { String run() throws Exception; }
  static String call(String fn, String input, Thrower t) {
    try { return "{\"kind\":\"parse\",\"fn\":" + q(fn) + ",\"input\":" + q(input) + ",\"result\":" + q(t.run()) + "}"; }
    catch (cd e) { StringBuilder a = new StringBuilder("["); Object[] args = e.a(); for (int i = 0; args != null && i < args.length; i++) { if (i > 0) a.append(','); a.append(q(String.valueOf(args[i]))); } a.append("]");
      return "{\"kind\":\"parse\",\"fn\":" + q(fn) + ",\"input\":" + q(input) + ",\"error\":" + q(e.getMessage()) + ",\"args\":" + a + ",\"type\":" + q(e.getClass().getName()) + "}"; }
    catch (Exception e) { return "{\"kind\":\"parse\",\"fn\":" + q(fn) + ",\"input\":" + q(input) + ",\"crash\":" + q(e.toString()) + "}"; }
  }
}
