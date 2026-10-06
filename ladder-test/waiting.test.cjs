const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createReplayStore,sanitize}=require('../ladder-replays.cjs'),{createAssistant}=require('../ladder-server.cjs');
test('waiting appearance persists independently of information template and account data',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'waiting-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'records.json'),s=createReplayStore(file);
  s.add('win');s.updateMMR(4200);s.configure({template:'custom',waitingBackground:'solid',waitingColor:'#123456',waitingLayout:'left',waitingTitle:'等待下一局',waitingShowPhase:false,waitingShowHUD:false,waitingWidth:1000});
  const restored=createReplayStore(file).snapshot();assert.equal(restored.config.waitingColor,'#123456');assert.equal(restored.config.waitingTitle,'等待下一局');assert.equal(restored.config.waitingShowHUD,false);assert.equal(restored.config.template,'custom');assert.equal(restored.stats.wins,1);assert.equal(restored.config.mmr,4200);
  for(const invalid of [{waitingBackground:'url(x)'},{waitingBackgroundImage:'https://example.com/a.png'},{waitingBackgroundImage:'/waiting-backgrounds/../records.json'},{waitingColor:'red'},{waitingLayout:'absolute'},{waitingDim:101},{waitingTitleSize:31},{waitingWidth:99999},{waitingShowName:'false'},{waitingKicker:'x'.repeat(81)}])assert.throws(()=>sanitize(invalid));
});
test('waiting renderer applies background and independent display choices without reappearing in game',()=>{
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',style:{setProperty(k,v){this[k]=v;}},parentElement:{hidden:false},getAttribute(){return '';}});return nodes.get(id);},win={};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/ladder-overlay.js'),'utf8'),{window:win,document:{getElementById:node}});
  const store=createReplayStore();store.configure({waitingBackground:'image',waitingBackgroundImage:'/waiting-backgrounds/'+'a'.repeat(64)+'.png',waitingLayout:'right',waitingShowName:false,waitingShowMMR:false,waitingShowRecord:false,waitingShowMatchups:false,waitingShowPhase:false,waitingShowHUD:false});const state={scene:'intermission',ladder:store.snapshot()};
  win.LadderOverlay.render(state);assert.equal(node('ladderWaiting').hidden,false);assert.match(node('ladderWaiting').className,/waiting-layout-right/);assert.match(node('ladderWaiting').style['--waiting-background'],/waiting-backgrounds/);
  for(const id of ['waitingName','waitingMetrics','waitingMatchups','waitingPhase','ladderHUD'])assert.equal(node(id).hidden,true,id);
  state.scene='game';win.LadderOverlay.render(state);assert.equal(node('ladderWaiting').hidden,true);assert.equal(node('ladderHUD').hidden,true);
});
test('background uploads require local authorization, reject unsupported files and serve persisted image bytes',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'waiting-upload-')),app=createAssistant({port:0,dataDir:dir,sc2Reader:async()=>{throw Error('offline');},intervalMs:60000});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>{app.close();fs.rmSync(dir,{recursive:true,force:true});});const root='http://127.0.0.1:'+app.server.address().port;
  const html=await(await fetch(root)).text(),token=html.match(/name="control-token" content="([^"]+)"/)[1],post=(body,headers={})=>fetch(root+'/api/waiting-background',{method:'POST',headers,body});
  assert.equal((await post('bad')).status,403);assert.equal((await post('bad',{'X-Control-Token':token,Origin:'https://example.com'})).status,403);assert.equal((await post('<svg/>',{'X-Control-Token':token})).status,400);
  assert.equal((await post(Buffer.alloc(8*1024*1024+1),{'X-Control-Token':token})).status,400);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const response=await post(png,{'X-Control-Token':token,'Content-Type':'image/png'});assert.equal(response.status,200);const {url}=await response.json();assert.match(url,/^\/waiting-backgrounds\/[a-f\d]{64}\.png$/);
  const image=await fetch(root+url);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
  assert.equal(app.snapshot().ladder.config.waitingBackgroundImage,'','upload alone does not change the live picture');
  const saved=await fetch(root+'/api/action',{method:'POST',headers:{'X-Control-Token':token,'Content-Type':'application/json'},body:JSON.stringify({action:'ladderConfigure',config:{waitingBackground:'image',waitingBackgroundImage:url}})});assert.equal(saved.status,200);
  assert.equal(createReplayStore(path.join(dir,'records.json')).getConfig().waitingBackgroundImage,url);
});
test('waiting drafts are preview-only and never replace saved output state',()=>{
  function harness(search){let events;const listeners={},renders=[],nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},hidden:false});return nodes.get(id);},parent={};
    const context={location:{search,origin:'http://127.0.0.1:17864'},parent,URLSearchParams,innerWidth:1920,innerHeight:1080,document:{body:{classList:{add(){}}},getElementById:node},addEventListener:(key,fn)=>listeners[key]=fn,window:{LadderOverlay:{render:s=>renders.push(s)},ScoreboardOverlay:{render(){}}},EventSource:class{constructor(){events=this;}}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../public/ladder-output.js'),'utf8'),context);return{listeners,renders,parent,events};
  }
  const state={scene:'game',ladder:createReplayStore().snapshot()},preview=harness('?preview=1&phase=intermission&module=waiting');preview.events.onmessage({data:JSON.stringify(state)});preview.listeners.message({origin:'http://127.0.0.1:17864',source:preview.parent,data:{type:'waitingDraft',config:{waitingTitle:'草稿标题',mmr:9999}}});assert.equal(preview.renders.at(-1).ladder.config.waitingTitle,'草稿标题');assert.equal(preview.renders.at(-1).ladder.config.mmr,null);assert.equal(state.scene,'game');
  preview.listeners.message({origin:'https://example.com',source:preview.parent,data:{type:'waitingDraft',config:{waitingTitle:'非法'}}});assert.equal(preview.renders.at(-1).ladder.config.waitingTitle,'草稿标题');
  const output=harness('');assert.equal(output.listeners.message,undefined);output.events.onmessage({data:JSON.stringify(state)});assert.equal(output.renders.at(-1).scene,'game');assert.notEqual(output.renders.at(-1).ladder.config.waitingTitle,'草稿标题');
});
