import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('真实 API：重放 AI 错把新密营配到京营的回复，先议后办、命令纠正、重启和配装上限',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-new-unit-')),origin='http://127.0.0.1:18998';await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({enabled:true,baseUrl:'https://new-unit-test.invalid',model:'mock-new-unit'}));
 let child,errors='';function start(){child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/new-units-mock-ai.mjs')).href,'server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18998',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:'new-unit-test-only'},stdio:['ignore','ignore','pipe']});child.stderr.on('data',d=>errors+=d);}
 const stop=async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}},boot=async()=>{for(let i=0;i<70;i++){try{return await fetch(origin+'/api/bootstrap').then(r=>r.json());}catch{await new Promise(r=>setTimeout(r,100));}}throw Error(errors);};
 try{start();let initial=await boot(),token=initial.token;const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};},text='朕命令你秘密筹备一支特种部队，使用现代装备，资金粮草装备由虫洞提供';
  let r=await post('counsel',{target:'office:guards',text,mode:'discuss'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.state.militaryState.units.length,3);assert.deepEqual(r.body.state.militaryState.units,initial.state.militaryState.units);const proposal=r.body.thread.messages.at(-1);assert.ok(proposal.commands.some(c=>c.operation==='create_unit'));assert.ok(!proposal.commands.some(c=>c.unit==='capital-army'));assert.equal(r.body.config.usage.requests,1);
  r=await post('counsel',{target:'office:guards',text:'照此办理',mode:'auto'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).result.status,'executed');assert.equal(r.body.config.usage.requests,1);const u=r.body.state.militaryState.units[3];assert.equal(u.equipment.rifle,30);assert.equal(u.needs.infantry,30);assert.equal(u.secret,true);assert.equal(u.institution,'office:guards');assert.equal(u.funding,'portal');assert.deepEqual(r.body.state.militaryState.units.slice(0,3),initial.state.militaryState.units);assert.equal(r.body.state.money,initial.state.money);assert.equal(r.body.state.projects.length,0);const saved=r.body.state;
  await post('save',{slot:1});await stop();start();initial=await boot();token=initial.token;assert.deepEqual(initial.state,saved);r=await post('load',{slot:1});assert.deepEqual(r.body.state,saved);r=await post('intervene',{command:{type:'arsenal',operation:'equip',unit:'capital-army',equipment:'rifle',quantity:5000,source:'portal'}});assert.equal(r.status,400);assert.match(r.body.error,/调整编制/);assert.deepEqual((await boot()).state,saved);assert.equal(errors,'');
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
},{timeout:20000});
