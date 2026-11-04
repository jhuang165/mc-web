import java.lang.reflect.*;
import java.util.*;

// Executes the unchanged EntityVillager initial recipe generator (yv.t(int)) for every 1.7.10
// profession. Collections.shuffle uses a separate JDK singleton Random; the probe resets that
// singleton per case only to make its otherwise nondeterministic order reproducible.
public class VillagerOffersProbe {
  static Field shuffleField() throws Exception {
    Field f=Collections.class.getDeclaredField("r");f.setAccessible(true);return f;
  }
  static VillagerProbe.World world() throws Exception {
    sun.misc.Unsafe u=MobMoveProbe.unsafe();
    VillagerProbe.World w=(VillagerProbe.World)u.allocateInstance(VillagerProbe.World.class);
    MobMoveProbe.set(w,"s",new Random(2));MobMoveProbe.set(w,"C",new qi());
    for(Field f:ahb.class.getDeclaredFields())if(f.getType()==List.class&&!Modifier.isStatic(f.getModifiers())){f.setAccessible(true);f.set(w,new ArrayList());}
    MobMoveProbe.set(w,"t",u.allocateInstance(aqq.class));MobMoveProbe.set(w,"A",new wc(w));
    return w;
  }
  static String stack(add s) {
    if(s==null)return "null";
    StringBuilder b=new StringBuilder("{\"id\":").append(adb.b(s.b())).append(",\"count\":").append(s.b).append(",\"damage\":").append(s.c).append(",\"enchantments\":[");
    boolean first=true;for(int id=0;id<256;id++){int level=afv.a(id,s);if(level>0){if(!first)b.append(',');b.append("{\"id\":").append(id).append(",\"lvl\":").append(level).append('}');first=false;}}
    b.append(']');
    dh tag=s.q();
    if(tag!=null&&tag.b("StoredEnchantments",9)){
      dq stored=tag.c("StoredEnchantments",10);b.append(",\"storedEnchantments\":[");
      for(int i=0;i<stored.c();i++){if(i>0)b.append(',');dh e=stored.b(i);b.append("{\"id\":").append(e.e("id")).append(",\"lvl\":").append(e.e("lvl")).append('}');}
      b.append(']');
    }
    return b.append('}').toString();
  }
  static String offer(agn r)throws Exception{
    Field uses=agn.class.getDeclaredField("d"),max=agn.class.getDeclaredField("e");uses.setAccessible(true);max.setAccessible(true);
    return "{\"buy\":"+stack(r.a())+",\"buyB\":"+stack(r.b())+",\"sell\":"+stack(r.d())+",\"uses\":"+uses.getInt(r)+",\"maxUses\":"+max.getInt(r)+"}";
  }
  static void run(int profession,long seed,long shuffleSeed,int limit,Field shuffle)throws Exception{
    VillagerProbe.reset();VillagerProbe.World w=world();yv v=new yv(w,profession);
    MobMoveProbe.set(v,"Z",new Random(seed));Random sh=(Random)shuffle.get(null);if(sh==null){sh=new Random(shuffleSeed);shuffle.set(null,sh);}else sh.setSeed(shuffleSeed);
    Method generate=yv.class.getDeclaredMethod("t",int.class);generate.setAccessible(true);generate.invoke(v,limit);
    Field offersField=yv.class.getDeclaredField("bu");offersField.setAccessible(true);ago offers=(ago)offersField.get(v);
    StringBuilder out=new StringBuilder("{\"profession\":").append(profession).append(",\"seed\":").append(seed).append(",\"shuffleSeed\":").append(shuffleSeed).append(",\"limit\":").append(limit).append(",\"offers\":[");
    for(int i=0;i<offers.size();i++){if(i>0)out.append(',');out.append(offer((agn)offers.get(i)));}
    Random entityRandom=(Random)MobMoveProbe.field(v.getClass(),"Z").get(v);
    out.append("],\"nextEntityInt\":").append(entityRandom.nextInt()).append(",\"nextShuffleInt\":").append(((Random)shuffle.get(null)).nextInt()).append('}');
    System.out.println(out);
  }
  static String fieldIds(Class<?> c)throws Exception{StringBuilder b=new StringBuilder("{");boolean first=true;for(Field f:c.getDeclaredFields()){if(!Modifier.isStatic(f.getModifiers()))continue;f.setAccessible(true);Object value=f.get(null);Integer id=null;if(value instanceof adb)id=adb.b((adb)value);else if(value instanceof aji){adb item=adb.a((aji)value);if(item!=null)id=adb.b(item);}if(id!=null){if(!first)b.append(',');first=false;b.append('\"').append(f.getName()).append("\":").append(id);}}return b.append('}').toString();}
  static String intMap(Map<adb,qu> map){StringBuilder b=new StringBuilder("{");boolean first=true;for(Map.Entry<adb,qu> e:map.entrySet()){if(!first)b.append(',');first=false;b.append('"').append(adb.b(e.getKey())).append("\":[").append(e.getValue().a()).append(',').append(e.getValue().b()).append(']');}return b.append('}').toString();}
  public static void main(String[] args)throws Exception{
    aji.p();adb.l();VillagerProbe.World w=world();new yv(w,0);Field shuffle=shuffleField();
    Field buy=yv.class.getDeclaredField("bB"),sell=yv.class.getDeclaredField("bC");buy.setAccessible(true);sell.setAccessible(true);
    System.out.println("{\"kind\":\"quantityMaps\",\"buy\":"+intMap((Map<adb,qu>)buy.get(null))+",\"sell\":"+intMap((Map<adb,qu>)sell.get(null))+",\"itemFields\":"+fieldIds(ade.class)+",\"blockFields\":"+fieldIds(ajn.class)+"}");
    long[] seeds=new long[40];for(int i=0;i<seeds.length;i++)seeds[i]=i;
    for(int profession=0;profession<5;profession++)for(long seed:seeds){long sh=1234567L+seed*7919L+profession*104729L;run(profession,seed,sh,999,shuffle);run(profession,seed,sh,1,shuffle);}
  }
}
