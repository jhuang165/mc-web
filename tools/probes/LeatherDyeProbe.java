import java.lang.reflect.*;
import java.util.*;
import sun.misc.Unsafe;

/** Runs unchanged RecipeArmorDyes / ItemArmor / ItemStack on representative ItemDye grids. */
public final class LeatherDyeProbe {
  static Class<?> invType, stackType, itemType, compoundType, worldType;
  static Class<?> armorType;
  static Object recipe;
  static Method matches, result, itemById, getTag, getCompound, getInt;
  static Unsafe unsafe;
  static Object armor(int id, int damage, Integer color) throws Exception {
    Object item = itemById.invoke(null, id);
    Object stack = stackType.getConstructor(itemType, int.class, int.class).newInstance(item, 1, damage);
    if (color != null) {
      Method setColor = method(armorType, void.class, stackType, int.class);
      setColor.invoke(item, stack, color.intValue());
    }
    return stack;
  }
  static Object dye(int damage) throws Exception { return stackType.getConstructor(itemType, int.class, int.class).newInstance(itemById.invoke(null, 351), 1, damage); }
  static Method method(Class<?> type, Class<?> returns, Class<?>... args) {
    for (Method m : type.getDeclaredMethods()) if (m.getReturnType() == returns && Arrays.equals(m.getParameterTypes(), args)) { m.setAccessible(true); return m; }
    throw new IllegalStateException("method not found: " + type + " " + returns + Arrays.toString(args));
  }
  static Object output(Object[][] values) throws Exception {
    Object container = unsafe.allocateInstance(Class.forName(System.getProperty("mc.containerImpl")));
    Object grid = invType.getConstructor(Class.forName(System.getProperty("mc.container")), int.class, int.class).newInstance(container, 3, 3);
    Object[] gridStacks = null;
    Field stackArray = null;
    for (Field f : invType.getDeclaredFields()) if (f.getType().isArray() && f.getType().getComponentType() == stackType) { f.setAccessible(true); stackArray = f; break; }
    if (stackArray == null) throw new IllegalStateException("InventoryCrafting stack array missing");
    gridStacks = (Object[])stackArray.get(grid);
    for (int i = 0; i < values.length; i++) if (values[i] != null) {
      Object stack = values[i][0].equals("armor") ? armor((Integer)values[i][1], 0, (Integer)values[i][2])
        : values[i][0].equals("dye") ? dye((Integer)values[i][1])
        : stackType.getConstructor(itemType, int.class, int.class).newInstance(itemById.invoke(null, (Integer)values[i][1]), 1, 0);
      gridStacks[i] = stack;
    }
    boolean matched = (Boolean)matches.invoke(recipe, grid, null);
    System.err.println("matched=" + matched + " input=" + Arrays.toString(values));
    if (!matched) return null;
    return result.invoke(recipe, grid);
  }
  static Integer color(Object stack) throws Exception {
    if (stack == null) return null;
    Object nbt = getTag.invoke(stack);
    if (nbt == null) return null;
    Object display = getCompound.invoke(nbt, "display");
    if (display == null) return null;
    return (Integer)getInt.invoke(display, "color");
  }
  static void row(String name, Object[][] input) throws Exception {
    Object out = output(input);
    StringBuilder in = new StringBuilder("[");
    for(int i=0;i<input.length;i++){
      Object[] v=input[i];if(i>0)in.append(',');String kind=(String)v[0];
      if(kind.equals("armor")){int nativeId=(Integer)v[1];in.append("{\"kind\":\"armor\",\"id\":").append(nativeId-298+400);if(v[2]!=null)in.append(",\"color\":").append(v[2]);in.append('}');}
      else if(kind.equals("dye"))in.append("{\"kind\":\"dye\",\"damage\":").append(v[1]).append('}');
      else in.append("{\"kind\":\"item\",\"id\":103}");
    }
    in.append(']');
    System.out.println("{\"kind\":\"case\",\"name\":\"" + name + "\",\"output\":" + (out != null) + ",\"color\":" + (out == null || color(out) == null ? "null" : color(out)) + ",\"input\":"+in+"}");
  }
  static int[] dyeColors(Class<?> sheepType) throws Exception {
    float[][] table = null;
    for (Field f : sheepType.getDeclaredFields()) if (Modifier.isStatic(f.getModifiers()) && f.getType() == float[][].class) { f.setAccessible(true); table = (float[][])f.get(null); break; }
    if (table == null || table.length != 16) throw new IllegalStateException("Sheep color table missing");
    int[] colors = new int[16];
    for (int damage=0;damage<16;damage++) {
      float[] rgb=table[15-damage]; int r=(int)(rgb[0]*255.0F),g=(int)(rgb[1]*255.0F),b=(int)(rgb[2]*255.0F);
      colors[damage]=(r<<16)|(g<<8)|b;
    }
    return colors;
  }
  public static void main(String[] args) throws Exception {
    System.setProperty("mc.container", args[2]);
    ClassLoader loader = LeatherDyeProbe.class.getClassLoader();
    Class<?> recipeType = Class.forName(args[0], false, loader); invType = Class.forName(args[1], false, loader);
    stackType = Class.forName(args[3], false, loader); itemType = Class.forName(args[4], false, loader); compoundType = Class.forName(args[5], false, loader); worldType = Class.forName(args[6], false, loader);
    System.setProperty("mc.containerImpl", args[8]); Class<?> items = Class.forName(args[7], false, loader); armorType = Class.forName(args[10], false, loader);
    Class<?> bootstrap = Class.forName(args[9]); Class<?> sheepType=Class.forName(args[11],false,loader);
    for (Method m : bootstrap.getDeclaredMethods()) if (Modifier.isStatic(m.getModifiers()) && m.getReturnType() == void.class && m.getParameterCount() == 0) { m.setAccessible(true); m.invoke(null); break; }
    Field uf = Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (Unsafe)uf.get(null);
    itemById = null;
    for (Method m : itemType.getDeclaredMethods()) if (Modifier.isStatic(m.getModifiers()) && m.getReturnType() == itemType && Arrays.equals(m.getParameterTypes(), new Class<?>[]{int.class})) { m.setAccessible(true); itemById = m; break; }
    if (itemById == null) throw new IllegalStateException("Item.getItemById missing");
    System.err.println("items " + itemById.invoke(null, 298) + " " + itemById.invoke(null, 351));
    matches = null; result = null;
    for (Method m : recipeType.getDeclaredMethods()) {
      if (m.getReturnType() == boolean.class && m.getParameterCount() == 2 && m.getParameterTypes()[0] == invType) { m.setAccessible(true); matches = m; }
      if (m.getReturnType() == stackType && m.getParameterCount() == 1 && m.getParameterTypes()[0] == invType) { m.setAccessible(true); result = m; }
    }
    if (matches == null || result == null) throw new IllegalStateException("RecipeArmorDyes API missing");
    recipe = recipeType.getDeclaredConstructor().newInstance();
    getTag = null;
    for (Method m : stackType.getDeclaredMethods()) if (m.getReturnType() == compoundType && m.getParameterCount() == 0) { m.setAccessible(true); getTag = m; break; }
    getCompound = method(compoundType, compoundType, String.class); getInt = method(compoundType, int.class, String.class);
    int[] dyeColors=dyeColors(sheepType);System.out.print("{\"kind\":\"dyeColors\",\"colors\":[");for(int i=0;i<16;i++)System.out.print((i==0?"":",")+dyeColors[i]);System.out.println("]}");
    for(int dye=0;dye<16;dye++) row("single-"+dye,new Object[][]{{"armor",298,null},{"dye",dye}});
    for(int first=0;first<16;first++)for(int second=0;second<16;second++)row("pair-"+first+"-"+second,new Object[][]{{"armor",299,null},{"dye",first},{"dye",second}});
    for(int base:new int[]{0,0xFFFFFF,0x123456})for(int dye=0;dye<16;dye++)row("prior-"+base+"-"+dye,new Object[][]{{"armor",300,base},{"dye",dye}});
    row("noDye",new Object[][]{{"armor",298,null}});row("invalidItem",new Object[][]{{"item",278,null},{"dye",1}});
    row("twoArmors",new Object[][]{{"armor",298,null},{"armor",299,null},{"dye",1}});row("dyeOnly",new Object[][]{{"dye",1}});
  }
}
