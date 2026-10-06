const {createCombinationStore}=require('./outfit-combinations.cjs');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const gameFrame=require('./public/gameframe-template.js');
const sceneMedia=require('./scene-media.cjs');
const outfitPresets=require('./public/outfit-presets.js');
const {createStylePackStore}=require('./style-packs.cjs');
const {createInteractionStore,normalizeBiliEvent}=require('./live-interactions.cjs'),{createBilibiliClient}=require('./bilibili-live.cjs');
const {createKeyboardInput}=require('./keyboard-input.cjs');
const {createReplayStore}=require('./ladder-replays.cjs'),{createReplayWatcher}=require('./replay-watcher.cjs'),{createSc2Monitor}=require('./sc2.cjs');
const defaults={sc2AutoEnabled:true,sc2AutoPaused:false,sc2AutoMode:'ladder',sc2ClientPort:6119,sc2StartDelay:0,sc2EndDelay:0,sc2IncludeReplays:false,obsMapping:{game:'',intermission:'',loading:'',break:'',blank:''}};
function sanitize(input,base=defaults){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('设置格式错误');const c={...base,obsMapping:{...base.obsMapping}};
  for(const k of ['sc2AutoEnabled','sc2AutoPaused','sc2IncludeReplays'])if(k in input){if(typeof input[k]!=='boolean')throw Error('开关格式错误');c[k]=input[k];}
  for(const [k,min,max]of [['sc2ClientPort',1024,65535],['sc2StartDelay',0,10],['sc2EndDelay',0,60]])if(k in input){if(!Number.isFinite(input[k])||(k==='sc2ClientPort'&&!Number.isInteger(input[k]))||input[k]<min||input[k]>max)throw Error('切换设置超出范围');c[k]=input[k];}
  if(input.obsMapping){for(const k of ['game','intermission','loading','break','blank'])if(k in input.obsMapping){if(typeof input.obsMapping[k]!=='string'||input.obsMapping[k].length>150)throw Error('OBS场景名称无效');c.obsMapping[k]=input.obsMapping[k];}}
  return c;
}
function createAssistant({port=17864,dataDir=path.join(__dirname,'.ladder-data'),sc2Reader,now=Date.now,parser,intervalMs,keyboardSpawn,biliOptions={}}={}){
  const token=crypto.randomBytes(24).toString('hex'),clients=new Set(),keyboardClients=new Set(),settings=dataDir?path.join(dataDir,'settings.json'):null;
  let config={...defaults,obsMapping:{...defaults.obsMapping}},scene='intermission',revision=0,lastOutfit=null;
  const canUndoOutfit=()=>!!lastOutfit&&Object.entries(lastOutfit.after).every(([k,v])=>ladder.getConfig()[k]===v);
  if(settings&&fs.existsSync(settings))config=sanitize(JSON.parse(fs.readFileSync(settings,'utf8')));
  const ladder=createReplayStore(dataDir?path.join(dataDir,'records.json'):null,now);
  const interactions=createInteractionStore(dataDir?path.join(dataDir,'live-interactions.json'):null,{now});
  const stylePacks=createStylePackStore(dataDir);
  const combinations=createCombinationStore(dataDir?path.join(dataDir,'outfit-combinations.json'):null);
  const snapshot=()=>({config,scene,transition:null,revision,appVersion:'2.3.0',stylePacks:stylePacks.list(),interaction:{...interactions.snapshot(),connection:bili.snapshot()},outfit:{combinations:combinations.list(),lastName:lastOutfit?.name||null,canUndo:canUndoOutfit()},ladder:ladder.snapshot(),automation:sc2.snapshot(),replays:watcher.snapshot(),keyboard:{status:keyboard.snapshot().status},serverNow:now()});
  const broadcast=()=>{revision++;for(const res of clients)res.write(`data: ${JSON.stringify(snapshot())}\n\n`);};
  function persist(){if(!settings)return;fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(settings+'.tmp',JSON.stringify(config,null,2));fs.renameSync(settings+'.tmp',settings);}
  const sc2=createSc2Monitor({getConfig:()=>config,getScene:()=>({scene}),transition:target=>{scene=target;broadcast();},onUpdate:broadcast,onSample:ladder.observe,reader:sc2Reader,intervalMs:100,now,shouldPoll:()=>ladder.getConfig().enabled&&ladder.getConfig().autoTrack});
  const watcher=createReplayWatcher({store:ladder,onUpdate:broadcast,parser,now,intervalMs});
  let liveUpdateTimer=null;const queueLiveUpdate=()=>{if(!liveUpdateTimer){liveUpdateTimer=setTimeout(()=>{liveUpdateTimer=null;broadcast();},300);liveUpdateTimer.unref();}};
  const bili=createBilibiliClient({...biliOptions,now,onRoom:roomId=>interactions.configure({roomId}),onEvent:event=>{interactions.ingest(event);queueLiveUpdate();},onUpdate:queueLiveUpdate});
  const liveTicker=setInterval(()=>{if(interactions.tick())broadcast();},1000);liveTicker.unref();
  let lastKeyboardStatus='disabled';const keyboard=createKeyboardInput({getConfig:()=>ladder.getConfig(),spawnWorker:keyboardSpawn,now,onUpdate:frame=>{for(const res of keyboardClients)res.write(`data: ${JSON.stringify(frame)}\n\n`);if(frame.status!==lastKeyboardStatus){lastKeyboardStatus=frame.status;broadcast();}}});
  const routes={'/':'ladder.html','/assistant':'ladder.html','/assistant.js':'ladder-ui.js','/assistant.css':'assistant.css','/workspace.js':'workspace.js','/workspace.css':'workspace.css','/cat-workspace.js':'cat-workspace.js','/cat-keyboard':'cat-keyboard.html','/cat-keyboard-template.js':'cat-keyboard-template.js','/cat-keyboard.js':'cat-keyboard.js','/cat-keyboard.css':'cat-keyboard.css','/assets/cat-keyboard-v2.png':'assets/cat-keyboard-v2.png','/assets/cat-keyboard-rear-v1.png':'assets/cat-keyboard-rear-v1.png','/gameframe':'gameframe.html','/gameframe-template.js':'gameframe-template.js','/gameframe.js':'gameframe.js','/gameframe.css':'gameframe.css','/scoreboard':'scoreboard.html','/scoreboard.js':'scoreboard.js','/scoreboard.css':'scoreboard.css','/output':'ladder-output.html','/ladder-output.js':'ladder-output.js','/ladder-output.css':'ladder-output.css','/ladder-overlay.js':'ladder-overlay.js','/ladder-overlay.css':'ladder-overlay.css','/obs.js':'obs.js','/favicon.svg':'favicon.svg','/assets/cnzs-logo.png':'assets/cnzs-logo.png','/assets/bluegold-logo.png':'assets/bluegold-logo.png','/assets/nailong-meme-v1.png':'assets/nailong-meme-v1.png'};
  for(const file of ['scene-themes.js','scene-themes.css','scene-workspace.js','scene-video.js','usage-ui.js','usage-ui.css','outfit-presets.js','outfit-workspace.js','outfit-workspace.css','live-workspace.js','live-workspace.css','live-overlay.js','live-overlay.css'])routes['/'+file]=file;
  for(const file of ['nahida-keys-v1.png','vesna-keys-v1.png','naiwa-keys-v1.png','nahida-frame-v1.png','starcraft-scene-v1.png'])routes['/assets/'+file]='assets/'+file;
  for(const f of ['nicole-frame-v1.png','nicole-keys-v1.png','nicole-waiting-v1.png','nicole-away-v1.png'])routes['/assets/'+f]='assets/'+f;
  routes['/assets/control-reference.png']='assets/control-reference.png';routes['/live-interaction']='live-interaction.html';routes['/daily-data']='daily-data.html';routes['/sponsor']='sponsor.html';for(const f of ['daily-model.js','daily-overlay.js','daily-overlay.css','daily-workspace.js','daily-workspace.css','sponsor.js','sponsor.css'])routes['/'+f]=f;for(const f of ['wechat.png','alipay.png'])routes['/sponsorship/'+f]='sponsorship/'+f;
  routes['/waiting-screen']=routes['/away-screen']=routes['/loading-screen']='ladder-output.html';
  for(const f of ['scene-customization.js','scene-editor.js','scene-editor.css','scene-editor-preview.js'])routes['/'+f]=f;
  for(const file of ['style-pack-workspace.js','style-pack.css','style-pack-prompt.txt','style-pack-example.json'])routes['/'+file]=file;
  const server=http.createServer(async(req,res)=>{
    const actual=server.address()?.port||port,hosts=[`127.0.0.1:${actual}`,`localhost:${actual}`];res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    if(!hosts.includes(req.headers.host))return json(403,{error:'仅支持本机访问'});
    try{const url=new URL(req.url,`http://127.0.0.1:${actual}`);
      if(req.method==='GET'&&url.pathname==='/api/live-export'){
        if(req.headers['x-control-token']!==token||(req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`)))return json(403,{error:'请从本地助手导出'});
        const kind=url.searchParams.get('kind'),content=interactions.exportCSV(kind);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Bilibili-'+(kind==='income'?'Income':'Winners')+'.csv"'});return res.end(content);
      }
      if(req.method==='GET'&&url.pathname==='/api/state')return json(200,snapshot());
      if(req.method==='GET'&&url.pathname==='/api/style-pack-export'){
        if(req.headers['x-control-token']!==token||(req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`)))return json(403,{error:'请从本地助手导出'});
        const pack=stylePacks.exportPack(url.searchParams.get('id'));res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="${pack.id}.sc2style.json"`});return res.end(JSON.stringify(pack,null,2));
      }
      if(req.method==='POST'&&url.pathname==='/api/style-pack-install'){
        if(req.headers['x-control-token']!==token||(req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`)))return json(403,{error:'请从本地助手安装'});
        const pack=await stylePacks.install(req);broadcast();return json(200,{pack,state:snapshot()});
      }
      if(req.method==='GET'&&/^\/style-assets\/[a-f\d]{64}\.png$/.test(url.pathname)){
        const file=stylePacks.assetFile(url.pathname);if(!file||!fs.existsSync(file))return json(404,{error:'风格素材不存在'});res.writeHead(200,{'Content-Type':'image/png'});return res.end(fs.readFileSync(file));
      }
      if(['GET','HEAD'].includes(req.method)&&/^\/scene-media\/[a-f\d]{64}\.(png|jpg|webp|mp4|webm)$/.test(url.pathname)){
        const file=dataDir&&path.join(dataDir,'media',path.basename(url.pathname));if(!file||!fs.existsSync(file))return json(404,{error:'媒体文件不存在'});return sceneMedia.serve(req,res,file,path.extname(file).slice(1));
      }
      if(req.method==='POST'&&url.pathname==='/api/scene-media'){
        if(req.headers['x-control-token']!==token||(req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`)))return json(403,{error:'请从本地助手操作'});
        if(!dataDir)throw Error('未配置媒体保存目录');return json(200,await sceneMedia.saveUpload(req,path.join(dataDir,'media')));
      }
      if(req.method==='GET'&&url.pathname==='/gameframe.svg'){const c=ladder.getConfig(),assets={};for(const [key,file]of Object.entries({nailong:'nailong-meme-v1.png',anes:'bluegold-logo.png',naiwa:'naiwa-keys-v1.png',nahida:'nahida-frame-v1.png',vesna:'vesna-keys-v1.png',nicole:'nicole-frame-v1.png'}))if(c.gameFrameStyle===key)assets[key]='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'public','assets',file)).toString('base64');if(c.gameFrameStyle==='custom'){const f=stylePacks.assetFile(c.gameFrameImage);if(f&&fs.existsSync(f))assets.customFrame='data:image/png;base64,'+fs.readFileSync(f).toString('base64');}res.writeHead(200,{'Content-Type':'image/svg+xml','Content-Disposition':'attachment; filename="SC2-Console-Frame.svg"'});return res.end(gameFrame.build(c,{assets}));}
      if(req.method==='GET'&&url.pathname==='/frame-reference.png'){const localReference=path.join(__dirname,'work','control-reference.png'),reference=fs.existsSync(localReference)?localReference:path.join(__dirname,'public','assets','control-reference.png');if(!fs.existsSync(reference))return json(404,{error:'预览参考图未提供'});res.writeHead(200,{'Content-Type':'image/png'});return res.end(fs.readFileSync(reference));}
      if(req.method==='GET'&&url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});clients.add(res);res.write(`retry: 1000\ndata: ${JSON.stringify(snapshot())}\n\n`);req.on('close',()=>clients.delete(res));return;}
      if(req.method==='GET'&&url.pathname==='/api/keyboard-events'){res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});keyboardClients.add(res);res.write(`retry: 1000\ndata: ${JSON.stringify(keyboard.snapshot())}\n\n`);req.on('close',()=>keyboardClients.delete(res));return;}
      if(req.method==='GET'&&/^\/waiting-backgrounds\/[a-f\d]{64}\.(png|jpg|webp)$/.test(url.pathname)){
        const file=dataDir&&path.join(dataDir,'backgrounds',path.basename(url.pathname));if(!file||!fs.existsSync(file))return json(404,{error:'背景图不存在'});
        res.writeHead(200,{'Content-Type':{'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[path.extname(file)]});return res.end(fs.readFileSync(file));
      }
      if(req.method==='POST'&&url.pathname==='/api/waiting-background'){
        if(req.headers['x-control-token']!==token||(req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`)))return json(403,{error:'请从本地助手操作'});
        if(!dataDir)throw Error('未配置背景图保存目录');
        const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>8*1024*1024)throw Error('背景图请控制在8MB以内');chunks.push(chunk);}const bytes=Buffer.concat(chunks);
        const ext=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'webp':null;
        if(!ext)throw Error('只支持PNG、JPG或WebP图片');
        const name=crypto.createHash('sha256').update(bytes).digest('hex')+'.'+ext,folder=path.join(dataDir,'backgrounds');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,name),bytes);
        return json(200,{url:'/waiting-backgrounds/'+name});
      }
      if(req.method==='POST'&&url.pathname==='/api/action'){
        if(req.headers['x-control-token']!==token||(req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`)))return json(403,{error:'请从本地助手操作'});
        const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>50000)throw Error('请求过大');chunks.push(chunk);}const i=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        switch(i.action){
          case'liveConnect':interactions.configure({roomId:i.roomId,mode:i.mode});await bili.connect({roomId:i.roomId,mode:i.mode,credentials:i.credentials});break;
          case'liveDisconnect':await bili.disconnect();break;
          case'liveConfigure':interactions.configure(i.config);break;
          case'liveIncome':interactions.updateIncome(i);break;
          case'liveGiftExclude':interactions.excludeGift(i.id,i.excluded);break;
          case'liveRaffleStart':interactions.startRound(i);break;
          case'liveRaffleClose':interactions.closeRound();break;
          case'liveRaffleDraw':interactions.draw();break;
          case'liveRaffleCancel':interactions.cancelRound();break;
          case'liveRaffleImport':interactions.importEntries(i.lines);break;
          case'liveRaffleCount':interactions.changeWinnerCount(i.value);break;
          case'liveEvent':{const event=normalizeBiliEvent(i.event,{roomId:interactions.getConfig().roomId,now});if(!event)throw Error('直播事件格式不正确或暂不支持');interactions.ingest(event);break;}
          case'stylePackRemove':stylePacks.remove(i.id);break;
          case'outfitApply':{const installed=[...stylePacks.list(),...combinations.list()],choice=outfitPresets.normalize(i.choice,installed),beforeConfig=ladder.getConfig(),after=outfitPresets.buildPatch(beforeConfig,choice,installed),before=Object.fromEntries(Object.keys(after).map(k=>[k,beforeConfig[k]]));ladder.configure(after);lastOutfit={name:outfitPresets.resolve(choice.preset,installed).name,before,after};watcher.configure();keyboard.configure();break;}
          case'outfitSave':combinations.save(i.name,ladder.getConfig());break;
          case'outfitRemove':combinations.remove(i.id);break;
          case'outfitUndo':if(!canUndoOutfit())throw Error('换装后已另行调整外观，或没有可撤销的换装');ladder.configure(lastOutfit.before);lastOutfit=null;watcher.configure();keyboard.configure();break;
          case'ladderConfigure':ladder.configure(i.config);watcher.configure();keyboard.configure();break;
          case'catResume':keyboard.configure({reset:true});break;
          case'ladderMMR':ladder.updateMMR(i.value);break;
          case'ladderRecord':ladder.add(i.result,{opponent:i.opponent,at:i.at});break;
          case'ladderEdit':ladder.edit(i.id,i.patch||{});break;
          case'ladderUndo':ladder.undo(i.scope||'today');break;
          case'replayScan':await watcher.scan(i.mode||'today');break;
          case'replayResolve':ladder.resolve(i.key,i.recordId,i.newRecord===true);break;
          case'sc2Check':await sc2.poll();break;
          case'configure':{const before=config;config=sanitize(i.config,config);sc2.configure(before);persist();break;}
          case'transition':case'cut':{if(!['game','intermission','loading','break','blank'].includes(i.scene))throw Error('场景无效');scene=i.scene;if(config.sc2AutoEnabled){const before=config;config={...config,sc2AutoPaused:true};sc2.configure(before);persist();}break;}
          default:throw Error('未知操作');
        }broadcast();return json(200,snapshot());
      }
      if(req.method!=='GET')return json(405,{error:'不支持此请求'});
      const file=routes[url.pathname];if(!file)return json(404,{error:'页面不存在'});
      const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
      let content=fs.readFileSync(path.join(__dirname,'public',file));if(file==='ladder.html')content=Buffer.from(content.toString('utf8').replace('__CONTROL_TOKEN__',token));res.writeHead(200,{'Content-Type':types[ext]});res.end(content);
    }catch(error){json(400,{error:error.message});}
  });
  const heartbeat=setInterval(()=>{for(const res of [...clients,...keyboardClients])res.write(': heartbeat\n\n');},15000);heartbeat.unref();keyboard.configure();
  return{server,snapshot,ladder,watcher,sc2,keyboard,interactions,bili,close(){clearInterval(liveTicker);if(liveUpdateTimer)clearTimeout(liveUpdateTimer);bili.close();clearInterval(heartbeat);watcher.close();sc2.close();keyboard.close();for(const r of [...clients,...keyboardClients])r.end();server.close();server.closeAllConnections?.();}};
}
if(require.main===module){
  const port=Number(process.env.SC2_LADDER_PORT||17864);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('天梯服务端口无效');
  let app;try{app=createAssistant({port});}catch(error){console.error('保存数据无法读取，请先备份 .ladder-data 后检查：'+error.message);process.exit(1);}
  app.server.on('error',async error=>{if(error.code==='EADDRINUSE'){try{const s=await(await fetch(`http://127.0.0.1:${port}/api/state`,{signal:AbortSignal.timeout(3000)})).json();if(s.replays&&['2.1.0','2.2.0','2.3.0'].includes(s.appVersion)){console.log(`助手已在运行，无需重复启动。请打开 http://127.0.0.1:${port}/`);if(process.argv.includes('--open'))open(port);app.close();return;}}catch{}}console.error(`端口 ${port} 启动失败：${error.message}`);app.close();process.exitCode=1;});
  app.server.listen(port,'127.0.0.1',()=>{console.log(`星际2天梯直播助手 http://127.0.0.1:${port}`);if(process.argv.includes('--open'))open(port);});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close());
}
function open(port,{spawn=require('node:child_process').spawn,logger=console}={}){
  const url=`http://127.0.0.1:${port}/`,shell=process.env.ComSpec||path.join(process.env.SystemRoot||'C:\\Windows','System32','cmd.exe');
  let warned=false;const fallback=()=>{if(!warned){warned=true;logger.warn(`网页未能自动打开，请手动访问 ${url}`);}};
  try{const child=spawn(shell,['/d','/s','/c',`start "" "${url}"`],{windowsVerbatimArguments:true,windowsHide:true,stdio:'ignore'});child.on('error',fallback);child.on('exit',code=>{if(code!==0)fallback();});child.unref();}catch{fallback();}
}
module.exports={createAssistant,sanitize,openBrowser:open};
