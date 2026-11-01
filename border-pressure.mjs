import {equipmentCatalog,unitStatus,unitCapability} from './equipment.mjs';
import {unitMaintenance} from './operational-rules.mjs';
import {REGIONS} from './campaigns.mjs';
const round=v=>Math.round(v*1000)/1000;
export function borderForecast(s,efficiency=()=>0,paid=()=>true){
 const items=[],catalog=equipmentCatalog(s),weights={liaodong:1,capital:.55,shanxi:.65,shandong:.35};
 const add=(name,value)=>{if(Math.abs(value)>.00001)items.push({name,value:round(value)});};
 const nearby=REGIONS.filter(r=>['jin','mongol'].includes(r.owner)),baseline=nearby.reduce((n,r)=>n+r.base,0),remaining=nearby.reduce((n,r)=>n+(s.campaignState.control[r.id]==='ming'?0:s.campaignState.enemies.find(e=>e.region===r.id)?.strength??r.base),0),enemyRatio=baseline?Math.max(0,Math.min(1.5,remaining/baseline)):1;
 add('边外动员与时代压力',(2.2+Math.max(0,s.year-1628)*.1)*enemyRatio);add('全国军备基础威慑',-Math.max(0,s.army-(s.militaryState.appliedBonus||0))/60*(s.militaryState.units.some(u=>unitStatus(s,u).readiness>0)?1:0)*(paid('base:military')&&paid('base:grain')?1:.2));
 for(const u of s.militaryState.units){const w=weights[u.region]||0;if(!w||!paid('base:military')||!paid('base:grain'))continue;
  const maintenance=unitMaintenance(u);if((maintenance.money||maintenance.grain)&&!paid('unit:'+u.id))continue;const c=unitCapability(s,{...u,supplied:1}),ready=c.readiness;add(u.name+'实装、训练与驻防',-Math.min(3,c.defense*.09)*ready*c.training*w);
  if(u.commander&&paid('pay:commander:'+u.id))add(u.name+'统帅指挥',-.8*efficiency(u.commander)*ready*w);
 }
 const war=s.government.officeLeaders.war;if(war&&paid('pay:office:war'))add('兵部主官边防统筹',-.35*efficiency(war));
 const gov=s.provinces.find(p=>p.id==='liaodong')?.governor;if(gov&&paid('pay:governor:liaodong'))add('辽东地方军政配合',-.25*efficiency(gov));
 return {items,net:round(items.reduce((n,i)=>n+i.value,0)),note:'装备只计实际配属前线部队的数量；库存、内地驻军和未落实任命不计前线威慑。欠饷断粮会失去驻防加成。'};
}
