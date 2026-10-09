const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const daily=require('../daily-stats.cjs'),{createReplayStore}=require('../ladder-replays.cjs'),{createReplayWatcher}=require('../replay-watcher.cjs');
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/daily-model.js'),'utf8'),{window});
const at=Date.parse('2026-10-09T01:00:00Z'),me={toonHandle:'5-S2-1-1',name:'Me',human:true,race:'Protoss'},op={toonHandle:'5-S2-1-2',name:'Other',human:true,race:'Zerg'};
const missing={version:1,zerglings:null,zealots:null,workersKilled:null,note:'暂不支持版本 98370 的单位跟踪统计'};
const parsed=()=>({ok:true,at,durationSeconds:600,map:'Map',players:[me,op],selfPlayers:[me],opponents:[op],selfResult:'W',dailyMetrics:missing});
test('daily unknowns expose the actual reason, preserve known lower bounds and distinguish manual-only records from zero games',()=>{
 const records=[{replayKey:'a',dailyMetrics:missing},{replayKey:'b',dailyMetrics:missing}];let d=daily.summarize(records);assert.equal(d.zealots,null);assert.equal(d.issues[0].count,2);assert.deepEqual(d.issues[0].keys,['zerglings','zealots','workersKilled']);
 const ladder={config:{enabled:true,autoTrack:true,toonHandle:me.toonHandle,replayDirectory:'replays',dailyZealots:true},stats:{daily:d}};
 assert.equal(window.DailyModel.rows(ladder)[0].value,'—');assert.match(window.DailyModel.diagnostics(ladder).join(''),/98370.*更新分享包/);
 d=daily.summarize([...records,{replayKey:'c',dailyMetrics:{version:1,zerglings:0,zealots:20,workersKilled:null,note:'部分死亡事件缺少类型或击杀归属'}}]);ladder.stats.daily=d;
 assert.equal(window.DailyModel.rows(ladder)[0].value,'≥ 20');assert.equal(d.coverage.zealots,1);assert.deepEqual(d.issues[1].keys,['workersKilled']);
 assert.equal(daily.summarize([{source:'manual'}]).zealots,null);assert.equal(daily.summarize([]).zealots,0);
 const legacy=daily.summarize([{replayKey:'legacy'}]);assert.match(legacy.issues[0].note,/扫描今日录像/);
});
test('daily diagnostics explain missing identity, disabled automatic reading, manual records and parser failures',()=>{
 const d=daily.summarize([{source:'manual'}]);const text=window.DailyModel.diagnostics({config:{enabled:true,autoTrack:false,names:[],replayDirectory:''},stats:{daily:d}},{errors:[{message:'解析超时'}]}).join('；');
 for(const word of ['自动读取未开启','录像目录','自己的账号','手动补记','解析超时'])assert.ok(text.includes(word),text);
});
test('unavailable unit metrics retry with delay, recover unchanged files and never add duplicate results',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'daily-retry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let clock=at-10000,calls=0;const store=createReplayStore(null,()=>clock);clock=at+10000;store.configure({toonHandle:me.toonHandle,replayDirectory:dir});
 const file=path.join(dir,'match.SC2Replay');fs.writeFileSync(file,'fixture');fs.utimesSync(file,new Date(at),new Date(at));
 const watcher=createReplayWatcher({store,now:()=>clock,intervalMs:1000000,parser:async()=>{calls++;return {...parsed(),dailyMetrics:calls===1?missing:{version:1,zerglings:0,zealots:24,workersKilled:15}};}});t.after(()=>watcher.close());
 await watcher.scan('auto');const before=store.snapshot();assert.match(watcher.snapshot().recent[0].message,/单位统计未完成.*98370/);await watcher.scan('auto');assert.equal(calls,1);
 clock+=30000;await watcher.scan('auto');const after=store.snapshot();assert.equal(calls,2);assert.equal(after.stats.daily.zealots,24);assert.equal(after.stats.daily.issues.length,0);assert.equal(after.stats.total,1);assert.equal(after.session.id,before.session.id);assert.equal(after.records[0].id,before.records[0].id);
 clock+=180000;await watcher.scan('auto');assert.equal(calls,2);
});
test('persistently unavailable unit metrics stop automatic retries, while manual scans and changed files can retry',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'daily-retry-limit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let clock=at+10000,calls=0;const store=createReplayStore(null,()=>clock);store.configure({toonHandle:me.toonHandle,replayDirectory:dir});const file=path.join(dir,'match.SC2Replay');fs.writeFileSync(file,'fixture');fs.utimesSync(file,new Date(at),new Date(at));
 const watcher=createReplayWatcher({store,now:()=>clock,intervalMs:1000000,parser:async()=>{calls++;return parsed();}});t.after(()=>watcher.close());
 await watcher.scan('auto');clock+=30000;await watcher.scan('auto');clock+=120000;await watcher.scan('auto');assert.equal(calls,3);clock+=3600000;await watcher.scan('auto');assert.equal(calls,3);
 await watcher.scan('today');assert.equal(calls,4);fs.appendFileSync(file,'changed');fs.utimesSync(file,new Date(clock-5000),new Date(clock-5000));await watcher.scan('auto');assert.equal(calls,5);assert.equal(store.snapshot().stats.total,1);
});
