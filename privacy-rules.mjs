const copy=v=>structuredClone(v),officeNames={cabinet:'内阁',personnel:'吏部',revenue:'户部',war:'兵部',works:'工部',rites:'礼部',justice:'刑部',censors:'都察院',guards:'锦衣卫'};
export function rolePrincipals(s,target={id:'council'}){
 const id=typeof target==='string'?target:target?.id||'council',keys=new Set([id]);
 if(id.startsWith('person:')){const person=id.slice(7);keys.add(person);for(const[k,p]of Object.entries(s.government.officeLeaders||{}))if(p===person)keys.add('office:'+k);for(const a of s.agencies)if(a.leader===person)keys.add('agency:'+a.id);const p=s.service?.people.find(p=>p.id===person);if(p?.institution)keys.add(p.institution);}
 if(id.startsWith('office:')){const p=s.government.officeLeaders[id.slice(7)];if(p)keys.add(p);}
 if(id.startsWith('agency:')){const p=s.agencies.find(a=>'agency:'+a.id===id)?.leader;if(p)keys.add(p);}
 return keys;
}
export const knowsTraveler=(s,target)=>s.traveler?.identity==='disclosed'||(s.traveler?.knownTo||[]).some(k=>rolePrincipals(s,target).has(k));
export const positiveDisclosureText=input=>String(input||'').replace(/(?:不要|不许|不准|不能|暂不|先不|不必|无需|别|勿|不|没有必要)[^，。；\n]{0,10}?(?:公开|公布|昭告|宣布|告诉|告知|让)[^，。；\n]*/g,'');
export function explicitPublicDisclosure(input){const t=positiveDisclosureText(input);return !/如果|假如|假设|是否|要不要|能否|会不会|吗|？|\?/.test(t)&&/向(?:百官|天下|所有人|世人).{0,8}(?:公开|宣布|告知)|(?:公开|公布|昭告).{0,12}(?:穿越|身份|来历|来自未来)|昭告(?:天下|百官)/.test(t);}
export function privateDisclosure(s,input,target={id:'council'},history=[]){
 const t=String(input||'');if(explicitPublicDisclosure(t)||/如果|假如|假设|倘若|是否|能否|会不会|吗|？|\?|不是穿越者|并非穿越者|扮演穿越者|举个例|比方说/.test(t))return null;
 const claim=/(?:朕|我)(?:其实|实则|本来)?是(?:个|一名|一个)?穿越者|(?:朕|我).{0,8}来自未来|(?:告诉|告知).{0,12}(?:朕|我).{0,5}(?:穿越者|来自未来)/;
 const continuation=/(?:仅|只|只有|仅由).{0,12}(?:知道|知晓|所知|告知|告诉)|不要公开|保密/.test(t)&&history.some(m=>m.role==='user'&&claim.test(m.content)&&!/如果|假如|假设|不是穿越者/.test(m.content));
 if(!claim.test(t)&&!continuation)return null;
 const institutions=[...Object.entries(officeNames).filter(([id])=>Object.hasOwn(s.government.officeLeaders,id)).map(([id,name])=>({id:'office:'+id,name})),...s.agencies.map(a=>({id:'agency:'+a.id,name:a.name}))],named=institutions.find(a=>new RegExp('(?:只有|仅由|只让|只告诉|告知|告诉).{0,5}'+a.name).test(positiveDisclosureText(t)));
 const id=named?.id||(typeof target==='string'?target:target.id);
 if(id?.startsWith('person:'))return {type:'horizon',operation:'confide',official:id.slice(7)};
 if(id?.startsWith('office:')||id?.startsWith('agency:'))return {type:'horizon',operation:'confide',institution:id};
 return {type:'horizon',operation:'confide',audience:'council'};
}
export function registerPrivateKnowledge(s,c){
 if([c.institution,c.official,c.audience].filter(Boolean).length!==1)throw Error('私下告知请只选择一个人物或机构。');let keys,label;if(c.institution){const id=c.institution;if(typeof id!=='string')throw Error('私下告知的机构无效。');if(id.startsWith('office:')&&Object.hasOwn(s.government.officeLeaders,id.slice(7))){keys=[id,s.government.officeLeaders[id.slice(7)]].filter(Boolean);label=officeNames[id.slice(7)]||id;}else{const a=s.agencies.find(a=>'agency:'+a.id===id);if(!a)throw Error('私下告知的机构不存在。');keys=[id,a.leader].filter(Boolean);label=a.name;}}
 else if(c.official){keys=[c.official];label=c.official;}else if(c.audience==='council'){keys=['council'];label='本次御前议事诸臣';}else throw Error('请明确私下知情的对象。');
 const old=s.traveler.knownTo||[],changed=keys.some(k=>!old.includes(k));if(changed){const next=[...new Set([...old,...keys])];if(next.length>40)throw Error('私下知情名单已达容量，请先整理。');s.traveler.knownTo=next;}return {changed,keys,label};
}
export function privacyView(s,target={id:'council'}){
 const informed=knowsTraveler(s,target),principals=rolePrincipals(s,target),hidden=s.militaryState.units.filter(u=>u.secret&&!principals.has(u.institution)&&!principals.has(u.commander)),ids=hidden.map(u=>u.id),names=hidden.map(u=>u.name),temporal=/虫洞|穿越者|穿越来历|来自未来|时空|现代(?:制式|步枪|武器|装备)|未来(?:物资|装备)|高达|机甲|私下告知|私下知情|知情范围|登记来历|能量[：:\s]*[一二三四五六七八九十百\d]+/;
 const protectedValue=value=>{if(value===undefined||value===null)return false;const t=typeof value==='string'?value:JSON.stringify(value);return names.some(n=>t.includes(n))||ids.some(id=>new RegExp('(?:^|[^\\w-])'+id+'(?:$|[^\\w-])').test(t))||hidden.length>0&&/密营|密编/.test(t)||!informed&&temporal.test(t);};
 const view=copy(s),keep=row=>!protectedValue(row);if(informed&&s.traveler.identity!=='disclosed')view.traveler.knownTo=view.traveler.knownTo.filter(k=>principals.has(k));
 delete view.discussions;delete view.eventMemory;
 view.militaryState.units=view.militaryState.units.filter(u=>!ids.includes(u.id));
 const exposed=new Set(view.militaryState.units.flatMap(u=>Object.keys(u.equipment))),future=new Set((s.militaryState.designs||[]).filter(e=>e.era==='future').map(e=>e.id));for(const id of ['rifle','howitzer','tank','fighter','destroyer','gundam'])future.add(id);
 if(!informed){for(const id of Object.keys(view.militaryState.stock))if(future.has(id))delete view.militaryState.stock[id];view.militaryState.lines=view.militaryState.lines.filter(l=>!future.has(l.equipment)||exposed.has(l.equipment));view.militaryState.designs=view.militaryState.designs.filter(e=>e.era!=='future'||exposed.has(e.id));view.traveler={enabled:false,identity:'hidden',disclosedText:'',knownTo:[],supplies:[],energy:0,portal:false,satellites:0,interventions:0};view.atlas.allVisible=false;for(const[id,d]of Object.entries(view.atlas.discoveries))if(d.source==='satellite'&&!d.visited)delete view.atlas.discoveries[id];}
 for(const field of ['projects','affairs','history','edicts','institutions','institutionReports','planning','monthlyPolicies','notices'])if(Array.isArray(view[field]))view[field]=view[field].filter(keep);
 if(view.event&&protectedValue(view.event))view.event=null;
 view.campaignState.battles=view.campaignState.battles.filter(b=>!ids.includes(b.unit));
 if(view.service)for(const field of ['people','recommendations','tasks','searches'])if(Array.isArray(view.service[field]))view.service[field]=view.service[field].filter(keep);
 if(view.ledger)view.ledger=filterFinancial(view.ledger);
 delete view.yearRecord;delete view.annualReports;delete view.planningReminders;
 function filterFinancial(raw){const f=copy(raw);for(const key of ['entries','monthlyWork'])if(Array.isArray(f[key])){const old=f[key];f[key]=old.filter(row=>!protectedValue(row)&&(informed||row.funding!=='portal'));if(f[key].length!==old.length)f.withheldDetails=true;}if(f.border?.items)f.border.items=f.border.items.filter(keep);if(!informed)delete f.portalDutyExpenses;return f;}
 return {state:view,informed,protectedValue,filterFinancial,equipment:catalog=>catalog.filter(e=>informed||e.era!=='future'||exposed.has(e.id)).map(e=>{if(informed)return e;const {energy,quantum,...visible}=e;return e.era==='future'?{...visible,era:'unidentified',name:e.name.replace(/现代/g,'特制')}:visible;}),history:history=>history.map(m=>m.role==='assistant'&&protectedValue({content:m.content,commands:m.commands,result:m.result})?{...m,content:'此前这条答复引用了本次交谈对象无权获知的资料，不能当成玩家披露或公开事实；只按当前可知资料继续。',commands:[],result:m.result?{status:m.result.status,text:'此前答复已从本轮角色参考中隔离，不能据此认定秘事已经公开。'}:null}:m)};
}
