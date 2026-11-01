import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {privacyGame} from './privacy-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('真实 API：仅商议中私述也记住机构，群议与别署请求不含秘密，存读重启保密，明确公开才公开',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-privacy-')),origin='http://127.0.0.1:18999';await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({enabled:true,baseUrl:'https://privacy-test.invalid',model:'mock-privacy'}));let child,errors='';
 function start(){child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/privacy-mock-ai.mjs')).href,'server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18999',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:'privacy-test-only'},stdio:['ignore','ignore','pipe']});child.stderr.on('data',d=>errors+=d);}
 const stop=async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}},boot=async()=>{for(let i=0;i<70;i++){try{return await fetch(origin+'/api/bootstrap').then(r=>r.json());}catch{await new Promise(r=>setTimeout(r,100));}}throw Error(errors);};
 try{start();let b=await boot(),token=b.token;const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
  const initial=privacyGame({known:false});let r=await post('import',{state:initial});assert.equal(r.status,200,JSON.stringify(r.body));r=await post('counsel',{target:'office:guards',text:'仅由锦衣卫所知，朕其实是穿越者',mode:'discuss'});assert.equal(r.status,200,JSON.stringify(r.body)+errors);assert.equal(r.body.state.traveler.identity,'hidden');assert.deepEqual(r.body.state.traveler.knownTo,['office:guards','civil-head-guards']);assert.equal(r.body.state.traveler.energy,137);assert.equal(r.body.state.money,initial.money);assert.equal(r.body.state.legitimacy,initial.legitimacy);assert.deepEqual(r.body.state.factions,initial.factions);assert.match(r.body.thread.messages.at(-1).result.text,/仅私下/);
  for(const target of ['council','office:war']){r=await post('counsel',{target,text:'请据普通军务献策',mode:'discuss'});assert.equal(r.status,200,JSON.stringify(r.body)+errors);assert.equal(r.body.state.traveler.identity,'hidden');assert.deepEqual(r.body.state.traveler.knownTo,['office:guards','civil-head-guards']);assert.equal(r.body.state.militaryState.units.at(-1).secret,true,'玩家仍能查看完整真实存档');}
  await post('save',{slot:1});const saved=r.body.state;await stop();start();b=await boot();token=b.token;assert.deepEqual(b.state,saved);r=await post('load',{slot:1});assert.deepEqual(r.body.state,saved);r=await post('counsel',{target:'council',text:'向百官公开穿越者身份',mode:'auto',offline:true});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).result.status,'executed');assert.equal(r.body.state.traveler.identity,'disclosed');assert.equal(r.body.state.money,saved.money);assert.equal(r.body.state.legitimacy,saved.legitimacy+5);assert.equal(errors,'');
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
},{timeout:20000});
