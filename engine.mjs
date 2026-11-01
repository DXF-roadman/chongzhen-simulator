// Game statistics are balancing abstractions, not historical measurements.
import {POWERS,initialGovernment,administration,agencyEconomy,agencyStrength,inferInstitutionChanges,institutionPlan,enactInstitutionChanges,settleInstitutions,institutionalEvent,validateInstitutions} from './governance.mjs';
import {NATIVE_OFFICIALS as OFFICIALS,initialTalents,recruitedOfficials,canServe,talentEfficiency,talentExpenses,inferRecruitment,recruitmentPlan,enactRecruitment,settleTalents,validateTalents} from './talents.mjs';
import {coreOffices,currentPosts,postLabel,aptitude,workload,workloadFactor,leaderEfficiency,checkLeader,dutyExpenses,portalDutyExpenses,affairDomain,addAffair,settleAffairs,validateDuties} from './assignments.mjs';
import {initializeRecords,recordYearEvent,settleYear,beginYear,validateRecords,duePlans} from './records.mjs';
import {recordInstitution,institutionSnapshot,institutionDelta,validateInstitutionReports} from './institution-records.mjs';
import {fundingSource} from './funding.mjs';
import {FISCAL_DEFAULTS,fiscalRules,rolePay,payroll,personPay,centralPay,validateFiscal,changeFiscal,inferFiscal,compensationSupport,settleCompensation} from './fiscal-rules.mjs';
export {fiscalRules,inferFiscal};
import {normalizeMonthly,monthlyScale,monthlyRequirement,monthlyAmount,hasMonthlyLanguage,monthlyCost,applyMonthly,retainMonthly,validateMonthlyPolicies} from './monthly-rules.mjs';
import {monthlyEntries,allocateMonth,isPaid,fundingLevel,validateBill} from './monthly-ledger.mjs';
import {findMonthlyEntity,inferMonthlyCommands,prepareMonthlyCommands} from './monthly-commands.mjs';
export {inferMonthlyCommands,prepareMonthlyCommands};
import {mobilizationCost,rememberHire,advanceWork,administrationNeed,militaryNeed} from './operational-rules.mjs';
import {cleanPetitionDraft,scalePetitionEffects,petitionBudgetLabel} from './petition-budget.mjs';
import {borderForecast} from './border-pressure.mjs';
import {storedProject,storedEvent,storedPresentation} from './saved-payloads.mjs';
import {primeEventMemory,markEvent,validateEventMemory,eligibleBaseEvents,eventCondition,payShortfall,quietSpacing,repeatedDevelopment} from './event-rules.mjs';
import {initialEconomy,canonicalDomain,economicPlan,validateEconomicPlan,activateEconomic,customsForecast,validateEconomy,restoreEconomicRecords,validateMonthLedger} from './economic-effects.mjs';
import {civilOfficials,installIncumbents,validateService,serviceAssignment,recordDelegation,seekTalent,engageTalent,settleService,validateDevelopmentEvent} from './civil-service.mjs';
import {validateDiscussions} from './dialogues.mjs';
import {EQUIPMENT,CATEGORIES,TEMPLATES,initialMilitary,equipmentCatalog,unitStatus,militaryForecast,arsenalCommand,settleMilitary,validateMilitary} from './equipment.mjs';
import {PLACES,SEA_ROUTES,initialTraveler,initialAtlas,horizonForecast,horizonCommand,settleHorizons,validateHorizons,inferWorldCommands as inferHorizonCommands,fantasyRules} from './horizons.mjs';
import {REGIONS,TACTICS,initialCampaign,warCommand,campaignForecast,settleCampaign,inferCampaignCommands,validateCampaign} from './campaigns.mjs';
export {REGIONS,TACTICS};
export const inferWorldCommands=(s,text,context={})=>[...inferHorizonCommands(s,text,context),...inferCampaignCommands(s,text)];
export {EQUIPMENT,CATEGORIES,TEMPLATES,equipmentCatalog,unitStatus,PLACES,SEA_ROUTES,fantasyRules};
export {coreOffices};
export {POWERS,administration,agencyStrength,institutionPlan};
export {OFFICIALS,recruitmentPlan};
export const officialCatalog=s=>[...OFFICIALS,...recruitedOfficials(s),...civilOfficials(s)].map(o=>{const posts=currentPosts(s,o.id),positionLabel=postLabel(posts);return {...o,hireCost:mobilizationCost(s,o),compensation:compensationSupport(s,o.id),monthlyPay:personPay(s,o.id),coveredMilitaryPay:s.militaryState.units.some(u=>u.commander===o.id&&u.commanderIncludedInBase),payByPost:Object.fromEntries(payroll(s,o.id).map(p=>[p.kind+':'+p.key,p.amount])),payByRole:Object.fromEntries(['central','office','agency','governor','commander'].map(kind=>[kind,rolePay(s,kind,o.id)])),currentPosts:posts,positionLabel,displayName:o.name+' · '+positionLabel,workload:workload(s,o.id),workloadFactor:workloadFactor(s,o.id),aptitudes:Object.fromEntries(TECH_DOMAINS.map(d=>[d.id,aptitude(s,o.id,d.id)]))};});
export function inferDutyLeader(s,text){
 const t=String(text||'').replace(/\s/g,'');
 const verbs=['委任','责成','任命','命','由'];
 return officialCatalog(s).find(o=>!verbs.some(p=>['不','勿','别','不要','暂不'].some(n=>t.includes(n+p+o.name)))&&verbs.some(p=>t.includes(p+o.name)))?.id||null;
}
const officialFor=(s,id)=>officialCatalog(s).find(o=>o.id===id);
export const VERSION = 1;
export const clamp = (x, lo=0, hi=100) => Math.max(lo, Math.min(hi, Number(x) || 0));
export const clone = x => structuredClone(x);
export const META = {
 money: ['国库','万两'], grain: ['官仓','万石'], stability: ['民心',''], army: ['军备',''],
 legitimacy: ['皇权',''], corruption: ['贪腐',''], tech: ['格物',''], navy: ['海权',''], frontier: ['边患','']
};
export const TECH_DOMAINS = [
 {id:'agriculture',name:'农政水利',desc:'每积累 20 点：夏秋粮入仓 +12，地区旱情每月 −0.5。',examples:'良种选育、轮作、灌溉、农技推广'},
 {id:'industry',name:'工矿制造',desc:'每积累 20 点：税入 +3%，月度格物 +0.3。',examples:'标准件、冶铁、煤矿、蒸汽动力原型'},
 {id:'finance',name:'财政金融',desc:'每积累 20 点：税收效率 +5%。',examples:'审计、预算、票号、银行与信用试点'},
 {id:'military',name:'军制军工',desc:'每积累 20 点：月度军备 +0.5。',examples:'参谋训练、火器标准、军工质量检验'},
 {id:'naval',name:'造船航海',desc:'每积累 20 点：月度海权 +0.5。',examples:'船型试验、测绘、船坞、远洋补给'},
 {id:'governance',name:'制度吏治',desc:'每积累 20 点：月度贪腐 −0.5。',examples:'文官考核、地方试点、法典、监察制度'},
 {id:'education',name:'教育科研',desc:'每积累 20 点：月度格物 +0.5。',examples:'基础教育、科学方法、印刷、专门学堂'},
 {id:'medicine',name:'公共卫生',desc:'每积累 20 点：月度民心 +0.3，粮耗减少 1 万石。',examples:'洁净饮水、隔离、防疫、医学试验'}
];
function inferDomain(text){
 const matches=[[/农|灌溉|水利|良种|轮作/,'agriculture'],[/银行|票号|货币|预算|金融|信用|开海|抽分|关税|海关|市舶|税关|商税/,'finance'],[/公共卫生|疫|医学|净水|饮水|卫生/,'medicine'],[/蒸汽|制造|矿|冶铁|工业|机床|电力/,'industry'],[/海军|水师|造船|远洋|航海/,'naval'],[/军|兵|核饷|边患|边防|炮|枪|参谋/,'military'],[/教育|学校|科研|科学|书院|数学/,'education'],[/制度|考核|吏治|法典|议会|宪|改革/,'governance']];
 return matches.find(([r])=>r.test(text))?.[1]||'education';
}
const domainLevel=(s,id)=>Math.floor((s.technology?.[id]||0)/20);
function gainKnowledge(s,domain,name,points=12){
 if(!points||!TECH_DOMAINS.some(d=>d.id===domain))return;
 s.technology[domain]=clamp(s.technology[domain]+points);
 s.institutions.unshift({id:'legacy-'+s.turn+'-'+s.institutions.length,name:String(name).slice(0,70),domain,date:dateLabel(s),turn:s.turn});
 s.institutions=s.institutions.slice(0,120);
}
export const PROVINCES = [
 {id:'capital',name:'京畿',subtitle:'天子脚下 · 漕粮命脉',x:552,y:188,polygon:'494,150 548,132 596,166 588,217 540,238 500,211',prosperity:62,unrest:25,drought:12},
 {id:'liaodong',name:'辽东',subtitle:'宁锦防线 · 后金压境',x:671,y:145,polygon:'602,112 670,75 738,96 722,161 649,188 590,169',prosperity:33,unrest:60,drought:19},
 {id:'shanxi',name:'山西',subtitle:'九边重镇 · 晋商往来',x:476,y:227,polygon:'437,164 492,151 500,212 529,240 495,277 446,268',prosperity:43,unrest:43,drought:54},
 {id:'shaanxi',name:'陕西',subtitle:'旱情蔓延 · 流民四起',x:390,y:273,polygon:'346,200 433,180 445,269 473,292 443,335 366,322 338,269',prosperity:28,unrest:71,drought:81},
 {id:'shandong',name:'山东',subtitle:'齐鲁粮仓 · 海运门户',x:597,y:264,polygon:'540,238 589,217 644,232 661,268 607,299 550,283',prosperity:58,unrest:37,drought:31},
 {id:'henan',name:'河南',subtitle:'中原腹地 · 黄河水患',x:498,y:311,polygon:'474,281 537,263 554,284 556,332 515,354 449,335',prosperity:42,unrest:53,drought:49},
 {id:'jiangnan',name:'南直隶',subtitle:'江南财赋 · 运河中枢',x:603,y:345,polygon:'557,299 612,299 651,327 650,370 607,392 555,365 533,348 556,331',prosperity:79,unrest:26,drought:15},
 {id:'huguang',name:'湖广',subtitle:'鱼米之乡 · 荆襄要冲',x:493,y:396,polygon:'449,337 515,356 553,367 565,424 529,458 454,443 429,395',prosperity:61,unrest:35,drought:22},
 {id:'sichuan',name:'四川',subtitle:'天府之国 · 山川险固',x:352,y:383,polygon:'280,330 366,324 444,338 427,394 450,442 379,455 310,423 277,378',prosperity:56,unrest:38,drought:27},
 {id:'zhemin',name:'浙闽',subtitle:'东南海贸 · 船厂林立',x:622,y:433,polygon:'607,393 654,373 679,405 654,451 635,493 590,481 566,425',prosperity:73,unrest:29,drought:10},
 {id:'liangguang',name:'两广',subtitle:'岭南商港 · 岭海之间',x:509,y:490,polygon:'451,445 529,460 565,429 589,481 632,497 590,529 517,540 453,516',prosperity:60,unrest:32,drought:19},
 {id:'yungui',name:'云贵',subtitle:'西南边地 · 驿路未通',x:361,y:492,polygon:'309,428 379,459 449,446 451,518 401,541 334,529 285,497',prosperity:34,unrest:50,drought:32}
];

