import {campaignPanel,territoryDetail,warForm} from './campaigns.js';
import {armory,voyagePanel,loadLand,frontierForm,frontierCommand} from './frontiers.js';
import {mountainMap,mapBounds,moveMap,mapLayers} from './unified-map.js';
let worldLand;
const $ = s => document.querySelector(s);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Math.round(n).toLocaleString('zh-CN');
const signed = n => (n>0?'+':'')+(Math.round(n*10)/10);
const icons={court:'▦',counsel:'☷',affairs:'▤',institutions:'▥',officials:'♙',duties:'⚑',planning:'▧',treasury:'◈',innovation:'◇',chronicle:'◷',world:'◎',armory:'⚒'};
const names={court:'山河总览',counsel:'御前议事',affairs:'六部政务',institutions:'机构政务',officials:'朝堂用人',duties:'差遣督办',planning:'规划备忘',treasury:'钱粮国策',innovation:'新政格物',chronicle:'起居注',world:'四海经略',armory:'军械整备'};
let S,C,F,T,A,cat,view='court',selected='shaanxi',mapMode='unrest',draft='',busy=false;
const primaryNav=['court','counsel','institutions','armory','treasury','planning','chronicle'];
let institutionTab='offices',landingTab='brief',militaryTab='battle',archiveTab='history',mapView=null,mapScope='home';
Object.assign(names,{institutions:'朝廷机构',armory:'军务',chronicle:'国史档案'});
let toastTimer,planId,plan;
const monthNames=['正','二','三','四','五','六','七','八','九','十','十一','十二'];
const date=()=>`崇祯${S.year===1628?'元':S.year-1627}年 · ${monthNames[S.month-1]}月`;
const costText=c=>Object.entries(c||{}).filter(([,v])=>v>0).map(([k,v])=>`${v} ${cat.meta[k]?.[1]||''}${k==='money'?'白银':k==='grain'?'粮食':''}`).join(' · ')||'无需钱粮';
const effectText=e=>Object.entries(e||{}).map(([k,v])=>`${cat.meta[k]?.[0]||({unrest:'动乱',drought:'旱情',prosperity:'生产',revenue:'税收',influence:'影响力'}[k])||k} ${signed(v)}`).join('，')||'无即时数值变化';
const canPay=c=>Object.entries(c||{}).every(([k,v])=>S[k]>=v);
const actionDomain=id=>({relief:'agriculture',irrigation:'agriculture',audit:'governance',commerce:'finance',train:'military',recruit:'agriculture',arsenal:'military',academy:'education',reform:'governance',fleet:'naval',campaign:'military',rest:'governance'}[id])||'governance';
const eventDomain=e=>e.domain||({drought:'agriculture',flood:'agriculture',pay:'military',border:'military',jisi:'military',gentry:'finance',craft:'industry',trade:'naval',institutions:'governance'}[e.id])||'governance';
const leaderName=id=>{const o=cat.officials.find(o=>o.id===id);return o?.displayName||o?.name||'六部按案承办';};
function dutyPicker(domain,current=null,id='duty-official'){
 return `<div class="duty-picker"><label for="${id}">委任负责人 · 可留空</label><select id="${id}"><option value="">六部按案承办</option>${[...cat.officials].sort((a,b)=>(b.aptitudes?.[domain]||60)-(a.aptitudes?.[domain]||60)).map(o=>{const load=(o.workload||0)+(current===o.id?0:1);return `<option value="${o.id}" ${current===o.id?'selected':''}>${esc(o.displayName||o.name)} · 适配 ${o.aptitudes?.[domain]||60} · 任后 ${load} 差${id==='duty-official'?'':' · 首次起用 '+(o.hireCost??o.cost)+' 万两'}${load>2?'（精力分摊）':''}</option>`;}).join('')}</select><small>任职与差遣不再限定三席。前两项正常履职，再兼任则降低成效；受抚人才还受忠诚与整编影响。</small></div>`;
}
function dutyDesk(){
 const tasks=[...(S.event?[{...S.event,name:S.event.title,kind:'event',domain:eventDomain(S.event),order:'待御批；可在批复时一并选人，可同时确定督办。'}]:[]),...S.projects.map(p=>({...p,kind:'project',order:'督办提高工程进度，按月积累额外工作量。'})),...(S.affairs||[]).map(a=>({...a,kind:'affair'}))];
 return sectionTitle('任 事 有 人，办 毕 销 案','一事一任，各有所司',`<span class="badge">${tasks.length} 件待办</span>`)+`<section class="panel duty-intro"><h2>朕定方略，诸臣任事</h2><p>每个机构、工程与事件都能分别派一名负责人，中枢专任和各署任职按人手、经费与精力安排。批复奏报或颁行新政时可同时派人；开办后也可按需要更换督办。</p><div class="government-summary"><span>署务主官 <b>${[...cat.offices,...S.agencies].filter(a=>a.leader).length} / ${cat.offices.length+S.agencies.length}</b></span><span>事务督办 <b>${tasks.filter(a=>a.leader).length} / ${tasks.length}</b></span><span>督办差旅 <b>${F.dutyExpenses||0} 万两 / 月${F.portalDutyExpenses?' · 另有 '+F.portalDutyExpenses+' 万两由虫洞供给':''}</b></span></div><p class="muted">工程保留原工期，专人督办按适配与精力额外推进；事件即时批复后，另留两个月善后案卷，督办在销案时追加落实成效。每项专人差遣月费 ${S.fiscal?.rates.dutyFee??1} 万两；欠拨时暂停善后核验与工程督办加速。</p></section><div class="duty-grid">${tasks.map(a=>`<article class="panel duty-card"><div class="panel-head"><span class="badge">${a.petition?'留中待议':({event:'待批奏报',project:'在建工程',affair:'善后案卷'}[a.kind])}</span><small>${cat.domains.find(d=>d.id===a.domain)?.name}</small></div><h2>${esc(a.name)}</h2><p>${esc(a.order||'按原诏令核验落实。')}</p>${monthlyWorkText(a,a.kind)}<div class="ledger-line"><span>负责人</span><b>${esc(leaderName(a.leader))}</b></div>${a.remaining&&!a.petition?`<div class="duty-progress"><span>尚需 ${a.remaining} 月${a.kind==='project'?' · 督办进度 '+Math.round((a.workCredit||0)*100)+'%':''}</span>${meter((a.total-a.remaining)/a.total*100)}</div>`:''}<div class="agency-controls"><button class="outline" data-duty-kind="${a.kind}" data-duty-id="${a.id}" ${S.ended?'disabled':''}>${a.leader?'更换督办':'委任督办'}</button>${a.petition?'<button class="text-button gold" data-petition="'+a.id+'">重看留中奏报 →</button>':''}${a.kind==='event'?'<button class="text-button gold" data-op="petition">御前批复 →</button>':''}</div></article>`).join('')}</div>${tasks.length?'':empty('当前没有待办案卷。施政和批复后会自动留下办理记录。')}<details class="panel duty-people folded-panel"><summary>诸臣任职与精力</summary><div class="panel-head"><h2>诸臣任职与精力</h2><button class="outline" data-nav="officials">任免机构主官 ↗</button></div><p class="muted">同一人可兼领多个机构或事务。当前差遣数包括中枢专任、内阁六部、新署、工程、善后及待批奏报。</p><div class="workload-list">${cat.officials.map(o=>`<div><strong title="${esc((o.currentPosts||[]).join("、"))}">${esc(o.displayName||o.name)}</strong><span>${o.workload||0} 项差遣</span><b class="${o.workload>2?'danger':'gold'}">精力 ${Math.round((o.workloadFactor||1)*100)}%</b></div>`).join('')}</div>${[...cat.offices,...S.agencies].length?[...cat.offices,...S.agencies].map(a=>`<div class="ledger-line"><span>${esc(a.name)} · ${esc(leaderName(a.leader))}</span><button class="text-button gold" ${cat.offices.some(o=>o.id===a.id)?'data-office-leader':'data-agency-leader'}="${a.id}" ${S.ended?'disabled':''}>任免主官 →</button></div>`).join(''):''}</details>`;
}
function showDuty(kind,id){
 const a=kind==='project'?S.projects.find(p=>p.id===id):kind==='affair'?S.affairs.find(a=>a.id===id):S.event;
 if(!a)return;
 open('委任督办 · '+(a.name||a.title),dutyPicker(kind==='event'?eventDomain(a):a.domain,a.leader)+`<p class="muted">变更无额外起用费；每项已开办差遣每月支出 ${S.fiscal?.rates.dutyFee??1} 万两。工程加速与善后落实受适配、忠诚和兼任负担影响。留空改由六部办理。</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="primary" id="duty-confirm">颁行差遣</button></div>`);
 $('#duty-confirm').addEventListener('click',()=>change('assign-duty',{kind,id,official:$('#duty-official').value||null},'督办差遣已调整'));
}
function showOfficeLeader(id){
 const a=cat.offices.find(a=>a.id===id);if(!a)return;
 open(a.name+' · 委任主官',dutyPicker(a.domain,a.leader,'office-official')+`<p class="muted">任免不设次数上限，起用费列于人选中；每月管理支出按当前薪俸约定结算。可以兼任多个机构或事务，第三项差遣起会分摊精力。</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="primary" id="office-confirm">颁行任命</button></div>`);
 $('#office-confirm').addEventListener('click',()=>change('office-leader',{id,official:$('#office-official').value||null},'常设衙门主官已调整'));
}
let institutionFilter='all';
function institutionRows(){
 const tasks=[...S.projects.map(p=>({...p,kind:'project'})),...(S.affairs||[]).map(p=>({...p,kind:'affair'}))];
 return [...cat.offices.map(o=>({...o,key:'office:'+o.id,type:'core',budget:o.monthlyFee||0,status:'active'})),...S.agencies.map(a=>({...a,key:'agency:'+a.id,type:'agency'}))].map(o=>{
  const reports=(S.institutionReports||[]).filter(r=>r.institution===o.key),leader=cat.officials.find(p=>p.id===o.leader),owned=tasks.filter(p=>p.institution===o.key),related=tasks.filter(p=>!p.institution&&(o.leader&&p.leader===o.leader||p.name.includes(o.name)));
  return {...o,leaderInfo:leader,owned,related,reports,monthly:reports.find(r=>r.kind==='month'),completed:reports.filter(r=>r.kind==='completion'),history:S.history.filter(h=>(h.title+' '+h.text).includes(o.name)).slice(0,4),attention:o.type==='agency'&&(o.budget<=0||o.funded===false||!o.leader)||!!leader&&leader.workload>2};
 });
}
function monthlyWorkText(a,kind){const q=F.monthlyWork?.find(q=>q.id===a.id&&q.kind===kind);return q?'<p class="muted">现行月拨银 '+q.authorizedMoney+' / 需求 '+q.requiredMoney+' 万两，粮 '+q.authorizedGrain+' / 需求 '+q.requiredGrain+' 万石；获拨后的工作量 '+Number((q.ratio*100).toFixed(3))+'%。</p>':'';}
const institutionNumber=n=>(n>0?'+':'')+Number(n.toFixed(3)).toLocaleString('zh-CN',{maximumFractionDigits:3});
function institutionEffectText(r){
 const pieces=[...Object.entries(r.effects||{}).filter(([,v])=>v).map(([k,v])=>(cat.meta[k]?.[0]||k)+' '+institutionNumber(v)),...Object.entries(r.knowledge||{}).filter(([,v])=>v).map(([k,v])=>(cat.domains.find(d=>d.id===k)?.name||k)+'积累 '+institutionNumber(v)),...Object.entries(r.regional||{}).filter(([,v])=>v).map(([k,v])=>({drought:'各地平均旱情',prosperity:'各地平均生产'}[k]||k)+' '+institutionNumber(v))];
 if(r.revenueRate)pieces.push('月度税收系数 '+institutionNumber(r.revenueRate*100)+'%');if(r.harvestBonus)pieces.push('收获月增粮基数 '+institutionNumber(r.harvestBonus)+' 万石');
 return pieces.join('；')||'本期未记录额外数值增益。';
}
function institutionTask(p,related=false){if(p.petition)return '<div class="institution-task"><strong>'+esc(p.name)+'</strong><span>待议，不自动结案、不扣差旅</span><button class="text-button gold" data-petition="'+esc(p.id)+'">重看奏报 →</button></div>';return `<div class="institution-task"><div><strong>${esc(p.name)}</strong><small>${related?'关联事务 · 尚未登记为本署承办':p.kind==='project'?'本署工程':'本署善后'} · 尚需 ${p.remaining} 月${p.funding==='portal'?' · 虫洞供给':''}${p.leader?' · 督办 '+esc(cat.officials.find(o=>o.id===p.leader)?.name||p.leader):''}</small>${meter((p.total-p.remaining)/p.total*100)}</div><button class="text-button gold" data-duty-kind="${p.kind}" data-duty-id="${esc(p.id)}" ${S.ended?'disabled':''}>督办 →</button></div>`;}
function serviceRoster(o){
 const people=(S.service?.people||[]).filter(p=>p.institution===o.key&&p.revealed&&p.origin!=='incumbent'),tasks=(S.service?.tasks||[]).filter(t=>t.institution===o.key);
 return '<details class="institution-service"><summary>属员与差遣 · '+people.length+' 名已识人员</summary><p class="muted">主官按本署实际属员荐人。先交具体差事，结案后积累履历；提拔仍由你决定。</p>'+people.map(p=>'<div class="service-person"><strong>'+esc(p.name)+' · '+esc(p.role)+'</strong><small>'+esc(({serving:'本署任事',available:'试差通过 · 可任用',candidate:'候选 · 待核验',interview:'试差中 · 下月回复',departed:'离任'}[p.status])||p.status)+' · 已完成差遣 '+p.experience+' 次</small><p>'+esc(p.background)+'</p>'+(p.records.length?'<details><summary>办事履历</summary>'+p.records.map(r=>'<p>'+esc(r.text)+'</p>').join('')+'</details>':'')+(p.status==='candidate'?'<button class="outline" data-service-engage="'+p.id+'">核验履历与试差 · 银2万两</button>':'')+'</div>').join('')+tasks.slice(0,4).map(t=>'<p><strong>'+esc(S.service.people.find(p=>p.id===t.person)?.name||'属员')+' · '+esc(({active:'差遣中',completed:'已结案',closed:'已中止'}[t.status]))+'</strong><span>'+esc(t.report)+'</span></p>').join('')+'<button class="text-button gold" data-service-recommend="'+o.key+'">向主官询问合适人选 →</button></details>';
}
function institutionCard(o){
 const status=o.type==='agency'?(o.budget<=0?'停拨':o.funded===false?'欠拨':o.status==='forming'?'筹备中':'运行中'):'常设部务',tasks=[...o.owned.map(p=>({p,related:false})),...o.related.map(p=>({p,related:true}))],r=o.monthly;
 return `<article class="panel institution-card"><div class="panel-head"><h2>${esc(o.name)}</h2><span class="badge">${status}</span></div><p class="institution-mandate">${esc(o.mandate)}</p>${o.type==='agency'?`<details class="agency-authority"><summary>职责与授权</summary><div class="agency-powers">${o.powers.map(id=>`<span class="badge">${esc(cat.powers.find(p=>p.id===id)?.name||id)}</span>`).join('')}</div><p class="muted">${esc(agencyEffect(o))}</p></details>`:''}<div class="institution-meta"><span>负责人 <b title="${esc(o.leaderInfo?.displayName||'')}">${esc(o.leaderInfo?.name||'属官维持 · 未专任')}</b></span><span>月度预算 <b>${o.budget+(o.type==='agency'&&o.budget>0?(o.leaderInfo?.payByPost?.['agency:'+o.id]??o.leaderInfo?.payByRole?.agency??0):0)} 万两${o.type==='core'?' · 专任管理费':''}</b></span></div>${o.leaderInfo?.coveredPay?'<small class="muted">原任主官日常薪俸已含朝廷常设经费；上方只列新增管理支出。</small>':''}${serviceRoster(o)}${o.attention?`<p class="institution-warning">${o.type==='agency'&&o.budget<=0?'停拨期间筹备与职能暂停。':o.funded===false?'上期未足额拨款，职能暂停。':!o.leader?'尚缺专任主官，属员按有限能力运作。':'主官兼任较多，精力分摊影响成效。'}</p>`:''}<h3>现在忙什么 <small>${o.owned.length} 件本署事务${o.related.length?' · '+o.related.length+' 件关联':''}</small></h3>${tasks.slice(0,2).map(({p,related})=>institutionTask(p,related)).join('')}${tasks.length>2?`<details><summary>展开其余 ${tasks.length-2} 件</summary>${tasks.slice(2).map(({p,related})=>institutionTask(p,related)).join('')}</details>`:''}${!tasks.length?`<p class="muted">${o.status==='forming'?'正在交割案牍与筹备署务，尚需 '+o.remaining+' 月。':'本署暂无登记的专项待办，按职责处理日常部务。'}</p>`:''}<details class="institution-output"><summary>最近月报与成效</summary><div class="panel-head"><h3>最近月报</h3><small>${r?r.year+'年'+r.month+'月':'待下次月结'}</small></div>${r?`<p>${esc(r.text)}</p><p class="gold">${esc(institutionEffectText(r))}</p>`:'<p class="muted">此前未按署保存逐月成效，从下一次月结开始记录。下方相关纪事可查看已有进展。</p>'}</details>${o.completed.length?`<details class="institution-completed"><summary>近期办成 · ${o.completed.length} 件</summary>${o.completed.slice(0,3).map(x=>`<p><strong>${esc(x.title)}</strong><small>${x.year}年${x.month}月 · ${esc(institutionEffectText(x))}</small></p>`).join('')}</details>`:''}<details class="institution-activity"><summary>近期交办、月报与相关纪事</summary>${o.reports.slice(0,8).map(x=>`<p><strong>${x.year}年${x.month}月 · ${esc(x.title)}</strong><span>${esc(x.text)}</span></p>`).join('')}${o.history.map(x=>`<p><strong>${esc(x.date)} · ${esc(x.title)}</strong><span>${esc(x.text)}</span><small>相关纪事，未据此认定本署独立成果。</small></p>`).join('')}${!o.reports.length&&!o.history.length?'<p class="muted">暂无相关记录。可直接向该机构询问或交办。</p>':''}</details><div class="institution-card-actions"><button class="gold-button" data-counsel-open="${o.key}" ${busy?'disabled':''}>直接议事 →</button><button class="outline" data-institution-report="${o.key}" ${busy?'disabled':''}>请其呈报 / 献策</button><button class="text-button gold" ${o.type==='core'?'data-office-leader':'data-agency-leader'}="${o.id}" ${S.ended?'disabled':''}>${o.leader?'调整主官':'委任主官'}</button>${o.type==='agency'?`<button class="text-button" data-agency-budget="${o.id}">经费</button><details class="institution-more"><summary>改组 / 裁撤</summary><button class="outline" data-agency-edit="${o.id}">改组章程</button><button class="text-button danger" data-agency-dissolve="${o.id}">裁撤机构</button></details>`:''}</div></article>`;
}
function institutionBoard(){
 const rows=institutionRows(),shown=rows.filter(o=>institutionFilter==='all'||institutionFilter==='core'&&o.type==='core'||institutionFilter==='agency'&&o.type==='agency'||institutionFilter==='attention'&&o.attention||institutionFilter==='working'&&o.owned.length+o.related.length>0);
 return sectionTitle('诸 司 各 任，功 过 有 据','机构政务',`<button class="gold-button" data-op="create-agency">拟设新机构 ＋</button>`)+`<p class="muted intro">各机构的在办工作、真实月报与近期成果集中于此。直接向某署下旨开办的事务会登记该署承办；主官兼领的旧事务单独标注为关联。月报列出本署直接增益，税收系数和收获月基数不等同于当月实收。</p><div class="institution-summary"><span>现设机构 <b>${rows.length}</b></span><span>需留意 <b>${rows.filter(o=>o.attention).length}</b></span><span>本月机构开支预计 <b>${F.agencyExpenses||0} 万两</b></span><span>已归档月报 <b>${(S.institutionReports||[]).filter(r=>r.kind==='month').length} 份</b></span></div><div class="institution-filters" role="group" aria-label="筛选机构">${Object.entries({all:'全部机构',working:'有在办事务',attention:'需要留意',core:'常设机构',agency:'自设机构'}).map(([id,label])=>`<button class="outline ${institutionFilter===id?'selected':''}" data-institution-filter="${id}" aria-pressed="${institutionFilter===id}">${label}</button>`).join('')}</div><div class="institution-grid">${shown.map(institutionCard).join('')||empty('此筛选下暂无机构。')}</div>`;
}
async function requestInstitutionReport(id){
 const row=institutionRows().find(o=>o.key===id);if(!row)return;openCounselTarget(id);if(busy||counselTarget!==id)return;
 await sendCounsel('请呈报'+row.name+'最近在忙什么、在办事务进度、已完成成果、经费与人手困难，并给出下一步建议。请以真实机构月报、归属本署的工程和办理记录为依据；兼领或未登记的关联工作要说明归属，尚未结案不可声称完成。本次先听取呈报，不执行新政。','discuss');
}
function talentPanel(){
 const joined=S.talents.filter(t=>['probation','available'].includes(t.status)).length;
 return `<section class="panel talent-panel"><div class="panel-head"><div><span class="eyebrow">纳 降 抚 众，亦 可 为 用</span><h2>招安与人才线索</h2></div><button class="gold-button" data-op="new-recruitment" ${S.ended?'disabled':''}>接触新首领 ↗</button></div><p class="muted">中枢专任不再设三人名额。人才库可继续扩充，受抚首领还能主持机构、督办工程与善后；任用成效取决于能力、忠诚与整编。</p><div class="government-summary"><span>可任用人物 <b>${cat.officials.length}</b></span><span>已受抚 <b>${joined} 人</b></span><span>安置军饷 <b>${F.talentExpenses||0} 万两 / 月</b></span><span>部众口粮 <b>${F.talentGrain||0} 万石 / 月</b></span></div><div class="talent-grid">${S.talents.map(t=>`<article class="talent-card"><div class="panel-head"><h3>${esc(t.name)}</h3><span class="badge">${({independent:'尚未归附',negotiating:'交涉中 · 下月回复',probation:'观察 '+t.probationMonths+' 月',available:'已归附',rebelled:'再次反叛',departed:'离散'}[t.status])}</span></div><p>${S.provinces.find(p=>p.id===t.region)?.name} · 部众约 ${t.troops} 千人 · ${t.origin==='player'?'玩家指定的架空线索':'架空地方线索'}</p><div class="talent-abilities"><span>统兵 <b>${t.command}</b></span><span>理政 <b>${t.governance}</b></span><span>工艺 <b>${t.craft}</b></span></div>${['probation','available'].includes(t.status)?`<div class="talent-loyalty"><div class="threat-line"><span>忠诚评估 ${num(t.loyalty)} · 整编 ${num(t.integration)}</span><span>${t.retainForces?'保留旧部':'分批整编'}</span></div>${meter(t.loyalty,t.loyalty<35?'red':'')}<small>月饷 ${t.upkeep} 万两；已可在下方专任名单及机构负责人中试用。</small></div>`:`<div class="talent-footer"><span class="muted">${t.status==='negotiating'?'使者正在交涉，条款已记录。':'可以谈赦免、兵权与钱粮，归附并非必然。'}</span><button class="outline" data-parley="${t.id}" ${S.ended||t.status==='negotiating'?'disabled':''}>议定招安</button></div>`}</article>`).join('')}</div></section>`;
}
let counselTarget='council',counselDrafts={},counselAuto=true,counselPending=null,counselError='',counselMonth='current',counselShowAll=false,counselEditing=null;
function currentCounselTargets(){return cat.counselTargets||[];}
function openCounselTarget(id){
 if(busy){toast('当前议事正在办理，请稍候再切换。');return;}
 if(!currentCounselTargets().some(t=>t.id===id)){toast('该机构已经撤销或议事对象已变化，请刷新后重试。');return;}
 clearCounselEdit();close();counselTarget=id;counselMonth='current';counselShowAll=false;counselError='';view='counsel';render();scrollCounsel();window.scrollTo({top:0});$('#counsel-input')?.focus({preventScroll:true});
}
function institutionCounselLinks(){
 const institutions=currentCounselTargets().filter(t=>t.group==='衙门');
 return `<section class="institution-counsel-links" aria-label="机构直接议事"><div><strong>机构直奏</strong><small>各机构分别保留议事记录，点击即可交谈。</small></div><div class="institution-counsel-buttons"><button class="outline ${counselTarget==='council'?'selected':''}" data-counsel-open="council" aria-pressed="${counselTarget==='council'}" ${busy?'disabled':''}>御前群议</button>${institutions.map(t=>`<button class="outline ${counselTarget===t.id?'selected':''}" data-counsel-open="${esc(t.id)}" aria-pressed="${counselTarget===t.id}" ${busy?'disabled':''}>${esc(t.name)}</button>`).join('')}</div></section>`;
}
function counselView(){
 const targets=currentCounselTargets(),records=S.discussions||[],archived=records.filter(t=>!targets.some(x=>x.id===t.id));
 const target=targets.find(t=>t.id===counselTarget)||archived.find(t=>t.id===counselTarget)||targets[0];
 if(!target)return empty('议事暂未准备好，请刷新。');counselTarget=target.id;
 const thread=records.find(t=>t.id===target.id),allMessages=thread?.messages||[],active=targets.some(t=>t.id===target.id),online=C.enabled&&C.hasKey;
 const chosenTurn=counselMonth==='current'?S.turn:Number(counselMonth),monthMessages=allMessages.filter(m=>m.turn===chosenTurn),messages=counselShowAll?monthMessages:monthMessages.slice(-12),months=[...new Set(allMessages.map(m=>m.turn))].filter(t=>t!==S.turn).sort((a,b)=>b-a),hidden=monthMessages.length-messages.length;
 const historyBar=`<div class="counsel-history-bar"><label for="counsel-month">议事月份</label><select id="counsel-month" ${busy?'disabled':''}><option value="current" ${counselMonth==='current'?'selected':''}>本月 · ${date()}</option>${months.map(t=>`<option value="${t}" ${String(t)===counselMonth?'selected':''}>${esc(allMessages.find(m=>m.turn===t)?.date||'第 '+(t+1)+' 月')} · 历月记录</option>`).join('')}</select><span>${chosenTurn===S.turn?'本月':'往月'} ${Math.ceil(monthMessages.length/2)} 轮</span>${hidden?`<button class="text-button gold" data-op="counsel-expand" ${busy?'disabled':''}>展开更早 ${Math.ceil(hidden/2)} 轮</button>`:counselShowAll&&monthMessages.length>12?'<button class="text-button gold" data-op="counsel-collapse">只看最近 6 轮</button>':'<small>默认显示最近 6 轮</small>'}</div>`;
 const editBar=counselEditing?.target===target.id?`<div class="counsel-edit-bar" role="status"><span>正在修改原话；重新递呈会替换本轮及其后的未执行对话。</span><button type="button" class="text-button gold" data-op="counsel-edit-cancel" ${busy?'disabled':''}>取消修改</button></div>`:'';
 return sectionTitle('有 事 可 奏，有 疑 可 问',target.group==='衙门'?esc(target.name)+' · 直接议事':'与群臣议政，向天下下旨',`<div class="counsel-heading-actions"><button class="gold-button" data-op="counsel-advice">请群臣献策 ↗</button><span class="badge">${online?'DeepSeek 已连接':'离线参议'}</span></div>`)+institutionCounselLinks()+`<div class="counsel-layout"><section class="panel counsel-panel"><div class="counsel-toolbar"><div><label for="counsel-target">交谈对象</label><select id="counsel-target" ${busy?'disabled':''}>${['群议','人物','衙门'].map(group=>`<optgroup label="${group}">${targets.filter(t=>t.group===group).map(t=>`<option value="${esc(t.id)}" ${t.id===target.id?'selected':''}>${esc(t.displayName||t.name)}</option>`).join('')}</optgroup>`).join('')}${archived.length?`<optgroup label="来往档案">${archived.map(t=>`<option value="${esc(t.id)}" ${t.id===target.id?'selected':''}>${esc(t.name)} · 已离任或撤销</option>`).join('')}</optgroup>`:''}</select></div><span class="counsel-caption">${esc(target.bio||'此前的来往记录')}</span></div>${!online?`<div class="counsel-connection"><div><strong>${C.hasKey?'已有密钥，AI 尚未启用':'尚未连接 AI'}</strong><p>${C.hasKey?'启用现有配置后，即可自由追问、商议政策并交办政务。':'在 AI 设置填入并启用 DeepSeek 密钥后，即可自由交谈、商议政策并交办政务。'}当前离线参议可读取局势、识别常见任命与政务指令。</p></div><button class="outline" data-op="${C.hasKey?'enable-counsel-ai':'settings'}">${C.hasKey?'启用现有 AI ↗':'连接 DeepSeek ↗'}</button></div>`:''}<div class="counsel-state-bar" role="status">${date()} · 每月施政不限次数 · ${S.event?'尚有奏报待批':'奏报已批复，仍可另颁新令'}</div>${historyBar}<div class="counsel-transcript" id="counsel-transcript" role="log" aria-label="议事记录" aria-live="polite">${messages.length?messages.map((m,i)=>`<article class="counsel-message ${m.role}"><div class="counsel-message-head"><strong>${m.role==='user'?'朕':esc(m.speakerLabel||target.name)}</strong><span>${esc(m.date)} · ${m.role==='user'?'旨意与垂询':m.source==='ai'?'DeepSeek':m.source==='system'?'系统办理':'离线参议'}</span></div>${m.result?`<div class="counsel-result ${m.result.status}"><b>${({executed:'✓ 已实际办理',blocked:'未能办理',discussed:'议事 · 尚未执行'}[m.result.status])}</b><p>${esc(m.result.text)}</p></div>`:''}<p class="counsel-content">${esc(m.content)}</p>${m.orderText&&m===allMessages.at(-1)&&chosenTurn===S.turn&&active?`<button class="gold-button" data-counsel-enact-original="${esc(m.id)}" ${busy?'disabled':''}>按这道原话办理 →</button>`:''}${!m.orderText&&!m.commands?.length&&m.source==='ai'&&m.result?.status==='discussed'&&m===allMessages.at(-1)&&chosenTurn===S.turn&&active?`<button class="outline" data-op="counsel-accept" ${busy?'disabled aria-busy="true"':''}>${busy?'正在核验办理…':'据此办理 →'}</button>`:''}${m.commands?.length&&m.result?.status!=='executed'?`<details class="counsel-proposals"><summary>拟议事项 · ${m.commands.length} 项</summary><ul>${m.commands.map(c=>`<li>${esc(commandLabel(c))}</li>`).join('')}</ul></details>${m===allMessages.at(-1)&&chosenTurn===S.turn&&active?`<button class="outline" data-op="counsel-accept" ${busy?'disabled aria-busy="true"':''}>${busy?'正在核验办理…':'照此办理 →'}</button>`:''}`:''}${counselMessageActions(m,allMessages,active)}</article>`).join(''):`<div class="counsel-welcome"><span>御 前</span><h2>${chosenTurn===S.turn?esc(target.name)+'候问':'本月无近期记录'}</h2><p>问局势、议新法，也可以直接交待任命与政务。议事按月份折存，可在上方选择往月记录；每次递呈会读取如今的大明。</p><p>例如：“任命毕自严为户部尚书”，或“如果废掉内阁，该如何交接？”</p></div>`}${counselPending?.target===target.id?`<article class="counsel-message user"><div class="counsel-message-head"><strong>朕</strong><span>正在递呈</span></div><p class="counsel-content">${esc(counselPending.text)}</p></article><div class="counsel-wait"><span class="spinner"></span>${online?'对方正在斟酌，最长等待 90 秒…':'正在核验局势与办理条件…'}</div>`:''}</div>${counselError?`<p class="counsel-error" role="alert">${esc(counselError)} 输入已保留，可重试。${hasPetitionBudgetDraft()?'<button class="outline" data-petition-retry="true">修改保留的批复与预算</button>':''}</p>`:''}${editBar}<form id="counsel-form"><label class="counsel-mode"><input id="counsel-auto" type="checkbox" ${counselAuto?'checked':''} ${busy?'disabled':''}>明确旨意直接办理<span>询问、假设先商议</span></label><label for="counsel-input" class="sr-only">向议事对象说些什么</label><textarea id="counsel-input" rows="3" maxlength="2000" placeholder="比如：任命毕自严为户部尚书；让宋应星督办火器工坊。也可以接着问：钱粮不够，该怎么办？" ${busy||!active?'disabled':''}>${esc(counselDrafts[target.id]||'')}</textarea><div class="counsel-compose-footer"><small>${active?(online?'自由议事、方案修正和有新政成果时每三月的后续奏报按实际 AI 调用计费，已拟好的有效方案可直接办理。':'当前使用离线规则参议。'):'此对象已离任或撤销，仅供查阅。'} 对话随本局存档保存。</small><button type="submit" class="gold-button" ${busy||!active?'disabled':''}>${busy?'正在议事…':counselEditing?'修改并重新递呈 →':online?'递呈 · 与 AI 议事 →':'递呈 · 离线办理 →'}</button></div></form></section><aside class="counsel-sidebar"><section class="panel"><span class="eyebrow">今 日 御 案</span><h2>${date()}</h2><div class="ledger-line"><span>施政规则</span><b>不限次数</b></div><div class="ledger-line"><span>国库 / 官仓</span><b>${num(S.money)} / ${num(S.grain)}</b></div><p>${S.event?'待批：'+esc(S.event.title):'本月暂无待批急报，可继续施政。'}</p><p class="muted">明确下旨会按实际方案扣除钱粮，不限制每月施政次数。每次办理会回报真实结果；条件不足时整批保留原状。</p></section><section class="panel"><h2>可这样开口</h2><div class="counsel-examples">${['眼下最紧要的事是什么？','任命毕自严为户部尚书','让宋应星督办火器工坊','如果废内阁，六部怎样交接？'].map(t=>`<button class="text-button" data-counsel-example="${esc(t)}">${t}</button>`).join('')}</div><p class="muted">先商议可关闭“明确旨意直接办理”；接受刚才的建议时说“照办”。机构、地方与军务页也可直接进入同一议事记录。</p></section></aside></div>`;
}

