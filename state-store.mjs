import fs from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import * as game from './engine.mjs';
import {isOrder} from './counsel.mjs';

const json=v=>JSON.parse(JSON.stringify(v));
function differences(a,b,p='',out=[]){
 if(isDeepStrictEqual(a,b)||out.length>=6)return out;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'){out.push(p);return out;}
 for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],p?p+'.'+k:k,out);
 return out;
}
const near=(a,b)=>Math.abs(a-b)<.0002;
export function assertLedger(s){
 const l=s.ledger;if(!l?.entries||l.openingMoney===undefined)return;
 const rows=l.entries.filter(e=>e.funding==='treasury');
 const total=k=>rows.reduce((n,e)=>n+e[k],0);
 if(!near(total('actualMoney'),l.expenses)||!near(total('actualGrain'),l.grainUse)||!near(l.revenue-l.expenses,l.net)||!near(l.openingMoney+l.net+(l.adjustments?.money||0),l.endingMoney)||!near(l.openingGrain+l.harvest-l.grainUse+(l.adjustments?.grain||0),l.endingGrain))throw Error('月结账簿收支不平，已阻止覆盖原存档。');
 for(const e of l.entries)if(e.actualMoney>e.money+.0001||e.actualGrain>e.grain+.0001||e.paused&&(e.paid||e.actualMoney||e.actualGrain)||e.paid&&(!near(e.money,e.actualMoney)||!near(e.grain,e.actualGrain)))throw Error('月结拨款与支付记录不一致，已阻止覆盖原存档。');
}
export function snapshotState(state){
 const next=json(state),readback=json(game.validateSave(next)),changed=differences(next,readback);
 if(changed.length)throw Error('状态无法完整保存（'+changed.join('、')+'），已保留原进度。');
 if(!isDeepStrictEqual(game.forecast(next),game.forecast(readback)))throw Error('存读档的月结预估不一致，已保留原进度。');
 assertLedger(next);return next;
}
export function restoreState(raw,{recover=true}={}){
 const payload=json(raw);delete payload.savedAt;
 let next=payload.stateSchema===1?snapshotState(payload):game.validateSave(payload);
 if(next.monthlyAuditVersion!==1)next=game.restoreMonthlyState(game.restoreEconomy(next));
 for(const thread of next.discussions)for(let i=1;i<thread.messages.length;i++){const m=thread.messages[i],prior=thread.messages[i-1];if(m.role==='assistant'&&m.result?.status==='discussed'&&prior.role==='user'&&isOrder(prior.content)&&!m.commands?.some(c=>c.type==='service')&&!m.orderText)m.orderText=prior.content;}
 // Recover interrupted requests only on load, never during a normal write.
 if(recover){for(const r of next.planningReminders)if(r.status==='pending')r.status='ready';if(next.service.story.pending){next.service.story.pending=false;next.service.story.lastTurn=null;}}
 return snapshotState(next);
}
export async function atomicJSON(file,value){
 const tmp=file+'.tmp';let handle;
 try{handle=await fs.open(tmp,'w');await handle.writeFile(JSON.stringify(value,null,2),'utf8');await handle.sync();await handle.close();handle=null;await fs.rename(tmp,file);}
 catch(e){if(handle)await handle.close();throw e;}
}
export class StateStore{
 constructor(directory){this.directory=directory;this.file=path.join(directory,'autosave.json');this.previous=path.join(directory,'autosave.previous.json');this.current=null;}
 async open(){
  let raw;
  try{raw=JSON.parse(await fs.readFile(this.file,'utf8'));}
  catch(e){
   if(e.code!=='ENOENT')throw Error('自动存档无法读取，原文件已保留，请从备份恢复。原因：'+e.message);
   try{await fs.access(this.previous);}catch(error){if(error.code!=='ENOENT')throw error;this.current=snapshotState(game.createGame());await atomicJSON(this.file,this.current);return this.current;}
   throw Error('自动存档缺失，但上一份存档仍在 autosave.previous.json，已停止新建游戏以保护进度。');
  }
  this.current=restoreState(raw);
  if(!isDeepStrictEqual(raw,this.current)){await fs.copyFile(this.file,path.join(this.directory,'autosave.before-upgrade-'+Date.now()+'.json'));await atomicJSON(this.file,this.current);}
  return this.current;
 }
 async commit(state){const next=snapshotState(state);if(this.current)await atomicJSON(this.previous,this.current);await atomicJSON(this.file,next);this.current=next;return next;}
 async saveSlot(slot,state){const file=this.slotFile(slot),next=snapshotState(state);try{await fs.copyFile(file,file+'.previous');}catch(e){if(e.code!=='ENOENT')throw e;}await atomicJSON(file,{...next,savedAt:new Date().toISOString()});}
 async loadSlot(slot){let raw;try{raw=JSON.parse(await fs.readFile(this.slotFile(slot),'utf8'));}catch{throw Error('此存档槽为空或不可读，原文件已保留。');}return restoreState(raw);}
 async slotSummary(slot){
  let raw;try{raw=JSON.parse(await fs.readFile(this.slotFile(slot),'utf8'));}catch(e){return e.code==='ENOENT'?{slot,empty:true}:{slot,invalid:true,error:'存档不可读，原文件已保留。'};}
  try{const s=restoreState(raw);return {slot,date:game.dateLabel(s),turn:s.turn,savedAt:raw.savedAt};}catch(e){return {slot,invalid:true,error:e.message};}
 }
 slotFile(slot){if(![1,2,3].includes(slot))throw Error('存档槽位无效');return path.join(this.directory,'slot-'+slot+'.json');}
}