export const ACTIONS = [
 {id:'relief',name:'开仓赈济',group:'民生',desc:'指定一地放粮，安置流民。救急有效，仍需水利善后。',cost:{money:16,grain:22},effects:{stability:3,legitimacy:1},regional:{unrest:-15,drought:-3},target:true},
 {id:'irrigation',name:'兴修水利',group:'民生',desc:'三个月后改善当地旱情与生产，施工期仍会耗费。',cost:{money:36,grain:8},project:{months:3,regional:{drought:-22,prosperity:12,unrest:-6},effects:{stability:3}},target:true},
 {id:'audit',name:'清查亏空',group:'吏治',desc:'两个月稽核账册后追回积欠，触动官绅利益；同一清查未结案时不能重复开办。',cost:{money:8},project:{months:2,effects:{money:28,corruption:-7,legitimacy:1}},factions:{gentry:-6,scholar:-2}},
 {id:'commerce',name:'整饬商税',group:'财政',desc:'清理关卡与重复征税，提高地区长期税基。',cost:{money:20},effects:{corruption:-2},regional:{prosperity:10,unrest:2},factions:{merchant:4,gentry:-2},target:true},
 {id:'train',name:'整训营伍',group:'军务',desc:'校阅兵额、训练火器与协同，增强军备。',cost:{money:26,grain:12},effects:{army:9,frontier:-3},factions:{army:4}},
 {id:'recruit',name:'招抚流民',group:'民生',desc:'以工代赈，把流民编入屯田，恢复地区生产。',cost:{money:22,grain:14},effects:{stability:2},regional:{unrest:-10,prosperity:5},target:true},
 {id:'arsenal',name:'火器工坊',group:'格物',desc:'四个月试制改良火炮；需材料、工匠与训练。',cost:{money:55,grain:8},project:{months:4,effects:{army:13,tech:8}}},
 {id:'academy',name:'农政译馆',group:'格物',desc:'三个月汇集农书、历算与工艺，建立知识体系。',cost:{money:36},project:{months:3,effects:{tech:12,stability:2}}},
 {id:'reform',name:'试行赋役改革',group:'财政',desc:'五个月清丈试点，改善征税效率，士绅将持续施压。',cost:{money:65,grain:10},factions:{gentry:-10},project:{months:5,effects:{corruption:-12,legitimacy:4},reform:true}},
 {id:'fleet',name:'筹建水师',group:'海事',desc:'五个月建造与训练远航船队；海权到 35 后开放全球博弈。',cost:{money:65,grain:18},requires:'diplomacy',project:{months:5,effects:{navy:18,tech:4}}},
 {id:'campaign',name:'边防经营',group:'军务',desc:'军备至少 60；维护边地补给与防务、缓解边患，不改变领土实控。',cost:{money:48,grain:30},requires:'diplomacy',minArmy:60,effects:{frontier:-12,army:-4,legitimacy:3,influence:6}},
 {id:'rest',name:'休养减赋',group:'民生',desc:'拨银减免积欠、安民养息，降低全国动乱。',cost:{money:28},effects:{stability:6},allRegional:{unrest:-3},factions:{gentry:2}}
];
export const COUNTRIES = [
 {id:'jin',name:'后金',area:'辽东 / 东北亚',power:78,relation:-65,text:'皇太极整合军政，威胁边防；和谈只能暂缓压力。'},
 {id:'mongol',name:'蒙古诸部',area:'漠南 / 草原',power:53,relation:-20,text:'诸部并非铁板一块，互市与边防同样重要。'},
 {id:'joseon',name:'朝鲜',area:'东北亚',power:38,relation:46,text:'东北亚局势牵动其安全与粮运。'},
 {id:'japan',name:'德川日本',area:'东亚海域',power:66,relation:0,text:'通过商贸获取白银与工艺，交往受海贸政策约束。'},
 {id:'dutch',name:'荷兰东印度公司',area:'台湾 / 南洋',power:72,relation:-18,text:'经营贸易据点；通商与港口利益可能发生冲突。'},
 {id:'portugal',name:'葡萄牙商团',area:'澳门 / 印度洋',power:51,relation:24,text:'远洋商路与火器技术可成为交换筹码。'},
 {id:'mughal',name:'莫卧儿帝国',area:'南亚',power:85,relation:0,text:'遥远而富庶；通商首先需要远洋补给与信誉。',global:true},
 {id:'ottoman',name:'奥斯曼帝国',area:'西亚 / 地中海',power:88,relation:0,text:'横跨商路的强国。接触属于航路拓展后的架空推演。',global:true},
 {id:'spain',name:'西班牙',area:'马尼拉 / 美洲',power:82,relation:0,text:'白银、商路与海上据点构成跨洋博弈。',global:true},
 {id:'england',name:'英格兰',area:'欧洲 / 大洋',power:58,relation:0,text:'远洋贸易力量增长，合作仍需航程与技术支持。',global:true}
];
export const EVENTS = [
 {id:'drought',title:'陕北旱情：民无宿粮',category:'民生急报',historical:'背景改编',text:'陕西布政司奏：连月少雨，乡里已有饥民出走。县仓存粮有限，若强催钱粮，恐激成民变。',options:[
 {label:'拨粮赈济，以工代赈',cost:{money:18,grain:25},effects:{stability:4},region:'shaanxi',regional:{unrest:-13,drought:-5}},
 {label:'暂缓征收，劝绅捐输',cost:{money:8},effects:{stability:2},factions:{gentry:-6},region:'shaanxi',regional:{unrest:-7}},
 {label:'照额催征，先保边饷',effects:{money:22,stability:-4},region:'shaanxi',regional:{unrest:10}}
 ]},
 {id:'pay',title:'辽饷告急：边军索饷',category:'辽东军报',historical:'背景改编',text:'宁锦一线催饷。将士担忧久欠成例，户部却称转运与征解皆有困难。兵部请求皇帝裁决。',options:[
 {label:'优先补发边饷',cost:{money:32,grain:12},effects:{army:6,frontier:-5},factions:{army:4}},
 {label:'先发半饷，督抚核实兵额',cost:{money:16},effects:{army:2,corruption:-2}},
 {label:'命其克难，暂候秋赋',effects:{army:-6,frontier:5},factions:{army:-7}}
 ]},
 {id:'gentry',title:'清丈之争：田亩隐而不报',category:'户部题本',historical:'架空事件',text:'试点州县丈量土地，地方士绅以祖制为由联名反对。官员担心严查将牵动仕途与宗族网络。',options:[
 {label:'保护办事官员，分县推进',cost:{money:15},effects:{corruption:-5,legitimacy:2},factions:{gentry:-6,scholar:2}},
 {label:'设过渡期，换取合作',cost:{money:8},effects:{corruption:-2},factions:{gentry:4}},
 {label:'停止清查，安抚地方',effects:{legitimacy:-3,corruption:3},factions:{gentry:8}}
 ]},
 {id:'flood',title:'黄河汛情：河堤待修',category:'河道奏报',historical:'背景改编',text:'河南沿河水势上涨，河工急需物料。若处置失当，田亩和漕运都可能受损。',options:[
 {label:'急拨河工，组织抢险',cost:{money:24,grain:10},effects:{stability:3},region:'henan',regional:{unrest:-6,prosperity:3}},
 {label:'先疏散百姓，缓修河堤',cost:{money:10,grain:8},region:'henan',regional:{unrest:-2,prosperity:-5}},
 {label:'留银备边，由地方自筹',effects:{stability:-3},region:'henan',regional:{unrest:9,prosperity:-8}}
 ]},
 {id:'craft',title:'西法与农书：要不要试一试',category:'格物奏议',historical:'架空事件',text:'士人建议集历算、农学与火器工匠于一馆，先做小规模试验。有人担心耗费，有人指斥奇技淫巧。',options:[
 {label:'拨银试验，以成效说话',cost:{money:22},effects:{tech:6},factions:{scholar:-2,merchant:3}},
 {label:'只准民间刊刻交流',cost:{money:6},effects:{tech:2}},
 {label:'暂缓，先救眼前之急',effects:{legitimacy:1}}
 ]},
 {id:'border',title:'边墙急递：骑兵窥伺关口',category:'边防警报',historical:'背景改编',text:'守臣报告边外骑兵活动频繁。宁锦固然有备，蓟镇关口同样需要粮械与哨探。',options:[
 {label:'补强关口，增设侦骑',cost:{money:24,grain:10},effects:{frontier:-7,army:2}},
 {label:'集中兵力，保住要道',cost:{money:10},effects:{frontier:-2}},
 {label:'不动，静观敌势',effects:{frontier:6,army:-2}}
 ]},
 {id:'trade',title:'海商请愿：通商还是严禁',category:'沿海题本',historical:'架空事件',text:'东南商人提出以登记纳税换取通商许可。地方官忧虑走私、海盗和税银去向。',options:[
 {label:'设海关试点，严查侵吞',cost:{money:12},effects:{money:28,navy:2,corruption:-1},factions:{merchant:7,gentry:-2}},
 {label:'有限许可，先验船籍',effects:{money:12,navy:1}},
 {label:'严禁出海，固守海防',effects:{navy:-2},factions:{merchant:-7}}
 ]}
];
const INITIAL_LOG = '崇祯元年，天下多事。你接过的是一副仍有余力、却处处漏水的国家机器。国运从今日改写。';
function legacyEvent(s,inst=s.institutions[0]){
 const d=TECH_DOMAINS.find(d=>d.id===inst.domain);
 return {id:'legacy',domain:inst.domain,title:'新政回响：'+inst.name,category:'新法试点续报',historical:'架空分支',text:'自'+inst.name+'试行后，地方已积累一批'+d.name+'经验。支持者希望扩充人手，反对者认为新法有违旧制。如何对待这些已经改变现实的尝试？',options:[
 {label:'拨款推广，保存试验记录',cost:{money:20,grain:5},effects:{tech:2,stability:1},knowledge:4,factions:{gentry:-3}},
 {label:'维持试点，先检验长期成效',cost:{money:6},effects:{legitimacy:1},knowledge:2},
 {label:'暂停扩展，争取地方理解',effects:{legitimacy:-1},factions:{gentry:4}}
 ]};
}
function nextEvent(s,consumeStory=false,restoreId=null){
 if(restoreId){if(restoreId==='legacy')return legacyEvent(s);if(restoreId==='institutions')return institutionalEvent(s);const restored=EVENTS.find(e=>e.id===restoreId);if(restored)return clone(restored);}
 primeEventMemory(s);
 if(s.year===1629&&s.month===11&&!s.resolvedEvents.includes('jisi')&&!s.affairs.some(a=>a.petition?.id==='jisi')){
  const prepared=s.frontier<50&&s.army>=55;
  return {id:'jisi',category:'己巳边警',historical:'史实背景 · 条件分支',title:prepared?'蓟镇有备：敌骑难以深入':'蓟镇急报：敌骑绕道逼近',text:prepared?'边外传来骑兵绕道的情报。先前的钱粮、哨探与关口整备已经改变局势，守臣判断可守住要道。':'敌军尝试绕过宁锦，由蓟镇关口南下。眼下形势取决于你的边备与救援，历史结局并未写定。',options:prepared?[
 {label:'坚守要道，徐图反击',cost:{money:14,grain:10},effects:{frontier:-12,legitimacy:4}},
 {label:'以守为主，节省军需',cost:{money:6},effects:{frontier:-5,legitimacy:2}},
 {label:'追击边外，扩大战果',cost:{money:35,grain:22},effects:{frontier:-15,army:-5,legitimacy:5}}
 ]:[
 {label:'急调援军，保卫京畿',cost:{money:38,grain:25},effects:{frontier:-5,army:-5,legitimacy:1}},
 {label:'坚壁清野，保住中枢',cost:{money:20,grain:12},effects:{frontier:2,stability:-4}},
 {label:'征募民兵，地方自守',effects:{army:-8,stability:-7,frontier:10}}
 ]};
 }
 if(consumeStory&&quietSpacing(s)&&!s.affairs.some(a=>a.petition?.id.startsWith('development-'))){while(s.service.story.queue.length){const e=s.service.story.queue.shift();if(!repeatedDevelopment(s,e))return e;}}
 const candidates=eligibleBaseEvents(s,[...EVENTS.map(e=>e.id),'institutions']);if(candidates.length){const pick=candidates[0];if(pick.id==='institutions')return institutionalEvent(s);const e=clone(EVENTS.find(e=>e.id===pick.id));if(e.id==='pay'){const debt=payShortfall(s);e.text='上次实际结算中，边军相关钱粮未足额落实：银缺 '+debt.money+' 万两、粮缺 '+debt.grain+' 万石。兵部请据实议定补拨，或调整后续供给。';}return e;}
 return null;
}
export function createGame({mode='balanced',seed=Date.now(),traveler=false}={}) {
 const relaxed = mode === 'sandbox';
 const s={version:VERSION,id:String(seed)+'-'+Math.random().toString(36).slice(2,7),revision:0,seed:Number(seed)>>>0,mode:relaxed?'sandbox':'balanced',technology:Object.fromEntries(TECH_DOMAINS.map(d=>[d.id,0])),institutions:[],year:1628,month:1,turn:0,actionsLeft:null,
 money:relaxed?850:460,grain:relaxed?480:260,stability:43,army:49,legitimacy:62,corruption:67,tech:8,navy:5,frontier:64,influence:0,
 tax:1,military:1,reformed:false,government:initialGovernment(),agencies:[],talents:initialTalents(),nextTalentId:4,provinces:clone(PROVINCES),countries:clone(COUNTRIES),officials:[],projects:[],affairs:[],edicts:[],
 factions:{gentry:54,scholar:56,army:42,merchant:38},event:clone(EVENTS[0]),eventSerial:0,resolvedEvents:[],eventMemory:[{key:'drought',turn:0,signature:'opening'}],
 history:[{turn:0,date:'1628 · 正月',title:'御极之初',text:INITIAL_LOG,type:'system'}],
 ledger:null,unlocks:{diplomacy:relaxed,global:relaxed},achievements:[],ended:null,monthlyResults:[],notices:[],discussions:[],traveler:initialTraveler(traveler||mode==='traveler'),atlas:initialAtlas(),militaryState:initialMilitary(),campaignState:initialCampaign()};
 s.fiscal={rates:{...FISCAL_DEFAULTS},salaries:{}};s.economy=initialEconomy();s.monthlyPolicies=[];s.monthlyAuditVersion=1;s.stateSchema=1;for(const p of s.provinces)p.governor=null;for(const u of s.militaryState.units)u.commander=null;s.event.leader=null;installIncumbents(s);initializeRecords(s);s.institutionReports=[];return s;
}
function rng(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function dateLabel(s){return '崇祯'+(s.year===1628?'元':s.year-1627)+'年 · '+['正','二','三','四','五','六','七','八','九','十','十一','十二'][s.month-1]+'月';}
function log(s,title,text,type='policy'){const entry={turn:s.turn,date:dateLabel(s),title:String(title).slice(0,100),text:String(text).slice(0,2600),type};s.history.unshift(entry);s.history=s.history.slice(0,180);recordYearEvent(s,entry);}
function institutionName(s,key){return key?.startsWith('office:')?coreOffices(s).find(o=>'office:'+o.id===key)?.name||key:(s.agencies||[]).find(a=>'agency:'+a.id===key)?.name||key;}
function effects(s,e){for(const[k,v]of Object.entries(e||{})){if(!Number.isFinite(v)||!(k in META)&&k!=='influence')continue;s[k]=['money','grain','influence'].includes(k)?Math.max(0,s[k]+v):clamp(s[k]+v);}}
function regionEffects(p,e){for(const[k,v]of Object.entries(e||{}))if(['unrest','drought','prosperity'].includes(k))p[k]=clamp(p[k]+v);}
function factions(s,e){for(const[k,v]of Object.entries(e||{}))if(k in s.factions)s.factions[k]=clamp(s.factions[k]+v);}
function afford(s,cost){for(const[k,v]of Object.entries(cost||{}))if(s[k]<v)throw Error('不足：'+(META[k]?.[0]||k)+'需要 '+v+(META[k]?.[1]||''));}
function pay(s,cost){afford(s,cost);for(const[k,v]of Object.entries(cost||{}))s[k]-=v;}
function coverExpense(s,cost,funding,label){
 if(fundingSource(s,{funding})!=='portal'||!(cost?.money>0||cost?.grain>0))return;
 const report=horizonCommand(s,{operation:'resources',money:cost.money||0,grain:cost.grain||0,note:'直接供给 '+label+'，不占用既有国库钱粮'});log(s,report.title,report.text,'world');
}
function ready(s){if(s.ended)throw Error('本局已结束，请另开新局。');}
function useAction(s){ready(s);}
function finish(s){s.actionsLeft=null;checkUnlocks(s);s.revision++;return s;}
export function intervene(state,command){if(!command||!['arsenal','horizon','war'].includes(command.type))throw Error('不支持的干预类型。');const s=clone(state);if(command.type==='arsenal'&&command.operation==='create_unit'&&command.funding==='portal')coverExpense(s,{money:12},'portal','组建独立部队');const report=command.type==='arsenal'?arsenalCommand(s,command):command.type==='war'?warCommand(s,command,officialCatalog(s)):horizonCommand(s,command);log(s,report.title,report.text,command.type==='arsenal'?'military':'world');return finish(s);}
export function undoSatellite(state,{previousUnlocks}={}){
 const s=clone(state),t=s.traveler,last=s.history[0],prior=t.satelliteUndo||previousUnlocks;
 if(!t.satellites||last?.title!=='侦察卫星入轨 · 全球开图'||last.turn!==s.turn)throw Error('只能撤销尚未继续其他政务或月结的最近一次卫星开图。');
 if(!prior||typeof prior.global!=='boolean'||typeof prior.diplomacy!=='boolean')throw Error('缺少开图前的解锁记录，无法准确撤销。');
 t.satellites--;t.energy=Math.min(200,t.energy+20);t.interventions=Math.max(0,t.interventions-1);delete t.satelliteUndo;
 if(!t.satellites){s.atlas.allVisible=false;for(const [id,d]of Object.entries(s.atlas.discoveries)){if(d.source==='satellite'&&!d.visited)delete s.atlas.discoveries[id];else if(d.source==='satellite+voyage'||d.source==='satellite'&&d.visited)d.source='voyage';}}
 s.unlocks.global=t.satellites>0||prior.global;s.unlocks.diplomacy=prior.diplomacy;
 log(s,'撤销误点卫星开图','撤回最近一次误点的卫星部署，返还 20 点时空能量；正常海图、实际探航与征服记录保留。','world');return finish(s);
}
function checkUnlocks(s) {
 if(!s.unlocks.diplomacy&&s.tech>=20&&s.stability>=45){s.unlocks.diplomacy=true;s.notices.push('四海渐开：外务与边地经略已解锁。');log(s,'四海渐开','格物达到 20、民心达到 45，朝廷开始有余力处理长期外务。','unlock');}
 if(!s.unlocks.global&&s.unlocks.diplomacy&&s.navy>=35&&s.tech>=35){s.unlocks.global=true;s.notices.push('万国棋局：远洋航路与全球势力已解锁。');log(s,'万国棋局','海权达到 35、格物达到 35，远洋补给与跨洋商路开始成形。','unlock');}
 const goals=[['安民有方',s.stability>=70],['仓廪充实',s.money>=900&&s.grain>=450],['边疆暂宁',s.frontier<=25],['中兴初成',s.turn>=36&&s.stability>=65&&s.army>=65&&s.money>=300],['万国来航',s.influence>=60&&s.unlocks.global]];
 for(const[n,ok]of goals)if(ok&&!s.achievements.includes(n)){s.achievements.push(n);s.notices.push('成就达成：'+n);}
}
const actionDomain=a=>({relief:'agriculture',irrigation:'agriculture',audit:'governance',commerce:'finance',train:'military',recruit:'agriculture',arsenal:'military',academy:'education',reform:'governance',fleet:'naval',campaign:'military',rest:'governance'}[a])||'governance';
export function doAction(state,id,targetId,official=null,{funding='treasury',monthly=null}={}) {
 const s=clone(state);const a=ACTIONS.find(x=>x.id===id);if(!a)throw Error('未知政务');
 if(id==='train'&&monthly)return applyEdict(state,attachMonthly({title:a.name,narrative:a.desc,feasibility:'按已定月拨分期督训，不另套一次性整军支出。',minister:'按月核验营伍。',cost:clone(a.cost),effects:clone(a.effects),regional:{},factions:clone(a.factions),target:null,project:null,domain:'military',monthly,funding,input:'整兵月度差遣',source:'local'},'整兵月度差遣'),official);
 if(a.requires&&!s.unlocks[a.requires])throw Error('尚未具备开展此项事务的条件。');
 if(a.minArmy&&s.army<a.minArmy)throw Error('军备至少达到 '+a.minArmy+' 才能出兵。');
 if(a.id==='reform'&&(s.reformed||s.projects.some(p=>p.action==='reform')))throw Error('赋役改革已施行或正在推进。');
 const p=a.target?s.provinces.find(p=>p.id===targetId):null;
 if(a.target&&!p)throw Error('请先选择施政地区。');
 if(a.project&&s.projects.some(p=>p.action===a.id&&(p.target||null)===(a.target?targetId:null)))throw Error('相同工程已在推进，请待现有工程结案后再开办。');
 const leader=checkLeader(s,official);
 coverExpense(s,a.cost,funding,a.name);afford(s,a.cost);useAction(s);pay(s,a.cost);effects(s,a.effects);factions(s,a.factions);if(id==='train')for(const u of s.militaryState.units)u.training=clamp(u.training+6);
 if(p)regionEffects(p,a.regional);if(a.allRegional)s.provinces.forEach(p=>regionEffects(p,a.allRegional));
 if(a.project)s.projects.push({id:'p'+s.turn+'-'+s.revision,action:a.id,name:a.name,target:targetId||null,total:a.project.months,remaining:a.project.months,domain:actionDomain(a.id),leader,workCredit:0,...clone(a.project),...(funding==='portal'?{funding}:{})});
 else addAffair(s,{name:a.name,domain:actionDomain(a.id),target:p?.id||null,leader,order:a.desc,funding});
 if(monthly){const entity=a.project?s.projects.at(-1):s.affairs.at(-1);entity.monthly=normalizeMonthly(monthly,'',{saved:true});}
 log(s,a.name+(p?' · '+p.name:''),a.desc+(leader?' 督办：'+officialFor(s,leader).name+'。':''));return finish(s);
}
export function resolveEvent(state,index,official=undefined,{funding='treasury',petition=null}={}){
 if(index===-1&&!petition){const held=clone(state);ready(held);if(!held.event)throw Error('本月奏报已处置。');holdPetition(held);return finish(held);}
 const s=clone(state);ready(s);const held=petition?s.affairs.find(a=>a.id===petition&&a.petition):null,e=petition?held?.petition:s.event;if(!e)throw Error('本月奏报已处置。');
 if(!Number.isInteger(index)||!e.options[index])throw Error('无效批复。');
 const o=e.options[index],leader=checkLeader(s,official===undefined?e.leader:official);coverExpense(s,o.cost,funding,e.title);pay(s,o.cost);effects(s,o.effects);factions(s,o.factions);
 const p=s.provinces.find(p=>p.id===o.region);if(p)regionEffects(p,o.regional);
 log(s,'御批 · '+e.title,o.label+'。'+(leader?'督办：'+officialFor(s,leader).name+'。':'')+(e.historical==='架空事件'?'此事件为游戏推演。':'此事件据时代背景改编，非具体史事复刻。'),'event');
 if(o.knowledge&&s.technology[e.domain]!==undefined)s.technology[e.domain]=clamp(s.technology[e.domain]+o.knowledge);
 if(o.burden)s.government.burden=clamp(s.government.burden+o.burden);
 addAffair(s,{name:e.title,domain:affairDomain(e),target:o.region||null,leader,order:o.label,funding});
 markEvent(s,e);s.resolvedEvents.push(e.id);if(held)s.affairs=s.affairs.filter(a=>a.id!==held.id);else s.event=null;return finish(s);
}
export function appoint(state,id){
 const s=clone(state);const o=officialFor(s,id);if(!o)throw Error('此人尚未归附或不在可任用名单中。');
 if(s.officials.includes(id))throw Error('此人已在任。');
 if(s.officials.length>=256)throw Error('人物任职记录过多。');
 const cost=mobilizationCost(s,o);afford(s,{money:cost});useAction(s);pay(s,{money:cost});rememberHire(s,id);s.officials.push(id);log(s,'起用 · '+o.name,o.role+'。'+o.skill);return finish(s);
}
export function dismiss(state,id){
 const s=clone(state);ready(s);if(!s.officials.includes(id))throw Error('此人未在任。');useAction(s);
 const o=officialFor(s,id);s.officials=s.officials.filter(x=>x!==id);const t=s.talents.find(t=>t.id===id);if(t)t.loyalty=clamp(t.loyalty-4);effects(s,{legitimacy:-1});log(s,'调整班底',o.name+'解除中枢差遣，皇权 −1。');return finish(s);
}
export function assignAgencyLeader(state,id,official){
 const s=clone(state),a=s.agencies.find(a=>a.id===id);if(!a)throw Error('机构不存在。');
 if(official===a.leader)throw Error('负责人未变化。');
 const o=official?officialFor(s,official):null;if(official&&!o)throw Error('此人尚未归附或不在可任用名单中。');
 const cost={money:o?mobilizationCost(s,o):0};afford(s,cost);useAction(s);pay(s,cost);rememberHire(s,official);a.leader=official||null;
 log(s,a.name+' · 人事',o?'委任'+o.name+'主持署务；在原有专任外兼领机构职务，每月管理开支按现行薪俸规则结算。':'解除该机构负责人职务。');
 return finish(s);
}
export function assignDuty(state,kind,id,official){
 const s=clone(state),duty=kind==='project'?s.projects.find(p=>p.id===id):kind==='affair'?(s.affairs||[]).find(a=>a.id===id):kind==='event'&&s.event?.id===id?s.event:null;
 if(!duty)throw Error('此项事务已结束或不存在。');
 const leader=checkLeader(s,official);if((duty.leader||null)===leader)throw Error('负责人未变化。');
 useAction(s);duty.leader=leader;if(duty.petition)duty.petition.leader=leader;
 log(s,'差遣 · '+(duty.name||duty.title),leader?'委任'+officialFor(s,leader).name+'督办；每月差旅核验费 '+fiscalRules(s).dutyFee+' 万两，职责适配与兼任负担影响成效。':'解除专人督办，改由六部按原案办理。','personnel');return finish(s);
}
export function assignOfficeLeader(state,id,official){
 const s=clone(state),office=coreOffices(s).find(o=>o.id===id);if(!office)throw Error('此常设衙门已撤销或不存在。');
 const leader=checkLeader(s,official);if(leader===office.leader)throw Error('主官未变化。');const o=leader?officialFor(s,leader):null;
 const cost=o?mobilizationCost(s,o):0;afford(s,{money:cost});useAction(s);pay(s,{money:cost});rememberHire(s,leader);s.government.officeLeaders||={};if(leader)s.government.officeLeaders[id]=leader;else s.government.officeLeaders[id]=null;
 log(s,office.name+' · 主官',leader?'委任'+o.name+'主持部务；每月署务管理费按现行薪俸规则结算，适配与兼任负担影响成效。':'解除专任主官，由常设属官维持原有部务。','personnel');return finish(s);
}
export function restoreEconomy(state){const s=clone(state),before=forecast(s),restored=restoreEconomicRecords(s);if(restored.length){log(s,'持续税源校正',restored.map(r=>r.name+'：'+({active:'已登记持续税源',closed:'已停办',pending:'随原案待验收'}[r.status])).join('；')+'。月税入预估 '+before.revenue+' → '+forecast(s).revenue+' 万两。当前国库银粮与既有月结账目保持原值。','system');s.revision++;}return s;}
export function setMonthly(state,c){const s=clone(state),entity=findMonthlyEntity(s,c.kind,c.target);if(!entity)throw Error('月拨对象已结束或不存在。');useAction(s);const before=forecast(s).expenses;if(c.monthly===null)delete entity.monthly;else entity.monthly=normalizeMonthly({...entity.monthly,...c.monthly,required:monthlyRequirement(entity.monthly||c.monthly),...((c.monthly?.money>0||c.monthly?.grain>0)&&c.monthly.paused===undefined?{paused:false}:{})},'',{saved:true});log(s,'月度预算 · '+(entity.name||entity.title),'现行月拨 '+(entity.monthly?.money??'按原标准')+' 万两、粮 '+(entity.monthly?.grain??'按原标准')+' 万石。'+(entity.monthly?.paused?'已停拨，相关工作暂停。':'自下次月结核拨；结案、期限与持续标记决定何时停收。')+' 月度国库支出 '+before+' → '+forecast(s).expenses+' 万两。','policy');return finish(s);}
export function restoreMonthlyState(state){const s=clone(state);if(s.monthlyAuditVersion===1)return s;let budgets=0,posts=0;
 for(const a of [...s.projects,...s.affairs]){const e=s.edicts.find(e=>e.title===a.name);if(e&&!a.monthly){const m=normalizeMonthly(null,e.input);if(m){a.monthly=m;budgets++;}}}
 for(const r of s.service.recommendations.filter(r=>r.status==='proposed')){if(r.mission?.plan&&typeof r.mission.plan!=='object')delete r.mission.plan;const m=normalizeMonthly(null,r.task);if(m){r.mission.monthly=m;for(const t of s.discussions)for(const message of t.messages)if(message.result?.status==='discussed'&&message.commands?.some(c=>c.type==='service'&&c.recommendation===r.id))message.result.text+='\n月结核对：本差月拨 '+(m.money||0)+' 万两，未批准前不扣款；地面差遣不套用船队启动费。';budgets++;}}
 for(const e of [...s.edicts].reverse()){if(!/督师蓟辽|督师.{0,5}辽东/.test(e.input))continue;const o=officialCatalog(s).find(o=>e.input.includes(o.name)),u=s.militaryState.units.find(u=>u.region==='liaodong');if(!o||!u||u.commander||s.history.some(h=>h.turn>=e.turn&&h.title==='委任统帅 · '+u.name)||s.edicts.some(later=>later.turn>=e.turn&&later!==e&&later.input.includes(o.name)&&/督师|统帅|兵权|指挥/.test(later.input)&&/罢免|免去|解除|交出|撤职/.test(later.input)))continue;u.commander=o.id;if(/不发新饷|概不拨银粮|边饷仍由|辽饷旧例/.test(e.input))u.commanderIncludedInBase=true;posts++;}
 s.monthlyAuditVersion=1;log(s,'月结与边防记录核对','按原旨补全 '+budgets+' 项月拨数据、'+posts+' 项持续军职。尚未批准的建议仍未执行；原旨已含旧饷者不另加发俸。当前银粮、月份与实装保持原值。','system');s.revision++;return s;}
export function setFiscal(state,command){const s=clone(state),before=forecast(s).expenses;useAction(s);const note=changeFiscal(s,command);log(s,'薪俸与经费新例',note+' 月度支出预估 '+before+' → '+forecast(s).expenses+' 万两；本次不追溯补扣，不改变当前银粮。','policy');return finish(s);}
export function serviceCommand(state,c){
 let s=clone(state);useAction(s);
 if(c.operation==='seek'){const note=seekTalent(s,c.institution,c.domain);log(s,'访求人才',note,'personnel');return finish(s);}
 if(c.operation==='engage'){const note=engageTalent(s,c.person);log(s,'核验与试差',note,'personnel');return finish(s);}
 if(c.operation!=='delegate')throw Error('未知属员差遣。');
 const {r,p}=serviceAssignment(s,c),m=r.mission,before=s;let entity;
 if(m.type==='horizon'){
  const route=SEA_ROUTES.find(q=>q.id===m.route),goalLeg=route?.legs.findIndex(l=>l.to===m.goal)+1;if(!goalLeg)throw Error('探访目的地不在议定航路上。');
  s=intervene(s,m);const v=s.atlas.voyages.find(v=>!before.atlas.voyages.some(o=>o.id===v.id));if(!v)throw Error('船队未能建立。');entity={kind:'voyage',id:v.id,name:v.name,goalLeg};
 }else if(m.type==='action'){
  s=doAction(s,m.action,m.target,p.id,{monthly:m.monthly});const project=s.projects.find(a=>!before.projects.some(b=>b.id===a.id)),affair=s.affairs.find(a=>!before.affairs.some(b=>b.id===a.id)),a=project||affair;if(!a)throw Error('差遣没有建立实际事务。');a.institution=r.institution;entity={kind:project?'project':'affair',id:a.id,name:a.name};
 }else if(m.type==='edict'){
  const plan=m.plan&&typeof m.plan==='object'&&!Array.isArray(m.plan)?normalizeEdict({...m.plan,domain:m.domain,funding:'treasury'},s,m.text):localEdict(s,m.text);if(plan.institutionChanges?.length||plan.recruitment||plan.interventions?.length)throw Error('属员差遣只承办本次事务，设署、招安或特殊能力请另行明旨。');
  s=applyEdict(s,plan,p.id);const project=s.projects.find(a=>!before.projects.some(b=>b.id===a.id)),affair=s.affairs.find(a=>!before.affairs.some(b=>b.id===a.id)),a=project||affair;if(!a)throw Error('未建立实际承办案卷，请明示任务。');a.institution=r.institution;entity={kind:project?'project':'affair',id:a.id,name:a.name};
 }else throw Error('请先议定具体任务再差遣。');
 recordDelegation(before,s,r,p,entity);log(s,'奉旨差遣 · '+p.name,p.role+'承办“'+r.task+'”；由'+institutionName(s,r.institution)+'督察。按原任务钱粮与工期办理，不另收高官起用费。','personnel');recordInstitution(s,r.institution,institutionName(s,r.institution),{kind:'order',status:'executed',title:'属员差遣 · '+p.name,text:r.task,leader:p.id});return finish(s);
}
export function setAgencyBudget(state,id,budget){
 const s=clone(state),a=s.agencies.find(a=>a.id===id);if(!a)throw Error('机构不存在。');
 if(!Number.isInteger(budget)||budget<0||budget>20)throw Error('机构月拨须为 0 至 20 万两整数。');
 if(a.budget===budget)throw Error('预算未变化。');useAction(s);a.budget=budget;if(!budget)a.funded=false;
 log(s,a.name+' · 经费','月拨改为 '+budget+' 万两。'+(budget?'于月结拨付。':'停拨期间筹备与职能暂停。'));return finish(s);
}
export function policy(state,tax,military){
 const s=clone(state);if(![0.8,1,1.2,1.4].includes(tax)||![0.8,1,1.25].includes(military))throw Error('无效国策参数');
 if(tax===s.tax&&military===s.military)throw Error('国策未变化。');useAction(s);s.tax=tax;s.military=military;log(s,'调整钱粮国策','征税倍率 '+tax+'；军费倍率 '+military+'。新国策于月结生效。');return finish(s);
}
export function diplomacy(state,countryId,kind){
 const s=clone(state);if(!s.unlocks.diplomacy)throw Error('外务尚未解锁。');
 const c=s.countries.find(c=>c.id===countryId);if(!c||c.global&&!s.unlocks.global)throw Error('航路尚不可达。');
 const costs={envoy:{money:22,grain:4},trade:{money:28,grain:8},pressure:{money:40,grain:18}};
 if(!costs[kind])throw Error('未知外务行动');
 if(kind==='trade'&&s.affairs.some(a=>a.trade?.country===c.id))throw Error('该国商队尚未回航，待本轮结算后再议下一航次。');
 if(kind==='trade'&&c.relation<0)throw Error('关系至少为 0 才能建立商路。');
 if(kind==='pressure'&&(s.army<60||c.global&&s.navy<45))throw Error('军备至少 60；远洋威慑另需海权 45。');
 afford(s,costs[kind]);useAction(s);pay(s,costs[kind]);let text='';
 if(kind==='envoy'){c.relation=clamp(c.relation+16,-100,100);if(c.id==='jin')effects(s,{frontier:-3});text='使团互通声息，关系 +16。对手仍会按实力行事。';}
 if(kind==='trade'){const gain=Math.round(34+c.relation/5+(s.unlocks.global?12:0));addAffair(s,{name:'商队往返 · '+c.name,domain:'naval',order:'实际商队两个月后回航结算，不即时获得回款。'});s.affairs.at(-1).trade={country:c.id,payout:gain,started:s.turn};text='已派商队，启动支出银28万两、粮8万石；预计两个月回航后报解 '+gain+' 万两并记录交流成果，在途不重复发船。';}
 if(kind==='pressure'){const chance=clamp(50+(s.army-c.power)/2+s.navy/5,15,85);if(rng(s)*100<chance){effects(s,{influence:10,legitimacy:2,frontier:c.id==='jin'?-7:0});c.relation=clamp(c.relation-9,-100,100);text='威慑促成有利商约，影响 +10；领土实控不变。';}else{effects(s,{army:-6,legitimacy:-2});c.relation=clamp(c.relation-16,-100,100);text='补给受挫，军备 −6、皇权 −2。';}}
 log(s,({envoy:'遣使',trade:'通商',pressure:'威慑'}[kind])+' · '+c.name,text,'world');return finish(s);
}
export function forecast(s){
 const prosperity=s.provinces.reduce((n,p)=>n+p.prosperity,0)/s.provinces.length,unrest=s.provinces.reduce((n,p)=>n+p.unrest,0)/s.provinces.length,rates=fiscalRules(s),war=campaignForecast(s),customs=customsForecast(s),cashRound=v=>Math.round(v*100)/100;
 const coreMultiplier=(s.government.cabinet?1:.92)*(s.government.transition>0?.96:1),merchantFactor=1+Math.max(0,s.factions.merchant-50)/1000;
 const rawTax=((39+prosperity*.55)*(1-s.corruption/180)*s.tax*(s.reformed?1.18:1)*(1+domainLevel(s,'finance')*.05+domainLevel(s,'industry')*.03)+war.revenue)*coreMultiplier*merchantFactor;
 const grainBase=Math.max(10,Math.round(15+10*s.military*(militaryNeed(s)-3)/21+unrest/16-domainLevel(s,'medicine'))),entries=monthlyEntries(s,{people:officialCatalog(s),catalog:equipmentCatalog(s),grainBase});
 const fundingHarvest=[6,9].includes(s.month)?Math.round(110+prosperity-unrest*.6+domainLevel(s,'agriculture')*12+war.harvest):0;
 const baseReceipts=support=>{const collection=.2+.8*support;return cashRound(cashRound(rawTax*collection)+customs.sources.reduce((n,r)=>n+cashRound(r.revenue*collection),0));};
 let fundingRevenue=baseReceipts(0);
 for(let n=0;n<100;n++){const support=Math.min(1,Math.min(rates.administrationBase,Math.max(0,s.money+fundingRevenue))/administrationNeed(s)),next=baseReceipts(support);if(next===fundingRevenue)break;fundingRevenue=next;}
 const book=allocateMonth(entries,s.money+fundingRevenue,s.grain+fundingHarvest),paid=id=>isPaid(book,id),level=id=>fundingLevel(book,id),operating={...s,fiscal:clone(s.fiscal)};settleCompensation(operating,book);const agency=agencyEconomy(operating,paid,level),admin=administration(operating,paid);
 const revenueBonus=s.officials.reduce((n,id)=>n+(paid('pay:central:'+id)?(officialFor(s,id)?.bonus.revenue||0)*talentEfficiency(s,id)*workloadFactor(s,id)*compensationSupport(operating,id):0),0),collection=.2+.8*level('base:administration');
 const ordinaryRevenue=cashRound(rawTax*collection*(1+revenueBonus)*(1+agency.revenueBonus)*(admin.revenueMultiplier/coreMultiplier)),economicSources=customs.sources.map(r=>({...r,revenue:cashRound(r.revenue*collection)})),customsRevenue=cashRound(economicSources.reduce((n,r)=>n+r.revenue,0)),revenue=cashRound(ordinaryRevenue+customsRevenue);
 const total=(groups,key='money',funding='treasury')=>Math.round(entries.filter(e=>(!groups||groups.includes(e.group))&&e.funding===funding).reduce((n,e)=>n+e[key],0)*10000)/10000,expenses=total(null),grainUse=total(null,'grain');
 const border=borderForecast(operating,id=>leaderEfficiency(operating,id,'military'),paid),extras=[...s.projects,...s.affairs,...(s.monthlyPolicies||[]),...s.atlas.voyages.filter(v=>v.status==='sailing')].filter(p=>p.monthly&&monthlyScale(p.monthly)>0&&p.monthly.effects.frontier&&paid((s.projects.includes(p)?'project':s.affairs.includes(p)?'affair':s.atlas.voyages.includes(p)?'voyage':'policy')+':'+p.id)).map(p=>({name:p.name+'月度落实',value:p.monthly.effects.frontier*monthlyScale(p.monthly)}));if(s.officials.includes('yuan')&&paid('pay:central:yuan'))extras.push({name:'袁崇焕中枢边防统筹',value:-3*talentEfficiency(s,'yuan')*workloadFactor(s,'yuan')*compensationSupport(operating,'yuan')});border.baseNet=border.net;border.items.push(...extras);border.net=Math.round(border.items.reduce((n,r)=>n+r.value,0)*1000)/1000;
 const monthlyWork=['project','affair','policy','voyage'].flatMap(kind=>({project:s.projects,affair:s.affairs,policy:s.monthlyPolicies||[],voyage:s.atlas.voyages})[kind].filter(a=>a.monthly&&!a.petition&&(kind!=='voyage'||a.status==='sailing')).map(a=>{const need=monthlyRequirement(a.monthly);return {id:a.id,name:a.name,kind,requiredMoney:need.money,requiredGrain:need.grain,authorizedMoney:a.monthly.money||0,authorizedGrain:a.monthly.grain||0,ratio:monthlyScale(a.monthly)};}));
 return {ordinaryRevenue,customsRevenue,economicSources,entries,border,monthlyWork,fundingRevenue:Math.min(fundingRevenue,revenue),fundingHarvest,baseAdministrationNeed:administrationNeed(s),baseMilitaryNeed:militaryNeed(s)*s.military,administrationCoverage:level('base:administration'),militaryCoverage:level('base:military'),centralExpenses:centralPay(s),salaryTotal:officialCatalog(s).reduce((n,o)=>n+o.monthlyPay,0),fiscalRates:rates,revenue,expenses,net:Math.round((revenue-expenses)*10000)/10000,grainUse,campaignExpenses:total(['battle','occupation'])+entries.filter(e=>e.id.startsWith('pay:governor:')||e.id.startsWith('pay:commander:')).reduce((n,e)=>n+e.money,0),militaryExpenses:total(['production','maintenance']),explorationExpenses:total(['voyage']),talentExpenses:total(['talent']),talentGrain:total(['talent'],'grain'),agencyExpenses:total(['agency'])+entries.filter(e=>e.id.startsWith('pay:office:')||e.id.startsWith('pay:agency:')).reduce((n,e)=>n+e.money,0),dutyExpenses:total(['project','affair']),portalDutyExpenses:total(['project','affair','policy'],'money','portal'),monthlyPolicyExpenses:total(['policy']),administration:admin.name,harvest:fundingHarvest+([6,9].includes(s.month)?Math.round(agency.harvestBonus):0)};
}
export function advance(state){
 const s=clone(state);ready(s);primeEventMemory(s);if(s.event)holdPetition(s);
 const before=Object.fromEntries(Object.keys(META).map(k=>[k,s[k]])),f=forecast(s),book=allocateMonth(f.entries,s.money+f.fundingRevenue,s.grain+f.fundingHarvest);s.notices=[];s.money=Math.round((book.money+f.revenue-f.fundingRevenue)*10000)/10000;s.grain=Math.round((book.grain+f.harvest-f.fundingHarvest)*10000)/10000;
 const external=[];let externalMoney=0,externalGrain=0;
 for(const row of book.entries.filter(e=>e.funding==='portal'&&!e.paused)){try{const probe=clone(s);coverExpense(probe,{money:externalMoney+row.money,grain:externalGrain+row.grain},'portal','月度供给核验');external.push(row);externalMoney+=row.money;externalGrain+=row.grain;}catch{s.notices.push(row.name+'的外部供给未落实，本月暂停，未转向国库扣款。');}}
 if(external.length){coverExpense(s,{money:externalMoney,grain:externalGrain},'portal','本月外部供给月拨');pay(s,{money:externalMoney,grain:externalGrain});for(const row of external){row.paid=true;row.actualMoney=row.money;row.actualGrain=row.grain;}}

 const paid=id=>isPaid(book,id),level=id=>fundingLevel(book,id),agenciesFunded=paid('base:administration')&&paid('base:military'),grainFunded=paid('base:grain'),portalPaid=book.entries.filter(r=>r.funding==='portal').every(r=>r.paid);
 s.ledger={...f,date:dateLabel(s),openingMoney:before.money,openingGrain:before.grain,plannedExpenses:f.expenses,expenses:book.expenses,plannedGrainUse:f.grainUse,grainUse:book.grainUse,net:Math.round((f.revenue-book.expenses)*10000)/10000,entries:book.entries};
 const unpaid=book.entries.filter(r=>!r.paid);if(unpaid.length)s.notices.push('本月欠拨或暂停：'+unpaid.map(r=>r.name).join('、')+'。未落实的工作不会按已拨款生效。');
 for(const item of settleCompensation(s,book)){const o=officialFor(s,item.id);s.notices.push(o.name+'实付薪俸低于常例，持续履约支持度 '+Math.round(item.support*100)+'%；恢复足额后逐月修复。');}
 if(!paid('base:military')){effects(s,{army:-8*(1-level('base:military'))});s.notices.push('基础军饷欠拨，军心受损。');}if(!paid('base:administration'))effects(s,{legitimacy:-6*(1-level('base:administration'))});
 if(!grainFunded){effects(s,{stability:-8});s.provinces.forEach(p=>regionEffects(p,{unrest:5}));s.notices.push('军民口粮不足，饥荒正在扩散。');}
 const border=borderForecast(s,id=>leaderEfficiency(s,id,'military'),paid);s.ledger.border=border;

 const droughtMonth=[3,4,5,6,7].includes(s.month);
 for(const p of s.provinces){
  regionEffects(p,{drought:(droughtMonth?1.8:-1.5)+(rng(s)-0.5)*5-domainLevel(s,'agriculture')*.5});
  const taxAnger=(s.tax-1)*9;
  regionEffects(p,{unrest:taxAnger+(p.drought>65?2:0)+(s.stability<35?1.5:-0.5)+(rng(s)-0.5)*2,prosperity:p.drought>75?-1.5:0.4});
  if(p.unrest>=90){regionEffects(p,{prosperity:-3});effects(s,{stability:-1.4,legitimacy:-1});}
 }
 const avg=s.provinces.reduce((a,p)=>a+p.unrest,0)/s.provinces.length;
 effects(s,{stability:(s.tax<1?1.5:0)-(avg>60?2:0)-(s.tax>1.2?1:0),frontier:border.net,army:(s.military-1)*8*level('base:military')-0.5,corruption:0.45});
 if(s.factions.gentry<25){effects(s,{legitimacy:-2,corruption:1});s.notices.push('士绅抵制加剧，征解与行政受到掣肘。');}
 if(s.factions.army<25)effects(s,{army:-2});
 effects(s,{corruption:-domainLevel(s,'governance')*.5*level('base:administration'),army:domainLevel(s,'military')*.5*level('base:military'),navy:domainLevel(s,'naval')*.5*level('base:administration'),tech:(domainLevel(s,'education')*.5+domainLevel(s,'industry')*.3)*level('base:administration'),stability:domainLevel(s,'medicine')*.3*level('base:administration')});
 if(s.frontier>80){effects(s,{army:-2,legitimacy:-2});s.notices.push('边警频仍，军心与皇权承压；可另议防御预算，本月未自动追加扣银。');}
 for(const report of settleTalents(s,paid,grainFunded,()=>rng(s))){s.notices.push(report.title+'：'+report.text);log(s,report.title,report.text,'personnel');}
 s.notices.push(...settleInstitutions(s,paid,level));
 for(const report of [...settleHorizons(s,paid,grainFunded),...settleMilitary(s,paid),...settleCampaign(s,paid,grainFunded,id=>leaderEfficiency(s,id,'military'))]){s.notices.push(report);log(s,'军备、探航与战场月报',report,'world');}
 for(const id of s.officials){const o=officialFor(s,id);if(!o||!paid('pay:central:'+id))continue;const efficiency=talentEfficiency(s,id)*workloadFactor(s,id)*compensationSupport(s,id);effects(s,Object.fromEntries(Object.entries(o.bonus).map(([k,v])=>[k,v*efficiency])));if(o.bonus.unrest){const p=[...s.provinces].sort((a,b)=>b.unrest-a.unrest)[0];regionEffects(p,{unrest:o.bonus.unrest*efficiency});}}
 for(const p of s.monthlyPolicies||[])applyMonthly(s,p,paid('policy:'+p.id));
 const speed=s.officials.includes('song')&&paid('pay:central:song')?talentEfficiency(s,'song')*workloadFactor(s,'song')*compensationSupport(s,'song'):0;const done=[];
 for(const p of s.projects){const projectPaid=paid('project:'+p.id);if(!projectPaid){if(p.monthly){s.notices.push(p.name+'本月约定月拨未落实，施工与督办暂停。');continue;}s.notices.push(p.name+'督办差旅欠拨；已支付的工程款继续基础施工，不计督办加速。');}const progressScale=monthlyScale(p.monthly);applyMonthly(s,p,projectPaid);p.remaining-=advanceWork(p,progressScale*(1+speed+(p.leader&&projectPaid?.5*leaderEfficiency(s,p.leader,p.domain):0)));if(p.remaining<=0){const institutionalBefore=institutionSnapshot(s);effects(s,p.effects);const r=s.provinces.find(r=>r.id===p.target);if(r)regionEffects(r,p.regional);if(p.reform)s.reformed=true;if(p.economic)activateEconomic(s,p.economic,p.name);gainKnowledge(s,p.domain,p.name,p.knowledgeGain??12);if(p.factions)factions(s,p.factions);if(p.burden)s.government.burden=clamp(s.government.burden+p.burden);if(p.ongoingMonthlyNeed&&p.monthly){p.monthly.required=clone(p.ongoingMonthlyNeed);if(!p.monthly.required.money&&!p.monthly.required.grain&&!Object.keys(p.monthly.effects).length)p.monthly.retain=false;}retainMonthly(s,p);done.push(p);log(s,'竣工 · '+p.name,(r?r.name+'：':'')+'试点完成，长期成效已计入国势。'+(p.leader?'督办：'+officialFor(s,p.leader).name+'。':'')+(p.domain?'制度与技术积累已录入新政格物。':''),'project');if(p.institution)recordInstitution(s,p.institution,institutionName(s,p.institution),{kind:'completion',status:'completed',title:'竣工 · '+p.name,text:'工程已验收，实际国势、地方与方向积累变化已落实。',leader:p.leader,...institutionDelta(institutionalBefore,s)});}}
 s.projects=s.projects.filter(p=>p.remaining>0);
 for(const report of settleAffairs(s,paid,portalPaid)){if(report.economic)activateEconomic(s,report.economic,report.title.replace(/^销案 · /,''));const text=(report.leader?'督办：'+officialFor(s,report.leader)?.name+'。':'')+report.text;s.notices.push(report.title+'：'+text);log(s,report.title,text,'personnel');if(report.institution)recordInstitution(s,report.institution,institutionName(s,report.institution),{kind:'completion',status:'completed',title:report.title,text,leader:report.leader,effects:report.effects,knowledge:report.knowledge,regional:report.regional});}
 for(const o of officialCatalog(s).filter(o=>o.workload>2))s.notices.push(o.name+'兼任 '+o.workload+' 项差遣，精力系数 '+Math.round(o.workloadFactor*100)+'%，宜分派人手。');
 for(const report of settleService(s,agenciesFunded,grainFunded)){s.notices.push(report.title+'：'+report.text);log(s,report.title,report.text,'personnel');recordInstitution(s,report.institution,institutionName(s,report.institution),{kind:report.title.startsWith('差遣考成')?'completion':'order',status:report.title.startsWith('差遣考成')?'completed':'executed',title:report.title,text:report.text});}
 for(const source of f.economicSources.filter(r=>r.revenue>0)){const note=source.port+'税关本月解部 '+source.revenue+' 万两，已含在税入 '+f.revenue+' 万两中。';s.notices.push(note);log(s,'海关月解 · '+source.port,note,'economy');recordInstitution(s,'office:revenue','户部',{kind:'month',status:'active',title:'海关月解 · '+source.port,text:note,effects:{money:source.revenue}});}
 s.ledger.adjustments={money:(Math.round((s.money-before.money-s.ledger.net)*10000)/10000||0),grain:(Math.round((s.grain-before.grain-f.harvest+book.grainUse)*10000)/10000||0)};s.ledger.endingMoney=s.money;s.ledger.endingGrain=s.grain;s.ledger.frontierActual=Math.round((s.frontier-before.frontier)*1000)/1000;
 const annual=settleYear(s,s.ledger,officialCatalog(s));
 s.month++;if(s.month>12){s.month=1;s.year++;beginYear(s);}s.turn++;s.actionsLeft=null;
 if(annual)s.notices.push(annual.year+'年年度总结已归档于起居注。');
 const due=duePlans(s);if(due.length)s.notices.push('规划到期待复议：'+due.map(p=>p.title).join('、')+'。可在规划备忘中请 AI 评估实施条件。');
 s.monthlyResults=Object.keys(META).map(k=>({key:k,value:Math.round((s[k]-before[k])*10)/10||0}));
 if(s.stability<=5||s.legitimacy<=5||(s.frontier>=99&&s.army<=15)){s.ended={title:'山河失守',text:'民心、皇权或防线已不可维系。你的诏令仍留在起居注中，可以另开一局寻找转机。'};log(s,'山河失守',s.ended.text,'system');}
 else {s.eventSerial++;s.event=nextEvent(s,true);if(s.event){s.event.leader??=null;markEvent(s,s.event);}}
 log(s,'月度结算','税入 '+f.revenue+'，实际支出 '+book.expenses+'，粮耗 '+book.grainUse+(f.harvest?'，入仓 '+f.harvest:'')+'。'+(done.length?'本月 '+done.length+' 项工程完成。':''),'month');
 return finish(s);
}
export function localEdict(s,text){return attachMonthly(baseLocalEdict(s,text),text);}
function attachMonthly(plan,input){
 if(plan.interventions?.length||plan.institutionChanges?.length||plan.recruitment)return plan;const monthly=normalizeMonthly(plan.monthly,input);if(!monthly)return plan;const cost={...plan.cost},routine=/派人|整兵|核饷|练兵|督训|查账|核查|案牍/.test(input)&&!/启动|首笔|一次性|先拨|置办/.test(input);
 if(routine&&monthly.money!==undefined){cost.money=0;cost.grain=0;const project=plan.project||{months:2,effects:{},regional:{}};plan={...plan,project:{...project,effects:Object.fromEntries([...new Set([...Object.keys(project.effects||{}),...Object.keys(plan.effects||{})])].map(k=>[k,(project.effects?.[k]||0)+(plan.effects?.[k]||0)])),regional:Object.fromEntries([...new Set([...Object.keys(project.regional||{}),...Object.keys(plan.regional||{})])].map(k=>[k,(project.regional?.[k]||0)+(plan.regional?.[k]||0)]))},effects:{},regional:{}};}
 else if(cost.money===monthly.money&&!/启动|首笔|一次性|先拨|设关|置办/.test(input))cost.money=0;return {...plan,cost,monthly};
}

function baseLocalEdict(s,text){

 const interventions=inferWorldCommands(s,text);if(interventions.length)return {title:'直接干预 · '+(interventions.some(c=>c.type==='arsenal')?'军备整备':'时空与探航'),narrative:'以下事项将直接写入能力、装备、部队或航行记录，不以虚构研究项目代替。',feasibility:'逐项核验现有模式、时空能量、钱粮与库存；任一项不满足则整批不执行。',minister:s.traveler?.enabled?'臣等将依实际出现的装备、通道及船队行止回报，不敢将异象说成纸面成法。':'普通探航可直接办理；时空能力须玩家明确启用穿越者模式。',cost:{},effects:{},regional:{},target:null,project:null,domain:'military',factions:{},source:'local',input:text,interventions};
 const changes=inferInstitutionChanges(s,text),recruitment=inferRecruitment(s,text);
 const special=specialPlan(s,changes,recruitment,text);if(special)return special;
 const economic=economicPlan({},s,text);if(economic)return {title:economic.port+(economic.operation==='close'?'税关停办':'开海抽分'),narrative:'依旨办理'+economic.port+'通商与税关章程，案卷核验后按实际商路、税率、地方秩序与征收损耗逐月报解。',feasibility:'持续税源由实际税关记录计算，办理期尚不产生新税入。',minister:'请列关账，以月解实数考成。',cost:{money:economic.operation==='close'?0:8,grain:0},effects:{},regional:{},factions:{},target:economic.target,project:{months:3,effects:{}},domain:'finance',economic,source:'local',input:text};
 const matches=[[/赈|救灾|饥|粮仓|施粥/,'relief'],[/水利|灌溉|水渠|修堤/,'irrigation'],[/贪|亏空|查账|反腐/,'audit'],[/赋役|清丈|土地改革/,'reform'],[/商税|关税|贸易|开海/,'commerce'],[/练兵|整兵|核饷|军饷|军纪/,'train'],[/火器|大炮|枪炮/,'arsenal'],[/科学|格物|教育|译|书院|技术/,'academy'],[/远洋|造船|水师|舰队/,'fleet'],[/招抚|流民|屯田/,'recruit']];
 const match=matches.find(([re])=>re.test(text));if(!match&&!/银行|票号|蒸汽|现代|穿越|电力|机床|公共卫生|宪|学校|预算|专利/.test(text))return {title:'行政交办 · '+text.slice(0,28),narrative:'原话录为交办，不擅自改为科研项目。实际资源及成效尚待议定。',feasibility:'本次只登记行政交办，不预设收益或收费。需工程、物资或新增月拨时再明确预算。',minister:'请按具体目标核验条件。',cost:{money:0,grain:0},effects:{},regional:{},factions:{},target:null,project:null,domain:'governance',source:'local',input:text};const a=ACTIONS.find(a=>a.id===(match?.[1]||'academy'));
 const p=s.provinces.find(p=>text.includes(p.name))||[...s.provinces].sort((a,b)=>b.unrest-a.unrest)[0];
 const locked=a.requires&&!s.unlocks[a.requires];
 const modern=/银行|票号|蒸汽|现代|穿越|电力|机床|公共卫生|宪|学校|预算|专利/.test(text);
 if(modern)return {title:'试办 · '+text.slice(0,26),narrative:'将设想拆成工匠、材料、组织和验证四部分，从一处试点开始。此处是基础与原型研究，尚未完成现代工业体系。离线模式可记录并积累这一方向；更细致的方案需 AI 理解。',feasibility:'陛下所言尚无成法可循，臣等只得先从原理、图样与工匠试验入手。待成果能被复验，方可议推广。',minister:'臣请留下试验文档、培养人员，成败皆积累经验，勿求一朝尽成。',cost:{money:45,grain:5},effects:{},regional:{},target:p.id,project:{months:4,effects:{tech:7}},domain:inferDomain(text),source:'local',input:text};
 return {title:'试行诏令 · '+a.name,narrative:locked?'眼下尚无远洋行政与补给能力，先筹建译馆与人才储备。':administration(s).deliberation+'将诏令拆为可执行试点。先验证钱粮、人员与地方配合，再决定推广。离线模式按关键词归类，自由理解需启用 AI。',
 feasibility:match?'可由现有机构试办，成效受资源与地方阻力约束。':'离线模式无法完整理解此构想，暂按研究试点处理；请确认方案是否符合本意。',
 minister:'臣以为，先定试点与验收之期，切勿以一句圣旨代替工匠、银两和运输。',
 cost:clone(locked?{money:36}:a.cost),effects:clone(locked?{}:a.effects||{}),regional:clone(locked?{}:a.regional||{}),
 target:a.target?p.id:null,project:clone(locked?{months:3,effects:{tech:12}}:a.project||null),domain:inferDomain(text),factions:clone(locked?{}:a.factions||{}),source:'local',input:text};
}
export function normalizeEdict(raw,s,input){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('AI 没有返回可执行的 JSON 方案。');
 const funding=fundingSource(s,raw,input),funded=funding==='portal'?{funding}:{};
 const direct=inferWorldCommands(s,input);if(direct.length||Array.isArray(raw.interventions)&&raw.interventions.length){const p=localEdict(s,input);return {...p,title:String(raw.title||p.title).slice(0,60),narrative:String(raw.narrative||p.narrative).slice(0,1800),cost:{},effects:{},regional:{},factions:{},project:null,interventions:direct.length?direct:raw.interventions.slice(0,6)};}
 const inferred=inferInstitutionChanges(s,input);
 const changes=Array.isArray(raw.institutionChanges)?[...raw.institutionChanges]:[];
 for(const c of inferred)if(!changes.some(r=>r.operation===c.operation&&(c.name?r.name===c.name:true)&&(c.target?r.target===c.target:true)))changes.push(c);
 const recruitment=raw.recruitment||inferRecruitment(s,input);
 const special=specialPlan(s,changes,recruitment,input,'ai',raw);if(special)return {...special,...funded};
 const clean=(v,n)=>String(v||'').slice(0,n);
 if(!raw.title||!raw.narrative)throw Error('AI 方案缺少标题或推演。');
 const specified=Number.isFinite(raw.cost?.money)&&raw.cost.money>=0;if(raw.project&&!specified)throw Error('工程方案未列明实际钱粮预算，请补充预算后再议，尚未扣费。');const cost={money:specified?clamp(raw.cost.money,0,110):0,grain:clamp(raw.cost?.grain,0,45)};
 const allowed={stability:6,army:8,legitimacy:4,corruption:7,tech:4,navy:4,frontier:6};
 const safeEffects=(e,bounds)=>Object.fromEntries(Object.entries(e||{}).filter(([k,v])=>k in bounds&&Number.isFinite(v)).map(([k,v])=>[k,clamp(v,-bounds[k],bounds[k])]));
 const eff=safeEffects(raw.effects,allowed);const regional=safeEffects(raw.regional,{unrest:12,drought:10,prosperity:8});
 const target=s.provinces.some(p=>p.id===raw.target)?raw.target:null;
 let project=null;
 if(raw.project&&typeof raw.project==='object'){project={months:Math.round(clamp(raw.project.months,2,12)),effects:safeEffects(raw.project.effects,{stability:6,army:12,legitimacy:4,corruption:9,tech:12,navy:14,frontier:6}),regional:safeEffects(raw.project.regional,{unrest:15,drought:25,prosperity:12})};}
 const improvement=Object.entries(eff).reduce((n,[k,v])=>n+(['corruption','frontier'].includes(k)?Math.max(0,-v):Math.max(0,v)),0);
 if(improvement>14)for(const k in eff)eff[k]=Math.round(eff[k]*14/improvement*10)/10;
 if(!s.unlocks.diplomacy){delete eff.navy;if(project?.effects)delete project.effects.navy;}
 const fac=safeEffects(raw.factions,{gentry:8,scholar:8,army:8,merchant:8});
 const monthly=normalizeMonthly(raw.monthly,input);const domain=canonicalDomain(raw.domain,inferDomain(input));const economic=economicPlan(raw,s,input);
 return {title:clean(raw.title,60),narrative:clean(raw.narrative,1800),feasibility:clean(raw.feasibility,600),minister:clean(raw.minister,600),cost,effects:eff,regional,target,project,domain,factions:fac,source:'ai',input:clean(input,2000),...(economic?{economic}:{}),...(monthly?{monthly}:{}),...funded};
}
export function specialPlan(s,changes=[],recruitment=null,input='',source='local',flavor={}){
 const government=changes.length?institutionPlan(s,changes,input,source,flavor):null;
 const people=recruitment?recruitmentPlan(s,recruitment,input,source,flavor):null;
 if(!government)return people;if(!people)return government;
 return {...government,title:'招安与设署 · 联合诏令',narrative:government.narrative+'\n'+people.narrative,feasibility:government.feasibility+'\n'+people.feasibility,cost:{money:government.cost.money+people.cost.money,grain:people.cost.grain},recruitment:people.recruitment,recruitmentPreview:people.recruitmentPreview};
}
export function applyEdict(state,plan,official=undefined){
 const s=clone(state);if(!plan||typeof plan!=='object')throw Error('诏令方案不存在');
 if(plan.interventions?.length){if(plan.interventions.length>6)throw Error('一次最多交办六项干预。');let next=s;for(const c of plan.interventions){if(!['horizon','arsenal','war'].includes(c.type))throw Error('不支持的干预类型。');next=intervene(next,c);}return next;}
 const leader=checkLeader(s,official===undefined?inferDutyLeader(s,plan.input):official);
 if(!plan.petitionApproved)plan=attachMonthly(plan,plan.input||'');
 const economic=plan.economic?validateEconomicPlan(plan.economic,s):plan.petitionApproved?null:economicPlan(plan,s,plan.input);if(economic)plan={...plan,domain:'finance',economic:{...economic,edictTurn:s.turn}};
 if(plan.institutionChanges?.length||plan.recruitment){const funding=plan.funding,approved=plan.petitionApproved?{cost:clone(plan.cost),expensesIncluded:true,petitionBudget:clone(plan.petitionBudget)}:{};plan={...specialPlan(s,plan.institutionChanges||[],plan.recruitment||null,plan.input,plan.source,{minister:plan.minister}),...(funding?{funding}:{}),...approved};}
 if(plan.project&&s.projects.length>=256)throw Error('工程记录过多，请先整理。');
 coverExpense(s,plan.cost,plan.funding||'treasury',plan.title);afford(s,plan.cost);useAction(s);pay(s,plan.cost);effects(s,plan.effects);factions(s,plan.factions);
 const p=s.provinces.find(p=>p.id===plan.target);if(p)regionEffects(p,plan.regional);
 if(plan.institutionChanges?.length)enactInstitutionChanges(s,plan.institutionChanges);
 if(plan.recruitment)enactRecruitment(s,plan.recruitment);
 if(plan.project)s.projects.push({id:'edict-'+s.revision+'-'+s.turn,action:'edict',name:plan.title,target:plan.target,total:plan.project.months,remaining:plan.project.months,domain:plan.domain,leader,workCredit:0,...clone(plan.project),...(plan.economic?{economic:clone(plan.economic)}:{}),...(plan.monthly?{monthly:clone(plan.monthly)}:{}),...(plan.funding==='portal'?{funding:plan.funding}:{}),...(plan.expensesIncluded?{expensesIncluded:true}:{}),...(plan.petitionBudget?{petitionBudget:clone(plan.petitionBudget)}:{})});
 else {addAffair(s,{name:plan.title,domain:plan.domain||'governance',target:plan.target||null,leader,order:plan.input,funding:plan.funding});if(plan.economic)s.affairs.at(-1).economic=clone(plan.economic);if(plan.monthly)s.affairs.at(-1).monthly=clone(plan.monthly);if(plan.expensesIncluded)s.affairs.at(-1).expensesIncluded=true;if(plan.petitionBudget)s.affairs.at(-1).petitionBudget=clone(plan.petitionBudget);if(plan.scopeScale!==undefined)s.affairs.at(-1).scopeScale=plan.scopeScale;}
 s.edicts.unshift({input:plan.input,title:plan.title,turn:s.turn});s.edicts=s.edicts.slice(0,30);
 log(s,plan.title,plan.narrative+' '+plan.feasibility+(leader?' 实际督办：'+officialFor(s,leader).name+'。':''),'edict');return finish(s);
}
export function petitionContext(state,raw){
 const d=cleanPetitionDraft(raw),held=d.petition?state.affairs.find(a=>a.id===d.petition&&a.petition):null,event=d.petition?held?.petition:state.event;
 if(!event)throw Error('这份奏报已经批复或案卷已变化，请刷新后重议。');
 if(d.gameId&&d.gameId!==state.id||d.eventId&&d.eventId!==event.id||d.eventTurn!==null&&d.eventTurn!==state.turn)throw Error('自拟批复对应的局势已改变，本次没有办理。');
 if(d.reference!==null&&!event.options[d.reference])throw Error('参考方案已经变化。');
 const official=checkLeader(state,d.official);return {draft:{...d,official,eventId:event.id,eventTurn:state.turn,gameId:state.id},event:clone(event)};
}
export function preparePetition(state,raw,rawPlan=null){
 const {draft:d,event:e}=petitionContext(state,raw),b=d.budget,reference=d.reference===null?null:e.options[d.reference],sum=(...maps)=>{const out={};for(const m of maps)for(const[k,v]of Object.entries(m||{}))out[k]=(out[k]||0)+v;return out;},cash=v=>Math.round(v*10000)/10000;
 let source;
 if(reference)source={title:e.title.slice(0,60),narrative:'依自拟批复调整原案：'+d.text,feasibility:'原案只是参考，费用与落实范围按本次预算核算。',minister:'按陛下批示办理，未批费用不擅动。',cost:clone(reference.cost||{}),effects:clone(reference.effects||{}),regional:clone(reference.regional||{}),factions:clone(reference.factions||{}),domain:affairDomain(e),target:reference.region||reference.target||null,project:null,input:d.text,source:'reference'};
 else source=rawPlan?normalizeEdict({...rawPlan,funding:d.funding},state,d.text):localEdict(state,d.text);
 if(source.interventions?.length)throw Error('这项军备、征战或时空操作请在议事中单独交办，再就奏报批复；本次未扣费。');
 if(!reference&&rawPlan?.monthly){const {required,...estimate}=rawPlan.monthly;source.monthly=normalizeMonthly(estimate,'');}
 const plan=clone(source),workMonths=Math.max(d.workMonths||2,plan.project?.months||2),recurring=source.monthly?monthlyRequirement(source.monthly):{money:0,grain:0},oneTime={money:source.cost?.money||0,grain:source.cost?.grain||0},structural=!!(source.institutionChanges?.length||source.recruitment),need={...oneTime};
 if(!b.monthly&&!structural){need.money+=recurring.money*workMonths;need.grain+=recurring.grain*workMonths;}
 const actual={money:cash(Math.min(b.money,need.money)),grain:cash(Math.min(b.grain,need.grain))},coverage=Math.max(0,Math.min(1,need.money>0?actual.money/need.money:1,need.grain>0?actual.grain/need.grain:1));
 const warnings=[];delete plan.monthly;plan.title=('自拟御批 · '+e.title).slice(0,60);plan.input=d.text.slice(0,1300)+'\n'+petitionBudgetLabel(b);plan.cost=actual;plan.funding=d.funding;plan.petitionApproved=true;plan.expensesIncluded=true;plan.petitionBudget=clone(b);plan.scopeScale=coverage;
 if(structural){
  // Administrative reorganization may use existing premises and staff. Ongoing commitments still need approval.
  for(const c of plan.institutionChanges||[])if(c.name&&!d.text.includes(c.name))throw Error('方案附带了原话没有批准的新机构，请先重拟，尚未执行。');
  if(plan.recruitment&&coverage<1)warnings.push('当前首拨不足以兑现招安条款，请改条款或另议预算。');
  if(b.monthly&&b.months!==null)warnings.push('机构或部众的经常开支不能只由有限期月拨默认为永久授权，请改为明确章程或另拟临时差遣。');
 }else if(b.monthly){
  const needPerMonth={money:cash(recurring.money+Math.max(0,oneTime.money-actual.money)/workMonths),grain:cash(recurring.grain+Math.max(0,oneTime.grain-actual.grain)/workMonths)};
  plan.effects={};plan.regional={};plan.factions=Object.fromEntries(Object.entries(source.factions||{}).filter(([,v])=>v<0));
  plan.project={months:workMonths,...(source.project?.reform?{reform:true}:{}),effects:sum(source.effects,source.project?.effects),regional:sum(source.regional,source.project?.regional),factions:Object.fromEntries(Object.entries(source.factions||{}).filter(([,v])=>v>0)),knowledgeGain:reference?(reference.knowledge||0):source.project?12:0,...(reference?.burden?{burden:reference.burden}:{})};
  const m=normalizeMonthly({money:b.monthly.money,grain:b.monthly.grain,effects:source.monthly?.effects||{},required:needPerMonth,retain:b.retain,...(b.months!==null?{remaining:b.months}:{})},'',{saved:true});const monthlyCoverage=monthlyScale(m);if(monthlyCoverage<1)warnings.push('每月完整需求为银'+needPerMonth.money+'万两、粮'+needPerMonth.grain+'万石；当前月拨覆盖约'+Math.round(monthlyCoverage*1000)/10+'%。'+(monthlyCoverage===0?'缺少必要供给，暂不支用月费，调整月拨后再开办。':'工期按实际供给延长。'));if(monthlyCoverage===0)m.paused=true;plan.monthly=m;plan.scopeScale=1;plan.project.scopeScale=1;plan.project.ongoingMonthlyNeed=recurring;
  if(!needPerMonth.money&&!needPerMonth.grain&&!Object.keys(m.effects).length){delete plan.monthly;if(!source.project){plan.project=null;plan.effects=source.effects||{};plan.regional=source.regional||{};plan.factions=source.factions||{};}}
 }else{
  plan.effects=scalePetitionEffects(source.effects,coverage,['corruption','frontier']);plan.regional=scalePetitionEffects(source.regional,coverage,['unrest','drought']);plan.factions=scalePetitionEffects(source.factions,coverage);
  if(source.project||source.monthly){const material=sum(source.project?.effects,Object.fromEntries(Object.entries(source.monthly?.effects||{}).map(([k,v])=>[k,v*workMonths])));plan.project=coverage>0?{months:source.project?.months||workMonths,...(source.project?.reform&&coverage===1?{reform:true}:{}),effects:scalePetitionEffects(material,coverage,['corruption','frontier']),regional:scalePetitionEffects(source.project?.regional,coverage,['unrest','drought']),scopeScale:coverage,knowledgeGain:reference?cash((reference.knowledge||0)*coverage):source.project?cash(12*coverage):0}:null;}
  if(coverage<1&&plan.economic){delete plan.economic;warnings.push('当前只落实较小范围，不会凭缩减预算自动开征完整税关。');}
  if(coverage===0&&(need.money||need.grain))warnings.push('未安排足够物资，实物部分尚未落实；不会因批复文字而产生完整成果，也不会自动追扣缺口。');
 }
 plan.feasibility=(source.feasibility||'')+' 本次费用按明确授权执行，督办善后包含在本案预算内，不另套差旅。';
 let blocked=warnings.filter(w=>/招安条款|永久授权/.test(w));
 if(d.funding==='treasury'&&(actual.money>state.money||actual.grain>state.grain))blocked.push('国库或官仓不足以支付本次首拨，尚未办理。');
 if(structural){
  const probe=clone(state);probe.money=Math.max(probe.money,actual.money);probe.grain=Math.max(probe.grain,actual.grain);
  try{const projected=applyEdict(probe,plan,d.official),old=new Map(forecast(state).entries.map(x=>[x.id,x])),newRows=forecast(projected).entries;let money=0,grain=0;for(const x of newRows){money+=Math.max(0,x.money-(old.get(x.id)?.money||0));grain+=Math.max(0,x.grain-(old.get(x.id)?.grain||0));}money=Math.max(money,source.recruitmentPreview?.upkeep||0);grain=Math.max(grain,source.recruitmentPreview?.grain||0);if(money>(b.monthly?.money||0)+1e-8||grain>(b.monthly?.grain||0)+1e-8)blocked.push('这份章程还会新增月费银'+cash(money)+'万两、粮'+cash(grain)+'万石，超出你批准的后续月拨，请先调整章程或明确授权。');}catch(err){blocked.push(err.message);}
 }
 const nextMonthly=plan.monthly?monthlyCost({monthly:plan.monthly}):{money:0,grain:0},summary=petitionBudgetLabel(b)+'。本次实际首拨：银'+actual.money+'万两、粮'+actual.grain+'万石。'+(plan.monthly?'本案月拨实际至多银'+nextMonthly.money+'万两、粮'+nextMonthly.grain+'万石；工作量按需求比例逐月落实。':structural?'行政建制按批示生效，具体职能仍按实际月拨与筹备核算；未批后续费用不自动扣取。':'当前资源覆盖参考规模约'+Math.round(coverage*1000)/10+'%；未批后续费用不自动扣取。')+(warnings.length?' '+warnings.join(' '):'');
 return {draft:d,event:e,source,plan,need,actual,coverage,summary,warnings,blocked,canExecute:blocked.length===0};
}
export function applyPetition(state,quote){
 const checked=petitionContext(state,quote.draft);if(!quote.canExecute)throw Error(quote.blocked.join(' '));
 let next=applyEdict(state,quote.plan,quote.draft.official);if(quote.draft.reference!==null&&!quote.plan.project){const option=checked.event.options[quote.draft.reference];if(option.knowledge)next.technology[affairDomain(checked.event)]=clamp(next.technology[affairDomain(checked.event)]+option.knowledge*quote.coverage);if(option.burden)next.government.burden=clamp(next.government.burden+(option.burden<0?option.burden*quote.coverage:option.burden));}
 if(quote.draft.petition)next.affairs=next.affairs.filter(a=>a.id!==quote.draft.petition);else next.event=null;
 markEvent(next,checked.event);next.resolvedEvents.push(checked.event.id);log(next,'自拟批复 · '+checked.event.title,quote.draft.text+' '+quote.summary,'event');return next;
}
export function reviewPetitions(state){
 const s=clone(state),notes=[],hadMemory=!!s.eventMemory;
 if(s.event?.id==='pay'&&s.resolvedEvents.includes('pay')&&!eventCondition(s,'pay').eligible){s.event=null;notes.push('最近军费和基础官粮已足额结算，撤下没有新欠拨依据的重复“辽饷告急”；未代选方案或扣费。');}
 const kept=[];for(const event of s.service.story.queue){if(repeatedDevelopment(s,event)||kept.some(e=>e.title===event.title&&e.text===event.text)){notes.push('合并重复的发展续报：'+event.title+'。原章节及已办理记录保留。');}else kept.push(event);}s.service.story.queue=kept;
 primeEventMemory(s);if(notes.length){const text=notes.join(' ');s.notices.push(text);log(s,'奏报去重核验',text,'system');}if(notes.length||!hadMemory)s.revision++;
 return s;
}
export function validateSave(raw) {
 if(!raw||raw.version!==VERSION||!['balanced','sandbox'].includes(raw.mode))throw Error('存档版本或格式不兼容。');
 if(raw.stateSchema!==undefined&&raw.stateSchema!==1)throw Error('此存档使用较新的状态格式，请使用对应版本的游戏。');
 const s=createGame({mode:raw.mode,seed:raw.seed});
 validateService(raw,s);validateTalents(raw,s);validateFiscal(raw,s);validateCampaign(raw,s);
 validateInstitutions(raw,s);if(!raw.service)installIncumbents(s,raw);validateEconomy(raw,s);
 for(const d of TECH_DOMAINS)s.technology[d.id]=clamp(raw.technology?.[d.id]||0);
 s.institutions=(Array.isArray(raw.institutions)?raw.institutions:[]).slice(0,120).filter(x=>TECH_DOMAINS.some(d=>d.id===x.domain)).map(x=>({id:String(x.id||'').slice(0,90),name:String(x.name||'').slice(0,70),domain:x.domain,date:String(x.date||'').slice(0,40),turn:Math.max(0,Number(x.turn)||0)}));
 for(const k of Object.keys(META))if(!Number.isFinite(raw[k])||raw[k]<0||(!['money','grain'].includes(k)&&raw[k]>100))throw Error('存档国势数据无效。');
 if(!Number.isInteger(raw.year)||raw.year<1628||raw.year>3000||!Number.isInteger(raw.month)||raw.month<1||raw.month>12||!Number.isInteger(raw.turn)||raw.turn<0||(raw.actionsLeft!==null&&raw.actionsLeft!==undefined&&(!Number.isInteger(raw.actionsLeft)||raw.actionsLeft<0||raw.actionsLeft>3)))throw Error('存档日期或回合无效。');
 if(!Array.isArray(raw.provinces)||raw.provinces.length!==s.provinces.length||new Set(raw.provinces.map(p=>p.id)).size!==s.provinces.length)throw Error('存档地区无效。');
 for(const p of s.provinces){const r=raw.provinces.find(r=>r.id===p.id);if(!r)throw Error('地区缺失');for(const k of ['unrest','drought','prosperity']){if(!Number.isFinite(r[k])||r[k]<0||r[k]>100)throw Error('地区数值无效');p[k]=r[k];}p.governor=checkLeader(s,r.governor||null);}
 for(const k of [...Object.keys(META),'year','month','turn','seed'])s[k]=raw[k];
 if(![0.8,1,1.2,1.4].includes(raw.tax)||![0.8,1,1.25].includes(raw.military))throw Error('存档国策无效。');
 s.tax=raw.tax;s.military=raw.military;s.influence=clamp(raw.influence,0,10000);s.reformed=raw.reformed===true;
 if(!Array.isArray(raw.officials)||raw.officials.length>256||new Set(raw.officials).size!==raw.officials.length||raw.officials.some(id=>!canServe(s,id)))throw Error('存档人物无效');
 s.officials=raw.officials;
 for(const k of Object.keys(s.factions))s.factions[k]=clamp(raw.factions?.[k]??50);
 if(!Array.isArray(raw.projects)||raw.projects.length>256)throw Error('存档工程无效');
 const projectIds=new Set();s.projects=raw.projects.map((p,i)=>{
  const id=p.id===undefined?'import-'+i:p.id;if(typeof id!=='string'||!/^[\w-]{1,90}$/.test(id)||projectIds.has(id))throw Error('存档工程编号无效或重复。');projectIds.add(id);
  const a=ACTIONS.find(a=>a.id===p.action);
  if(!Number.isInteger(p.remaining)||p.remaining<1||p.remaining>12||!Number.isInteger(p.total)||p.total<1||p.total>12)throw Error('工程进度无效');
  const target=s.provinces.some(r=>r.id===p.target)?p.target:null;
  if(a?.project)return {id,action:a.id,name:String(p.name||a.name).slice(0,60),target,total:p.total,remaining:p.remaining,domain:({audit:'governance',academy:'education',arsenal:'military',fleet:'naval',irrigation:'agriculture',reform:'governance'}[a.id]),...storedProject(p,a.project)};
  if(p.action!=='edict')throw Error('工程种类无效');
  return {id,action:'edict',name:String(p.name||'试行诏令').slice(0,60),target,total:p.total,remaining:p.remaining,domain:TECH_DOMAINS.some(d=>d.id===p.domain)?p.domain:'education',...storedProject(p)};
 });
 s.countries.forEach(c=>{const r=raw.countries?.find(r=>r.id===c.id);if(r)c.relation=clamp(r.relation,-100,100);});
 s.unlocks={diplomacy:s.mode==='sandbox'||raw.unlocks?.diplomacy===true,global:s.mode==='sandbox'||raw.unlocks?.global===true};
 s.eventSerial=Math.max(0,Math.floor(Number(raw.eventSerial)||0));
 s.event=raw.event?(raw.event.options?storedEvent(raw.event):nextEvent(s,false,raw.event.id)):null;
 validateDuties(raw,s);
 validateDiscussions(raw,s);
 validateHorizons(raw,s);validateMilitary(raw,s);
 for(const u of s.militaryState.units){const r=raw.militaryState?.units.find(x=>x.id===u.id);u.commander=checkLeader(s,r?.commander||null);}if(s.campaignState.battles.some(b=>b.status==='active'&&!s.militaryState.units.some(u=>u.id===b.unit)))throw Error('存档战役部队无效。');
 s.history=(Array.isArray(raw.history)?raw.history:[]).slice(0,180).map(x=>({turn:Number(x.turn)||0,date:String(x.date||'').slice(0,40),title:String(x.title||'').slice(0,100),text:String(x.text||'').slice(0,2600),type:String(x.type||'').slice(0,30)}));
 s.edicts=(Array.isArray(raw.edicts)?raw.edicts:[]).slice(0,30).map(x=>({input:String(x.input||'').slice(0,2000),title:String(x.title||'').slice(0,60),turn:Number(x.turn)||0}));
 s.achievements=(Array.isArray(raw.achievements)?raw.achievements:[]).filter(x=>typeof x==='string').slice(0,20);
 storedPresentation(raw,s,META);
 if(raw.revision!==undefined&&(!Number.isSafeInteger(raw.revision)||raw.revision<0||raw.revision>=Number.MAX_SAFE_INTEGER))throw Error('存档修订编号无效。');
 s.id=String(raw.id||s.id).slice(0,100);s.revision=raw.revision??0;validateRecords(raw,s);validateInstitutionReports(raw,s);validateMonthLedger(raw,s);validateBill(raw,s);validateEventMemory(raw,s);s.monthlyAuditVersion=raw.monthlyAuditVersion===1?1:0;validateMonthlyPolicies(raw,s);for(const u of s.militaryState.units){if(raw.militaryState?.units.find(v=>v.id===u.id)?.commanderIncludedInBase===true)u.commanderIncludedInBase=true;}return s;
}

function holdPetition(s){const e=s.event;if(!e)return;addAffair(s,{name:'留中 · '+e.title,domain:affairDomain(e),order:'尚未批复，待议期间不扣差旅、不自动完成，也不强迫选择预设方案。'});s.affairs.at(-1).petition=clone(e);s.event=null;log(s,'留中待议 · '+e.title,'奏报转入差遣案卷，继续月份不代表已执行其中任何选项。','system');}
