import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {economicPlan,activateEconomic} from '../economic-effects.mjs';
const source=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').split("\n$('#modal').addEventListener")[0];
test('钱粮页列出税源与合计，月结后显示上期实解，浏览本身不调用AI或变更国库',()=>{
 let s=g.createGame();s.turn=4;s.month=5;activateEconomic(s,{...economicPlan({},s,'于泉州设市舶税关，通商抽分，千两抽三，万两抽五'),edictTurn:1},'泉州开海抽分',2);s=g.advance({...s,event:null});const old=structuredClone(s);
 const ctx=vm.createContext({initial:s,forecast:g.forecast(s),document:{querySelector:()=>null,addEventListener(){}},window:{},setTimeout(){},clearTimeout(){},fetch(){throw Error('Browsing must not make requests');}});vm.runInContext(source,ctx);vm.runInContext('S=initial;F=forecast;',ctx);const html=vm.runInContext('economicIncomePanel()',ctx);assert.match(html,/持续税源与月解明细/);assert.match(html,/泉州/);assert.match(html,new RegExp('海关实解 '+g.forecast(s).customsRevenue));assert.match(html,/上期海关已解部/);assert.match(html,/已经包含在上方总税入/);assert.doesNotMatch(html,/undefined|NaN/);assert.deepEqual(s,old);
});
