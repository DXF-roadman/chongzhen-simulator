import {chineseNumber} from './fiscal-rules.mjs';
import {monthlyAmount} from './monthly-rules.mjs';
const clean=(v,n)=>String(v??'').trim().slice(0,n),round=n=>Math.round(n*10000)/10000;
function amount(v){if(!Number.isFinite(v)||v<0||v>1000)throw Error('本案预算须为0至1000万两/万石的明确上限。');return round(v);}
export function petitionBudget(raw={}){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('本案预算格式无效。');const out={money:amount(raw.money??0),grain:amount(raw.grain??0),monthly:null,months:null,retain:raw.retain===true};if(raw.monthly){if(typeof raw.monthly!=='object'||Array.isArray(raw.monthly))throw Error('月拨预算格式无效。');out.monthly={money:amount(raw.monthly.money??0),grain:amount(raw.monthly.grain??0)};if(raw.months!==null&&raw.months!==undefined&&raw.months!==''){if(!Number.isInteger(raw.months)||raw.months<1||raw.months>120)throw Error('本次月拨授权期限须为1至120个月，留空表示办理期间。');out.months=raw.months;}}return out;}
export function cleanPetitionDraft(raw){
 if(!raw||typeof raw!=='object')throw Error('缺少自拟批复。');const text=clean(raw.text,2000);if(!text)throw Error('请写明本案如何处置。');
 if(raw.reference!==undefined&&raw.reference!==null&&(!Number.isInteger(raw.reference)||raw.reference<0||raw.reference>5))throw Error('参考方案编号无效。');
 const workMonths=raw.workMonths===undefined||raw.workMonths===null?null:Number(raw.workMonths);if(workMonths!==null&&(!Number.isInteger(workMonths)||workMonths<2||workMonths>12))throw Error('预计办理工期须为2至12个月。');
 const funding=raw.funding||'treasury';if(!['treasury','portal'].includes(funding))throw Error('本案供给来源无效。');
 return {text,budget:petitionBudget(raw.budget),reference:raw.reference??null,workMonths,funding,official:raw.official||null,petition:raw.petition||null,eventId:clean(raw.eventId,90),eventTurn:raw.eventTurn??null,gameId:clean(raw.gameId,100)};
}
export function budgetFromPetitionText(input){
 const text=String(input||''),monthly=monthlyAmount(text),masked=text.replace(/(?:每月|月拨|月给|月支|月出|按月拨)[^，。；\n]{0,50}/g,'');const found={};
 const pattern=/(?:本案预算|总预算|预算|首拨|首期|先拨|一次性(?:拨银|拨粮|拨款)?|拨银|拨粮|费用|花费|花|用银|用粮|支银|支粮|拨款|拨)\s*(?:为|不超过|最多|上限|改为|定为|银|粮|白银)?\s*([零〇一二两三四五六七八九十百千万亿\d.]+)\s*(万两|万石|两|石)/g;
 for(const m of masked.matchAll(pattern)){const k=/石/.test(m[2])?'grain':'money';let n=chineseNumber(m[1]);if(m[2]==='两'||m[2]==='石')n/=10000;n=amount(n);if(found[k]!==undefined&&found[k]!==n)throw Error('本案出现不同的首拨金额，请在“自拟批复与预算”中分别填写首拨、月拨和期限。');found[k]=n;}
 const zero=/不另拨|不额外(?:花|支)|不花钱|零预算|不新增支出|不另支钱粮/.test(text);if(!Object.keys(found).length&&!Object.keys(monthly).length&&!zero)return null;
 const duration=/(?:月拨|拨款).{0,20}(?:为期|只拨|连续)\s*([一二三四五六七八九十\d]+)个月/.exec(text);
 return petitionBudget({...found,...(Object.keys(monthly).length?{monthly}:{}),...(duration?{months:chineseNumber(duration[1])}:{})});
}
export function scalePetitionEffects(e,scale,lowGood=[]){return Object.fromEntries(Object.entries(e||{}).map(([k,v])=>[k,(lowGood.includes(k)?v<0:v>0)?round(v*scale):v]));}
export function decisionFields(raw){const out={};for(const k of ['scopeScale','knowledgeGain'])if(raw[k]!==undefined){if(!Number.isFinite(raw[k])||raw[k]<0||raw[k]>(k==='scopeScale'?1:12))throw Error('自拟批复落实比例无效。');out[k]=raw[k];}if(raw.expensesIncluded!==undefined){if(typeof raw.expensesIncluded!=='boolean')throw Error('本案费用范围无效。');out.expensesIncluded=raw.expensesIncluded;}if(raw.petitionBudget!==undefined)out.petitionBudget=petitionBudget(raw.petitionBudget);return out;}
export function petitionBudgetLabel(b){return '首拨上限：银'+b.money+'万两、粮'+b.grain+'万石'+(b.monthly?'；月拨上限：银'+b.monthly.money+'万两、粮'+b.monthly.grain+'万石（'+(b.months?b.months+'个月':'办理期间')+(b.retain?'，结案后续办':'，结案停止')+'）':'；未批准后续月拨');}
