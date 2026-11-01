import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {counselTargets} from '../counsel.mjs';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
function client(s,responder=null){
 const fields={},handlers={},requests=[],packet=state=>({state,config:{enabled:false},forecast:g.forecast(state),administration:g.administration(state),officials:g.officialCatalog(state),offices:g.coreOffices(state),counselTargets:counselTargets(state)}),initial={...packet(s),catalog:{meta:g.META,officials:g.officialCatalog(s),offices:g.coreOffices(s),domains:g.TECH_DOMAINS,powers:g.POWERS,actions:g.ACTIONS,counselTargets:counselTargets(s)}};
 const notice={classList:{add(){},remove(){}}};const ctx=vm.createContext({initial,AbortSignal,console,document:{querySelector:q=>q==='#toast'?notice:fields[q]||null,addEventListener:(event,cb)=>handlers[event]=cb,body:{classList:{add(){},remove(){}}}},window:{scrollTo(){}},setTimeout:()=>1,clearTimeout(){},recordHTML:html=>ctx.html=html,fetch:async(url,o)=>{const body=JSON.parse(o.body);requests.push({url,body});return responder?responder(body):{ok:true,json:async()=>packet(s)};}});vm.runInContext(source,ctx);vm.runInContext("S=initial.state;C=initial.config;F=initial.forecast;A=initial.administration;cat=initial.catalog;T='test';open=(title,html)=>recordHTML(html);close=()=>{};render=()=>{};",ctx);
 const read=code=>vm.runInContext(code,ctx),click=dataset=>handlers.click({target:{closest:()=>({dataset,disabled:false,hasAttribute:()=>false})},preventDefault(){}});return {ctx,fields,handlers,requests,read,click};
}
test('奏报内自拟批复入口，首拨月拨期限与正确案卷传给原议事接口，普通局不露出幻想',async()=>{
 const s=g.advance(g.resolveEvent(g.createGame(),-1)),held=s.affairs.find(a=>a.petition),c=client(s);await c.click({reviewPetition:held.id});assert.match(c.ctx.html,/自拟/);assert.match(c.ctx.html,/首拨上限/);assert.match(c.ctx.html,/月拨期限/);assert.doesNotMatch(c.ctx.html,/时空供给|虫洞|高达/);
 Object.assign(c.fields,{'#petition-budget-form':{reportValidity:()=>true},'#petition-text':{value:'先核两县账目，不急于全省推广'},'#petition-reference':{value:''},'#petition-money':{value:'3'},'#petition-grain':{value:'0'},'#petition-monthly':{checked:true},'#petition-monthly-money':{value:'1.5'},'#petition-monthly-grain':{value:'0'},'#petition-duration':{value:'3'},'#petition-retain':{checked:false},'#petition-work':{value:'4'},'#duty-official':{value:'bi'}});
 await c.click({petitionDiscuss:'true'});assert.equal(c.requests.length,1);const b=c.requests[0].body;assert.equal(b.mode,'discuss');assert.equal(b.petitionDraft.petition,held.id);assert.equal(b.petitionDraft.eventId,held.petition.id);assert.equal(b.petitionDraft.budget.money,3);assert.equal(b.petitionDraft.budget.monthly.money,1.5);assert.equal(b.petitionDraft.budget.months,3);assert.equal(b.petitionDraft.official,'bi');assert.equal(b.petitionDraft.workMonths,4);const label=c.read('commandLabel('+JSON.stringify({type:'event',custom:{draft:b.petitionDraft}})+')');assert.match(label,/首拨上限 3/);assert.doesNotMatch(label,/NaN/);
});
test('参考选项只填预算供修改，切换月拨不会发送请求或先扣钱',async()=>{
 const s=g.createGame(),c=client(s);c.read('showCustomPetition()');Object.assign(c.fields,{'#petition-money':{value:'0'},'#petition-grain':{value:'0'},'#petition-monthly-fields':{hidden:true}});await c.handlers.change({target:{id:'petition-reference',value:'0'}});assert.equal(c.fields['#petition-money'].value,s.event.options[0].cost.money||0);await c.handlers.change({target:{id:'petition-monthly',checked:true}});assert.equal(c.fields['#petition-monthly-fields'].hidden,false);assert.equal(c.requests.length,0);assert.equal(c.read('S.money'),s.money);
});
test('连接失败保留批复和预算，重新打开能改金额，原话重试仍带同一授权',async()=>{
 const s=g.createGame(),c=client(s,()=>({ok:false,json:async()=>({error:'模拟网络中断'})})),d={gameId:s.id,eventId:s.event.id,eventTurn:s.turn,petition:null,text:'先核两县账目',reference:null,budget:{money:3,grain:0,monthly:{money:1,grain:0},months:2},workMonths:4,official:'bi',funding:'treasury'};
 await c.read('sendCounsel('+JSON.stringify(d.text)+',"discuss",null,{petitionDraft:'+JSON.stringify(d)+'})');assert.match(c.read('counselError'),/中断/);assert.equal(c.read('counselDrafts.council'),d.text);assert.equal(c.read('petitionBudgetDraft.budget.money'),3);
 for(const id of ['petition-text','petition-reference','petition-money','petition-grain','petition-monthly-money','petition-monthly-grain','petition-duration','petition-work','duty-official','petition-funding','petition-monthly','petition-retain','petition-monthly-fields'])c.fields['#'+id]={};
 await c.click({petitionRetry:'true'});assert.equal(c.fields['#petition-money'].value,3);assert.equal(c.fields['#petition-duration'].value,2);assert.equal(c.fields['#petition-monthly'].checked,true);await c.read('sendCounsel()');assert.equal(c.requests[1].body.petitionDraft.budget.money,3);assert.equal(c.requests[1].body.petitionDraft.budget.months,2);
});
