import * as g from '../engine.mjs';
import {appendDiscussion} from '../dialogues.mjs';
export const secretName='蓟镇边外密营',guard={id:'office:guards',name:'锦衣卫'},council={id:'council',name:'御前议政'};
export function privacyGame({known=true,contaminated=true}={}){
 let s=g.createGame({seed:137});s=g.intervene(s,{type:'horizon',operation:'mode',enabled:true});s=g.intervene(s,{type:'arsenal',operation:'create_unit',name:secretName,region:'liaodong',needs:{infantry:30},secret:true,institution:'office:guards',funding:'portal'});const id=s.militaryState.units.at(-1).id;s=g.intervene(s,{type:'arsenal',operation:'equip',unit:id,equipment:'rifle',quantity:30,source:'portal'});s=g.intervene(s,{type:'war',operation:'commander',unit:id,official:'civil-head-guards'});
 if(known)s=g.intervene(s,{type:'horizon',operation:'confide',institution:'office:guards'});s=g.advance({...s,event:null});s.traveler.energy=137;
 if(contaminated)appendDiscussion(s,council,'请据普通军情献策','蓟镇边外密营有现代制式步枪三十支，虫洞能量137，粮弹由门中出。',[],{status:'discussed',text:'仅商议'},'ai',g.dateLabel(s));return s;
}
