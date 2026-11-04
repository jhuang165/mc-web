// Material.isReplaceable (awt.j) of every registered Block of Minecraft Java 1.7.10, read from the unchanged original classes
// after Block.registerBlocks (aji.p). World.canPlaceEntityOnSide (ItemBlock.onItemUse's last gate) requires the target cell's
// material to be replaceable, so placing into a cell that already holds a non-replaceable block fails and keeps the item.
public class ReplaceableProbe {
  public static void main(String[] args) throws Exception {
    aji.p();
    for (int id = 0; id < 4096; id++) {
      aji b = aji.e(id);
      if (b == null || (id != 0 && aji.b(b) != id)) continue;
      System.out.println("{\"id\":" + id + ",\"blockClass\":\"" + b.getClass().getName() + "\",\"replaceable\":" + b.o().j() + "}");
    }
  }
}
