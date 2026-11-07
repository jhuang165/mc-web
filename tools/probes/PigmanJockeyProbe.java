import java.util.*;

// Native EntityPigZombie.onSpawnWithEgg (yh.a(sy) = EntityZombie.a(sy) then setVillager(false)) on the PortalWartProbe world double, run
// through many spawns: the child flag (yq.f()), the villager flag (yq.cb()), the entities each spawn adds (the chicken jockey's chicken is
// spawned inside onSpawnWithEgg, before the caller adds the pigman) and the world Random's state afterwards.
public class PigmanJockeyProbe {
  static String q(String s){return TerrainProbe.q(s);}
  public static void main(String[] args)throws Exception{
    java.lang.reflect.Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();akx.M=true;
    StringBuilder out=new StringBuilder();int[] diffs={0,1,2,3};
    for(int diff:diffs){
      long seed=7000L+diff;int n=20000;
      PortalWartProbe.P w=PortalWartProbe.world(seed,diff);
      StringBuilder events=new StringBuilder();int children=0,villagers=0,chickens=0,jockeyPairs=0;
      for(int i=0;i<n;i++){
        yh p=new yh(w);p.b(0.5,12.1,0.5);
        int before=w.spawned.length();
        p.a((sy)null);
        boolean child=p.f(),villager=p.cb();
        boolean chick=w.spawned.length()!=before;
        if(child)children++;if(villager)villagers++;if(chick)chickens++;
        boolean rides=p.m!=null;if(rides)jockeyPairs++;
        if(child||villager||chick){if(events.length()>0)events.append(',');events.append("["+i+","+child+","+villager+","+chick+","+rides+"]");}
        w.spawned=new StringBuilder();
      }
      long next=((Random)TerrainProbe.field(ahb.class,"s").get(w)).nextLong();
      if(out.length()>0)out.append(',');
      out.append("{\"difficulty\":"+diff+",\"worldRand\":"+q(""+seed)+",\"spawns\":"+n+",\"children\":"+children+",\"villagers\":"+villagers+",\"chickens\":"+chickens+",\"mounted\":"+jockeyPairs+",\"events\":["+events+"],\"nextLong\":"+q(""+next)+"}");
    }
    System.out.println("{\"kind\":\"pigmanJockey\",\"runs\":["+out+"]}");
  }
}
