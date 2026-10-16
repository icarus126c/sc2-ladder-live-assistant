const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../public/scene-customization.js');
const {createReplayStore} = require('../ladder-replays.cjs');

function editor() {
  const nodes = new Map(), all = [], events = {}, calls = [], messages = [];
  function node(tag = 'div', id = '') {
    const el = {tagName: tag, type: '', value: '', checked: false, disabled: false, hidden: false, dataset: {}, children: [], style: {}, attributes: {}, handlers: {},
      append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; },
      addEventListener(type, fn) { this.handlers[type] = fn; }, setAttribute(key, value) { this.attributes[key] = value; },
      contentWindow: {postMessage(message) { messages.push(message); }}
    };
    Object.defineProperty(el, 'id', {get() { return this._id; }, set(value) { this._id = value; if (value) nodes.set(value, this); }});
    el.id = id; all.push(el); return el;
  }
  const get = id => nodes.get(id) || node('div', id);
  for (const phase of M.phases) node('button').dataset.editScene = phase;
  const store = createReplayStore(), state = {scene: 'game', ladder: store.snapshot()};
  let request = async (action, input) => { store.configure(input.config); return {...state, ladder: store.snapshot()}; };
  const win = {SceneCustomization: M, SceneThemes: require('../public/scene-themes.js'), ResourceTemplate: require('../public/resource-template.js'), AssistantActions: {toast() {}, act(action, input) { calls.push({action, ...input}); return request(action, input); }}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/scene-editor.js'), 'utf8'), {window: win, document: {getElementById: get, createElement: node, querySelectorAll(selector) { return selector === '[data-edit-scene]' ? all.filter(el => el.dataset.editScene) : []; }}, location: {origin: 'http://localhost', hash: '#scenes'}, addEventListener(type, fn) { events[type] = fn; }});
  win.SceneEditor.render(state); win.SceneEditor.connection(true);
  const click = id => get(id).handlers.click();
  const change = (key, value) => { const el = get('sceneEdit-' + key); if (typeof value === 'boolean') { el.type = 'checkbox'; el.checked = value; } else el.value = value; get('sceneEditorForm').handlers.input({target: el}); };
  const scene = phase => all.find(el => el.dataset.editScene === phase).handlers.click();
  const submit = () => get('sceneEditorForm').handlers.submit({preventDefault() {}});
  const preview = () => messages.filter(message => message.type === 'editorDraft').at(-1);
  return {get, click, change, scene, submit, preview, calls, state, win, events, request(fn) {request = fn;}};
}

test('Scene switch explicitly preserves, discards or saves the current draft without switching live output', async () => {
  const e = editor(); e.scene('loading'); e.change('loadingTitle', '下一场'); e.scene('break');
  assert.equal(e.preview().phase, 'loading'); assert.equal(e.get('sceneSwitchNotice').hidden, false); assert.equal(e.calls.length, 0);
  e.click('sceneSwitchCancel'); assert.equal(e.preview().config.loadingTitle, '下一场'); assert.equal(e.get('sceneSwitchNotice').hidden, true);
  e.scene('break'); await e.click('sceneSwitchSave'); assert.equal(e.preview().phase, 'break'); assert.equal(e.calls.length, 1); assert.equal(e.calls[0].config.loadingTitle, '下一场'); assert.equal(e.state.scene, 'game');
  e.change('breakTitle', '未保存'); e.scene('game'); e.click('sceneSwitchDiscard'); assert.equal(e.preview().phase, 'game'); assert.equal(e.calls.length, 1);
  e.scene('break'); assert.notEqual(e.preview().config.breakTitle, '未保存');
});

test('Failed save retains draft and pending destination; concurrent save and edits are blocked', async () => {
  const e = editor(); e.scene('loading'); e.change('loadingTitle', '保留草稿'); e.scene('break');
  let reject; e.request(() => new Promise((resolve, fail) => { reject = fail; }));
  const saving = e.click('sceneSwitchSave'); assert.equal(e.get('sceneEditorApply').disabled, true); assert.equal(e.get('sceneEdit-loadingTitle').disabled, true);
  e.change('loadingTitle', '保存中插入'); await e.submit(); assert.equal(e.calls.length, 1);
  reject(new Error('Connection lost')); await saving;
  assert.equal(e.preview().phase, 'loading'); assert.equal(e.preview().config.loadingTitle, '保留草稿'); assert.equal(e.get('sceneSwitchNotice').hidden, false);
  assert.equal(e.get('sceneEditorApply').disabled, false);
});

