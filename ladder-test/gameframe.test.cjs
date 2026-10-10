const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createReplayStore,sanitize,defaults}=require('../ladder-replays.cjs'),template=require('../public/gameframe-template.js'),{createAssistant}=require('../ladder-server.cjs');
test('game console frame contains only narrow unfilled contours in the bottom HUD area',()=>{
  const svg=template.build(defaults),paths=[...svg.matchAll(/<path\b[^>]*>/g)].map(m=>m[0]);assert.ok(paths.length>0);for(const p of paths)assert.match(p,/fill="none"/);
  assert.doesNotMatch(svg.replace(/<mask[\s\S]*?<\/mask>/g,''),/<(rect|image|foreignObject|text)\b/);assert.match(svg,/legacy-hud-protection/);assert.match(svg,/viewBox="0 0 1920 1080"/);
  let maximumArea=0;for(const p of template.panels){assert.ok(p.y>=789);assert.ok(p.x>=0&&p.x+p.w<=1920&&p.y+p.h<=1080);assert.ok(Math.min(p.w,p.h)/2>10,'panel centres are clear');maximumArea+=2*(p.w+p.h)*10;}
  assert.ok(maximumArea/(1920*1080)<.03,'even the thickest border covers less than 3% of the full canvas');
  assert.doesNotMatch(template.build({...defaults,gameFrameMinimap:false}),/data-panel="minimap"/);assert.match(template.build({...defaults,gameFrameStyle:'corners'}),/data-panel="commands"/);
});
test('frame appearance persists independently of the scoreboard, information bar and results',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'frame-config-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'records.json'),store=createReplayStore(file);store.add('win');store.updateMMR(4500);
  store.configure({gameFrameEnabled:false,gameFrameStyle:'corners',gameFrameAccent:'#88b7e5',gameFrameScale:95,gameFrameY:7,gameFramePortrait:false,scoreboardEnabled:false,showHUD:false});const restored=createReplayStore(file).snapshot();
  assert.equal(restored.config.gameFrameStyle,'corners');assert.equal(restored.config.gameFrameEnabled,false);assert.equal(restored.config.gameFrameY,7);assert.equal(restored.config.gameFramePortrait,false);assert.equal(restored.stats.wins,1);assert.equal(restored.config.mmr,4500);
  for(const input of [{gameFrameEnabled:1},{gameFrameStyle:'filled'},{gameFrameAccent:'url(x)'},{gameFrameThickness:7},{gameFrameOpacity:0},{gameFrameScale:116},{gameFrameX:-121},{gameFrameY:61},{gameFrameCommands:'false'}])assert.throws(()=>sanitize(input));
});
test('frame hides between games, has its own switch, and supports a transparent standalone OBS source',()=>{
  const frame={hidden:true,innerHTML:''},window={GameFrameTemplate:template};vm.runInNewContext(fs.readFileSync(require.resolve('../public/gameframe.js'),'utf8'),{window,document:{getElementById:()=>frame,body:{dataset:{}}}});
  const state={scene:'game',ladder:createReplayStore().snapshot()};state.ladder.config.scoreboardEnabled=false;state.ladder.config.showHUD=false;window.GameFrameOverlay.render(state);assert.equal(frame.hidden,false);assert.match(frame.innerHTML,/<svg/);
  state.scene='intermission';window.GameFrameOverlay.render(state);assert.equal(frame.hidden,true);state.scene='break';window.GameFrameOverlay.render(state);assert.equal(frame.hidden,true);
  window.GameFrameOverlay.render(state,{standalone:true});assert.equal(frame.hidden,false);state.ladder.config.gameFrameEnabled=false;window.GameFrameOverlay.render(state,{standalone:true});assert.equal(frame.hidden,true);window.GameFrameOverlay.render(state,{preview:true});assert.equal(frame.hidden,false);
  state.ladder.config.gameFrameEnabled=true;state.ladder.config.enabled=false;window.GameFrameOverlay.render(state,{standalone:true});assert.equal(frame.hidden,true);
});
test('server serves the game frame and exports the saved appearance without a reference screenshot',async t=>{
  const app=createAssistant({port:0,dataDir:null,sc2Reader:async()=>{throw Error('offline');},intervalMs:60000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;
  app.ladder.configure({gameFrameAccent:'#d6b477',gameFrameCommands:false});const svg=await fetch(root+'/gameframe.svg');assert.equal(svg.status,200);assert.equal(svg.headers.get('content-type'),'image/svg+xml');const text=await svg.text();assert.match(text,/#d6b477/);assert.doesNotMatch(text,/data-panel="commands"|<image/);
  for(const route of ['/gameframe','/gameframe-template.js','/gameframe.js','/gameframe.css'])assert.equal((await fetch(root+route)).status,200);
  const output=await(await fetch(root+'/output')).text();assert.match(output,/id="gameFrame"/);assert.match(output,/src="\/gameframe-template.js"/);const html=await(await fetch(root)).text();assert.match(html,/data-view="gameframe"[^>]*hidden/);assert.match(html,/id="homeGameFrame"/);
});

test('themed frames use real transparent assets, escape captions and allow decoration control',()=>{
  const caption='<svg onload="x">';const milk=template.build({...defaults,gameFrameStyle:'nailong',gameFrameMemeText:caption});
  assert.match(milk,/data-frame-theme="nailong"/);assert.match(milk,/href="\/assets\/nailong-meme-v1.png"/);assert.match(milk,/&lt;svg onload=&quot;x&quot;&gt;/);assert.doesNotMatch(milk,/<svg onload/);
  const anes=template.build({...defaults,gameFrameStyle:'anes'});assert.match(anes,/href="\/assets\/bluegold-logo.png"/);assert.match(anes,/TEAM AENEAS/);
  for(const style of ['nailong','anes']){
    assert.doesNotMatch(template.build({...defaults,gameFrameStyle:style,gameFrameDecorations:false}),/<image|data-decoration=/);
    assert.doesNotMatch(template.build({...defaults,gameFrameStyle:style,gameFrameMinimap:false,gameFrameSelection:false,gameFrameCommands:false}),/<image|data-decoration=/);
  }
  assert.match(template.build({...defaults,gameFrameStyle:'nailong',gameFrameDecorationScale:50}),/scale\(0.5\)/);
  const png=fs.readFileSync(path.join(__dirname,'../public/assets/nailong-meme-v1.png'));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png[25],6,'mascot PNG has an alpha channel');
});
test('themed settings persist with validated caption and decoration scale',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'frame-themed-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'records.json'),store=createReplayStore(file);
  store.configure({gameFrameStyle:'nailong',gameFrameMemeText:'我还能打！',gameFrameDecorationScale:80,gameFrameDecorations:false});const c=createReplayStore(file).snapshot().config;
  assert.equal(c.gameFrameStyle,'nailong');assert.equal(c.gameFrameMemeText,'我还能打！');assert.equal(c.gameFrameDecorationScale,80);assert.equal(c.gameFrameDecorations,false);
  assert.equal(sanitize({gameFrameStyle:'anes'}).gameFrameStyle,'anes');for(const input of [{gameFrameDecorationScale:49},{gameFrameDecorationScale:141},{gameFrameDecorations:1},{gameFrameMemeText:'太'.repeat(17)},{gameFrameMemeText:'换\n行'}])assert.throws(()=>sanitize(input));
});
test('both themed SVG downloads embed their images and work without a server',async t=>{
  const app=createAssistant({port:0,dataDir:null,sc2Reader:async()=>{throw Error('offline');},intervalMs:60000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;
  for(const style of ['nailong','anes']){app.ladder.configure({gameFrameStyle:style});const text=await(await fetch(root+'/gameframe.svg')).text();assert.match(text,/href="data:image\/png;base64,/);assert.doesNotMatch(text,/href="\/assets|frame-reference/);assert.match(text,new RegExp('data-frame-theme="'+style+'"'));}
  assert.equal((await fetch(root+'/assets/nailong-meme-v1.png')).status,200);
  const html=await(await fetch(root)).text();assert.match(html,/data-frame-style="nailong"/);assert.match(html,/data-frame-style="anes"/);assert.match(html,/id="gameFrameMemeText"/);
});
