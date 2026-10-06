const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const outfits=require('./public/outfit-presets.js');
const LIMIT=32*1024*1024,assetURL=/^\/style-assets\/[a-f\d]{64}\.png$/;
const roles=['cover','frame','assistantFront','assistantRear','waiting','away'];
function object(v){return v&&typeof v==='object'&&!Array.isArray(v);}
function exact(v,keys,label){if(!object(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error(label+'格式不正确，不能包含未定义字段');}
function short(v,max,label,required=false){if(typeof v!=='string'||v.length>max||/[\r\n\0]/.test(v)||(required&&!v.trim()))throw Error(label+'格式不正确');return v.trim();}
function normalize(input){
 exact(input,['format','version','id','name','note','base','palette','templates','assets'],'风格包');
 if(input.format!=='sc2-style-pack'||input.version!==1)throw Error('支持 sc2-style-pack 第1版风格包');
 if(typeof input.id!=='string'||!/^[a-z][a-z0-9-]{2,47}$/.test(input.id)||input.id.startsWith('user-'))throw Error('风格ID需为3～48位小写字母、数字或短横线，以字母开头');
 if(!['anes','starcraft','naiwa','nahida','vesna'].includes(input.base))throw Error('请选择有效的基础风格');
 exact(input.palette,['dark','mid','accent','text'],'配色');
 for(const key of ['dark','mid','accent','text'])if(typeof input.palette[key]!=='string'||!/^#[a-f\d]{6}$/i.test(input.palette[key]))throw Error('配色需要四个完整的六位十六进制颜色');
 const templates=input.templates||{};exact(templates,['score','hud'],'模板');
 for(const k of ['score','hud'])if(k in templates&&!['compact','bluegold','dual'].includes(templates[k]))throw Error('计分器或信息栏模板不正确');
 exact(input.assets||{},roles,'素材');
 return{format:'sc2-style-pack',version:1,id:input.id,name:short(input.name,40,'风格名称',true),note:short(input.note||'',120,'风格说明'),base:input.base,palette:{...input.palette},templates:{...templates}};
}
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let crc=0xffffffff;for(const x of b)crc=crcTable[(crc^x)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function png(bytes,role){
 if(bytes.length>8*1024*1024||bytes.length<57||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('每张素材必须是8MB以内的PNG图片');
 let offset=8,header=null,end=false,idats=[];
 while(offset<bytes.length){if(offset+12>bytes.length)throw Error('PNG不完整');const length=bytes.readUInt32BE(offset),type=bytes.subarray(offset+4,offset+8).toString('ascii');if(length>bytes.length-offset-12)throw Error('PNG数据长度无效');const data=bytes.subarray(offset+8,offset+8+length),crc=bytes.readUInt32BE(offset+8+length);if(crc32(bytes.subarray(offset+4,offset+8+length))!==crc)throw Error('PNG校验失败');if(!header&&type!=='IHDR')throw Error('PNG图片头缺失');if(type==='IHDR'){if(header||length!==13)throw Error('PNG图片头无效');header={w:data.readUInt32BE(0),h:data.readUInt32BE(4),depth:data[8],color:data[9],compression:data[10],filter:data[11],interlace:data[12]};}if(type==='IDAT')idats.push(data);if(type==='IEND'){if(length!==0||offset+12!==bytes.length)throw Error('PNG结束标记无效');end=true;break;}offset+=length+12;}
 if(!end||!idats.length)throw Error('PNG缺少图像数据');const {w,h,depth,color,compression,filter,interlace}=header;
 if(w<1||h<1||w>4096||h>4096||w*h>9e6||depth!==8||![2,6].includes(color)||compression||filter||interlace)throw Error('请使用8位RGB/RGBA、非隔行PNG，最长边不超过4096像素');
 if(role==='frame'&&(w!==1920||h!==1080))throw Error('游戏边框素材尺寸应为1920×1080');
 if(['waiting','away'].includes(role)&&(w<1280||h<720||Math.abs(w/h-16/9)>.005))throw Error('等待与暂离背景需要16:9横屏，建议1920×1080，至少1280×720');
 if(['assistantFront','assistantRear'].includes(role)&&(w!==h*3||h<256||h>1024))throw Error('角色三态图须横排三个相等正方形状态，建议1536×512');
 if(['frame','assistantFront','assistantRear'].includes(role)&&color!==6)throw Error('边框和角色素材必须保留RGBA透明通道');
 const stride=w*(color===6?4:3),raw=zlib.inflateSync(Buffer.concat(idats),{maxOutputLength:(stride+1)*h});if(raw.length!==(stride+1)*h)throw Error('PNG像素数据不完整');
 if(color===6){const bpp=4;let previous=Buffer.alloc(stride),transparent=0,centerOpaque=0;const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<h;y++){const row=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1))),kind=raw[y*(stride+1)];if(kind>4)throw Error('PNG行过滤器无效');for(let x=0;x<stride;x++){const a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0;row[x]=(row[x]+(kind===1?a:kind===2?b:kind===3?Math.floor((a+b)/2):kind===4?paeth(a,b,c):0))&255;}for(let x=0;x<w;x++){const alpha=row[x*4+3];if(alpha===0)transparent++;if(role==='frame'&&y<750&&alpha!==0)centerOpaque++;}previous=row;}
  if(['frame','assistantFront','assistantRear'].includes(role)&&transparent<w*h*.05)throw Error('素材需有真正透明区域，不能用白底或棋盘格代替');
  if(role==='frame'&&centerOpaque>0)throw Error('边框上方750像素必须透明，请把装饰留在底部控制台区域');
 }
 return header;
}
function publicPreset(entry){const m=entry.manifest,p=outfits.presets[m.base],a=entry.assets;return{id:'user-'+m.id,name:m.name,note:m.note,base:m.base,scene:p.scene,frame:a.frame?'custom':p.frame,cat:a.assistantFront||a.assistantRear?'custom':p.cat,score:m.templates.score||p.score,hud:m.templates.hud||p.hud,accent:m.palette.accent,colors:[m.palette.dark,m.palette.mid,m.palette.accent],sceneSpec:{Color:m.palette.dark,ColorSecondary:m.palette.mid,Accent:m.palette.accent,TextColor:m.palette.text},assets:{...a},installed:true};}
function createStylePackStore(dataDir){
 const folder=dataDir&&path.join(dataDir,'style-packs'),index=folder&&path.join(folder,'index.json'),assetsFolder=dataDir&&path.join(dataDir,'style-assets');let entries=[];
 if(index&&fs.existsSync(index)){const saved=JSON.parse(fs.readFileSync(index,'utf8'));if(!Array.isArray(saved)||saved.length>30)throw Error('风格库数据格式不正确');entries=saved.map(e=>{const manifest=normalize({...e.manifest,assets:{}});exact(e.assets,roles,'已安装素材');for(const url of Object.values(e.assets))if(!assetURL.test(url)||!fs.existsSync(path.join(assetsFolder,path.basename(url))))throw Error('风格库素材缺失');return{manifest,assets:e.assets};});}
 function persist(next){if(!index)throw Error('此实例未配置风格保存目录');fs.mkdirSync(folder,{recursive:true});const temp=index+'.tmp';fs.writeFileSync(temp,JSON.stringify(next,null,2));fs.renameSync(temp,index);entries=next;}
 function list(){return entries.map(publicPreset);}
 async function install(req){if(!dataDir)throw Error('未配置风格保存目录');const chunks=[];let count=0;for await(const chunk of req){count+=chunk.length;if(count>LIMIT)throw Error('风格包请控制在32MB以内');chunks.push(chunk);}let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('请选择有效的.sc2style.json风格包');}const manifest=normalize(input);if(entries.length>=30)throw Error('最多保留30套已安装风格');if(entries.some(e=>e.manifest.id===manifest.id))throw Error('同ID风格已经存在，请修改ID或先移出旧风格');const prepared=[];for(const [role,data] of Object.entries(input.assets||{})){if(typeof data!=='string'||!/^data:image\/png;base64,[a-zA-Z0-9+/]+={0,2}$/.test(data))throw Error('素材应为内嵌PNG，不能引用网络或本机路径');const bytes=Buffer.from(data.slice(22),'base64');png(bytes,role);const name=crypto.createHash('sha256').update(bytes).digest('hex')+'.png';prepared.push({role,bytes,name});}
  const assets={};fs.mkdirSync(assetsFolder,{recursive:true});for(const {role,bytes,name} of prepared){const file=path.join(assetsFolder,name);if(!fs.existsSync(file)){const temporary=file+'.tmp';fs.writeFileSync(temporary,bytes);fs.renameSync(temporary,file);}assets[role]='/style-assets/'+name;}const entry={manifest,assets};persist([...entries,entry]);return publicPreset(entry);
 }
 function remove(id){const entry=entries.find(e=>'user-'+e.manifest.id===id);if(!entry)throw Error('未找到已安装风格');persist(entries.filter(e=>e!==entry));}
 function exportPack(id){const e=entries.find(e=>'user-'+e.manifest.id===id);if(!e)throw Error('只能导出已安装的风格');return{...e.manifest,assets:Object.fromEntries(Object.entries(e.assets).map(([role,url])=>[role,'data:image/png;base64,'+fs.readFileSync(path.join(assetsFolder,path.basename(url))).toString('base64')]))};}
 return{list,install,remove,exportPack,assetFile(url){return assetsFolder&&assetURL.test(url)?path.join(assetsFolder,path.basename(url)):null;}};
}
module.exports={createStylePackStore,normalize,png,assetURL,LIMIT};
