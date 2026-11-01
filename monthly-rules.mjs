import {chineseNumber} from './fiscal-rules.mjs';
const domains=['agriculture','industry','finance','military','naval','governance','education','medicine'],bounds={army:1.5,frontier:1.5,stability:1,legitimacy:.5,corruption:1,tech:.8,navy:1};
const clean=(v,n=180)=>String(v??'').trim().slice(0,n),round=v=>Math.round(v*10000)/10000;
export function monthlyRequirement(m){
 const e=m?.effects||{},effectNeed=Math.max(0,...Object.entries(e).map(([k,v])=>Math.abs(v)*({army:20,frontier:5,stability:10,legitimacy:8,corruption:5,tech:5,navy:5}[k]||0)));
 const inKind=m?.money===undefined&&m?.grain>0;
 return {money:Math.max(inKind?0:effectNeed,m?.required?.money??m?.money??0,m?.money>0?1:0),grain:Math.max(inKind?effectNeed:0,m?.required?.grain??m?.grain??0)};
}
export function monthlyScale(m){if(!m||m.paused||m.remaining===0)return m?0:1;const need=monthlyRequirement(m);return Math.max(0,Math.min(1,need.money>0?(m.money||0)/need.money:1,need.grain>0?(m.grain||0)/need.grain:1));}
export const hasMonthlyLanguage=t=>/(?:每月|月拨|月给|月支|月出|按月拨|按月支|每个月)/.test(t);
export function monthlyAmount(input){
 const re=/(?:每月(?:拨付|拨款|拨银|支出|预算|经费|给|拨|出)?|月拨|月给|月支|月出|按月拨付|按月拨|按月支出)\s*(?:改为|调整为|定为|增至|减至)?\s*(?:银|白银)?\s*([零〇一二两三四五六七八九十百千万亿\d.]+)\s*(万两|两|万石|石)/g;const out={};
 for(const m of String(input).matchAll(re)){let n=chineseNumber(m[1]);if(!Number.isFinite(n))continue;if(m[2]==='两'||m[2]==='石')n/=10000;out[/石/.test(m[2])?'grain':'money']=round(n);}return out;
}
export function normalizeMonthly(raw,input='',{saved=false}={}){
 const explicit=monthlyAmount(input);if(!saved&&!hasMonthlyLanguage(input)&&!raw)return null;
 if(raw!==undefined&&raw!==null&&(typeof raw!=='object'||Array.isArray(raw)))throw Error('月度安排须列出预算和效果。');
 const r=raw||{},out={effects:{},retain:r.retain===true||/长期|常设|持续|今后每月/.test(input),paused:r.paused===true};
 if(['income','revenue','monthlyIncome'].some(k=>r[k]!==undefined)||r.effects?.money!==undefined||r.effects?.grain!==undefined)throw Error('固定月收入须有实际税源或生产机制，不能把钱粮目标当每月赠款。');
 for(const k of ['money','grain']){const v=explicit[k]??r[k];if(v!==undefined){if(!Number.isFinite(v)||v<0||v>1000)throw Error('每月钱粮须为0至1000万的实际预算。');out[k]=round(v);}}
 for(const [k,v]of Object.entries(r.effects||{})){if(!(k in bounds)||!Number.isFinite(v))continue;out.effects[k]=round(Math.max(-bounds[k],Math.min(bounds[k],v)));}
 if(!saved&&!Object.keys(out.effects).length&&out.money>0){if(/边患|边防|整兵|练兵|督训/.test(input)){out.effects={army:.25,frontier:-Math.min(1,out.money/5)};}else if(/防疫|公共卫生/.test(input))out.effects={stability:.4};}
 const remaining=/(?:连续|为期|持续)\s*([一二三四五六七八九十\d]+)\s*(?:个)?月/.exec(input)?.[1]??r.months??r.remaining;
 if(remaining!==undefined&&remaining!==null){const n=typeof remaining==='string'?chineseNumber(remaining):remaining;if(!Number.isInteger(n)||n<0||n>120)throw Error('月度安排期限无效。');out.remaining=n;}
 if(Object.keys(out.effects).length&&out.money===undefined&&out.grain===undefined)out.money=1;
 if(!Object.keys(out.effects).length&&out.money===undefined&&out.grain===undefined)return null;
 if(saved&&r.required!==undefined){if(!r.required||['money','grain'].some(k=>!Number.isFinite(r.required[k])||r.required[k]<0||r.required[k]>1000))throw Error('月拨工作需求无效。');out.required={...r.required};}
 else if(!saved)out.required=monthlyRequirement(out);
 if(out.money===0&&(out.grain??0)===0)out.paused=true;return out;
}
export function monthlyCost(entity,baseMoney=0,baseGrain=0){const m=entity.monthly;if(m?.remaining===0||m?.paused)return {money:0,grain:0};if(!m)return {money:baseMoney,grain:baseGrain};const need=monthlyRequirement(m);return {money:Math.min(m.money??0,need.money),grain:Math.min(m.grain??0,need.grain)};}
export function applyMonthly(s,entity,paid){
 const m=entity.monthly;if(!m||m.remaining===0||m.paused||!paid)return;
 const scale=monthlyScale(m);for(const [k,v]of Object.entries(m.effects))s[k]=Math.max(0,Math.min(100,s[k]+v*scale));if(m.remaining!==undefined)m.remaining--;
}
export function retainMonthly(s,entity){if(!entity.monthly?.retain||entity.monthly.remaining===0)return;s.monthlyPolicies||=[];const key=clean(entity.name||entity.title,100)+':'+(entity.target||'national');const old=s.monthlyPolicies.find(p=>p.key===key);const row={id:old?.id||'monthly-policy-'+s.turn+'-'+s.revision+'-'+s.monthlyPolicies.length,key,name:clean(entity.name||entity.title,100),domain:domains.includes(entity.domain)?entity.domain:'governance',target:entity.target||null,monthly:structuredClone(entity.monthly),funding:entity.funding||'treasury',started:s.turn+1};if(old)Object.assign(old,row);else if(s.monthlyPolicies.length<256)s.monthlyPolicies.push(row);}
export function validateMonthlyPolicies(raw,s){const a=raw.monthlyPolicies||[];if(!Array.isArray(a)||a.length>256||new Set(a.map(p=>p.id)).size!==a.length||new Set(a.map(p=>p.key)).size!==a.length)throw Error('固定月度政务列表无效。');s.monthlyPolicies=a.map(p=>{if(!/^monthly-policy-[\d-]+$/.test(p.id)||!domains.includes(p.domain)||!['treasury','portal'].includes(p.funding)||!Number.isSafeInteger(p.started)||p.started<0)throw Error('固定月度政务记录无效。');return {id:p.id,key:clean(p.key,180),name:clean(p.name,100),domain:p.domain,target:s.provinces.some(q=>q.id===p.target)?p.target:null,monthly:normalizeMonthly(p.monthly,'',{saved:true}),funding:p.funding,started:p.started};});}
