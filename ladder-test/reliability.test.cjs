const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {createAssistant} = require('../ladder-server.cjs');
const {createReplayStore} = require('../ladder-replays.cjs');
const {createReplayWatcher} = require('../replay-watcher.cjs');

test('resuming from away or blank follows live, loading and menu states while manual pause still holds', async t => {
  let phase = 'live';
  const app = createAssistant({port: 0, dataDir: null, sc2Reader: async () => phase, intervalMs: 60000});
  t.after(() => app.close());
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const html = await (await fetch(base)).text();
  const token = html.match(/name="control-token" content="([a-f\d]+)"/)[1];
  async function action(body) {
    const response = await fetch(base + '/api/action', {method: 'POST', headers: {'X-Control-Token': token}, body: JSON.stringify(body)});
    assert.equal(response.status, 200);
    return response.json();
  }
  for (const from of ['break', 'blank']) for (const [client, target] of [['live', 'game'], ['loading', 'loading'], ['menu', 'intermission']]) {
    phase = client;
    await action({action: 'transition', scene: from});
    await app.sc2.poll(); await app.sc2.poll();
    assert.equal(app.snapshot().scene, from);
    await action({action: 'configure', config: {sc2AutoPaused: false}});
    await app.sc2.poll(); await app.sc2.poll();
    assert.equal(app.snapshot().scene, target, `${from} should resume into ${target}`);
  }
});

test('automatic scans recover both sides of midnight after a today scan without importing old sessions or recounting', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc2-midnight-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const midnight = Date.parse('2026-10-07T16:00:00Z');
  let now = midnight - 120000;
  const store = createReplayStore(null, () => now), parsed = new Map();
  const me = {human: true, toonHandle: '5-S2-1-9', name: 'Me', race: 'Terran', mmr: 4000};
  const op = {human: true, toonHandle: '5-S2-1-10', name: 'Opponent', race: 'Zerg', mmr: 4000};
  function fixture(name, at, mtime) {
    const file = path.join(dir, name + '.SC2Replay');
    fs.writeFileSync(file, name);
    fs.utimesSync(file, new Date(mtime), new Date(mtime));
    parsed.set(file, {ok: true, at, durationSeconds: 60, map: name, players: [me, op], selfPlayers: [me], opponents: [op], selfResult: 'W'});
  }
  fixture('saved-before-midnight', midnight - 2000, midnight - 1900);
  fixture('saved-after-midnight', midnight - 1000, midnight + 500);
  fixture('new-day', midnight + 2000, midnight + 3000);
  fixture('old-session-copy', midnight - 180000, midnight + 1000);
  store.configure({toonHandle: me.toonHandle, replayDirectory: dir});
  now = midnight + 10000;
  let calls = 0;
  const watcher = createReplayWatcher({store, now: () => now, intervalMs: 60000, parser: async file => { calls++; return parsed.get(file); }});
  t.after(() => watcher.close());
  await watcher.scan('today');
  assert.equal(store.snapshot().stats.total, 1);
  assert.equal(store.snapshot().session.stats.total, 1);
  await watcher.scan('auto');
  assert.equal(store.snapshot().session.stats.total, 3);
  assert.equal(store.snapshot().stats.total, 1);
  const firstPassCalls = calls;
  await watcher.scan('auto');
  assert.equal(calls, firstPassCalls, 'unchanged replays, including out-of-scope copies, remain cached');
  assert.equal(store.snapshot().session.stats.total, 3);
});

test('all builtin scene themes produce valid opacity fields and can be saved in each editor scene', async () => {
  const model = require('../public/scene-customization.js'), themes = require('../public/scene-themes.js');
  const nodes = new Map();
  function node(id = '') {
    let currentId = '';
    const item = {type: '', value: '', min: '', max: '', checked: false, dataset: {}, style: {}, children: [],
      append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; },
      addEventListener(name, handler) { this[name] = handler; }, setAttribute() {}, contentWindow: {postMessage() {}}};
    Object.defineProperty(item, 'id', {get: () => currentId, set(value) { currentId = value; nodes.set(value, item); }});
    if (id) item.id = id;
    return item;
  }
  const get = id => nodes.get(id) || node(id);
  const buttons = model.phases.map(phase => Object.assign(node(), {dataset: {editScene: phase}}));
  const store = createReplayStore();
  const win = {SceneCustomization: model, ResourceTemplate: require('../public/resource-template.js'), SceneThemes: themes, AssistantActions: {toast() {}, async act(action, {config}) {
    assert.equal(action, 'ladderConfigure'); store.configure(config); return {scene: 'game', ladder: store.snapshot()};
  }}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/scene-editor.js'), 'utf8'), {
    window: win, document: {getElementById: get, createElement: () => node(), querySelectorAll: () => buttons},
    location: {origin: 'http://localhost:1'}, addEventListener() {}
  });
  win.SceneEditor.render({scene: 'game', ladder: store.snapshot()});
  win.SceneEditor.connection(true);
  for (const phase of ['intermission', 'loading', 'break']) {
    buttons.find(button => button.dataset.editScene === phase).click();
    const prefix = model.prefixes[phase];
    for (const [name, theme] of Object.entries(themes.presets).filter(([name]) => name !== 'custom')) {
      const input = get('sceneEdit-' + prefix + 'Theme');
      input.value = name;
      get('sceneEditorForm').change({target: input});
      const opacity = get('sceneEdit-' + prefix + 'PanelOpacity');
      assert.ok(Number(opacity.value) >= Number(opacity.min) && Number(opacity.value) <= Number(opacity.max), `${phase}/${name}: native range validation must allow the preset`);
      await get('sceneEditorForm').submit({preventDefault() {}});
      assert.equal(store.getConfig()[prefix + 'PanelOpacity'], theme.PanelOpacity);
    }
    for (const key of [prefix + 'PanelOpacity', 'opacity']) {
      const input = get('sceneEdit-' + key); input.value = 0;
      assert.equal(Number(input.min), 0, 'fully transparent settings remain editable');
      get('sceneEditorForm').change({target: input});
    }
    await get('sceneEditorForm').submit({preventDefault() {}});
    assert.equal(store.getConfig()[prefix + 'PanelOpacity'], 0);
    assert.equal(store.getConfig().opacity, 0);
    assert.equal(Number(get('sceneEdit-catOpacity').min), 20, 'keyboard minimum still follows the server validator');
  }
});
