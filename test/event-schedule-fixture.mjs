import * as g from '../engine.mjs';
export function calm(){const s=g.createGame({seed:7001});Object.assign(s,{money:5000,grain:5000,army:75,frontier:20,stability:80,event:null});for(const p of s.provinces)Object.assign(p,{drought:20,unrest:20,prosperity:65});return s;}
export function freshProgress(){const s=calm();s.turn=3;s.month=4;s.institutions.unshift({id:'canal-test',name:'新灌渠试点',domain:'agriculture',turn:2,date:'三月'});s.history.unshift({turn:2,date:'三月',title:'竣工 · 新灌渠试点',text:'水渠已验收',type:'project'});return s;}
export const firstReport={title:'灌渠轮灌章程待议',text:'新灌渠已经验收，邻村用水次序尚未商定。两村请订轮灌时日，地方官须按实际灌亩核定。',options:[{label:'核定轮灌',cost:{money:2},effects:{}},{label:'暂缓，先核实',cost:{},effects:{}}]};
