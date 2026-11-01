import {civilCanServe} from './civil-service.mjs';
const cap=(v,lo=0,hi=100)=>Math.max(lo,Math.min(hi,Number(v)||0));
const copy=x=>structuredClone(x);
export const NATIVE_OFFICIALS = [
 {id:'sun',name:'孙承宗',role:'边防统筹',portrait:'孙',skill:'边防军备 +3 / 月',bio:'重视关宁防线与将才协作。任命在本作中为架空选择。',cost:12,bonus:{army:3}},
 {id:'yuan',name:'袁崇焕',role:'辽东督师',portrait:'袁',skill:'边患 −3 / 月',bio:'1628 年奉命督师蓟辽；本作不预设其后必然结局。',cost:14,bonus:{frontier:-3}},
 {id:'xu',name:'徐光启',role:'格物农政',portrait:'徐',skill:'格物 +2 / 月',bio:'农政、历算与西学交流，是制度试验的重要人选。',cost:10,bonus:{tech:2}},
 {id:'bi',name:'毕自严',role:'户部理财',portrait:'毕',skill:'税收 +12% / 月',bio:'以财政整饬为任；提高征解效率而非凭空生银。',cost:8,bonus:{revenue:0.12}},
 {id:'lu',name:'卢象升',role:'练兵平乱',portrait:'卢',skill:'最高动乱地区 −3 / 月',bio:'军政实干人才，提前起用属于架空推演。',cost:12,bonus:{unrest:-3}},
 {id:'song',name:'宋应星',role:'工艺试制',portrait:'宋',skill:'工程额外推进 1 月',bio:'关心农工技艺，提前召用与组织工坊属于架空选择。',cost:10,bonus:{project:1}}
];
const statuses=['independent','negotiating','probation','available','rebelled','departed'];
const nativeIds=new Set(NATIVE_OFFICIALS.map(o=>o.id));
export const canServe=(s,id)=>nativeIds.has(id)||civilCanServe(s,id)||(s.talents||[]).some(t=>t.id===id&&['probation','available'].includes(t.status));
export function talentEfficiency(s,id){
 const t=(s.talents||[]).find(t=>t.id===id);if(!t)return nativeIds.has(id)?1:civilCanServe(s,id)?.8:0;
 return canServe(s,id)?Math.min(1,(.45+t.loyalty/200+t.integration/500)*(t.status==='probation'?.75:1)):0;
}
export function initialTalents(){
 return [
  {id:'talent-1',name:'陕北流民首领',region:'shaanxi',command:71,governance:48,craft:25,troops:7},
  {id:'talent-2',name:'豫西乡兵头领',region:'henan',command:59,governance:61,craft:28,troops:4},
  {id:'talent-3',name:'荆襄山寨首领',region:'huguang',command:66,governance:44,craft:35,troops:5}
 ].map(t=>({...t,origin:'scenario',bio:'架空地方线索，非特定史实人物；所部并未归附朝廷。',status:'independent',loyalty:30,integration:0,retainForces:true,amnesty:false,upkeep:0,missedPay:0,idleMonths:0,joinedTurn:null,negotiation:null,probationMonths:0}));
}
function generatedCandidate(s,name,region){
 let h=0;for(const ch of name)h=(Math.imul(h,31)+ch.codePointAt(0))>>>0;
 return {id:'talent-'+(s.nextTalentId||4),name,region,command:45+h%31,governance:40+(h>>>5)%31,craft:25+(h>>>10)%36,troops:3+(h>>>15)%6,origin:'player',bio:'玩家指定的架空地方首领，经历与能力为本局推演，不代表已考证的史实人物。',status:'independent',loyalty:30,integration:0,retainForces:true,amnesty:false,upkeep:0,missedPay:0,idleMonths:0,joinedTurn:null,negotiation:null,probationMonths:0};
}
export function recruitedOfficials(s){
 return (s.talents||[]).filter(t=>canServe(s,t.id)).map(t=>{
  const artisan=t.craft>t.command&&t.craft>t.governance,civil=!artisan&&t.governance>t.command+8,bonus=artisan?{tech:Math.round((.7+t.craft/100)*10)/10}:civil?{corruption:-Math.round((.5+t.governance/100)*10)/10,unrest:-1}:{army:Math.round((1+t.command/40)*10)/10,unrest:-1};
  return {id:t.id,name:t.name,portrait:t.name[0],role:artisan?'招安工艺差遣':civil?'招安民政差遣':'招安统兵差遣',skill:artisan?'按归附程度积累格物':civil?'按归附程度降低贪腐、安抚动乱':'按归附程度提高军备、安抚动乱',bio:(t.origin==='player'?'玩家指定的架空地方首领。':'本局架空地方首领。')+(t.status==='probation'?'现已受抚，正在观察与整编，可试任差遣。':'归附渐稳，仍须按约安置所部。'),cost:12,bonus,loyalty:t.loyalty,integration:t.integration,efficiency:talentEfficiency(s,t.id),recruited:true};
 });
}
export function talentExpenses(s){
 const joined=(s.talents||[]).filter(t=>['probation','available'].includes(t.status));
 return {money:joined.reduce((n,t)=>n+t.upkeep,0),grain:joined.reduce((n,t)=>n+Math.ceil(t.troops*.6),0)};
}
export function inferRecruitment(s,text){
 if(!/(招安|招降|劝降|收编)/.test(text)||/(?:不|不要|勿|暂不|不能)\s*(?:招安|招降|劝降|收编)/.test(text))return null;
 const region=s.provinces.find(p=>text.includes(p.name))?.id;
 const known=(s.talents||[]).find(t=>text.includes(t.name));
 const m=/(?:招安|招降|劝降|收编)\s*[“「"]?([^\s，。；;：:"”」]{2,24})/.exec(text);
 let name=m?.[1]?.split(/所部|麾下|的部众|部众|带领|率领|并|为/)[0]||null;
 if(name&&/反民|叛军|流民|义军|首领|头领|武装|山贼|匪|所有|全部/.test(name))name=null;
 const target=known||(name?(s.talents||[]).find(t=>t.name===name):(s.talents||[]).find(t=>(!region||t.region===region)&&['independent','rebelled','departed'].includes(t.status)));
 const grant=/(?:拨银|拨款|抚银|赏银)\s*(\d+)\s*万/.exec(text),grain=/(?:拨粮|粮食|粮)\s*(\d+)\s*万/.exec(text);
 return {target:target?.id||null,name:target?.name||name||'地方武装首领',region:region||target?.region||'shaanxi',amnesty:!/(?:不赦|不予赦免|不赦免|追究罪责)/.test(text),retainForces:!/(?:解散|遣散|缴械|交出|交械|不保留).{0,6}(?:兵|部众|武装)|缴械|交械/.test(text),grant:grant?Number(grant[1]):30,grain:grain?Number(grain[1]):15};
}
export function recruitmentPlan(s,raw,input,source='local',flavor={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('招安条款无效。');
 const target=raw.target?(s.talents||[]).find(t=>t.id===raw.target||t.name===raw.target):null;
 if(raw.target&&!target)throw Error('未找到这位首领，请按已有线索接触或填写新姓名。');
 const name=String(target?.name||raw.name||'').trim().slice(0,32);
 if(name.length<2||/[\u0000-\u001f<>]/.test(name))throw Error('请填写 2 至 32 字的首领姓名或称号。');
 if(nativeIds.has(raw.target)||[...NATIVE_OFFICIALS,...(s.service?.people||[])].some(o=>o.name===name))throw Error('此人已在朝廷人才名单中，无需招安。');
 if((s.talents||[]).some(t=>t.name===name&&t.id!==target?.id))throw Error('已有同名人物，请选择该人物继续交涉。');
 if(target&&['probation','available'].includes(target.status))throw Error('此人已归附，可以直接安排差遣。');
 if(target?.status==='negotiating')throw Error('使者已在交涉，请等候下月回报。');
 if(!target&&(s.talents||[]).length>=40)throw Error('本局人物线索已达四十名，请先处理已有线索。');
 const region=s.provinces.some(p=>p.id===(target?.region||raw.region))?(target?.region||raw.region):'shaanxi';
 const t=target||generatedCandidate(s,name,region),p=s.provinces.find(p=>p.id===region);
 const grant=Math.round(cap(raw.grant??30,12,80)),grain=Math.round(cap(raw.grain??15,5,40)),amnesty=raw.amnesty!==false,retainForces=raw.retainForces!==false;
 const chance=Math.round(cap(36+(amnesty?12:0)+(retainForces?12:-7)+grant/5+grain/4+s.legitimacy*.08+(s.army-t.command)/4+(p.drought>65?5:0),15,90));
 const upkeep=Math.ceil(3+t.troops*.65);
 return {title:'遣使招安 · '+name,narrative:'派遣使者接触'+name+'，约定'+(amnesty?'赦免普通附从':'保留问责')+'、'+(retainForces?'保留所部并另行编制':'遣散旧部，分批编入朝廷军籍')+'。支出用于使团、抚慰与安置。下月才有回复，未获答允前不会进入可任用名单。',feasibility:'本次估计接受机会 '+chance+'%。接受后先观察两个月；忠诚与整编程度会影响任用成效。归附后每月安置军饷 '+upkeep+' 万两，另需口粮 '+Math.ceil(t.troops*.6)+' 万石；欠饷、重税和长期闲置会动摇人心。'+(target?'':'该姓名作为玩家指定的架空首领建立，非已考证史实身份。'),minister:String(flavor.minister||'臣请先明条款、拨足钱粮，再议授职。纳降之人可用，旧部归属与后续军饷仍须慎处。').slice(0,600),cost:{money:grant,grain},effects:{},regional:{},target:null,project:null,domain:'governance',factions:{},source,input,recruitment:{target:target?.id||null,name,region,amnesty,retainForces,grant,grain,chance,upkeep,candidate:target?null:t},recruitmentPreview:{chance,upkeep,grain:Math.ceil(t.troops*.6),troops:t.troops,newCandidate:!target}};
}
export function enactRecruitment(s,terms){
 s.talents||=[];let t=terms.target?s.talents.find(t=>t.id===terms.target):null;
 if(!t){t=generatedCandidate(s,terms.name,terms.region);s.talents.push(t);s.nextTalentId=Math.max(s.nextTalentId||4,Number(t.id.slice(7))+1);}
 t.status='negotiating';t.negotiation={remaining:1,amnesty:terms.amnesty,retainForces:terms.retainForces,chance:terms.chance,upkeep:terms.upkeep};t.idleMonths=0;
}
function removePosts(s,id){
 s.officials=s.officials.filter(x=>x!==id);
 for(const a of s.agencies||[])if(a.leader===id)a.leader=null;
 for(const [post,leader]of Object.entries(s.government?.officeLeaders||{}))if(leader===id)delete s.government.officeLeaders[post];
 for(const a of [...(s.projects||[]),...(s.affairs||[])])if(a.leader===id)a.leader=null;
 if(s.event?.leader===id)s.event.leader=null;for(const p of s.provinces||[])if(p.governor===id)p.governor=null;for(const u of s.militaryState?.units||[])if(u.commander===id)u.commander=null;
}
export function settleTalents(s,paid,grainPaid,random){
 const messages=[];
 for(const t of s.talents||[]){
  if(t.status==='negotiating'){
   t.negotiation.remaining--;
   if(t.negotiation.remaining<=0){
    const n=t.negotiation;t.negotiation=null;
    if(random()*100<n.chance){t.status='probation';t.probationMonths=2;t.loyalty=(n.amnesty?61:49)+(n.retainForces?0:6);t.integration=n.retainForces?20:45;t.retainForces=n.retainForces;t.amnesty=n.amnesty;t.upkeep=n.upkeep;t.joinedTurn=s.turn+1;t.missedPay=0;s.stability=cap(s.stability+2);s.factions.army=cap(s.factions.army-2);const p=s.provinces.find(p=>p.id===t.region);p.unrest=cap(p.unrest-9);messages.push({title:'受抚 · '+t.name,text:'首领接受条款，进入两个月观察期；已可试用，成效取决于忠诚与整编。下月开始列支安置军饷与口粮。'});}
    else{t.status=t.origin==='rebelled'?'rebelled':'independent';messages.push({title:'招安未成 · '+t.name,text:'首领未接受此次条款，使团与抚慰支出已经发生。可调整条款后再谈；未凭此自动归附。'});}
   }
   continue;
  }
  if(!['probation','available'].includes(t.status))continue;
  const employed=(s.provinces||[]).some(p=>p.governor===t.id)||(s.militaryState?.units||[]).some(u=>u.commander===t.id)||s.officials.includes(t.id)||Object.values(s.government?.officeLeaders||{}).includes(t.id)||[...(s.agencies||[]),...(s.projects||[]),...(s.affairs||[])].some(a=>a.leader===t.id)||s.event?.leader===t.id;
  t.idleMonths=employed?0:Math.min(100,t.idleMonths+1);
  if(typeof paid==='function'?paid('talent:'+t.id):paid&&grainPaid){t.loyalty=cap(t.loyalty+2-(s.tax>=1.4?4:0)-(s.stability<35?3:0)-(t.idleMonths>3?2:0));t.integration=cap(t.integration+(t.retainForces?12:20));t.missedPay=0;if(t.probationMonths>0)t.probationMonths--;}
  else{t.loyalty=cap(t.loyalty-14);t.integration=cap(t.integration-5);t.missedPay++;messages.push({title:'归附军心 · '+t.name,text:'安置钱粮未足额兑现，忠诚 −14，整编停滞。'});}
  if(t.loyalty<=20){
   removePosts(s,t.id);
   if(t.retainForces&&t.troops>0){t.status='rebelled';t.origin='rebelled';const p=s.provinces.find(p=>p.id===t.region);p.unrest=cap(p.unrest+14);s.army=cap(s.army-3);messages.push({title:'再叛 · '+t.name,text:'长期失信使首领率旧部脱离朝廷，地方动乱 +14，军备 −3；原有差遣已解除。'});}
   else{t.status='departed';messages.push({title:'离散 · '+t.name,text:'安置与信任崩解，首领离任，其中央及机构差遣已解除。'});}
   continue;
  }
  if(t.status==='probation'&&t.probationMonths===0){t.status='available';messages.push({title:'归附渐稳 · '+t.name,text:'观察期结束。部众继续整编，忠诚仍受后续政策和军饷影响。'});}
 }
 return messages;
}
export function validateTalents(raw,s){
 const ts=raw.talents===undefined?initialTalents():raw.talents;
 if(!Array.isArray(ts)||ts.length>40||new Set(ts.map(t=>t.id)).size!==ts.length||new Set(ts.map(t=>t.name)).size!==ts.length)throw Error('存档人才线索无效或重复。');
 s.talents=ts.map(t=>{
  if(!/^talent-\d+$/.test(t.id)||!Number.isSafeInteger(Number(t.id.slice(7)))||Number(t.id.slice(7))>1000000||typeof t.name!=='string'||t.name.length<2||t.name.length>32||NATIVE_OFFICIALS.some(o=>o.name===t.name)||!s.provinces.some(p=>p.id===t.region)||!statuses.includes(t.status))throw Error('存档人物身份无效。');
  for(const k of ['command','governance','craft','troops','loyalty','integration','upkeep','missedPay','idleMonths','probationMonths'])if(!Number.isFinite(t[k])||t[k]<0||t[k]>(k==='troops'?20:k==='upkeep'?20:100))throw Error('存档人物数值无效。');
  let negotiation=null;
  if(t.status==='negotiating'){const n=t.negotiation;if(!n||n.remaining!==1||!Number.isFinite(n.chance)||n.chance<15||n.chance>90||!Number.isFinite(n.upkeep)||n.upkeep<1||n.upkeep>20)throw Error('存档招安条款无效。');negotiation={remaining:1,chance:n.chance,upkeep:n.upkeep,amnesty:n.amnesty===true,retainForces:n.retainForces===true};}
  return {id:t.id,name:t.name,region:t.region,bio:String(t.bio||'本局架空地方首领。').slice(0,500),origin:['scenario','player','rebelled'].includes(t.origin)?t.origin:'player',status:t.status,...Object.fromEntries(['command','governance','craft','troops','loyalty','integration','upkeep','missedPay','idleMonths','probationMonths'].map(k=>[k,t[k]])),retainForces:t.retainForces===true,amnesty:t.amnesty===true,joinedTurn:Number.isInteger(t.joinedTurn)?t.joinedTurn:null,negotiation};
 });
 if(raw.nextTalentId!==undefined&&(!Number.isSafeInteger(raw.nextTalentId)||raw.nextTalentId<1||raw.nextTalentId>1000000))throw Error('存档人物编号无效。');
 s.nextTalentId=Math.max(raw.nextTalentId||4,...s.talents.map(t=>Number(t.id.slice(7))+1));
}
