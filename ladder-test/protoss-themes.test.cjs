const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createReplayStore,sanitize,defaults}=require('../ladder-replays.cjs'),frame=require('../public/gameframe-template.js'),protoss=require('../public/protoss-console.js'),themes=require('../public/scene-themes.js'),packs=require('../public/outfit-presets.js'),{createAssistant}=require('../ladder-server.cjs');
test('Protoss console protects HUD information in fixed screen coordinates under extreme decorative transforms',()=>{
 for(const style of ['artanis','zealot'])for(const transform of [{},{gameFrameScale:115,gameFrameX:-120,gameFrameY:-80,gameFrameDecorationScale:140},{gameFrameScale:70,gameFrameX:120,gameFrameY:60}]){
  const svg=frame.build({...defaults,gameFrameStyle:style,...transform});assert.match(svg,new RegExp('data-frame-theme="'+style+'"'));assert.match(svg,/<g mask="url\(#protoss-information-mask\)"><g opacity=/);assert.match(svg,/maskUnits="userSpaceOnUse"/);assert.match(svg,/data-protected="playfield"/);
  for(const p of protoss.safeAreas)assert.ok(svg.includes(`data-protected="${p.name}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="black"`),p.name);
  assert.doesNotMatch(svg,/<image|<foreignObject/);
 }
 const hidden=frame.build({...defaults,gameFrameStyle:'artanis',gameFrameDecorations:false,gameFrameMinimap:false});assert.doesNotMatch(hidden,/data-decoration=|data-panel="minimap"/);
});
test('one Protoss outfit pairs both characters and leaves identity, records and manual text untouched',()=>{
 const store=createReplayStore();store.configure({toonHandle:'5-S2-1-999',names:['Example'],waitingTitle:'我的标题',breakTitle:'我的休息',customTitle:'我的活动',customShowKeyboard:true});store.add('win');const before=store.snapshot();
 const preset='protoss',patch=packs.buildPatch(before.config,{preset});assert.doesNotThrow(()=>sanitize(patch,before.config));store.configure(patch);const next=store.snapshot();for(const prefix of ['waiting','break','loading'])assert.equal(next.config[prefix+'Theme'],preset);assert.equal(next.config.gameFrameStyle,'artanis');assert.equal(next.config.scoreboardAccent,packs.presets[preset].accent);for(const key of ['toonHandle','names','waitingTitle','breakTitle','customTitle','customShowKeyboard','catView'])assert.deepEqual(next.config[key],before.config[key]);assert.deepEqual(next.records,before.records);assert.equal(next.stats.wins,1);const art=themes.decoration(themes.resolve(next.config,'break'));assert.match(art,/scene-protoss-artanis/);assert.match(art,/scene-protoss-zealot/);assert.match(themes.background(next.config),/protoss-scene-v1\.svg/);assert.equal(packs.presets.artanis,undefined);assert.equal(packs.presets.zealot,undefined);
});
test('Protoss art has real transparent PNG alpha, routes and every selection entry are available',async t=>{
 const app=createAssistant({port:0,dataDir:null,sc2Reader:async()=>{throw Error('offline');},intervalMs:60000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port,html=await(await fetch(base)).text();
 for(const style of ['artanis','zealot']){const file=path.join(__dirname,'../public/assets/'+style+'-character-v1.png'),bytes=fs.readFileSync(file);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes[25],6,'RGBA PNG');assert.equal((await fetch(base+'/assets/'+style+'-character-v1.png')).status,200);assert.match(html,new RegExp('data-frame-style="'+style+'"'));app.ladder.configure({gameFrameStyle:style});assert.match(await(await fetch(base+'/gameframe.svg')).text(),/protoss-information-mask/);}
 assert.equal((await fetch(base+'/assets/protoss-scene-v1.svg')).status,200);assert.match(html,/\/protoss-console\.js/);
});
