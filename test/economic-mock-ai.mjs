const actualFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(!String(url).startsWith('https://economic-test.invalid/'))return actualFetch(url,options);
 if(options.headers.Authorization!=='Bearer economic-test-key')throw Error('Unexpected mock credential');
 const request=JSON.parse(options.body);if(request.response_format?.type!=='json_object')throw Error('Tax order needs executable structured data');
 const input='着户部于泉州设市舶税关，颁通商许可。凡货利过千两者官抽其三，过万两者官抽其五；初次来市者减半抽分，只限一回。毕自严总核，按月报解。';
 const reply={reply:'臣依旨设关核税，毕自严总核，验收后按月解部，眼下尚未取得税银。',commands:[{type:'edict',text:input,official:'bi',plan:{title:'泉州开海抽分',narrative:'设官秤、核商账，准商船通已探明海口。',cost:{money:8},target:'zhemin',domain:'财政',effects:{money:99999},project:{months:3,effects:{}},economic:{port:'泉州',monthlyMoney:999999}}}]};
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(reply)},finish_reason:'stop'}],usage:{total_tokens:140}}));
};
