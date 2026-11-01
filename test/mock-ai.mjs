import {advice,invalidBatch,correctedBatch} from './batch-fixture.mjs';
import {recordedPlans} from './planning-fixture.mjs';
const actualFetch=globalThis.fetch;
let recoveryAttempts=0;
globalThis.fetch=async (url,options)=>{
 if(!String(url).startsWith('https://ai-test.invalid/'))return actualFetch(url,options);
 const request=JSON.parse(options.body);
 if(options.headers.Authorization!=='Bearer mock-key-for-local-test')throw Error('unexpected credential');
 if(request.model==='mock-record-prose'){
  if(request.response_format?.type!=='json_object')throw Error('Planning must request structured JSON');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:recordedPlans,commands:[{type:'office',office:'revenue',official:'bi'}],planning:[]})},finish_reason:'stop'}],usage:{total_tokens:150}}));
 }
 if(request.model==='mock-fiscal-order'){
  if(!JSON.stringify(request.messages).includes('monthlyPay')||!JSON.stringify(request.messages).includes('hireCost'))throw Error('Missing actual payroll context');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'遵旨，改订薪俸；实际变化请见办理凭据。',commands:[{type:'fiscal',scope:'person',official:'bi',monthly:1}]})},finish_reason:'stop'}],usage:{total_tokens:100}}));
 }
 if(request.model==='mock-traveler-intent'){
  if(!request.messages.some(m=>m.role==='system'&&m.content.includes('本轮玩家明确触发幻想操作')&&m.content.includes('"money":350')&&m.content.includes('confide')))throw Error('missing deterministic fantasy intent and resource units');
  const commands=[{type:'horizon',operation:'disclose'},{type:'edict',text:'拨银五十万两，由宋应星筹办蒸汽动力与现代炮具初步试验',official:'song',plan:{title:'蒸汽动力与炮具试验',narrative:'以调入银款开办试验，尚未造出成品。',cost:{money:50},effects:{},domain:'industry',project:{months:3,effects:{tech:5}}}}];
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'臣私下奉命，先接银粮，再开办蒸汽动力与炮具研究，成果待验。',commands})},finish_reason:'stop'}],usage:{total_tokens:190}}));
 }
 if(request.model.startsWith('mock-planning')){
  if(request.model==='mock-planning-slow')await new Promise(r=>setTimeout(r,300));
  if(request.model==='mock-planning-fail')return new Response('{}',{status:401});
  const reminder=request.messages[0].content.includes('已经到游戏内复议期限'),accepting=request.messages.some(m=>m.content.includes('本轮是执行方案编译'));
  if(reminder){if(!JSON.stringify(request.messages).includes('陕西水利筹备')||!JSON.stringify(request.messages).includes('forecast'))throw Error('missing deadline plan or real conditions');return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'陛下，陕西水利筹备已到复议之期。当前可先择县试行，核拨银三十六万两、粮八万石；尚未下旨。',commands:[{type:'action',action:'irrigation',target:'shaanxi'}]})},finish_reason:'stop'}],usage:{total_tokens:110}}));}
  const reply=accepting?'遵旨，先修陕西一县水利。':'陕西水利筹备暂缓一个月，待核定存粮和工匠，再请陛下定夺。';
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply,commands:accepting?[{type:'action',action:'irrigation',target:'shaanxi'}]:[],...(!accepting?{planning:[{title:'陕西水利筹备',horizon:'short',body:'先修陕西一县灌溉',reason:'待核定存粮和工匠',requirements:['核定工匠','核实粮储'],dueMonths:1,status:'done'}]}:{})})},finish_reason:'stop'}],usage:{total_tokens:140}}));
 }

 if(request.model==='mock-event-recovery'){
  const facts=request.messages.findLast(m=>m.role==='system'&&m.content.includes('服务器此刻的真实状态'));
  if(!facts?.content.includes('"date":"崇祯元年 · 三月"')||!facts.content.includes('"event":null')||!facts.content.includes('"monthlyActionLimit":null'))throw Error('missing current unlimited rules or actual date/event');
  const repair=request.messages.find(m=>m.role==='system'&&m.content.includes('错误与原数据'));
  if(repair&&!repair.content.includes('没有待批奏报'))throw Error('missing structural event error');
  const commands=repair?[{type:'edict',text:'核实辽镇兵额，命卢象升抽点督办',official:'lu',plan:{title:'辽镇核兵稽核',narrative:'复核兵籍并抽点实员，按期核销。',cost:{money:36,grain:2},domain:'military',effects:{},project:{months:2,effects:{corruption:-3,army:2}}}}]:[{type:'event',index:0,official:'lu'}];
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'臣拟依新令核兵，由卢象升督办。',commands})},finish_reason:'stop'}],usage:{total_tokens:150}}));
 }

 if(request.model==='mock-batch-repair'||request.model==='mock-batch-first-invalid'){
  const repair=request.messages.find(m=>m.role==='system'&&m.content.includes('错误与原数据'));
  if(repair){if(!repair.content.includes('机构不存在')||!request.messages.some(m=>m.role==='assistant'&&m.content===advice))throw Error('repair lost original approved advice or validation error');}
  else if(request.model==='mock-batch-repair')throw Error('unexpected AI call for a valid or resource-blocked batch');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'遵旨，设署并委毕自严主办两省试行，另派船西洋通商探路。',commands:repair?correctedBatch:invalidBatch})},finish_reason:'stop'}],usage:{total_tokens:200}}));
 }

 if(request.model==='mock-frontier'){
  const prompt=request.messages[0].content,ctx=JSON.stringify(request.messages);
  if(!ctx.includes('liaodong-army'))throw Error('missing ordinary frontier context');
  if(!request.messages.at(-1).content.includes('打开虫洞')&&!prompt.includes('仅你私下知晓')&&!prompt.includes('已公开，朝臣')){if(ctx.includes('\\"energy\\":'))throw Error('uninformed adviser received temporal telemetry');}
  const plain=!request.response_format;
  const content=plain?'臣建议先核辽东军现有鸟铳与火炮，按缺额配发并安排工厂补充。':JSON.stringify({reply:'臣拟按前线优先方案整备，实际配装以办理记录为准。',commands:request.messages.at(-1).content.includes('打开虫洞')?[{type:'horizon',operation:'portal',open:true},{type:'horizon',operation:'summon_mecha'}]:[{type:'arsenal',operation:'modernize',scope:'frontier',source:'period'}]});
  return new Response(JSON.stringify({choices:[{message:{content},finish_reason:'stop'}],usage:{total_tokens:120}}),{status:200});
 }

 if(request.model==='mock-accept-recovery'){
  const advice='宗禄清核使先设专署，会同户部核宗籍；另派一队船西洋通商探路。';
  if(!request.response_format)return new Response(JSON.stringify({choices:[{message:{content:advice},finish_reason:'stop'}],usage:{total_tokens:100}}));
  recoveryAttempts++;
  if(recoveryAttempts===1)return new Response(JSON.stringify({choices:[{message:{content:''},finish_reason:'stop'}],usage:{total_tokens:100}}));
  const plan={title:'设宗禄清核使',narrative:'设专署清核宗籍，按月核验。',cost:{},effects:{},institutionChanges:[{operation:'create_agency',name:'宗禄清核使',mandate:'清核宗籍与虚冒宗禄，安排贫宗试行自谋生计。',domain:'governance',powers:['oversight','execution'],budget:2}]};
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'遵旨，设署核籍并派船探路。',commands:[{type:'edict',text:'设立宗禄清核使',plan},{type:'horizon',operation:'voyage',route:'west'}]})},finish_reason:'stop'}],usage:{total_tokens:200}}));
 }
 if(request.model==='mock-401')return new Response('{}',{status:401});
 if(request.messages[0].content.includes('commands:拟议的操作数组')||request.messages[0].content.includes('本轮只商议，不执行')){
  if(request.model==='mock-chat-slow')await new Promise(r=>setTimeout(r,350));
  if(request.model==='mock-chat-echo'&&request.messages.some(m=>m.role==='assistant'&&/系统办理记录[：:]|拟议事项[：:]/.test(m.content)))throw Error('receipt leaked into assistant history');
  const prior=request.messages.some(m=>m.role==='assistant'&&m.content.includes('议事答复'));
  const commands=request.model==='mock-chat-forged'?[{type:'shell',cmd:'bad'}]:[{type:'office',office:'revenue',official:'bi'}];
  const reply=request.model==='mock-chat-empty'?'':'议事答复：'+(prior?'承接前议，户部钱粮仍须按本月实数核验。':'可请毕自严主持户部，先核钱粮账目。');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:reply+(request.model==='mock-chat-echo'?'\n系统办理记录：仅作商议，本次没有改变钱粮、人事或施政次数。\n拟议事项：[]':''),commands})},finish_reason:'stop'}],usage:{total_tokens:250}}),{status:200});
 }
 const plan={title:'皇家预算试点',narrative:'户部设立年度预算与账目复核，先在京畿检验。',feasibility:'先试账册制度，不假定已建立现代金融体系。',minister:'请设验收之期。',cost:{money:40,grain:4},effects:{corruption:-3},domain:'finance',target:'capital',project:{months:3,effects:{tech:6}}};
 return new Response(JSON.stringify({choices:[{message:{content:request.model==='mock-bad'?'not json':JSON.stringify(plan)},finish_reason:'stop'}],usage:{total_tokens:300}}),{status:200,headers:{'Content-Type':'application/json'}});
};