function counselMessageActions(m,messages,active){
 if(!active||!m.id)return '';
 const index=messages.indexOf(m);let start=index;while(start>=0&&messages[start].role!=='user')start--;
 if(start<0)return '';
 const locked=messages.slice(start).some(row=>row.result?.status==='executed');
 if(locked)return '<div class="counsel-message-actions"><span class="counsel-locked">'+(messages.slice(start,start+2).some(row=>row.result?.status==='executed')?'已执行 · 不可改写':'后续已有政令执行')+'</span></div>';
 return '<div class="counsel-message-actions">'+(m.role==='user'?'<button class="text-button" data-counsel-edit="'+esc(m.id)+'" '+(busy?'disabled':'')+'>编辑重发</button>':'<button class="text-button" data-counsel-regenerate="'+esc(m.id)+'" '+(busy?'disabled':'')+' title="只重新拟答，不直接执行政令">重新回复</button>')+'<button class="text-button" data-counsel-delete="'+esc(m.id)+'" '+(busy?'disabled':'')+'>删除本轮及后续</button></div>';
}
function clearCounselEdit(restore=true){if(restore&&counselEditing)counselDrafts[counselEditing.target]=counselEditing.previousDraft;counselEditing=null;}
function startCounselEdit(id){
 const messages=S.discussions.find(t=>t.id===counselTarget)?.messages||[],m=messages.find(m=>m.id===id);if(!m)return;
 clearCounselEdit();counselEditing={target:counselTarget,messageId:id,lastMessageId:messages.at(-1)?.id,previousDraft:counselDrafts[counselTarget]||''};counselDrafts[counselTarget]=m.content;counselMonth='current';counselShowAll=false;counselError='';render();scrollCounsel();$('#counsel-input')?.focus();
}
async function regenerateCounsel(id){
 const messages=S.discussions.find(t=>t.id===counselTarget)?.messages||[],index=messages.findIndex(m=>m.id===id);let start=index;while(start>=0&&messages[start].role!=='user')start--;if(start<0)return;
 clearCounselEdit();await sendCounsel(messages[start].content,'discuss',{action:'regenerate',messageId:id,lastMessageId:messages.at(-1)?.id});
}
function showCounselDelete(id){
 const messages=S.discussions.find(t=>t.id===counselTarget)?.messages||[],index=messages.findIndex(m=>m.id===id);let start=index;while(start>=0&&messages[start].role!=='user')start--;if(start<0)return;
 const target=counselTarget,lastMessageId=messages.at(-1)?.id,count=messages.length-start;
 open('删除未执行的对话','<p>将删除这轮及其后的 '+count+' 条消息。已经执行的政令不能删除，钱粮、任职与历史进度不会因此回退。</p><div class="modal-buttons"><button class="outline" data-op="close">保留对话</button><button class="primary" id="counsel-delete-confirm">删除这段对话</button></div>');
 $('#counsel-delete-confirm').addEventListener('click',async()=>{if(await change('counsel-delete',{target,messageId:id,lastMessageId},'未执行的对话已删除')){clearCounselEdit();counselError='';render();scrollCounsel();}});
}

