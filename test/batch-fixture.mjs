export const advice='宗室一事，宜设“宗禄清核使”一职，宗人府会同户部礼部各出一员，专管造册、定章程、督试行，河南、山西先行，由毕自严主办。远洋先造三五条船，选熟悉海道之人，以通商探路为名摸清航路港口货物，少量拨款，不以寻黄金国名义征伐。';
export const invalidBatch=[{type:'agency',agency:'宗禄清核使',official:'bi'},{type:'duty',kind:'project',target:'宗禄清核：河南、山西先行造册定章',official:'bi'},{type:'horizon',operation:'voyage',route:'west'}];
export const failedHistory=[{role:'user',content:'请拟宗禄改革与远洋通商的具体方案'},{role:'assistant',content:advice,commands:[],source:'ai',result:{status:'discussed',text:'仅作商议'}},{role:'user',content:'照办'},{role:'assistant',content:'臣遵旨，即设宗禄清核使，另拨船探西洋航路。',source:'ai',commands:invalidBatch,result:{status:'blocked',text:'第 1 项未能办理：机构不存在：宗禄清核使 本次整批未执行。'}}];
export const correctedBatch=[
 {type:'agency',agency:'宗禄清核使',official:'bi'},
 {type:'duty',kind:'project',target:'宗禄清核：河南、山西先行造册定章',official:'bi'},
 {type:'edict',text:'设立宗禄清核使，河南、山西先行造册定章',plan:{title:'宗禄清核：河南、山西先行造册定章',narrative:'设专署督办两省试行，按月复核。',institutionChanges:[{operation:'create_agency',name:'宗禄清核使',mandate:'会同宗人府、户部、礼部，督河南、山西造册清核宗籍，定章程试行自谋生计。',domain:'finance',powers:['oversight','execution'],budget:2}]}},
 {type:'horizon',operation:'voyage',route:'west'}
];
