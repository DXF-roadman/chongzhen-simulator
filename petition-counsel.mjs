import * as game from './engine.mjs';
import {budgetFromPetitionText} from './petition-budget.mjs';

// Only the player's form or explicit words authorize the budget. AI estimates the need.
export function preparePetitionCommands(state,commands,{draft=null,input='',offline=false}={}){
 let items=commands,summary='';
 if(draft){
  const checked=game.petitionContext(state,draft).draft;
  if(items.length>1)throw Error('自拟批复须就本案拟定一份方案；额外任命、设署或其他独立事项请另行议定，尚未扣费。');
  const c=items[0];let source=null;
  if(checked.reference===null){
   source=c?.type==='edict'?c.plan:c?.type==='event'?c.custom?.plan:null;
   if(!source&&!offline)throw Error('AI 尚未给出本案的具体钱粮与办理方案，请先核算或重新拟答，本次未扣费。');
   if(c&&!['edict','event'].includes(c.type))throw Error('本案需要自拟处置方案，不能附带执行无关操作。');
  }
  const q=game.preparePetition(state,checked,source);items=[command(q)];summary=q.summary+(q.blocked.length?' 尚待议定：'+q.blocked.join(' '):'');
 }else{
  const budget=budgetFromPetitionText(input),events=items.filter(c=>c.type==='event'&&(c.custom||Number(c.index)>=0));
  if(budget&&events.length>1)throw Error('多个奏报的预算不能混用，请逐案明确批复。');
  items=items.map(c=>{
   if(c.type!=='event'||!c.custom&&!(budget&&Number(c.index)>=0))return c;
   const raw=c.custom?.draft||{text:input,reference:Number(c.index),official:c.official,petition:c.petition,eventId:c.eventId,eventTurn:c.eventTurn};
   const q=game.preparePetition(state,{...raw,...(budget?{budget}:{})},c.custom?.plan);summary=q.summary+(q.blocked.length?' 尚待议定：'+q.blocked.join(' '):'');return command(q);
  });
 }
 return {commands:items,summary};
}
function command(q){return {type:'event',eventId:q.draft.eventId,eventTurn:q.draft.eventTurn,petition:q.draft.petition,official:q.draft.official,custom:{draft:q.draft,plan:q.source}};}
