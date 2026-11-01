// Clean provider echoes without interpreting text as executable commands.
const marker=/^\s*(?:(?:>\s*|#{1,6}\s*|[-*]\s+))?(?:\*\*)?(系统办理记录|拟议事项)(?:\*\*)?\s*[：:]\s*(.*)$/;
function endOfJSON(value){
 let depth=0,quoted=false,escaped=false,started=false;
 for(let i=0;i<value.length;i++){
  const ch=value[i];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
  if(ch==='"'){quoted=true;continue;}if(ch==='['||ch==='{'){started=true;depth++;}else if(ch===']'||ch==='}'){depth--;if(started&&depth===0)return i+1;}
 }
 return -1;
}
export function cleanCounselText(value){
 const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n'),out=[];let receipt=false;
 for(let i=0;i<lines.length;i++){
  const m=marker.exec(lines[i]);
  if(!m){
   if(receipt&&/^\s*(?:施政余力\s+\d|白银净支出\s|国势反馈[：:]|朝堂反应[：:]|在办事项[：:])/.test(lines[i]))continue;
   if(lines[i].trim())receipt=false;out.push(lines[i]);continue;
  }
  receipt=m[1]==='系统办理记录';if(receipt)continue;
  let payload=m[2].trim(),fenced=false;
  if(!payload&&i+1<lines.length&&/^\s*(?:[\[{]|\x60{3})/.test(lines[i+1]))payload=lines[++i].trim();
  if(/^\x60{3}(?:json)?\s*/i.test(payload)){fenced=true;payload=payload.replace(/^\x60{3}(?:json)?\s*/i,'');if(!payload&&i+1<lines.length)payload=lines[++i].trim();}
  if(/^[\[{]/.test(payload)){
   let end=endOfJSON(payload);
   while(end<0&&i+1<lines.length&&!marker.test(lines[i+1])){payload+='\n'+lines[++i];end=endOfJSON(payload);}
   if(end>=0){const remainder=payload.slice(end).replace(/^\s*\x60{3}\s*/,'').trim();if(remainder)out.push(remainder);}
   if(fenced&&i+1<lines.length&&/^\s*\x60{3}\s*$/.test(lines[i+1]))i++;
  }
 }
 return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
