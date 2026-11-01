import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {recommendationContext,captureRecommendation} from '../civil-service.mjs';
import {counselTargets} from '../counsel.mjs';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
function client(s,responder=()=>{throw Error('Browsing must not request AI');}){
 const handlers={},app={innerHTML:''},input={focus(){}},modal={close(){},showModal(){}},notice={classList:{add(){},remove(){}}};
 const initial={state:s,config:{enabled:true,hasKey:true,usage:{}},catalog:{officials:g.officialCatalog(s),offices:g.coreOffices(s),powers:g.POWERS,domains:g.TECH_DOMAINS,meta:g.META,counselTargets:counselTargets(s)},administration:g.administration(s),forecast:g.forecast(s)};
 const ctx=vm.createContext({initial,AbortSignal,console,document:{querySelector:q=>({'#app':app,'#modal':modal,'#counsel-input':input,'#toast':notice}[q]||null),addEventListener:(n,f)=>handlers[n]=f,body:{classList:{add(){},remove(){}}}},window:{scrollTo(){}},setTimeout:()=>1,clearTimeout(){},fetch:responder});vm.runInContext(source,ctx);vm.runInContext('S=initial.state;C=initial.config;cat=initial.catalog;A=initial.administration;F=initial.forecast;T="test";view="institutions";render=()=>{document.querySelector("#app").innerHTML=view==="counsel"?counselView():institutionBoard();};',ctx);
 return {ctx,read:code=>vm.runInContext(code,ctx),app,click:dataset=>handlers.click({target:{closest:()=>({dataset,disabled:false,hasAttribute:()=>false})},preventDefault(){}})};
}
test('机构属员履历按需折叠，原任主官已有姓名与费用解释，人才页不重复展开八张部长卡片',async()=>{
 let s=g.createGame(),context=recommendationContext(s,'office:guards','找人下南洋'),r=captureRecommendation(s,'office:guards','找人下南洋',[],context)[0];s=g.serviceCommand(s,{operation:'delegate',recommendation:r.id});const c=client(s);c.read('render()');assert.match(c.app.innerHTML,/<details class="institution-service">/);assert.match(c.app.innerHTML,/赵廷弼/);assert.match(c.app.innerHTML,/薪俸已含朝廷常设经费/);assert.match(c.app.innerHTML,/已奉旨交办/);assert.match(c.app.innerHTML,new RegExp(s.service.people.find(p=>p.id===r.person).name));assert.doesNotMatch(c.app.innerHTML,/undefined|NaN|高达|卫星/);
 assert.equal((c.read('officials()').match(/class="panel official-card"/g)||[]).length,7,'只展开六位原有专才及实际识得的属员');await c.click({serviceRecommend:'office:guards'});assert.equal(c.read('view'),'counsel');assert.equal(c.read('counselTarget'),'office:guards');assert.match(c.read("counselDrafts['office:guards']"),/南洋/);assert.match(c.app.innerHTML,/锦衣卫 · 直接议事/);
});
test('候选人才在本署显示核验按钮，点击调用现有变更流程，费用明确',async()=>{
 let s=g.createGame();s=g.serviceCommand(s,{operation:'seek',institution:'office:works',domain:'industry'});s=g.advance({...s,event:null});const p=s.service.people.find(p=>p.origin==='external');let request,c;c=client(s,async(url,o)=>{request={url,body:JSON.parse(o.body)};const next=g.serviceCommand(s,request.body.command);return {ok:true,json:async()=>({state:next,officials:g.officialCatalog(next),offices:g.coreOffices(next),counselTargets:counselTargets(next),forecast:g.forecast(next),administration:g.administration(next)})};});c.read('render()');assert.match(c.app.innerHTML,new RegExp('data-service-engage="'+p.id+'"'));assert.match(c.app.innerHTML,/试差 · 银2万两/);await c.click({serviceEngage:p.id});assert.equal(request.url,'/api/service');assert.equal(request.body.command.operation,'engage');assert.match(c.app.innerHTML,/试差中 · 下月回复/);
});
