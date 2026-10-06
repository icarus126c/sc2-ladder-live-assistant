const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const outfits=require('../public/outfit-presets.js'),scenes=require('../public/scene-themes.js'),frame=require('../public/gameframe-template.js'),cat=require('../public/cat-keyboard-template.js'),{defaults,sanitize}=require('../ladder-replays.cjs'),{png}=require('../style-packs.cjs'),{createAssistant}=require('../ladder-server.cjs');
test('Nicole is available without installed packs and keeps frontal frame separate from side-profile keyboard poses',()=>{
 outfits.registerInstalled([]);const patch=outfits.buildPatch(defaults,{preset:'nicole',preserveMedia:false},[]),c=sanitize(patch,defaults);
 assert.equal(c.gameFrameStyle,'nicole');assert.equal(c.catCharacter,'nicole');assert.equal(c.waitingTheme,'nicole');assert.equal(c.breakTheme,'nicole');assert.equal(c.waitingBackgroundImage,'/assets/nicole-waiting-v1.png');assert.equal(c.breakBackgroundImage,'/assets/nicole-away-v1.png');assert.match(frame.build(c),/nicole-frame-v1.png/);assert.match(cat.build({...c,catView:'rear'}),/尼可/);
 for(const [file,role]of [['nicole-frame-v1.png','frame'],['nicole-keys-v1.png','assistantRear'],['nicole-waiting-v1.png','waiting'],['nicole-away-v1.png','away']])png(fs.readFileSync(path.join(__dirname,'../public/assets',file)),role);
 const standalone={...c,waitingBackground:'gradient',breakBackground:'gradient'};assert.match(scenes.background(scenes.resolve(standalone,'intermission')),/nicole-waiting/);assert.match(scenes.background(scenes.resolve(standalone,'break')),/nicole-away/);
 assert.throws(()=>sanitize({waitingBackgroundImage:'/assets/arbitrary.png'}));
});
test('Fresh standard app applies builtin Nicole without an import and exports a self-contained game frame',async t=>{
 const app=createAssistant({port:0,dataDir:null,intervalMs:60000,sc2Reader:async()=>{throw Error('offline');}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 const state=await(await fetch(base+'/api/state')).json();assert.deepEqual(state.stylePacks,[]);const html=await(await fetch(base)).text(),token=html.match(/name="control-token" content="([a-f\d]+)"/)[1],headers={'Content-Type':'application/json','X-Control-Token':token,Origin:base};
 const r=await fetch(base+'/api/action',{method:'POST',headers,body:JSON.stringify({action:'outfitApply',choice:{preset:'nicole',preserveMedia:false}})});assert.equal(r.status,200);const applied=await r.json();assert.equal(applied.ladder.config.catCharacter,'nicole');assert.deepEqual(applied.stylePacks,[]);assert.equal(applied.outfit.canUndo,true);
 for(const file of ['frame','keys','waiting','away'])assert.equal((await fetch(base+'/assets/nicole-'+file+'-v1.png')).status,200);
 const svg=await(await fetch(base+'/gameframe.svg')).text();assert.match(svg,/data:image\/png;base64,/);assert.doesNotMatch(svg,/href="\/assets\//);
 assert.equal((await fetch(base+'/api/action',{method:'POST',headers,body:JSON.stringify({action:'outfitUndo'})})).status,200);assert.deepEqual(app.ladder.getConfig(),state.ladder.config);
});