test('Layer toggle enables its tool, while hiding a scene does not disable the tool globally', async () => {
  const e = editor(); e.change('gameShowKeyboard', true); await e.submit();
  assert.equal(e.calls[0].config.gameShowKeyboard, true); assert.equal(e.calls[0].config.catEnabled, true);
  e.change('gameShowKeyboard', false); await e.submit(); assert.equal(e.calls[1].config.gameShowKeyboard, false); assert.equal('catEnabled' in e.calls[1].config, false);
});

test('Only same-origin preview movement creates a layout draft; unrelated payloads do not mark dirty', () => {
  const e = editor(), source = e.get('sceneEditorPreview').contentWindow;
  e.events.message({source, origin: 'http://foreign', data: {type: 'editorMoved', config: {scoreboardX: 999}}});
  e.events.message({source, origin: 'http://localhost', data: {type: 'editorMoved', config: {toonHandle: 'bad', enabled: false}}});
  assert.equal(e.get('sceneEditorApply').disabled, true);
  e.events.message({source, origin: 'http://localhost', data: {type: 'editorMoved', config: {scoreboardX: 999}}});
  assert.equal(e.preview().config.scoreboardX, 999); assert.equal(e.get('sceneEditorApply').disabled, false);
});

test('one drag is one undo step; redo restores it, a new edit clears redo, and preview selection chooses its inspector',()=>{
 const e=editor(),source=e.get('sceneEditorPreview').contentWindow,send=data=>e.events.message({source,origin:'http://localhost',data});
 const initial=e.preview().config.scoreboardX;
 send({type:'editorMoved',gesture:'one',config:{scoreboardX:600}});send({type:'editorMoved',gesture:'one',config:{scoreboardX:700,scoreboardWidth:620}});
 e.click('sceneEditUndo');assert.equal(e.preview().config.scoreboardX,initial);assert.equal(e.get('sceneEditorApply').disabled,true);
 e.click('sceneEditRedo');assert.equal(e.preview().config.scoreboardX,700);assert.equal(e.preview().config.scoreboardWidth,620);
 send({type:'editorSelected',target:'goals'});assert.equal(e.get('sceneDragTarget').value,'goals');assert.ok(e.get('sceneEdit-goalsX'));
 e.click('sceneEditUndo');send({type:'editorMoved',gesture:'two',config:{goalsX:70,goalsWidth:500}});assert.equal(e.get('sceneEditRedo').disabled,true);assert.equal(e.preview().config.goalsWidth,500);
});

test('HUD can be selected, moved, resized, undone and saved without changing account or the live scene',async()=>{
 const e=editor();e.scene('custom');const source=e.get('sceneEditorPreview').contentWindow,send=data=>e.events.message({source,origin:'http://localhost',data});
 e.change('customShowHUD',true);send({type:'editorSelected',target:'hud'});assert.equal(e.get('sceneDragTarget').value,'hud');assert.equal(e.get('sceneEdit-x').value,32);assert.equal(e.get('sceneEdit-width').value,560);
 send({type:'editorMoved',gesture:'hud-drag',config:{x:180,y:270,width:640,names:['intruder'],mmr:9999}});assert.equal(e.preview().config.x,180);assert.equal(e.preview().config.width,640);assert.equal(e.get('sceneEdit-y').value,270);
 e.click('sceneEditUndo');assert.equal(e.preview().config.x,32);e.click('sceneEditRedo');assert.equal(e.preview().config.x,180);
 e.change('scale',125);e.change('opacity',70);await e.submit();const saved=e.calls.at(-1).config;assert.equal(saved.customShowHUD,true);assert.equal(saved.showHUD,true);assert.equal(saved.width,640);assert.equal(saved.scale,125);assert.equal(saved.opacity,70);assert.equal(saved.names,undefined);assert.equal(saved.mmr,undefined);assert.equal(e.state.scene,'game');
});

