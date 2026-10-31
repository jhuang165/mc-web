// Prints each 1.7.10 creative tab's item list from the unchanged classes:
// CreativeTabs (abt).displayAllReleventItems and the search tab's
// GuiContainerCreative.updateCreativeSearch source list (items with a tab,
// then ItemEnchantedBook.func_92113_a for every enchantment type).
import java.util.*;

public class CreativeProbe {
  static String stacks(List<add> list) {
    StringBuilder b = new StringBuilder("[");
    for (add s : list) {
      if (b.length() > 1) b.append(',');
      b.append('[').append(adb.b(s.b())).append(',').append(s.k()).append(',').append(s.b).append(']');
    }
    return b.append(']').toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    // Some getSubItems size their lists from icon arrays filled by
    // registerBlockIcons/registerIcons; run those with a register that
    // returns null icons, without loading textures.
    rg register = (rg) java.lang.reflect.Proxy.newProxyInstance(rg.class.getClassLoader(), new Class<?>[] { rg.class }, (proxy, m, a) -> null);
    for (Object o : aji.c) try { ((aji) o).a(register); } catch (Throwable t) {}
    for (Object o : adb.e) try { ((adb) o).a(register); } catch (Throwable t) {}
    for (abt tab : abt.a) {
      if (tab == null) continue;
      List<add> list = new ArrayList<>();
      if (tab == abt.g) {
        for (Object o : adb.e) {
          adb item = (adb) o;
          if (item != null && item.n_() != null) item.a(item, null, list);
        }
        for (aft e : aft.b) if (e != null && e.C != null) ade.bR.a(e, list);
      } else tab.a(list);
      System.out.println("{\"index\":" + tab.a() + ",\"label\":\"" + tab.b() + "\",\"background\":\"" + tab.g()
        + "\",\"column\":" + tab.l() + ",\"topRow\":" + tab.m() + ",\"scrollbar\":" + tab.j() + ",\"title\":" + tab.h()
        + ",\"icon\":[" + adb.b(tab.d().b()) + "," + tab.d().k() + "],\"items\":" + stacks(list) + "}");
    }
  }
}
