const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {discoverAccounts,inspectAccount}=require('../account-discovery.cjs');
const {createAssistant}=require('../ladder-server.cjs');
function fixture(t){const documents=fs.mkdtempSync(path.join(os.tmpdir(),'账号发现-'));t.after(()=>fs.rmSync(documents,{recursive:true,force:true}));return documents;}
function profile(documents,handle,at=10000){const dir=path.join(documents,'StarCraft II','Accounts','123',handle,'Replays','Multiplayer');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'录像.SC2Replay');fs.writeFileSync(file,'replay');fs.utimesSync(file,new Date(at),new Date(at));return dir;}
test('account discovery lists all local accounts, orders by replay time and never guesses a current player',async t=>{
 const documents=fixture(t),first=profile(documents,'5-S2-1-123',20000),second=profile(documents,'3-S2-1-456',10000);fs.mkdirSync(path.join(documents,'StarCraft II','Accounts','123','Hotkeys'));
 const found=await discoverAccounts({replayDirectory:first},{documents:[documents,documents]});assert.equal(found.candidates.length,2);assert.equal(found.candidates[0].toonHandle,'5-S2-1-123');assert.equal(found.candidates[1].replayDirectory,second);assert.equal(found.toonHandle,undefined);
});
test('account inspection matches the complete ID, ignores observer/opponent names and tries another replay',async t=>{
 const documents=fixture(t),dir=profile(documents,'5-S2-1-123',20000),old=path.join(dir,'旧录像.SC2Replay');fs.writeFileSync(old,'old');fs.utimesSync(old,new Date(10000),new Date(10000));let calls=0;
 const result=await inspectAccount({},dir,{documents:[documents],parser:async(file,config)=>{calls++;assert.equal(config.toonHandle,'5-S2-1-123');return{players:file===old?[{toonHandle:'5-S2-1-999',name:'Opponent',human:true},{toonHandle:'5-S2-1-123',name:'MyName',human:true,race:'Protoss'}]:[{toonHandle:'5-S2-1-999',name:'ObserverTarget',human:true}]};}});
 assert.equal(calls,2);assert.deepEqual(result.names,['MyName']);assert.equal(result.race,'P');assert.equal(result.toonHandle,'5-S2-1-123');
});
test('missing, invalid and unreadable recordings preserve folder ID without inventing a nickname',async t=>{
 const documents=fixture(t),dir=profile(documents,'5-S2-1-123');const result=await inspectAccount({},dir,{documents:[documents],parser:async()=>{throw Error('invalid replay');}});assert.deepEqual(result.names,[]);assert.equal(result.toonHandle,'5-S2-1-123');await assert.rejects(inspectAccount({},documents,{documents:[documents]}),/目录已变化/);
 const empty=await discoverAccounts({},{documents:[path.join(documents,'missing')]});assert.deepEqual(empty.candidates,[]);
});
test('custom configured account folders are found even outside default Documents',async t=>{
 const documents=fixture(t),dir=profile(documents,'5-S2-1-789');const result=await discoverAccounts({replayDirectory:dir},{documents:[]});assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].toonHandle,'5-S2-1-789');
});
test('discovery and inspection require authenticated local control and never save identity or count a result',async t=>{
 const documents=fixture(t),dir=profile(documents,'5-S2-1-123');const app=createAssistant({port:0,dataDir:null,sc2Reader:async()=> 'offline',intervalMs:100000,accountOptions:{documents:[documents],parser:async()=>({players:[{toonHandle:'5-S2-1-123',name:'Me',human:true,race:'Terran'}]})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base='http://127.0.0.1:'+app.server.address().port,html=await(await fetch(base)).text(),token=html.match(/name="control-token" content="([a-f\d]+)"/)[1];const post=(body,headers={})=>fetch(base+'/api/action',{method:'POST',headers,body:JSON.stringify(body)});
 assert.equal((await post({action:'identityDetect'})).status,403);assert.equal((await post({action:'identityDetect'},{'X-Control-Token':token,Origin:'https://other.test'})).status,403);
 const detected=await(await post({action:'identityDetect'},{'X-Control-Token':token})).json();assert.equal(detected.candidates.length,1);
 const inspected=await(await post({action:'identityInspect',replayDirectory:dir},{'X-Control-Token':token})).json();assert.deepEqual(inspected.names,['Me']);assert.equal(app.snapshot().ladder.config.toonHandle,'');assert.equal(app.snapshot().ladder.stats.total,0);
 assert.equal((await fetch(base+'/identity-workspace.js')).status,200);
});
test('multiple accounts require a choice; discovery fills a draft and uses the existing save action',async()=>{
 const nodes=new Map(),calls=[];function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',children:[],hidden:false,addEventListener(type,fn){this[type]=fn;},replaceChildren(){this.children=[];},append(value){this.children.push(value);},dispatchEvent(){this.dirty=true;}});return nodes.get(id);}
 const candidates=[{toonHandle:'5-S2-1-123',replayDirectory:'one',lastReplayAt:10000},{toonHandle:'3-S2-1-456',replayDirectory:'two'}];const win={AssistantActions:{toast(){},async act(action,input){calls.push({action,input});return action==='identityDetect'?{candidates,message:'choose'}:{...candidates[1],names:['Me'],race:'P',message:'draft'};}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/identity-workspace.js'),'utf8'),{window:win,document:{getElementById:node,createElement:()=>({})},Event:class{}});
 await node('detectIdentity').click();assert.equal(node('toonHandle').value,'');assert.equal(calls.length,1);node('detectedAccounts').value='1';await node('detectedAccounts').change();assert.equal(node('toonHandle').value,'3-S2-1-456');assert.equal(node('playerNames').value,'Me');assert.equal(win.IdentityDiscovery.directory(),'two');assert.equal(node('identityForm').dirty,true);assert.equal(calls.length,2,'No configuration write during discovery');win.IdentityDiscovery.saved();assert.equal(win.IdentityDiscovery.directory(),'');
});
