const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AutomationEngine}=require('../sc2.cjs'),{sanitize,createAssistant}=require('../ladder-server.cjs');

test('replay playback defaults to the live game scene, returns to waiting, and respects manual pause and opt-out',()=>{
 const config=sanitize({}),engine=new AutomationEngine();assert.equal(config.sc2IncludeReplays,true);
 assert.equal(engine.step('loading',config,'intermission',false,0).target,'loading');
 assert.equal(engine.step('replay',config,'loading',false,100).target,null);assert.equal(engine.step('replay',config,'loading',false,200).target,'game');
 assert.equal(engine.step('menu',config,'game',false,300).target,'intermission');
 assert.equal(engine.step('replay',{...config,sc2AutoPaused:true},'break',false,400).target,null);
 assert.equal(engine.step('replay',{...config,sc2IncludeReplays:false},'intermission',false,500).target,null);
});

test('replay switching does not record playback results and an explicitly saved opt-out survives restart',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'replay-scene-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let phase='replay';const app=createAssistant({dataDir:dir,sc2Reader:async()=>({phase,game:{isReplay:true,displayTime:600,players:[{name:'Me',type:'user',race:'Prot',result:'Victory'},{name:'Other',type:'user',race:'Terr',result:'Defeat'}]}}),intervalMs:60000});t.after(()=>app.close());app.ladder.configure({names:['Me']});
 await app.sc2.poll();await app.sc2.poll();assert.equal(app.snapshot().scene,'game');assert.equal(app.snapshot().ladder.session.stats.total,0);assert.equal(app.snapshot().ladder.stats.total,0);assert.equal(app.snapshot().ladder.config.mmr,null);
 phase='menu';await app.sc2.poll();assert.equal(app.snapshot().scene,'intermission');
 fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify(sanitize({sc2IncludeReplays:false})));
 const restarted=createAssistant({dataDir:dir,sc2Reader:async()=> 'offline',intervalMs:60000});t.after(()=>restarted.close());assert.equal(restarted.snapshot().config.sc2IncludeReplays,false);
});
