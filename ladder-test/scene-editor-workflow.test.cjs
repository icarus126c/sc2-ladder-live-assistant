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

test('Preview keyboard movement honors scale, bounds, hidden elements and origin', () => {
  const events = {}, handlers = {}, messages = [], parent = {postMessage(message) {messages.push(message);}}, handle = {style: {}, setAttribute() {}, addEventListener(type, fn) {handlers[type] = fn;}};
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
