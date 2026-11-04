import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectLocalPlayer} from './command-selector.js';
const host={name:'@',playerName:'Player',position:()=>({x:0,y:60,z:0}),playerPosition:()=>({x:3,y:60,z:4}),playerMode:()=>1,playerLevel:()=>5};
test('legacy selectors select the local player relative to the command sender, respecting radius, name, mode and level',()=>{
  for(const s of ['@p','@a','@r','@p[r=5]','@p[name=Player,m=1,lm=5,l=5]','@p[3,60,4,0]'])assert.equal(selectLocalPlayer(s,host),'Player',s);
  for(const s of ['@e','@p[r=4]','@p[rm=6]','@p[name=!Player]','@p[m=0]','@p[l=4]','@a[score_points=1]'])assert.equal(selectLocalPlayer(s,host),null,s);
});
