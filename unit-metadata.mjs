const categories=['infantry','artillery','armor','aircraft','ships','mecha'];
export function unitNeeds(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.entries(raw).some(([k,n])=>!categories.includes(k)||!Number.isInteger(n)||n<0||n>1000000))throw Error('独立部队编制须列明有效装备类别与人数/数量。');
 const needs=Object.fromEntries(Object.entries(raw).filter(([,n])=>n>0));if(!Object.keys(needs).length)throw Error('独立部队编制须至少保留一个有效装备类别。');return needs;
}
export function unitMetadata(raw){
 const out={};if(raw.secret!==undefined){if(typeof raw.secret!=='boolean')throw Error('部队保密标记无效。');out.secret=raw.secret;}
 if(raw.funding!==undefined){if(!['treasury','portal'].includes(raw.funding))throw Error('部队供给来源无效。');out.funding=raw.funding;}
 if(raw.institution!==undefined){if(typeof raw.institution!=='string'||! /^(?:office|agency):[\w-]+$/.test(raw.institution))throw Error('部队隶属机构无效。');out.institution=raw.institution;}
 return out;
}
