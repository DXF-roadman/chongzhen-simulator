export class AIOutputError extends Error {
 constructor(code,message,details={}){super(message);this.name='AIOutputError';this.code=code;this.details=details;}
}
export function decodeAIOutput(data,{plain=false}={}){
 const choice=data.choices?.[0],content=choice?.message?.content,details={finishReason:choice?.finish_reason||'missing',contentChars:typeof content==='string'?content.length:0,completionTokens:data.usage?.completion_tokens||0};
 if(choice?.finish_reason==='length')throw new AIOutputError('truncated','AI 的回复超过单次输出长度，本次尚未执行。',details);
 if(typeof content!=='string'||!content.trim())throw new AIOutputError('empty','AI 返回了空内容，本次尚未执行。',details);
 const cleaned=content.trim().replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'');
 if(plain){
  let r;try{r=JSON.parse(cleaned);}catch{}
  if(r&&typeof r==='object'){if(typeof r.reply==='string'&&r.reply.trim())return {reply:r.reply,commands:[],...(Array.isArray(r.planning||r.memos||r.plans)?{planning:r.planning||r.memos||r.plans}:{})};throw new AIOutputError('invalid_reply','AI 未返回有效答复，请重试。',details);}
  return {reply:typeof r==='string'?r:content.trim(),commands:[]};
 }
 try{return JSON.parse(cleaned);}catch{throw new AIOutputError('invalid_json','AI 返回了不完整的办理数据，本次尚未执行。',details);}
}
export async function fetchAIReply(config,key,messages,maxTokens,{plain=false,onUsage=()=>{},onDiagnostic=()=>{},fetchImpl=globalThis.fetch,timeoutMs=90000}={}){
 const started=Date.now();let last;
 for(let attempt=0;attempt<2;attempt++){
  const remaining=timeoutMs-(Date.now()-started);if(remaining<=0)throw last||Error('AI 请求超时（90 秒），本次尚未执行。');
  const retryInstruction=plain?'上次未返回有效答复。请直接用具体、简洁的中文回答，不输出空白、代码块或后台字段。':'上次生成的办理数据无效，游戏没有执行任何操作。请重新返回符合原任务字段要求的一个完整、紧凑的 json 对象；若有 reply 字段，最多120字。不要改变顶层结构，不要展开长篇论述、补空行或续写残缺输出。所拟内容仍须忠实依据原请求。';
  const requestMessages=attempt?[...messages.slice(0,-1),{role:'system',content:retryInstruction},messages.at(-1)]:messages;
  let res;
  try{res=await fetchImpl(config.baseUrl.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:config.model,messages:requestMessages,...(plain?{}:{response_format:{type:'json_object'}}),max_tokens:attempt?Math.min(10000,Math.max(maxTokens<1000?512:6000,maxTokens*2)):maxTokens,stream:false,...(/^deepseek-(flash|v4)/.test(config.model)?{thinking:{type:'disabled'}}:{})}),signal:AbortSignal.timeout(Math.max(1,remaining)),redirect:'error'});}
  catch(e){throw Error(e.name==='TimeoutError'?'AI 请求超时（90 秒），本次尚未执行。可以稍后重试。':'无法连接 AI 服务，请检查地址、网络与代理。本月尚未改变。');}
  if(!res.ok){await res.body?.cancel();const errors={401:'API Key 无效或已过期',402:'DeepSeek 账户余额不足',403:'服务拒绝访问',404:'API 地址或模型不可用',429:'请求过于频繁，请稍后重试'};throw Error(errors[res.status]||'AI 服务暂时异常（HTTP '+res.status+'）');}
  const reader=res.body.getReader();let bytes=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>250000){await reader.cancel();throw Error('AI 响应过长，请重试。');}chunks.push(value);}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('AI 服务返回了无效响应。');}
  onUsage(data.usage||{});
  try{return decodeAIOutput(data,{plain});}
  catch(e){if(!(e instanceof AIOutputError))throw e;last=e;onDiagnostic({attempt:attempt+1,code:e.code,...e.details});if(attempt===1)throw new AIOutputError(e.code,e.code==='empty'?'AI 连续两次返回空内容，本次未执行任何操作。请稍后重试。':e.code==='truncated'?'AI 的办理方案连续两次超出输出长度，本次未执行。请将方案分成较少事项后再办理。':e.code==='invalid_reply'?'AI 未返回有效答复，两次尝试均未改变游戏。':'AI 连续两次返回不完整的办理数据，本次未执行。请稍后重试。',e.details);}
 }
 throw last;
}
