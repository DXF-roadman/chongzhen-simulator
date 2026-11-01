export function fundingSource(s,raw={},input=''){
 if(raw.funding!==undefined&&!['treasury','portal'].includes(raw.funding))throw Error('费用来源无效，只可选择国库或虫洞供给。');
 const wording=String(input||'')+' '+String(raw.feasibility||'');
 const supplied=/虫洞|门中|门内|时空|未来/.test(wording)&&/(?:不占|不动|不耗|不用|不取|无需).{0,6}(?:官帑|国库|库银|官银)|(?:费用|钱粮|材料|物资).{0,12}(?:全由|均由|由).{0,8}(?:虫洞|门中|未来)/.test(wording);
 const funding=raw.funding??(supplied?'portal':'treasury');
 if(funding==='portal'&&!s.traveler?.enabled)throw Error('虫洞供给费用须先明确开启穿越者能力。');
 return funding;
}
export function batchFinance(before,after){
 const prior=new Set((before.traveler?.supplies||[]).map(r=>r.id).filter(Boolean)),transfers=(after.traveler?.supplies||[]).filter(r=>r.id&&!prior.has(r.id)),round=n=>Math.round(n*1000)/1000;
 return {portalMoney:round(transfers.reduce((n,r)=>n+r.money,0)),portalGrain:round(transfers.reduce((n,r)=>n+r.grain,0)),netMoney:round(after.money-before.money),netGrain:round(after.grain-before.grain),energyUsed:round(Math.max(0,(before.traveler?.energy||0)-(after.traveler?.energy||0)))};
}
