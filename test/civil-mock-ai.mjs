const realFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{
 if(!String(url).startsWith('https://civil-test.invalid/'))return realFetch(url,opts);
 const request=JSON.parse(opts.body);if(opts.headers.Authorization!=='Bearer civil-test-key')throw Error('Unexpected test credential');
 if(!request.response_format)throw Error('Recommendation and story require structured JSON');
 let answer;
 if(request.messages[0].content.includes('后续奏报编写者')){
  const context=JSON.parse(request.messages.at(-1).content);if(!context.completed.some(h=>h.title.includes('灌渠')))throw Error('Missing actual completed development');
  if(request.model==='slow-story')await new Promise(r=>setTimeout(r,350));
  answer={title:'灌渠既成，议订轮灌章程',text:'灌渠试点已经验收，各村希望核定轮灌与养护职责，待地方核验后呈报。',options:[{label:'试行轮灌章程',cost:{money:4,grain:1},effects:{stability:2}},{label:'先整理案卷',cost:{money:1},effects:{tech:1}},{label:'暂缓',cost:{},effects:{}}]};
 }else{
  const roster=request.messages.find(m=>m.role==='system'&&m.content.includes('本轮是向本署主官询问属员'))?.content;if(!roster)throw Error('Missing institution roster');
  const context=JSON.parse(roster.slice(roster.indexOf('{"institution"')));const p=context.roster.find(p=>p.id===context.choice);answer={reply:p?'臣正有一人可荐：'+p.name+'，现任'+p.role+'。此人熟悉闽粤海商与通事，可先赴吕宋访察；尚未出发。':'臣现有属员尚不适任，拟访求地方人才，先核履历。',commands:[{type:'office',office:'war',official:'sun'}],recommendations:p?[{person:p.id,reason:p.background}]:[]};
 }
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(answer)},finish_reason:'stop'}],usage:{total_tokens:180}}));
};
