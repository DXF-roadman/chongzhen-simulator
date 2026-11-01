const realFetch=globalThis.fetch;
globalThis.fetch=async(url,o)=>{
 if(!String(url).startsWith('https://monthly-test.invalid/'))return realFetch(url,o);if(o.headers.Authorization!=='Bearer monthly-test-key')throw Error('Unexpected test credential');
 const r=JSON.parse(o.body);if(r.response_format?.type!=='json_object')throw Error('Monthly order needs structured commands');
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'臣拟由袁崇焕督训辽东营伍，按月核验。',commands:[{type:'edict',text:'派袁崇焕督训辽东兵马',official:'yuan',plan:{title:'辽东督训',narrative:'清点营伍，督促操练',cost:{money:5},domain:'军事',effects:{army:6},project:{months:3,effects:{army:3}}}}]})},finish_reason:'stop'}],usage:{total_tokens:150}}));
};