test('HUD drag respects actual widget scaling, keyboard boundaries and blank/game scene restrictions',()=>{
 const events={},handlers={},messages=[],parent={postMessage:m=>messages.push(m)},handle={style:{},append(){},setAttribute(){},setPointerCapture(){},focus(){},addEventListener(k,fn){handlers[k]=fn;}};
 const widget={hidden:false,style:{},closest(){return null;},getBoundingClientRect(){return{left:50,top:40,width:300,height:150};}},canvas={getBoundingClientRect(){return{left:0,top:0,width:960};}};
 const state={scene:'custom',ladder:{config:{x:100,y:80,width:400,scale:150}}};
 const grip={style:{},setAttribute(){} };let created=0;
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/scene-editor-preview.js'),'utf8'),{URLSearchParams,location:{search:'?preview=1&module=editor',origin:'http://localhost'},window:{SceneCustomization:M,SceneEditorPreviewState:state},parent,document:{createElement:()=>created++?grip:handle,body:{append(){}},getElementById:id=>id==='canvas'?canvas:widget},addEventListener:(k,fn)=>events[k]=fn,setInterval(){}});
 events.message({source:parent,origin:'http://localhost',data:{type:'editorDragTarget',target:'hud'}});assert.equal(handle.hidden,false);assert.equal(widget.style.pointerEvents,'auto');handlers.keydown({key:'ArrowRight',shiftKey:true,preventDefault(){}});assert.equal(messages.at(-1).config.x,110);
 handlers.pointerdown({button:0,target:handle,pointerId:1,clientX:0,clientY:0,preventDefault(){}});handlers.pointermove({clientX:20,clientY:15});assert.equal(messages.at(-1).config.x,140);assert.equal(messages.at(-1).config.y,110);handlers.pointerup();
 handlers.pointerdown({button:0,target:grip,pointerId:1,clientX:0,clientY:0,preventDefault(){}});handlers.pointermove({clientX:30,clientY:0});assert.equal(messages.at(-1).config.width,440);handlers.pointerup();
 state.ladder.config.x=1899;handlers.keydown({key:'ArrowRight',shiftKey:true,preventDefault(){}});assert.equal(messages.at(-1).config.x,1900);state.scene='game';events.message({source:parent,origin:'http://localhost',data:{type:'editorDragTarget',target:'hud'}});assert.equal(handle.hidden,true);state.scene='blank';events.message({source:parent,origin:'http://localhost',data:{type:'editorDragTarget',target:'hud'}});assert.equal(handle.hidden,true);
});

test('HUD scene switches work independently of scene text and retain the saved position',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',style:{setProperty(){}},getAttribute(){return '';},parentElement:{},replaceChildren(){},append(){}});return nodes.get(id);},win={SceneThemes:require('../public/scene-themes.js')},store=createReplayStore();
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/ladder-overlay.js'),'utf8'),{window:win,document:{getElementById:node}});
 for(const [scene,prefix]of [['intermission','waiting'],['loading','loading'],['break','break'],['custom','custom']]){
  store.configure({showHUD:true,[prefix+'ShowHUD']:true,[prefix+'ShowText']:false,x:210,y:330,width:620,scale:125});const state={scene,ladder:store.snapshot()};win.LadderOverlay.render(state);assert.equal(node('ladderHUD').hidden,false,scene);assert.equal(node('ladderHUD').style.left,'210px');assert.equal(node('ladderHUD').style.top,'330px');assert.equal(node('ladderHUD').style.width,'620px');assert.equal(node('ladderHUD').style.transform,'scale(1.25)');state.ladder.config[prefix+'ShowHUD']=false;win.LadderOverlay.render(state);assert.equal(node('ladderHUD').hidden,true);
 }
 win.LadderOverlay.render({scene:'game',ladder:store.snapshot()});assert.equal(node('ladderHUD').hidden,true);
});

test('waiting timer can be selected and laid out without changing its live start time or the active scene',async()=>{
 const e=editor();e.scene('intermission');const source=e.get('sceneEditorPreview').contentWindow,send=data=>e.events.message({source,origin:'http://localhost',data});send({type:'editorSelected',target:'timer'});assert.equal(e.get('sceneDragTarget').value,'timer');send({type:'editorMoved',config:{waitingTimerX:900,waitingTimerY:240,waitingTimerWidth:420,sceneEnteredAt:0}});e.change('waitingTimerTitle','等待下一局');e.change('waitingTimerOpacity',0);await e.submit();const saved=e.calls.at(-1).config;assert.equal(saved.waitingTimerX,900);assert.equal(saved.waitingTimerWidth,420);assert.equal(saved.waitingTimerTitle,'等待下一局');assert.equal(saved.waitingTimerOpacity,0);assert.equal(saved.sceneEnteredAt,undefined);assert.equal(e.state.scene,'game');
});

