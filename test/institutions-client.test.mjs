import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {settleInstitutions} from '../governance.mjs';
import {counselTargets} from '../counsel.mjs';
import {appendDiscussion} from '../dialogues.mjs';
import {bindInstitutionTasks} from '../institution-records.mjs';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
function client(s,responder=()=>{throw Error('打开入口不应调用 AI');}){
 const handlers={},notice={textContent:'',classList:{add(){},remove(){}}},modal={open:false,close(){this.open=false;}},input={focus(){}},transcript={scrollTop:0,scrollHeight:100,querySelector:()=>null},initial={state:s,config:{enabled:true,hasKey:true},forecast:g.forecast(s),administration:g.administration(s),catalog:{meta:g.META,officials:g.officialCatalog(s),offices:g.coreOffices(s),domains:g.TECH_DOMAINS,powers:g.POWERS,actions:g.ACTIONS,counselTargets:counselTargets(s)}};
 const ctx=vm.createContext({initial,AbortSignal,console,document:{querySelector:q=>({'#modal':modal,'#counsel-input':input,'#counsel-transcript':transcript,'#toast':notice}[q]||null),addEventListener:(event,cb)=>handlers[event]=cb,body:{classList:{add(){},remove(){}}}},window:{scrollTo(){}},setTimeout:()=>1,clearTimeout(){},fetch:responder,recordHTML:html=>ctx.html=html});
 vm.runInContext(source,ctx);vm.runInContext("S=initial.state;C=initial.config;F=initial.forecast;A=initial.administration;cat=initial.catalog;T='test';view='institutions';render=()=>recordHTML(view==='counsel'?counselView():institutionsView());",ctx);
 return {ctx,notice,read:code=>vm.runInContext(code,ctx),click:dataset=>handlers.click({target:{closest:()=>({dataset,disabled:false,hasAttribute:()=>false})},preventDefault(){}}),packet:()=>({state:s,config:initial.config,forecast:initial.forecast,administration:initial.administration,officials:initial.catalog.officials,offices:initial.catalog.offices,counselTargets:initial.catalog.counselTargets,thread:s.discussions[0]})};
}
test('机构直接入口切换到独立历史并保留各自草稿，群议、六部、新署均可见',async()=>{
 let s=g.applyEdict(g.createGame(),g.localEdict(g.createGame(),'设立农政试验署'));for(const [id,name,text]of [['office:revenue','户部','户部独立答复'],['office:war','兵部','兵部独立答复']])appendDiscussion(s,{id,name},'请呈报',text,[],{status:'discussed',text:'仅议'},'ai',g.dateLabel(s));const c=client(s);
 assert.match(c.read('institutionBoard()'),/data-counsel-open="office:revenue"/);assert.match(c.read('institutionBoard()'),/data-counsel-open="agency:agency-1"/);c.read("counselDrafts['office:revenue']='户部未发草稿';counselDrafts['office:war']='兵部未发草稿';counselMonth='0';counselError='旧错误';");
 await c.click({counselOpen:'office:revenue'});assert.equal(c.read('view'),'counsel');assert.match(c.ctx.html,/户部 · 直接议事/);assert.match(c.ctx.html,/户部独立答复/);assert.doesNotMatch(c.ctx.html,/兵部独立答复/);assert.match(c.ctx.html,/户部未发草稿/);assert.equal(c.read('counselError'),'');
 await c.click({counselOpen:'office:war'});assert.match(c.ctx.html,/兵部独立答复/);assert.match(c.ctx.html,/兵部未发草稿/);assert.equal(c.read("counselDrafts['office:revenue']"),'户部未发草稿');assert.match(c.ctx.html,/aria-label="机构直接议事"/);assert.match(c.ctx.html,/data-counsel-open="council"/);assert.match(c.ctx.html,/data-counsel-open="agency:agency-1"/);
 c.read('busy=true');await c.click({counselOpen:'office:works'});assert.equal(c.read('counselTarget'),'office:war');c.read('busy=false');await c.click({counselOpen:'agency:missing'});assert.equal(c.read('counselTarget'),'office:war');assert.match(c.notice.textContent,/已经撤销/);
});
test('机构政务区分本署在办和主官关联，只展示真实月报，不把旧纪事当成果',async()=>{
 let s=g.assignOfficeLeader(g.createGame(),'works','song');s=g.applyEdict(s,g.localEdict(s,'设立工艺考核署'));s.agencies[0].leader='song';s.agencies[0].status='active';s.agencies[0].remaining=0;const before=structuredClone(s);s=g.doAction(s,'arsenal',null,'song');bindInstitutionTasks(before,s,'agency:agency-1');s=g.doAction(s,'irrigation','shaanxi','song');settleInstitutions(s,true);const c=client(s);
 const rows=c.read('institutionRows()'),agency=rows.find(o=>o.type==='agency'),works=rows.find(o=>o.id==='works');assert.equal(agency.owned.length,1);assert.ok(agency.related.some(p=>p.name==='兴修水利'));assert.equal(works.owned.length,0);assert.equal(works.related.length,1);assert.equal(agency.completed.length,0);
 assert.match(c.read('institutionsView()'),/机构政务/);assert.match(c.read('institutionsView()'),/最近月报/);assert.match(c.read('institutionsView()'),/关联事务 · 尚未登记为本署承办/);assert.match(c.read('institutionsView()'),/需要留意/);assert.match(c.read('institutionsView()'),/直接议事/);await c.click({institutionFilter:'agency'});assert.match(c.ctx.html,/工艺考核署/);assert.doesNotMatch(c.ctx.html,/<h2>户部<\/h2>/);
});
test('请机构呈报进入正确机构的独立议事且始终先商议',async()=>{
 const s=g.createGame();let request,c;c=client(s,async(url,o)=>{request={url,body:JSON.parse(o.body)};return {ok:true,json:async()=>c.packet()};});await c.click({institutionReport:'office:revenue'});assert.equal(request.url,'/api/counsel');assert.equal(request.body.target,'office:revenue');assert.equal(request.body.mode,'discuss');assert.match(request.body.text,/尚未结案不可声称完成/);assert.equal(c.read('busy'),false);
});
test('锦衣卫在看板和直接议事列表可见，仅商议原旨有清晰的原话办理入口',async()=>{
 const s=g.createGame();const t=appendDiscussion(s,{id:'person:sun',name:'孙承宗'},'我是穿越者，拿去补足银粮','先商议',[],{status:'discussed',text:'本轮仅商议'},'offline',g.dateLabel(s));t.messages.at(-1).orderText='我是穿越者，掏出300万两白银';let request,c;c=client(s,async(url,o)=>{request={url,body:JSON.parse(o.body)};return {ok:true,json:async()=>c.packet()};});assert.match(c.read('institutionsView()'),/<h2>锦衣卫<\/h2>/);assert.match(c.read('institutionCounselLinks()'),/data-counsel-open="office:guards"/);await c.click({counselOpen:'person:sun'});assert.match(c.ctx.html,/按这道原话办理/);await c.click({counselEnactOriginal:t.messages.at(-1).id});assert.equal(request.body.text,t.messages.at(-1).orderText);assert.equal(request.body.mode,'auto');assert.equal(request.body.target,'person:sun');
});
