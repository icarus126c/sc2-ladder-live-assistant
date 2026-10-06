const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {dayKey}=require('./ladder.cjs');
function parseReplay(file,config){return new Promise((resolve,reject)=>{
  const exe=require('./runtime-paths.cjs').python();
  const child=spawn(exe,['-X','utf8','-W','ignore',path.join(__dirname,'parse-sc2-replay.py'),file,'--stdin'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');let out='',err='',settled=false;const timer=setTimeout(()=>{child.kill();finish(Error('解析超时，请重试或更换录像'));},15000);
  function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);}
  child.on('error',error=>finish(Error('便携 Python 启动失败：'+error.message)));child.stdout.on('data',b=>{out+=b.toString('utf8');if(out.length>500000){child.kill();finish(Error('录像解析输出过大'));}});child.stderr.on('data',b=>err=(err+b.toString('utf8')).slice(-2000));
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({toonHandle:config.toonHandle,names:config.names}));
  child.on('close',code=>{try{const p=JSON.parse(out);if(code||!p.ok)finish(Error(p.error||err||'解析失败'));else finish(null,p);}catch{finish(Error('录像解析器未返回有效数据：'+err));}});
});}
function createReplayWatcher({store,onUpdate=()=>{},parser=parseReplay,now=Date.now,intervalMs=4000}){
  let busy=false,closed=false,force=null,epoch=0,watch=null,lastRoot='',cache=new Map(),status={busy:false,message:'尚未扫描',lastScanAt:null,scanned:0,recorded:0,skipped:0,duplicates:0,errors:[],recent:[]};
  function files(root){const result=[];let visited=0;function walk(dir,depth){if(depth>12||visited++>2000)return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(result.length>=20000)return;const full=path.join(dir,e.name);if(e.isSymbolicLink())continue;if(e.isDirectory())walk(full,depth+1);else if(e.isFile()&&/\.SC2Replay$/i.test(e.name)){const s=fs.statSync(full);if(s.size>0&&s.size<100000000)result.push({file:full,size:s.size,mtime:s.mtimeMs});}}}walk(root,0);return result;}
  function configure(){epoch++;cache.clear();watch?.close();watch=null;lastRoot=store.getConfig().replayDirectory;if(lastRoot&&fs.existsSync(lastRoot)){try{watch=fs.watch(lastRoot,{recursive:true},()=>{force=force||'auto';});watch.on('error',()=>{});}catch{}}}
  async function scan(mode='today'){
    if(!['auto','today','recent'].includes(mode))throw Error('扫描模式无效');
    if(busy){force=mode;return snapshot();}if(closed)return snapshot();
    const c={...store.getConfig(),names:[...store.getConfig().names]},generation=epoch;
    if(!c.replayDirectory){status.message='请先设置录像目录';onUpdate();return snapshot();}
    if(!c.toonHandle&&!c.names.length&&!/(?:^|[\\/])\d+-S2-\d+-\d+(?:[\\/]|$)/.test(c.replayDirectory)){status.message='请指定完整账号或精确昵称，避免把其他账号录像记入';onUpdate();return snapshot();}
    const previous={...status};busy=true;status={...status,busy:true,message:'正在检查录像…',scanned:0,recorded:0,skipped:0,duplicates:0,errors:[],recent:mode==='auto'?status.recent:[]};onUpdate();
    try{
      let list=files(c.replayDirectory).filter(f=>now()-f.mtime>=1800);
      if(mode==='auto'||mode==='today')list=list.filter(f=>dayKey(f.mtime)===dayKey(now()));
      if(mode==='recent')list=list.sort((a,b)=>b.mtime-a.mtime).slice(0,30);
      // File mtime scopes the fast scan; replay timestamps decide the accounting date.
      list.sort((a,b)=>a.mtime-b.mtime);
      for(const f of list){if(closed||generation!==epoch)break;
        const stamp=[f.size,f.mtime,c.toonHandle,c.names.join('|')].join(':');if(mode==='auto'&&cache.get(f.file)===stamp)continue;
        try{
          const content=await fs.promises.readFile(f.file),hash=crypto.createHash('sha256').update(content).digest('hex');
          const p=await parser(f.file,c);const after=fs.statSync(f.file);if(after.size!==f.size||after.mtimeMs!==f.mtime)continue;
          if(closed||generation!==epoch)break;
          if(mode!=='recent'&&dayKey(p.at)!==dayKey(now())){cache.set(f.file,stamp);continue;}
          const result=store.acceptReplay(p,hash);status.scanned++;status[result.kind==='recorded'?'recorded':result.kind==='duplicate'?'duplicates':'skipped']++;
          status.recent.unshift({name:path.basename(f.file),kind:result.kind,message:result.message,at:p.at,players:p.players.map(x=>({name:x.name,toonHandle:x.toonHandle}))});status.recent=status.recent.slice(0,15);cache.set(f.file,stamp);onUpdate();
        }catch(error){status.errors.push({name:path.basename(f.file),message:error.message});status.errors=status.errors.slice(-15);onUpdate();}
      }
      status.message=`检查 ${status.scanned} 盘 · 新增/关联 ${status.recorded} · 已处理 ${status.duplicates} · 跳过 ${status.skipped}`+(status.errors.length?' · 部分解析失败，会重试':'');
    }catch(error){status.message='录像目录无法读取：'+error.message;}
    finally{busy=false;if(mode==='auto'&&status.scanned===0&&!status.errors.length&&!status.message.startsWith('录像目录无法'))status={...previous};status.busy=false;status.lastScanAt=now();onUpdate();}
    return snapshot();
  }
  function snapshot(){return{...status,busy};}
  const timer=setInterval(()=>{const c=store.getConfig();if(!closed&&c.enabled&&c.autoTrack&&!busy){const mode=force||'auto';force=null;scan(mode);}},intervalMs);timer.unref();configure();
  return{scan,snapshot,configure,close(){closed=true;epoch++;watch?.close();clearInterval(timer);}};
}
module.exports={createReplayWatcher,parseReplay};
