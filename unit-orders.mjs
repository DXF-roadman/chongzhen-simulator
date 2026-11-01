import {chineseNumber} from './fiscal-rules.mjs';
import {unitNeeds} from './unit-metadata.mjs';
const clean=v=>String(v||'').trim(),numbers='零〇一二两三四五六七八九十百千万\\d';
const positive=t=>clean(t).replace(/(?:不要|不许|暂不|不必|无需|别|勿).{0,5}(?:组建|筹建|筹备|新建|另建|建立|另设|密设)[^，。；\n]*/g,'');
export function newUnitRequest(input){const t=positive(input);return /组建|筹建|筹备|新建|另建|建立|另设|密设|另组|新组/.test(t)&&/部队|特种|别营|密营|亲军|新军|军队|独立[队营旅团]|卫队|火枪营|侦察[队营]|缉探/.test(t);}
function count(text){const m=new RegExp('(['+numbers+']+)\\s*(?:名|人)(?:兵|卫|士|勇|精锐|口风|，|、|。|\\s|$)?').exec(text);if(!m)return null;const n=chineseNumber(m[1]);return Number.isInteger(n)&&n>0&&n<=1000000?n:null;}
function portalSupply(text){return /虫洞|门中|门内|时空/.test(text)&&/供|提供|支给|取|不占|不动/.test(text)&&!/(?:不要|不许|不从|不用|别).{0,4}(?:虫洞|门中|时空)/.test(text);}
function existingAuthorized(text,u){const escaped=u.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),t=text.replace(/(?:不要|不动|不许|别|不列|不属)[^，。；\n]{0,12}/g,'');return new RegExp('(?:给|为|替|将|把)'+escaped+'.{0,8}(?:配|换|整备|装备)|'+escaped+'.{0,6}(?:换装|配发|整备|改编)').test(t);}
export function inferUnitBirth(s,text,{target='council',name='',estimate='',raw={}}={}){
 const named=/(?:命名为|名为|称为|取名为)\s*[“「"]?([^，。；\n”」"]{2,30})/.exec(text)?.[1],secret=/秘密|密设|密营|别营|保密|隐秘|不列.{0,5}名册/.test(text+' '+estimate),n=count(text)??count(estimate),institution=target.startsWith('office:')||target.startsWith('agency:')?target:raw.institution;
 const funding=portalSupply(text)?'portal':'treasury',needs=n?{infantry:n}:raw.needs?unitNeeds(raw.needs):{infantry:100};
 return {type:'arsenal',operation:'create_unit',name:(named||raw.name||name||(institution==='office:guards'?'锦衣卫'+(secret?'缉探别营':'特勤队'):secret?'秘密特种队':'新编独立队')).slice(0,40),region:raw.region||(/辽东|蓟镇|边外/.test(text+' '+estimate)?'liaodong':/陕西/.test(text+' '+estimate)?'shaanxi':'capital'),needs,secret,funding,...(institution?{institution}:{})};
}
export function inferUnitCommands(s,text,context={}){
 if(!newUnitRequest(text))return [];
 const c=inferUnitBirth(s,text,context),future=/现代|未来|超时代|虫洞|时空|机甲|高达/.test(text);
 return [...((future||c.funding==='portal')&&!s.traveler?.enabled?[{type:'horizon',operation:'mode',enabled:true}]:[]),c,{type:'arsenal',operation:'modernize',unit:c.name,profile:/机甲|高达/.test(text)?'mecha':/坦克|装甲/.test(text)?'mechanized':'balanced',source:future?'portal':'period'}];
}
export function prepareUnitCommands(s,raw,{input='',target='council'}={}){
 if(!newUnitRequest(input))return raw;
 const commands=structuredClone(raw),creators=commands.filter(c=>c.type==='arsenal'&&c.operation==='create_unit');
 if(creators.length>1)throw Error('一次新军交办出现多个独立编制，请分别明确名称与配装对象，本次未执行。');
 const descriptions=commands.filter(c=>c.type==='edict'&&newUnitRequest(c.text||c.plan?.narrative)),proposal=descriptions[0],creation=inferUnitBirth(s,input,{target,name:proposal?.plan?.title,estimate:proposal?.text||proposal?.plan?.narrative||'',raw:creators[0]||{}}),newName=creation.name;
 if(s.militaryState.units.some(u=>u.name===newName))throw Error('已有同名部队，不能把再次组建改成现有部队换装，请明确新的独立名称。');
 const out=[];let gear=false,commander=false;
 for(const c of commands){
  if(c.type==='arsenal'&&c.operation==='create_unit'||descriptions.includes(c))continue;
  if(c.type==='horizon'&&c.operation==='resources'&&creation.funding==='portal'&&!new RegExp('['+numbers+']+\\s*(?:万|亿)?(?:两|石)').test(input))continue;
  if((c.type==='arsenal'&&['equip','modernize','template'].includes(c.operation))||(c.type==='horizon'&&c.operation==='summon_mecha')||(c.type==='war'&&c.operation==='commander')){
   const old=s.militaryState.units.find(u=>u.id===c.unit||u.name===c.unit);
   if(!old||!existingAuthorized(input,old)){c.unit=newName;delete c.scope;if(c.operation==='modernize')c.source=/现代|未来|超时代|虫洞|时空|机甲|高达/.test(input)?'portal':'period';if(c.operation==='equip'&&creation.funding==='portal')c.source='portal';if(c.operation==='template')throw Error('独立小队的编制已另列，不能附带用大军模板覆盖，请重拟。');gear||=['equip','modernize','summon_mecha'].includes(c.operation);commander||=c.operation==='commander';}
  }
  out.push(c);
 }
 const inferred=inferUnitCommands(s,input,{target}),mode=out.find(c=>c.type==='horizon'&&c.operation==='mode');if(!s.traveler?.enabled&&inferred.some(c=>c.operation==='mode')&&!mode)out.unshift({type:'horizon',operation:'mode',enabled:true});
 const modeIndex=out.findIndex(c=>c.type==='horizon'&&c.operation==='mode'&&c.enabled);out.splice(modeIndex<0?0:modeIndex+1,0,creation);
 if(!gear)out.push({...inferred.at(-1),unit:newName});
 const official=proposal?.official||(creation.institution?.startsWith('office:')?s.government.officeLeaders[creation.institution.slice(7)]:s.agencies.find(a=>'agency:'+a.id===creation.institution)?.leader);
 if(!commander&&official)out.push({type:'war',operation:'commander',unit:newName,official});
 if(out.length>6)throw Error('新建、配装和指挥需完整交办，连同其他事项超过六项，请拆分旨意。');return out;
}
