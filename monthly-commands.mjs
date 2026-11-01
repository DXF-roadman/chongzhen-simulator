import {normalizeMonthly,monthlyAmount,hasMonthlyLanguage} from './monthly-rules.mjs';
export function findMonthlyEntity(s,kind,id){const list=({project:s.projects,affair:s.affairs,voyage:s.atlas.voyages,policy:s.monthlyPolicies||[]})[kind];return list?.find(p=>p.id===id||p.name===id);}
export function inferMonthlyCommands(s,input){
 if(!hasMonthlyLanguage(input)||/俸|薪|朝廷日常|基础军费/.test(input))return [];
 const matched=['project','affair','voyage','policy'].flatMap(kind=>{const list=kind==='project'?s.projects:kind==='affair'?s.affairs:kind==='voyage'?s.atlas.voyages:s.monthlyPolicies||[];return list.filter(p=>input.includes(p.name)).map(p=>({kind,p}));});
 if(matched.length!==1)return [];const {kind,p}=matched[0];if(!/改为|调整|月拨|每月|停拨|暂停/.test(input))return [];
 return [{type:'monthly',kind,target:p.id,monthly:/停拨|暂停/.test(input)?{...(p.monthly||{}),paused:true}:normalizeMonthly({...p.monthly,paused:false},input)}].filter(c=>c.monthly);
}
export function prepareMonthlyCommands(s,commands,input){
 const amount=monthlyAmount(input);if(!Object.keys(amount).length||/俸|薪|朝廷日常|基础军费/.test(input))return commands;
 if(commands.some(c=>['monthly','budget','fiscal'].includes(c.type)))return commands;
 const candidates=commands.filter(c=>['edict','action'].includes(c.type)||c.type==='horizon'&&c.operation==='voyage');if(candidates.length===1){const c=candidates[0],monthly=normalizeMonthly(c.monthly||c.plan?.monthly,input);if(c.type==='edict')c.plan=c.plan&&typeof c.plan==='object'?{...c.plan,monthly}:undefined;c.monthly=monthly;}
 else if(!candidates.length)throw Error('这道旨意含每月钱粮安排，但尚未绑定实际任务或预算，整批没有执行。');
 else if(!candidates.every(c=>c.monthly||c.plan?.monthly))throw Error('月拨涉及多项事务，办理数据尚未逐项列出预算，整批没有执行。');return commands;
}
