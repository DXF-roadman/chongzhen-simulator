import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {refreshMilitary} from '../equipment.mjs';
import {foreignProvince,settleCampaign} from '../campaigns.mjs';
import {snapshotState,restoreState} from '../state-store.mjs';
const fresh=()=>({...g.createGame({seed:940}),money:50000,grain:50000}),near=(a,b)=>assert.ok(Math.abs(a-b)<.000001,`${a} != ${b}`);

test('装备加成在国势上下限只记录实际生效量，重复刷新不漂移，撤装回到原值',()=>{
 for(const army of [49,95,100]){
  const s=fresh();s.army=army;const initial=structuredClone(s.militaryState.units[0]);s.militaryState.units[0].equipment.gundam=1;s.militaryState.units[0].needs.mecha=1;refreshMilitary(s);const equipped=s.army;
  for(let n=0;n<5;n++){refreshMilitary(s);near(s.army,equipped);snapshotState(s);}
  const loaded=restoreState(s);loaded.militaryState.units[0]=initial;refreshMilitary(loaded);near(loaded.army,army);
 }
 const s=fresh();s.army=5;const initial=structuredClone(s.militaryState.units);for(const u of s.militaryState.units)u.equipment={};refreshMilitary(s);const low=s.army;refreshMilitary(s);near(s.army,low);s.militaryState.units=initial;refreshMilitary(s);near(s.army,5);
});

test('征服后全国动乱按实际地区数取平均，不因新增同等安定地区凭空扣民心',()=>{
 let s=fresh();s.frontier=30;s.provinces.forEach(p=>{p.unrest=58;p.drought=0;});const normal=g.advance({...s,event:null});
 s.campaignState.control.liaoshen='ming';const p=foreignProvince(g.REGIONS.find(r=>r.id==='liaoshen'));Object.assign(p,{unrest:58,drought:0});s.provinces.push(p);const conquered=g.advance({...s,event:null});near(conquered.stability,normal.stability);snapshotState(conquered);assert.equal(conquered.provinces.length,13);
});

test('战役统帅加成依实际支付，欠俸时与无统帅相同，其他战费足额时仍能正常进军',()=>{
 let s=g.intervene(fresh(),{type:'war',operation:'commander',unit:'liaodong-army',official:'yuan'});s=g.intervene(s,{type:'war',operation:'attack',target:'liaoshen',unit:'liaodong-army'});
 const unpaid=structuredClone(s),vacant=structuredClone(s),paid=structuredClone(s);vacant.militaryState.units[0].commander=null;
 settleCampaign(unpaid,id=>!id.startsWith('pay:commander:'),true,()=>1);settleCampaign(vacant,()=>true,true,()=>1);settleCampaign(paid,()=>true,true,()=>1);
 const enemy=x=>x.campaignState.enemies.find(e=>e.region==='liaoshen').strength;
 near(enemy(unpaid),enemy(vacant));assert.ok(enemy(paid)<enemy(unpaid));assert.equal(unpaid.campaignState.battles[0].months,1);snapshotState(unpaid);
});

test('月报金额与可调整的俸禄范围一致，合法提高经费不再导致月结无法保存',()=>{
 let s=g.assignOfficeLeader(fresh(),'revenue','bi');s=g.setFiscal(s,{scope:'person',official:'bi',monthly:25});s=g.advance({...s,event:null});assert.equal(s.institutionReports.find(r=>r.institution==='office:revenue').budget,25);snapshotState(s);
 s=fresh();s=g.applyEdict(s,g.institutionPlan(s,[{operation:'create_agency',name:'核账署',domain:'finance',powers:['execution'],budget:20}],'设核账署'));s=g.assignAgencyLeader(s,s.agencies[0].id,'bi');s=g.setFiscal(s,{scope:'person',official:'bi',monthly:1000});s=g.advance({...s,event:null});assert.equal(s.institutionReports.find(r=>r.institution==='agency:'+s.agencies[0].id).budget,1012);snapshotState(s);assert.deepEqual(restoreState(s),s);
});

test('小额机构税效保留到百两精度，增拨确实影响预估并按同额入账，既有月账不重算',()=>{
 let s=fresh();s=g.applyEdict(s,g.institutionPlan(s,[{operation:'create_agency',name:'试务署',domain:'finance',powers:['execution'],budget:2}],'设试务署'));s.agencies[0].status='active';s.agencies[0].remaining=0;
 const before=g.forecast(s),larger=g.setAgencyBudget(s,s.agencies[0].id,4),after=g.forecast(larger);assert.ok(after.revenue>before.revenue);assert.ok(after.revenue-before.revenue<1);assert.equal(Math.round(after.ordinaryRevenue*100),Math.round(after.ordinaryRevenue*10000)/100);
 const next=g.advance({...larger,event:null});assert.equal(next.ledger.revenue,after.revenue);snapshotState(next);const changed=g.setAgencyBudget(next,next.agencies[0].id,8);assert.deepEqual(changed.ledger,next.ledger);assert.deepEqual(restoreState(changed).ledger,next.ledger);
});
