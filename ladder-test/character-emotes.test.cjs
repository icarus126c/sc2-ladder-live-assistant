const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const K=require('../public/cat-keyboard-template.js'),{defaults,sanitize,createReplayStore}=require('../ladder-replays.cjs'),{filteredKeys}=require('../keyboard-input.cjs'),{createAssistant}=require('../ladder-server.cjs');

test('combination bindings normalize, validate and persist with independent dialogue settings',t=>{
 assert.equal(defaults.catEmoteKey,'');assert.equal(defaults.catEmoteText,'♥');assert.equal(defaults.catEmoteBubble,true);
 assert.equal(K.normalizeChord('1 + ShiftLeft + CtrlLeft'),'CtrlLeft+ShiftLeft+1');assert.deepEqual(K.chordKeys('CtrlRight+F9'),['CtrlRight','F9']);
 for(const patch of [{catEmoteKey:1},{catEmoteKey:'CtrlLeft+invalid'},{catEmoteKey:'Q+Q'},{catEmoteKey:'Q+W+E+R+T+Y+U'},{catEmoteText:'a\nb'},{catEmoteText:'a'.repeat(41)},{catEmoteText:null},{catEmoteBubble:'true'},{catEmoteHold:299},{catEmoteHold:3001}])assert.throws(()=>sanitize(patch));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cat-emote-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'records.json'),store=createReplayStore(file);store.configure({catCharacter:'vesna',catEmoteKey:'1+ShiftLeft+CtrlLeft',catEmoteText:'  ♥ 加油！  ',catEmoteBubble:false,catEmoteHold:1500,catRallyKey:'F2+AltRight'});
 const c=createReplayStore(file).snapshot().config;assert.equal(c.catEmoteKey,'CtrlLeft+ShiftLeft+1');assert.equal(c.catEmoteText,'♥ 加油！');assert.equal(c.catEmoteBubble,false);assert.equal(c.catEmoteHold,1500);assert.equal(c.catRallyKey,'AltRight+F2');
});

for(const character of ['nahida','vesna'])test(character+' expression requires all combination keys, holds after release and clears on chat, focus or binding change',()=>{
 let at=0,sequence=0;const c={...defaults,catCharacter:character,catEmoteKey:'CtrlLeft+ShiftLeft+1',catEmoteHold:600,catEmoteBubble:false},m=K.createModel({now:()=>at});const frame=(pressed,status='active')=>m.ingest({pressed,status,sequence:++sequence},c);
 frame(['1']);assert.equal(m.snapshot(c).emote,false);frame(['CtrlLeft','1']);assert.equal(m.snapshot(c).emote,false);frame(['CtrlLeft','ShiftLeft','1']);assert.equal(m.snapshot(c).emote,true);assert.equal(m.snapshot(c).rally,false);assert.ok(m.snapshot(c).pressed.includes('1'));
 at=10000;assert.equal(m.snapshot(c).emote,true);frame(['CtrlLeft','ShiftLeft']);at=10599;assert.equal(m.snapshot(c).emote,true);at=10600;assert.equal(m.snapshot(c).emote,false);
 frame(['CtrlLeft','ShiftLeft','1']);frame([],'chat');assert.equal(m.snapshot(c).emote,false);frame(['CtrlLeft','ShiftLeft','1']);frame([],'waiting');assert.equal(m.snapshot(c).emote,false);
 frame(['CtrlLeft','ShiftLeft','1']);c.catEmoteKey='F2';assert.equal(m.snapshot(c).emote,false);frame([]);frame(['F2']);assert.equal(m.snapshot(c).emote,true);c.catView='flat';assert.equal(m.snapshot(c).emote,false);c.catView='rear';c.catCharacter='cat';assert.equal(m.snapshot(c).emote,false);
});

test('combination triggers bypass disabled display categories without lighting hidden keys, including Artanis',()=>{
 for(const character of ['nahida','vesna','artanis']){const c={...defaults,catCharacter:character,catEmoteKey:'CtrlLeft+F2',catRallyKey:'CtrlLeft+F2',catModifiers:false,catFunctions:false};assert.deepEqual(new Set(filteredKeys(['CtrlLeft','CtrlRight','F2','F9','Q'],c)),new Set(['Q','F2','CtrlLeft']));const m=K.createModel({now:()=>0});m.ingest({status:'active',pressed:filteredKeys(['CtrlLeft','F2'],c),sequence:1},c);assert.deepEqual(m.snapshot(c).pressed,[]);assert.equal(m.snapshot(c)[character==='artanis'?'rally':'emote'],true);}
});

