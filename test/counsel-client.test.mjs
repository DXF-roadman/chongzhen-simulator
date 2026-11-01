import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {counselTargets} from '../counsel.mjs';
import {appendDiscussion} from '../dialogues.mjs';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
function client(responder){
 const listeners={},classes=new Set(),transcript={scrollTop:0,scrollHeight:4000,getBoundingClientRect:()=>({top:200}),querySelector:()=>({getBoundingClientRect:()=>({top:700})})},notice={textContent:'',classList:{add(){},remove(){}}};
 const s=g.createGame();appendDiscussion(s,{id:'council',name:'御前议政'},'请拟方案','臣拟请毕自严督办，再赈陕西。',[{type:'action',action:'relief',target:'shaanxi'}],{status:'discussed',text:'仅商议'},'ai',g.dateLabel(s));
 const initial={state:s,config:{enabled:true,hasKey:true},forecast:g.forecast(s),administration:g.administration(s),catalog:{meta:g.META,officials:g.officialCatalog(s),offices:g.coreOffices(s),actions:g.ACTIONS,domains:g.TECH_DOMAINS,counselTargets:counselTargets(s)}};
 const ctx=vm.createContext({initial,AbortSignal,console,document:{querySelector:q=>q==='#counsel-transcript'?transcript:q==='#toast'?notice:null,addEventListener:(name,callback)=>listeners[name]=callback,body:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}},window:{scrollTo(){}},setTimeout:()=>1,clearTimeout(){},fetch:responder,recordHTML:html=>{ctx.html=html;transcript.scrollTop=0;}});
 vm.runInContext(source,ctx);vm.runInContext("S=initial.state;C=initial.config;F=initial.forecast;A=initial.administration;cat=initial.catalog;T='test-token';view='counsel';render=()=>recordHTML(counselView());",ctx);
 const click=(dataset={op:'counsel-accept'})=>{const button={dataset,disabled:false,hasAttribute:()=>false};return listeners.click({target:{closest:()=>button},preventDefault(){}});};
 return {ctx,click,transcript,classes,notice,state:s,change:(id,value)=>listeners.change({target:{id,value}}),read:expression=>vm.runInContext(expression,ctx),response:(status,text)=>({state:s,config:initial.config,forecast:initial.forecast,administration:initial.administration,officials:initial.catalog.officials,offices:initial.catalog.offices,counselTargets:initial.catalog.counselTargets,thread:{messages:[{role:'assistant',content:'长答复'.repeat(1000),result:{status,text}}]}})};
}
test('真实按钮回调显示忙碌，连续点击只发一次请求，结束后显示成功反馈',async()=>{
 let resolve,calls=0,options;const c=client((url,o)=>{calls++;options=o;return new Promise(r=>resolve=r);});
 const pending=c.click();assert.equal(calls,1);assert.match(c.ctx.html,/data-op="counsel-accept" disabled aria-busy="true"/);assert.match(c.ctx.html,/正在核验办理/);assert.equal(c.classes.has('working'),true);
 await c.click();assert.equal(calls,1);resolve({ok:true,json:async()=>c.response('executed','赈济已实际办理。')});await pending;
 assert.equal(c.read('busy'),false);assert.equal(c.classes.has('working'),false);assert.match(c.notice.textContent,/已核验办理/);assert.equal(c.transcript.scrollTop,488);assert.equal(JSON.parse(options.body).text,'照办');assert.ok(options.signal);
});
test('HTTP 200 的办理受阻也在输入框上方显著提示，并保留玩家原输入',async()=>{
 let c;c=client(async()=>({ok:true,json:async()=>c.response('blocked','本月施政次数已用尽，本次整批未执行。')}));
 c.read("counselDrafts.council='原来的政令';");await c.click();assert.match(c.ctx.html,/class="counsel-error" role="alert">未能办理：本月施政次数已用尽/);assert.equal(c.read('counselDrafts.council'),'原来的政令');assert.match(c.notice.textContent,/未能办理/);assert.equal(c.read('busy'),false);
});
test('连接超时解除忙碌并提醒核对存档，防止永远卡在无反应状态',async()=>{
 const c=client(async()=>{const e=Error('timeout');e.name='TimeoutError';throw e;});await c.click();assert.equal(c.read('busy'),false);assert.equal(c.classes.has('working'),false);assert.match(c.ctx.html,/等待响应超时/);assert.match(c.ctx.html,/先刷新核对议事记录与办理结果/);
});
test('本月只显示最近六轮，可展开更早记录，切换往月不误显示办理按钮',async()=>{
 const c=client(async()=>{throw Error('不应调用服务');}),s=c.state;
 for(let i=0;i<8;i++)appendDiscussion(s,{id:'council',name:'御前议政'},'正月原话'+i,'正月答复'+i,[],{status:'discussed',text:'仅商议'},'ai',g.dateLabel(s));
 s.turn=1;s.month=2;for(let i=0;i<8;i++)appendDiscussion(s,{id:'council',name:'御前议政'},'二月原话'+i,'二月答复'+i,[],{status:'discussed',text:'仅商议'},'ai',g.dateLabel(s));
 c.read('render()');assert.doesNotMatch(c.ctx.html,/正月原话|二月原话0|二月原话1/);assert.match(c.ctx.html,/二月原话7/);assert.match(c.ctx.html,/展开更早 2 轮/);
 await c.click({op:'counsel-expand'});assert.match(c.ctx.html,/二月原话0/);await c.change('counsel-month','0');assert.match(c.ctx.html,/正月原话7/);assert.doesNotMatch(c.ctx.html,/二月原话|data-op="counsel-accept"/);assert.equal(c.state.actionsLeft,null);
});
test('未执行消息提供编辑与重新回复，已执行及其前文不提供改写按钮',async()=>{
 const c=client(async()=>{throw Error('不应调用服务');}),messages=c.state.discussions[0].messages;c.read('render()');assert.match(c.ctx.html,/data-counsel-edit/);assert.match(c.ctx.html,/data-counsel-regenerate/);assert.match(c.ctx.html,/data-counsel-delete/);
 messages[1].result.status='executed';c.read('render()');assert.doesNotMatch(c.ctx.html,/data-counsel-edit|data-counsel-regenerate|data-counsel-delete/);assert.match(c.ctx.html,/已执行 · 不可改写/);
});
test('重新回复发出安全重拟请求，不删除输入框里尚未发送的草稿',async()=>{
 let payload,c;c=client(async(url,o)=>{payload=JSON.parse(o.body);return {ok:true,json:async()=>c.response('discussed','已重拟')};});
 c.read("counselDrafts.council='尚未发送的草稿';");const id=c.state.discussions[0].messages[1].id;await c.click({counselRegenerate:id});assert.equal(payload.mode,'discuss');assert.equal(payload.rewrite.action,'regenerate');assert.equal(payload.rewrite.messageId,id);assert.equal(payload.rewrite.lastMessageId,id);assert.equal(c.read('counselDrafts.council'),'尚未发送的草稿');
});
test('编辑重发加载原话，取消后还原此前草稿，已经执行的记录不受影响',async()=>{
 const c=client(async()=>{throw Error('仅编辑草稿，不应请求服务');}),id=c.state.discussions[0].messages[0].id;
 c.read("counselDrafts.council='此前草稿';");await c.click({counselEdit:id});assert.equal(c.read('counselDrafts.council'),'请拟方案');assert.match(c.ctx.html,/正在修改原话/);assert.match(c.ctx.html,/修改并重新递呈/);await c.click({op:'counsel-edit-cancel'});assert.equal(c.read('counselDrafts.council'),'此前草稿');assert.equal(c.read('counselEditing'),null);assert.equal(c.state.actionsLeft,null);
});
test('议事页修改配置等操作结束后重新启用表单，防止忙碌状态残留',async()=>{
 let c;c=client(async()=>({ok:true,json:async()=>c.response('discussed','仅商议')}));c.read('close=()=>{};');await c.click({op:'enable-counsel-ai'});assert.equal(c.read('busy'),false);assert.doesNotMatch(c.ctx.html,/<textarea[^>]*disabled/);assert.doesNotMatch(c.ctx.html,/data-op="counsel-accept" disabled/);
});
test('旧存档零次剩余不再禁用施政按钮，议事页始终显示真实月份与不限次规则',()=>{
 const c=client(async()=>{throw Error('不应请求 AI');});Object.assign(c.state,{month:3,turn:2,actionsLeft:0});c.read('render()');assert.match(c.ctx.html,/崇祯元年 · 三月 · 每月施政不限次数/);const cards=c.read('actionCards()');assert.doesNotMatch(cards,/data-action="relief"[^>]*disabled/);assert.doesNotMatch(c.ctx.html,/施政余力|本月尚余/);
});
