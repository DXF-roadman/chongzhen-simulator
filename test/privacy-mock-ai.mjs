import assert from 'node:assert/strict';
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,o)=>{
 if(!String(url).startsWith('https://privacy-test.invalid/'))return realFetch(url,o);assert.equal(o.headers.Authorization,'Bearer privacy-test-only');const body=JSON.parse(o.body),all=JSON.stringify(body.messages),last=body.messages.at(-1).content;
 if(last.includes('朕其实是穿越者')){assert.match(all,/蓟镇边外密营/);assert.match(all,/137/);assert.match(all,/仅你私下知晓/);}
 else{assert.doesNotMatch(all,/蓟镇边外密营|能量137|\\"energy\\":137|supply-\d+-\d+/);assert.doesNotMatch(all,/\\"equipment\\":\\"rifle\\"/);}
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:last.includes('朕其实是穿越者')?'臣谨记，只在本署密册中呈报，不传外署。':'臣只按本署已掌握的军情，先核辽东鸟铳和军饷。',commands:[]})},finish_reason:'stop'}],usage:{total_tokens:120}}));
};
