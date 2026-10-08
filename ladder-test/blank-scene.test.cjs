const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createReplayStore}=require('../ladder-replays.cjs'),{createAssistant}=require('../ladder-server.cjs');
test('Blank is an authorized manual scene, pauses automation, preserves tracking, and supports an OBS mapping',async t=>{
 const app=createAssistant({port:0,dataDir:null,intervalMs:60000,sc2Reader:async()=> 'live'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port,html=await(await fetch(base)).text(),token=html.match(/name="control-token" content="([a-f\d]+)"/)[1];
 const action=async(action,extra={})=>{const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Control-Token':token,Origin:base},body:JSON.stringify({action,...extra})});assert.equal(r.status,200);return r.json();};
 await action('configure',{config:{sc2AutoEnabled:true,sc2AutoPaused:false,obsMapping:{blank:'纯游戏'}}});const before=app.ladder.getConfig();const state=await action('transition',{scene:'blank'});assert.equal(state.scene,'blank');assert.equal(state.config.sc2AutoPaused,true);assert.equal(state.config.obsMapping.blank,'纯游戏');assert.deepEqual(app.ladder.getConfig(),before);assert.equal(before.autoTrack,true);
 await app.sc2.poll();await app.sc2.poll();assert.equal(app.snapshot().scene,'blank','Manual selection remains in place while automation is paused');
 await action('configure',{config:{sc2AutoPaused:false}});await app.sc2.poll();await app.sc2.poll();assert.equal(app.snapshot().scene,'game','Explicitly resuming automation releases the blank scene');
 assert.equal((await action('transition',{scene:'game'})).scene,'game');
});
test('Blank output clears every overlay and live gifts stay hidden during timer redraws',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,style:{setProperty(){}},classList:{toggle(){}}});return nodes.get(id);};let events;
 const win={};for(const k of ['LadderOverlay','ScoreboardOverlay','GameFrameOverlay','CatKeyboardOverlay','DailyOverlay','LiveInteractionOverlay'])win[k]={render:()=>{for(const n of nodes.values())n.hidden=false;}};
 vm.runInNewContext(require('./preview-fixture.cjs')+fs.readFileSync(require.resolve('../public/ladder-output.js'),'utf8'),{window:win,document:{body:{classList:{add(){}}},getElementById:node},location:{search:'?preview=1&live=1',origin:'http://localhost:1',pathname:'/output'},URLSearchParams,innerWidth:1920,innerHeight:1080,addEventListener(){},EventSource:class{constructor(){events=this;}}});
 events.onmessage({data:JSON.stringify({scene:'blank',ladder:createReplayStore().snapshot()})});for(const id of ['ladderWaiting','ladderHUD','scoreboardWidget','dailyWidget','gameFrame','catWidget','liveGift','liveRaffle','liveIncome'])assert.equal(node(id).hidden,true,id);
 let tick;const live={};vm.runInNewContext(fs.readFileSync(require.resolve('../public/live-overlay.js'),'utf8'),{window:live,document:{getElementById:node,body:{dataset:{}}},Date,setInterval:fn=>tick=fn});
 const state={scene:'blank',serverNow:Date.now(),ladder:createReplayStore().snapshot(),interaction:{config:{roomId:'1',giftEnabled:true,raffleEnabled:true,incomeEnabled:true},gifts:[],summary:{paidMilli:1000},raffle:{status:'collecting',title:'test',deadline:Date.now()+60000,winners:[]}}};
 live.LiveInteractionOverlay.render(state);tick();for(const id of ['liveGift','liveRaffle','liveIncome'])assert.equal(node(id).hidden,true,id);
});
test('Independent scoreboard, game frame and keyboard sources also honor the blank scene',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',style:{setProperty(){}},dataset:{},classList:{toggle(){}},querySelector:s=>node(s),querySelectorAll:()=>[],innerHTML:''});return nodes.get(id);};
 const win={GameFrameTemplate:require('../public/gameframe-template.js'),CatKeyboardTemplate:require('../public/cat-keyboard-template.js')};const context=vm.createContext({window:win,document:{getElementById:node,body:{dataset:{}}},EventSource:class{close(){}},requestAnimationFrame(){},Date,Set,JSON});
 for(const file of ['scoreboard.js','gameframe.js','cat-keyboard.js'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+file),'utf8'),context);
 const state={scene:'blank',ladder:createReplayStore().snapshot()};Object.assign(state.ladder.config,{catEnabled:true,gameFrameEnabled:true,scoreboardEnabled:true});
 win.ScoreboardOverlay.render(state,{standalone:true});win.GameFrameOverlay.render(state,{standalone:true});win.CatKeyboardOverlay.render(state,{standalone:true});for(const id of ['scoreboardWidget','gameFrame','catWidget'])assert.equal(node(id).hidden,true,id);
});
