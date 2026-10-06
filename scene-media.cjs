const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const types={png:'image/png',jpg:'image/jpeg',webp:'image/webp',mp4:'video/mp4',webm:'video/webm'};
function detect(bytes){if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'png';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'jpg';if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return'webp';if(bytes.length>=12&&bytes.subarray(4,8).toString()==='ftyp')return'mp4';if(bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])))return'webm';return null;}
async function saveUpload(req,folder){
  fs.mkdirSync(folder,{recursive:true});const temporary=path.join(folder,'.upload-'+crypto.randomUUID()),handle=await fs.promises.open(temporary,'wx');let length=0,header=Buffer.alloc(0);const hash=crypto.createHash('sha256');
  try{for await(const chunk of req){length+=chunk.length;if(length>150*1024*1024)throw Error('视频请控制在150MB以内');if(header.length<32)header=Buffer.concat([header,chunk.subarray(0,32-header.length)]);hash.update(chunk);let at=0;while(at<chunk.length){const written=await handle.write(chunk,at,chunk.length-at);at+=written.bytesWritten;}}
    const ext=detect(header);if(!ext)throw Error('支持PNG、JPG、WebP图片和MP4、WebM视频');if(['png','jpg','webp'].includes(ext)&&length>8*1024*1024)throw Error('图片请控制在8MB以内');
    await handle.close();const name=hash.digest('hex')+'.'+ext;await fs.promises.rename(temporary,path.join(folder,name));return{url:'/scene-media/'+name,type:types[ext],kind:['mp4','webm'].includes(ext)?'video':'image',bytes:length};
  }catch(error){await handle.close().catch(()=>{});await fs.promises.unlink(temporary).catch(()=>{});throw error;}
}
function serve(req,res,file,ext){
  const size=fs.statSync(file).size,range=req.headers.range;res.setHeader('Content-Type',types[ext]);res.setHeader('Accept-Ranges','bytes');let start=0,end=size-1;
  if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end();}if(!m[1]){start=Math.max(0,size-Number(m[2]));}else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start> end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end();}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}
  res.setHeader('Content-Length',end-start+1);if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
module.exports={detect,saveUpload,serve,types};
