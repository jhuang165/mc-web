// Batch 79 catalogue79: executes the unchanged 1.7.10 Item.getItemFromBlock for every block id 1..175.
// Prints one JSON line: the ids whose ItemBlock is null, and class + item id for the technical ids the item catalogue listed as "no item form".
public class ItemForm79Probe {
  public static void main(String[] a) throws Exception {
    aji.p(); adb.l();
    StringBuilder none = new StringBuilder();
    for (int id = 1; id < 176; id++) if (adb.a(aji.e(id)) == null) none.append(none.length() > 0 ? "," : "").append(id);
    StringBuilder rows = new StringBuilder();
    int[] ids = {8,9,10,11,43,51,52,60,62,90,99,100,119,122,125,127,137,141,142};
    for (int id : ids) {
      adb it = adb.a(aji.e(id));
      rows.append(rows.length() > 0 ? "," : "").append("{\"block\":").append(id).append(",\"item\":")
        .append(it == null ? "null" : "{\"class\":\"" + it.getClass().getName() + "\",\"id\":" + adb.b(it) + "}").append("}");
    }
    System.out.println("{\"target\":\"Minecraft Java 1.7.10\",\"probe\":\"tools/probes/ItemForm79Probe.java\",\"nullItemBlocks\":[" + none + "],\"technical\":[" + rows + "]}");
  }
}
