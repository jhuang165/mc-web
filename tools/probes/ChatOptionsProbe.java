// Replays the pure GuiNewChat (bcc) and EnumChatFormatting (a) functions of the unchanged 1.7.10 JAR: the chat width (bcc.a(float))
// and height (bcc.b(float)) conversions, getTextWithoutFormattingCodes (a.a(String)) and the EnumChatVisibility (zb) table.
// One JSON object per line; tools/verify-chat-options.mjs adds the bytecode-read constants and writes chat-options-reference.json.
public class ChatOptionsProbe {
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("§", "\\u00a7") + "\""; }
  public static void main(String[] args) throws Exception {
    float[] values = {0f, 0.1f, 0.25f, 0.44366196f, 0.5f, 0.75f, 0.9f, 1f};
    for (float v : values)
      System.out.println("{\"case\":\"size\",\"value\":" + v + ",\"width\":" + bcc.a(v) + ",\"height\":" + bcc.b(v) + "}");
    String[] samples = {"plain", "§aGreen §lbold§r reset", "§kobf§Z§", "A§Fb§fc§Rd§oe§Kg§nh§px", "§§a"};
    for (String s : samples)
      System.out.println("{\"case\":\"strip\",\"input\":" + q(s) + ",\"output\":" + q(a.a(s)) + "}");
    for (zb z : zb.values())
      System.out.println("{\"case\":\"visibility\",\"ordinal\":" + z.ordinal() + ",\"name\":" + q(z.name()) + ",\"key\":" + q(z.b()) + ",\"id\":" + z.a() + "}");
  }
}
