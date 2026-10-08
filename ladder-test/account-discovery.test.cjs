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
 const detected=await(await post({action:'identityDetect'},{'X-Control-Token':token})).json();assert.equal(detected.candidates.length,1);assert.deepEqual(detected.candidates[0].names,['Me']);
 const inspected=await(await post({action:'identityInspect',replayDirectory:dir},{'X-Control-Token':token})).json();assert.deepEqual(inspected.names,['Me']);assert.equal(app.snapshot().ladder.config.toonHandle,'');assert.equal(app.snapshot().ladder.stats.total,0);
 assert.equal((await fetch(base+'/identity-workspace.js')).status,200);
});
test('multiple accounts require a choice; discovery fills a draft and uses the existing save action',async()=>{
 const nodes=new Map(),calls=[];function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',children:[],hidden:false,addEventListener(type,fn){this[type]=fn;},replaceChildren(){this.children=[];},append(value){this.children.push(value);},dispatchEvent(){this.dirty=true;}});return nodes.get(id);}
 const candidates=[{toonHandle:'5-S2-1-123',replayDirectory:'one',lastReplayAt:10000,names:['<Team> 同名','同名']},{toonHandle:'3-S2-1-456',replayDirectory:'two'}];const win={AssistantActions:{toast(){},async act(action,input){calls.push({action,input});return action==='identityDetect'?{candidates,message:'choose'}:{...candidates[1],names:['Me'],race:'P',message:'draft'};}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/identity-workspace.js'),'utf8'),{window:win,document:{getElementById:node,createElement:()=>({})},Event:class{}});
 await node('detectIdentity').click();assert.equal(node('toonHandle').value,'');assert.equal(calls.length,1);assert.match(node('detectedAccounts').children[1].textContent,/^同名 · 国服 · 5-S2-1-123 · 最近录像/);assert.match(node('detectedAccounts').children[2].textContent,/^昵称未读取 · 韩服 · 3-S2-1-456 · 尚无录像/);node('detectedAccounts').value='1';await node('detectedAccounts').change();assert.equal(node('toonHandle').value,'3-S2-1-456');assert.equal(node('playerNames').value,'Me');assert.equal(win.IdentityDiscovery.directory(),'two');assert.equal(node('identityForm').dirty,true);assert.equal(calls.length,2,'No configuration write during discovery');win.IdentityDiscovery.saved();assert.equal(win.IdentityDiscovery.directory(),'');
});

test('switch button never reselects the old account and drafts the new ID and directory together',async()=>{
 const nodes=new Map(),calls=[];function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',children:[],hidden:false,addEventListener(type,fn){this[type]=fn;},replaceChildren(){this.children=[];},append(value){this.children.push(value);},dispatchEvent(){this.dirty=true;}});return nodes.get(id);}
 const candidates=[{toonHandle:'5-S2-1-123',replayDirectory:'old'},{toonHandle:'3-S2-1-456',replayDirectory:'new'}],location={hash:'console'};node('toonHandle').value='5-S2-1-123';
 const win={AssistantActions:{toast(){},async act(action,input){calls.push({action,input});return action==='identityDetect'?{candidates,message:'choose'}:{...candidates[1],names:['New'],race:'Z',message:'draft'};}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/identity-workspace.js'),'utf8'),{window:win,document:{getElementById:node,createElement:()=>({})},location,Event:class{}});
 await node('switchIdentityQuick').click();assert.equal(location.hash,'settings');assert.equal(node('detectedAccounts').value,'');assert.equal(calls.length,1);assert.equal(node('toonHandle').value,'5-S2-1-123');assert.equal(win.IdentityDiscovery.directory(),'');
 node('detectedAccounts').value='1';await node('detectedAccounts').change();assert.equal(node('toonHandle').value,'3-S2-1-456');assert.equal(win.IdentityDiscovery.directory(),'new');assert.equal(calls.length,2);
 node('toonHandle').value='5-S2-1-123';assert.equal(win.IdentityDiscovery.directory(),'','stale directory cannot accompany a manually changed ID');
 await node('switchIdentity').click();assert.equal(win.IdentityDiscovery.directory(),'');assert.equal(calls.length,3);
});

test('nickname discovery keeps account order, limits readers and reuses unchanged metadata for selection',async t=>{
 const documents=fixture(t),dirs=[];for(let n=1;n<=4;n++)dirs.push(profile(documents,'5-S2-1-'+n,10000*n));let running=0,peak=0,calls=0;
 const parser=async(file,c)=>{assert.equal(c.metadataOnly,true);assert.deepEqual(c.names,[]);running++;peak=Math.max(peak,running);calls++;await new Promise(setImmediate);running--;return {players:[{human:true,toonHandle:'5-S2-1-999',name:'Opponent'},{human:true,toonHandle:c.toonHandle,name:'<队标> 昵称'+c.toonHandle.slice(-1),race:'Protoss'}]};};
 const options={documents:[documents],includeNames:true,parser},first=await discoverAccounts({},options);assert.equal(calls,4);assert.equal(peak,2);assert.deepEqual(first.candidates.map(c=>c.names.at(-1)),['昵称4','昵称3','昵称2','昵称1']);assert.equal(first.toonHandle,undefined);
 await discoverAccounts({},options);await inspectAccount({},dirs[3],options);assert.equal(calls,4,'Selection and unchanged scans reuse identity metadata');
 const newer=path.join(dirs[3],'新录像.SC2Replay');fs.writeFileSync(newer,'new');fs.utimesSync(newer,new Date(50000),new Date(50000));await discoverAccounts({},options);assert.equal(calls,5,'New recording refreshes the nickname');
 fs.appendFileSync(newer,' changed');await discoverAccounts({},options);assert.equal(calls,6,'Changed recording invalidates the nickname cache');
});

test('nickname discovery retries failed reads and never substitutes an opponent or observer name',async t=>{
 const documents=fixture(t),dir=profile(documents,'5-S2-1-123');let fail=true;const parser=async()=>{if(fail)throw Error('unreadable');return {players:[{human:true,toonHandle:'5-S2-1-999',name:'Opponent'},{human:false,toonHandle:'5-S2-1-123',name:'AI'},{human:true,toonHandle:'5-S2-1-123',name:'<img src=x>',race:'Zerg'}]};};
 let found=await discoverAccounts({},{documents:[documents],includeNames:true,parser});assert.deepEqual(found.candidates[0].names,[]);fail=false;found=await discoverAccounts({},{documents:[documents],includeNames:true,parser});assert.deepEqual(found.candidates[0].names,['<img src=x>']);assert.equal(found.candidates[0].replayDirectory,dir);
});
