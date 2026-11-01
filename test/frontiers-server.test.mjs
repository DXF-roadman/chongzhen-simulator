import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('在线献策照办、自然语言装备干预、海图资源与新存档 API',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-frontier-')),origin='http://127.0.0.1:18630';
 const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/mock-ai.mjs')).href,path.join(root,'server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18630',GAME_DATA_DIR:temp,DEEPSEEK_API_KEY:'mock-key-for-local-test'},stdio:'ignore'});
 try{
  let boot;for(let i=0;i<50;i++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot);
  const post=async(route,b={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token},body:JSON.stringify(b)});return {status:r.status,...await r.json()};};
  assert.ok(boot.catalog.equipment.length>=10);assert.ok(boot.catalog.seaRoutes.length===4);
  for(const f of ['frontiers.js','frontiers.css','unified-map.js','simplified.css','world-land.json'])assert.equal((await fetch(origin+'/'+f)).status,200,f);
  const index=await fetch(origin+'/').then(r=>r.text()),resources=[...index.matchAll(/(?:href|src)="(\/(?:[^"?]+\.(?:css|js)))(?:\?[^\"]*)?"/g)].map(m=>m[1]),seen=new Set();
  while(resources.length){const pathname=resources.pop();if(seen.has(pathname))continue;seen.add(pathname);const r=await fetch(origin+pathname);assert.equal(r.status,200,pathname);const source=await r.text();if(pathname.endsWith('.js'))for(const m of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g))resources.push('/'+m[1]);}
  assert.ok(seen.has('/unified-map.js'));assert.ok(seen.has('/simplified.css'));
  const land=await fetch(origin+'/world-land.json').then(r=>r.json());assert.ok(land.polygons.length>100);
  assert.equal((await post('intervene',{command:{type:'bogus'}})).status,400);
  let r=await post('new',{mode:'traveler'});assert.equal(r.state.traveler.enabled,true);
  await post('config',{enabled:true,model:'mock-frontier',baseUrl:'https://ai-test.invalid'});
  r=await post('counsel',{text:'请提出一份前线整军方案，本次先商议',mode:'auto'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.state.actionsLeft,null);assert.match(r.thread.messages.at(-1).content,/辽东军现有鸟铳/);assert.equal(r.thread.messages.at(-1).commands.length,0);
  r=await post('counsel',{text:'照办',mode:'auto'});assert.equal(r.thread.messages.at(-1).result.status,'executed');assert.equal(r.state.militaryState.units[0].equipment.matchlock,6000);assert.equal(r.state.militaryState.units[0].equipment.rifle,undefined);assert.equal(r.state.traveler.energy,100);assert.equal(r.state.traveler.identity,'hidden');
  await post('save',{slot:1});r=await post('load',{slot:1});assert.equal(r.state.militaryState.units[0].equipment.matchlock,6000);
  await post('new',{mode:'traveler'});
  r=await post('counsel',{text:'打开虫洞，掏出一台高达给辽东军',mode:'auto'});assert.equal(r.status,200);assert.equal(r.thread.messages.at(-1).result.status,'executed');assert.equal(r.state.traveler.portal,true);assert.equal(r.state.militaryState.units[0].equipment.gundam,1);assert.equal(r.state.projects.length,0);
  r=await post('intervene',{command:{type:'horizon',operation:'satellite'}});assert.equal(r.state.atlas.allVisible,true);assert.equal(r.state.atlas.segments.length,0);
  await post('new',{mode:'balanced'});r=await post('intervene',{command:{type:'horizon',operation:'voyage',route:'west'}});assert.equal(r.state.atlas.voyages.length,1);
  await post('event',{index:0});r=await post('advance');assert.equal(r.state.atlas.segments.length,1);assert.equal(r.state.atlas.discoveries.taiwan.visited,true);

  await post('new',{mode:'balanced'});
  r=await post('counsel',{text:'打开虫洞，掏出高达给辽东军',mode:'auto',offline:true});assert.equal(r.state.traveler.enabled,true);
  r=await post('counsel',{text:'命辽东军进攻后金，迂回包围',mode:'auto',offline:true});assert.equal(r.state.campaignState.battles[0].status,'active');
  for(let i=0;i<2;i++){if(r.state.event)await post('event',{index:0});r=await post('advance');}
  assert.equal(r.state.campaignState.control.liaoshen,'ming');assert.equal(r.state.provinces.length,13);
  r=await post('counsel',{text:'在辽沈地区开仓赈济',mode:'auto',offline:true});assert.equal(r.thread.messages.at(-1).result.status,'executed');
  assert.ok(r.state.provinces.find(p=>p.id==='occupied-liaoshen').unrest<65);
  await post('save',{slot:2});r=await post('load',{slot:2});assert.equal(r.state.campaignState.control.liaoshen,'ming');
  await post('shutdown');
 }finally{
  if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
  const resolved=path.resolve(temp);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('chongzhen-frontier-'));await fs.rm(resolved,{recursive:true,force:true});
 }
},{timeout:30000});
