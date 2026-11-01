import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {counselTargets} from '../counsel.mjs';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
function client(s){const handlers={},requests=[],notice={textContent:'',classList:{add(){},remove(){}}},packet=state=>({state,config:{enabled:false},forecast:g.forecast(state),administration:g.administration(state),officials:g.officialCatalog(state),offices:g.coreOffices(state),counselTargets:counselTargets(state)}),initial={...packet(s),catalog:{meta:g.META,officials:g.officialCatalog(s),offices:g.coreOffices(s),domains:g.TECH_DOMAINS,powers:g.POWERS,actions:g.ACTIONS,counselTargets:counselTargets(s)}};
 const ctx=vm.createContext({initial,AbortSignal,console,document:{querySelector:q=>q==='#toast'?notice:null,addEventListener:(event,cb)=>handlers[event]=cb,body:{classList:{add(){},remove(){}}}},window:{scrollTo(){}},setTimeout:()=>1,clearTimeout(){},recordHTML:html=>ctx.html=html,fetch:async(url,o)=>{const body=JSON.parse(o.body);requests.push({url,body});const state=g.resolveEvent(s,body.index,null,{petition:body.petition});return {ok:true,json:async()=>packet(state)};}});vm.runInContext(source,ctx);vm.runInContext("S=initial.state;C=initial.config;F=initial.forecast;A=initial.administration;cat=initial.catalog;T='test';open=(title,html)=>recordHTML(html);close=()=>{};render=()=>{};",ctx);
 return {requests,read:code=>vm.runInContext(code,ctx),click:dataset=>handlers.click({target:{closest:()=>({dataset,disabled:false,hasAttribute:()=>false})},preventDefault(){}}),html:()=>ctx.html};}
test('原页面可免费留中并继续月结，留中案卷可重看，按钮请求带上正确案卷编号',async()=>{
 const s=g.createGame(),c=client(s);await c.read('next()');assert.match(c.html(),/结算本月/);assert.match(c.html(),/免费留中/);c.read('showPetition()');assert.match(c.html(),/data-event="-1"/);await c.click({event:'-1'});assert.equal(c.requests[0].body.index,-1);assert.equal(c.read('S.event'),null);
 const held=g.resolveEvent(s,-1),d=client(held),id=held.affairs.find(a=>a.petition).id;assert.match(d.read('dutyDesk()'),/data-petition=/);await d.click({petition:id});assert.match(d.html(),new RegExp('data-petition-id="'+id+'"'));await d.click({event:'1',petitionId:id});assert.equal(d.requests[0].body.petition,id);
});

test('裁撤先展示训练和装备的具体后果，打开说明不会直接删除部队或发送请求',async()=>{
 const s=g.createGame(),c=client(s);await c.click({frontDisband:'liaodong-army'});assert.equal(c.requests.length,0);assert.match(c.html(),/不会自动恢复.*训练记录/);assert.match(c.html(),/data-front-disband-confirm="liaodong-army"/);assert.equal(c.read('S.militaryState.units.length'),3);
});
