import java.lang.reflect.*;
import java.util.*;

/** Runs unchanged BlockCauldron.onBlockActivated with native dyed leather and cauldron water levels. */
public final class CauldronWashProbe {
  static Method method(Class<?> type, Class<?> returns, Class<?>... args) {
    for (Class<?> c=type;c!=null;c=c.getSuperclass()) for(Method m:c.getDeclaredMethods())
      if(m.getReturnType()==returns && Arrays.equals(m.getParameterTypes(),args)){m.setAccessible(true);return m;}
    throw new IllegalStateException("method missing "+type+" "+returns+Arrays.toString(args));
  }
  static int rgb(Object stack)throws Exception{
    Object item=method(add.class,adb.class).invoke(stack);
    Method has=method(abb.class,boolean.class,add.class),get=method(abb.class,int.class,add.class);
    return (Boolean)has.invoke(item,stack)?(Integer)get.invoke(item,stack):-1;
  }
  static void row(int nativeArmor,int liveArmor,Integer color,int level,boolean creative)throws Exception{
    StoneUtilityProbe.W world=StoneUtilityProbe.world(); world.put(0,64,0,118,level);
    mw player=StoneUtilityProbe.player(0,creative); adb armor=adb.d(nativeArmor); add stack=new add(armor,1,0);
    if(color!=null)method(abb.class,void.class,add.class,int.class).invoke(armor,stack,color.intValue());
    player.bm.a[player.bm.c]=stack;
    aji cauldron=aji.e(118); boolean handled=method(aji.class,boolean.class,ahb.class,int.class,int.class,int.class,yz.class,int.class,float.class,float.class,float.class)
      .invoke(cauldron,world,0,64,0,player,1,.5F,.5F,.5F) instanceof Boolean b && b;
    System.out.println("{\"kind\":\"wash\",\"armor\":"+liveArmor+",\"prior\":"+(color==null?"null":color)+",\"level\":"+level+",\"creative\":"+creative+",\"handled\":"+handled+",\"newLevel\":"+world.e(0,64,0)+",\"color\":"+(rgb(stack)<0?"null":rgb(stack))+",\"count\":"+stack.b+",\"writes\":"+StoneUtilityProbe.list(world.writes)+"}");
  }
  public static void main(String[] args)throws Exception{
    StoneUtilityProbe.U=StoneUtilityProbe.unsafe(); aji.p(); adb.l();
    Integer[] colors={null,0,0x123456,0xA06540}; int[] original={298,299,300,301};
    for(int i=0;i<original.length;i++)for(Integer color:colors)for(int level=0;level<4;level++)for(int creative=0;creative<2;creative++)row(original[i],400+i,color,level,creative==1);
    for(int level=0;level<4;level++)for(int creative=0;creative<2;creative++){
      StoneUtilityProbe.W world=StoneUtilityProbe.world();world.put(0,64,0,118,level);mw player=StoneUtilityProbe.player(0,creative==1);add stack=new add(adb.d(278),1,0);player.bm.a[player.bm.c]=stack;
      aji cauldron=aji.e(118);boolean handled=(Boolean)method(aji.class,boolean.class,ahb.class,int.class,int.class,int.class,yz.class,int.class,float.class,float.class,float.class).invoke(cauldron,world,0,64,0,player,1,.5F,.5F,.5F);
      System.out.println("{\"kind\":\"nonLeather\",\"level\":"+level+",\"creative\":"+(creative==1)+",\"handled\":"+handled+",\"newLevel\":"+world.e(0,64,0)+",\"item\":"+adb.b(stack.b())+",\"count\":"+stack.b+"}");
    }
  }
}
