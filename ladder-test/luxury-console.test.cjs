const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const L=require('../public/luxury-console.js'),F=require('../public/gameframe-template.js'),O=require('../public/outfit-presets.js'),{defaults,createReplayStore}=require('../ladder-replays.cjs'),{createAssistant}=require('../ladder-server.cjs');
test('luxury frame keeps annotated information masks outside adjustable art and supports full-selection mode',()=>{
 for(const style of Object.keys(L.styles)){
  const c={...defaults,gameFrameStyle:style,gameFrameCoverage:'rich',gameFrameScale:115,gameFrameX:120,gameFrameY:60};const svg=F.build(c);assert.match(svg,/<g mask="url\(#luxury-.*-safety\)"><g opacity=.*transform="translate\(120 60\)/);for(const area of L.protectedAreas)assert.ok(svg.includes('data-protected="'+area.name+'"'));assert.match(svg,/data-decoration="character"/);assert.doesNotMatch(svg,/data-protected="full-unit-information"/);
  assert.match(F.build({...c,gameFrameCoverage:'safe'}),/data-protected="full-unit-information"/);assert.doesNotMatch(F.build({...c,gameFrameCoverage:'safe'}),/data-decoration="character"|selection-left/);
  assert.match(svg,/data-art-flow="natural" mask="url\(#luxury-.*-natural\)"/);assert.doesNotMatch(svg,/data-protected="playfield"/);assert.match(F.build({...c,gameFrameCoverage:'safe'}),/data-protected="playfield"/);
  assert.doesNotMatch(F.build({...c,gameFrameDecorations:false}),/<image|data-decoration=/);
  assert.doesNotMatch(F.build({...c,gameFrameSelection:false,gameFramePortrait:false,gameFrameMinimap:false,gameFrameCommands:false}),/<image|data-panel=/);
 }
});
test('luxury choices persist and outfit swaps use existing matching scenes and character without changing results',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'luxury-config-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'records.json');for(const style of Object.keys(L.styles)){
  const store=createReplayStore(file);store.configure({gameFrameStyle:style,gameFrameCoverage:'rich'});assert.equal(createReplayStore(file).getConfig().gameFrameStyle,style);const patch=O.buildPatch(store.getConfig(),{preset:style,modules:['gameframe','catkeyboard','waiting','break']});assert.equal(patch.gameFrameStyle,style);assert.equal(patch.gameFrameCoverage,'rich');assert.equal(patch.catCharacter,style.replace('-luxury',''));assert.equal(patch.waitingTheme,patch.catCharacter);assert.equal(patch.breakTheme,patch.catCharacter);assert.equal(patch.gameFrameImage,'');assert.equal(store.snapshot().stats.total,0);
 }
});
test('all luxury source pages load their module and transparent assets, and SVG export embeds artwork',async t=>{
 const app=createAssistant({port:0,dataDir:null,sc2Reader:async()=>{throw Error('offline');},intervalMs:60000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;
 for(const page of ['/','/gameframe','/output'])assert.match(await(await fetch(root+page)).text(),/src="\/luxury-console.js"/);assert.equal((await fetch(root+'/luxury-console.js')).status,200);
 for(const [style,file]of Object.entries(L.assetFiles)){
  const bytes=fs.readFileSync(path.join(__dirname,'../public/assets',file));assert.equal(bytes[25],6,'PNG retains alpha');assert.deepEqual(Buffer.from(await(await fetch(root+'/assets/'+file)).arrayBuffer()),bytes);app.ladder.configure({gameFrameStyle:style,gameFrameCoverage:'rich'});const exported=await(await fetch(root+'/gameframe.svg')).text();assert.match(exported,/href="data:image\/png;base64,/);assert.doesNotMatch(exported,/href="\/assets\//);assert.match(exported,/data-protected="command-card"/);
 }
 assert.equal((await fetch(root+'/assets/console-game-reference.png')).status,200);
 for(const style of Object.keys(F.themes).filter(k=>k!=='custom')){
  const response=await fetch(root+'/assets/frame-thumb-'+style+'.png');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/png/);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.readUInt32BE(16),576);assert.equal(bytes.readUInt32BE(20),138);
 }
 assert.equal((await fetch(root+'/assets/frame-thumb-unknown.png')).status,404);
});
