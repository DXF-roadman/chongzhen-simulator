import {NATIVE_OFFICIALS,recruitedOfficials} from './talents.mjs';
import {civilOfficials} from './civil-service.mjs';
export const FISCAL_DEFAULTS={administrationBase:25,militaryBase:24,salaryMultiplier:1,officeFee:2,agencyFee:2,dutyFee:1,governorFee:2,commanderFee:2};
export const FISCAL_LABELS={administrationBase:'朝廷日常开支',militaryBase:'基础军费',salaryMultiplier:'中枢专任月俸倍率',officeFee:'常设主官每职月费',agencyFee:'新署主官每职月费',dutyFee:'专人督办每事差旅',governorFee:'地方主官每职月费',commanderFee:'部队统帅每职月费'};
export const fiscalRules=s=>({...FISCAL_DEFAULTS,...s.fiscal?.rates});
const round=n=>Math.round(n*10000)/10000;
function positions(s,id){
 const r=fiscalRules(s),o=[...NATIVE_OFFICIALS,...recruitedOfficials(s),...civilOfficials(s)].find(o=>o.id===id),slots=[];
 if(s.officials.includes(id))slots.push({kind:'central',key:'central',base:(o?.cost||0)*.18*r.salaryMultiplier});
 for(const [key,leader]of Object.entries(s.government?.officeLeaders||{}))if(leader===id&&(key!=='cabinet'||s.government.cabinet!==false))slots.push({kind:'office',key,base:o?.incumbent&&o.institution==='office:'+key?0:r.officeFee});
 for(const a of s.agencies||[])if(a.leader===id&&a.budget>0)slots.push({kind:'agency',key:a.id,base:r.agencyFee});
 for(const p of s.provinces)if(p.governor===id)slots.push({kind:'governor',key:p.id,base:r.governorFee});
 for(const u of s.militaryState?.units||[])if(u.commander===id)slots.push({kind:'commander',key:u.id,base:u.commanderIncludedInBase?0:r.commanderFee});
 return slots.map(p=>({...p,standard:p.kind==='central'?(o?.cost||0)*.18:p.kind==='office'&&o?.incumbent&&o.institution==='office:'+p.key||p.kind==='commander'&&s.militaryState.units.find(u=>u.id===p.key)?.commanderIncludedInBase?0:FISCAL_DEFAULTS[({office:'officeFee',agency:'agencyFee',governor:'governorFee',commander:'commanderFee'})[p.kind]]||0}));
}
export function payroll(s,id){
 const slots=positions(s,id),override=s.fiscal?.salaries?.[id],total=slots.reduce((n,p)=>n+p.base,0);let allocated=0;
 return slots.map((slot,i)=>{const amount=override===undefined?slot.base:i===slots.length-1?round(override-allocated):round(total>0?override*slot.base/total:override/slots.length);allocated=round(allocated+amount);return {...slot,person:id,amount};});
}
export function rolePay(s,kind,id,key=null){if(!id)return 0;return round(payroll(s,id).filter(p=>p.kind===kind&&(key===null||p.key===key)).reduce((n,p)=>n+p.amount,0));}
export function personPay(s,id){return round(payroll(s,id).reduce((n,p)=>n+p.amount,0));}
export function centralPay(s){return s.officials.reduce((n,id)=>n+rolePay(s,'central',id),0);}
export function validateFiscal(raw,s){
 const f=raw.fiscal;if(f!==undefined&&(!f||typeof f!=='object'||Array.isArray(f)))throw Error('财政规则格式无效。');
 const rates={...FISCAL_DEFAULTS,...f?.rates};for(const [k,v]of Object.entries(rates))if(!Object.hasOwn(FISCAL_DEFAULTS,k)||!Number.isFinite(v)||v<0||v>(k==='salaryMultiplier'?5:1000))throw Error('财政费率无效：'+k);
 const salaries={...f?.salaries},people=new Set([...NATIVE_OFFICIALS,...(s.talents||[]),...(s.service?.people||[])].map(o=>o.id));if(Object.keys(salaries).length>110)throw Error('个人月俸约定过多。');for(const [id,v]of Object.entries(salaries))if(!people.has(id)||!Number.isFinite(v)||v<0||v>1000)throw Error('个人月俸约定无效。');
 const extra={};if(f?.hired!==undefined){if(!Array.isArray(f.hired)||f.hired.length>256||f.hired.some(id=>!people.has(id)))throw Error('起用记录无效。');extra.hired=[...new Set(f.hired)];}
 if(f?.morale!==undefined){if(!f.morale||Object.entries(f.morale).some(([id,v])=>!people.has(id)||!Number.isFinite(v)||v<0||v>1))throw Error('薪俸履约记录无效。');extra.morale={...f.morale};}s.fiscal={rates,salaries,...extra};
}
export function changeFiscal(s,c){
 s.fiscal||={rates:{...FISCAL_DEFAULTS},salaries:{}};
 if(c.scope==='rates'){
  if(!c.values||typeof c.values!=='object'||Array.isArray(c.values)||!Object.keys(c.values).length)throw Error('缺少要调整的费用项目。');
  const candidate={...s.fiscal,rates:{...s.fiscal.rates,...c.values}};validateFiscal({fiscal:candidate},{...s});
  const previous=fiscalRules(s);s.fiscal.rates={...previous,...c.values};return Object.entries(c.values).map(([k,v])=>FISCAL_LABELS[k]+' '+previous[k]+' → '+v+(k==='salaryMultiplier'?' 倍':' 万两 / 月')).join('；');
 }
 if(c.scope==='person'){
  const o=[...NATIVE_OFFICIALS,...recruitedOfficials(s),...civilOfficials(s)].find(o=>o.id===c.official||o.name===c.official);if(!o)throw Error('此人尚不可任用，不能约定月俸。');
  if(c.monthly!==null&&(!Number.isFinite(c.monthly)||c.monthly<0||c.monthly>1000))throw Error('个人月俸须为 0 至 1000 万两，或 null 恢复职务标准。');
  if(c.monthly===null)delete s.fiscal.salaries[o.id];else s.fiscal.salaries[o.id]=round(c.monthly);
  return o.name+'月俸约定：'+(c.monthly===null?'恢复职务标准':round(c.monthly)+' 万两 / 月')+'；实际在职合计 '+personPay(s,o.id)+' 万两 / 月。兼任按总额分摊，督办差旅与部众口粮另列，未任职不支薪。';
 }
 throw Error('不支持的财政调整范围。');
}
export function chineseNumber(v){
 if(/^\d+(?:\.\d+)?$/.test(v))return Number(v);const fraction=v.match(/^(\d+(?:\.\d+)?)([十百千万亿])$/);if(fraction)return Number(fraction[1])*({十:10,百:100,千:1000,万:10000,亿:100000000}[fraction[2]]);const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9},units={十:10,百:100,千:1000,万:10000,亿:100000000};let total=0,part=0,num=0;
 for(const ch of v){if(ch in digits)num=digits[ch];else if(/\d/.test(ch))num=num*10+Number(ch);else if(ch in units){const u=units[ch];if(u>=10000){total=(total+part+num)*u;part=0;}else part+=(num||1)*u;num=0;}else return NaN;}return total+part+num;
}
export function inferFiscal(s,input){
 const text=String(input),rules=fiscalRules(s);if(!/俸|薪|管理费|差旅|朝廷日常|基础军费/.test(text)||!/改|调|定|降|减|增|免|停发|恢复/.test(text))return [];
 const o=[...NATIVE_OFFICIALS,...recruitedOfficials(s),...civilOfficials(s)].find(o=>text.includes(o.name));
 const amount=text.match(/(?:改为|改成|定为|降为|降至|增至|调整为|调整到|提高到|月俸为?|月给|每月)\s*([零〇一二两三四五六七八九十百千万亿\d.]+)\s*(万两|两)?/);
 let monthly;if(amount){const trailingLiang=amount[1].endsWith('两')&&amount[1].length>1,numeral=trailingLiang?amount[1].slice(0,-1):amount[1];monthly=chineseNumber(numeral);if(/万/.test(numeral)||amount[2]==='两'||trailingLiang)monthly/=10000;}
 if(o){if(/恢复/.test(text))return [{type:'fiscal',scope:'person',official:o.id,monthly:null}];if(/免俸|停发|不领俸|不领薪/.test(text))monthly=0;if(/减半/.test(text))monthly=personPay(s,o.id)/2;if(Number.isFinite(monthly))return [{type:'fiscal',scope:'person',official:o.id,monthly}];return [];}
 const matches=Object.entries(FISCAL_LABELS).filter(([k,label])=>text.includes(label)||({officeFee:/常设.*(?:管理费|月费)|六部.*管理费/,agencyFee:/新署.*(?:管理费|月费)|机构.*管理费/,dutyFee:/督办.*(?:差旅|月费)/,governorFee:/地方主官.*月费/,commanderFee:/统帅.*月费/,administrationBase:/朝廷日常/,militaryBase:/基础军费/,salaryMultiplier:/中枢.*(?:薪|俸)/}[k]).test(text));
 if(!matches.length&&/官员|百官|薪俸|俸禄/.test(text)&&/减半/.test(text))return [{type:'fiscal',scope:'rates',values:Object.fromEntries(['salaryMultiplier','officeFee','agencyFee','governorFee','commanderFee'].map(k=>[k,round(rules[k]/2)]))}];
 if(matches.length){const values={};for(const [k]of matches){if(/减半/.test(text))values[k]=round(rules[k]/2);else if(Number.isFinite(monthly))values[k]=monthly;}if(Object.keys(values).length)return [{type:'fiscal',scope:'rates',values}];}
 return [];
}

export const compensationSupport=(s,id)=>s.fiscal?.morale?.[id]??1;
export function settleCompensation(s,book){
 const reports=[];for(const id of new Set(book.entries.filter(r=>r.person).map(r=>r.person))){const rows=book.entries.filter(r=>r.person===id),needed=rows.reduce((n,r)=>n+(r.requiredMoney||0),0);if(!needed)continue;const level=Math.min(1,rows.reduce((n,r)=>n+r.actualMoney,0)/needed),old=compensationSupport(s,id);if(level>=1&&old===1)continue;s.fiscal.morale||={};s.fiscal.morale[id]=Math.max(0,Math.min(1,Math.round((old+(level>=1?.05:-(1-level)*.1))*10000)/10000));if(level<1)reports.push({id,level,support:s.fiscal.morale[id]});}return reports;
}
