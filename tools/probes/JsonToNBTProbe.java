import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.TreeSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

// Runs the unchanged 1.7.10 JsonToNBT.func_150315_a (eb.a) over a corpus, one hex-encoded UTF-8 string per line of
// the file named by args[0]. Prints one JSON line per input: {"tag": canonical} for a parsed tag, {"error": message}
// for an NBTException (ea), {"throw": class + message} for any other exception, or {"hang": true} when the parse
// does not return within the time limit (the list loop never advances past an empty element).
public final class JsonToNBTProbe {
  public static void main(String[] args) throws Exception {
    BufferedReader in = new BufferedReader(new InputStreamReader(new FileInputStream(args[0]), StandardCharsets.UTF_8));
    ExecutorService pool = Executors.newCachedThreadPool(r -> { Thread t = new Thread(r); t.setDaemon(true); return t; });
    String line;
    while ((line = in.readLine()) != null) {
      if (line.isEmpty()) continue;
      final String input = new String(hex(line), StandardCharsets.UTF_8);
      Future<String> f = pool.submit(() -> {
        try {
          return "{\"tag\":" + canon(eb.a(input)) + "}";
        } catch (ea e) {
          return "{\"error\":" + str(e.getMessage()) + "}";
        } catch (Throwable t) {
          return "{\"throw\":" + str(t.getClass().getName() + ": " + t.getMessage()) + "}";
        }
      });
      String out;
      try { out = f.get(2, TimeUnit.SECONDS); } catch (TimeoutException e) { f.cancel(true); out = "{\"hang\":true}"; }
      System.out.println(out);
    }
    System.out.flush();
    System.exit(0);
  }

  static byte[] hex(String s) {
    byte[] b = new byte[s.length() / 2];
    for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
    return b;
  }

  static String canon(dy tag) throws Exception {
    int t = tag.a();
    StringBuilder sb = new StringBuilder("{\"t\":").append(t).append(",\"v\":");
    switch (t) {
      case 1: sb.append(((dz) tag).f()); break;
      case 2: sb.append(((dz) tag).e()); break;
      case 3: sb.append(((dz) tag).d()); break;
      case 4: sb.append(str(Long.toString(((dz) tag).c()))); break;
      case 5: sb.append(Float.floatToRawIntBits(((dz) tag).h())); break;
      case 6: sb.append(str(Long.toString(Double.doubleToRawLongBits(((dz) tag).g())))); break;
      case 7: { byte[] a = ((df) tag).c(); sb.append('['); for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]); sb.append(']'); break; }
      case 8: sb.append(str(((dx) tag).a_())); break;
      case 9: {
        Field items = dq.class.getDeclaredField("b"), type = dq.class.getDeclaredField("c");
        items.setAccessible(true); type.setAccessible(true);
        List<?> list = (List<?>) items.get(tag);
        sb.append('[');
        for (int i = 0; i < list.size(); i++) sb.append(i > 0 ? "," : "").append(canon((dy) list.get(i)));
        sb.append("],\"e\":").append(type.getByte(tag));
        break;
      }
      case 10: {
        dh c = (dh) tag;
        sb.append('{');
        boolean first = true;
        for (Object k : new TreeSet<Object>(c.c())) {
          sb.append(first ? "" : ",").append(str((String) k)).append(':').append(canon(c.a((String) k)));
          first = false;
        }
        sb.append('}');
        break;
      }
      case 11: { int[] a = ((dn) tag).c(); sb.append('['); for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]); sb.append(']'); break; }
      default: throw new IllegalStateException("tag type " + t);
    }
    return sb.append('}').toString();
  }

  static String str(String s) {
    if (s == null) return "null";
    StringBuilder sb = new StringBuilder("\"");
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c == '"' || c == '\\') sb.append('\\').append(c);
      else if (c < 0x20 || c > 0x7e) sb.append(String.format("\\u%04x", (int) c));
      else sb.append(c);
    }
    return sb.append('"').toString();
  }
}
