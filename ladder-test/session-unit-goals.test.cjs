const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createReplayStore}=require('../ladder-replays.cjs'),G=require('../public/goals-model.js'),D=require('../daily-stats.cjs');
const start=Date.parse('2026-10-11T15:50:00Z'),me={toonHandle:'5-S2-1-1',name:'Me',human:true,race:'Protoss'},op={toonHandle:'5-S2-1-2',name:'Other',human:true,race:'Terran'};
const replay=(at,kills=12)=>({ok:true,at,durationSeconds:120,map:'Test Map',players:[me,op],selfPlayers:[me],opponents:[op],selfResult:'W',dailyMetrics:{version:1,zealots:24,zerglings:0,workersKilled:kills}});
const defs=[{id:'today',kind:'zealots',target:100},{id:'stream',kind:'zealots',scope:'session',target:100},{id:'dog',kind:'zerglings',scope:'session',target:100},{id:'kills',kind:'workersKilled',scope:'session',target:30},{id:'wins',kind:'wins',scope:'session',target:3}];
test('session unit and win goals continue across midnight, reset on new stream, and resume persisted progress',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'session-goals-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'data.json');let now=start,s=createReplayStore(file,()=>now);s.configure({toonHandle:me.toonHandle,goals:defs});
 now+=1000;s.acceptReplay(replay(now),'first');now=Date.parse('2026-10-11T16:01:00Z');s.acceptReplay(replay(now,20),'second');
 assert.deepEqual(s.snapshot().goals.map(g=>g.value),[24,48,0,32,2]);assert.equal(s.snapshot().goals[3].complete,true);s.saveSession();
 s=createReplayStore(file,()=>now+1);assert.equal(s.snapshot().goals[1].value,0);s.resumeSession();assert.equal(s.snapshot().goals[1].value,48);
 const record=s.snapshot().records[0];s.edit(record.id,{excluded:true});assert.equal(s.snapshot().goals[1].value,24);assert.equal(s.snapshot().stats.daily.mostWorkersKilled,null);s.edit(record.id,{excluded:false});
 s.startSession();assert.equal(s.snapshot().goals[1].value,0);assert.equal(s.snapshot().goals[0].value,24);
 s.configure({toonHandle:'5-S2-1-9'});assert.ok(s.snapshot().goals.every(g=>g.value===0));
});
test('unit goals keep unknown metrics distinct from zero and show confirmed lower bounds',()=>{
 const goals=[{id:'unit',kind:'workersKilled',target:10}],missing={replayKey:'a',result:'win'},known={replayKey:'b',result:'loss',dailyMetrics:{workersKilled:12}};
 let r=G.summarize([missing],goals)[0];assert.equal(r.value,null);assert.equal(r.pending,true);assert.equal(r.complete,false);assert.equal(r.valueText,'待解析');
 r=G.summarize([missing,known],goals)[0];assert.equal(r.value,12);assert.equal(r.partial,true);assert.equal(r.complete,true);assert.equal(r.valueText,'≥ 12');
 r=G.summarize([{result:'win'}],goals)[0];assert.equal(r.value,null);assert.equal(G.summarize([],goals)[0].value,0);
});
test('session targets use all counted records beyond the 200-row UI limit and deduplicate scans',()=>{
 let now=start;const s=createReplayStore(null,()=>now);s.configure({toonHandle:me.toonHandle,goals:defs});for(let i=0;i<205;i++){now+=150000;s.acceptReplay(replay(now),String(i));}s.acceptReplay(replay(now),'copy');assert.equal(s.snapshot().session.records.length,200);assert.equal(s.snapshot().goals[1].value,205*24);assert.equal(s.snapshot().goals[4].value,205);
});
test('single-match worker record picks maximum not sum, ties favor latest, unknown and manual metrics are ignored',()=>{
 const record=(id,at,count)=>({id,at,replayKey:id,opponent:id,map:'Map '+id,result:'win',dailyMetrics:{workersKilled:count}});
 const rows=[record('first',1,40),record('second',2,12),record('latest',3,40),record('unknown',4,null),{id:'manual',at:5,dailyMetrics:{workersKilled:999}}];
 const d=D.summarize(rows);assert.equal(d.workersKilled,92);assert.equal(d.mostWorkersKilled.count,40);assert.equal(d.mostWorkersKilled.name,'latest');assert.equal(d.mostWorkersKilled.map,'Map latest');assert.equal(D.summarize([record('zero',1,0)]).mostWorkersKilled.count,0);assert.equal(D.summarize([rows[3]]).mostWorkersKilled,null);
});
test('best-match record follows counted identity, exclusions and rescanned worker metrics',()=>{
 let now=start;const s=createReplayStore(null,()=>now);s.configure({toonHandle:me.toonHandle});now+=1000;s.acceptReplay(replay(now,3),'a');now+=1000;s.acceptReplay(replay(now,15),'b');const best=s.snapshot().stats.daily.mostWorkersKilled;assert.equal(best.count,15);s.edit(best.id,{excluded:true});assert.equal(s.snapshot().stats.daily.mostWorkersKilled.count,3);s.edit(best.id,{excluded:false});s.acceptReplay(replay(now,25),'b');assert.equal(s.snapshot().stats.daily.mostWorkersKilled.count,25);s.configure({toonHandle:'5-S2-1-7'});assert.equal(s.snapshot().stats.daily.mostWorkersKilled,null);
});
test('goal scopes validate and legacy definitions retain today scope',()=>{
 assert.equal(G.sanitize({goals:[{id:'old',kind:'wins',target:1}]},G.defaults).goals[0].scope,'today');
 for(const patch of [{scope:'all'},{target:10000001},{target:-1}])assert.throws(()=>G.sanitize({goals:[{id:'x',kind:'zealots',target:10,...patch}]},G.defaults));
 assert.equal(G.sanitize({goals:[{id:'x',kind:'zealots',target:200000}]},G.defaults).goals[0].target,200000);
});
test('goal card preview isolates sample and cosmetic drafts from actual settings and unrelated fields',()=>{
 let events;const parent={},listeners={},nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},hidden:false,offsetHeight:250});return nodes.get(id);},renders=[];
 vm.runInNewContext(require('./preview-fixture.cjs')+fs.readFileSync(path.join(__dirname,'../public/ladder-output.js'),'utf8'),{window:{LadderOverlay:{render(){}},ScoreboardOverlay:{render(){}},GoalsOverlay:{render:(s,o)=>renders.push({s,o})}},document:{body:{classList:{add(){}}},getElementById:node},location:{search:'?preview=1&module=goals',origin:'http://localhost:1',pathname:'/output'},parent,URLSearchParams,innerWidth:800,innerHeight:320,addEventListener:(k,f)=>listeners[k]=f,EventSource:class{constructor(){events=this;}}});
 const draft={origin:'http://localhost:1',source:parent,data:{type:'goalsDraft',config:{goalsWidth:650,goals:[{id:'forged'}],toonHandle:'bad'},sample:true}};
 listeners.message(draft);const saved={scene:'blank',ladder:createReplayStore().snapshot()};events.onmessage({data:JSON.stringify(saved)});assert.equal(renders.at(-1).o.sample,true);assert.equal(renders.at(-1).o.reveal,true);assert.equal(renders.at(-1).s.ladder.config.goalsWidth,650);assert.equal(saved.ladder.config.goalsWidth,420);assert.equal(renders.at(-1).s.ladder.config.goals.length,0);assert.equal(node('goalsWidget').hidden,false);
 listeners.message({...draft,origin:'https://evil.example',data:{...draft.data,sample:false}});assert.equal(renders.at(-1).o.sample,true);
});