function commandLabel(c){
 if(c.type==='event'&&c.custom){const b=c.custom.draft.budget;return '自拟批复：首拨上限 '+b.money+' 万两 / '+b.grain+' 万石'+(b.monthly?'；月拨 '+b.monthly.money+' 万两 / '+b.monthly.grain+' 万石'+(b.months?'，限 '+b.months+' 个月':'，办理期间'):'；不另批月费');}
 if(c.type==='monthly')return '调整月拨 · '+c.target+'：'+(c.monthly?.paused?'停拨暂停':(c.monthly?.money??'按原标准')+' 万两 / 月');
 if(c.type==='service'){const rec=S.service?.recommendations.find(r=>r.id===c.recommendation);return c.operation==='delegate'?'差遣 '+(S.service.people.find(p=>p.id===rec?.person)?.name||'议定属员')+'：'+(rec?.task||'议定任务'):c.operation==='seek'?'由本署访求人才（银4万两、粮2万石，下月回复）':'核验人才履历与试差';}
 const who=cat.officials.find(o=>o.id===c.official||o.name===c.official)?.name||c.official||'解除差遣';
 const place=cat.offices.find(o=>o.id===c.office)?.name||c.office;
 return ({office:who+' · '+place,agency:who+' · '+(S.agencies.find(a=>a.id===c.agency)?.name||c.agency),duty:who+'督办 '+([...S.projects,...(S.affairs||[])].find(a=>a.id===c.target)?.name||S.event?.title||c.target),central:'中枢起用 · '+who,dismiss:'解除中枢差遣 · '+who,budget:'调整 '+(S.agencies.find(a=>a.id===c.agency)?.name||c.agency)+' 月拨为 '+c.budget+' 万两',fiscal:c.scope==='person'?'调整 '+who+' 的在职月俸约定':'调整薪俸与经费标准',policy:'钱粮国策：征税 '+(c.tax??S.tax)+'，军费 '+(c.military??S.military),action:(cat.actions.find(a=>a.id===c.action||a.name===c.action)?.name||c.action)+(c.target?' · '+(S.provinces.find(p=>p.id===c.target)?.name||c.target):''),event:'批复奏报 · 第 '+(Number(c.index)+1)+' 项',edict:c.text,diplomacy:'办理外务 · '+(S.countries.find(a=>a.id===c.country)?.name||c.country)}[c.type])||'拟议政务';
}
function scrollCounsel(result=false){const el=$('#counsel-transcript');if(!el)return;const latest=result?el.querySelector('.counsel-message.assistant:last-child'):null;el.scrollTop=latest?Math.max(0,el.scrollTop+latest.getBoundingClientRect().top-el.getBoundingClientRect().top-12):el.scrollHeight;}
async function sendCounsel(override,mode,rewrite=null,options={}){
 if(busy)return;const input=(override??counselDrafts[counselTarget]??'').trim();if(!input){toast('请先写下垂询或旨意');$('#counsel-input')?.focus();return;}
 const target=counselTarget,requestMode=mode||(counselAuto?'auto':'discuss');
 if(!options.petitionDraft&&target==='council'&&hasPetitionBudgetDraft()&&input===petitionBudgetDraft.text)options={...options,petitionDraft:petitionBudgetDraft};
 if(options.petitionDraft){petitionBudgetDraft=JSON.parse(JSON.stringify(options.petitionDraft));counselDrafts[target]=input;}
 if(!rewrite&&counselEditing?.target===target)rewrite={action:'edit',messageId:counselEditing.messageId,lastMessageId:counselEditing.lastMessageId};
 counselMonth='current';counselShowAll=false;busy=true;counselError='';counselPending={target,text:input};view='counsel';render();scrollCounsel();document.body.classList.add('working');
 try{
  const r=await api('counsel',{target,text:input,mode:requestMode,offline:!C.enabled||!C.hasKey,...(rewrite?{rewrite}:{}),...(options.planRef?{planRef:options.planRef}:{}),...(options.petitionDraft?{petitionDraft:options.petitionDraft}:{})});S=r.state;F=r.forecast;A=r.administration;if(r.equipment)cat.equipment=r.equipment;C=r.config;cat.officials=r.officials;cat.offices=r.offices;cat.counselTargets=r.counselTargets;
  if(counselEditing?.target===target)clearCounselEdit(false);
  const result=r.thread?.messages?.at(-1)?.result;
  if(result?.status==='executed'&&!hasPetitionBudgetDraft())petitionBudgetDraft=null;
  if(result?.status==='blocked'){counselError='未能办理：'+result.text;toast('未能办理，请查看输入框上方的原因。');}
  else{if(rewrite?.action!=='regenerate'){if(counselDrafts[target]===input)delete counselDrafts[target];if(draft===input)draft='';}if(result?.status==='executed')toast('旨意已核验办理，结果已列在议事记录中。');}
 }catch(e){counselError=e.message;}
 finally{busy=false;counselPending=null;document.body.classList.remove('working');if(view==='counsel'){render();scrollCounsel(true);}}
}

