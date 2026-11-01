import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {cleanCounselText} from '../counsel-text.mjs';
import {readCounselReply,buildCounselMessages} from '../counsel.mjs';
const tail='\n系统办理记录：仅作商议，本次没有改变钱粮、人事或施政次数。\n拟议事项：[]';
test('截图中的后台尾注从正文清除，保留完整政策建议',()=>{
 const advice='臣议先清核宗籍，给贫宗自食其力之路。\n\n陛下若准，臣即拟出宗禄章程，先从河南、山西试起。';
 assert.equal(cleanCounselText(advice+tail),advice);
 assert.equal(readCounselReply({reply:advice+tail,commands:[]}).reply,advice);
 assert.equal(cleanCounselText(advice),advice);
});
test('多行命令、代码围栏和办理摘要不冒充朝臣发言，也不会被转成操作',()=>{
 const content='臣请先核户部账目。\n系统办理记录：已办理。\n施政余力 3 → 2；白银净支出 8。\n国势反馈：贪腐 -2。\n拟议事项：\n[\n {"type":"office","office":"revenue","official":"bi","note":"引号中的 ] 不结束数组"}\n]\n\n若核账有误，仍须再查。';
 assert.equal(cleanCounselText(content),'臣请先核户部账目。\n\n若核账有误，仍须再查。');
 const fenced='臣请先核账。\n**拟议事项**：\n'+String.fromCharCode(96).repeat(3)+'json\n[{"type":"policy","tax":1.4}]\n'+String.fromCharCode(96).repeat(3)+'\n臣另请抚民。';
 assert.equal(cleanCounselText(fenced),'臣请先核账。\n臣另请抚民。');
 assert.deepEqual(readCounselReply({reply:content,commands:[]}).commands,[]);
 assert.throws(()=>readCounselReply({reply:tail,commands:[]}),/有效答复/);
});
test('合法谈论与玩家原文保留，旧助手记录只清正文，不改变办理凭据',()=>{
 const s=g.createGame({seed:771}),advice='臣以为拟议事项应分两步，系统办理记录可留待核对。';
 s.discussions=[{id:'council',name:'御前议政',messages:[
 {role:'user',content:'为什么出现“系统办理记录：”？\n拟议事项：[]',commands:[],result:null},
 {role:'assistant',content:advice+tail,source:'ai',commands:[{type:'action',action:'audit'}],result:{status:'discussed',text:'仅作商议'},turn:0,date:'1628 · 正月'}
 ]}];
 const loaded=g.validateSave(s);assert.equal(loaded.discussions[0].messages[0].content,s.discussions[0].messages[0].content);
 const m=loaded.discussions[0].messages[1];assert.equal(m.content,advice);assert.deepEqual(m.commands,s.discussions[0].messages[1].commands);assert.deepEqual(m.result,s.discussions[0].messages[1].result);assert.equal(loaded.money,s.money);
});
test('模型历史只有对话，办理与待办状态放入独立后台消息，照办仍保有上下文',()=>{
 const s=g.createGame({seed:772}),commands=[{type:'office',office:'revenue',official:'bi'}],result={status:'blocked',text:'本月余力不足，本次整批未执行'};
 const history=[{role:'user',content:'任命毕自严为户部尚书'},{role:'assistant',content:'臣请先核钱粮。'+tail,commands,result}];
 const messages=buildCounselMessages(s,{id:'council'},'照办',history,false),assistant=messages.find(m=>m.role==='assistant');
 assert.equal(assistant.content,'臣请先核钱粮。');assert.doesNotMatch(assistant.content,/系统办理记录|拟议事项/);
 const receipts=messages.filter(m=>m.role==='system')[1].content;assert.match(receipts,/blocked/);assert.match(receipts,/revenue/);assert.match(receipts,/本月余力不足/);
 assert.equal(messages.at(-1).content,'照办');assert.equal(history[1].content,'臣请先核钱粮。'+tail);
});
