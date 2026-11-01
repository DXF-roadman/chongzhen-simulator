import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
test('现有钱粮和军务显示应拨、实拨、期末对账与边患抵消，浏览不改存档',()=>{
 let s=g.createGame();s=g.applyEdict(s,g.localEdict(s,'派人去辽东整兵，每月拨5万两，压制边患'),'yuan');s=g.advance({...s,event:null});const before=structuredClone(s),ctx=vm.createContext({initial:s,forecast:g.forecast(s),document:{querySelector:()=>null,addEventListener(){}},window:{},setTimeout(){},clearTimeout(){},fetch(){throw Error('UI browsing must not mutate');}});vm.runInContext(source,ctx);vm.runInContext('S=initial;F=forecast;',ctx);const bill=vm.runInContext('monthlyBillPanel()',ctx),border=vm.runInContext('borderPanel()',ctx);assert.match(bill,/月度拨款清单/);assert.match(bill,/应拨银/);assert.match(bill,/实拨银/);assert.match(bill,/期末/);assert.match(border,/边外动员/);assert.match(border,/辽东军实装/);assert.match(border,/实际变化/);assert.doesNotMatch(bill+border,/undefined|NaN/);assert.deepEqual(s,before);
});