let parleyTarget=null;
function showRecruitmentForm(id){
 const t=S.talents.find(t=>t.id===id);parleyTarget=t?.id||null;
 open(t?'遣使招安 · '+t.name:'接触新的地方首领',`<form id="recruitment-form">${t?`<p class="modal-narrative">与 ${esc(t.name)} 议定条款。任官须等到对方接受；保留旧部更容易谈成，也留下更大的再叛风险。</p>`:`<label for="recruit-name">首领姓名或称号</label><input id="recruit-name" required minlength="2" maxlength="32" placeholder="填写姓名或本局出现的首领称号"><small class="muted">新姓名、身份与能力按本局架空线索推演。</small>`}<label for="recruit-region">活动地区</label><select id="recruit-region" ${t?'disabled':''}>${S.provinces.map(p=>`<option value="${p.id}" ${p.id===(t?.region||selected)?'selected':''}>${p.name}</option>`).join('')}</select><div class="recruitment-costs"><div><label for="recruit-silver">使团与抚银 · 万两</label><input id="recruit-silver" type="number" required min="12" max="80" step="1" value="30"></div><div><label for="recruit-grain">安置粮 · 万石</label><input id="recruit-grain" type="number" required min="5" max="40" step="1" value="15"></div></div><label class="toggle"><input id="recruit-amnesty" type="checkbox" checked>赦免普通附从，保留整编责任</label><label class="toggle"><input id="recruit-retain" type="checkbox" checked>允许暂留旧部，逐步整编</label><p class="muted">交涉支出按实际条款扣除，下月回报。受抚后观察两个月并持续支付军饷与口粮；未谈成时使团与安置准备支出不返还。请先审阅接受机会和后续开支。</p><div class="modal-buttons"><button class="outline" type="button" data-op="close">暂缓</button><button class="primary" type="submit">审阅招安条款 →</button></div></form>`,true);
}
async function submitRecruitmentForm(){
 const t=S.talents.find(t=>t.id===parleyTarget),terms={target:parleyTarget,name:t?.name||$('#recruit-name').value.trim(),region:t?.region||$('#recruit-region').value,grant:Number($('#recruit-silver').value),grain:Number($('#recruit-grain').value),amnesty:$('#recruit-amnesty').checked,retainForces:$('#recruit-retain').checked};
 if(busy)return;busy=true;document.body.classList.add('working');
 try{const r=await api('preview',{text:'招安'+terms.name,recruitment:terms});plan=r.plan;planId=r.id;showPlan();}catch(e){toast(e.message);}finally{busy=false;document.body.classList.remove('working');}
}
function recruitmentPreview(p){
 const r=p.recruitmentPreview;
 return `<div class="institution-preview"><h3>招安不是立即任官</h3><p>预计接受机会：<strong>${r.chance}%</strong> · 所部约 ${r.troops} 千人。<br>下月回复，接受后观察两个月；可试用，忠诚和整编影响成效。<br>后续每月军饷：${r.upkeep} 万两，口粮：${r.grain} 万石。</p><small>失信、欠饷和持续高压可能导致离散；保留旧部的首领可能率部再叛。</small></div>`;
}
function agencyEffect(a){
 const effects={agriculture:'执行权可改善生产、旱情及收粮。',industry:'积累格物；执行权可改善税入。',finance:'执行权可提高税收效率。',military:'执行权可提升军备并缓解边患。',naval:'执行权可持续发展海权。',governance:'执行权可降低贪腐。',education:'持续积累格物与教育科研经验。',medicine:'执行权可改善民心。'};
 return (effects[a.domain]||'')+(a.powers.includes('research')?' 研究权加快方向积累。':'')+(a.powers.includes('oversight')?' 监察权可进一步降低贪腐。':'')+(a.powers.includes('coordination')?' 达到条件后承担中枢统筹。':'')+' 业务月拨、主官适配、兼任精力和相同实际权责重叠影响成效，互补分工不一概打折；现有规模在月拨12万两时达到经费加成上限。主官月俸另列，不等同业务预算。';
}
let editingAgency=null;
function showAgencyForm(id){
 const a=S.agencies.find(a=>a.id===id);editingAgency=a?.id||null;
 open(a?'改组 · '+a.name:'拟设新机构',`<form id="agency-form"><label for="agency-name">衙门名称</label><input id="agency-name" required minlength="2" maxlength="32" placeholder="如：皇家科学院、审计院、政务院" value="${esc(a?.name||'')}"><label for="agency-mandate">职责与权责边界</label><textarea id="agency-mandate" required rows="3" maxlength="500" placeholder="说明由它做什么、向谁负责，以及和六部如何协作">${esc(a?.mandate||'')}</textarea><label for="agency-domain">主责方向</label><select id="agency-domain">${cat.domains.map(d=>`<option value="${d.id}" ${(a?.domain||'education')===d.id?'selected':''}>${d.name}</option>`).join('')}</select><fieldset class="power-picker"><legend>授权范围（最多三项）</legend>${cat.powers.map(p=>`<label><input type="checkbox" name="agency-power" value="${p.id}" ${(a?.powers||['research']).includes(p.id)?'checked':''}>${p.name}</label>`).join('')}</fieldset><label for="agency-monthly">月拨预算 · 万两</label><input id="agency-monthly" type="number" min="0" max="20" step="1" required value="${a?.budget??8}"><small class="muted">新设筹备两个月。启动费20加两个月当前承办规模经费（每月最多12）；改组费 15 万两。负责人管理开支另列，停拨则暂停职能。</small><div class="modal-buttons"><button type="button" class="outline" data-op="close">留中再议</button><button type="submit" class="primary">审阅设署诏令 →</button></div></form>`,true);
}
async function submitAgencyForm(){
 const powers=Array.from(document.querySelectorAll('input[name="agency-power"]:checked')).map(x=>x.value);
 const change={operation:editingAgency?'amend_agency':'create_agency',...(editingAgency?{target:editingAgency}:{}),name:$('#agency-name').value.trim(),mandate:$('#agency-mandate').value.trim(),domain:$('#agency-domain').value,powers,budget:Number($('#agency-monthly').value)};
 if(!powers.length||powers.length>3){toast('请授予一至三项权限');return;}
 await previewInstitutionChanges([change],(editingAgency?'改组':'设立')+change.name+'，'+change.mandate);
}
async function previewInstitutionChanges(changes,text){
 if(busy)return;busy=true;document.body.classList.add('working');
 try{const r=await api('preview',{text,institutionChanges:changes});plan=r.plan;planId=r.id;showPlan();}
 catch(e){toast(e.message);}finally{busy=false;document.body.classList.remove('working');}
}
function institutionPreview(p){
 const g=p.governmentPreview;
 return `<div class="institution-preview"><h3>颁行后的制度</h3><p>${esc(g.before.name)} → <strong>${esc(g.after.name)}</strong><br>施政次数：不限；制度交接：${g.after.transition} 月。<br>新署及管理支出：${g.monthlyBudget} 万两 / 月，较当前 ${signed(g.monthlyBudgetChange)}。</p><small>新机构须筹备完成并持续获拨款；统筹权限还需负责人及至少 6 万两月拨。</small></div>`;
}
function showAgencyLeader(id){
 const a=S.agencies.find(a=>a.id===id);if(!a)return;
 open(a.name+' · 委任署务',dutyPicker(a.domain,a.leader,'agency-official')+`<p class="muted" style="margin-top:15px">委任不限制月内次数，收取该人物起用费；每月管理开支按当前薪俸约定结算。可与中枢、其他机构及事务兼任，超出两项差遣将分摊精力。适配、忠诚与经费共同决定机构成效。</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="primary" id="agency-appoint-confirm">颁行任命</button></div>`);
 $('#agency-appoint-confirm').addEventListener('click',()=>change('agency-leader',{id,official:$('#agency-official').value||null},'机构负责人已调整'));
}
function showAgencyBudget(id){
 const a=S.agencies.find(a=>a.id===id);if(!a)return;
 open(a.name+' · 经费',`<label for="agency-budget-value">每月拨银 · 万两</label><input type="number" id="agency-budget-value" min="0" max="20" step="1" value="${a.budget}"><p class="muted" style="margin-top:15px">调整不限制月内次数，自月结拨付后影响工作。业务月拨0暂停，1至12万两提高经费加成，12万两以上按现有规模封顶，超额授权留在国库，不再白扣。主官俸禄另算；无足额钱粮时仍可能停办。</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="primary" id="agency-budget-confirm">确定月拨</button></div>`);
 $('#agency-budget-confirm').addEventListener('click',()=>change('agency-budget',{id,budget:Number($('#agency-budget-value').value)},'机构经费已调整'));
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4800);}
const horizons={short:'短期',medium:'中期',long:'长期'},memoStatuses={deferred:'待实施',started:'已启动',done:'已完成',cancelled:'已搁置'};
const gameMonth=()=>S.year*12+S.month-1;
const planDate=n=>Math.floor(n/12)+'年'+(n%12+1)+'月';
const dueMemos=()=>(S.planning||[]).filter(p=>p.status==='deferred'&&p.deadline<=gameMonth());
let reminderBusy=false;
function planningBanner(){const due=dueMemos();return due.length?`<div class="planning-banner" role="status"><div><strong>有 ${due.length} 项规划到期，待陛下复议</strong><span>${esc(due.slice(0,3).map(p=>p.title).join('、'))}${due.length>3?'等':''}${reminderBusy?' · AI 正在复议…':''}</span></div><button class="outline" data-nav="planning">查看提醒 →</button></div>`:'';}
function reminderPanel(){
 const due=new Set(dueMemos().map(p=>p.id)),notice=(S.planningReminders||[]).find(r=>r.status!=='cancelled'&&r.planIds.some(id=>due.has(id)));
 if(!notice)return due.size?'<p class="notice">规划已到复议期，正在准备提醒；可从规划备忘中选择目标，与 AI 复议。</p>':'';
 return `<section class="planning-reminder"><div class="panel-head"><h3>${notice.source==='ai'?'AI 到期复议':'规划到期提醒'}</h3><small>${planDate(notice.at)}</small></div><p>${esc(notice.text)}</p><small class="muted">提醒仅供议事；具体办理须另行下旨。</small></section>`;
}
let developmentBusy=false;
function developmentPanel(){const c=S.service?.story.chapters.find(c=>c.turn===S.turn);return c?'<section class="notice"><strong>'+esc(c.title)+'</strong><p>'+esc(c.text)+'</p><small>后续奏报已入列；下一次月结才可能递交选择，当前没有执行或扣费。</small></section>':'';}
async function requestDevelopmentStory(){
 if(developmentBusy||!S.service||S.turn<=0||S.turn%3||S.service.story.lastTurn===S.turn||!S.institutions.length&&!S.service.tasks.some(t=>t.status==='completed'))return;
 developmentBusy=true;const id=S.id,turn=S.turn;
 try{const r=await api('development-story',{offline:!C.enabled||!C.hasKey});if(S.id===id&&S.turn===turn&&r.state.id===id&&r.state.revision===S.revision)S.service=r.state.service;if(r.config)C=r.config;const area=$('#monthly-development-story');if(area)area.innerHTML=developmentPanel();}catch(e){toast('发展续报暂未备妥：'+e.message);}finally{developmentBusy=false;}
}
async function remindPlanning(){
 if(reminderBusy||!S||(S.planning||[]).every(p=>p.status!=='deferred'||p.deadline>gameMonth()||p.lastRemindedDeadline===p.deadline))return;
 reminderBusy=true;const id=S.id;
 try{const r=await api('planning-remind',{offline:!C.enabled||!C.hasKey});if(S.id!==id||r.state.id!==id)return;if(r.state.revision===S.revision){for(const k of ['planning','planningReminders'])S[k]=r.state[k];}if(r.config)C=r.config;if(dueMemos().length)toast('规划已到复议期，请查看规划备忘。');}
 catch(e){toast('规划到期提醒：'+e.message+'，可在备忘录中手动复议。');}
 finally{reminderBusy=false;if(S.id===id){if(view==='planning'||view==='court')render();const area=$('#monthly-plan-reminder');if(area)area.innerHTML=reminderPanel();}}
}
function memoCard(p){
 const due=p.status==='deferred'&&p.deadline<=gameMonth(),linked=(p.linkedProjects||[]).map(id=>S.projects.find(q=>q.id===id)?.name).filter(Boolean);
 return `<article class="panel memo-card ${due?'memo-due':''}"><div class="panel-head"><span class="badge">${due?'到期 · 待复议':memoStatuses[p.status]}</span><small>${p.estimated?'默认复议期':'目标期限'} · ${planDate(p.deadline)}</small></div><h3>${esc(p.title)}</h3>${p.body?`<p>${esc(p.body)}</p>`:''}<p class="muted">暂缓原因：${esc(p.reason)}</p>${p.requirements.length?`<ul class="memo-conditions">${p.requirements.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${linked.length?`<p class="muted">已关联在办事务：${esc(linked.join('、'))}</p>`:p.status==='started'?'<p class="muted">相关旨意已办理，整体目标是否完成仍需核验。</p>':''}<small class="muted">${p.source?'来自御前议事':'手动记录'} · ${planDate(p.createdAt)}</small><div class="memo-actions"><button class="outline" data-memo-edit="${p.id}" ${busy?'disabled':''}>编辑 / 调整期限</button>${['deferred','started'].includes(p.status)?`<button class="gold-button" data-memo-review="${p.id}" ${busy?'disabled':''}>与 AI 复议 →</button><button class="text-button" data-memo-status="done" data-memo-id="${p.id}" ${busy?'disabled':''}>标记完成</button><button class="text-button" data-memo-status="cancelled" data-memo-id="${p.id}" ${busy?'disabled':''}>搁置</button>`:`<button class="outline" data-memo-status="deferred" data-memo-id="${p.id}" ${busy?'disabled':''}>恢复待实施</button>`}</div></article>`;
}
function planningView(){
 const rows=S.planning||[],active=rows.filter(p=>['deferred','started'].includes(p.status)),archived=rows.filter(p=>!['deferred','started'].includes(p.status));
 return sectionTitle('志 在 长 远，事 有 缓 急','规划备忘',`<button class="gold-button" data-op="memo-new" ${busy?'disabled':''}>记一项目标 ＋</button><button class="text-button gold" data-op="planning-restore">补录已议定规划</button>`)+`<p class="muted intro">与 AI 议定但暂不能实施的目标会收录于此，按游戏年月到期提醒。未明确期限时，默认在短期 3 个月、中期 12 个月、长期 36 个月后复议，可自行调整。记录、编辑及标记状态不会花钱或颁令。</p>${reminderPanel()}${reminderBusy?'<p class="notice" role="status">AI 正在核验到期目标的实施条件…</p>':''}${Object.entries(horizons).map(([h,label])=>`<section class="memo-group"><div class="panel-head"><h2>${label}目标</h2><span class="badge">${active.filter(p=>p.horizon===h).length} 项</span></div><div class="memo-grid">${active.filter(p=>p.horizon===h).sort((a,b)=>a.deadline-b.deadline).map(memoCard).join('')||empty('尚无'+label+'待办目标。')}</div></section>`).join('')}${archived.length?`<details class="memo-archive"><summary>已完成 / 已搁置 · ${archived.length} 项</summary><div class="memo-grid">${archived.map(memoCard).join('')}</div></details>`:''}`;
}
function showMemoForm(id){
 const p=(S.planning||[]).find(p=>p.id===id),deadline=p?.deadline??gameMonth()+3;
 open(p?'编辑规划备忘':'记下规划目标',`<form id="memo-form"><input id="memo-id" type="hidden" value="${p?.id||''}"><label for="memo-title">目标</label><input id="memo-title" required minlength="2" maxlength="90" value="${esc(p?.title||'')}" placeholder="例如：待粮储充足后修复陕西灌溉"><label for="memo-horizon">规划阶段</label><select id="memo-horizon">${Object.entries(horizons).map(([h,n])=>`<option value="${h}" ${(p?.horizon||'short')===h?'selected':''}>${n}</option>`).join('')}</select><div class="memo-date"><label for="memo-year">复议年份<input id="memo-year" type="number" required min="1628" max="3000" value="${Math.floor(deadline/12)}"></label><label for="memo-month">月份<input id="memo-month" type="number" required min="1" max="12" value="${deadline%12+1}"></label></div><label for="memo-body">实施范围</label><textarea id="memo-body" rows="3" maxlength="800">${esc(p?.body||'')}</textarea><label for="memo-reason">暂缓原因</label><input id="memo-reason" maxlength="320" value="${esc(p?.reason||'')}" placeholder="钱粮、人手或前置条件尚未落实"><label for="memo-conditions">落实条件（每行一项，最多六项）</label><textarea id="memo-conditions" rows="3" maxlength="800">${esc(p?.requirements.join('\n')||'')}</textarea><div class="modal-buttons"><button class="outline" type="button" data-op="close">取消</button><button class="primary" type="submit">保存备忘</button></div></form>`);
}
async function submitMemo(){
 const memo={id:$('#memo-id').value||undefined,title:$('#memo-title').value.trim(),horizon:$('#memo-horizon').value,dueYear:Number($('#memo-year').value),dueMonth:Number($('#memo-month').value),body:$('#memo-body').value.trim(),reason:$('#memo-reason').value.trim(),requirements:$('#memo-conditions').value};
 if(await change('planning-save',{gameId:S.id,memo},'规划备忘已保存'))void remindPlanning();
}
async function reviewMemo(id){
 const p=(S.planning||[]).find(p=>p.id===id);if(!p)return;counselTarget='council';clearCounselEdit();
 await sendCounsel('请复议规划备忘“'+p.title+'”（编号 '+p.id+'，目标期限 '+planDate(p.deadline)+'）。范围：'+p.body+'；此前暂缓原因：'+p.reason+'；落实条件：'+p.requirements.join('、')+'。请按如今钱粮、人才和在办事项核验，若已可实施，请提出我能直接照办的具体方案；若仍不能实施，请指出缺口。本次先商议，不要擅自延期。','discuss',null,{planRef:id});
}
function annualArchive(){return `<section class="panel annual-archive"><div class="panel-head"><h2>年度总结</h2><span class="badge">${S.annualReports?.length||0} 份</span></div><p class="muted">每年十二月结算后自动归档，包含收支、国势、疆域、任事与未竟目标。旧存档从本次更新时的月份起记。</p><div class="memo-actions">${(S.annualReports||[]).map(r=>`<button class="outline" data-annual-report="${r.year}">${r.year}年${r.complete?'':' · '+r.startMonth+'月起'}</button>`).join('')||'<span class="muted">本年尚未结束。</span>'}</div></section>`;}
function annualReportHTML(r){
 const delta=k=>r.closing.stats[k]-r.opening.stats[k],added=r.closing.territories.filter(p=>!r.opening.territories.some(o=>o.id===p.id)),discovered=r.closing.places.filter(id=>!r.opening.places.includes(id)),agencies=r.closing.agencies.filter(n=>!r.opening.agencies.includes(n));
 return `<section class="annual-report"><div class="panel-head"><h3>${r.year}年 · 岁终奏报</h3><span class="badge">${r.complete?'全年记录':r.startMonth+'月至十二月 · 部分年度'}</span></div><p>${r.closing.stats.stability>r.opening.stats.stability?'民心有所回升':'民心仍需留意'}，${delta('frontier')<0?'边患较期初缓和':'边防仍须筹备'}。期末国库 ${num(r.closing.stats.money)} 万两，官仓 ${num(r.closing.stats.grain)} 万石。</p><div class="annual-flows"><span>月度税入累计 <b>${num(r.revenue)} 万两</b></span><span>月度支出累计 <b>${num(r.expenses)} 万两</b></span><span>入仓 / 粮耗累计 <b>${num(r.harvest)} / ${num(r.grainUse)} 万石</b></span></div><p class="muted">以上为 ${r.months} 次月结的收支；下表净变化还包括颁令、事件和竣工的即时增减。</p><div class="annual-table"><table><thead><tr><th>国势</th><th>期初</th><th>期末</th><th>净变化</th></tr></thead><tbody>${Object.entries(cat.meta).map(([k,[label]])=>`<tr><td>${label}</td><td>${num(r.opening.stats[k])}</td><td>${num(r.closing.stats[k])}</td><td>${signed(delta(k))}</td></tr>`).join('')}</tbody></table></div><p>实控地区 ${r.opening.territories.length} → ${r.closing.territories.length} 区${added.length?'，新纳 '+esc(added.map(p=>p.name).join('、')):''}；新发现 ${discovered.length} 处${agencies.length?'；新设 '+esc(agencies.join('、')):''}。</p><details><summary>岁末在任与差遣 · ${r.closing.people.length} 人</summary>${r.closing.people.map(o=>`<p>${esc(o.name)} · ${esc(o.posts.join('、'))}</p>`).join('')||'<p class="muted">暂无专任。</p>'}</details><details><summary>本期要事 · ${Object.values(r.counts).reduce((a,b)=>a+b,0)} 条（摘录最近 ${r.events.length} 条）</summary>${r.events.map(e=>`<p><strong>${esc(e.date)} · ${esc(e.title)}</strong><br>${esc(e.text)}</p>`).join('')}</details><h3>未竟事务与来年目标</h3>${r.pendingProjects.map(p=>`<p>在办 · ${esc(p.name)}，尚需 ${p.remaining} 月。</p>`).join('')}${r.pendingPlans.map(p=>`<p>${horizons[p.horizon]} · ${esc(p.title)}，${planDate(p.deadline)}复议，${memoStatuses[p.status]}。</p>`).join('')}${!r.pendingProjects.length&&!r.pendingPlans.length?'<p class="muted">暂无在册未竟目标。</p>':''}</section>`;
}
async function api(route,data){
 let res;try{res=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':T},body:JSON.stringify(data||{}),signal:AbortSignal.timeout(['counsel','planning-remind','development-story'].includes(route)?100000:20000)});}
 catch(e){throw Error(e.name==='TimeoutError'?'等待响应超时。请先刷新核对议事记录与办理结果，再决定是否重试。':'无法连接游戏服务，请检查游戏是否仍在运行，然后刷新页面。');}
 const out=await res.json();if(!res.ok)throw Error(out.error||'请求失败');return out;
}
async function change(route,data,message){
 if(busy)return;busy=true;document.body.classList.add('working');
 try{const r=await api(route,data);if(r.state){if(r.state.id!==S.id){mapView=null;mapScope='home';landingTab='brief';mapMode='unrest';}S=r.state;F=r.forecast;A=r.administration;if(r.equipment)cat.equipment=r.equipment;if(r.officials)cat.officials=r.officials;if(r.offices)cat.offices=r.offices;if(r.counselTargets)cat.counselTargets=r.counselTargets;}if(r.config)C=r.config;close();render();if(message)toast(message);return r;}
 catch(e){toast(e.message);return null;}
 finally{busy=false;document.body.classList.remove('working');if(view==='counsel'){render();scrollCounsel(true);}}
}
function open(title,html,wide=false){
 const d=$('#modal');d.className=wide?'wide':'';
 d.innerHTML=`<div class="modal-top"><div class="eyebrow">御 案</div><button class="icon-button" data-op="close" aria-label="关闭">×</button></div><h2>${esc(title)}</h2>${html}`;
 if(!d.open)d.showModal();
}
function close(){if($('#modal').open)$('#modal').close();}
function meter(value,className=''){return `<div class="meter ${className}"><span style="width:${Math.min(100,Math.max(0,value))}%"></span></div>`;}
function empty(text){return `<div class="empty">${text}</div>`;}
function sectionTitle(k,title,extra=''){return `<div class="section-title"><div><span class="eyebrow">${k}</span><h2>${title}</h2></div>${extra}</div>`;}
function stat(k,label,unit,desc){
 const value=S[k], bad=(['corruption','frontier'].includes(k)?value>65:['stability','army'].includes(k)?value<45:['grain','money'].includes(k)?value<80:false);
 const delta=S.monthlyResults.find(r=>r.key===k)?.value;
 return `<div class="stat"><div class="stat-label">${label}<span>${unit}</span></div><div class="stat-number ${bad?'danger':''}">${num(value)}<small>${delta? signed(delta):'—'}</small></div><div class="stat-desc">${desc}</div></div>`;
}

function pageTabs(group,active,items){return '<div class="page-tabs" role="group" aria-label="页面内容">'+Object.entries(items).map(([id,label])=>'<button class="'+(active===id?'selected':'')+'" data-page-tab="'+group+'" data-tab="'+id+'" aria-pressed="'+(active===id)+'">'+label+'</button>').join('')+'</div>';}
function institutionsView(){
 const tabs=pageTabs('institution',institutionTab,{offices:'各署政务',people:'人才与任职',tasks:'在办事务',actions:'常用施政',system:'中枢制度'});
 const content=institutionTab==='people'?officials()+'<details class="panel folded-panel"><summary>招安与人才线索</summary>'+talentPanel()+'</details>':institutionTab==='tasks'?dutyDesk():institutionTab==='actions'?sectionTitle('便 捷 施 政','按需要选择一项政务')+'<p class="muted">也可在御前议事直接交代目标、地区和负责人。</p><div class="action-grid">'+actionCards()+'</div>':institutionTab==='system'?governmentSettings():institutionBoard();
 return tabs+content;
}
function governmentSettings(){return '<section class="panel government-panel"><div class="panel-head"><h2>'+esc(A.name)+'</h2><button class="gold-button" data-op="create-agency">拟设新机构 ＋</button></div><div class="government-summary"><span>御案负担 <b>'+num(A.burden)+'</b></span><span>制度交接 <b>'+A.transition+' 月</b></span><span>机构开支 <b>'+(F.agencyExpenses||0)+' 万两 / 月</b></span></div><p>'+esc(A.cabinet?'内阁承担中枢协调。可在御前议事拟定废阁、恢复或另设机构的方案。':A.coordinated?A.name+'承接中枢协调。':'六部直奏御前，缺少协调会积累御案负担。')+'</p><p class="muted">各署的经费、改组和裁撤在“各署政务”卡片内处理。统筹中枢须筹备完成、负责人到任、月拨至少 6 万两并获足额拨款。</p><button class="outline" data-order-draft="请评议当前中枢制度的困难，并提出机构调整方案，本次先商议。">与群臣议改制 →</button></section>';}
function militaryView(){return borderPanel()+pageTabs('military',militaryTab,{battle:'战况与军令',equipment:'军械与补给'})+(militaryTab==='equipment'?armory(S,cat):'<div class="military-intro"><p class="muted">战役在这里统筹，军队位置与敌情在主舆图的“军情”图层查看。</p><button class="outline" data-open-map="military">在舆图查看军情 ↗</button></div>'+campaignPanel(S,cat));}
function archiveView(){return pageTabs('archive',archiveTab,{history:'起居注',annual:'历年总结',innovation:'新政成果'})+(archiveTab==='annual'?(annualArchive()||empty('年度总结会在十二月月结后归档。')):archiveTab==='innovation'?innovation():chronicle());}
function routeTo(target){
 if(target==='officials'){view='institutions';institutionTab='people';}
 else if(target==='duties'){view='institutions';institutionTab='tasks';}
 else if(target==='affairs'){view='institutions';institutionTab='actions';}
 else if(target==='innovation'){view='chronicle';archiveTab='innovation';}
 else if(target==='world'){view='court';landingTab='voyages';mapMode='routes';mapScope='known';mapView=null;}
 else if(primaryNav.includes(target))view=target;
}
function currentMapBounds(){return mapView||mapBounds(S,cat,mapScope);}
function mapOptions(){return {layer:mapMode,selected,bounds:currentMapBounds()};}
function mapRegionDetail(id){
 const region=cat.regions.find(r=>r.id===id);if(!region)return;
 const p=S.provinces.find(p=>p.id===(region.home?region.id:'occupied-'+region.id));
 if(p){selected=p.id;render();const detail=territoryDetail(S,cat,id);open(detail.title,detail.html);}
 else {const enemy=S.campaignState.enemies.find(e=>e.region===id),battle=S.campaignState.battles.find(b=>b.status==='active'&&b.target===id);open(region.name+' · 已知情报','<p>当前尚未实控。</p>'+(enemy?'<p>守军：'+esc(enemy.name)+' · '+esc(enemy.commander)+' · 战力 '+Math.round(enemy.strength)+'</p>':'')+'<div class="modal-buttons">'+(battle?'<button class="outline" data-nav="armory">查看进行中的战役</button>':'<button class="outline" data-front-form="war-attack" data-target="'+region.id+'">部署出征</button>')+'</div>');}
}
function mapPlaceDetail(id){
 const p=cat.places.find(p=>p.id===id),discovery=S.atlas.discoveries[id];if(!p||!discovery)return;
 const country=S.countries.find(c=>c.id===p.country),regions=cat.regions.filter(r=>!r.home&&r.place===id);
 open(p.name+' · 见闻与往来','<p class="muted">'+(discovery.visited?'船队已实地抵达。':discovery.source==='chart'?'旧有海图记载，尚未实勘。':'已获遥感情报，尚未实勘。')+'</p>'+(country?'<p>'+esc(country.name)+' · 关系 '+country.relation+'</p><div class="front-actions"><button class="outline" data-country="'+country.id+'" data-kind="envoy">遣使</button><button class="outline" data-country="'+country.id+'" data-kind="trade" '+(country.relation<0?'disabled':'')+'>通商</button></div>':'')+regions.map(r=>'<button class="outline" data-map-region="'+r.id+'">'+esc(r.name)+' · 政务 / 情报</button>').join(''));
}
let mapGesture=null;
function updateMapCamera(){const canvas=$('[data-map-canvas]');if(canvas&&mapView)canvas.setAttribute('viewBox',mapView.join(' '));}
document.addEventListener('wheel',e=>{if(!e.target.closest?.('[data-map-canvas]'))return;e.preventDefault();mapView=moveMap(currentMapBounds(),e.deltaY<0?'in':'out');mapScope='manual';updateMapCamera();},{passive:false});
document.addEventListener('pointerdown',e=>{if(e.button!==0)return;const canvas=e.target.closest?.('[data-map-canvas]');if(!canvas)return;const rect=canvas.getBoundingClientRect(),bounds=currentMapBounds(),scale=Math.min(rect.width/bounds[2],rect.height/bounds[3]);mapGesture={x:e.clientX,y:e.clientY,bounds:[...bounds],scale,moved:false};});
document.addEventListener('pointermove',e=>{if(!mapGesture)return;const dx=e.clientX-mapGesture.x,dy=e.clientY-mapGesture.y;if(Math.hypot(dx,dy)<5&&!mapGesture.moved)return;mapGesture.moved=true;mapScope='manual';const [x,y,w,h]=mapGesture.bounds;mapView=[Math.max(0,Math.min(1080-w,x-dx/mapGesture.scale)),Math.max(0,Math.min(525-h,y-dy/mapGesture.scale)),w,h];updateMapCamera();});
document.addEventListener('pointerup',()=>{if(mapGesture?.moved)setTimeout(()=>{mapGesture=null;},0);else mapGesture=null;});
document.addEventListener('pointercancel',()=>{mapGesture=null;});

function render(){
 if(!S)return;if(!primaryNav.includes(view))routeTo(view);if(!S.provinces.some(p=>p.id===selected))selected='shaanxi';
 const nav=primaryNav;
 $('#app').innerHTML=`<aside class="sidebar">
 <a class="brand" href="#" aria-label="天命崇祯首页" data-nav="court"><span class="seal">天命</span><span>崇祯<small>山河待你重整</small></span></a>
 <div class="sidebar-caption">御前议政</div><nav>${nav.map(k=>`<button class="nav-item ${view===k?'active':''}" data-nav="${k}"><span class="nav-symbol">${icons[k]}</span>${names[k]}${k==='court'&&S.event?'<i class="dot"></i>':''}</button>`).join('')}</nav>
 <div class="sidebar-bottom"><div class="reign-label">大明 · 北京</div><div class="reign">${S.traveler.enabled?'穿越者模式':S.mode==='sandbox'?'自由推演':'危局求生'}</div><p>每一道诏令，<br>都在改写山河。</p><button data-op="guide" class="text-button">玩法与史实说明 ↗</button></div>
 <div class="sidebar-foot">天命 · 崇祯 <span>本地版 1.1</span></div></aside>
 <main><header class="topbar"><div class="breadcrumb">大明中枢 <span>/</span> ${names[view]}</div><div class="top-actions"><button class="engine-status" data-op="counsel"><i class="status-dot ${C.enabled&&C.hasKey?'online':''}"></i>${C.enabled&&C.hasKey?'DeepSeek · 御前议事':'御前议事 · 离线'}</button><button data-op="saves" class="top-button">存档</button><button data-op="settings" class="top-button">AI 设置</button></div></header>
 <div class="main-inner"><section class="page-heading"><div><div class="eyebrow">CHONGZHEN · AN ALTERNATE HISTORY</div><h1>${view==='court'?'山河犹在，天命未定':names[view]}</h1><p>${view==='court'?'风雨已至。此后的十七年，不必只有一种结局。':'立政于当下，观其变于岁月。'}</p></div><div class="calendar"><span>${date()}</span><small>公元 ${S.year} 年 · 第 ${S.turn+1} 回合</small></div></section>
 <section class="stats ${view==='court'?'':'stats-compact'}">${stat('money','国库白银','万两','月度预计 '+signed(F.net)+' 万两')}${stat('grain','官仓存粮','万石','本月粮耗 '+F.grainUse+' 万石')}${stat('stability','天下民心','/ 100',S.stability<45?'民生多艰，需安抚流民':'民心渐定，仍需休养')}${stat('army','军备军心','/ 100','军费倍率 ×'+S.military)}${stat('corruption','吏治贪腐','/ 100','越低越好 · 影响征税效率')}${stat('frontier','边关压力','/ 100',F.border?'日常预计 '+signed(F.border.net)+' / 月':'越低越好 · 关宁与蓟镇')}</section>
 ${S.ended?`<div class="ending"><strong>${esc(S.ended.title)}</strong><p>${esc(S.ended.text)}</p><button class="primary" data-op="new">重启山河</button></div>`:''}
 <div class="content">${planningBanner()}${({court:overview,counsel:counselView,institutions:institutionsView,planning:planningView,treasury:treasury,chronicle:archiveView,armory:militaryView}[view])()}</div>
 <footer class="turn-bar"><div><span class="turn-marker">诏</span><span><strong>自由施政 · 不限次数</strong><small>${esc(A.name)} · 钱粮与工期约束 · 自动存档</small></span></div><div class="turn-right"><span>${S.event?'尚有紧急奏报待批':'暂无新急报，仍可施政'}</span><button class="primary advance" data-op="next" ${S.ended?'disabled':''}>推进下月 <span>→</span></button></div></footer>
 </div></main>`;
}
function overview(){
 const p=S.provinces.find(p=>p.id===selected),mean=Math.round(S.provinces.reduce((n,p)=>n+p.unrest,0)/S.provinces.length),bad=S.provinces.filter(p=>p.unrest>=60),tasks=S.projects.length+S.affairs.length;
 const selection='<div class="province-card unified-selection"><div><h3>'+esc(p.name)+'<span>'+esc(p.subtitle)+'</span></h3><div class="province-metrics"><span>动乱 <b>'+num(p.unrest)+'</b></span><span>旱情 <b>'+num(p.drought)+'</b></span><span>生产 <b>'+num(p.prosperity)+'</b></span></div></div><button class="outline" data-map-region="'+(p.territory||p.id)+'">地方政务 ↗</button></div>';
 const below=landingTab==='voyages'?voyagePanel(S,cat):landingTab==='diplomacy'?diplomacyView():'<section class="panel brief-panel"><div class="panel-head"><h2>正在推进</h2><button class="text-button gold" data-nav="duties">查看全部 '+tasks+' 件事务 →</button></div>'+S.projects.slice(0,4).map(p=>'<div class="brief-project"><strong>'+esc(p.name)+'</strong><small>尚需 '+p.remaining+' 月 · '+esc(leaderName(p.leader))+'</small><button class="text-button gold" data-duty-kind="project" data-duty-id="'+p.id+'">督办</button></div>').join('')+(tasks?'':'<p class="muted">暂无专项在办事务。可与群臣商议下一步。</p>')+'</section>';
 return '<div class="overview-grid unified-overview"><div>'+mountainMap(S,cat,worldLand,mapOptions())+selection+'</div><aside class="right-column"><section class="panel threat-panel"><div class="eyebrow">御 前 摘 要</div><h2>本月轻重缓急</h2><div class="threat-line"><span>各地平均动乱</span><b>'+mean+'</b></div>'+meter(mean,'red')+'<p>'+esc(bad.length?bad.map(p=>p.name).join('、')+'正处动荡，须留意饥民与军饷。':'各地尚稳，宜休养与筹办长远。')+'</p><div class="mini-stats"><div><span>皇权</span><b>'+num(S.legitimacy)+'</b></div><div><span>格物</span><b>'+num(S.tech)+'</b></div><div><span>海权</span><b>'+num(S.navy)+'</b></div></div></section>'+petitionCard()+'<section class="panel court-command"><span class="eyebrow">一 言 可 改 山 河</span><h3>下一道旨意</h3><p class="muted">问计、任人、定新法，都在御前议事。明确旨意直接办理。</p><button class="gold-button" data-counsel-open="council">下旨 / 商议 →</button><button class="text-button" data-op="counsel-advice">请群臣献策</button><button class="text-button" data-nav="affairs">常用施政 ↗</button></section></aside></div>'+pageTabs('landing',landingTab,{brief:'本月要事',voyages:'探航船队',diplomacy:'外交往来'})+below;
}

function petitionCard(){
 if(!S.event)return `<section class="panel petition cleared"><span class="eyebrow">本 月 奏 报</span><h3>本月暂无新奏报</h3><p>本月暂无新的待批奏报。可继续施政、查看在办事项，或推进下月。</p><span class="badge">按实际局势递报</span></section>`;
 const e=S.event;
 return `<section class="panel petition"><div class="petition-meta"><span><i class="dot"></i> 紧急奏报</span><small>${esc(e.category)}</small></div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p><button class="text-button gold" data-op="petition">展开奏本，御前批复 <span>→</span></button></section>`;
}
function actionCards(filter){
 return cat.actions.filter(a=>(!a.requires||S.unlocks[a.requires])&&(!filter||a.target)).map(a=>`<article class="action-card"><div class="action-category">${a.group}${a.project?`<span>历时 ${a.project.months} 月</span>`:''}</div><h3>${a.name}</h3><p>${a.desc}</p><div class="action-footer"><small>${costText(a.cost)}</small><button class="outline" data-action="${a.id}" ${!canPay(a.cost)||S.ended?'disabled':''}>施行 ↗</button></div></article>`).join('');
}
function officials(){return `${sectionTitle('知 人 善 任','中枢专任，各尽其才',`<span class="badge">在任 ${S.officials.length} 人</span>`)}<p class="muted intro">起用与解除各不限制月内次数；首次起用才筹措班底；已任职或曾起用者兼任、复任不重复收费，月俸另计。此处是各部专任差遣的游戏抽象，并非内阁名单；废阁不会自动罢免将领或撤销六部。各部署理主官已在机构页列明。人才库会随属员荐举、访贤和招安扩充，观察期内可试用；人物可另外主持多个机构及事务；超过两项差遣，精力将分摊。</p><div class="official-grid">${cat.officials.filter(o=>!o.incumbent||S.officials.includes(o.id)).map(o=>{const active=S.officials.includes(o.id);return `<article class="panel official-card"><div class="official-head"><div class="portrait ${active?'appointed':''}">${o.portrait}</div><div><span class="eyebrow">${o.role}</span><h2>${esc(o.name)} <small class="post-tag" title="${esc((o.currentPosts||[]).join("、"))}">${esc(o.positionLabel||"未委任朝职")}</small></h2></div>${active?'<span class="badge">在任</span>':''}</div><p>${o.bio}</p><div class="official-skill">${o.skill}<small class="official-load">当前 ${o.workload||0} 项差遣 · 精力 ${Math.round((o.workloadFactor||1)*100)}% · 履约支持 ${Math.round((o.compensation??1)*100)}%</small></div><div class="action-footer"><small>起用 ${o.hireCost??o.cost} 万两 · 在职俸禄 ${o.monthlyPay||0} 万两 / 月</small><button class="${active?'outline':'gold-button'}" data-appoint="${o.id}" data-dismiss="${active}" ${S.ended||!active&&(S.money<(o.hireCost??o.cost))?'disabled':''}>${active?'解除职务':'诏令起用'}</button></div></article>`;}).join('')}</div>
 <section class="panel faction-panel">${sectionTitle('众 意 难 齐','朝堂与地方的支持')}<div class="faction-grid">${Object.entries(S.factions).map(([k,v])=>`<div><div class="threat-line"><span>${({gentry:'地方士绅',scholar:'清议文官',army:'军中将领',merchant:'商人群体'}[k])}</span><b>${num(v)}</b></div>${meter(v)}<small>${v<25?'抵制正在影响朝政':v>65?'愿意支持朝廷政策':'态度谨慎，仍需争取'}</small></div>`).join('')}</div></section>`;}

const fiscalLabels={administrationBase:'朝廷日常开支',militaryBase:'基础军费',salaryMultiplier:'中枢专任月俸倍率',officeFee:'常设主官每职月费',agencyFee:'新署主官每职月费',dutyFee:'专人督办每事差旅',governorFee:'地方主官每职月费',commanderFee:'部队统帅每职月费'};
function fiscalPanel(){
 const rates=S.fiscal?.rates||F.fiscalRates||{},people=cat.officials;
 return '<details class="panel folded-panel fiscal-settings"><summary>薪俸与常设经费</summary><p class="muted">以下为本局现行标准，金额均为万两 / 月，倍率除外。新例影响之后月结；不追溯改写旧账。个人约定优先于职位标准，兼任按总额分摊，未任职不支薪。督办差旅、部众军粮和机构业务预算另列。费用标准是拨款意愿，不能抹去实际工作需求；低于常例的薪俸会逐月降低任职支持度，足额支付后逐月恢复。</p><p>当前朝廷常务需求 '+Number((F.baseAdministrationNeed??25).toFixed(2))+' 万两，预计落实 '+Math.round((F.administrationCoverage??1)*100)+'%；基础军费需求 '+Number((F.baseMilitaryNeed??24).toFixed(2))+' 万两，预计落实 '+Math.round((F.militaryCoverage??1)*100)+'%。需求随政务规模、制度与工矿积累变化；削减账面标准不会消除实际需求。</p><p>目前在职俸禄合计 <strong class="gold">'+Number((F.salaryTotal||0).toFixed(4))+' 万两 / 月</strong></p><form id="fiscal-rates-form"><div class="fiscal-rate-grid">'+Object.entries(fiscalLabels).map(([id,label])=>'<label>'+label+'<input data-fiscal-rate="'+id+'" type="number" min="0" max="'+(id==='salaryMultiplier'?5:1000)+'" step="0.01" required value="'+(rates[id]??0)+'"></label>').join('')+'</div><button class="gold-button" type="submit">颁行费用标准</button></form><hr><form id="fiscal-salary-form"><label for="fiscal-official">个人月俸约定</label><select id="fiscal-official">'+people.map(o=>'<option value="'+o.id+'">'+esc(o.displayName||o.name)+' · 当前 '+(o.monthlyPay||0)+' 万两/月</option>').join('')+'</select><label for="fiscal-monthly">在职月俸总额 · 万两</label><input id="fiscal-monthly" type="number" min="0" max="1000" step="0.01" required value="'+(S.fiscal?.salaries?.[people[0]?.id]??people[0]?.monthlyPay??0)+'"><div class="front-actions"><button class="gold-button" type="submit">颁行个人月俸</button><button class="outline" type="button" data-op="fiscal-salary-reset">恢复职务标准</button></div></form><small class="muted">一次性起用费与每月俸禄分别计算。也可在议事中直接说“官员俸禄减半”或“将毕自严月俸定为一万两”。</small></details>';
}
async function submitFiscalRates(){const values=Object.fromEntries(Array.from(document.querySelectorAll('[data-fiscal-rate]')).map(el=>[el.dataset.fiscalRate,Number(el.value)]));await change('fiscal',{command:{scope:'rates',values}},'费用标准已颁行，之后月结按新例结算');}
async function submitSalary(reset=false){const value=$('#fiscal-monthly').value;if(!reset&&!value.trim()){toast('请填写月俸总额');return;}await change('fiscal',{command:{scope:'person',official:$('#fiscal-official').value,monthly:reset?null:Number(value)}},'个人月俸约定已更新');}

function treasuryBase(){
 return `${sectionTitle('量 入 为 出','九边要饷，天下要粮')}<div class="finance-grid"><section class="panel"><div class="panel-head"><h2>本月收支预估</h2><span class="badge">万两 / 月</span></div><div class="finance-total"><span>结余预计</span><strong class="${F.net<0?'danger':'gold'}">${signed(F.net)}</strong></div><div class="ledger-line"><span>税入合计 · 含海关月解</span><b class="gold">+${F.revenue}</b></div><div class="ledger-line"><span>朝廷、军费、班底与机构</span><b>−${F.expenses}</b></div><div class="ledger-line"><span>军民官粮消耗</span><b>${F.grainUse} 万石</b></div><div class="ledger-line"><span>本月夏秋粮入仓</span><b>${F.harvest||'—'}</b></div><p class="muted">其中督办差旅 ${F.dutyExpenses||0} 万两；机构经费与管理支出 ${F.agencyExpenses||0} 万两；招安安置军饷 ${F.talentExpenses||0} 万两，口粮 ${F.talentGrain||0} 万石。税入也受中枢协调、机构职权与征税效率影响。六月、九月收粮；没有银粮时会发生欠饷、军心或民心损失。</p>${S.ledger?`<div class="last-ledger">上次结算 · ${esc(S.ledger.date)}<br>入 ${S.ledger.revenue} / 出 ${S.ledger.expenses} / 净 ${signed(S.ledger.net)}</div>`:''}</section>
 <section class="panel policy-panel"><div class="eyebrow">钱 粮 国 策</div><h2>取之于民，须有节度</h2><p class="muted">调整国策不限制月内次数；月结时执行。提高税额会积累地方动乱，提高军费会消耗更多钱粮。</p><label for="tax">征税强度</label><select id="tax">${[[.8,'减赋养民 ×0.8'],[1,'维持常额 ×1.0'],[1.2,'适度加征 ×1.2'],[1.4,'战时重征 ×1.4']].map(([v,n])=>`<option value="${v}" ${S.tax===v?'selected':''}>${n}</option>`).join('')}</select><label for="military">军费拨付</label><select id="military">${[[.8,'节用紧缩 ×0.8'],[1,'维持现额 ×1.0'],[1.25,'加强边备 ×1.25']].map(([v,n])=>`<option value="${v}" ${S.military===v?'selected':''}>${n}</option>`).join('')}</select><button class="gold-button" data-op="policy" ${S.ended?'disabled':''}>颁行钱粮国策</button><div class="reform-status">赋役改革：${S.reformed?'试点已成，税收效率提高 18%':'尚待试点'}</div></section></div>`;
}
function economicIncomePanel(){
 const sources=F.economicSources||[],last=S.ledger?.economicSources||[];if(!sources.length&&!last.length)return '';
 return '<section class="panel economic-income"><div class="panel-head"><h2>持续税源与月解明细</h2><span class="badge">万两 / 月</span></div><p>常规税入 '+F.ordinaryRevenue+' ＋ 海关实解 '+F.customsRevenue+' ＝ 本月税入 '+F.revenue+' 万两</p><p class="muted">以下海关收入已经包含在上方总税入中，随月结解入国库。验收之后开征；后续销案不会注销税关。</p>'+sources.map(r=>'<details class="economic-source" open><summary>'+esc(r.port)+' · '+esc(r.status)+' · 预计解部 '+r.revenue+' 万两</summary><p>'+esc(r.name)+'；已实地通达且可通商节点 '+r.knownMarkets+' 处。</p><small>分档抽分 '+Math.round(r.lowRate*100)+'% / '+Math.round(r.highRate*100)+'%'+(r.firstTradeDiscount<1?' · 首市折扣 '+r.firstTradeDiscount*100+'%':'')+'。'+(r.profitBase?'估算可税商利 '+r.profitBase+' 万两，应征 '+r.assessedTax+' 万两，征解到账 '+r.revenue+' 万两。':'当前尚无实际税入。')+'</small></details>').join('')+(last.length?'<div class="last-ledger">上期海关已解部：'+last.map(r=>esc(r.port)+' '+r.revenue+' 万两').join('；')+'。已计入上期总税入 '+S.ledger.revenue+' 万两。</div>':'')+'<p class="muted">商利与征解为游戏估算，随实测商路、海权、港口繁荣、动乱、商人支持和贪腐变化；高税率也会压低守法贸易意愿。</p></section>';
}
function monthlyBillPanel(){
 const rows=F.entries||[],last=S.ledger?.entries||[],value=v=>Number((v||0).toFixed(4)),table=(a,actual)=>'<div class="monthly-table"><table><thead><tr><th>项目</th><th>应拨银 / 粮</th>'+(actual?'<th>实拨银 / 粮</th><th>状态</th>':'')+'</tr></thead><tbody>'+a.filter(r=>r.money||r.grain||r.paused).map(r=>'<tr><td>'+esc(r.name)+(r.funding==='portal'?' · 外部供给':'')+'</td><td>'+value(r.money)+' / '+value(r.grain)+'</td>'+(actual?'<td>'+value(r.actualMoney)+' / '+value(r.actualGrain)+'</td><td>'+(r.paid?'已核拨':r.paused?'停拨 / 到期':'欠拨 · 工作暂停')+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';
 return '<details class="panel monthly-bill"><summary>月度拨款清单 · 预计银 '+F.expenses+' 万两 / 粮 '+F.grainUse+' 万石</summary><p class="muted">这份清单直接用于月结。机构额外增收和额外收粮在月底验收后入账，不预支尚未生效的产出。先保障基本军民供给，再按清单顺序核拨；月拨供给不足则暂停该项工作及月度成果；已付工程款的基础施工保留，欠督办差旅只停额外加速。外部供给单列。</p>'+(F.monthlyWork||[]).map(q=>'<p class="muted">'+esc(q.name)+' · 月拨工作量 '+Number((q.ratio*100).toFixed(3))+'%，需求银 '+q.requiredMoney+' 万两、粮 '+q.requiredGrain+' 万石；超出原议规模不额外加成。</p>').join('')+table(rows,false)+(last.length?'<h3>上次月结 · '+esc(S.ledger.date)+'</h3>'+table(last,true)+'<p>国库期初 '+value(S.ledger.openingMoney)+' ＋ 税入 '+S.ledger.revenue+' − 实际支出 '+S.ledger.expenses+' ＋ 竣工等变化 '+value(S.ledger.adjustments?.money)+' ＝ 期末 '+value(S.ledger.endingMoney)+' 万两</p>':'')+'</details>';
}
function borderPanel(){const b=F.border;if(!b)return '';return '<details class="panel border-monthly"><summary>边防压力 · 日常预计 '+signed(b.net)+' / 月</summary><p>'+esc(b.note)+'</p>'+b.items.map(i=>'<div class="ledger-line"><span>'+esc(i.name)+'</span><b class="'+(i.value>0?'danger':'gold')+'">'+signed(i.value)+'</b></div>').join('')+'<p class="muted">这是现有部署的日常预计，临时事件、结案与欠饷另计。'+(S.ledger?.frontierActual!==undefined?'上次月结实际变化 '+signed(S.ledger.frontierActual)+'。':'')+'</p></details>';}
function treasury(){return treasuryBase()+monthlyBillPanel()+economicIncomePanel()+fiscalPanel();}
function innovation(){
 return `${sectionTitle('成 法 由 此 而 新','让一道诏令，成为后世的起点',`<span class="badge">已成试点 ${S.institutions.length}</span>`)}<p class="muted intro">制度、工艺与研究不会随奏报翻篇而消失。完整的相关工程或自由诏令试点竣工通常积累 +12；缩减规模按实际比例积累；每满 20 点，长期效果增加一阶。朝臣只知陛下提出新法，不知这些想法从何而来。</p><div class="action-grid">${cat.domains.map(d=>`<article class="action-card"><div class="action-category">${d.name}<span>第 ${Math.floor(S.technology[d.id]/20)} 阶</span></div><h3>${num(S.technology[d.id])} <small class="muted">/ 100 点积累</small></h3>${meter(S.technology[d.id])}<p style="margin-top:14px">${d.desc}<br><small>可探索：${d.examples}</small></p></article>`).join('')}</div><section class="panel" style="margin-top:24px"><div class="panel-head"><h2>新法与工艺档案</h2><button class="outline" data-nav="court">继续拟诏 ↗</button></div>${S.institutions.length?S.institutions.map(x=>`<div class="ledger-line"><span>${esc(x.name)}<small style="display:block;color:var(--muted)">${esc(x.date)} · ${cat.domains.find(d=>d.id===x.domain)?.name}</small></span><span class="badge">已入国制</span></div>`).join(''):empty('尚无完成的长期试点。<br>你可以从农政、银行试点、公共卫生或火器标准开始。')}</section>`;
}
function chronicle(){return `${sectionTitle('帝 王 起 居 注','你的每一步，皆有回响',`<button class="outline" data-op="export">导出本局存档 ↗</button>`)}<div class="achievement-row">${S.achievements.length?S.achievements.map(n=>`<span class="achievement">◇ ${esc(n)}</span>`).join(''):'<span class="muted">尚无成就。安民、富国、强军与开海，皆有不同的中兴之路。</span>'}</div><section class="timeline">${S.history.map(x=>`<article class="timeline-entry"><div class="timeline-date">${esc(x.date)}<small>${esc(({event:'御批',policy:'施政',edict:'诏令',month:'月结',project:'竣工',personnel:'人事',unlock:'篇章',world:'外务',system:'国运'}[x.type])||'纪事')}</small></div><div class="timeline-body"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div></article>`).join('')}</section>`;}
function diplomacyView(){return `${sectionTitle('四 海 经 略',S.unlocks.global?'天下之外，尚有天下':'安内之后，再问四海',`<span class="badge">国际影响 ${num(S.influence)}</span>`)}<div class="world-banner"><div class="world-orbit">◎</div><div><h2>${S.unlocks.global?'万国棋局已开':'远洋之路，始于造船与补给'}</h2><p>${S.unlocks.global?'经营商路、建立关系、争取有利商约。威慑结果取决于双方实力；改变实控须部署出征。':'海权达到 35、格物达到 35 后，南亚、西亚与跨洋势力将进入棋局。'}</p></div></div><div class="country-grid">${S.countries.filter(c=>(!c.global||S.unlocks.global)&&cat.places.some(p=>p.country===c.id&&S.atlas.discoveries[p.id])).map(c=>`<article class="panel country-card"><div class="eyebrow">${c.area}</div><h2>${c.name}</h2><p>${c.text}</p><div class="country-metrics"><span>国力 <b>${c.power}</b></span><span>关系 <b class="${c.relation<0?'danger':'gold'}">${signed(c.relation)}</b></span></div><div class="diplomacy-actions"><button class="outline" data-country="${c.id}" data-kind="envoy" ${S.ended?'disabled':''}>遣使 · 22 银</button><button class="outline" data-country="${c.id}" data-kind="trade" ${c.relation<0||S.ended?'disabled':''}>派商队 · 28 银</button><button class="outline" data-country="${c.id}" data-kind="pressure" ${S.army<60||c.global&&S.navy<45||S.ended?'disabled':''}>威慑 · 40 银</button></div><small class="muted">遣使另耗粮4；商队启动粮8，两个月回航结算，在途不重复派出；经略粮18。</small></article>`).join('')}</div>`;}
function showPetition(petition=null){
 const e=petition?S.affairs.find(a=>a.id===petition)?.petition:S.event;if(!e)return;
 open(e.title,`<span class="badge">${e.category} · ${e.historical}</span><p class="modal-narrative">${esc(e.text)}</p>${dutyPicker(eventDomain(e),e.leader)}<div class="event-options">${e.options.map((o,i)=>`<button class="event-option" data-event="${i}" data-petition-id="${petition||''}" ${!canPay(o.cost)?'disabled':''}><strong>${esc(o.label)} <span>→</span></strong><small>${costText(o.cost)}${!canPay(o.cost)?' · 钱粮不足':''}</small><p>${effectText(o.effects)}${o.regional?'；地方'+effectText(o.regional):''}${o.factions?'；支持度 '+Object.entries(o.factions).map(([k,v])=>({gentry:'士绅',scholar:'文官',army:'军中',merchant:'商人'}[k])+signed(v)).join('，'):''}</p></button>`).join('')}</div>${!petition?'<button class="outline" data-event="-1">留中待议 · 暂不支出</button>':''}<button class="outline" data-review-petition="${petition||'current'}">自拟批复与预算 →</button><small class="muted">可按原案办理，也可自拟批复、调整费用或免费留中。原案专人善后另计差旅；自拟批复按本案批准的首拨和月拨核算，不追加默认差旅。</small>`);
}
let petitionEditing=null,petitionBudgetDraft=null;
function hasPetitionBudgetDraft(){const d=petitionBudgetDraft;if(!d||d.gameId!==S.id)return false;return d.eventId===(d.petition?S.affairs.find(a=>a.id===d.petition)?.petition?.id:S.event?.id);}
function showCustomPetition(petition=null){
 const e=petition?S.affairs.find(a=>a.id===petition)?.petition:S.event;if(!e)return;
 petitionEditing={petition,eventId:e.id,eventTurn:S.turn,gameId:S.id};
 open('自拟批复 · '+e.title,`<p class="modal-narrative">${esc(e.text)}</p><form id="petition-budget-form"><label for="petition-reference">处置依据</label><select id="petition-reference"><option value="">完全自拟，请群臣估算需求</option>${e.options.map((o,i)=>'<option value="'+i+'">参考方案 '+(i+1)+'：'+esc(o.label)+'</option>').join('')}</select><label for="petition-text">你的批复与办理范围</label><textarea id="petition-text" required maxlength="2000" rows="4" placeholder="例如：不作全省铺开，只先清点灾户，优先向最急的两个县发粮。余款待回报后再议。"></textarea><div class="recruitment-costs"><div><label for="petition-money">本次首拨上限 · 万两</label><input id="petition-money" type="number" min="0" max="1000" step="0.0001" required value="0"></div><div><label for="petition-grain">本次首拨上限 · 万石</label><input id="petition-grain" type="number" min="0" max="1000" step="0.0001" required value="0"></div></div><label class="toggle"><input id="petition-monthly" type="checkbox">另批准后续月拨</label><div id="petition-monthly-fields" hidden><div class="recruitment-costs"><div><label for="petition-monthly-money">每月上限 · 万两</label><input id="petition-monthly-money" type="number" min="0" max="1000" step="0.0001" value="0"></div><div><label for="petition-monthly-grain">每月上限 · 万石</label><input id="petition-monthly-grain" type="number" min="0" max="1000" step="0.0001" value="0"></div></div><label for="petition-duration">月拨期限 · 月（留空表示办理期间）</label><input id="petition-duration" type="number" min="1" max="120" step="1"><label for="petition-work">按完整需求估算的工期 · 月</label><input id="petition-work" type="number" min="2" max="12" value="2"><label class="toggle"><input id="petition-retain" type="checkbox">结案后保留确有需求的持续月拨</label></div>${dutyPicker(eventDomain(e),e.leader)}${S.traveler?.enabled?'<label for="petition-funding">物资来源</label><select id="petition-funding"><option value="treasury">国库与官仓</option><option value="portal">已开放的时空供给</option></select>':''}<p class="muted">填写的是你批准的上限；实际支用不超过需求。钱粮不足会缩小落实范围或延长工期，未批准的缺口不追扣。零预算也可批复，实物成果仍须有来源。先核算只作商议，可再决定是否照办。</p><div class="modal-buttons"><button class="outline" type="button" data-petition-discuss="true">先请群臣核算</button><button class="primary" type="submit">按此批复办理 →</button></div></form>`,true);
 const saved=hasPetitionBudgetDraft()&&petitionBudgetDraft.eventId===e.id&&petitionBudgetDraft.petition===petition?petitionBudgetDraft:null;
 if(saved){const b=saved.budget,values={'petition-text':saved.text,'petition-reference':saved.reference??'','petition-money':b.money,'petition-grain':b.grain,'petition-monthly-money':b.monthly?.money||0,'petition-monthly-grain':b.monthly?.grain||0,'petition-duration':b.months??'','petition-work':saved.workMonths||2,'duty-official':saved.official||'','petition-funding':saved.funding};for(const[id,value]of Object.entries(values)){const field=$('#'+id);if(field)field.value=value;}const monthly=$('#petition-monthly'),retain=$('#petition-retain'),details=$('#petition-monthly-fields');if(monthly)monthly.checked=!!b.monthly;if(retain)retain.checked=b.retain===true;if(details)details.hidden=!b.monthly;}
}
async function submitPetitionBudget(mode='auto'){
 if(busy)return;
 const form=$('#petition-budget-form');if(form?.reportValidity&&!form.reportValidity())return;
 const text=$('#petition-text').value.trim();if(!text){toast('请先写下批复');return;}
 const enabled=$('#petition-monthly').checked,reference=$('#petition-reference').value;
 const budget={money:Number($('#petition-money').value),grain:Number($('#petition-grain').value),...(enabled?{monthly:{money:Number($('#petition-monthly-money').value),grain:Number($('#petition-monthly-grain').value)},months:$('#petition-duration').value?Number($('#petition-duration').value):null,retain:$('#petition-retain').checked}:{})};
 const petitionDraft={...petitionEditing,text,budget,reference:reference===''?null:Number(reference),workMonths:enabled?Number($('#petition-work').value):null,official:$('#duty-official')?.value||null,funding:$('#petition-funding')?.value||'treasury'};
 close();counselTarget='council';await sendCounsel(text,mode,null,{petitionDraft});
}
function reviewUnitTemplate(form){
 const command=frontierCommand(form),unit=S.militaryState.units.find(u=>u.id===command.unit),needs=command.needs||cat.templates.find(t=>t.id===command.template)?.needs;if(!unit||!needs){toast('部队或编制无效');return;}
 if(!Object.keys(needs).length||Object.values(needs).some(v=>!Number.isInteger(v)||v<1||v>1000000)){toast('请至少保留一个有效装备类别，数量须为整数');return;}
 if(Object.keys({...unit.needs,...needs}).every(k=>unit.needs[k]===needs[k])){toast('装备需求未变化，未办理');return;}
 const list=v=>Object.entries(v).map(([k,n])=>esc(cat.categories[k]||k)+' '+n).join('、');
 open('审阅装备需求 · '+unit.name,'<p><strong>原需求：</strong>'+list(unit.needs)+'</p><p><strong>新需求：</strong>'+list(needs)+'</p><p class="muted">超额或不再需要的装备退回库存；新增缺额不会凭空补满。以后按新规模核算维护，隶属、密编、供给来源与现有训练保留。</p><div class="modal-buttons"><button class="outline" data-op="close">暂不变更</button><button class="primary" id="confirm-unit-template">确认变更</button></div>');
 $('#confirm-unit-template').addEventListener('click',()=>change('intervene',{command},'装备需求已按审阅结果调整'));
}
function showAction(id){
 const a=cat.actions.find(a=>a.id===id);if(!a)return;
 open(a.name,`<p class="modal-narrative">${a.desc}</p>${a.target?`<label for="target">施政地区</label><select id="target">${S.provinces.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${p.name} · 动乱 ${num(p.unrest)} / 旱情 ${num(p.drought)}</option>`).join('')}</select>`:''}${dutyPicker(actionDomain(a.id))}<small class="muted">随旨派人不另占施政；已开办的专人差遣每月另按当前差旅标准支出。</small><div class="cost-box"><span>钱粮支出</span><strong>${costText(a.cost)}</strong></div><p>${a.project?`竣工后：${effectText(a.project.effects)}${a.project.regional?'；地方'+effectText(a.project.regional):''}。工期 ${a.project.months} 月。`:effectText(a.effects)+(a.regional?'；地方'+effectText(a.regional):'')}</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="outline" data-advise-action="${a.id}">先问群臣</button><button class="primary" data-enact-action="${a.id}">颁旨施行</button></div>`);
}
async function settings(){
 open('AI 裁判 · DeepSeek',`<p class="muted">启用后，议事对话与自由诏令会将当前局势、近期相关对话及政令发送至所填 API 服务。常规政务在本机结算。有新政成果或差遣履历时，每三个月可调用一次 AI 拟后续奏报，随月报递交；失败使用本地续报。每次推演约一次 API 请求，按供应商实际用量计费。</p><form id="config-form"><label class="toggle"><input id="ai-enabled" type="checkbox" ${C.enabled?'checked':''}>启用 AI 对话与政令办理</label><label for="ai-key">DeepSeek API Key ${C.hasKey?'· 已保存在本机':''}</label><input id="ai-key" type="password" autocomplete="new-password" placeholder="${C.hasKey?'留空以保留当前密钥':'sk-…'}"><small class="muted">由当前 Windows 账户加密保存，密钥不会写入游戏存档。</small><label for="ai-model">模型名称</label><input id="ai-model" list="model-list" value="${esc(C.model)}"><datalist id="model-list"><option value="deepseek-flash"><option value="deepseek-v4-pro"><option value="deepseek-chat"></datalist><label for="ai-url">API 根地址</label><input id="ai-url" value="${esc(C.baseUrl)}"><p class="muted">官方默认：deepseek-flash。也可填写兼容接口与对应模型名。<a href="https://api-docs.deepseek.com/" target="_blank" rel="noreferrer">查看官方文档 ↗</a></p><div class="modal-buttons"><button type="button" class="text-button danger" data-op="clear-key">清除密钥</button><button type="button" class="outline" data-op="test-ai">保存并测试</button><button type="submit" class="primary">保存设置</button></div></form><div id="ai-feedback" role="status" class="muted">本次服务已调用 ${C.usage.requests} 次 · ${C.usage.totalTokens} tokens</div>`);
}
function configForm(){return {enabled:$('#ai-enabled').checked,key:$('#ai-key').value.trim(),model:$('#ai-model').value.trim(),baseUrl:$('#ai-url').value.trim()};}
async function saveSettings(test=false){
 if(busy)return;busy=true;document.body.classList.add('working');const feedback=$('#ai-feedback');feedback.textContent=test?'正在保存并测试连接…':'正在加密保存…';
 try{const r=await api('config',configForm());C=r.config;$('#ai-key').value='';if(test){await api('ai-test');feedback.textContent='✓ 连接成功，可以自由对话并办理政令。';toast('DeepSeek 连接成功');}else{close();render();toast('AI 设置已保存');}}
 catch(e){feedback.textContent=e.message;toast(e.message);}finally{busy=false;document.body.classList.remove('working');}
}
function showPlan(){
 if(plan.interventions?.length){open(plan.title,`<span class="badge">直接操作 · 待办理</span><p class="modal-narrative">${esc(plan.narrative)}</p><p>${esc(plan.feasibility)}</p><p class="notice">共 ${plan.interventions.filter(c=>c.operation!=='mode').length} 项操作。装备、能量、船队与配装将由实际规则核验并记录；任一项不满足，整批不执行。</p><ul>${plan.interventions.map(c=>`<li>${esc(({mode:'开启穿越模式',portal:c.open?'打开虫洞':'关闭虫洞',disclose:'公开身份',satellite:'发射卫星',summon_mecha:'高达配属部队',voyage:'派船探航',modernize:'整体换装整备'}[c.operation])||c.operation)}</li>`).join('')}</ul><div class="modal-buttons"><button class="outline" data-op="close">留中再议</button><button class="primary" data-op="enact-edict">朕意已决，办理</button></div>`,true);return;}
 open(plan.title,`<span class="badge">${plan.source==='ai'?'DeepSeek 推演':'离线规则试行'} · 待御批</span><p class="modal-narrative">${esc(plan.narrative)}</p><div class="minister-quote">“${esc(plan.minister)}”</div><h3>可行性与历史偏离</h3><p>${esc(plan.feasibility)}</p><div class="cost-box"><span>颁行成本</span><strong>${costText(plan.cost)}</strong></div>${plan.governmentPreview?institutionPreview(plan):''}${plan.recruitmentPreview?recruitmentPreview(plan):''}<p>${plan.governmentPreview?'规则变更已列于诏令正文。':'即时：'+effectText(plan.effects)}${plan.target?'；地区：'+S.provinces.find(p=>p.id===plan.target)?.name+'，'+effectText(plan.regional):''}</p>${plan.project?`<p>需 ${plan.project.months} 个月试办；竣工：${effectText(plan.project.effects)}${Object.keys(plan.project.regional||{}).length?'；地方'+effectText(plan.project.regional):''}</p>`:''}${dutyPicker(plan.domain,plan.leader)}<p class="muted">随诏派人不另占施政；每月差旅 ${S.fiscal?.rates.dutyFee??1} 万两。设署章程的主官仍可在机构卡片中另任。</p><small class="muted">推演内容为架空叙事，数值已受游戏规则限制。改变局势后，需重新推演。</small><div class="modal-buttons"><button class="outline" data-op="close">留中再议</button><button class="primary" data-op="enact-edict" ${!canPay(plan.cost)?'disabled':''}>${canPay(plan.cost)?'朕意已决，颁行':'当前钱粮不足'}</button></div>`,true);
}
async function saves(){
 try{const slots=await fetch('/api/slots').then(r=>r.json());open('封存国运 · 存档',`<p class="muted">每次行动自动存档。另有三个手动槽位；导出文件只包含游戏局势与起居注，不包含密钥。读档和导入均核验完整状态；无法读取的旧文件会保留。</p><div class="save-list">${slots.map(s=>`<div class="save-row"><div><strong>存档 ${s.slot}</strong><small>${s.invalid?'无法读取 · '+esc(s.error):s.empty?'尚未落笔':esc(s.date)+' · 第 '+(s.turn+1)+' 回合'}</small></div><button class="outline" data-save="${s.slot}">${s.empty?'存入':'覆盖'}</button><button class="outline" data-load="${s.slot}" ${s.empty||s.invalid?'disabled':''}>读取</button></div>`).join('')}</div><div class="modal-buttons"><button class="outline" data-op="export">导出存档</button><label class="outline file-label">导入存档<input type="file" accept=".json,application/json" id="import-file" hidden></label><button class="text-button danger" data-op="new">另开新局</button></div>`);}catch(e){toast(e.message);}
}
function guide(){
 open('陛下，先看这份议政纲要',`<div class="guide-grid"><section><span class="eyebrow">01 · 每月的节奏</span><h3>批奏报 → 施政 → 月结</h3><p>每月施政不限次数，任命、政令、军备与外交仍核验钱粮、资格和工期。先处置紧急奏报，再救荒、练兵、任人或发展工艺；点击“推进下月”结算钱粮、灾情、工程和朝臣能力。已结案奏报不可重复批复，但可以另下新政令。</p></section><section><span class="eyebrow">02 · 眼前与长远</span><h3>救急有用，制度更慢</h3><p>开仓与招抚快速缓解动乱；水利、译馆、赋役改革和水师需要施工。国库少于支出会欠饷，粮仓见底会激化饥荒。中枢专任至多三人。新机构可自定名称、职责、权限和预算，另有负责人差遣。</p></section><section><span class="eyebrow">03 · 自由诏令</span><h3>想法交给 AI，代价由你承担</h3><p>在御前议事写下任意政令；明确旨意可直接办理，疑问和假设先商议。AI 需你自己的密钥；离线模式只按关键词生成试点。构想将结合当前局势推演，并回报实际成效。AI 失败可重试或改用离线，不自动颁行。</p></section><section><span class="eyebrow">04 · 更远的山河</span><h3>先安天下，再望四海</h3><p>探航海图从开局可用。派船逐月探索，地点和航路线随发现入图，实勘记录持续保存。格物 ≥20、民心 ≥45 或首次探航开启外务；远航抵达远方后可进入全球势力棋局。遣使改善关系，通商获利，威慑有失败风险；改变实控须部署出征。自由推演新局立即开放全部篇章。</p></section></div><div class="history-note"><h3>史实与架空的边界</h3><p>朱由检于 1627 年即位，1628 年为崇祯元年，本作从该年正月开始。人物与明末危机有史实背景；数值、合并政区、每月事件、提前起用人物和全球结局属于游戏设计。史实不会强制重复，后金也不会在 1628 年被称为清朝。季节用简化月份表达，不作精确农历换算。</p><p>参考：<a target="_blank" rel="noreferrer" href="https://www.dpm.org.cn/court/lineage/226246.html">故宫博物院 · 崇祯皇帝</a>；<a target="_blank" rel="noreferrer" href="https://www.chnmuseum.cn/zp/zpml/gjwxbt/202202/t20220228_253665.shtml">国家博物馆 · 袁崇焕题本</a>。界面未使用外部追踪与远程字体。</p></div><div class="modal-buttons"><button class="outline" data-op="new">选择新局模式</button><button class="primary" data-op="close">朕知道了</button></div>`,true);
}
function newGame(){
 open('另起一局，重写天命',`<p class="muted">新局前会将当前进度备份至 data/before-new-game.json；手动存档保留。</p><div class="new-game-options"><button class="event-option" data-new="balanced"><span class="badge">推荐 · 从 1628 年开始</span><h3>危局求生</h3><p>460 万两、260 万石。内政先行，外交与远洋随国力逐步解锁。</p></button><button class="event-option" data-new="sandbox"><span class="badge">自由探索</span><h3>自由推演</h3><p>850 万两、480 万石。立即开放外务与全球势力，钱粮、工期与军事门槛仍然有效。</p></button></div>`);
}
function exportSave(){
 const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.href=u;a.download=`天命崇祯-${S.year}-${S.month}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('已导出本局存档');
}
async function next(){
 open('月结 · '+date(),`<p class="modal-narrative">本月预计税入 ${F.revenue} 万两，支出 ${F.expenses} 万两，粮耗 ${F.grainUse} 万石。${F.harvest?'官仓预计入粮 '+F.harvest+' 万石。':''}</p><p class="muted">施政次数不设上限，可按钱粮和工期安排本月事务。月结将推进灾情、朝臣能力与工程。未批奏报将免费留中，保留在差遣案卷，之后仍可批复。</p><div class="modal-buttons"><button class="outline" data-op="close">再议朝政</button><button class="primary" data-op="advance">结算本月 →</button></div>`);
}
document.addEventListener('input',e=>{if(e.target.id==='edict-text')draft=e.target.value;if(e.target.id==='counsel-input')counselDrafts[counselTarget]=e.target.value;});
document.addEventListener('change',async e=>{
 if(e.target.name==='template'&&e.target.closest?.('#frontier-form')?.dataset.operation==='template'){const fields=$('#custom-unit-needs');if(fields){fields.hidden=e.target.value!=='custom';fields.disabled=fields.hidden;}return;}
 if(e.target.id==='petition-monthly'){$('#petition-monthly-fields').hidden=!e.target.checked;return;}
 if(e.target.id==='petition-reference'&&e.target.value!==''){const event=petitionEditing?.petition?S.affairs.find(a=>a.id===petitionEditing.petition)?.petition:S.event,o=event?.options[Number(e.target.value)];if(o){$('#petition-money').value=o.cost?.money||0;$('#petition-grain').value=o.cost?.grain||0;}return;}
 if(e.target.id==='fiscal-official'){const o=cat.officials.find(o=>o.id===e.target.value);$('#fiscal-monthly').value=S.fiscal?.salaries?.[o.id]??o.monthlyPay??0;return;}
 if(e.target.id==='counsel-target'){clearCounselEdit();counselTarget=e.target.value;counselMonth='current';counselShowAll=false;counselError='';render();scrollCounsel();return;}
 if(e.target.id==='counsel-month'){counselMonth=e.target.value;counselShowAll=false;counselError='';render();scrollCounsel();return;}
 if(e.target.id==='counsel-auto'){counselAuto=e.target.checked;return;}
 if(e.target.id!=='import-file')return;const file=e.target.files[0];if(!file)return;
 try{if(file.size>1000000)throw Error('存档文件不能超过 1 MB');const raw=JSON.parse(await file.text());open('导入这份国运存档',`<p>将以导入进度替换当前自动存档。建议先存入手动槽位。</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="primary" id="confirm-import">导入并继续</button></div>`);$('#confirm-import').addEventListener('click',()=>change('import',{state:raw},'存档已导入'));}catch(e){toast('导入失败：'+e.message);}
});
document.addEventListener('submit',e=>{if(e.target.id==='petition-budget-form'){e.preventDefault();submitPetitionBudget();}else if(e.target.id==='fiscal-rates-form'){e.preventDefault();submitFiscalRates();}else if(e.target.id==='fiscal-salary-form'){e.preventDefault();submitSalary();}else if(e.target.id==='memo-form'){e.preventDefault();submitMemo();}else if(e.target.id==='frontier-form'){e.preventDefault();if(e.target.dataset.operation==='template')reviewUnitTemplate(e.target);else change('intervene',{command:frontierCommand(e.target)},'军械指令已按实际库存办理');}else if(e.target.id==='counsel-form'){e.preventDefault();sendCounsel();}else if(e.target.id==='config-form'){e.preventDefault();saveSettings();}else if(e.target.id==='agency-form'){e.preventDefault();submitAgencyForm();}else if(e.target.id==='recruitment-form'){e.preventDefault();submitRecruitmentForm();}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-map-region],[data-map-place],[data-map-unit]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-province]')){e.preventDefault();selected=e.target.dataset.province;render();}});
document.addEventListener('click',async e=>{
 if(mapGesture?.moved){mapGesture=null;e.preventDefault();return;}
 const el=e.target.closest('button,a,[data-province],[data-territory],[data-map-region],[data-map-place],[data-map-unit]');if(!el||el.disabled)return;
 if(el.dataset.pageTab){const {pageTab,tab}=el.dataset;if(pageTab==='institution'&&['offices','people','tasks','actions','system'].includes(tab))institutionTab=tab;if(pageTab==='landing'&&['brief','voyages','diplomacy'].includes(tab)){landingTab=tab;if(tab!=='brief'){mapMode=tab==='voyages'?'routes':'control';mapScope='known';mapView=null;}}if(pageTab==='military'&&['battle','equipment'].includes(tab))militaryTab=tab;if(pageTab==='archive'&&['history','annual','innovation'].includes(tab))archiveTab=tab;render();return;}
 if(el.dataset.mapLayer&&Object.hasOwn(mapLayers,el.dataset.mapLayer)){mapMode=el.dataset.mapLayer;render();return;}
 if(el.dataset.mapMove){if(['home','known'].includes(el.dataset.mapMove)){mapScope=el.dataset.mapMove;mapView=null;}else{mapView=moveMap(currentMapBounds(),el.dataset.mapMove);mapScope='manual';}render();return;}
 if(el.dataset.openMap){close();view='court';mapMode=el.dataset.openMap;mapScope=S.campaignState.battles.some(b=>b.status==='active'&&!cat.regions.find(r=>r.id===b.target)?.home)?'known':'home';mapView=null;render();window.scrollTo({top:0});return;}
 if(el.dataset.mapRegion){mapRegionDetail(el.dataset.mapRegion);return;}
 if(el.dataset.mapPlace){mapPlaceDetail(el.dataset.mapPlace);return;}
 if(el.dataset.mapUnit){militaryTab='equipment';routeTo('armory');render();return;}
 if(el.dataset.orderDraft){counselDrafts.council=el.dataset.orderDraft;openCounselTarget('council');return;}
 if(el.dataset.institutionFilter){institutionFilter=el.dataset.institutionFilter;render();return;}
 if(el.dataset.institutionReport){await requestInstitutionReport(el.dataset.institutionReport);return;}
 if(el.dataset.counselOpen){openCounselTarget(el.dataset.counselOpen);return;}
 if(el.dataset.counselEnactOriginal){const messages=S.discussions.find(t=>t.id===counselTarget)?.messages||[],m=messages.at(-1);if(m?.id===el.dataset.counselEnactOriginal&&m.orderText&&m.result?.status==='discussed')await sendCounsel(m.orderText,'auto');return;}
 if(el.dataset.memoEdit){showMemoForm(el.dataset.memoEdit);return;}
 if(el.dataset.memoReview){await reviewMemo(el.dataset.memoReview);return;}
 if(el.dataset.serviceEngage){await change('service',{command:{operation:'engage',person:el.dataset.serviceEngage}},'已开始核验履历与试差');return;}
 if(el.dataset.serviceRecommend){openCounselTarget(el.dataset.serviceRecommend);const row=institutionRows().find(o=>o.key===el.dataset.serviceRecommend),subject=el.dataset.serviceRecommend==='office:guards'?'下南洋访察':row?.domain==='industry'?'查验工坊成品':row?.domain==='finance'?'清核钱粮账目':row?.domain==='military'?'操练营伍':'核查地方案牍';counselDrafts[el.dataset.serviceRecommend]='朕想找人负责'+subject+'，本署可有合适人选？请先介绍经历，待朕批准后再办。';render();$('#counsel-input')?.focus();return;}
 if(el.dataset.memoStatus){if(await change('planning-status',{gameId:S.id,id:el.dataset.memoId,status:el.dataset.memoStatus},'规划状态已更新'))void remindPlanning();return;}
 if(el.dataset.annualReport){const report=S.annualReports?.find(r=>r.year===Number(el.dataset.annualReport));if(report)open(report.year+'年 · 年度总结',annualReportHTML(report),true);return;}
 if(el.dataset.nav){e.preventDefault();close();routeTo(el.dataset.nav);render();if(view==='counsel')scrollCounsel();window.scrollTo({top:0});return;}
 if(el.dataset.province){selected=el.dataset.province;render();return;}
 if(el.dataset.map){mapMode=el.dataset.map;render();return;}
 if(el.dataset.suggest){draft=el.dataset.suggest;$('#edict-text').value=draft;$('#edict-text').focus();return;}
 if(busy&&el.dataset.op!=='close')return;
 if(el.dataset.region||el.dataset.territory){const d=territoryDetail(S,cat,el.dataset.region||el.dataset.territory);open(d.title,d.html);return;}
 if(el.dataset.regionAction){await change('action',{id:el.dataset.regionAction,target:el.dataset.provinceId},'地方政务已实际办理');return;}
 if(el.dataset.regionAdvice){const p=S.provinces.find(p=>p.id===el.dataset.regionAdvice);close();counselTarget='council';await sendCounsel('请审阅'+p.name+'的当前民情、生产与旱情，为此地提出治理方案，并明确预算与主官安排；本次先商议。','discuss');return;}
 if(el.dataset.frontCommand){await change('intervene',{command:JSON.parse(el.dataset.frontCommand)},'已办理，结果记入起居注');return;}
 if(el.dataset.frontForm){const f=el.dataset.frontForm.startsWith('war-')?warForm(el.dataset.frontForm,S,cat,el.dataset):frontierForm(el.dataset.frontForm,S,cat,el.dataset.unit);open(f.title,f.html);return;}
 if(el.hasAttribute('data-front-advice')){close();counselTarget='council';await sendCounsel('请结合当前装备库存、前线缺装、军工厂、钱粮'+(S.traveler.enabled?'和时空能量':'')+'，提出一份前线优先的整军方案。由你统筹武器选择、配发和生产。本次先商议。','discuss');return;}
 if(el.dataset.adviseAction){const a=cat.actions.find(a=>a.id===el.dataset.adviseAction),p=S.provinces.find(p=>p.id===($('#target')?.value||selected));close();counselTarget='council';await sendCounsel('朕考虑'+a.name+(a.target?'，在'+p.name+'施行':'')+'。请评议主要收益、钱粮代价与阻力，有更好的做法也请直言；本次仅作商议。','discuss');return;}
 if(el.dataset.counselEdit){startCounselEdit(el.dataset.counselEdit);return;}
 if(el.dataset.counselRegenerate){await regenerateCounsel(el.dataset.counselRegenerate);return;}
 if(el.dataset.counselDelete){showCounselDelete(el.dataset.counselDelete);return;}
 if(el.dataset.counselExample){counselDrafts[counselTarget]=el.dataset.counselExample;$('#counsel-input').value=el.dataset.counselExample;$('#counsel-input').focus();return;}
 if(el.dataset.action){showAction(el.dataset.action);return;}
 if(el.dataset.enactAction){await change('action',{id:el.dataset.enactAction,target:$('#target')?.value,official:$('#duty-official')?.value||null},'旨意已下，地方开始执行');return;}
 if(el.dataset.frontDisband){const u=S.militaryState.units.find(u=>u.id===el.dataset.frontDisband);if(!u)return;const active=S.campaignState.battles.some(b=>b.unit===u.id&&b.status==='active');open('裁撤 · '+u.name,'<p>撤销这支编制，现存装备全部退库，解除其统帅本职，之后按剩余编制核算维护。既往账目保留；重新组建不会自动恢复这支部队的训练记录。</p><p>装备退库：'+Object.entries(u.equipment).filter(([,n])=>n>0).map(([id,n])=>esc(cat.equipment?.find(e=>e.id===id)?.name||id)+' ×'+n).join('；')+'</p>'+(active?'<p>该军仍在战场，请先下令撤军。</p>':'')+'<div class="modal-buttons"><button class="outline" data-op="close">暂不裁撤</button><button class="primary" data-front-disband-confirm="'+esc(u.id)+'" '+(active?'disabled':'')+'>确认裁撤并退库</button></div>');return;}
 if(el.dataset.frontDisbandConfirm){await change('intervene',{command:{type:'arsenal',operation:'disband',unit:el.dataset.frontDisbandConfirm}},'编制已撤销，装备退库并停止其后维护');return;}
 if(el.dataset.petition){showPetition(el.dataset.petition);return;}
 if(el.dataset.reviewPetition){showCustomPetition(el.dataset.reviewPetition==='current'?null:el.dataset.reviewPetition);return;}
 if(el.dataset.petitionRetry){if(hasPetitionBudgetDraft())showCustomPetition(petitionBudgetDraft.petition);return;}
 if(el.dataset.petitionDiscuss){await submitPetitionBudget('discuss');return;}
 if(el.dataset.event!==undefined){await change('event',{index:Number(el.dataset.event),petition:el.dataset.petitionId||null,official:$('#duty-official')?.value||null},'奏报已批复');return;}
 if(el.dataset.officeLeader){showOfficeLeader(el.dataset.officeLeader);return;}
 if(el.dataset.dutyKind){showDuty(el.dataset.dutyKind,el.dataset.dutyId);return;}
 if(el.dataset.parley){showRecruitmentForm(el.dataset.parley);return;}
 if(el.dataset.agencyEdit){showAgencyForm(el.dataset.agencyEdit);return;}
 if(el.dataset.agencyLeader){showAgencyLeader(el.dataset.agencyLeader);return;}
 if(el.dataset.agencyBudget){showAgencyBudget(el.dataset.agencyBudget);return;}
 if(el.dataset.agencyDissolve){const a=S.agencies.find(a=>a.id===el.dataset.agencyDissolve);await previewInstitutionChanges([{operation:'dissolve_agency',target:a.id}],'裁撤'+a.name);return;}
 if(el.dataset.appoint){await change(el.dataset.dismiss==='true'?'dismiss':'appoint',{id:el.dataset.appoint},'班底已调整');return;}
 if(el.dataset.country){
  const id=el.dataset.country,kind=el.dataset.kind,c=S.countries.find(c=>c.id===id);
  open(({envoy:'遣使',trade:'通商',pressure:'威慑'}[kind])+' · '+c.name,`<p class="modal-narrative">${({envoy:'花费 22 万两、4 万石，关系提高 16。向后金遣使可小幅缓解边患。',trade:'花费 28 万两、8 万石，获得商路回款、格物与海权。',pressure:'花费 40 万两、18 万石。依实力争取有利商约，失败会损失军备与皇权；领土实控不变。'}[kind])}</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="primary" id="confirm-diplomacy">施行</button></div>`);
  $('#confirm-diplomacy').addEventListener('click',()=>change('diplomacy',{id,kind},'外务结果已记入起居注'));return;
 }
 if(el.dataset.save){const slot=Number(el.dataset.save);open('存入第 '+slot+' 槽',`<p>将当前进度存入此槽；已有存档会被覆盖。</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="primary" id="confirm-save">存入</button></div>`);$('#confirm-save').addEventListener('click',async()=>{await change('save',{slot},'手动存档已保存');saves();});return;}
 if(el.dataset.load){const slot=Number(el.dataset.load);open('读取第 '+slot+' 槽',`<p>当前自动存档会被此进度替换。</p><div class="modal-buttons"><button class="outline" data-op="close">暂缓</button><button class="primary" id="confirm-load">读取并继续</button></div>`);$('#confirm-load').addEventListener('click',()=>change('load',{slot},'已读取存档'));return;}
 if(el.dataset.new){draft='';mapView=null;mapScope='home';mapMode='unrest';landingTab='brief';view='court';await change('new',{mode:el.dataset.new},'新局已开启');return;}
 switch(el.dataset.op){
 case 'close':close();break;
 case 'settings':settings();break;
 case 'counsel':view='counsel';render();scrollCounsel();break;
 case 'memo-new':showMemoForm();break;
 case 'fiscal-salary-reset':await submitSalary(true);break;
 case 'planning-restore':await change('planning-restore',{gameId:S.id,revision:S.revision},'已按现有工程和竣工记录核对补录');break;
 case 'planning-remind':await remindPlanning();break;
 case 'counsel-accept':clearCounselEdit();await sendCounsel('照办','auto');break;
 case 'counsel-edit-cancel':clearCounselEdit();render();break;
 case 'counsel-expand':counselShowAll=true;render();break;
 case 'counsel-collapse':counselShowAll=false;render();scrollCounsel(true);break;
 case 'counsel-advice':counselTarget='council';await sendCounsel('请结合当前局势，按轻重缓急给朕三条建议，说明预期收益、代价和阻力；本次仅作商议。','discuss');break;
 case 'enable-counsel-ai':await change('config',{enabled:true,baseUrl:C.baseUrl,model:C.model},'已启用现有 AI 配置，可以直接议事');break;
 case 'order':if(!draft.trim()){toast('请先写下你的旨意');break;}counselTarget='council';counselDrafts.council=draft;await sendCounsel(draft,'auto');break;
 case 'create-agency':showAgencyForm();break;
 case 'new-recruitment':showRecruitmentForm();break;
 case 'saves':saves();break;
 case 'guide':guide();break;
 case 'new':newGame();break;
 case 'export':exportSave();break;
 case 'petition':showPetition();break;
 case 'regional':routeTo('affairs');render();toast('当前施政地区：'+S.provinces.find(p=>p.id===selected).name);break;
 case 'policy':await change('policy',{tax:Number($('#tax').value),military:Number($('#military').value)},'新国策将于月结生效');break;
 case 'enact-edict':if(plan.institutionChanges?.length||plan.recruitment){routeTo('institutions');institutionTab='offices';}if(await change('enact',{id:planId,official:$('#duty-official')?.value||null},'诏令已颁行，执行情况将记入起居注')){draft='';if($('#edict-text'))$('#edict-text').value='';}break;
 case 'next':next();break;
 case 'advance':if(await change('advance',{},'月结已完成')){const annual=S.month===1?S.annualReports?.find(r=>r.year===S.year-1):null;open(date()+' · 月度奏销',`<div class="result-grid">${S.monthlyResults.map(r=>`<div><span>${cat.meta[r.key][0]}</span><b class="${r.value<0?'danger':'gold'}">${signed(r.value)}</b></div>`).join('')}</div>${S.notices.map(t=>`<p class="notice">${esc(t)}</p>`).join('')}<div id="monthly-plan-reminder">${reminderPanel()}</div><div id="monthly-development-story">${developmentPanel()}</div>${annual?annualReportHTML(annual):''}<p class="muted">月度变化包含收入、支出、事件余波、朝臣与工程竣工。</p><div class="modal-buttons"><button class="primary" data-op="close">继续议政</button></div>`,!!annual);void (async()=>{await remindPlanning();await requestDevelopmentStory();})();}break;
 case 'test-ai':saveSettings(true);break;
 case 'clear-key':if(await change('config',{...configForm(),key:'',clearKey:true,enabled:false},'本机密钥已清除，AI 已关闭'))settings();break;
 }
});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
try{const r=await fetch('/api/bootstrap').then(r=>{return r.json().then(data=>{if(!r.ok)throw Error(data.error||'服务不可用');return data;});});S=r.state;C=r.config;T=r.token;cat=r.catalog;F=r.forecast;A=r.administration;try{worldLand=await loadLand();}catch{}render();void remindPlanning();if(!localStorage.getItem('chongzhen-onboarded')){guide();localStorage.setItem('chongzhen-onboarded','1');}}
catch(e){$('#app').innerHTML=`<div class="loading-screen">御案未能开启<span>${esc(e.message)} · 请重新运行启动游戏.cmd</span><button class="outline" id="retry">刷新重试</button></div>`;$('#retry').onclick=()=>location.reload();}
