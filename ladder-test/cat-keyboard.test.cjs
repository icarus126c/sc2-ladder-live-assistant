const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),{execFileSync}=require('node:child_process');
const {createReplayStore,sanitize,defaults}=require('../ladder-replays.cjs'),{createKeyboardInput,keyList}=require('../keyboard-input.cjs'),template=require('../public/cat-keyboard-template.js'),{createAssistant}=require('../ladder-server.cjs');
function worker(){const w=new EventEmitter();w.stdout=new PassThrough();w.stderr=new PassThrough();w.killed=false;w.kill=()=>w.killed=true;return w;}
test('cat settings persist independently, and reject invalid sizes, colors and switches',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cat-settings-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'records.json'),store=createReplayStore(file);store.add('win');store.updateMMR(4600);
  assert.equal(defaults.catView,'split');assert.equal(defaults.catKeyboardSide,'left');
  store.configure({catEnabled:true,catView:'classic',catKeyboardSide:'right',catWidth:520,catHold:500,catX:30,catFunctions:false,scoreboardEnabled:false,showHUD:false});const saved=createReplayStore(file).snapshot();
  assert.equal(saved.config.catView,'classic');assert.equal(saved.config.catKeyboardSide,'right');
  assert.equal(saved.config.catWidth,520);assert.equal(saved.config.catFunctions,false);assert.equal(saved.config.catEnabled,true);assert.equal(saved.stats.wins,1);assert.equal(saved.config.mmr,4600);assert.equal(saved.config.showHUD,false);assert.equal(saved.config.scoreboardEnabled,false);
  for(const c of [{catEnabled:'true'},{catView:'unknown'},{catKeyboardSide:'both'},{catHold:0},{catWidth:100},{catX:-1},{catY:821},{catOpacity:101},{catAccent:'url(x)'},{catChatGuard:1}])assert.throws(()=>sanitize(c));
});
test('keyboard worker only starts when enabled, filters frames, clears on focus loss, and stops on disable',t=>{
  let c={...defaults},spawns=0,last;const input=createKeyboardInput({getConfig:()=>c,spawnWorker:()=>{spawns++;return last=worker();}});t.after(()=>input.close());input.configure();assert.equal(spawns,0);
  c.catEnabled=true;input.configure();assert.equal(spawns,1);last.stdout.write(JSON.stringify({status:'active',pressed:['CtrlLeft','1','Q','unknown','password text']})+'\n');assert.deepEqual(input.snapshot().pressed,['CtrlLeft','Q','1']);
  c.catLetters=false;input.configure();assert.deepEqual(input.snapshot().pressed,['CtrlLeft','1']);assert.equal(spawns,1);
  last.stdout.write('{"status":"waiting","pressed":["Q"]}\n');assert.deepEqual(input.snapshot().pressed,[]);
  last.stdout.write('{"status":"chat","pressed":["S"]}\n');assert.deepEqual(input.snapshot().pressed,[]);
  c.catEnabled=false;input.configure();assert.equal(last.killed,true);assert.equal(input.snapshot().status,'disabled');assert.deepEqual(input.snapshot().pressed,[]);
  last.stdout.write('{"status":"active","pressed":["Q"]}\n');assert.equal(input.snapshot().status,'disabled');
});
test('worker errors fail closed, while resume starts a fresh reader without preserving keys',t=>{
  let last;const input=createKeyboardInput({getConfig:()=>({...defaults,catEnabled:true}),spawnWorker:()=>last=worker()});t.after(()=>input.close());input.configure();const old=last;last.stdout.write('{"status":"active","pressed":["Q"]}\n');last.stdout.write('bad-json\n');assert.equal(input.snapshot().status,'error');assert.deepEqual(input.snapshot().pressed,[]);assert.equal(old.killed,true);
  input.configure({reset:true});assert.notEqual(last,old);assert.equal(input.snapshot().status,'starting');input.close();assert.equal(last.killed,true);
});
test('model lights precise keyboard keys, holds quick taps, tracks frequency and clears chat frames',()=>{
  let at=1000;const m=template.createModel({now:()=>at}),c={catHold:300};m.ingest({status:'active',pressed:['CtrlLeft','1'],sequence:1},c);let s=m.snapshot(c);assert.deepEqual(s.pressed,['CtrlLeft','1']);assert.equal(s.combo,'Ctrl + 1');assert.equal(s.rate,1);assert.ok(s.pose>0);
  m.ingest({status:'active',pressed:[],sequence:2},c);at=1200;assert.ok(m.snapshot(c).pressed.includes('1'));at=1301;assert.equal(m.snapshot(c).pressed.length,0);
  for(let n=0;n<6;n++){at+=30;m.ingest({status:'active',pressed:['Q'],sequence:3+n*2},c);m.ingest({status:'active',pressed:[],sequence:4+n*2},c);}s=m.snapshot(c);assert.ok(s.rate>=6);assert.equal(s.active,true);
  m.ingest({status:'chat',pressed:['A'],sequence:99},c);s=m.snapshot(c);assert.deepEqual(s.pressed,[]);assert.equal(s.pose,0);
});
test('all capture keys have a visible keyboard key or mouse button, and mascot PNG has alpha',()=>{
  const html=template.build({catView:'classic'}),keys=new Set([...html.matchAll(/data-cat-key="([^"]+)"/g)].map(m=>m[1]));for(const k of keyList)assert.ok(keys.has(k),'Missing visible key: '+k);assert.match(html,/CtrlRight/);assert.match(html,/ShiftRight/);assert.match(html,/BracketLeft/);
  const png=fs.readFileSync(path.join(__dirname,'../public/assets/cat-keyboard-v2.png'));assert.equal(png[25],6);assert.equal(png.readUInt32BE(16),png.readUInt32BE(20)*3,'three equal square animation cells');
});
test('split views show the selected half, preserve all keys across the pair and keep hidden-key motion',()=>{
  const left=template.build(),right=template.build({catKeyboardSide:'right'}),classic=template.build({catView:'classic',catKeyboardSide:'right'}),keys=html=>new Set([...html.matchAll(/data-cat-key="([^"]+)"/g)].map(m=>m[1]));
  const l=keys(left),r=keys(right);assert.match(left,/cat-split/);assert.match(left,/cat-touchboard/);assert.ok(l.has('Q'));assert.ok(!l.has('L'));assert.ok(r.has('L'));assert.ok(!r.has('Q'));assert.ok(r.has('Left'));assert.ok(r.has('PageUp'));for(const k of keyList)assert.ok(l.has(k)||r.has(k),'Missing half key: '+k);assert.match(classic,/cat-classic/);assert.ok(keys(classic).has('Q'));assert.ok(keys(classic).has('L'));
  const model=template.createModel({now:()=>1000}),c={catView:'split',catKeyboardSide:'left',catHold:300};model.ingest({status:'active',pressed:['CtrlRight','L'],sequence:1},c);const s=model.snapshot(c);assert.ok(s.pressed.includes('L'));assert.equal(s.combo,'Ctrl + L');assert.ok(s.rate>0);assert.ok(s.pose>0);
});
test('rear style has exactly one live keyboard, a distinct three-state side-profile sprite and persists independently',t=>{
  for(const side of ['left','right']){const html=template.build({catView:'rear',catKeyboardSide:side});assert.match(html,/cat-rear/);assert.equal((html.match(/class="cat-board"/g)||[]).length,1);assert.equal((html.match(/class="cat-avatar"/g)||[]).length,1);assert.doesNotMatch(html,/cat-touchboard/);assert.match(html,new RegExp('data-cat-key="'+(side==='left'?'Q':'L')+'"'));}
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cat-rear-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'records.json'),store=createReplayStore(file);store.configure({catView:'rear',catKeyboardSide:'right'});const saved=createReplayStore(file).snapshot();assert.equal(saved.config.catView,'rear');assert.equal(saved.config.catKeyboardSide,'right');
  const png=fs.readFileSync(path.join(__dirname,'../public/assets/cat-keyboard-rear-v1.png'));assert.equal(png[25],6);assert.equal(png.readUInt32BE(16),png.readUInt32BE(20)*3);assert.match(fs.readFileSync(path.join(__dirname,'../public/cat-keyboard.css'),'utf8'),/rotateZ\(-30deg\)/);
});
test('native reader has chat guard, does not intercept input and exits when its parent is gone',()=>{
  const python=path.join(__dirname,'../runtime/python/python.exe'),script=path.join(__dirname,'../capture-keyboard.py');
  const code="import importlib.util; s=importlib.util.spec_from_file_location('capture',r'"+script+"'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); g=m.ChatGuard(); assert g.update(True,True); assert g.update(True,True); g.update(True,False); assert not g.update(True,True); g.update(True,False); assert g.update(True,True); assert not g.update(True,False,True); assert not m.ChatGuard(False).update(True,True); print('chat guard OK')";
  assert.match(execFileSync(python,['-X','utf8','-c',code],{encoding:'utf8'}),/chat guard OK/);
  const frame=JSON.parse(execFileSync(python,['-X','utf8',script,'--once'],{encoding:'utf8'}));assert.ok(['waiting','active','chat'].includes(frame.status));if(frame.status!=='active')assert.deepEqual(frame.pressed,[]);
  if(process.platform==='win32')assert.equal(execFileSync(python,['-X','utf8',script,'--once','--parent-pid','4294967294'],{encoding:'utf8'}),'');
  const source=fs.readFileSync(script,'utf8');assert.doesNotMatch(source,/SetWindowsHookEx|SendInput|keybd_event|open\(.*["']w/);assert.match(source,/sc2_x64\.exe/);
});
test('cat overlay has its own switch, hides between matches, and supports an independent transparent source',()=>{
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,style:{setProperty(){}},dataset:{},classList:{toggle(){}},querySelector:sel=>node(sel),querySelectorAll:()=>[],innerHTML:''});return nodes.get(id);};let raf,connections=0,disconnections=0;const window={CatKeyboardTemplate:template};vm.runInNewContext(fs.readFileSync(require.resolve('../public/cat-keyboard.js'),'utf8'),{window,document:{getElementById:node,body:{dataset:{}}},EventSource:class{constructor(){connections++;}close(){disconnections++;}},requestAnimationFrame:f=>raf=f,Date,Set,JSON});
  const state={scene:'game',ladder:createReplayStore().snapshot()};state.ladder.config.catEnabled=true;window.CatKeyboardOverlay.render(state);assert.equal(node('catWidget').hidden,false);assert.match(node('catWidget').innerHTML,/data-keyboard-side="left"/);state.ladder.config.catKeyboardSide='right';window.CatKeyboardOverlay.render(state);assert.match(node('catWidget').innerHTML,/data-keyboard-side="right"/);state.ladder.config.catView='classic';window.CatKeyboardOverlay.render(state);assert.match(node('catWidget').innerHTML,/cat-classic/);state.scene='intermission';window.CatKeyboardOverlay.render(state);assert.equal(node('catWidget').hidden,true);
  window.CatKeyboardOverlay.render(state,{standalone:true});assert.equal(node('catWidget').hidden,false);state.ladder.config.catEnabled=false;window.CatKeyboardOverlay.render(state,{standalone:true});assert.equal(node('catWidget').hidden,true);window.CatKeyboardOverlay.render(state,{preview:true});assert.equal(node('catWidget').hidden,false);assert.equal(typeof raf,'function');assert.equal(connections,2,'hidden and demonstration previews do not subscribe to real keys');assert.equal(disconnections,2,'leaving game or disabling closes the key stream');
});
test('server serves the new tool, streams live frames separately, and requires authorization to enable it',async t=>{
  let last;const app=createAssistant({port:0,dataDir:null,sc2Reader:async()=>{throw Error('offline');},intervalMs:60000,keyboardSpawn:()=>last=worker()});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;
  const html=await(await fetch(root)).text(),token=html.match(/name="control-token" content="([^"]+)"/)[1];assert.match(html,/id="homeCatEnabled"/);assert.match(html,/data-view="catkeyboard"[^>]*hidden/);
  const request={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ladderConfigure',config:{catEnabled:true}})};assert.equal((await fetch(root+'/api/action',request)).status,403);
  request.headers['X-Control-Token']=token;assert.equal((await fetch(root+'/api/action',request)).status,200);last.stdout.write('{"status":"active","pressed":["Q"]}\n');
  const controller=new AbortController(),response=await fetch(root+'/api/keyboard-events',{signal:controller.signal}),reader=response.body.getReader();const {value}=await reader.read();assert.match(new TextDecoder().decode(value),/"pressed":\["Q"\]/);controller.abort();
  const state=await(await fetch(root+'/api/state')).json();assert.equal(state.keyboard.status,'active');assert.equal(state.keyboard.pressed,undefined,'main config stream does not carry keystrokes');
  for(const route of ['/cat-keyboard','/cat-keyboard.js','/cat-keyboard.css','/cat-keyboard-template.js','/cat-workspace.js','/assets/cat-keyboard-v2.png','/assets/cat-keyboard-rear-v1.png'])assert.equal((await fetch(root+route)).status,200,route);
  assert.match(await(await fetch(root+'/output')).text(),/id="catWidget"/);
});
