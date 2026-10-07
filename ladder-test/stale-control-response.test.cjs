const test=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createReplayStore}=require('../ladder-replays.cjs');
const ControlConnection=require('../public/control-connection.js');
const nodes=new Map(),renders=[],obsChanges=[];let events,id='old',release;
function node(key){if(!nodes.has(key))nodes.set(key,{value:'',textContent:'',checked:false,style:{},classList:{toggle(){}},addEventListener(type,fn){this[type]=fn;},replaceChildren(){},append(){},setAttribute(){},className:''});return nodes.get(key);}
const stateFor=(serverInstanceId,scene)=>({serverInstanceId,config:{sc2AutoEnabled:true,sc2AutoMode:'ladder',sc2StartDelay:0,sc2EndDelay:0,obsMapping:{game:'Game',intermission:'Waiting'}},scene,ladder:createReplayStore().snapshot(),automation:{},replays:{busy:false,message:'',errors:[],recent:[]},keyboard:{status:'waiting'}});
const old=stateFor('old','intermission'),fresh=stateFor('new','game');
const win={ControlConnection,Workspace:{render:s=>renders.push({id:s.serverInstanceId,scene:s.scene}),connection(){}}};
const context=vm.createContext({window:win,document:{getElementById:node,querySelector:s=>s.startsWith('meta')?{content:''}:null,querySelectorAll:()=>[],createElement:()=>node('child')},ObsConnection:class{constructor(){this.ready=true;}async request(_,arg){obsChanges.push(arg.sceneName);}},EventSource:class{constructor(){events=this;}},fetch:async(url)=>{if(url==='/api/control-session')return new Response(JSON.stringify({token:(id==='old'?'a':'b').repeat(48),serverInstanceId:id}));return new Promise(r=>{release=r;});},location:{origin:'http://127.0.0.1:17864',hash:'#console'},console,setTimeout:()=>0,clearTimeout(){},URL,Blob});
vm.runInContext(fs.readFileSync(require.resolve('../public/ladder-ui.js'),'utf8'),context);
const flush=()=>new Promise(setImmediate);
test('late pre-reconnect action cannot render old state or switch OBS backwards',async()=>{events.onopen();events.onmessage({data:JSON.stringify(old)});await flush();const pending=win.AssistantActions.act('sc2Check');const rejected=assert.rejects(pending,/忽略旧响应/);await flush();events.onerror();id='new';events.onopen();events.onmessage({data:JSON.stringify(fresh)});await flush();assert.equal(renders.at(-1).id,'new');release(new Response(JSON.stringify(old)));await rejected;await flush();assert.equal(renders.at(-1).id,'new');assert.equal(obsChanges.at(-1),'Game');});
