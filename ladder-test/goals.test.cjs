const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
const {createReplayStore}=require('../ladder-replays.cjs'),G=require('../public/goals-model.js'),{createAssistant}=require('../ladder-server.cjs');
const day=Date.parse('2026-10-11T04:00:00Z'),me={toonHandle:'5-S2-1-1',name:'Me',human:true,race:'Protoss'},op={toonHandle:'5-S2-1-2',name:'Friend',human:true,race:'Terran'};
const definitions=[{id:'s',kind:'streak',target:3},{id:'t',kind:'race',race:'T',target:3},{id:'p',kind:'player',player:'Friend',target:2},{id:'h',kind:'player',player:'5-S2-1-2',target:2},{id:'w',kind:'wins',target:4}];
function replay(at,result='W',opponent=op){return{ok:true,at,durationSeconds:60,map:'GoalMap',players:[me,opponent],selfPlayers:[me],opponents:[opponent],selfResult:result};}
test('today goals use counted matches, exact nickname/handle, ordered highest streak and deduplicated replays',()=>{
 const s=createReplayStore(null,()=>day+1000000);s.configure({toonHandle:me.toonHandle,goals:definitions});
 for(const [i,result]of ['W','W','W','L','W'].entries())s.acceptReplay(replay(day+i*120000,result),'replay'+i);
 s.acceptReplay(replay(day),'copied');const goals=s.snapshot().goals;
 assert.deepEqual(goals.map(g=>g.value),[3,4,4,4,4]);assert.equal(goals[0].complete,true);assert.match(goals[0].note,/当前 1 连胜/);
 s.edit(s.snapshot().records.find(r=>r.at===day+120000).id,{excluded:true});assert.deepEqual(s.snapshot().goals.map(g=>g.value),[2,3,3,3,3]);
 s.configure({goals:[{id:'exact',kind:'player',player:'Frien',target:1}]});assert.equal(s.snapshot().goals[0].value,0);
});
test('goals reset at Beijing midnight, isolate identity, follow AI switch and survive restart without counting twice',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'goal-persist-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let now=day+1000000;const file=path.join(dir,'records.json'),s=createReplayStore(file,()=>now);s.configure({toonHandle:me.toonHandle,goals:definitions});s.acceptReplay(replay(day),'human');s.acceptReplay(replay(day+120000,'W',{...op,human:false,name:'Computer',toonHandle:''}),'ai');assert.equal(s.snapshot().goals[1].value,1);s.configure({includeAI:true});s.acceptReplay(replay(day+120000,'W',{...op,human:false,name:'Computer',toonHandle:''}),'ai');assert.equal(s.snapshot().goals[1].value,2);
 s.configure({toonHandle:'5-S2-1-7'});assert.equal(s.snapshot().goals[1].value,0);s.configure({toonHandle:me.toonHandle});const restored=createReplayStore(file,()=>now);assert.equal(restored.snapshot().goals[1].value,2);restored.acceptReplay(replay(day),'another-copy');assert.equal(restored.snapshot().goals[1].value,2);now=Date.parse('2026-10-11T16:00:00Z');assert.equal(restored.snapshot().goals[1].value,0);assert.equal(restored.snapshot().config.goals.length,5);
});
test('goals validate definitions and scene visibility without allowing scene drafts to alter goal definitions',()=>{
 for(const bad of [{goalsEnabled:'true'},{goalsWidth:10},{goals:[{id:'x',kind:'player',target:1,player:''}]},{goals:[definitions[0],definitions[0]]},{goals:[{id:'x',kind:'race',target:1,race:'R'}]}])assert.throws(()=>G.sanitize(bad,G.defaults));
 const s=createReplayStore();assert.equal(s.getConfig().gameShowGoals,false);s.configure({gameShowGoals:true,goalsEnabled:true});assert.equal(s.getConfig().gameShowGoals,true);assert.deepEqual(require('../public/scene-customization.js').filter({goals:definitions,goalsX:50,toonHandle:'bad'},'game'),{goalsX:50});
});
test('accounting distinguishes daily, session start, preexisting, AI, excluded and prior day records',()=>{
 const {explain}=require('../accounting.cjs'),{dayKey}=require('../ladder.cjs'),identity='mine',session={startedAt:day,endedAt:day+60000,excludedIds:['preexisting']};const records=[{id:'old',at:day-86400000},{id:'earlier',at:day-1},{id:'preexisting',at:day+1},{id:'ai',at:day+2,matchType:'ai1v1'},{id:'excluded',at:day+3,excluded:true},{id:'accepted',at:day+4},{id:'later',at:day+60001}].map(r=>({identity,result:'win',...r}));records.push({identity:'other',at:day});const a=explain(records,{identity,session,includeAI:false,now:day+120000}),get=id=>a.rows.find(r=>r.id===id);
 assert.equal(a.date,dayKey(day));assert.equal(a.rows.length,7);assert.equal(get('old').dailyIncluded,false);assert.equal(get('earlier').dailyIncluded,true);assert.match(get('earlier').sessionReason,/早于/);assert.match(get('preexisting').sessionReason,/已存在/);assert.equal(get('ai').dailyIncluded,false);assert.match(get('excluded').dailyReason,/排除/);assert.equal(get('accepted').sessionIncluded,true);assert.match(get('later').sessionReason,/晚于/);
});
test('goals, editor, maintenance and preview resources are served, output requests are recorded separately from previews',async t=>{
 const app=createAssistant({port:0,dataDir:null,sc2Reader:async()=> 'offline',intervalMs:60000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 for(const route of ['/goals-model.js','/goals-overlay.js','/studio-upgrade.js','/studio-upgrade.css','/preview-assets.js','/preview-status.js','/assets/console-preview.jpg','/app-updater.ps1'])assert.equal((await fetch(base+route)).status,200,route);
 await fetch(base+'/output?preview=1');assert.equal(app.snapshot().lastOutputRequestAt,null);await fetch(base+'/output');assert.ok(app.snapshot().lastOutputRequestAt);const html=await(await fetch(base)).text();for(const id of ['goalAddForm','accountingRows','sceneEditUndo','sceneEditRedo','studioUpdateLaunch'])assert.ok(html.includes('id="'+id+'"'));
});
