const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),presets=require('./public/outfit-presets.js'),{sanitize}=require('./ladder-replays.cjs');
function createCombinationStore(file=null){
 let combinations=[];
 if(file&&fs.existsSync(file)){const saved=JSON.parse(fs.readFileSync(file,'utf8'));for(const item of saved){if(/^combo-[a-f0-9]{16}$/.test(item.id)&&typeof item.name==='string'&&item.patch){const patch=presets.captureCombination(sanitize(item.patch));combinations.push({...item,patch,combination:true,installed:false});}}}
 const list=()=>combinations.map(p=>({...p,patch:{...p.patch},colors:[...p.colors]}));
 function persist(){if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(combinations,null,2));fs.renameSync(file+'.tmp',file);}
 function save(name,config){if(typeof name!=='string'||!name.trim()||[...name.trim()].length>40||/[\r\n\0]/.test(name))throw Error('搭配名称请填1～40字');name=name.trim();const existing=combinations.find(p=>p.name===name);if(!existing&&combinations.length>=12)throw Error('最多保存12套搭配，请先移除不需要的搭配');const item={id:existing?.id||'combo-'+crypto.randomBytes(8).toString('hex'),name,note:'自己搭配的游戏、等待与暂离外观',combination:true,installed:false,accent:config.waitingAccent,colors:[config.waitingColor,config.waitingColorSecondary,config.waitingAccent],patch:presets.captureCombination(config)};combinations=combinations.filter(p=>p.id!==item.id);combinations.push(item);persist();return item;}
 function remove(id){if(!combinations.some(p=>p.id===id))throw Error('保存的搭配不存在');combinations=combinations.filter(p=>p.id!==id);persist();}
 return{list,save,remove};
}
module.exports={createCombinationStore};
