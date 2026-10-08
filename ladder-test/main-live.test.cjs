const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createReplayStore}=require('../ladder-replays.cjs');
test('Main live preview uses the exact saved output scene and settings across game, waiting, away and tool changes',()=>{
 let events;const renders=[];const win={LadderOverlay:{render:s=>renders.push(s)},ScoreboardOverlay:{render(){}},GameFrameOverlay:{render(){}},CatKeyboardOverlay:{render(){}},DailyOverlay:{render(){}},LiveInteractionOverlay:{render(){}}};
 vm.runInNewContext(require('./preview-fixture.cjs')+fs.readFileSync(require.resolve('../public/ladder-output.js'),'utf8'),{window:win,document:{body:{classList:{add(){}}},getElementById:()=>({style:{},hidden:false})},location:{search:'?preview=1&live=1&phase=game',origin:'http://localhost:1',pathname:'/output'},URLSearchParams,innerWidth:1920,innerHeight:1080,addEventListener(){},EventSource:class{constructor(){events=this;}}});
 const store=createReplayStore();
 for(const scene of ['intermission','game','break','blank','game']){
  store.configure({catEnabled:scene==='game',gameFrameEnabled:scene==='game',showHUD:scene==='intermission',waitingTitle:'真实等待标题',breakTitle:'真实暂离标题'});
  const saved={scene,ladder:store.snapshot()};events.onmessage({data:JSON.stringify(saved)});assert.equal(renders.at(-1).scene,scene);assert.deepEqual(JSON.parse(JSON.stringify(renders.at(-1).ladder.config)),saved.ladder.config);
 }
 store.configure({enabled:false});events.onmessage({data:JSON.stringify({scene:'game',ladder:store.snapshot()})});assert.equal(renders.at(-1).ladder.config.enabled,false,'Live preview must not force disabled tools visible');
});
test('Main quick edits update only their selected fields, retain scene text drafts, and manual score controls work',async()=>{
 const store=createReplayStore(),state={config:{},ladder:store.snapshot(),automation:{},scene:'intermission'},nodes=new Map(),calls=[];
 function node(id){if(!nodes.has(id))nodes.set(id,{type:id.endsWith('ShowText')?'checkbox':'text',value:'',checked:false,disabled:false,hidden:false,dataset:{},style:{},contentWindow:{postMessage(){}},addEventListener(k,f){this[k]=f;},setAttribute(){},removeAttribute(){},getAttribute(){return '';},append(){},querySelector(){return node('customOption');},querySelectorAll(){return [];},classList:{toggle(){}}});return nodes.get(id);}
 const previews=['game','intermission','break','blank'].map(key=>Object.assign(node('preview-'+key),{dataset:{scenePreview:key}}));
 const records=['win','loss','undo'].map(key=>Object.assign(node('record-'+key),{dataset:{mainRecord:key}}));
 const win={scrollTo(){},GameFrameTemplate:require('../public/gameframe-template.js'),AssistantActions:{toast(){},async act(action,input={}){calls.push(JSON.parse(JSON.stringify({action,...input})));if(action==='ladderConfigure')store.configure(input.config);else if(action==='ladderRecord')store.add(input.result);else if(action==='ladderUndo')store.undo();state.ladder=store.snapshot();win.Workspace.render(state);return state;}}};
 vm.runInNewContext(require('./preview-fixture.cjs')+fs.readFileSync(require.resolve('../public/workspace.js'),'utf8'),{window:win,document:{body:{dataset:{}},getElementById:node,createElement:()=>({}),querySelector:()=>node('any'),querySelectorAll:s=>s==='[data-main-record]'?records:s==='[data-scene-preview]'?previews:[]},location:{hash:'',origin:'http://localhost:1'},addEventListener(){},console});
 win.Workspace.render(state);win.Workspace.connection(true);
 const previewMessages=[];node('sceneOnlyPreview').contentWindow.postMessage=(data)=>previewMessages.push(data);
 for(const button of previews){const before=calls.length;await button.click();assert.equal(calls.length,before,'Preview controls never send a live action');assert.equal(state.scene,'intermission');assert.equal(previewMessages.at(-1).phase,button.dataset.scenePreview);assert.equal(node('sceneOnlyPreview').dataset.src,'/output?preview=1&module=scene&phase='+button.dataset.scenePreview);}

 node('mainFrameEnabled').checked=true;await node('mainFrameEnabled').change();assert.deepEqual(calls.at(-1).config,{gameFrameEnabled:true});assert.equal(store.getConfig().autoTrack,true);
 node('mainKeyboardSide').value='right';await node('mainKeyboardSide').change();assert.deepEqual(calls.at(-1).config,{catKeyboardSide:'right'});
 node('mainSceneTextForm').input();node('mainWaitingTitle').value='排队啦';store.configure({waitingTitle:'另一处修改'});state.ladder=store.snapshot();win.Workspace.render(state);assert.equal(node('mainWaitingTitle').value,'排队啦');
 await node('mainSceneTextForm').submit({preventDefault(){}});assert.equal(store.getConfig().waitingTitle,'排队啦');assert.equal(state.scene,'intermission');
 await records[0].click();assert.equal(store.snapshot().stats.wins,1);await records[2].click();assert.equal(store.snapshot().stats.wins,0);
});

test('Independent scene preview retains its choice while actual output changes, and rejects unrelated messages',()=>{
 let events,message;const renders=[],parent={};const win={};for(const name of ['LadderOverlay','ScoreboardOverlay','GameFrameOverlay','CatKeyboardOverlay','DailyOverlay','LiveInteractionOverlay'])win[name]={render:s=>{if(name==='LadderOverlay')renders.push(s.scene);}};
 vm.runInNewContext(require('./preview-fixture.cjs')+fs.readFileSync(require.resolve('../public/ladder-output.js'),'utf8'),{window:win,parent,document:{body:{classList:{add(){}}},getElementById:()=>({style:{},hidden:false})},location:{search:'?preview=1&module=scene&phase=game',origin:'http://localhost:1',pathname:'/output'},URLSearchParams,innerWidth:1920,innerHeight:1080,addEventListener:(type,fn)=>{if(type==='message')message=fn;},EventSource:class{constructor(){events=this;}}});
 const update=scene=>events.onmessage({data:JSON.stringify({scene,ladder:createReplayStore().snapshot()})});
 const choose=(phase,origin='http://localhost:1',source=parent)=>message({origin,source,data:{type:'scenePreview',phase}});
 update('break');assert.equal(renders.at(-1),'game');choose('intermission');assert.equal(renders.at(-1),'intermission');update('game');assert.equal(renders.at(-1),'intermission');choose('blank');assert.equal(renders.at(-1),'blank');update('break');assert.equal(renders.at(-1),'blank');
 for(const args of [['game','http://untrusted'],['game','http://localhost:1',{}],['ending']]){choose(...args);assert.equal(renders.at(-1),'blank');}
});
