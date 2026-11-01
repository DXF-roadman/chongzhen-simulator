import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('直接向机构交办确实记录任务归属，跨月结案后保存成果，商议不冒充执行',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-institutions-')),origin='http://127.0.0.1:18635',child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18635',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);child.stdout.resume();
 try{
  let boot;for(let i=0;i<60;i++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot,errors);
  const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
  const discuss=await post('counsel',{target:'office:works',text:'水利有什么建议？',mode:'discuss',offline:true});assert.equal(discuss.status,200);assert.equal(discuss.body.state.institutionReports.length,0);assert.equal(discuss.body.state.projects.length,0);
  const work=await post('counsel',{target:'office:works',text:'在陕西兴修水利',mode:'auto',offline:true});assert.equal(work.status,200,JSON.stringify(work.body));let s=work.body.state;assert.equal(s.projects[0].institution,'office:works');assert.equal(s.institutionReports[0].kind,'order');assert.equal(s.institutionReports[0].institution,'office:works');assert.equal(s.institutionReports.filter(r=>r.kind==='completion').length,0);
  await post('save',{slot:1});s=(await post('load',{slot:1})).body.state;assert.equal(s.projects[0].institution,'office:works');
  for(let i=0;i<3;i++){if(s.event)await post('event',{index:Math.min(2,s.event.options.length-1)});const advanced=await post('advance');assert.equal(advanced.status,200,JSON.stringify(advanced.body));s=advanced.body.state;}
  assert.equal(s.projects.length,0);assert.ok(s.institutionReports.some(r=>r.institution==='office:works'&&r.kind==='completion'&&r.title.includes('兴修水利')));assert.ok(s.institutionReports.some(r=>r.kind==='month'&&r.institution==='office:revenue'));
  await post('save',{slot:2});assert.deepEqual((await post('load',{slot:2})).body.state.institutionReports,s.institutionReports);
  const original='其实我是穿越者 这300万两白银 300万石粮食你先偷偷拿去补足亏空 同时另有50万两白银';
  const discussed=await post('counsel',{target:'person:sun',text:original,mode:'discuss',offline:true});assert.equal(discussed.status,200);assert.equal(discussed.body.state.traveler.enabled,false);assert.equal(discussed.body.thread.messages.at(-1).orderText,original);assert.match(discussed.body.thread.messages.at(-1).result.text,/仅商议模式/);
  const shipped=await post('counsel',{target:'person:sun',text:original,mode:'auto',offline:true});assert.equal(shipped.status,200,JSON.stringify(shipped.body));assert.equal(shipped.body.thread.messages.at(-1).result.status,'executed');assert.equal(shipped.body.state.money,s.money+350);assert.equal(shipped.body.state.grain,s.grain+300);assert.deepEqual(shipped.body.state.traveler.knownTo,['sun']);assert.equal(shipped.body.state.traveler.identity,'hidden');assert.equal(shipped.body.state.traveler.supplies.length,1);assert.equal(errors,'');
 }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));await fs.rm(dir,{recursive:true,force:true});}
});
