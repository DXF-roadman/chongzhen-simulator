import * as g from './engine.mjs';
const key=x=>String(x||'').replace(/[“”「」《》"]/g,'').replace(/\s+/g,'');
const match=(rows,value)=>rows.find(r=>r.id===value||key(r.name)===key(value));
const leader=(s,value)=>{if(value===null||value==='')return null;const o=g.officialCatalog(s).find(o=>o.id===value||o.name===value);if(!o)throw Error('人选尚未归附或不在可任用名单：'+String(value));return o.id;};
export function prepareCommandBatch(s,input){
 if(!Array.isArray(input)||input.length>6)throw Error('一次最多交办六项事务。');
 const nodes=structuredClone(input).map((command,index)=>({command,index,deps:new Set(),removed:false})),births=[];
 const unitBirths=nodes.filter(n=>n.command.type==='arsenal'&&n.command.operation==='create_unit');
 for(const n of nodes){const c=n.command,birth=unitBirths.find(b=>b!==n&&key(b.command.name)===key(c.unit));if(birth)n.deps.add(birth.index);}
 const supplies=nodes.filter(n=>n.command.type==='horizon'&&n.command.operation==='resources'),enable=nodes.find(n=>n.command.type==='horizon'&&n.command.operation==='mode'&&n.command.enabled===true);
 for(const n of supplies)if(!s.traveler?.enabled&&enable)n.deps.add(enable.index);
 if(!s.traveler?.enabled&&enable)for(const n of nodes)if(n!==enable&&['arsenal','war','edict'].includes(n.command.type))n.deps.add(enable.index);
 for(const n of nodes)if(['office','agency','central','action','event','edict','diplomacy','arsenal','war'].includes(n.command.type)||n.command.type==='horizon'&&n.command.operation==='voyage')for(const supply of supplies)n.deps.add(supply.index);
 for(const n of nodes){
  const c=n.command;if(c.type!=='edict')continue;
  let p=c.plan;if(!p){try{p=g.localEdict(s,String(c.text||''));}catch{continue;}}
  n.plan=p;
  for(const change of p.institutionChanges||[])if(change.operation==='create_agency')births.push({name:change.name,node:n,change});
 }
 for(const n of nodes){
  const c=n.command;
  if(['agency','budget'].includes(c.type)){
   const existing=match(s.agencies,c.agency);if(existing){c.agency=existing.id;continue;}
   const birth=births.find(b=>key(b.name)===key(c.agency));if(!birth)continue;
   if(c.type==='agency'){
    const id=leader(s,c.official);if(birth.change.leader&&leader(s,birth.change.leader)!==id)throw Error('同一新机构的人选互相冲突，请明确主官。');
    birth.change.leader=id;birth.node.command.plan=birth.node.plan;n.removed=true;
   }else{c.agency=birth.name;n.deps.add(birth.node.index);}
  }
  if(c.type==='duty'){
   const pools={project:s.projects,affair:s.affairs,event:s.event?[{...s.event,name:s.event.title}]:[]},existing=match(pools[c.kind]||[],c.target);
   if(existing){c.target=existing.id;continue;}
   const alternative=['project','affair'].filter(k=>k!==c.kind).flatMap(k=>(pools[k]||[]).map(row=>({row,kind:k}))).filter(({row})=>row.id===c.target||key(row.name)===key(c.target));
   if(alternative.length===1){c.kind=alternative[0].kind;c.target=alternative[0].row.id;continue;}
   const producer=nodes.find(p=>p!==n&&p.command.type==='edict'&&key(p.plan?.title)===key(c.target));
   if(producer){
    const id=leader(s,c.official);if(producer.command.official&&leader(s,producer.command.official)!==id)throw Error('同一新事务的督办人选互相冲突。');
    producer.command.official=id;n.removed=true;
   }else{
    const actionProducer=nodes.find(p=>p.command.type==='action'&&g.ACTIONS.some(a=>a.id===p.command.action&&a.project&&key(a.name)===key(c.target)));
    if(actionProducer){const id=leader(s,c.official);if(actionProducer.command.official&&leader(s,actionProducer.command.official)!==id)throw Error('同一工程的督办人选互相冲突。');actionProducer.command.official=id;n.removed=true;}
   }
  }
 }
 const pending=nodes.filter(n=>!n.removed),done=new Set(nodes.filter(n=>n.removed).map(n=>n.index)),ordered=[];
 while(pending.length){const i=pending.findIndex(n=>[...n.deps].every(d=>done.has(d)));if(i<0)throw Error('办理事项存在依赖循环，请重新拟定顺序。');const [n]=pending.splice(i,1);ordered.push(n.command);done.add(n.index);}
 return ordered;
}
export function isRepairableCommandError(error){
 return /不存在|未找到|缺少|无效|未知|不支持|尚无明确|尚未归附|不在可任用|同名|冲突|依赖循环|未落实章程|没有待批奏报|奏报已变化|奏报已处置/.test(error?.message||'');
}
