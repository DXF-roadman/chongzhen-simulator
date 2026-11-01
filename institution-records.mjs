const metrics=['money','grain','stability','army','legitimacy','corruption','tech','navy','frontier'];
const validOwner=v=>typeof v==='string'&&/^(?:office:(?:cabinet|personnel|revenue|rites|war|justice|works|guards)|agency:agency-\d+)$/.test(v);
const clean=(v,n)=>String(v??'').slice(0,n);
export function institutionOwner(value){if(value===undefined||value===null)return null;if(!validOwner(value))throw Error('存档事务承办机构无效。');return value;}
export function institutionSnapshot(s){return {stats:Object.fromEntries(metrics.map(k=>[k,s[k]])),knowledge:{...s.technology},drought:s.provinces.reduce((n,p)=>n+p.drought,0)/s.provinces.length,prosperity:s.provinces.reduce((n,p)=>n+p.prosperity,0)/s.provinces.length};}
const round=v=>Math.round(v*1000)/1000;
export function institutionDelta(before,s){const after=institutionSnapshot(s);return {effects:Object.fromEntries(metrics.map(k=>[k,round(after.stats[k]-before.stats[k])]).filter(([,v])=>v!==0)),knowledge:Object.fromEntries(Object.keys(after.knowledge).map(k=>[k,round(after.knowledge[k]-before.knowledge[k])]).filter(([,v])=>v!==0)),regional:{drought:round(after.drought-before.drought),prosperity:round(after.prosperity-before.prosperity)}};}
export function recordInstitution(s,institution,name,entry){
 if(!validOwner(institution))return;
 const row={institution,name:clean(name,60),year:s.year,month:s.month,turn:s.turn,kind:entry.kind||'month',status:entry.status||'active',title:clean(entry.title,100),text:clean(entry.text,500),budget:Number(entry.budget)||0,leader:entry.leader||null,effects:entry.effects||{},knowledge:entry.knowledge||{},regional:entry.regional||{},revenueRate:Number(entry.revenueRate)||0,harvestBonus:Number(entry.harvestBonus)||0};
 s.institutionReports=[row,...(s.institutionReports||[])].filter((r,i,all)=>all.slice(0,i).filter(x=>x.institution===r.institution).length<8).slice(0,120);
}
export function bindInstitutionTasks(before,next,institution){
 if(!validOwner(institution))return;
 for(const key of ['projects','affairs']){const old=new Set((before[key]||[]).map(p=>p.id));for(const p of next[key]||[])if(!old.has(p.id))p.institution=institution;}
}
export function validateInstitutionReports(raw,s){
 const rows=raw.institutionReports||[];if(!Array.isArray(rows)||rows.length>120)throw Error('存档机构月报无效。');
 const values=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)||!Number.isFinite(v[k])||Math.abs(v[k])>1000000))throw Error('存档机构成效数值无效。');return {...v};};
 s.institutionReports=rows.map(r=>{
  if(!validOwner(r.institution)||!Number.isInteger(r.year)||r.year<1628||r.year>3000||!Number.isInteger(r.month)||r.month<1||r.month>12||!Number.isInteger(r.turn)||r.turn<0||!['month','completion','order'].includes(r.kind)||!['active','forming','unfunded','completed','executed'].includes(r.status)||!Number.isFinite(r.budget)||r.budget<0||r.budget>1020||!Number.isFinite(r.revenueRate)||Math.abs(r.revenueRate)>1||!Number.isFinite(r.harvestBonus)||Math.abs(r.harvestBonus)>100)throw Error('存档机构月报字段无效。');
  return {institution:r.institution,name:clean(r.name,60),year:r.year,month:r.month,turn:r.turn,kind:r.kind,status:r.status,title:clean(r.title,100),text:clean(r.text,500),budget:r.budget,leader:r.leader?clean(r.leader,80):null,effects:values(r.effects,metrics),knowledge:values(r.knowledge,Object.keys(s.technology)),regional:values(r.regional,['drought','prosperity']),revenueRate:r.revenueRate,harvestBonus:r.harvestBonus};
 });
}
