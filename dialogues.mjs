import {civilOfficials,civilCanServe} from './civil-service.mjs';
import {NATIVE_OFFICIALS,recruitedOfficials} from './talents.mjs';
import {coreOffices,currentPosts,postLabel} from './assignments.mjs';
import {prunePlanningSources} from './records.mjs';
import {cleanCounselText} from './counsel-text.mjs';
import {randomUUID} from 'node:crypto';
export function counselTargets(s){
 const people=[...NATIVE_OFFICIALS,...recruitedOfficials(s),...civilOfficials(s)],seen=new Set(people.map(o=>o.id));
 for(const t of s.talents||[])if(!seen.has(t.id)&&t.status!=='departed')people.push({...t,role:t.status==='negotiating'?'招安交涉中':t.status==='rebelled'?'再叛首领':'尚未归附的地方首领'});
 return [{id:'council',name:'御前议政',group:'群议',bio:'汇集六部及受命官员的意见。'},...people.map(o=>{const serving=civilCanServe(s,o.id)||NATIVE_OFFICIALS.some(p=>p.id===o.id)||recruitedOfficials(s).some(p=>p.id===o.id),position=serving?postLabel(currentPosts(s,o.id)):o.role;return {id:'person:'+o.id,name:o.name,displayName:o.name+' · '+position,group:'人物',bio:'本局当前职务：'+position+'。人物背景：'+o.role+'。'+(o.bio||'')};}),...coreOffices(s).map(o=>({id:'office:'+o.id,name:o.name,group:'衙门',bio:o.mandate+' 主官：'+(people.find(p=>p.id===o.leader)?.name||'由属官备询')})),...(s.agencies||[]).map(a=>({id:'agency:'+a.id,name:a.name,group:'衙门',bio:a.mandate+' 主官：'+(people.find(p=>p.id===a.leader)?.name||'尚未专任')}))];
}
const plain=(v,n)=>String(v||'').slice(0,n);
export function trimDiscussions(threads){
 const sizeOf=m=>m.content.length+JSON.stringify(m.commands||[]).length+(m.result?.text?.length||0)+150;
 threads=threads.slice(0,24);let size=threads.reduce((n,t)=>n+t.messages.reduce((a,m)=>a+sizeOf(m),0),0);
 while(size>90000&&threads.length){const t=threads.at(-1),removed=t.messages.splice(0,2);size-=removed.reduce((n,m)=>n+sizeOf(m),0);if(!t.messages.length)threads.pop();}
 return threads;
}
export function validateDiscussions(raw,s){
 const rows=raw.discussions||[];if(!Array.isArray(rows)||rows.length>24||new Set(rows.map(t=>t.id)).size!==rows.length)throw Error('存档议事记录无效。');
 s.discussions=trimDiscussions(rows.map(t=>{
  if(typeof t.id!=='string'||!(/^(?:council|person:[\w-]+|office:[\w-]+|agency:[\w-]+)$/.test(t.id))||!Array.isArray(t.messages)||t.messages.length>40)throw Error('存档议事对象或对话无效。');
  const ids=new Set();return {id:t.id,name:plain(t.name,60),messages:t.messages.map(m=>{
   if(!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>5000)throw Error('存档议事内容无效。');
   const id=m.id===undefined?randomUUID():m.id;if(typeof id!=='string'||!/^[\w-]{1,80}$/.test(id)||ids.has(id))throw Error('存档议事消息编号无效或重复。');ids.add(id);
   // Proposals remain data; execution always revalidates them through the game engine.
   if(m.commands&&JSON.stringify(m.commands).length>30000)throw Error('存档拟议事项过长。');
   const commands=m.role==='assistant'&&Array.isArray(m.commands)?JSON.parse(JSON.stringify(m.commands)):[];
   if(commands.length>6)throw Error('存档拟议事项过多。');
   return {id,...(m.orderText&&!commands.some(c=>c.type==='service')?{orderText:plain(m.orderText,2000)}:{}),...(m.speakerLabel?{speakerLabel:plain(m.speakerLabel,300)}:{}),...(m.planRef?{planRef:plain(m.planRef,80)}:{}),role:m.role,content:m.role==='assistant'?(cleanCounselText(m.content)||'此条答复没有有效正文，请查看独立办理记录。'):plain(m.content,2000),turn:Math.max(0,Math.floor(Number(m.turn)||0)),date:plain(m.date,40),source:['ai','offline','player','system'].includes(m.source)?m.source:'offline',commands,result:m.result?{status:['executed','blocked','discussed'].includes(m.result.status)?m.result.status:'discussed',text:plain(m.result.text,2000)}:null};
  })};
 }));
}
export function appendDiscussion(s,target,text,reply,commands,result,source,date){
 const old=(s.discussions||[]).find(t=>t.id===target.id),stamp={turn:s.turn,date};
 const messages=[...(old?.messages||[]),{...stamp,id:randomUUID(),role:'user',content:text,source:'player',commands:[],result:null},{...stamp,id:randomUUID(),role:'assistant',speakerLabel:target.displayName||target.name,content:cleanCounselText(reply),source,commands,result}].slice(-40);
 s.discussions=trimDiscussions([{id:target.id,name:target.name,messages},...(s.discussions||[]).filter(t=>t.id!==target.id)]);
 return s.discussions[0];
}
export function discussionRevision(s,target,messageId){
 const thread=(s.discussions||[]).find(t=>t.id===target),messages=thread?.messages||[],index=messages.findIndex(m=>m.id===messageId);
 if(index<0)throw Error('这条对话已变化或已不在近期记录中，请刷新后重试。');
 let start=index;while(start>=0&&messages[start].role!=='user')start--;
 if(start<0)throw Error('这条答复缺少对应的原话，无法改写；请另发新消息。');
 if(messages.slice(start).some(m=>m.result?.status==='executed'))throw Error('本轮或后续已有政令执行，不能删除、修改或重新回复。请另发新消息继续议事。');
 return {target,start,selectedRole:messages[index].role,input:messages[start].content,history:messages.slice(0,start),removed:messages.length-start};
}
export function cutDiscussion(s,revision){
 const thread=s.discussions.find(t=>t.id===revision.target);if(!thread)throw Error('议事记录已变化，请刷新后重试。');
 prunePlanningSources(s,thread.messages.slice(revision.start).map(m=>m.id));
 if(revision.history.length)thread.messages=revision.history;
 else s.discussions=s.discussions.filter(t=>t.id!==revision.target);
}
