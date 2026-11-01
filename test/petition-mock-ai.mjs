const actualFetch=globalThis.fetch;
globalThis.fetch=async(url,o)=>{
 if(!String(url).startsWith('https://petition-test.invalid/'))return actualFetch(url,o);
 if(o.headers.Authorization!=='Bearer petition-test-only')throw Error('Unexpected test credential');
 const r=JSON.parse(o.body);if(r.response_format?.type!=='json_object'){console.error('TEST: missing structured petition proposal');throw Error('Petition discussion must retain executable proposal');}
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'臣建议先核查两个县的账册，物资不足则缩减范围。',commands:[{type:'edict',text:'核查账册',plan:{title:'清点账册',narrative:'先核两县，再依资源决定推广。',cost:{money:12,grain:0},effects:{corruption:-4},project:{months:2,effects:{corruption:-2}},domain:'finance',petitionBudget:{money:999}}}]})},finish_reason:'stop'}],usage:{total_tokens:180}}));
};
