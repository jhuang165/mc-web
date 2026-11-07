import java.lang.reflect.*;
import java.util.*;

// Target selector evidence from the unchanged Minecraft Java 1.7.10 client JAR (PlayerSelector ad, MathHelper qh). Run by
// tools/verify-selector.mjs; one JSON object per line. Reflection on ad's private statics, so the real regexes are exercised:
//  * token:    ad.b(String) (the token regex ^@([parf])(?:\\[([\\w=,!-]*)\\])?$ matches: "matches") and ad.a(String) ("isAll": the
//              whole-string token test that is true only for @a forms).
//  * defaults: ad.c/d/e/f/g(token): rm, r, l, lm, c defaults (ad.c(ac,String) passes them to oi.a in that order).
//  * args:     ad.h(String) (the positional-then-key=value parser) in sorted key order, then ad.a(Map) (score_* map) in sorted order.
//  * int:      MathHelper.parseIntWithDefault (qh.a(String,int)).
// oi.a (findPlayers, the filter loop) needs a live server and is read from bytecode, not probed.
public class SelectorProbe {
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 0x20 || c > 0x7e) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static Method m(Class<?> c, String n, Class<?>... p) throws Exception { Method x = c.getDeclaredMethod(n, p); x.setAccessible(true); return x; }
  public static void main(String[] a) throws Exception {
    Class<?> ad = Class.forName("ad"), qh = Class.forName("qh");
    Method tok = m(ad, "a", String.class), hasArgs = m(ad, "b", String.class), h = m(ad, "h", String.class), sc = m(ad, "a", Map.class), pi = m(qh, "a", String.class, int.class);
    Scanner in = new Scanner(System.in, "UTF-8");
    while (in.hasNextLine()) {
      String line = in.nextLine();
      int tab = line.indexOf('\t');
      String kind = line.substring(0, tab), arg = line.substring(tab + 1).replace("\\n", "\n");
      if (arg.equals("\\0")) arg = null;
      if (kind.equals("token")) System.out.println("{\"case\":\"token\",\"in\":" + q(arg) + ",\"isAll\":" + tok.invoke(null, arg) + ",\"matches\":" + hasArgs.invoke(null, arg) + "}");
      else if (kind.equals("defaults")) {
        StringBuilder b = new StringBuilder("{\"case\":\"defaults\",\"token\":" + q(arg));
        for (String n : new String[]{"c", "d", "e", "f", "g"}) b.append(",\"").append(n).append("\":").append(m(ad, n, String.class).invoke(null, arg));
        System.out.println(b + "}");
      } else if (kind.equals("args")) {
        Map<?, ?> r = (Map<?, ?>) h.invoke(null, arg);
        StringBuilder b = new StringBuilder("{\"case\":\"args\",\"in\":" + q(arg) + ",\"map\":{");
        boolean f = true;
        for (Object k : new TreeSet<Object>(r.keySet())) { if (!f) b.append(','); f = false; b.append(q((String) k)).append(':').append(q((String) r.get(k))); }
        b.append("},\"scores\":{");
        Map<?, ?> s = (Map<?, ?>) sc.invoke(null, r);
        f = true;
        for (Object k : new TreeSet<Object>(s.keySet())) { if (!f) b.append(','); f = false; b.append(q((String) k)).append(':').append(s.get(k)); }
        System.out.println(b + "}}");
      } else if (kind.equals("int")) {
        int tab2 = arg.indexOf('\t');
        String v = arg.substring(0, tab2); int d = Integer.parseInt(arg.substring(tab2 + 1));
        System.out.println("{\"case\":\"int\",\"in\":" + q(v) + ",\"default\":" + d + ",\"out\":" + pi.invoke(null, v, d) + "}");
      }
    }
  }
}
