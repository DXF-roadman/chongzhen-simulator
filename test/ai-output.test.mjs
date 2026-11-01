import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAIReply,decodeAIOutput,AIOutputError} from '../ai-output.mjs';
import * as g from '../engine.mjs';
import {buildAcceptanceMessages,buildCounselMessages} from '../counsel.mjs';
const config={model:'deepseek-flash',baseUrl:'https://ai-test.invalid'},body=(content,finish_reason='stop')=>({choices:[{message:{content},finish_reason}],usage:{total_tokens:50,completion_tokens:20}});
test('空内容后只重试一次，调整提示与长度，返回完整方案',async()=>{
 const requests=[],usage=[],diagnostics=[];
 const r=await fetchAIReply(config,'mock', [{role:'system',content:'返回json'},{role:'user',content:'照办'}],6000,{onUsage:u=>usage.push(u),onDiagnostic:d=>diagnostics.push(d),fetchImpl:async(url,o)=>{requests.push(JSON.parse(o.body));return new Response(JSON.stringify(requests.length===1?body('   '):body('{"reply":"遵旨。","commands":[{"type":"action","action":"audit"}]}')));}});
 assert.equal(requests.length,2);assert.equal(usage.length,2);assert.equal(diagnostics[0].code,'empty');assert.equal(requests[0].max_tokens,6000);assert.equal(requests[1].max_tokens,10000);assert.match(requests[1].messages.at(-2).content,/没有执行任何操作/);assert.equal(r.commands[0].action,'audit');
 assert.ok(!JSON.stringify(diagnostics).includes('mock'));
});
test('截断的 JSON 不会执行，改用更长额度重试；连续失败说明具体原因',async()=>{
 let calls=0;const good='{"reply":"遵旨","commands":[]}';
 const r=await fetchAIReply(config,'mock',[{role:'user',content:'照办'}],3800,{fetchImpl:async()=>new Response(JSON.stringify(body(good,++calls===1?'length':'stop')))});assert.equal(calls,2);assert.equal(r.reply,'遵旨');
 calls=0;await assert.rejects(fetchAIReply(config,'mock',[{role:'user',content:'照办'}],6000,{fetchImpl:async()=>{calls++;return new Response(JSON.stringify(body('{"reply":','length')));}}),/连续两次超出输出长度.*未执行/);assert.equal(calls,2);
 calls=0;await assert.rejects(fetchAIReply(config,'mock',[{role:'user',content:'照办'}],6000,{fetchImpl:async()=>{calls++;return new Response(JSON.stringify(body('')));}}),/连续两次返回空内容.*未执行/);assert.equal(calls,2);
});
test('格式错误可恢复，纯商议仍忽略命令，认证和网络错误不重试',async()=>{
 let calls=0;const r=await fetchAIReply(config,'mock',[{role:'user',content:'照办'}],6000,{fetchImpl:async()=>new Response(JSON.stringify(body(++calls===1?'not-json':'{"reply":"臣请先核账。","commands":[]}')))});assert.equal(calls,2);assert.equal(r.reply,'臣请先核账。');
 assert.deepEqual(decodeAIOutput(body('{"reply":"只作商议。","commands":[{"type":"action","action":"audit"}]}'),{plain:true}),{reply:'只作商议。',commands:[]});
 calls=0;await assert.rejects(fetchAIReply(config,'mock',[{role:'user',content:'照办'}],6000,{fetchImpl:async()=>{calls++;return new Response('{}',{status:401});}}),/API Key/);assert.equal(calls,1);
 calls=0;await assert.rejects(fetchAIReply(config,'mock',[{role:'user',content:'照办'}],6000,{fetchImpl:async()=>{calls++;throw Error('network');}}),/无法连接/);assert.equal(calls,1);
 assert.throws(()=>decodeAIOutput(body(' ')),AIOutputError);
});
test('接受建议只编译最新方案，用当前国库与人选，省略庞大无关历史',()=>{
 const s=g.createGame();s.money=462;s.actionsLeft=2;s.history=Array.from({length:100},(_,i)=>({title:'无关旧事'+i,text:'冗余旧事'.repeat(80)}));
 const history=[{role:'user',content:'宗禄如何改制'},{role:'assistant',content:'先核宗籍，再给贫宗出路。',commands:[],result:{status:'discussed',text:'仅商议'}},{role:'user',content:'另派船探路'},{role:'assistant',content:'设宗禄清核使，并派一支船队西洋探航。',commands:[],result:{status:'discussed',text:'仅商议'}}];
 const messages=buildAcceptanceMessages(s,{id:'council'},'照办',history),json=JSON.stringify(messages);
 assert.match(json,/462/);assert.match(json,/宗禄清核使/);assert.match(json,/west/);assert.doesNotMatch(json,/无关旧事/);assert.match(messages[1].content,/不重复此前/);assert.ok(json.length<JSON.stringify(buildCounselMessages(s,{id:'council'},'照办',history)).length);
});
