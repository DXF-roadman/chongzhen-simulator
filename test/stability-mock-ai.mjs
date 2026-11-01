// No external network or real credentials are used by the stability tests.
globalThis.fetch=async(url,options)=>{
 if(!String(url).startsWith('https://stability-ai.invalid/'))throw Error('External requests disabled in stability test');
 if(options.headers.Authorization!=='Bearer mock-stability-key')throw Error('Unexpected test credential');
 await new Promise(r=>setTimeout(r,350));
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'试点后续核验',text:'按已完试点核验账册。',options:[{label:'核验',cost:{money:1},effects:{}},{label:'暂缓',cost:{},effects:{}}]})},finish_reason:'stop'}],usage:{total_tokens:80}}));
};
