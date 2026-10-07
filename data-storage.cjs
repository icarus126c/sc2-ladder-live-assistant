const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const warnings=new Map(),validators=new Map();
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function readJSON(file,fallback,validate=()=>{}){
  if(!file)return fallback;
  validators.set(file,validate);
  const read=name=>{const value=JSON.parse(fs.readFileSync(name,'utf8'));validate(value);return value;};
  if(!fs.existsSync(file)&&!fs.existsSync(file+'.bak'))return fallback;
  try{return read(file);}catch{
    const damaged=fs.existsSync(file)?file+'.corrupt-'+crypto.randomUUID():null;
    if(damaged)fs.copyFileSync(file,damaged);
    let restored=false,value=fallback;
    try{value=read(file+'.bak');restored=true;}catch{}
    if(restored){fs.copyFileSync(file+'.bak',file+'.recovery.tmp');fs.renameSync(file+'.recovery.tmp',file);}
    else if(damaged)fs.unlinkSync(file);
    warnings.set(file,{file:path.basename(file),restored,message:restored?'数据异常，已恢复最近的有效备份；原文件已保留':'数据异常，已保留原文件并使用默认设置；请检查备份'});
    return value;
  }
}
function writeJSON(file,value){
  if(!file)return;
  const validate=validators.get(file)||(()=>{});validate(value);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  let previous=null;
  try{previous=fs.readFileSync(file,'utf8');validate(JSON.parse(previous));}catch{previous=null;}
  const content=JSON.stringify(value,null,2);
  fs.writeFileSync(file+'.tmp',content);
  if(previous!==null){fs.writeFileSync(file+'.bak.tmp',previous);fs.renameSync(file+'.bak.tmp',file+'.bak');}
  fs.renameSync(file+'.tmp',file);
  try{validate(JSON.parse(fs.readFileSync(file+'.bak','utf8')));}catch{fs.writeFileSync(file+'.bak.tmp',content);fs.renameSync(file+'.bak.tmp',file+'.bak');}
}
function recoveryWarnings(directory){if(!directory)return[];const root=path.resolve(directory)+path.sep;return [...warnings].filter(([file])=>path.resolve(file).startsWith(root)).map(([,value])=>({...value}));}
function backupData(directory){
  if(!directory)throw Error('未配置数据保存目录');
  const destination=path.join(directory,'backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'));
  fs.mkdirSync(destination,{recursive:true});let count=0;
  for(const name of ['records.json','settings.json','live-interactions.json','outfit-combinations.json','style-packs/index.json']){
    const file=path.join(directory,name);if(!fs.existsSync(file))continue;
    const value=JSON.parse(fs.readFileSync(file,'utf8'));validators.get(file)?.(value);
    const target=path.join(destination,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);count++;
  }
  return{at:Date.now(),files:count,path:destination};
}
module.exports={readJSON,writeJSON,object,recoveryWarnings,backupData};
