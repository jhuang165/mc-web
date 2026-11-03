import java.lang.reflect.*;
import java.util.*;
import java.lang.reflect.Proxy;
import sun.misc.Unsafe;

// Executes the unchanged 1.7.10 BlockAnvil, BlockFalling and EntityFallingBlock.
// The world is a small World/BlockAccess double; falling damage is tested through
// EntityFallingBlock.fall(float), not reimplemented in this probe.
public final class AnvilBlockProbe {
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
    aji.p();aji block=aji.e(145); if(!(block instanceof ajb))throw new AssertionError("id145 is "+block);
    ajb anvil=(ajb)block;
    StringBuilder out=new StringBuilder();
    out.append("{\"kind\":\"block\",\"id\":").append(aji.b(block))
      .append(",\"renderType\":").append(anvil.b()).append(",\"renderNormal\":").append(anvil.d())
      .append(",\"opaque\":").append(anvil.c()).append(",\"hardness\":").append(anvil.f(null,0,0,0))
      .append(",\"damageDrops\":[");
    for(int m=0;m<16;m++){if(m>0)out.append(',');out.append(anvil.a(m));}
    out.append("],\"bounds\":[");for(int m=0;m<4;m++){if(m>0)out.append(',');out.append(box(anvil,m));}
    out.append("],\"sideRendered\":[");Object a=access(0);for(int side=0;side<6;side++){if(side>0)out.append(',');out.append(anvil.a((ahl)a,0,0,0,side));}
    out.append("],\"tickRate\":").append(anvil.a(world(block,0))).append("}");System.out.println(out);

    // Native fall-distance damage/anvil stage update; controlled java.util.Random seeds.
    for(int meta:new int[]{0,1,2,3,4,8})for(int blocks:new int[]{0,1,2,3,8,20})for(int seed=0;seed<20;seed++){
      WorldStub w=world(block,meta);xj e=(xj)unsafe().allocateInstance(xj.class);
      field(sa.class,"o").set(e,w);field(xj.class,"e").set(e,block);e.a=meta;e.c=true;
      field(xj.class,"h").setInt(e,40);field(xj.class,"i").setFloat(e,2F);anvil.a(e);
      field(sa.class,"Z").set(e,new Random(seed));
      Method fall=xj.class.getDeclaredMethod("b",float.class);fall.setAccessible(true);fall.invoke(e,(float)blocks);
      out=new StringBuilder("{\"kind\":\"fall\",\"meta\":").append(meta).append(",\"distance\":").append(blocks)
        .append(",\"seed\":").append(seed).append(",\"hurtEntities\":").append(field(xj.class,"g").getBoolean(e))
        .append(",\"resultMeta\":").append(e.a).append(",\"broken\":").append(field(xj.class,"f").getBoolean(e)).append('}');
      System.out.println(out);
    }
  }
}
