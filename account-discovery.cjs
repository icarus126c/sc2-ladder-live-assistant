const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFile}=require('node:child_process');
const {parseReplay}=require('./replay-watcher.cjs');
const handlePattern=/^\d+-S2-\d+-\d+$/i;
const pathKey=p=>process.platform==='win32'?path.resolve(p).toLowerCase():path.resolve(p);
async function documentFolders(){
  const folders=[path.join(os.homedir(),'Documents')];
  for(const key of ['OneDrive','OneDriveConsumer','OneDriveCommercial'])if(process.env[key])folders.push(path.join(process.env[key],'Documents'));
  if(process.platform==='win32'){
    const documents=await new Promise(resolve=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); [Environment]::GetFolderPath('MyDocuments')"],{windowsHide:true,timeout:4000,encoding:'utf8'},(error,out)=>resolve(error?'':out.trim())));
    if(documents)folders.unshift(documents);
  }
  return [...new Map(folders.map(p=>[pathKey(p),p])).values()];
}
async function directories(dir){try{return(await fs.readdir(dir,{withFileTypes:true})).filter(e=>e.isDirectory()&&!e.isSymbolicLink());}catch{return [];}}
async function directoryExists(dir){try{return(await fs.lstat(dir)).isDirectory()&&!(await fs.lstat(dir)).isSymbolicLink();}catch{return false;}}
async function recentReplays(root){
  const files=[];let visited=0;
  async function walk(dir,depth){if(depth>6||++visited>500)return;let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{return;}
    for(const e of entries){if(files.length>=10000)return;if(e.isSymbolicLink())continue;const file=path.join(dir,e.name);if(e.isDirectory())await walk(file,depth+1);else if(e.isFile()&&/\.SC2Replay$/i.test(e.name)){try{const s=await fs.stat(file);if(s.size>0&&s.size<100000000)files.push({file,mtime:s.mtimeMs});}catch{}}}
  }
  await walk(root,0);return files.sort((a,b)=>b.mtime-a.mtime);
}
function folderHandle(dir){return path.resolve(dir).split(/[\\/]/).find(p=>handlePattern.test(p))?.toUpperCase()||'';}
async function discoverAccounts(config={},options={}){
  const folders=options.documents||await documentFolders(),found=new Map();
  async function add(toonHandle,replayDirectory){
    if(!await directoryExists(replayDirectory))return;
    const key=pathKey(replayDirectory);if(found.has(key))return;
    const files=await recentReplays(replayDirectory);
    found.set(key,{toonHandle,replayDirectory,lastReplayAt:files[0]?.mtime||null,replayCount:files.length});
  }
  const configured=config.replayDirectory||'',handle=configured&&folderHandle(configured);
  if(handle)await add(handle,configured);
  for(const documents of folders){
    const root=path.join(documents,'StarCraft II','Accounts');
    for(const account of (await directories(root)).slice(0,200)){
      const accountDir=path.join(root,account.name);
      for(const profile of await directories(accountDir))if(handlePattern.test(profile.name)){
        const replays=path.join(accountDir,profile.name,'Replays'),multiplayer=path.join(replays,'Multiplayer');
        await add(profile.name.toUpperCase(),await directoryExists(multiplayer)?multiplayer:replays);
      }
    }
  }
  const candidates=[...found.values()].sort((a,b)=>(b.lastReplayAt||0)-(a.lastReplayAt||0)||a.toonHandle.localeCompare(b.toonHandle));
  return {candidates,message:candidates.length?`找到 ${candidates.length} 个本机账号；选择自己使用的账号后保存。`:'没有找到本机账号目录。请先运行星际2并保存一盘录像，或手动填写录像目录与身份。'};
}
async function inspectAccount(config,replayDirectory,options={}){
  const {candidates}=await discoverAccounts(config,options),candidate=candidates.find(c=>pathKey(c.replayDirectory)===pathKey(replayDirectory));
  if(!candidate)throw Error('账号目录已变化，请重新自动读取');
  const files=await recentReplays(candidate.replayDirectory),parser=options.parser||parseReplay;
  for(const item of files.slice(0,3)){
    try{const parsed=await parser(item.file,{toonHandle:candidate.toonHandle,names:[],metadataOnly:true});
      const own=parsed.players?.filter(p=>p.human===true&&p.toonHandle===candidate.toonHandle);
      if(own?.length===1){const p=own[0],name=typeof p.name==='string'?p.name.trim():'';
        if(!name||name.length>60)continue;
        const plain=name.replace(/^<[^>]+>\s*/, '');
        return {...candidate,names:[...new Set([name,plain])].filter(Boolean),race:({Terran:'T',Protoss:'P',Zerg:'Z',Random:'R'})[p.race]||null,message:'已从本机账号目录读取 ID，并从该账号参与的录像读取昵称。点击“保存身份与录像目录”生效。'};
      }
    }catch{}
  }
  return {...candidate,names:[],race:null,message:'已从本机账号目录读取 ID；最近录像未能确认昵称。使用完整 ID 即可统计，点击“保存身份与录像目录”生效。'};
}
module.exports={discoverAccounts,inspectAccount,folderHandle};
