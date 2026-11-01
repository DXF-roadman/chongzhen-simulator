import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {counselTargets,localCounsel,executeCommands} from '../counsel.mjs';
import {armory,voyagePanel,frontierForm,frontierCommand} from '../public/frontiers.js';
import {mountainMap,mapBounds,moveMap,mapLayers,mapSvg} from '../public/unified-map.js';
import {campaignPanel,territoryDetail,warForm} from '../public/campaigns.js';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
function catalog(s){return {actions:g.ACTIONS,equipment:g.equipmentCatalog(s),officials:g.officialCatalog(s),offices:g.coreOffices(s),meta:g.META,domains:g.TECH_DOMAINS,powers:g.POWERS,categories:g.CATEGORIES,templates:g.TEMPLATES,places:g.PLACES,seaRoutes:g.SEA_ROUTES,regions:g.REGIONS,tactics:g.TACTICS,counselTargets:counselTargets(s)};}
function client(s=g.createGame(),responder=null){
 const handlers={},app={innerHTML:''},modal={open:false,showModal(){this.open=true;},close(){this.open=false;}},canvas={setAttribute(k,v){this[k]=v;},getBoundingClientRect:()=>({width:900,height:600})},notice={textContent:'',classList:{add(){},remove(){}}},input={focus(){}};
 const initial={state:s,catalog:catalog(s),forecast:g.forecast(s),administration:g.administration(s),config:{enabled:false,hasKey:false,usage:{requests:0,totalTokens:0}}};
 const fields={'#fiscal-official':{value:'bi'},'#fiscal-monthly':{value:'1'}};
 const ctx=vm.createContext({initial,mountainMap,mapBounds,moveMap,mapLayers,armory,voyagePanel,frontierForm,frontierCommand,campaignPanel,territoryDetail,warForm,AbortSignal,console,document:{querySelector:q=>({'#app':app,'#modal':modal,'[data-map-canvas]':canvas,'#toast':notice,'#counsel-input':input,...fields}[q]||null),addEventListener:(name,fn)=>handlers[name]=fn,body:{classList:{add(){},remove(){}}}},window:{scrollTo(){}},setTimeout:()=>1,clearTimeout(){},fetch:responder||(()=>{throw Error('浏览与切换页面不能发起请求');})});
 vm.runInContext(source,ctx);vm.runInContext('S=initial.state;cat=initial.catalog;C=initial.config;F=initial.forecast;A=initial.administration;T="test";',ctx);
 return {ctx,app,modal,canvas,handlers,read:code=>vm.runInContext(code,ctx),click:dataset=>handlers.click({target:{closest:()=>({dataset,disabled:false,hasAttribute:()=>false})},preventDefault(){}})};
}
test('七个主入口各只渲染一个工作区，旧导航跳到合并页；首页始终只有一张地图',async()=>{
 const c=client();c.read('render()');assert.equal((c.app.innerHTML.match(/class="nav-item /g)||[]).length,7);assert.equal((c.app.innerHTML.match(/class="unified-map"/g)||[]).length,1);assert.doesNotMatch(c.app.innerHTML,/territory-map|atlas-panel|id="edict-text"|高达|卫星|虫洞/);
 for(const nav of ['counsel','institutions','armory','treasury','planning','chronicle','court']){await c.click({nav});assert.equal(c.read('view'),nav);assert.doesNotMatch(c.app.innerHTML,/undefined|NaN/);assert.equal((c.app.innerHTML.match(/class="unified-map"/g)||[]).length,nav==='court'?1:0);}
 for(const [nav,view,tab]of [['affairs','institutions','actions'],['officials','institutions','people'],['duties','institutions','tasks'],['innovation','chronicle','innovation']]){await c.click({nav});assert.equal(c.read('view'),view);assert.equal(c.read(view==='institutions'?'institutionTab':'archiveTab'),tab);}
 await c.click({nav:'world'});assert.equal(c.read('view'),'court');assert.equal(c.read('landingTab'),'voyages');assert.equal(c.read('mapMode'),'routes');assert.equal((c.app.innerHTML.match(/class="unified-map"/g)||[]).length,1);assert.match(c.app.innerHTML,/探航与船队/);
});
test('机构合并后看成果、任主官、改预算与差遣仍可达，标签页不会堆叠各套完整列表',async()=>{
 let s=g.createGame();s=g.applyEdict(s,g.localEdict(s,'设立农政试验署'));s=g.doAction(s,'irrigation','shaanxi','song');const c=client(s);
 await c.click({nav:'institutions'});assert.match(c.app.innerHTML,/<h2>锦衣卫<\/h2>/);assert.match(c.app.innerHTML,/data-agency-budget="agency-1"/);assert.match(c.app.innerHTML,/data-agency-edit="agency-1"/);assert.match(c.app.innerHTML,/data-institution-report="office:guards"/);assert.doesNotMatch(c.app.innerHTML,/class="official-card|class="duty-card/);
 for(const tab of ['people','tasks','actions','system','offices']){await c.click({pageTab:'institution',tab});assert.equal(c.read('institutionTab'),tab);assert.doesNotMatch(c.app.innerHTML,/undefined|NaN/);}
 await c.click({pageTab:'institution',tab:'tasks'});assert.match(c.app.innerHTML,/兴修水利/);assert.match(c.app.innerHTML,/data-duty-id=/);assert.doesNotMatch(c.app.innerHTML,/class="institution-card/);
 await c.click({pageTab:'institution',tab:'people'});assert.match(c.app.innerHTML,/宋应星/);assert.match(c.app.innerHTML,/招安与人才线索/);assert.doesNotMatch(c.app.innerHTML,/class="duty-card/);
});
test('本地、已知外地及征服地区共用地图点击和政务，所有选择都不变更游戏状态',async()=>{
 const s=g.createGame(),before=structuredClone(s),c=client(s);c.read('render()');await c.click({mapRegion:'shaanxi'});assert.equal(c.read('selected'),'shaanxi');assert.match(c.modal.innerHTML,/陕西 · 地方政务/);assert.match(c.modal.innerHTML,/data-region-action="irrigation"/);
 await c.click({mapRegion:'liaoshen'});assert.match(c.modal.innerHTML,/皇太极/);assert.match(c.modal.innerHTML,/部署出征/);await c.click({mapPlace:'macau'});assert.match(c.modal.innerHTML,/澳门 · 见闻/);assert.deepEqual(s,before);
 let conquered=g.intervene(g.createGame({mode:'traveler'}),{type:'horizon',operation:'summon_mecha'});conquered=g.intervene(conquered,{type:'war',operation:'attack',target:'liaoshen',unit:'liaodong-army',tactic:'encircle'});for(let i=0;i<2;i++){if(conquered.event)conquered=g.resolveEvent(conquered,0);conquered=g.advance(conquered);}assert.equal(conquered.campaignState.control.liaoshen,'ming');
 const foreign=client(conquered);await foreign.click({mapRegion:'liaoshen'});assert.equal(foreign.read('selected'),'occupied-liaoshen');assert.match(foreign.modal.innerHTML,/新附领地/);assert.match(foreign.modal.innerHTML,/data-province-id="occupied-liaoshen"/);
});
test('图层、视野、滚轮与拖动只改相机；拖动不会误打开地方政务',async()=>{
 const c=client(),before=structuredClone(c.ctx.initial.state);c.read('render()');await c.click({mapLayer:'military'});assert.match(c.app.innerHTML,/皇太极 · 敌/);assert.match(c.app.innerHTML,/辽东军/);await c.click({mapMove:'in'});const zoom=c.read('mapView[2]');assert.ok(zoom<120);
 c.handlers.wheel({target:{closest:()=>c.canvas},deltaY:1,preventDefault(){}});assert.ok(c.read('mapView[2]')>zoom);assert.ok(c.canvas.viewBox);
 c.handlers.pointerdown({button:0,target:{closest:()=>c.canvas},clientX:400,clientY:300});c.handlers.pointermove({clientX:500,clientY:330});assert.equal(c.read('mapGesture.moved'),true);await c.click({mapRegion:'shaanxi'});assert.equal(c.modal.open,false);assert.equal(c.read('mapGesture'),null);assert.deepEqual(c.ctx.initial.state,before);
 await c.click({pageTab:'landing',tab:'voyages'});assert.equal(c.read('mapMode'),'routes');assert.match(c.app.innerHTML,/西洋探航/);
});
test('军务详细配置按需展开，开启隐藏模式也不暴露未取得的未来武器或发射按钮',async()=>{
 const s=g.createGame({mode:'traveler'}),c=client(s);await c.click({nav:'armory'});await c.click({pageTab:'military',tab:'equipment'});assert.match(c.app.innerHTML,/<details class="panel folded-panel equipment-detail">/);assert.doesNotMatch(c.app.innerHTML,/高达|机甲|全军机械化|发射卫星|现代步枪/);
 const form=frontierForm('design',s,c.ctx.initial.catalog).html;assert.doesNotMatch(form,/高达|机甲|现代步枪/);
 const advice=localCounsel(s,{id:'council',name:'御前议政'},'军备如何整备，有什么建议？');assert.doesNotMatch(advice.reply,/现代|高达|机甲|卫星/);assert.equal(executeCommands(s,advice.commands).state.traveler.energy,100);
 const after=g.intervene(s,{type:'arsenal',operation:'modernize',scope:'frontier',source:'period'});assert.equal(after.traveler.energy,100);assert.equal(after.militaryState.units[0].preferred.infantry,'matchlock');assert.equal(after.militaryState.stock.rifle,undefined);assert.ok(after.militaryState.lines.every(l=>g.equipmentCatalog(after).find(e=>e.id===l.equipment).era!=='future'));
 const explicit=g.intervene(s,{type:'horizon',operation:'summon_mecha'});assert.match(armory(explicit,catalog(explicit)),/高达/);
 const advanced=g.intervene(s,{type:'arsenal',operation:'modernize',scope:'frontier'}),energy=advanced.traveler.energy,restocked=g.intervene(advanced,{type:'arsenal',operation:'modernize',scope:'frontier',source:'period'});assert.equal(restocked.militaryState.units[0].preferred.infantry,'rifle');assert.equal(restocked.traveler.energy,energy);assert.equal(restocked.militaryState.units[0].equipment.rifle,advanced.militaryState.units[0].equipment.rifle);
});
test('实测航路跨日期变更线正确分段，未知地点不泄漏，地图切换与导出不修改存档',()=>{
 let s=g.createGame();const before=structuredClone(s),cat=catalog(s),normal=mapSvg(s,cat,null);assert.doesNotMatch(normal,/英吉利|南美东岸|好望角/);assert.deepEqual(s,before);const small=moveMap(mapBounds(s,cat),'in');assert.ok(small[2]<mapBounds(s,cat)[2]);
 s=g.createGame({mode:'traveler'});s.navy=30;s.money=99999;s.grain=99999;s=g.intervene(s,{type:'horizon',operation:'voyage',route:'pacific'});for(let i=0;i<5;i++){if(s.event)s=g.resolveEvent(s,0);s=g.advance(s);}const html=mapSvg(s,catalog(s),null,{layer:'routes',bounds:mapBounds(s,catalog(s),'known')});assert.match(html,/surveyed-route/);assert.match(html,/L1080,[\d.]+M0,/);assert.match(html,/太平洋中部群岛/);assert.deepEqual(g.validateSave(s).atlas,s.atlas);
});
test('已知天下视野随新发现自动扩展，手动缩放后保留玩家相机',async()=>{
 let s=g.createGame();s.money=99999;s.grain=99999;s=g.intervene(s,{type:'horizon',operation:'voyage',route:'west'});const c=client(s);await c.click({nav:'world'});const width=c.read('mapOptions().bounds[2]');
 for(let i=0;i<5;i++){if(s.event)s=g.resolveEvent(s,0);s=g.advance(s);}c.ctx.updated=s;c.read('S=updated;render();');assert.ok(c.read('mapOptions().bounds[2]')>width);await c.click({mapMove:'in'});const manual=Array.from(c.read('mapOptions().bounds'));c.read('S.atlas.discoveries.cape={turn:S.turn,source:"voyage",visited:true};render();');assert.deepEqual(Array.from(c.read('mapOptions().bounds')),manual);
});
test('钱粮页的个人月俸表单提交真实 fiscal 指令，刷新后显示实际费用而非起用费',async()=>{
 const s=g.assignOfficeLeader(g.createGame(),'revenue','bi');let request;const c=client(s,async(url,options)=>{request={url,body:JSON.parse(options.body)};const next=g.setFiscal(s,request.body.command);return {ok:true,json:async()=>({state:next,forecast:g.forecast(next),administration:g.administration(next),officials:g.officialCatalog(next),offices:g.coreOffices(next)})};});
 c.read("view='treasury';render();");assert.match(c.app.innerHTML,/薪俸与常设经费/);assert.match(c.app.innerHTML,/id="fiscal-salary-form"/);await c.read('submitSalary()');assert.equal(request.url,'/api/fiscal');assert.equal(request.body.command.scope,'person');assert.equal(request.body.command.official,'bi');assert.equal(request.body.command.monthly,1);assert.equal(c.read('S.fiscal.salaries.bi'),1);assert.equal(c.read('cat.officials.find(o=>o.id==="bi").monthlyPay'),1);assert.equal(c.read('S.money'),s.money);
});