test('dialogue text is escaped and optional; flat keyboard keeps no character or dialogue',()=>{
 for(const character of ['nahida','vesna']){const html=K.build({...defaults,catCharacter:character,catEmoteText:'<img src=x> ♥',catEmoteBubble:false});assert.match(html,/cat-emote-callout[^>]* hidden/);assert.match(html,/&lt;img src=x&gt; ♥/);assert.doesNotMatch(html,/<img/);assert.doesNotMatch(K.build({...defaults,catCharacter:character,catView:'flat'}),/cat-avatar|cat-emote-callout/);assert.match(K.build({...defaults,catCharacter:character}),/♥/);}
});

test('workspace records an actual modifier combination, previews without saving, and independently edits dialogue',async()=>{
 const nodes=new Map(),messages=[],listeners={},sent=[];const checkboxes=new Set(['catEmoteBubble','catCurve','catHints','catLetters','catNumbers','catFunctions','catModifiers','catNavigation','catMouse','catChatGuard']);function node(id){if(!nodes.has(id))nodes.set(id,{type:checkboxes.has(id)?'checkbox':'text',value:'',checked:false,style:{},addEventListener(type,fn){this[type]=fn;},append(){},setAttribute(){},contentWindow:{postMessage(m){messages.push(m);}}});return nodes.get(id);}
 const state={scene:'game',ladder:{config:{...defaults,catCharacter:'nahida',catEnabled:true}},keyboard:{status:'waiting'}},win={CatKeyboardTemplate:K,AssistantActions:{toast(){},act:async(action,payload)=>{sent.push(payload.config);Object.assign(state.ladder.config,payload.config);return state;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/cat-workspace.js'),'utf8'),{window:win,document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>node('option')},location:{hash:'#catkeyboard',origin:'http://localhost'},addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn);},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){}});win.CatWorkspace.render(state);
 assert.equal(node('catEmoteText').value,'♥');assert.equal(node('catEmoteBubble').checked,true);assert.equal(node('catEmoteSettings').hidden,false);
 node('catEmoteRecord').click();const event=(code,extra={})=>({code,preventDefault(){},stopImmediatePropagation(){},...extra});for(const code of ['ControlLeft','ShiftLeft','Digit1'])for(const fn of listeners.keydown)fn(event(code,{ctrlKey:true,shiftKey:code!=='ControlLeft'}));for(const fn of listeners.keyup)fn(event('Digit1'));
 assert.equal(node('catEmoteKey').value,'CtrlLeft+ShiftLeft+1');assert.equal(sent.length,0);assert.equal(state.ladder.config.catEmoteKey,'');node('catEmoteDemo').click();assert.equal(messages.at(-1).type,'catDemo');assert.equal(messages.at(-1).expression,true);assert.deepEqual([...messages.at(-1).pressed],['CtrlLeft','ShiftLeft','1']);
 node('catEmoteText').value='♥ 加油';node('catEmoteBubble').checked=false;node('catForm').input();await node('catForm').submit({preventDefault(){}});await new Promise(setImmediate);assert.equal(sent.at(-1).catEmoteText,'♥ 加油');assert.equal(sent.at(-1).catEmoteBubble,false);assert.equal(sent.at(-1).catEmoteKey,'CtrlLeft+ShiftLeft+1');
 node('catEmoteRecord').click();for(const fn of listeners.keydown)fn(event('Escape'));for(const fn of listeners.keydown)fn(event('KeyQ'));for(const fn of listeners.keyup)fn(event('KeyQ'));assert.equal(node('catEmoteKey').value,'CtrlLeft+ShiftLeft+1');node('catEmoteClear').click();assert.equal(node('catEmoteKey').value,'');node('catDiscard').click();assert.equal(node('catEmoteKey').value,'CtrlLeft+ShiftLeft+1');
});

test('both expression sheets are transparent two-cell sprites served with cache validation',async t=>{
 const app=createAssistant({port:0,dataDir:null,sc2Reader:async()=>{throw Error('offline');},intervalMs:60000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const root='http://127.0.0.1:'+app.server.address().port;
 for(const character of ['nahida','vesna']){const file=character+'-emote-v1.png',bytes=fs.readFileSync(path.join(__dirname,'../public/assets',file));assert.equal(bytes[25],6);assert.equal(bytes.readUInt32BE(16),bytes.readUInt32BE(20)*2);const response=await fetch(root+'/assets/'+file);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);assert.equal((await fetch(root+'/assets/'+file,{headers:{'If-None-Match':response.headers.get('etag')}})).status,304);}
});
