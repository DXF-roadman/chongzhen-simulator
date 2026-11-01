import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {appendDiscussion,discussionRevision,cutDiscussion} from '../dialogues.mjs';
const target={id:'council',name:'御前议政'},add=(s,input,status='discussed')=>appendDiscussion(s,target,input,'臣已阅',[],{status,text:status},'ai',g.dateLabel(s));
test('旧对话自动获得唯一稳定消息编号，保存往返保留，重复编号被拒绝',()=>{
 let s=g.createGame();add(s,'旧消息');delete s.discussions[0].messages[0].id;delete s.discussions[0].messages[1].id;s=g.validateSave(s);const ids=s.discussions[0].messages.map(m=>m.id);assert.equal(new Set(ids).size,2);assert.deepEqual(g.validateSave(s).discussions[0].messages.map(m=>m.id),ids);
 s.discussions[0].messages[1].id=ids[0];assert.throws(()=>g.validateSave(s),/消息编号/);
});
test('从原话或回复选择本轮，只移除未执行的后续对话，不改变任何游戏进度',()=>{
 const s=g.createGame();add(s,'第一轮');add(s,'第二轮');add(s,'第三轮');const original=structuredClone(s),messages=s.discussions[0].messages;
 const revision=discussionRevision(s,'council',messages[3].id);assert.equal(revision.input,'第二轮');assert.equal(revision.removed,4);assert.equal(revision.history.length,2);cutDiscussion(s,revision);
 assert.equal(s.discussions[0].messages.length,2);assert.deepEqual({...s,discussions:[]},{...original,discussions:[]});assert.throws(()=>discussionRevision(s,'council','old-id'),/已变化/);
 cutDiscussion(s,discussionRevision(s,'council',s.discussions[0].messages[0].id));assert.deepEqual(s.discussions,[]);
});
test('已经执行的原话、答复及其前文不可删除重写，后面的商议仍可删除',()=>{
 const s=g.createGame();add(s,'先商议');add(s,'已批准','executed');add(s,'后续商议');const messages=s.discussions[0].messages,original=structuredClone(s);
 for(const m of messages.slice(0,4))assert.throws(()=>discussionRevision(s,'council',m.id),/已有政令执行/);assert.deepEqual(s,original);
 cutDiscussion(s,discussionRevision(s,'council',messages[5].id));assert.equal(s.discussions[0].messages.length,4);assert.equal(s.discussions[0].messages.at(-1).result.status,'executed');
});
