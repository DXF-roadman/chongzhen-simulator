import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||17628),url='http://127.0.0.1:'+port;
async function current(){try{const r=await fetch(url+'/api/bootstrap',{signal:AbortSignal.timeout(1000)});const b=await r.json();return b.catalog?.domains&&b.state?.version===1?b:null;}catch{return null;}}
async function main(){
if(process.argv.includes('--stop')){
 const b=await current();
 if(b){const r=await fetch(url+'/api/shutdown',{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':b.token},body:'{}'});await r.json();if(!r.ok)throw Error('Unable to stop game service');}
 console.log('Game service stopped.');return;
}
function openBrowser(){spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,detached:true,stdio:'ignore'}).unref();}
if(await current()){openBrowser();return;}
const data=path.join(root,'data');fs.mkdirSync(data,{recursive:true});
const out=fs.openSync(path.join(data,'server.log'),'a'),err=fs.openSync(path.join(data,'server-error.log'),'a');
const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,windowsHide:true,detached:true,stdio:['ignore',out,err]});
child.on('error',e=>console.error(e.message));child.unref();fs.closeSync(out);fs.closeSync(err);
fs.writeFileSync(path.join(data,'server.pid'),String(child.pid));
for(let i=0;i<40;i++){if(await current()){console.log('Game ready: '+url);openBrowser();return;}await new Promise(r=>setTimeout(r,250));}
throw Error('Startup failed. Check data/server-error.log.');
}
try{await main();}catch(e){console.error(e.message);process.exitCode=1;}
