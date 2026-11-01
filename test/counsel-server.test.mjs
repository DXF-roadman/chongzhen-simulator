import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createGame,doAction} from '../engine.mjs';
import {advice,failedHistory,correctedBatch} from './batch-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('持续议事 API：上下文、直接办理、商议隔离、失败与存读档',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-counsel-')),port=18629,origin='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/mock-ai.mjs')).href,path.join(root,'server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),GAME_DATA_DIR:temp,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',d=>errors+=d);child.stdout.resume();
 try{
  let boot;for(let i=0;i<60;i++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot,errors);
  // These handcrafted imports model legacy histories and the old action quota format.
  const post=async(route,b={})=>{const payload=route==='import'?{...b,state:{...b.state,stateSchema:undefined}}:b;const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token,Origin:origin},body:JSON.stringify(payload)});return {status:r.status,body:await r.json()};};
  assert.ok(boot.catalog.counselTargets.some(t=>t.name==='毕自严'));assert.equal((await fetch(origin+'/counsel.css')).status,200);
  const pre=await post('preview',{text:'陕西开仓赈济',offline:true});
  const talk=await post('counsel',{text:'如果废内阁会怎样？',mode:'auto'});assert.equal(talk.status,200);assert.equal(talk.body.thread.messages.at(-1).result.status,'discussed');assert.equal(talk.body.state.government.cabinet,true);assert.equal(talk.body.state.actionsLeft,null);assert.equal(talk.body.state.money,460);
  assert.equal((await post('enact',{id:pre.body.id})).status,200,'商议不会使已审阅方案失效');
  await post('import',{state:createGame({seed:60})});
  const offline=await post('counsel',{text:'任命毕自严为户部尚书',mode:'auto'});assert.equal(offline.body.state.government.officeLeaders.revenue,'bi');assert.equal(offline.body.state.money,452);assert.equal(offline.body.state.actionsLeft,null);assert.equal(offline.body.thread.messages.at(-1).source,'offline');assert.equal(offline.body.thread.messages.at(-1).result.status,'executed');
  const hypothetical=await post('counsel',{text:'如果任命孙承宗管兵部呢？',mode:'auto'});assert.equal(hypothetical.body.state.government.officeLeaders.war,'civil-head-war');assert.equal(hypothetical.body.state.actionsLeft,null);
  await post('import',{state:createGame({seed:61})});
  const cfg=await post('config',{enabled:true,model:'mock-chat',baseUrl:'https://ai-test.invalid',key:'mock-key-for-local-test'});assert.equal(cfg.status,200);
  const question=await post('counsel',{text:'是否任命毕自严管户部？',target:'person:bi',mode:'auto'});assert.equal(question.status,200,JSON.stringify(question.body));assert.equal(question.body.thread.messages.at(-1).source,'ai');assert.equal(question.body.state.actionsLeft,null);assert.equal(question.body.state.government.officeLeaders.revenue,'civil-head-revenue');
  const follow=await post('counsel',{text:'继续说明成本',target:'person:bi',mode:'discuss'});assert.match(follow.body.thread.messages.at(-1).content,/承接前议/);assert.equal(follow.body.state.actionsLeft,null);
  const order=await post('counsel',{text:'照办',target:'person:bi',mode:'auto'});assert.equal(order.body.state.government.officeLeaders.revenue,'bi');assert.equal(order.body.state.actionsLeft,null);assert.equal(order.body.thread.messages.length,6);
  await post('save',{slot:1});const saved=await post('load',{slot:1});assert.equal(saved.body.state.discussions[0].messages.length,6);assert.equal(saved.body.state.government.officeLeaders.revenue,'bi');assert.ok(!JSON.stringify(saved.body).includes('mock-key-for-local-test'));
  await post('config',{enabled:true,model:'mock-chat-forged',baseUrl:'https://ai-test.invalid'});const before=saved.body.state.discussions[0].messages.length;
  const forged=await post('counsel',{text:'任命毕自严管户部'});assert.equal(forged.status,400);assert.match(forged.body.error,/不支持/);
  boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.equal(boot.state.discussions[0].messages.length,before);
  await post('config',{enabled:true,model:'mock-401',baseUrl:'https://ai-test.invalid'});assert.equal((await post('counsel',{text:'继续议政'})).status,400);
  await post('config',{enabled:true,model:'mock-chat',baseUrl:'https://ai-test.invalid'});const exhausted=createGame({seed:62});exhausted.actionsLeft=0;await post('import',{state:exhausted});
  const blocked=await post('counsel',{text:'任命毕自严为户部尚书'});assert.equal(blocked.status,200);assert.equal(blocked.body.thread.messages.at(-1).result.status,'executed');assert.equal(blocked.body.state.government.officeLeaders.revenue,'bi');assert.equal(blocked.body.state.money,452);
  const free=await post('counsel',{text:'今年局势如何？',mode:'discuss'});assert.equal(free.status,200);assert.equal(free.body.state.actionsLeft,null);
  await post('config',{enabled:true,model:'mock-chat-slow',baseUrl:'https://ai-test.invalid'});await post('import',{state:createGame({seed:63})});
  const delayed=post('counsel',{text:'任命毕自严为户部尚书'});await new Promise(r=>setTimeout(r,80));assert.equal((await post('action',{id:'audit'})).status,200);const stale=await delayed;assert.equal(stale.status,400);assert.match(stale.body.error,/局势已改变/);
  boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.equal(boot.state.government.officeLeaders.revenue,'civil-head-revenue');assert.equal(boot.state.discussions.length,0);

  const legacy=createGame({seed:64});
  legacy.discussions=[{id:'council',name:'御前议政',messages:[
   {role:'user',content:'宗禄改革怎么分步？',source:'player',commands:[],result:null},
   {role:'assistant',content:'议事答复：先清核宗籍，再给贫宗谋生出路。\n系统办理记录：仅作商议，本次没有改变钱粮、人事或施政次数。\n拟议事项：[]',source:'ai',commands:[],result:{status:'discussed',text:'仅作商议'},turn:0,date:'1628 · 正月'}
  ]}];
  const migrated=await post('import',{state:legacy});assert.equal(migrated.status,200);assert.equal(migrated.body.state.discussions[0].messages[1].content,'议事答复：先清核宗籍，再给贫宗谋生出路。');
  await post('config',{enabled:true,model:'mock-chat-echo',baseUrl:'https://ai-test.invalid'});
  const echoed=await post('counsel',{text:'继续谈谈建议',mode:'discuss'});assert.equal(echoed.status,200,JSON.stringify(echoed.body));
  const clean=echoed.body.thread.messages.at(-1);assert.doesNotMatch(clean.content,/系统办理记录|拟议事项/);assert.equal(clean.result.status,'discussed');assert.equal(clean.commands.length,0);assert.equal(echoed.body.state.money,460);assert.equal(echoed.body.state.actionsLeft,null);
  const applied=await post('counsel',{text:'照办',mode:'auto'});assert.equal(applied.status,200);assert.equal(applied.body.thread.messages.at(-1).result.status,'executed');assert.equal(applied.body.state.government.officeLeaders.revenue,'bi');assert.equal(applied.body.state.actionsLeft,null);assert.doesNotMatch(applied.body.thread.messages.at(-1).content,/系统办理记录|拟议事项/);
  await post('save',{slot:2});const cleanedLoad=await post('load',{slot:2});assert.ok(cleanedLoad.body.state.discussions[0].messages.filter(m=>m.role==='assistant').every(m=>!/系统办理记录[：:]|拟议事项[：:]/.test(m.content)));
  await post('config',{enabled:true,model:'mock-chat-empty',baseUrl:'https://ai-test.invalid'});
  const noReply=await post('counsel',{text:'继续商议',mode:'discuss'});assert.equal(noReply.status,400);assert.match(noReply.body.error,/有效答复/);

  const ready=createGame({seed:65});await post('import',{state:ready});
  await post('counsel',{text:'任命毕自严为户部尚书',mode:'discuss',offline:true});
  await post('config',{enabled:true,model:'mock-401',baseUrl:'https://ai-test.invalid'});
  const cachedBefore=await fetch(origin+'/api/bootstrap').then(r=>r.json());
  const cached=await post('counsel',{text:'照办',mode:'auto'});assert.equal(cached.status,200);assert.equal(cached.body.state.government.officeLeaders.revenue,'bi');assert.equal(cached.body.thread.messages.at(-1).source,'system');assert.equal(cached.body.config.usage.requests,cachedBefore.config.usage.requests,'已拟事项不再次调用故障中的 AI');
  const repeated=await post('counsel',{text:'照办',mode:'auto'});assert.equal(repeated.status,400);assert.match(repeated.body.error,/已经办理/);
  const repeatState=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.equal(repeatState.state.actionsLeft,null);assert.equal(repeatState.config.usage.requests,cachedBefore.config.usage.requests);
  const twoActions=createGame({seed:66});twoActions.actionsLeft=2;twoActions.event=null;await post('import',{state:twoActions});
  await post('config',{enabled:true,model:'mock-accept-recovery',baseUrl:'https://ai-test.invalid'});
  const suggestion=await post('counsel',{text:'请建议如何清核宗禄并派船通商',mode:'discuss'});assert.equal(suggestion.status,200);assert.equal(suggestion.body.state.actionsLeft,null);
  const usageBefore=suggestion.body.config.usage.requests;
  const recovered=await post('counsel',{text:'照办',mode:'auto'});assert.equal(recovered.status,200,JSON.stringify(recovered.body));assert.equal(recovered.body.thread.messages.at(-1).result.status,'executed');assert.equal(recovered.body.state.actionsLeft,null);assert.equal(recovered.body.state.agencies.length,1);assert.equal(recovered.body.state.agencies[0].name,'宗禄清核使');assert.equal(recovered.body.state.atlas.voyages.length,1);assert.equal(recovered.body.config.usage.requests,usageBefore+2,'第一次空回复后只重试一次');
  const duplicate=await post('counsel',{text:'照办',mode:'auto'});assert.equal(duplicate.status,400);assert.match(duplicate.body.error,/已经办理/);
  const broken=createGame({seed:67});broken.actionsLeft=2;broken.discussions=[{id:'council',name:'御前议政',messages:structuredClone(failedHistory)}];await post('import',{state:broken});
  await post('config',{enabled:true,model:'mock-batch-repair',baseUrl:'https://ai-test.invalid'});const repairUsage=(await fetch(origin+'/api/bootstrap').then(r=>r.json())).config.usage.requests;
  const fixed=await post('counsel',{text:'照办',mode:'auto'});assert.equal(fixed.status,200,JSON.stringify(fixed.body));assert.equal(fixed.body.thread.messages.at(-1).result.status,'executed');assert.equal(fixed.body.thread.messages.at(-1).commands.length,2);assert.equal(fixed.body.state.actionsLeft,null);assert.equal(fixed.body.state.agencies[0].leader,'bi');assert.equal(fixed.body.state.atlas.voyages.length,1);assert.equal(fixed.body.config.usage.requests,repairUsage+1,'失败缓存只调用一次 AI 修复');
  assert.equal((await post('counsel',{text:'照办'})).status,400);await post('save',{slot:3});assert.equal((await post('load',{slot:3})).body.state.agencies[0].leader,'bi');
  const fresh=createGame({seed:68});fresh.actionsLeft=2;fresh.discussions=[{id:'council',name:'御前议政',messages:[{role:'user',content:'请拟具体方案'},{role:'assistant',content:advice,source:'ai',commands:[],result:{status:'discussed',text:'仅商议'}}]}];await post('import',{state:fresh});await post('config',{enabled:true,model:'mock-batch-first-invalid',baseUrl:'https://ai-test.invalid'});
  const firstInvalid=await post('counsel',{text:'照办'});assert.equal(firstInvalid.status,200,JSON.stringify(firstInvalid.body));assert.equal(firstInvalid.body.thread.messages.at(-1).result.status,'executed');assert.equal(firstInvalid.body.config.usage.requests,repairUsage+3,'新生成错误批次也先修复再一次性办理');
  const low=createGame({seed:69});low.money=1;low.actionsLeft=1;low.discussions=[{id:'council',name:'御前议政',messages:[{role:'user',content:'先拟方案'},{role:'assistant',content:advice,source:'ai',commands:correctedBatch,result:{status:'discussed',text:'仅商议'}}]}];await post('import',{state:low});await post('config',{enabled:true,model:'mock-batch-repair',baseUrl:'https://ai-test.invalid'});
  const resource=await post('counsel',{text:'照办'});assert.equal(resource.status,200);assert.equal(resource.body.thread.messages.at(-1).result.status,'blocked');assert.equal(resource.body.state.agencies.length,0);assert.equal(resource.body.state.money,1);assert.equal(resource.body.state.actionsLeft,null);assert.equal(resource.body.config.usage.requests,repairUsage+3,'真实钱粮不足不请 AI 绕过约束');
  const assigned=doAction(createGame({seed:70}),'train',null,'bi');assigned.actionsLeft=1;const sameBatch=[{type:'duty',kind:'affair',target:assigned.affairs[0].id,official:'bi'},{type:'action',action:'relief',target:'shaanxi',official:'lu'}];
  assigned.discussions=[{id:'council',name:'御前议政',messages:[{role:'user',content:'照办'},{role:'assistant',content:'遵旨，按前议核验办理。',source:'system',commands:sameBatch,result:{status:'blocked',text:'第 1 项未能办理：负责人未变化。 本次整批未执行。'}}]}];await post('import',{state:assigned});await post('config',{enabled:true,model:'mock-401',baseUrl:'https://ai-test.invalid'});
  const sameUsage=(await fetch(origin+'/api/bootstrap').then(r=>r.json())).config.usage.requests,continued=await post('counsel',{text:'照办'});assert.equal(continued.status,200,JSON.stringify(continued.body));assert.equal(continued.body.thread.messages.at(-1).result.status,'executed');assert.equal(continued.body.state.actionsLeft,null);assert.equal(continued.body.state.money,assigned.money-16);assert.equal(continued.body.state.grain,assigned.grain-22);assert.equal(continued.body.config.usage.requests,sameUsage);assert.equal((await post('counsel',{text:'照办'})).status,400);
  await post('import',{state:createGame({seed:71})});await post('config',{enabled:true,model:'mock-chat',baseUrl:'https://ai-test.invalid'});
  const editable=await post('counsel',{text:'是否任命毕自严为户部尚书？',mode:'discuss'}),firstMessages=editable.body.thread.messages;
  const later=await post('counsel',{text:'继续说明成本',mode:'discuss'}),oldLast=later.body.thread.messages.at(-1).id;
  const regenerated=await post('counsel',{text:'任命毕自严为户部尚书',mode:'auto',rewrite:{action:'regenerate',messageId:firstMessages[1].id,lastMessageId:oldLast}});assert.equal(regenerated.status,200,JSON.stringify(regenerated.body));assert.equal(regenerated.body.thread.messages.length,2);assert.equal(regenerated.body.thread.messages[0].content,'是否任命毕自严为户部尚书？');assert.equal(regenerated.body.thread.messages[1].result.status,'discussed');assert.equal(regenerated.body.state.actionsLeft,null);assert.equal(regenerated.body.state.government.officeLeaders.revenue,'civil-head-revenue');assert.notEqual(regenerated.body.thread.messages[1].id,firstMessages[1].id);
  let editMessages=regenerated.body.thread.messages;
  const edited=await post('counsel',{text:'任命徐光启为礼部尚书',mode:'discuss',offline:true,rewrite:{action:'edit',messageId:editMessages[0].id,lastMessageId:editMessages.at(-1).id}});assert.equal(edited.status,200,JSON.stringify(edited.body));assert.equal(edited.body.thread.messages.length,2);assert.equal(edited.body.thread.messages[0].content,'任命徐光启为礼部尚书');assert.equal(edited.body.state.actionsLeft,null);assert.equal(edited.body.state.government.officeLeaders.rites,'civil-head-rites');
  editMessages=edited.body.thread.messages;const staleDelete=await post('counsel-delete',{target:'council',messageId:editMessages[0].id,lastMessageId:oldLast});assert.equal(staleDelete.status,400);assert.match(staleDelete.body.error,/记录已改变/);
  const deleted=await post('counsel-delete',{target:'council',messageId:editMessages[1].id,lastMessageId:editMessages[1].id});assert.equal(deleted.status,200);assert.equal(deleted.body.state.discussions.length,0);assert.equal(deleted.body.state.actionsLeft,null);assert.equal(deleted.body.state.money,460);
  await post('counsel',{text:'是否应该委任户部主官？',mode:'discuss',offline:true});const protectedOrder=await post('counsel',{text:'任命毕自严为户部尚书',offline:true}),protectedMessages=protectedOrder.body.thread.messages;
  for(const action of ['edit','regenerate']){const index=action==='edit'?2:3,r=await post('counsel',{text:'改成任命徐光启',offline:true,rewrite:{action,messageId:protectedMessages[index].id,lastMessageId:protectedMessages.at(-1).id}});assert.equal(r.status,400);assert.match(r.body.error,/已有政令执行/);}
  const protectedDelete=await post('counsel-delete',{target:'council',messageId:protectedMessages[0].id,lastMessageId:protectedMessages.at(-1).id});assert.equal(protectedDelete.status,400);assert.match(protectedDelete.body.error,/已有政令执行/);
  const safeTail=await post('counsel',{text:'下一步先讨论救荒',mode:'discuss',offline:true}),safeMessages=safeTail.body.thread.messages;
  const tailDelete=await post('counsel-delete',{target:'council',messageId:safeMessages.at(-1).id,lastMessageId:safeMessages.at(-1).id});assert.equal(tailDelete.status,200);assert.equal(tailDelete.body.state.discussions[0].messages.length,4);assert.equal(tailDelete.body.state.government.officeLeaders.revenue,'bi');assert.equal(tailDelete.body.state.money,452);assert.equal(tailDelete.body.state.actionsLeft,null);
  await post('save',{slot:3});const idRoundtrip=await post('load',{slot:3});assert.deepEqual(idRoundtrip.body.state.discussions[0].messages.map(m=>m.id),protectedMessages.map(m=>m.id));
  await post('import',{state:createGame({seed:72})});const pendingTalk=await post('counsel',{text:'钱粮如何开源？',mode:'discuss',offline:true}),pendingMessages=pendingTalk.body.thread.messages;
  await post('config',{enabled:true,model:'mock-401',baseUrl:'https://ai-test.invalid'});const failedRegenerate=await post('counsel',{text:pendingMessages[0].content,rewrite:{action:'regenerate',messageId:pendingMessages[1].id,lastMessageId:pendingMessages[1].id}});assert.equal(failedRegenerate.status,400);
  let unchangedTalk=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.deepEqual(unchangedTalk.state.discussions[0].messages.map(m=>m.id),pendingMessages.map(m=>m.id));
  await post('config',{enabled:true,model:'mock-chat-slow',baseUrl:'https://ai-test.invalid'});const pendingRegenerate=post('counsel',{text:pendingMessages[0].content,rewrite:{action:'regenerate',messageId:pendingMessages[1].id,lastMessageId:pendingMessages[1].id}});await new Promise(r=>setTimeout(r,80));assert.equal((await post('counsel-delete',{target:'council',messageId:pendingMessages[0].id,lastMessageId:pendingMessages[1].id})).status,200);const staleRegenerate=await pendingRegenerate;assert.equal(staleRegenerate.status,400);assert.match(staleRegenerate.body.error,/记录已改变/);unchangedTalk=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.equal(unchangedTalk.state.discussions.length,0);assert.equal(unchangedTalk.state.money,460);
  await post('config',{enabled:true,model:'mock-event-recovery',baseUrl:'https://ai-test.invalid'});
  for(const cached of [false,true]){
   const census=createGame({seed:cached?75:74});Object.assign(census,{month:3,turn:2,event:null,money:316,grain:148,actionsLeft:cached?2:0});census.discussions=[{id:'council',name:'御前议政',messages:[{role:'user',content:'粮紧怎么办？'},{role:'assistant',content:'先核实辽镇兵额，由卢象升抽点督办，清理虚报冒饷。',source:'ai',commands:[],result:{status:'discussed',text:'仅商议'}}]}];
   if(cached)census.discussions[0].messages.push({role:'user',content:'照办'},{role:'assistant',content:'臣遵旨核兵。',source:'ai',commands:[{type:'event',index:0,official:'lu',eventTurn:2}],result:{status:'blocked',text:'本月奏报已处置。'}});
   await post('import',{state:census});const startUsage=(await fetch(origin+'/api/bootstrap').then(r=>r.json())).config.usage.requests;
   if(cached){const explanation=await post('counsel',{text:'为什么不能办，什么叫奏报已经处置？'});assert.equal(explanation.status,200);assert.equal(explanation.body.thread.messages.at(-1).source,'system');assert.match(explanation.body.thread.messages.at(-1).content,/三月/);assert.equal(explanation.body.config.usage.requests,startUsage);}
   const censusOrder=await post('counsel',{text:cached?'照办':'好 先办此一件'});assert.equal(censusOrder.status,200,JSON.stringify(censusOrder.body));assert.equal(censusOrder.body.thread.messages.at(-1).result.status,'executed');assert.equal(censusOrder.body.state.projects[0].leader,'lu');assert.equal(censusOrder.body.state.money,280);assert.equal(censusOrder.body.state.grain,146);assert.equal(censusOrder.body.state.month,3);assert.equal(censusOrder.body.state.actionsLeft,null);assert.equal(censusOrder.body.config.usage.requests,startUsage+(cached?1:2));
   const dateCheck=await post('counsel',{text:'现在不就是三月吗'});assert.equal(dateCheck.body.thread.messages.at(-1).source,'system');assert.match(dateCheck.body.thread.messages.at(-1).content,/三月/);assert.match(dateCheck.body.thread.messages.at(-1).content,/取消上限/);assert.equal(dateCheck.body.config.usage.requests,censusOrder.body.config.usage.requests);const noRepeat=await post('counsel',{text:'照办'});assert.equal(noRepeat.status,400);assert.match(noRepeat.body.error,/已经办理/);
  }
  assert.equal((await post('shutdown')).status,200);await new Promise((resolve,reject)=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(()=>reject(Error('Shutdown timeout')),3000);child.once('exit',()=>{clearTimeout(timer);resolve();});});assert.equal(child.exitCode,0);
 }finally{
  if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
  if(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('chongzhen-counsel-'))await fs.rm(temp,{recursive:true,force:true});
 }
},{timeout:30000});
