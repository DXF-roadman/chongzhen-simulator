const actualFetch=globalThis.fetch;
globalThis.fetch=async(url,o)=>{
 if(!String(url).startsWith('https://new-unit-test.invalid/'))return actualFetch(url,o);
 if(o.headers.Authorization!=='Bearer new-unit-test-only')throw Error('Unexpected test credential');
 const request=JSON.parse(o.body);if(request.response_format?.type!=='json_object')throw Error('New unit advice needs structured commands');
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'臣拟在蓟镇边外密设三十人别营，另立密册，粮饷械弹由虫洞供给。',commands:[{type:'arsenal',operation:'equip',unit:'capital-army',equipment:'rifle',quantity:30,source:'portal'},{type:'edict',official:'civil-head-guards',text:'密设缉探别营三十人，使用现代火器，由门中供给，不列原军名册。',plan:{title:'蓟镇边外密营',narrative:'独立设营三十人，由门中供给。',cost:{money:0},effects:{army:3},domain:'military',project:{months:2,effects:{army:5}}}}]})},finish_reason:'stop'}],usage:{total_tokens:180}}));
};
