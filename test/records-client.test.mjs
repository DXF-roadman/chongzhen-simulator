import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {saveMemo,claimReminder,completeReminder,beginYear} from '../records.mjs';
import {counselTargets} from '../counsel.mjs';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
function client(s,responder){
 const listeners={},elements=new Map(),notice={textContent:'',classList:{add(){},remove(){}}},modal={open:false,innerHTML:'',showModal(){this.open=true;},close(){this.open=false;}},transcript={scrollTop:0,scrollHeight:1000,querySelector:()=>null,getBoundingClientRect:()=>({top:0})};elements.set('#modal',modal);elements.set('#toast',notice);elements.set('#counsel-transcript',transcript);
 const initial={state:s,config:{enabled:true,hasKey:true},forecast:g.forecast(s),administration:g.administration(s),catalog:{meta:g.META,officials:g.officialCatalog(s),offices:g.coreOffices(s),actions:g.ACTIONS,domains:g.TECH_DOMAINS,counselTargets:counselTargets(s)}},ctx=vm.createContext({initial,AbortSignal,console,document:{querySelector:q=>elements.get(q)||null,addEventListener:(k,cb)=>listeners[k]=cb,body:{classList:{add(){},remove(){}}}},window:{scrollTo(){}},setTimeout:()=>1,clearTimeout(){},fetch:responder,recordHTML:html=>ctx.html=html});
 vm.runInContext(source,ctx);vm.runInContext("S=initial.state;C=initial.config;F=initial.forecast;A=initial.administration;cat=initial.catalog;T='test';view='planning';render=()=>recordHTML(view==='counsel'?counselView():planningView());",ctx);
 return {ctx,modal,notice,elements,read:code=>vm.runInContext(code,ctx),click:dataset=>listeners.click({target:{closest:()=>({dataset,disabled:false,hasAttribute:()=>false})},preventDefault(){}}),packet:state=>({state,forecast:g.forecast(state),administration:g.administration(state),config:initial.config,officials:g.officialCatalog(state),offices:g.coreOffices(state),counselTargets:counselTargets(state)})};
}
test('备忘页面分阶段显示，职务标签、提醒与用户文本正确转义，编辑与复议按钮可用',async()=>{
 const s=g.assignOfficeLeader(g.createGame(),'revenue','bi'),p=saveMemo(s,{title:'<陕西水利筹备>',horizon:'short',dueMonths:0,requirements:['钱粮 < 预算'],body:'先核一县'});let request,c;
 c=client(s,async(url,o)=>{request={url,body:JSON.parse(o.body)};const state=structuredClone(s);return {ok:true,json:async()=>({...c.packet(state),thread:{messages:[{result:{status:'discussed',text:'仅议'}}]}})};});
 assert.match(c.read('planningView()'),/短期目标/);assert.match(c.read('planningView()'),/&lt;陕西水利筹备&gt;/);assert.doesNotMatch(c.read('planningView()'),/<陕西水利筹备>/);assert.match(c.read('officials()'),/毕自严.*post-tag.*户部尚书/);
 await c.click({memoEdit:p.id});assert.equal(c.modal.open,true);assert.match(c.modal.innerHTML,/id="memo-year"/);assert.match(c.modal.innerHTML,/value="&lt;陕西水利筹备&gt;"/);
 await c.click({memoReview:p.id});assert.equal(request.url,'/api/counsel');assert.equal(request.body.mode,'discuss');assert.equal(request.body.planRef,p.id);assert.match(request.body.text,/本次先商议/);assert.equal(c.read('busy'),false);
});
test('到期提醒真实前端请求去重且不盖掉正在看的月结窗口，只更新备忘元数据',async()=>{
 const s=g.createGame(),p=saveMemo(s,{title:'陕西水利筹备',horizon:'short',dueMonths:0});let resolve,calls=0,c;c=client(s,()=>{calls++;return new Promise(r=>resolve=r);});c.modal.open=true;c.modal.innerHTML='月结正文';const area={innerHTML:''};c.elements.set('#monthly-plan-reminder',area);
 const task=c.read('remindPlanning()');assert.equal(calls,1);await c.read('remindPlanning()');assert.equal(calls,1);const state=structuredClone(s),notice=claimReminder(state);completeReminder(state,notice.id,'陛下，水利已到复议期，可先办一县。','ai');state.money=999999;
 resolve({ok:true,json:async()=>c.packet(state)});await task;assert.equal(c.read('S.money'),s.money,'提醒不覆盖客户端同期世界状态');assert.equal(c.read('S.planning[0].lastRemindedDeadline'),p.deadline);assert.equal(c.modal.innerHTML,'月结正文');assert.match(area.innerHTML,/AI 到期复议/);assert.match(area.innerHTML,/可先办一县/);await c.read('remindPlanning()');assert.equal(calls,1);assert.equal(c.read('reminderBusy'),false);
});
test('编辑备忘真实提交包含游戏年月与空条件，年度总结在十二月月结弹出且可重开',async()=>{
 let s=g.createGame({mode:'sandbox'});s.money=50000;s.grain=50000;s.month=12;beginYear(s);const p=saveMemo(s,{title:'后续水利',horizon:'short',dueMonths:3}),next=g.advance({...s,event:null});let request,c;c=client(s,async(url,o)=>{request={url,body:JSON.parse(o.body)};return {ok:true,json:async()=>c.packet(url.endsWith('advance')?next:s)};});
 for(const [id,value]of Object.entries({'memo-id':p.id,'memo-title':p.title,'memo-horizon':'medium','memo-year':'1629','memo-month':'5','memo-body':'','memo-reason':'待粮食入仓','memo-conditions':''}))c.elements.set('#'+id,{value});
 await c.read('submitMemo()');assert.equal(request.url,'/api/planning-save');assert.equal(request.body.gameId,s.id);assert.equal(request.body.memo.dueYear,1629);assert.equal(request.body.memo.dueMonth,5);assert.equal(request.body.memo.requirements,'');assert.equal(request.body.memo.body,'');
 await c.click({op:'advance'});assert.equal(request.url,'/api/advance');assert.match(c.modal.innerHTML,/1628年 · 岁终奏报/);assert.match(c.modal.innerHTML,/十二月 · 部分年度/);assert.equal(c.modal.className,'wide');assert.match(c.read('annualArchive()'),/data-annual-report="1628"/);await c.click({annualReport:'1628'});assert.match(c.modal.innerHTML,/年度总结/);assert.match(c.modal.innerHTML,/月度税入累计/);
});
