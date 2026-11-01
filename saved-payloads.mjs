import {decisionFields} from './petition-budget.mjs';
// Approved outcomes are snapshots. Loading validates them without proposing them again.
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw Error('存档'+label+'无效。');return v;};
export function storedNumbers(v,keys,{min=-10000,max=10000}={}){
 if(!object(v)||Object.entries(v).some(([k,n])=>!keys.includes(k)||!Number.isFinite(n)||n<min||n>max))throw Error('存档已批准数值无效。');
 return {...v};
}
const stats=['money','grain','stability','army','legitimacy','corruption','tech','navy','frontier','influence'];
export function storedProject(p,fallback={}){
 const out={...decisionFields(p)};
 for(const [key,keys]of [['effects',stats],['regional',['unrest','drought','prosperity']]])if(p[key]!==undefined||fallback[key]!==undefined)out[key]=storedNumbers(p[key]??fallback[key],keys);
 if(p.months!==undefined){if(p.months!==p.total)throw Error('存档工程总工期不一致。');out.months=p.months;}
 if(p.reform!==undefined){if(typeof p.reform!=='boolean')throw Error('存档改革标记无效。');out.reform=p.reform;}
 if(p.factions!==undefined)out.factions=storedNumbers(p.factions,['gentry','scholar','army','merchant']);if(p.burden!==undefined){if(!Number.isFinite(p.burden)||Math.abs(p.burden)>100)throw Error('批复负担变化无效。');out.burden=p.burden;}if(p.ongoingMonthlyNeed!==undefined){if(['money','grain'].some(k=>!Number.isFinite(p.ongoingMonthlyNeed[k])||p.ongoingMonthlyNeed[k]<0||p.ongoingMonthlyNeed[k]>1000))throw Error('持续月拨需求无效。');out.ongoingMonthlyNeed={...p.ongoingMonthlyNeed};}return out;
}
export function storedEvent(e){
 if(!object(e)||typeof e.id!=='string'||!/^[\w-]{1,90}$/.test(e.id)||!Array.isArray(e.options)||e.options.length<2||e.options.length>6)throw Error('存档待批奏报无效。');
 const out={id:e.id};
 for(const [key,max]of [['title',200],['text',4000],['category',100],['historical',150]])out[key]=text(e[key],max,'奏报正文');
 if(e.domain!==undefined)out.domain=text(e.domain,40,'奏报方向');
 out.options=e.options.map(o=>{
  if(!object(o))throw Error('存档奏报选项无效。');const r={label:text(o.label,300,'奏报选项')};
  for(const [key,keys,min]of [['cost',['money','grain'],0],['effects',stats,-10000],['regional',['unrest','drought','prosperity'],-10000],['factions',['gentry','scholar','army','merchant'],-10000]])if(o[key]!==undefined)r[key]=storedNumbers(o[key],keys,{min});
  for(const key of ['target','region'])if(o[key]!==undefined)r[key]=o[key]===null?null:text(o[key],90,'奏报地区');
  if(o.knowledge!==undefined){if(!Number.isFinite(o.knowledge)||o.knowledge<0||o.knowledge>100)throw Error('存档奏报积累无效。');r.knowledge=o.knowledge;}
  if(o.burden!==undefined){if(!Number.isFinite(o.burden)||Math.abs(o.burden)>100)throw Error('存档奏报案牍负担无效。');r.burden=o.burden;}
  return r;
 });return out;
}
export function storedPresentation(raw,s,meta){
 const strings=(v,max,label)=>{if(!Array.isArray(v)||v.length>max)throw Error('存档'+label+'无效。');return v.map(x=>text(x,10000,label));};
 s.resolvedEvents=strings(raw.resolvedEvents||[],20000,'已批奏报');s.notices=strings(raw.notices||[],1000,'月报提示');
 const results=raw.monthlyResults||[];if(!Array.isArray(results)||results.length>Object.keys(meta).length||new Set(results.map(x=>x.key)).size!==results.length)throw Error('存档月报无效。');
 s.monthlyResults=results.map(r=>{if(!Object.hasOwn(meta,r.key)||!Number.isFinite(r.value))throw Error('存档月报变动无效。');return {key:r.key,value:r.value};});
 s.ended=raw.ended?{title:text(raw.ended.title||'本局已结束',200,'结局'),text:text(raw.ended.text||'此存档记录了一次失守的结局。',4000,'结局原因')}:null;
}