test('Preview keyboard movement honors scale, bounds, hidden elements and origin', () => {
  const events = {}, handlers = {}, messages = [], parent = {postMessage(message) {messages.push(message);}}, handle = {style: {}, append() {}, setAttribute() {}, addEventListener(type, fn) {handlers[type] = fn;}};
  const widget = {hidden: false, closest() {return null;}, getBoundingClientRect() {return {left: 500, top: 80, width: 100, height: 60};}};
  const state = {scene: 'game', ladder: {config: {scoreboardX: 1698, scoreboardY: 0}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/scene-editor-preview.js'), 'utf8'), {URLSearchParams, location: {search: '?preview=1&module=editor', origin: 'http://localhost'}, window: {SceneCustomization: M, SceneEditorPreviewState: state}, parent, document: {createElement() {return handle;}, body: {append() {}}, getElementById(id) {return id === 'canvas' ? {getBoundingClientRect() {return {left: 0, top: 0, width: 960};}} : widget;}}, addEventListener(type, fn) {events[type] = fn;}, setInterval() {}});
  events.message({source: parent, origin: 'http://foreign', data: {type: 'editorDragTarget', target: 'scoreboard'}}); assert.equal(handle.hidden, true);
  events.message({source: parent, origin: 'http://localhost', data: {type: 'editorDragTarget', target: 'scoreboard'}}); assert.equal(handle.hidden, false);
  handlers.keydown({key: 'ArrowRight', shiftKey: true, preventDefault() {}}); assert.equal(messages.at(-1).config.scoreboardX, 1700);
  handlers.keydown({key: 'ArrowUp', shiftKey: false, preventDefault() {}}); assert.equal(messages.at(-1).config.scoreboardY, 0);
  widget.hidden = true; const count = messages.length; handlers.keydown({key: 'ArrowDown', preventDefault() {}}); assert.equal(messages.length, count);
  widget.hidden = false; state.scene = 'loading'; state.ladder.config.loadingFreePosition = false;
  events.message({source: parent, origin: 'http://localhost', data: {type: 'editorDragTarget', target: 'text'}});
  handlers.keydown({key: 'ArrowDown', preventDefault() {}}); assert.equal(messages.at(-1).config.loadingTextX, 1000); assert.equal(messages.at(-1).config.loadingTextY, 161); assert.equal(messages.at(-1).config.loadingFreePosition, true);
});

test('preview resize honors canvas and widget scale, clamps width and alignment remains a position-only edit',()=>{
 const events={},messages=[],parent={postMessage:m=>messages.push(m)},nodes=[];
 const make=()=>{const n={style:{},handlers:{},children:[],append(child){this.children.push(child);},setAttribute(){},addEventListener(k,f){this.handlers[k]=f;},setPointerCapture(){},focus(){}};nodes.push(n);return n;};
 const widget={hidden:false,closest:()=>null,getBoundingClientRect:()=>({left:350,top:80,width:420,height:60})},state={scene:'game',ladder:{config:{scoreboardX:700,scoreboardY:160,scoreboardWidth:560}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/scene-editor-preview.js'),'utf8'),{URLSearchParams,location:{search:'?preview=1&module=editor',origin:'http://localhost'},window:{SceneCustomization:M,SceneEditorPreviewState:state},parent,document:{createElement:make,body:{append(){}},getElementById:id=>id==='canvas'?{getBoundingClientRect:()=>({left:0,top:0,width:960})}:widget},addEventListener:(k,f)=>events[k]=f,setInterval(){}});
 events.message({origin:'http://localhost',source:parent,data:{type:'editorDragTarget',target:'scoreboard'}});const handle=nodes[0],grip=nodes[1];handle.handlers.pointerdown({button:0,target:grip,clientX:100,clientY:100,pointerId:1,preventDefault(){}});handle.handlers.pointermove({clientX:115,clientY:100});assert.equal(messages.at(-1).config.scoreboardWidth,580);const gesture=messages.at(-1).gesture;handle.handlers.pointermove({clientX:10000,clientY:100});assert.equal(messages.at(-1).config.scoreboardWidth,1000);assert.equal(messages.at(-1).gesture,gesture);handle.handlers.pointerup();events.message({origin:'http://localhost',source:parent,data:{type:'editorAlign',axis:'center'}});assert.equal(messages.at(-1).config.scoreboardX,540);assert.equal('scoreboardWidth' in messages.at(-1).config,false);
});
