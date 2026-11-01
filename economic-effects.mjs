// Customs receipts are gameplay estimates, derived from actual access and local conditions.
// AI may describe a tax charter; it cannot prescribe a monthly money grant.
import {PLACES} from './horizons.mjs';
import {chineseNumber} from './fiscal-rules.mjs';
const clean=(v,n=160)=>String(v??'').trim().slice(0,n),cap=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0)),round=v=>Math.round(v*1000)/1000;
const ports={泉州:'zhemin',漳州:'zhemin',月港:'zhemin',福州:'zhemin',宁波:'zhemin',广州:'liangguang',澳门:'liangguang',天津:'capital',登州:'shandong',上海:'jiangnan'};
export const initialEconomy=()=>({version:1,customs:[],repairs:[]});
export function canonicalDomain(value,fallback='education'){
 const aliases={农业:'agriculture',农政:'agriculture',农政水利:'agriculture',工业:'industry',工矿:'industry',工矿制造:'industry',财政:'finance',金融:'finance',财政金融:'finance',军事:'military',军制:'military',军制军工:'military',海事:'naval',航海:'naval',造船航海:'naval',治理:'governance',吏治:'governance',制度:'governance',制度吏治:'governance',文教:'education',教育:'education',教育科研:'education',医学:'medicine',医疗:'medicine',公共卫生:'medicine'};
 const d=aliases[value]||value;return ['agriculture','industry','finance','military','naval','governance','education','medicine'].includes(d)?d:fallback;
}
function rateAfter(text,threshold,fallback){
 const re=new RegExp(threshold+'[^，。；;]{0,14}?(?:抽|征|税)(?:其|取|收|率为|率)?\\s*([一二两三四五六七八九十\\d.]+)\\s*(成|%|％)?');const m=text.match(re);if(!m)return fallback;const v=chineseNumber(m[1]);return cap(m[2]==='%'||m[2]==='％'?v/100:v>1?v/10:v,0,1);
}
export function economicPlan(raw,s,input){
 const text=String(input||'');if(!/开海|通商|海贸|市舶|海关|税关|商船/.test(text))return null;
 const closing=/关闭|裁撤|撤销|停办|禁海|禁止.{0,5}(?:出海|通商)/.test(text);
 if(!closing&&!/抽分|关税|抽其|官抽|征税|税关|海关|市舶税/.test(text))return null;
 const claimed=raw?.economic||{},port=Object.keys(ports).find(p=>text.includes(p))||(claimed.port&&text.includes(claimed.port)?clean(claimed.port,32):null);
 const target=port&&(ports[port]||raw?.target);if(!port||!s.provinces.some(p=>p.id===target))return null;
 const lowRate=rateAfter(text,'千两',Number.isFinite(claimed.lowRate)?cap(claimed.lowRate,0,1):.1),highRate=rateAfter(text,'万两',Number.isFinite(claimed.highRate)?cap(claimed.highRate,0,1):lowRate);
 return {type:'customs',operation:closing?'close':'open',port,target,lowRate,highRate,lowThreshold:.1,highThreshold:1,firstTradeDiscount:/首市|首次|初次|第一次/.test(text)&&/减半/.test(text)?.5:1,input:clean(text,2000)};
}
export function validateEconomicPlan(v,s){
 if(!v||v.type!=='customs'||!['open','close'].includes(v.operation)||typeof v.port!=='string'||v.port.length<2||v.port.length>32||!s.provinces.some(p=>p.id===v.target))throw Error('海关税源章程无效。');
 for(const k of ['lowRate','highRate','firstTradeDiscount'])if(!Number.isFinite(v[k])||v[k]<0||v[k]>1)throw Error('海关抽分比例无效。');
 if(v.lowThreshold!==.1||v.highThreshold!==1)throw Error('海关分档门槛无效。');
 return {type:'customs',operation:v.operation,port:clean(v.port,32),target:v.target,lowRate:v.lowRate,highRate:v.highRate,lowThreshold:.1,highThreshold:1,firstTradeDiscount:v.firstTradeDiscount,input:clean(v.input,2000),...(Number.isSafeInteger(v.edictTurn)&&v.edictTurn>=0?{edictTurn:v.edictTurn}:{})};
}
export function activateEconomic(s,raw,name,completedTurn=s.turn){
 const p=validateEconomicPlan(raw,s);s.economy||=initialEconomy();const id='customs:'+p.target+':'+p.port,old=s.economy.customs.find(r=>r.id===id);
 if(p.operation==='close'){if(old)old.enabled=false;return old||null;}
 if(!old&&s.economy.customs.length>=24)throw Error('现行海关税源过多，请先整顿已有税关。');
 if(old&&old.sourceTurn===(p.edictTurn??completedTurn)&&old.name===name)return old;
 const row={id,name:clean(name,100),port:p.port,target:p.target,lowRate:p.lowRate,highRate:p.highRate,lowThreshold:p.lowThreshold,highThreshold:p.highThreshold,firstTradeDiscount:p.firstTradeDiscount,enabled:true,activeFromTurn:completedTurn+1,sourceTurn:p.edictTurn??completedTurn,input:p.input};
 if(old)Object.assign(old,row);else s.economy.customs.push(row);return row;
}
export function customsForecast(s){
 const markets=PLACES.filter(p=>!['ming','jin','mongol'].includes(p.id)&&s.atlas?.discoveries?.[p.id]?.visited&&(!p.country||(s.countries.find(c=>c.id===p.country)?.relation??0)>-60));
 const rows=(s.economy?.customs||[]).map(c=>{
  const p=s.provinces.find(p=>p.id===c.target),age=s.turn-c.activeFromTurn;
  if(!c.enabled||age<0||!p||!markets.length)return {id:c.id,name:c.name,port:c.port,target:c.target,revenue:0,profitBase:0,assessedTax:0,knownMarkets:markets.length,status:!c.enabled?'已停办':age<0?'下月开征':!markets.length?'尚无可通商节点':'港口不在治下',lowRate:c.lowRate,highRate:c.highRate};
  const maturity=Math.min(1,.55+age*.15),effectiveRate=.4*c.lowRate+.6*c.highRate;
  const incentive=1/(1+Math.max(0,effectiveRate-.15)*4),security=(.45+s.navy*.0055)*Math.max(.2,1-p.unrest/120),confidence=.6+s.factions.merchant/100;
  const profitBase=(4+p.prosperity*.12)*(1+Math.min(10,markets.length)*.45)*maturity*security*confidence*incentive;
  // Three notional merchant-size bands; approved marginal thresholds remain explicit.
  const bands=[{profit:.08,weight:.1},{profit:.5,weight:.3},{profit:2,weight:.6}];
  const rate=bands.reduce((n,b)=>n+(b.profit<=c.lowThreshold?0:b.profit<=c.highThreshold?c.lowRate:c.highRate)*b.weight,0);
  const firstShare=Math.max(.15,.6-age*.08),discount=1-firstShare*(1-c.firstTradeDiscount),assessedTax=profitBase*rate*discount;
  const collection=Math.max(.2,1-s.corruption/150),revenue=Math.round(assessedTax*collection*100)/100;
  return {id:c.id,name:c.name,port:c.port,target:c.target,revenue,profitBase:round(profitBase),assessedTax:round(assessedTax),collection:round(collection),maturity:round(maturity),knownMarkets:markets.length,status:'按月报解',lowRate:c.lowRate,highRate:c.highRate,firstTradeDiscount:c.firstTradeDiscount};
 });return {revenue:Math.round(rows.reduce((n,r)=>n+r.revenue,0)*100)/100,sources:rows};
}
export function validateEconomy(raw,s){
 if(raw.economy===undefined){s.economy=initialEconomy();return;}
 const e=raw.economy;if(!e||e.version!==1||!Array.isArray(e.customs)||e.customs.length>24||new Set(e.customs.map(c=>c.id)).size!==e.customs.length||!Array.isArray(e.repairs)||e.repairs.length>120)throw Error('持续税源存档无效。');
 s.economy={version:1,customs:e.customs.map(c=>{const p=validateEconomicPlan({...c,type:'customs',operation:'open'},s);if(c.id!=='customs:'+p.target+':'+p.port||typeof c.enabled!=='boolean'||!Number.isSafeInteger(c.activeFromTurn)||c.activeFromTurn<0||!Number.isSafeInteger(c.sourceTurn)||c.sourceTurn<0)throw Error('海关税源生效记录无效。');return {id:c.id,name:clean(c.name,100),port:p.port,target:p.target,lowRate:p.lowRate,highRate:p.highRate,lowThreshold:.1,highThreshold:1,firstTradeDiscount:p.firstTradeDiscount,enabled:c.enabled,activeFromTurn:c.activeFromTurn,sourceTurn:c.sourceTurn,input:p.input};}),repairs:e.repairs.map(x=>clean(x,180))};
}
export function restoreEconomicRecords(s){
 s.economy||=initialEconomy();const recovered=[];
 for(const edict of [...s.edicts].reverse()){
  const key=edict.turn+':'+edict.title;if(s.economy.repairs.includes(key))continue;
  const executed=s.discussions.flatMap(t=>t.messages).filter(m=>m.role==='assistant'&&m.result?.status==='executed').flatMap(m=>m.commands||[]).find(c=>c.type==='edict'&&c.plan?.title===edict.title&&c.text===edict.input);
  const plan=economicPlan(executed?.plan||{},s,edict.input);if(!plan)continue;
  const inst=s.institutions.find(i=>i.name===edict.title&&i.turn>=edict.turn),completion=s.history.find(h=>h.turn>=edict.turn&&(h.title==='竣工 · '+edict.title||h.title==='销案 · '+edict.title));
  if(!inst&&!completion){const pending=[...s.projects,...s.affairs].find(p=>p.name===edict.title);if(pending&&!pending.economic){pending.economic={...plan,edictTurn:edict.turn};pending.domain='finance';recovered.push({name:edict.title,status:'pending'});}continue;}
  const completedTurn=inst?.turn??completion.turn,source=activateEconomic(s,{...plan,edictTurn:edict.turn},edict.title,completedTurn);
  if(inst&&inst.domain!=='finance'&&canonicalDomain(executed?.plan?.domain,'finance')==='finance'){
   const oldDomain=inst.domain,followups=s.history.filter(h=>h.turn>=completedTurn&&h.title==='御批 · 新政回响：'+edict.title),extra=followups.reduce((n,h)=>n+(h.text.startsWith('拨款推广')?4:h.text.startsWith('维持试点')?2:0),0),points=Math.min(s.technology[oldDomain],12+extra);s.technology[oldDomain]=round(s.technology[oldDomain]-points);s.technology.finance=Math.min(100,round(s.technology.finance+points));inst.domain='finance';if(s.event?.id==='legacy'&&s.event.title==='新政回响：'+edict.title)s.event.domain='finance';
  }
  s.economy.repairs.push(key);s.economy.repairs=s.economy.repairs.slice(-120);recovered.push({name:edict.title,status:source?.enabled?'active':'closed'});
 }
 return recovered;
}
export function validateMonthLedger(raw,s){
 const v=raw.ledger;if(v===null||v===undefined)return;
 if(!v||typeof v!=='object'||Array.isArray(v)||['revenue','expenses','net','grainUse','harvest'].some(k=>!Number.isFinite(v[k])||Math.abs(v[k])>1e9)||v.revenue<0||v.expenses<0||v.grainUse<0||v.harvest<0)throw Error('月结账簿无效。');
 const numeric=['revenue','expenses','net','grainUse','harvest','ordinaryRevenue','customsRevenue','centralExpenses','salaryTotal','campaignExpenses','militaryExpenses','explorationExpenses','talentExpenses','talentGrain','agencyExpenses','dutyExpenses','portalDutyExpenses'];
 const sources=v.economicSources||[];if(!Array.isArray(sources)||sources.length>24)throw Error('月结税源明细无效。');
 s.ledger={date:clean(v.date,60),administration:clean(v.administration,60),...Object.fromEntries(numeric.filter(k=>v[k]!==undefined).map(k=>{if(!Number.isFinite(v[k])||Math.abs(v[k])>1e9)throw Error('月结账簿数值无效。');return [k,v[k]];})),economicSources:sources.map(r=>{
  if(!r||typeof r.id!=='string'||!Number.isFinite(r.revenue)||r.revenue<0||r.revenue>1e6)throw Error('月结海关实解无效。');
  return {id:clean(r.id,100),port:clean(r.port,32),name:clean(r.name,100),target:clean(r.target,80),status:clean(r.status,40),revenue:r.revenue,...Object.fromEntries(['profitBase','assessedTax','collection','maturity','knownMarkets','lowRate','highRate','firstTradeDiscount'].filter(k=>Number.isFinite(r[k])&&r[k]>=0&&r[k]<=1e6).map(k=>[k,r[k]]))};
 })};
 if(v.fiscalRates&&typeof v.fiscalRates==='object'&&!Array.isArray(v.fiscalRates))s.ledger.fiscalRates=Object.fromEntries(Object.entries(v.fiscalRates).filter(([k,n])=>k.length<=40&&Number.isFinite(n)&&n>=0&&n<=1000));
}
