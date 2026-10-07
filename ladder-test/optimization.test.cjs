const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createReplayStore}=require('../ladder-replays.cjs'),{createAssistant,sanitize}=require('../ladder-server.cjs'),{createSc2Monitor}=require('../sc2.cjs');
const {create}=require('../public/control-connection.js'),storage=require('../data-storage.cjs');
const base=Date.parse('2026-10-07T15:59:00Z'),flush=()=>new Promise(setImmediate);
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'助手可靠性-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function replay(at){const me={human:true,toonHandle:'5-S2-1-9',name:'Me',race:'Terran',mmr:4000},op={human:true,toonHandle:'5-S2-1-10',name:'Other',race:'Zerg',mmr:4000};return{ok:true,at,durationSeconds:30,map:'Map',players:[me,op],selfPlayers:[me],opponents:[op],selfResult:'W'};}
test('same-instance late HTTP and SSE cannot replace a newer live scene, including nested installation snapshots',async()=>{
  let events,resolve;const states=[],id='same-server',json=value=>new Response(JSON.stringify(value));
  const client=create({EventSourceImpl:class{constructor(){events=this;}close(){}},onState:s=>states.push(s),fetchImpl:async url=>url==='/api/control-session'?json({token:'a'.repeat(48),serverInstanceId:id}):new Promise(r=>resolve=r)});
  events.onopen();events.onmessage({data:JSON.stringify({serverInstanceId:id,revision:1,scene:'intermission'})});await flush();
  const pending=client.request('/api/action');events.onmessage({data:JSON.stringify({serverInstanceId:id,revision:3,scene:'game'})});
  resolve(json({serverInstanceId:id,revision:2,scene:'intermission'}));assert.equal((await(await pending).json()).scene,'game');
  events.onmessage({data:JSON.stringify({serverInstanceId:id,revision:2,scene:'intermission'})});assert.equal(states.at(-1).scene,'game');
  const install=client.request('/api/style-pack-install');resolve(json({pack:{id:'new'},state:{serverInstanceId:id,revision:2,scene:'intermission'}}));const result=await(await install).json();assert.equal(result.state.scene,'game');assert.equal(result.pack.id,'new');client.close();
});
test('session management retains daily history, freezes the end boundary, and offers explicit restart recovery across midnight',t=>{
  let now=base;const file=path.join(temp(t),'records.json'),store=createReplayStore(file,()=>now);store.configure({toonHandle:'5-S2-1-9'});
  now+=10000;store.acceptReplay(replay(now),'first');now+=70000;store.acceptReplay(replay(now),'second');
  assert.equal(store.snapshot().session.stats.total,2);assert.equal(store.snapshot().stats.total,1);assert.equal(store.snapshot().session.records.length,2);
  now+=10000;let restarted=createReplayStore(file,()=>now);assert.equal(restarted.snapshot().session.stats.total,0);assert.equal(restarted.snapshot().session.resumeAvailable,true);
  restarted.resumeSession();assert.equal(restarted.snapshot().session.stats.total,2);const ended=now;restarted.endSession();now+=10000;restarted.acceptReplay(replay(now),'after-end');assert.equal(restarted.snapshot().session.stats.total,2);assert.equal(restarted.snapshot().stats.total,2);assert.equal(restarted.snapshot().session.endedAt,ended);
  restarted.startSession();assert.equal(restarted.snapshot().session.stats.total,0);assert.equal(restarted.snapshot().history.length,3);now+=10000;restarted.acceptReplay(replay(now),'third');assert.equal(restarted.snapshot().session.stats.total,1);
  restarted=createReplayStore(file,()=>now);assert.equal(restarted.snapshot().session.stats.total,0,'same clock restart must exclude saved records');restarted.resumeSession();assert.equal(restarted.snapshot().session.stats.total,1);
});
test('unchanged client sampling checkpoints at most once per five seconds and flushes the latest active game',t=>{
  let now=base;const file=path.join(temp(t),'records.json'),store=createReplayStore(file,()=>now);store.configure({names:['Me']});
  const game={isReplay:false,displayTime:10,players:[{type:'user',name:'Me',race:'Terran'},{type:'user',name:'Other',race:'Zerg'}]};
  const original=fs.writeFileSync;let writes=0;fs.writeFileSync=(name,...args)=>{if(name===file+'.tmp')writes++;return original(name,...args);};
  try{for(let i=0;i<50;i++){now+=100;store.observe({phase:'live',game});}assert.equal(writes,1);game.displayTime=15;store.observe({phase:'live',game});assert.equal(writes,1);store.flush();assert.equal(writes,2);assert.equal(JSON.parse(fs.readFileSync(file)).active.lastTime,15);now+=100;store.observe({phase:'menu',game});assert.equal(writes,3,'game end persists immediately');}finally{fs.writeFileSync=original;}
});
test('fast scene detection still covers a menu immediately while unchanged polls do not flood state listeners',async t=>{
  let now=0,phase='live',scene='intermission',updates=0;const monitor=createSc2Monitor({getConfig:()=>sanitize({}),getScene:()=>({scene}),transition:target=>scene=target,onUpdate:()=>updates++,reader:async()=>phase,now:()=>now,intervalMs:60000});t.after(()=>monitor.close());
  for(let i=0;i<40;i++){now+=100;await monitor.poll();}assert.equal(scene,'game');assert.ok(updates<6);phase='menu';now+=100;await monitor.poll();assert.equal(scene,'intermission');assert.equal(monitor.snapshot().checkedAt,now);
});
test('damaged data restores a validated backup, preserves the damaged bytes and starts every module safely',t=>{
  const dir=temp(t),file=path.join(dir,'records.json');let now=base;const store=createReplayStore(file,()=>now);store.configure({toonHandle:'5-S2-1-9'});now+=1000;store.acceptReplay(replay(now),'record');store.flush();storage.writeJSON(file,JSON.parse(fs.readFileSync(file)));
  fs.writeFileSync(file,'{broken');const restored=createReplayStore(file,()=>now);assert.equal(restored.snapshot().stats.total,1);assert.ok(storage.recoveryWarnings(dir).find(w=>w.file==='records.json'&&w.restored));assert.equal(fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(n=>n.startsWith('records.json.corrupt-'))),'utf8'),'{broken');
  for(const [name,data]of [['settings.json',{sc2AutoEnabled:'invalid'}],['live-interactions.json',{rounds:[{}]}],['outfit-combinations.json',[{}]],['style-packs/index.json',[{}]]]){const target=path.join(dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(data));}
  const app=createAssistant({dataDir:dir,now:()=>now,sc2Reader:async()=> 'offline',intervalMs:60000});t.after(()=>app.close());assert.equal(app.snapshot().ladder.stats.total,1);assert.equal(app.snapshot().recovery.length,5);assert.equal(app.snapshot().stylePacks.length,0);assert.equal(app.snapshot().config.sc2AutoEnabled,true);
});
test('session, diagnosis and backups require authorization; diagnosis distinguishes wrong account paths and backup excludes credentials',async t=>{
  const dir=temp(t),replayDir=path.join(dir,'5-S2-1-10','Replays');fs.mkdirSync(replayDir,{recursive:true});let now=base;
  const app=createAssistant({port:0,dataDir:dir,now:()=>now,sc2Reader:async()=> 'menu',intervalMs:60000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
  const origin='http://127.0.0.1:'+app.server.address().port,token=(await(await fetch(origin+'/api/control-session',{headers:{'X-Control-Client':'assistant'}})).json()).token;
  const action=async(action,extra={},authorized=true)=>{const response=await fetch(origin+'/api/action',{method:'POST',headers:authorized?{'X-Control-Token':token}:{},body:JSON.stringify({action,...extra})});return{code:response.status,data:await response.json()};};
  for(const name of ['streamStart','streamEnd','streamResume','diagnose','dataBackup'])assert.equal((await action(name,{},false)).code,403);
  await action('ladderConfigure',{config:{toonHandle:'5-S2-1-9',replayDirectory:replayDir}});const diagnosed=await action('diagnose');assert.equal(diagnosed.code,200);assert.equal(diagnosed.data.diagnostics.checks.find(c=>c.name==='账号与路径').ok,false);assert.equal(diagnosed.data.diagnostics.checks.find(c=>c.name==='录像目录').ok,true);
  now+=1000;await action('ladderRecord',{result:'win'});assert.equal((await action('streamEnd')).data.ladder.session.running,false);now+=1000;assert.equal((await action('streamStart')).data.ladder.session.stats.total,0);
  const backed=await action('dataBackup');assert.equal(backed.code,200);assert.ok(fs.existsSync(path.join(backed.data.lastBackup.path,'records.json')));assert.ok(!fs.readFileSync(path.join(backed.data.lastBackup.path,'records.json'),'utf8').includes(token));assert.equal((await fetch(origin+'/session-workspace.js')).status,200);
});
test('record scope UI shows cross-midnight session records by default, today separately and excluded history clearly',async()=>{
  let now=base;const store=createReplayStore(null,()=>now);store.configure({toonHandle:'5-S2-1-9'});now+=10000;store.acceptReplay(replay(now),'yesterday');now+=70000;
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',children:[],style:{},classList:{toggle(){}},addEventListener(type,fn){this[type]=fn;},replaceChildren(){this.children=[];},append(...children){this.children.push(...children);},setAttribute(){}});return nodes.get(id);};
  let events;const state={serverInstanceId:'test',revision:1,scene:'intermission',config:{obsMapping:{}},ladder:store.snapshot(),automation:{},replays:{errors:[],recent:[]}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/ladder-ui.js'),'utf8'),{window:{ControlConnection:require('../public/control-connection.js')},document:{getElementById:node,querySelector:selector=>selector.startsWith('meta')?{}:null,querySelectorAll:()=>[],createElement:()=>({children:[],addEventListener(){},append(...children){this.children.push(...children);}})},ObsConnection:class{},EventSource:class{constructor(){events=this;}close(){}},fetch:async()=>new Response(JSON.stringify({token:'a'.repeat(48),serverInstanceId:'test'})),location:{origin:'http://127.0.0.1:17864'},setTimeout:()=>0,clearTimeout(){}});
  events.onopen();events.onmessage({data:JSON.stringify(state)});await flush();assert.equal(node('records').children[0].className,'record');assert.match(node('recordScopeHint').textContent,/跨午夜/);
  node('recordScope').value='today';node('recordScope').change();assert.equal(node('records').children[0].className,'empty');node('recordScope').value='history';node('recordScope').change();assert.equal(node('records').children[0].className,'record');assert.match(node('recordScopeHint').textContent,/最近500条/);
});

test('a duplicate launch that never owns the port does not overwrite the running stream metadata',t=>{
 const dir=temp(t),file=path.join(dir,'records.json');let now=base;const store=createReplayStore(file,()=>now);store.configure({toonHandle:'5-S2-1-9'});now+=1000;store.acceptReplay(replay(now),'current');const before=fs.readFileSync(file,'utf8');
 now+=1000;const duplicate=createAssistant({dataDir:dir,now:()=>now,sc2Reader:async()=> 'offline',intervalMs:60000});duplicate.close();assert.equal(fs.readFileSync(file,'utf8'),before);
});
