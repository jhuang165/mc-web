import java.lang.reflect.*;
import java.util.*;
import java.lang.reflect.Proxy;
import sun.misc.Unsafe;

// Executes the unchanged 1.7.10 BlockAnvil, BlockFalling and EntityFallingBlock.
// The world is a small World/BlockAccess double; falling damage is tested through
// EntityFallingBlock.fall(float), not reimplemented in this probe.
public final class FallingBlock77Probe {
  static class WorldStub extends ahb {
    int metadata; aji block; List<sa> damageTargets=Collections.emptyList();
    WorldStub(aji b,int m){super((azc)null,null,(aqo)null,(ahj)null,null);block=b;metadata=m;}
    protected apu j(){return null;} protected int p(){return 0;}
    public sa a(int id){return null;}
    public aji a(int x,int y,int z){return block;}
    public int e(int x,int y,int z){return metadata;}
    public boolean f(int x,int y,int z){block=aji.e(0);return true;}
    public boolean a(int x,int y,int z,int meta,int flags){metadata=meta;return true;}
    public List a(sa self,azt bounds){return damageTargets;}
    public List b(sa self,azt bounds){return damageTargets;}
  }
  static Object access(int meta){
    return Proxy.newProxyInstance(ahl.class.getClassLoader(),new Class[]{ahl.class},(p,m,a)->{
      if(m.getName().equals("e")&&m.getReturnType()==int.class)return meta;
      if(m.getReturnType()==boolean.class)return false;
      if(m.getReturnType()==int.class)return 0;
      if(m.getReturnType()==float.class)return 0F;
      if(m.getReturnType()==double.class)return 0D;
      return null;
    });
  }
  static Field field(Class<?> type,String name)throws Exception{for(Class<?> c=type;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}catch(NoSuchFieldException ignored){}throw new NoSuchFieldException(name);}
  static Unsafe unsafe()throws Exception{Field f=Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return (Unsafe)f.get(null);}
  static WorldStub world(aji block,int meta)throws Exception{WorldStub w=(WorldStub)unsafe().allocateInstance(WorldStub.class);w.block=block;w.metadata=meta;w.damageTargets=Collections.emptyList();return w;}
  static String row(String s){return "{\"kind\":\""+s+"\"}";}
  static String box(aji b,int meta)throws Exception{
    b.a((ahl)access(meta),0,0,0);
    return "["+field(aji.class,"B").getDouble(b)+","+field(aji.class,"C").getDouble(b)+","+field(aji.class,"D").getDouble(b)+","+field(aji.class,"E").getDouble(b)+","+field(aji.class,"F").getDouble(b)+","+field(aji.class,"G").getDouble(b)+"]";
  }
  static String quote(String s){return "\""+s.replace("\\","\\\\").replace("\"","\\\"")+"\"";}
  public static void main(String[]args)throws Exception{
    aji.p();adb.l();
    ajb anvil=(ajb)aji.e(145);
    // damageDropped(meta) and the block's own item for every registered original block, meta 0..255 (Block.damageDropped takes the whole int).
    for(int id=0;id<176;id++){
      aji b=aji.e(id); if(b==null||id==0)continue;
      adb it=adb.a(b);
      StringBuilder o=new StringBuilder("{\"kind\":\"drop\",\"id\":"+id+",\"item\":"+(it==null?-1:adb.b(it))+",\"damage\":[");
      for(int m=0;m<256;m++){if(m>0)o.append(',');o.append(b.a(m));}
      System.out.println(o.append("]}"));
    }
    // EntityFallingBlock.fall(float) with whole Data bytes and HurtEntities set or not.
    for(int meta:new int[]{0,3,4,7,8,11,15,16,17,20,31,64,255})for(boolean hurt:new boolean[]{true,false})for(int blocks:new int[]{0,1,2,3,8,20})for(int seed=0;seed<20;seed++){
      WorldStub w=world(anvil,meta);xj e=(xj)unsafe().allocateInstance(xj.class);
      field(sa.class,"o").set(e,w);field(xj.class,"e").set(e,anvil);e.a=meta;e.c=true;
      field(xj.class,"h").setInt(e,40);field(xj.class,"i").setFloat(e,2F);e.a(hurt);
      field(sa.class,"Z").set(e,new Random(seed));
      Method fall=xj.class.getDeclaredMethod("b",float.class);fall.setAccessible(true);fall.invoke(e,(float)blocks);
      System.out.println("{\"kind\":\"fall\",\"meta\":"+meta+",\"hurt\":"+hurt+",\"distance\":"+blocks+",\"seed\":"+seed+",\"resultMeta\":"+e.a+",\"broken\":"+field(xj.class,"f").getBoolean(e)+",\"dropDamage\":"+anvil.a(e.a)+"}");
    }
  }
}
